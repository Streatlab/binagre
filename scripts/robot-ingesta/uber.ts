/**
 * ROBOT UBER EATS · Descarga informes y los deja en la bandeja. No interpreta nada.
 *
 * Modos (env MODO):
 *   diario    → historial de pedidos de ayer + detalle de ganancias por artículo de ayer
 *   semanal   → resumen de ganancias (CSV) de la última semana cerrada
 *   mensual   → resumen mensual (PDF) del mes anterior. Uber lo publica unos días
 *               DESPUÉS de cerrar el mes: si no está, no es error.
 *   backfill  → un mes completo (env MES = AAAA-MM). UN SOLO MES POR EJECUCIÓN.
 *
 * Credenciales: tabla robot_credenciales (plataforma='uber'). Si no están, sale
 * en verde con estado 'sin_credenciales' — no rompe nada.
 * Código de un solo uso: se lee del buzón del cartero por IMAP.
 */
import type { Page } from 'playwright';
import { entregar, log, volcar, hoyMadrid } from './_lib/bandeja.js';
import { credenciales, esperarCodigo, guardarSesion } from './_lib/portal.js';
import { abrir, quitarEstorbos, descargarDeLaPagina } from './_lib/navegador.js';

const P = 'uber';
const RAIZ = 'https://merchants.ubereats.com';
const MODO = (process.env.MODO || 'diario').toLowerCase();
const MES = process.env.MES || '';

async function dentro(page: Page): Promise<boolean> {
  return !/login|auth|signin/i.test(page.url());
}

async function entrar(page: Page, ctx: any): Promise<boolean> {
  const cred = await credenciales(P);
  if (!cred) { await log(P, 'sin_credenciales', 'no hay usuario/contraseña de Uber en robot_credenciales'); return false; }

  await page.goto(`${RAIZ}/manager`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(4000);
  await quitarEstorbos(page);
  if (await dentro(page)) { await log(P, 'sesion_ok', 'sesión guardada todavía válida'); return true; }

  // Usuario
  const email = page.locator('input[type="email"], input[name="email"], #PHONE_NUMBER_or_EMAIL_ADDRESS, input[id*="email" i]').first();
  await email.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  await email.fill(cred.usuario).catch(() => {});
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5000);

  // Contraseña
  const pass = page.locator('input[type="password"]').first();
  if (await pass.count().catch(() => 0)) {
    await pass.fill(cred.password).catch(() => {});
    await page.keyboard.press('Enter');
    await page.waitForTimeout(6000);
  }

  // Código de un solo uso (si lo pide)
  const codigoCampo = page.locator('input[id*="code" i], input[name*="code" i], input[autocomplete="one-time-code"]').first();
  if (await codigoCampo.count().catch(() => 0)) {
    const codigo = await esperarCodigo(P, cred.otp_remitente || 'uber');
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

/** Abre una sección del panel y se trae lo que haya para descargar. */
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
    if (!(await entrar(page, ctx))) return; // sale en verde: sin credenciales o login KO ya registrado

    const ayer = hoyMadrid(1);

    if (MODO === 'diario') {
      await seccion(page, '/manager/orders', 'uber_historial_pedidos', ayer, 'ventas');
      await seccion(page, '/manager/analytics', 'uber_detalle_articulo', ayer, 'ventas');
    } else if (MODO === 'semanal') {
      await seccion(page, '/manager/payments', 'uber_resumen_ganancias', ayer, 'ventas');
    } else if (MODO === 'mensual') {
      const d = new Date();
      const mesAnterior = new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 7);
      await seccion(page, '/manager/payments', 'uber_resumen_mensual', mesAnterior, 'ventas');
    } else if (MODO === 'backfill') {
      if (!/^\d{4}-\d{2}$/.test(MES)) { await log(P, 'error', 'backfill necesita MES=AAAA-MM'); process.exitCode = 1; return; }
      await seccion(page, '/manager/orders', 'uber_historial_pedidos', MES, 'ventas');
      await seccion(page, '/manager/analytics', 'uber_detalle_articulo', MES, 'ventas');
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
