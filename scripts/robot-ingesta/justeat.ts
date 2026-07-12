/**
 * ROBOT JUST EAT · Descarga facturas y liquidaciones del portal de socios
 * (access.just-eat.es) y las deja en la bandeja. No interpreta nada.
 *
 * Modos (env MODO):
 *   semanal  → lo que haya nuevo (la bandeja deduplica por huella)
 *   backfill → trimestre completo (env TRIMESTRE = AAAA-Qn)
 */
import type { Page, BrowserContext } from 'playwright';
import { entregar, log, volcar, hoyMadrid } from './_lib/bandeja.js';
import { cuentasDe, esperarCodigo, guardarSesion, type Cuenta } from './_lib/portal.js';
import { abrir, quitarEstorbos, descargarDeLaPagina } from './_lib/navegador.js';

const P = 'justeat';
const RAIZ = 'https://access.just-eat.es';
const MODO = (process.env.MODO || 'semanal').toLowerCase();
const TRIMESTRE = process.env.TRIMESTRE || '';

async function dentro(page: Page): Promise<boolean> {
  return !(await page.locator('input[type="password"]').count().catch(() => 0));
}

async function entrar(page: Page, ctx: BrowserContext, c: Cuenta): Promise<boolean> {
  await page.goto(c.url_base || RAIZ, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(4000);
  await quitarEstorbos(page);
  if (await dentro(page)) { await log(P, 'sesion_ok', `${c.cuenta}: sesión guardada todavía válida`); return true; }

  const email = page.locator('input[type="email"], input[name="email"], input[name="username"], input[id*="user" i]').first();
  await email.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  await email.fill(c.usuario).catch(() => {});
  const pass = page.locator('input[type="password"]').first();
  await pass.fill(c.password).catch(() => {});
  await page.getByRole('button', { name: /entrar|log ?in|iniciar|continuar|sign in|acceder/i }).first().click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(8000);

  const codigoCampo = page.locator('input[autocomplete="one-time-code"], input[name*="code" i], input[id*="otp" i]').first();
  if (await codigoCampo.count().catch(() => 0)) {
    const codigo = await esperarCodigo(P, c.otp_remitente || 'just');
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

async function seccion(page: Page, ruta: string, tipo: string, periodo: string, destino: string) {
  await page.goto(`${RAIZ}${ruta}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(6000);
  await quitarEstorbos(page);
  const f = await descargarDeLaPagina(P, page, tipo);
  if (!f) return;
  await entregar({ fuente: P, tipo, nombre: f.nombre, datos: f.datos, periodo, destino });
}

async function trabajarCuenta(c: Cuenta) {
  const { browser, ctx, page } = await abrir(P, c.cuenta);
  try {
    if (!(await entrar(page, ctx, c))) return;

    if (MODO === 'backfill' && !/^\d{4}-Q[1-4]$/i.test(TRIMESTRE)) {
      await log(P, 'error', 'backfill necesita TRIMESTRE=AAAA-Qn'); process.exitCode = 1; return;
    }
    const periodo = MODO === 'backfill' ? TRIMESTRE : hoyMadrid(1);

    await seccion(page, '/invoices', 'justeat_factura', periodo, 'facturas');
    await seccion(page, '/payments', 'justeat_liquidacion', periodo, 'ventas');
  } catch (e: any) {
    await log(P, 'error', `${c.cuenta}: ${e?.message || e}`);
    await volcar(`${P}_error`, await page.content().catch(() => ''));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

async function main() {
  await log(P, 'inicio', `modo=${MODO}${TRIMESTRE ? ` trimestre=${TRIMESTRE}` : ''}`);
  const cuentas = await cuentasDe(P);
  if (cuentas.length === 0) { await log(P, 'sin_credenciales', 'no hay cuentas activas de Just Eat'); return; }
  for (const c of cuentas) await trabajarCuenta(c);
  await log(P, 'fin', `${cuentas.length} cuenta(s)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
