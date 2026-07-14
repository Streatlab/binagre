/**
 * ROBOT SINQRO · Los pedidos de Just Eat viven aquí. Entra SIEMPRE por
 * panel.sinqro.com (NO por app.sinqro.com) y baja los informes del punto de venta.
 *
 * Mapa real (volcado 14-jul-2026):
 *   /selling_point_accounts/3976805/orders   → pedidos
 *   /selling_point_accounts/3976805/report   → informes
 *   /business_accounts/3976804               → cuenta de negocio
 *   /billing_accounts                        → facturación
 *
 * Login: robot_credenciales (plataforma='sinqro'). Código por correo si lo pide:
 * IMAP del buzón de la cuenta (buzones_otp).
 */
import type { Page, BrowserContext } from 'playwright';
import { entregar, log, volcar, hoyMadrid } from './_lib/bandeja.js';
import { cuentasDe, esperarCodigo, guardarSesion, type Cuenta } from './_lib/portal.js';
import { abrir, quitarEstorbos, descargarDeLaPagina } from './_lib/navegador.js';

const P = 'sinqro';
const PANEL = 'https://panel.sinqro.com';          // ← nunca app.sinqro.com
const PUNTO_VENTA = '3976805';
const NEGOCIO = '3976804';
const MODO = (process.env.MODO || 'diario').toLowerCase();
const MES = process.env.MES || '';

async function dentro(page: Page): Promise<boolean> {
  if (await page.locator('input[type="password"]').count().catch(() => 0)) return false;
  return !/\/(login|signin|sign_in|auth)/i.test(page.url());
}

async function entrar(page: Page, ctx: BrowserContext, c: Cuenta): Promise<boolean> {
  await page.goto(PANEL, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(5000);
  await quitarEstorbos(page);
  if (await dentro(page)) { await log(P, 'sesion_ok', `${c.cuenta}: sesión guardada todavía válida`); return true; }

  const email = page.locator('input[type="email"], input[name="email"], input[name="username"], input[id*="email" i], input[type="text"]').first();
  await email.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  await email.fill(c.usuario).catch(() => {});
  await page.locator('input[type="password"]').first().fill(c.password).catch(() => {});

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
  await page.waitForTimeout(7000);
  await quitarEstorbos(page);

  // Sinqro suele tener un botón de exportar/descargar; si hay filtro de fechas, se deja el de por defecto.
  const f = await descargarDeLaPagina(P, page, `${tipo}_${cuenta}`);
  if (!f) return false;
  await entregar({ fuente: P, tipo, nombre: `${cuenta}_${f.nombre}`, datos: f.datos, periodo, destino });
  return true;
}

async function trabajarCuenta(c: Cuenta) {
  const { browser, ctx, page } = await abrir(P, c.cuenta);
  try {
    if (!(await entrar(page, ctx, c))) return;
    const periodo = MODO === 'backfill' && /^\d{4}-\d{2}$/.test(MES) ? MES : hoyMadrid(1);

    const rutas: Array<[string, string, string]> = [
      [`${PANEL}/selling_point_accounts/${PUNTO_VENTA}/report`, 'sinqro_informe', 'ventas'],
      [`${PANEL}/selling_point_accounts/${PUNTO_VENTA}/orders`, 'sinqro_pedidos', 'ventas'],
      [`${PANEL}/business_accounts/${NEGOCIO}`, 'sinqro_negocio', 'ventas'],
      [`${PANEL}/billing_accounts`, 'sinqro_factura', 'facturas'],
    ];

    let alguno = false;
    for (const [url, tipo, destino] of rutas) {
      if (await seccion(page, url, tipo, periodo, c.cuenta, destino)) alguno = true;
    }
    if (!alguno) {
      await volcar(`${P}_informes`, await page.content().catch(() => ''));
      await log(P, 'aviso', 'ninguna sección soltó fichero; revisar volcados sinqro_* en robot_debug');
    }
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
