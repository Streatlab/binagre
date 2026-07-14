/**
 * ROBOT UBER EATS · Descarga informes y los deja en la bandeja.
 *
 * Entrada (14-jul-2026), por orden:
 *   1) SESIÓN SEMBRADA: cookies del navegador de Rubén guardadas en
 *      sesiones/uber__streatlab.json. Si valen, se entra sin login (Uber bloquea
 *      el login automático desde servidores: su antirrobot congela la pantalla).
 *   2) Si la sesión caducó: correo → "Continuar" → Uber ofrece SMS. Se pulsa
 *      "Más opciones"/"Otro método", se elige CORREO ELECTRÓNICO, y el código que
 *      llega a direccion@streatlab.com se lee POR IMAP (tabla buzones_otp).
 *   3) Si aparece campo de contraseña, se usa la contraseña de robot_credenciales.
 *
 * Modos (env MODO): diario | semanal | mensual | backfill (MES=AAAA-MM)
 */
import type { Page, BrowserContext } from 'playwright';
import { entregar, log, volcar, hoyMadrid } from './_lib/bandeja.js';
import { cuentasDe, esperarCodigo, guardarSesion, type Cuenta } from './_lib/portal.js';
import { abrir, quitarEstorbos, descargarDeLaPagina } from './_lib/navegador.js';

const P = 'uber';
const RAIZ = 'https://merchants.ubereats.com';
const MODO = (process.env.MODO || 'diario').toLowerCase();
const MES = process.env.MES || '';

const RE_MAS = /m[aá]s opciones|otras opciones|otra forma|otro m[eé]todo|more options|try another way|another way|use another|enlace/i;
const RE_CORREO = /correo electr[oó]nico|email|e-mail/i;
const RE_PASS = /contrase[nñ]a|password/i;
const RE_SEGUIR = /^(continuar|siguiente|continue|next|acceder|iniciar sesi[oó]n|verificar)$/i;

async function dentro(page: Page): Promise<boolean> {
  const u = page.url();
  return /merchants\.ubereats\.com/i.test(u) && !/auth\.uber\.com|\/login|\/signin/i.test(u);
}

async function pantalla(page: Page): Promise<string> {
  return (await page.locator('h1, h2, [role="heading"]').first().innerText().catch(() => '')).trim();
}

async function seguir(page: Page) {
  const antes = await pantalla(page);
  const b = page.getByRole('button', { name: RE_SEGUIR }).first();
  if (await b.count().catch(() => 0)) await b.click({ timeout: 8000 }).catch(() => {});
  else await page.keyboard.press('Enter').catch(() => {});
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(2000);
    if (await dentro(page)) return;
    const ahora = await pantalla(page);
    if (ahora && ahora !== antes) return;
  }
}

/** Escribe un código de 4-8 dígitos en la pantalla de verificación. */
async function escribirCodigo(page: Page, codigo: string): Promise<boolean> {
  const huecos = page.locator('input[autocomplete="one-time-code"], input[maxlength="1"], input[name*="code" i], input[id*="code" i], input[type="tel"], input[type="number"]');
  const n = await huecos.count().catch(() => 0);
  if (n === 0) return false;
  if (n >= codigo.length) {
    for (let i = 0; i < codigo.length; i++) {
      await huecos.nth(i).fill(codigo[i]).catch(() => {});
      await page.waitForTimeout(200);
    }
  } else {
    await huecos.first().click({ timeout: 5000 }).catch(() => {});
    await huecos.first().type(codigo, { delay: 130 }).catch(() => {});
  }
  await page.waitForTimeout(1200);
  await seguir(page);
  return true;
}

async function entrar(page: Page, ctx: BrowserContext, c: Cuenta): Promise<boolean> {
  await page.goto(`${RAIZ}/manager/`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(6000);
  await quitarEstorbos(page);
  if (await dentro(page)) { await log(P, 'sesion_ok', `${c.cuenta}: sesión sembrada válida`); return true; }

  // Correo
  const email = page.locator('#PHONE_NUMBER_or_EMAIL_ADDRESS, input[type="email"], input[name="email"]').first();
  if (await email.count().catch(() => 0)) {
    await email.click({ timeout: 8000 }).catch(() => {});
    await email.type(c.usuario, { delay: 90 }).catch(() => {});
    await page.waitForTimeout(1000);
    const pedidoEn = new Date();
    await seguir(page);
    await quitarEstorbos(page);

    // Uber propone SMS: abrir "más opciones" y elegir CORREO ELECTRÓNICO
    for (let i = 0; i < 3; i++) {
      if (await page.locator('input[type="password"]').count().catch(() => 0)) break;
      if (await page.locator('input[autocomplete="one-time-code"], input[maxlength="1"]').count().catch(() => 0)) break;

      const mas = page.locator('button, a, [role="button"], [role="link"], span[tabindex]').filter({ hasText: RE_MAS }).first();
      if (await mas.count().catch(() => 0)) { await mas.click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(3000); }

      const opcionCorreo = page.locator('button, a, li, label, div[role="button"], [role="radio"], [role="option"]').filter({ hasText: RE_CORREO }).first();
      if (await opcionCorreo.count().catch(() => 0)) { await opcionCorreo.click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(2500); await seguir(page); continue; }

      const opcionPass = page.locator('button, a, li, label, div[role="button"], [role="radio"], [role="option"]').filter({ hasText: RE_PASS }).first();
      if (await opcionPass.count().catch(() => 0)) { await opcionPass.click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(2500); await seguir(page); continue; }

      await volcar(`${P}_paso_${i}`, await page.content().catch(() => ''));
      await page.waitForTimeout(3000);
    }

    // Camino contraseña
    if (await page.locator('input[type="password"]').count().catch(() => 0)) {
      const pass = page.locator('input[type="password"]').first();
      await pass.click({ timeout: 6000 }).catch(() => {});
      await pass.type(c.password, { delay: 70 }).catch(() => {});
      await seguir(page);
      await page.waitForTimeout(5000);
    }

    // Camino código por correo
    if (!(await dentro(page))) {
      const codigo = await esperarCodigo(P, c.otp_remitente || 'uber.com', 240, pedidoEn, c.usuario);
      if (codigo) await escribirCodigo(page, codigo);
      await page.waitForTimeout(6000);
    }
  }

  await quitarEstorbos(page);
  const ok = await dentro(page);
  await log(P, ok ? 'login_ok' : 'login_ko', `${c.cuenta} · pantalla="${await pantalla(page)}" · url=${page.url()}`);
  if (!ok) await volcar(`${P}_login_ko`, await page.content().catch(() => ''));
  else await guardarSesion(P, c.cuenta, ctx);
  return ok;
}

async function seccion(page: Page, ruta: string, tipo: string, periodo: string, destino: string) {
  await page.goto(ruta.startsWith('http') ? ruta : `${RAIZ}${ruta}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(7000);
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
      await seccion(page, '/manager/payments', 'uber_resumen_ganancias', ayer, 'ventas');
    } else if (MODO === 'mensual') {
      const d = new Date();
      const mesAnterior = new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 7);
      await seccion(page, '/manager/payments', 'uber_resumen_mensual', mesAnterior, 'ventas');
    } else if (MODO === 'backfill') {
      if (!/^\d{4}-\d{2}$/.test(MES)) { await log(P, 'error', 'backfill necesita MES=AAAA-MM'); process.exitCode = 1; return; }
      await seccion(page, '/manager/orders', 'uber_historial_pedidos', MES, 'ventas');
      await seccion(page, '/manager/payments', 'uber_resumen_ganancias', MES, 'ventas');
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
