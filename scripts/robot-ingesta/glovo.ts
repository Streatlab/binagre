/**
 * ROBOT GLOVO · Descarga informes del portal de gestión y los deja en la bandeja.
 * Hay DOS cuentas (posmodernos y streatlab): las recorre las dos.
 *
 * Modos (env MODO):
 *   diario   → historial de pedidos de ayer
 *   semanal  → liquidaciones de la semana cerrada + facturas
 *   backfill → un mes completo (env MES = AAAA-MM)
 */
import type { Page, BrowserContext } from 'playwright';
import { entregar, log, volcar, hoyMadrid } from './_lib/bandeja.js';
import { cuentasDe, esperarCodigo, guardarSesion, type Cuenta } from './_lib/portal.js';
import { abrir, quitarEstorbos, descargarDeLaPagina } from './_lib/navegador.js';

const P = 'glovo';
const RAIZ = 'https://managers.glovoapp.com';
const MODO = (process.env.MODO || 'diario').toLowerCase();
const MES = process.env.MES || '';

async function dentro(page: Page): Promise<boolean> {
  return !/login|signin/i.test(page.url()) && !(await page.locator('input[type="password"]').count().catch(() => 0));
}

async function entrar(page: Page, ctx: BrowserContext, c: Cuenta): Promise<boolean> {
  await page.goto(c.url_base || RAIZ, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(4000);
  await quitarEstorbos(page);
  if (await dentro(page)) { await log(P, 'sesion_ok', `${c.cuenta}: sesión guardada todavía válida`); return true; }

  const email = page.locator('input[type="email"], input[name="email"], input[id*="email" i], input[name="username"]').first();
  await email.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  await email.fill(c.usuario).catch(() => {});
  const pass = page.locator('input[type="password"]').first();
  await pass.fill(c.password).catch(() => {});
  await page.getByRole('button', { name: /entrar|log ?in|iniciar|continuar|sign in/i }).first().click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(8000);

  const codigoCampo = page.locator('input[autocomplete="one-time-code"], input[name*="code" i], input[id*="otp" i]').first();
  if (await codigoCampo.count().catch(() => 0)) {
    const codigo = await esperarCodigo(P, c.otp_remitente || 'glovo');
    if (!codigo) { await volcar(`${P}_otp`, await page.content()); return false; }
    await codigoCampo.fill(codigo).catch(() => {});
    await page.keyboard.press('Enter');
    await page.waitForTimeout(8000);
  }

  await quitarEstorbos(page);
  const ok = await dentro(page);
  await log(P, ok ? 'login_ok' : 'login_ko', `${c.cuenta} · url=${page.url()}`);
  if (!ok) await volcar(`${P}_login_ko`, await page.content());
  else await guardarSesion(P, c.cuenta, ctx);
  return ok;
}

async function seccion(page: Page, ruta: string, tipo: string, periodo: string, destino: string, cuenta: string) {
  await page.goto(`${RAIZ}${ruta}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(6000);
  await quitarEstorbos(page);
  const f = await descargarDeLaPagina(P, page, `${tipo}_${cuenta}`);
  if (!f) return;
  await entregar({ fuente: P, tipo, nombre: `${cuenta}_${f.nombre}`, datos: f.datos, periodo, destino });
}

async function trabajarCuenta(c: Cuenta) {
  const { browser, ctx, page } = await abrir(P, c.cuenta);
  try {
    if (!(await entrar(page, ctx, c))) return;
    const ayer = hoyMadrid(1);

    if (MODO === 'diario') {
      await seccion(page, '/orders', 'glovo_orderdetails', ayer, 'ventas', c.cuenta);
    } else if (MODO === 'semanal') {
      await seccion(page, '/invoicing', 'glovo_liquidacion', ayer, 'ventas', c.cuenta);
      await seccion(page, '/invoices', 'glovo_factura', ayer, 'facturas', c.cuenta);
    } else if (MODO === 'backfill') {
      if (!/^\d{4}-\d{2}$/.test(MES)) { await log(P, 'error', 'backfill necesita MES=AAAA-MM'); process.exitCode = 1; return; }
      await seccion(page, '/orders', 'glovo_orderdetails', MES, 'ventas', c.cuenta);
      await seccion(page, '/invoicing', 'glovo_liquidacion', MES, 'ventas', c.cuenta);
    }
  } catch (e: any) {
    await log(P, 'error', `${c.cuenta}: ${e?.message || e}`);
    await volcar(`${P}_error`, await page.content().catch(() => ''));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

async function main() {
  await log(P, 'inicio', `modo=${MODO}${MES ? ` mes=${MES}` : ''}`);
  const cuentas = await cuentasDe(P);
  if (cuentas.length === 0) { await log(P, 'sin_credenciales', 'no hay cuentas activas de Glovo'); return; }
  for (const c of cuentas) await trabajarCuenta(c);
  await log(P, 'fin', `${cuentas.length} cuenta(s)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
