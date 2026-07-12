/**
 * ROBOT GLOVO · Descarga informes del portal de gestión y los deja en la bandeja.
 *
 * Modos (env MODO):
 *   diario   → historial de pedidos de ayer
 *   semanal  → liquidaciones de la semana cerrada + facturas disponibles
 *   backfill → un mes completo (env MES = AAAA-MM)
 *
 * Credenciales en robot_credenciales (plataforma='glovo'). Sin ellas sale en verde.
 */
import type { Page } from 'playwright';
import { entregar, log, volcar, hoyMadrid } from './_lib/bandeja.js';
import { credenciales, esperarCodigo, guardarSesion } from './_lib/portal.js';
import { abrir, quitarEstorbos, descargarDeLaPagina } from './_lib/navegador.js';

const P = 'glovo';
const RAIZ = 'https://managers.glovoapp.com';
const MODO = (process.env.MODO || 'diario').toLowerCase();
const MES = process.env.MES || '';

async function dentro(page: Page): Promise<boolean> {
  return !/login|signin/i.test(page.url()) && !(await page.locator('input[type="password"]').count().catch(() => 0));
}

async function entrar(page: Page, ctx: any): Promise<boolean> {
  const cred = await credenciales(P);
  if (!cred) { await log(P, 'sin_credenciales', 'no hay usuario/contraseña de Glovo en robot_credenciales'); return false; }

  await page.goto(RAIZ, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(4000);
  await quitarEstorbos(page);
  if (await dentro(page)) { await log(P, 'sesion_ok', 'sesión guardada todavía válida'); return true; }

  const email = page.locator('input[type="email"], input[name="email"], input[id*="email" i], input[name="username"]').first();
  await email.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  await email.fill(cred.usuario).catch(() => {});
  const pass = page.locator('input[type="password"]').first();
  await pass.fill(cred.password).catch(() => {});
  await page.getByRole('button', { name: /entrar|log ?in|iniciar|continuar|sign in/i }).first().click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(8000);

  const codigoCampo = page.locator('input[autocomplete="one-time-code"], input[name*="code" i], input[id*="otp" i]').first();
  if (await codigoCampo.count().catch(() => 0)) {
    const codigo = await esperarCodigo(P, cred.otp_remitente || 'glovo');
    if (!codigo) { await volcar(`${P}_otp`, await page.content()); return false; }
    await codigoCampo.fill(codigo).catch(() => {});
    await page.keyboard.press('Enter');
    await page.waitForTimeout(8000);
  }

  await quitarEstorbos(page);
  const ok = await dentro(page);
  await log(P, ok ? 'login_ok' : 'login_ko', `url=${page.url()}`);
  if (!ok) await volcar(`${P}_login_ko`, await page.content());
  else await guardarSesion(P, ctx);
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

async function main() {
  await log(P, 'inicio', `modo=${MODO}${MES ? ` mes=${MES}` : ''}`);
  const { browser, ctx, page } = await abrir(P);
  try {
    if (!(await entrar(page, ctx))) return;

    const ayer = hoyMadrid(1);

    if (MODO === 'diario') {
      await seccion(page, '/orders', 'glovo_orderdetails', ayer, 'ventas');
    } else if (MODO === 'semanal') {
      await seccion(page, '/invoicing', 'glovo_liquidacion', ayer, 'ventas');
      await seccion(page, '/invoices', 'glovo_factura', ayer, 'facturas');
    } else if (MODO === 'backfill') {
      if (!/^\d{4}-\d{2}$/.test(MES)) { await log(P, 'error', 'backfill necesita MES=AAAA-MM'); process.exitCode = 1; return; }
      await seccion(page, '/orders', 'glovo_orderdetails', MES, 'ventas');
      await seccion(page, '/invoicing', 'glovo_liquidacion', MES, 'ventas');
    }

    await log(P, 'fin', 'ok');
  } catch (e: any) {
    await log(P, 'error', String(e?.message || e));
    await volcar(`${P}_error`, await page.content().catch(() => ''));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
