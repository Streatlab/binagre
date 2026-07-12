/**
 * ROBOT UBER EATS · Descarga informes y los deja en la bandeja. No interpreta nada.
 *
 * Modos (env MODO):
 *   diario    → historial de pedidos de ayer + detalle de ganancias por artículo
 *   semanal   → resumen de ganancias (CSV) de la última semana cerrada
 *   mensual   → resumen mensual (PDF) del mes anterior. Uber lo publica unos días
 *               DESPUÉS de cerrar el mes: si no está, no es error.
 *   backfill  → un mes completo (env MES = AAAA-MM). UN SOLO MES POR EJECUCIÓN.
 *
 * Credenciales y cuentas: tabla robot_credenciales (plataforma='uber').
 * Sin claves → sale en verde con 'sin_credenciales'.
 */
import type { Page, BrowserContext } from 'playwright';
import { entregar, log, volcar, hoyMadrid } from './_lib/bandeja.js';
import { cuentasDe, esperarCodigo, guardarSesion, type Cuenta } from './_lib/portal.js';
import { abrir, quitarEstorbos, descargarDeLaPagina } from './_lib/navegador.js';

const P = 'uber';
const RAIZ = 'https://merchants.ubereats.com';
const MODO = (process.env.MODO || 'diario').toLowerCase();
const MES = process.env.MES || '';

async function dentro(page: Page): Promise<boolean> {
  return !/login|auth|signin/i.test(page.url());
}

async function entrar(page: Page, ctx: BrowserContext, c: Cuenta): Promise<boolean> {
  await page.goto(c.url_base || `${RAIZ}/manager`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(4000);
  await quitarEstorbos(page);
  if (await dentro(page)) { await log(P, 'sesion_ok', `${c.cuenta}: sesión guardada todavía válida`); return true; }

  const email = page.locator('input[type="email"], input[name="email"], #PHONE_NUMBER_or_EMAIL_ADDRESS, input[id*="email" i]').first();
  await email.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  await email.fill(c.usuario).catch(() => {});
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5000);

  const pass = page.locator('input[type="password"]').first();
  if (await pass.count().catch(() => 0)) {
    await pass.fill(c.password).catch(() => {});
    await page.keyboard.press('Enter');
    await page.waitForTimeout(6000);
  }

  const codigoCampo = page.locator('input[id*="code" i], input[name*="code" i], input[autocomplete="one-time-code"]').first();
  if (await codigoCampo.count().catch(() => 0)) {
    const codigo = await esperarCodigo(P, c.otp_remitente || 'uber');
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
  await page.goto(ruta.startsWith('http') ? ruta : `${RAIZ}${ruta}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
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
    const ayer = hoyMadrid(1);

    if (MODO === 'diario') {
      await seccion(page, '/manager/orders', 'uber_historial_pedidos', ayer, 'ventas');
      await seccion(page, '/manager/analytics', 'uber_detalle_articulo', ayer, 'ventas');
    } else if (MODO === 'semanal') {
      await seccion(page, c.url_base || '/manager/payments', 'uber_resumen_ganancias', ayer, 'ventas');
    } else if (MODO === 'mensual') {
      const d = new Date();
      const mesAnterior = new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 7);
      await seccion(page, c.url_base || '/manager/payments', 'uber_resumen_mensual', mesAnterior, 'ventas');
    } else if (MODO === 'backfill') {
      if (!/^\d{4}-\d{2}$/.test(MES)) { await log(P, 'error', 'backfill necesita MES=AAAA-MM'); process.exitCode = 1; return; }
      await seccion(page, '/manager/orders', 'uber_historial_pedidos', MES, 'ventas');
      await seccion(page, '/manager/analytics', 'uber_detalle_articulo', MES, 'ventas');
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
  if (cuentas.length === 0) { await log(P, 'sin_credenciales', 'no hay cuentas activas de Uber'); return; }
  for (const c of cuentas) await trabajarCuenta(c);
  await log(P, 'fin', `${cuentas.length} cuenta(s)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
