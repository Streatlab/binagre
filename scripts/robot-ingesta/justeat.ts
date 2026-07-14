/**
 * ROBOT JUST EAT · Baja las FACTURAS del portal de socios y las deja en la bandeja.
 *
 * 15-jul-2026: la sesión aterriza en el portal REAL: partner-hub.just-eat.es
 * (access.just-eat.es solo es la puerta). Es una app single-spa que tarda en
 * hidratar: hay que esperar a que el HTML crezca de verdad. El robot va directo
 * al hub, prueba sus rutas de facturación y, si no, sigue los enlaces del menú.
 * Siempre vuelca lo que ve para poder apuntar mejor en la siguiente pasada.
 *
 * Login: robot_credenciales (plataforma='justeat', hola@streatlab.com).
 * Código por correo si lo pide: IMAP del buzón de la cuenta (buzones_otp).
 */
import type { Page, BrowserContext } from 'playwright';
import { entregar, log, volcar, hoyMadrid } from './_lib/bandeja.js';
import { cuentasDe, esperarCodigo, guardarSesion, type Cuenta } from './_lib/portal.js';
import { abrir, quitarEstorbos, capturar, bajarEnlaces } from './_lib/navegador.js';

const P = 'justeat';
const RAIZ = 'https://access.just-eat.es';
const HUB = 'https://partner-hub.just-eat.es';
const MODO = (process.env.MODO || 'semanal').toLowerCase();
const TRIMESTRE = process.env.TRIMESTRE || '';

const RE_FACTURAS = /facturas?|facturaci[oó]n|invoices?|billing|pagos|payments|finanzas|finance/i;
const RE_DESCARGA = /descargar|download|pdf|exportar|export/i;

async function dentro(page: Page): Promise<boolean> {
  if (await page.locator('input[type="password"]').count().catch(() => 0)) return false;
  return !/\/(login|signin|auth)/i.test(page.url());
}

/** Espera a que la app single-spa hidrate (el HTML crece muy por encima del cascarón). */
async function esperarContenido(page: Page, segundos = 45) {
  for (let i = 0; i < segundos; i++) {
    const largo = (await page.content().catch(() => '')).length;
    if (largo > 60000) return;
    await page.waitForTimeout(1000);
  }
}

async function entrar(page: Page, ctx: BrowserContext, c: Cuenta): Promise<boolean> {
  await page.goto(c.url_base || RAIZ, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await esperarContenido(page, 25);
  await quitarEstorbos(page);
  if (await dentro(page)) { await log(P, 'sesion_ok', `${c.cuenta}: sesión guardada todavía válida · url=${page.url()}`); return true; }

  const email = page.locator('input[type="email"], input[name="email"], input[name="username"], input[id*="user" i]').first();
  await email.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  await email.fill(c.usuario).catch(() => {});
  await page.locator('input[type="password"]').first().fill(c.password).catch(() => {});

  const pedidoEn = new Date();
  await page.getByRole('button', { name: /entrar|log ?in|iniciar|continuar|sign in|acceder/i }).first().click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(9000);
  await esperarContenido(page, 25);

  const campoCodigo = page.locator('input[autocomplete="one-time-code"], input[name*="code" i], input[id*="otp" i], input[maxlength="1"]').first();
  if (await campoCodigo.count().catch(() => 0)) {
    const codigo = await esperarCodigo(P, c.otp_remitente || 'just', 240, pedidoEn, c.usuario);
    if (codigo) {
      await campoCodigo.type(codigo, { delay: 120 }).catch(() => {});
      await page.keyboard.press('Enter').catch(() => {});
      await page.waitForTimeout(9000);
    }
  }

  await quitarEstorbos(page);
  const ok = await dentro(page);
  await log(P, ok ? 'login_ok' : 'login_ko', `${c.cuenta} · url=${page.url()}`);
  if (!ok) await volcar(`${P}_login_ko`, await page.content().catch(() => ''));
  else await guardarSesion(P, c.cuenta, ctx);
  return ok;
}

/** Abre facturación en el hub: rutas conocidas primero, después el menú hidratado. */
async function abrirFacturas(page: Page): Promise<boolean> {
  for (const ruta of ['/invoices', '/financial/invoices', '/financial', '/billing', '/payments', '/history']) {
    await page.goto(`${HUB}${ruta}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await esperarContenido(page);
    await quitarEstorbos(page);
    const largo = (await page.content().catch(() => '')).length;
    if (largo > 60000 && (await page.getByText(RE_FACTURAS).count().catch(() => 0))) {
      await volcar(`${P}_facturacion${ruta.replace(/\//g, '_')}`, await page.content().catch(() => ''));
      return true;
    }
  }

  // Menú hidratado del hub
  await page.goto(HUB, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await esperarContenido(page);
  await quitarEstorbos(page);
  await volcar(`${P}_menu`, await page.content().catch(() => ''));

  const enlace = page.getByRole('link', { name: RE_FACTURAS }).first()
    .or(page.locator('a, button, [role="menuitem"], [role="link"], nav *').filter({ hasText: RE_FACTURAS }).first());
  if (await enlace.count().catch(() => 0)) {
    await enlace.click({ timeout: 8000 }).catch(() => {});
    await esperarContenido(page);
    await page.waitForTimeout(4000);
    await volcar(`${P}_facturacion_menu`, await page.content().catch(() => ''));
    return true;
  }
  return false;
}

async function bajarFacturas(page: Page, periodo: string): Promise<number> {
  let bajadas = 0;
  const ficheros = await bajarEnlaces(P, page, 'facturas', 12);
  for (const f of ficheros) {
    await entregar({ fuente: P, tipo: 'justeat_factura', nombre: f.nombre, datos: f.datos, periodo, destino: 'facturas' });
    bajadas++;
  }

  if (bajadas === 0) {
    const botones = page.getByRole('button', { name: RE_DESCARGA });
    const nBotones = Math.min(await botones.count().catch(() => 0), 12);
    for (let i = 0; i < nBotones; i++) {
      const f = await capturar(page, P, async () => { await botones.nth(i).click({ timeout: 8000 }).catch(() => {}); }, 60);
      if (!f) continue;
      await entregar({ fuente: P, tipo: 'justeat_factura', nombre: f.nombre, datos: f.datos, periodo, destino: 'facturas' });
      bajadas++;
    }
  }
  return bajadas;
}

async function trabajarCuenta(c: Cuenta) {
  const { browser, ctx, page } = await abrir(P, c.cuenta);
  try {
    if (!(await entrar(page, ctx, c))) return;
    const periodo = MODO === 'backfill' && /^\d{4}-Q[1-4]$/i.test(TRIMESTRE) ? TRIMESTRE : hoyMadrid(1);

    if (!(await abrirFacturas(page))) {
      await log(P, 'aviso', `no encuentro la sección de facturas (volcados ${P}_* en robot_debug) · url=${page.url()}`);
      return;
    }

    const n = await bajarFacturas(page, periodo);
    if (n > 0) await log(P, 'descarga', `${n} factura(s) de Just Eat a la bandeja`);
    else {
      await volcar(`${P}_facturas`, await page.content().catch(() => ''));
      await log(P, 'sin_descarga', 'sección de facturas abierta pero sin ficheros que bajar');
    }
  } catch (e: any) {
    await log(P, 'error', `${c.cuenta}: ${e?.message || e}`);
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
