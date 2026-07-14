/**
 * ROBOT SINQRO · Descarga los informes de ventas de Sinqro (aquí viven los pedidos
 * de Just Eat, que en su portal no tiene informes) y los deja en la bandeja.
 *
 * Mapa real del panel (14-jul-2026, volcado del login):
 *   - Cuenta de negocio:      /business_accounts/3976804
 *   - Punto de venta:         /selling_point_accounts/3976805
 *   - Facturación:            /billing_accounts
 * Los informes cuelgan del punto de venta. El robot recorre esa rama buscando
 * la sección de pedidos/informes y su botón de exportar; si no la encuentra,
 * vuelca el HTML para afinar la ruta.
 *
 * Login: robot_credenciales (plataforma='sinqro'). Código por correo si lo pide:
 * se lee por IMAP del buzón de la cuenta (buzones_otp).
 */
import type { Page, BrowserContext } from 'playwright';
import { entregar, log, volcar, hoyMadrid } from './_lib/bandeja.js';
import { cuentasDe, esperarCodigo, guardarSesion, type Cuenta } from './_lib/portal.js';
import { abrir, quitarEstorbos, descargarDeLaPagina } from './_lib/navegador.js';

const P = 'sinqro';
const MODO = (process.env.MODO || 'diario').toLowerCase();
const MES = process.env.MES || '';
const PUNTO_VENTA = '3976805';
const NEGOCIO = '3976804';

async function dentro(page: Page): Promise<boolean> {
  if (await page.locator('input[type="password"]').count().catch(() => 0)) return false;
  const u = page.url();
  return !/\/(login|signin|sign_in|auth)/i.test(u);
}

async function entrar(page: Page, ctx: BrowserContext, c: Cuenta): Promise<boolean> {
  const base = (c.url_base || 'https://panel.sinqro.com').replace(/\/$/, '');
  await page.goto(base, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(5000);
  await quitarEstorbos(page);
  if (await dentro(page)) { await log(P, 'sesion_ok', `${c.cuenta}: sesión guardada todavía válida`); return true; }

  const email = page.locator('input[type="email"], input[name="email"], input[name="username"], input[id*="email" i], input[type="text"]').first();
  await email.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  await email.fill(c.usuario).catch(() => {});
  const pass = page.locator('input[type="password"]').first();
  await pass.fill(c.password).catch(() => {});

  const pedidoEn = new Date();
  await page.getByRole('button', { name: /entrar|acceder|log ?in|iniciar|continuar|sign in/i }).first()
    .click({ timeout: 10000 })
    .catch(async () => { await page.keyboard.press('Enter').catch(() => {}); });
  await page.waitForTimeout(9000);
  await quitarEstorbos(page);

  if (!(await dentro(page))) {
    const hayOtp = await page.locator('input[autocomplete="one-time-code"], input[maxlength="1"], input[name*="code" i]').count().catch(() => 0);
    if (hayOtp) {
      const codigo = await esperarCodigo(P, 'sinqro', 240, pedidoEn, c.usuario);
      if (codigo) {
        await page.locator('input[autocomplete="one-time-code"], input[maxlength="1"], input[name*="code" i]').first().type(codigo, { delay: 120 }).catch(() => {});
        await page.keyboard.press('Enter').catch(() => {});
        await page.waitForTimeout(8000);
      }
    }
  }

  const ok = await dentro(page);
  await log(P, ok ? 'login_ok' : 'login_ko', `${c.cuenta} · url=${page.url()}`);
  if (ok) await guardarSesion(P, c.cuenta, ctx);
  else await volcar(`${P}_login_ko`, await page.content().catch(() => ''));
  return ok;
}

async function seccion(page: Page, url: string, tipo: string, periodo: string, cuenta: string, destino = 'ventas'): Promise<boolean> {
  await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(6000);
  await quitarEstorbos(page);
  const f = await descargarDeLaPagina(P, page, `${tipo}_${cuenta}`);
  if (!f) return false;
  await entregar({ fuente: P, tipo, nombre: `${cuenta}_${f.nombre}`, datos: f.datos, periodo, destino });
  return true;
}

/** Sigue los enlaces del punto de venta buscando pedidos/informes. */
async function explorarPuntoVenta(page: Page, base: string, cuenta: string) {
  await page.goto(`${base}/selling_point_accounts/${PUNTO_VENTA}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(6000);
  await volcar(`${P}_punto_venta`, await page.content().catch(() => ''));

  const enlaces = await page.locator('a[href]').evaluateAll((as) =>
    as.map((a) => (a as HTMLAnchorElement).getAttribute('href') || '')
      .filter((h) => /order|pedido|report|informe|sale|venta|stat|export|invoice|factura|liquidac/i.test(h)),
  ).catch(() => [] as string[]);

  const unicos = [...new Set(enlaces)].slice(0, 12);
  await log(P, 'mapa', unicos.length ? `enlaces de interés: ${unicos.join(' | ')}`.slice(0, 400) : 'ningún enlace de pedidos/informes en el punto de venta');
  return unicos;
}

async function trabajarCuenta(c: Cuenta) {
  const { browser, ctx, page } = await abrir(P, c.cuenta);
  try {
    if (!(await entrar(page, ctx, c))) return;
    const base = (c.url_base || 'https://panel.sinqro.com').replace(/\/$/, '');
    const periodo = MODO === 'backfill' && /^\d{4}-\d{2}$/.test(MES) ? MES : hoyMadrid(1);

    const enlaces = await explorarPuntoVenta(page, base, c.cuenta);
    for (const h of enlaces) {
      const url = h.startsWith('http') ? h : `${base}${h.startsWith('/') ? '' : '/'}${h}`;
      const tipo = /invoice|factura/i.test(h) ? 'sinqro_factura' : 'sinqro_ventas';
      const destino = /invoice|factura/i.test(h) ? 'facturas' : 'ventas';
      if (await seccion(page, url, tipo, periodo, c.cuenta, destino)) return;
    }

    // Rutas conocidas del panel por si el punto de venta no lista nada
    for (const r of [`/business_accounts/${NEGOCIO}`, '/billing_accounts']) {
      if (await seccion(page, `${base}${r}`, 'sinqro_ventas', periodo, c.cuenta)) return;
    }
    await log(P, 'aviso', 'sin fichero; revisar volcados sinqro_punto_venta en robot_debug');
  } catch (e: any) {
    await log(P, 'error', `${c.cuenta}: ${e?.message || e}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

async function main() {
  await log(P, 'inicio', `modo=${MODO}${MES ? ` mes=${MES}` : ''}`);
  const cuentas = await cuentasDe(P);
  if (cuentas.length === 0) { await log(P, 'sin_credenciales', 'no hay cuentas activas de Sinqro'); return; }
  for (const c of cuentas) await trabajarCuenta(c);
  await log(P, 'fin', `${cuentas.length} cuenta(s)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
