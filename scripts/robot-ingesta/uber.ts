/**
 * ROBOT UBER EATS · Descarga informes y los deja en la bandeja. No interpreta nada.
 * Cuenta reactivada 14-jul-2026 (la había desactivado otro proceso). NO desactivar.
 *
 * Modos (env MODO):
 *   diario    → historial de pedidos de ayer + detalle de ganancias por artículo
 *   semanal   → resumen de ganancias (CSV) de la última semana cerrada
 *   mensual   → resumen mensual (PDF) del mes anterior
 *   backfill  → un mes completo (env MES = AAAA-MM). UN SOLO MES POR EJECUCIÓN.
 *
 * Login:
 *   1) correo escrito tecla a tecla → botón "Continuar".
 *   2) Uber propone código por SMS: NO se espera. Se abre "Más opciones" y se elige
 *      entrar con contraseña.
 *   3) Uber tarda en pasar de pantalla: se espera a que el título cambie.
 *   Cada pantalla se vuelca a robot_debug (uber_paso_N).
 */
import type { Page, BrowserContext } from 'playwright';
import { entregar, log, volcar, hoyMadrid } from './_lib/bandeja.js';
import { cuentasDe, guardarSesion, type Cuenta } from './_lib/portal.js';
import { abrir, quitarEstorbos, descargarDeLaPagina } from './_lib/navegador.js';

const P = 'uber';
const RAIZ = 'https://merchants.ubereats.com';
const MODO = (process.env.MODO || 'diario').toLowerCase();
const MES = process.env.MES || '';

const RE_MAS = /m[aá]s opciones|otras opciones|otra forma|otro m[eé]todo|more options|try another way|another way|use another/i;
const RE_PASS = /contrase[nñ]a|password/i;
const RE_SEGUIR = /^(continuar|siguiente|continue|next|acceder|iniciar sesi[oó]n)$/i;

async function dentro(page: Page): Promise<boolean> {
  return /merchants\.ubereats\.com/i.test(page.url()) && !/login|auth|signin/i.test(page.url());
}

async function pantalla(page: Page): Promise<string> {
  return (await page.locator('h1, h2, [role="heading"]').first().innerText().catch(() => '')).trim();
}

async function seguir(page: Page) {
  const antes = await pantalla(page);
  const b = page.getByRole('button', { name: RE_SEGUIR }).first();
  if (await b.count().catch(() => 0)) await b.click({ timeout: 8000 }).catch(() => {});
  else await page.keyboard.press('Enter').catch(() => {});

  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(2000);
    if (await page.locator('input[type="password"]').count().catch(() => 0)) return;
    const ahora = await pantalla(page);
    if (ahora && ahora !== antes) return;
    if (await dentro(page)) return;
  }
}

async function abrirCampoContrasena(page: Page): Promise<boolean> {
  for (let i = 0; i < 4; i++) {
    if (await page.locator('input[type="password"]').count().catch(() => 0)) return true;
    await volcar(`${P}_paso_${i}`, await page.content().catch(() => ''));

    const mas = page.locator('button, a, [role="button"], [role="link"], span[tabindex]').filter({ hasText: RE_MAS }).first();
    if (await mas.count().catch(() => 0)) {
      await mas.click({ timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(3500);
    }

    const opcion = page.locator('button, a, li, label, div[role="button"], [role="radio"], [role="option"]').filter({ hasText: RE_PASS }).first();
    if (await opcion.count().catch(() => 0)) {
      await opcion.click({ timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(2500);
      if (!(await page.locator('input[type="password"]').count().catch(() => 0))) await seguir(page);
    } else {
      await page.waitForTimeout(4000);
    }
  }
  return (await page.locator('input[type="password"]').count().catch(() => 0)) > 0;
}

async function entrar(page: Page, ctx: BrowserContext, c: Cuenta): Promise<boolean> {
  await page.goto(c.url_base || `${RAIZ}/manager`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(5000);
  await quitarEstorbos(page);
  if (await dentro(page)) { await log(P, 'sesion_ok', `${c.cuenta}: sesión guardada todavía válida`); return true; }

  const email = page.locator('#PHONE_NUMBER_or_EMAIL_ADDRESS, input[type="email"], input[name="email"]').first();
  await email.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  await email.click({ timeout: 8000 }).catch(() => {});
  await email.type(c.usuario, { delay: 90 }).catch(async () => { await email.fill(c.usuario).catch(() => {}); });
  await page.waitForTimeout(1200);
  await seguir(page);
  await quitarEstorbos(page);

  if (!(await abrirCampoContrasena(page))) {
    await log(P, 'login_ko', `${c.cuenta}: atascado en "${await pantalla(page)}" · url=${page.url()}`);
    await volcar(`${P}_sin_opcion_pass`, await page.content());
    return false;
  }

  const pass = page.locator('input[type="password"]').first();
  await pass.click({ timeout: 8000 }).catch(() => {});
  await pass.type(c.password, { delay: 70 }).catch(async () => { await pass.fill(c.password).catch(() => {}); });
  await seguir(page);
  await page.waitForTimeout(8000);
  await quitarEstorbos(page);

  const ok = await dentro(page);
  await log(P, ok ? 'login_ok' : 'login_ko', `${c.cuenta} · pantalla="${await pantalla(page)}" · url=${page.url()}`);
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
