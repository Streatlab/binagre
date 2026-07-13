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
 * Login (13-jul-2026): Uber propone primero código por SMS. NO se espera ese código:
 * se pulsa "Más opciones" / "Otra forma" y se elige entrar con contraseña.
 *
 * Credenciales y cuentas: tabla robot_credenciales (plataforma='uber').
 * Sin claves → sale en verde con 'sin_credenciales'.
 */
import type { Page, BrowserContext } from 'playwright';
import { entregar, log, volcar, hoyMadrid } from './_lib/bandeja.js';
import { cuentasDe, guardarSesion, type Cuenta } from './_lib/portal.js';
import { abrir, quitarEstorbos, descargarDeLaPagina } from './_lib/navegador.js';

const P = 'uber';
const RAIZ = 'https://merchants.ubereats.com';
const MODO = (process.env.MODO || 'diario').toLowerCase();
const MES = process.env.MES || '';

const RE_MAS_OPCIONES = /m[aá]s opciones|otras opciones|otra forma|otro m[eé]todo|more options|try another way|another way/i;
const RE_CONTRASENA = /contrase[nñ]a|password/i;

async function dentro(page: Page): Promise<boolean> {
  return !/login|auth|signin/i.test(page.url());
}

/** Si Uber ofrece SMS, abre "más opciones" y elige contraseña. Devuelve true si logró abrir el campo de contraseña. */
async function elegirContrasena(page: Page): Promise<boolean> {
  for (let intento = 0; intento < 3; intento++) {
    if (await page.locator('input[type="password"]').count().catch(() => 0)) return true;

    const mas = page.getByRole('button', { name: RE_MAS_OPCIONES })
      .or(page.getByRole('link', { name: RE_MAS_OPCIONES }))
      .or(page.locator('button, a, [role="button"]').filter({ hasText: RE_MAS_OPCIONES }))
      .first();
    if (await mas.count().catch(() => 0)) {
      await mas.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(3000);
    }

    const opcionPass = page.getByRole('button', { name: RE_CONTRASENA })
      .or(page.getByRole('link', { name: RE_CONTRASENA }))
      .or(page.getByRole('radio', { name: RE_CONTRASENA }))
      .or(page.locator('button, a, li, label, [role="button"], [role="radio"]').filter({ hasText: RE_CONTRASENA }))
      .first();
    if (await opcionPass.count().catch(() => 0)) {
      await opcionPass.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(2000);
      const seguir = page.getByRole('button', { name: /continuar|siguiente|continue|next/i }).first();
      if (await seguir.count().catch(() => 0)) {
        await seguir.click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(3000);
      }
    }

    await page.waitForTimeout(2000);
  }
  return (await page.locator('input[type="password"]').count().catch(() => 0)) > 0;
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
  await page.waitForTimeout(6000);
  await quitarEstorbos(page);

  const hayPass = await elegirContrasena(page);
  if (!hayPass) {
    await log(P, 'login_ko', `${c.cuenta}: no aparece la opción de contraseña · url=${page.url()}`);
    await volcar(`${P}_sin_opcion_pass`, await page.content());
    return false;
  }

  const pass = page.locator('input[type="password"]').first();
  await pass.fill(c.password).catch(() => {});
  await page.keyboard.press('Enter');
  await page.waitForTimeout(9000);
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
