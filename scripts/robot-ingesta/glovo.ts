/**
 * ROBOT GLOVO · Descarga informes del portal de gestión y los deja en la bandeja.
 * Dos cuentas (posmodernos y streatlab). Entra solo: sesión guardada + código por
 * correo leído por IMAP del buzón de la cuenta si hace falta.
 *
 * 14-jul-2026 · Al pulsar "Descargar informe" Glovo pide "Mantén pulsado para
 * confirmar que eres un ser humano" (lo resuelve mantenPulsado del navegador común).
 * Además, en la página de pedidos hay que esperar a que aparezca el chip de export:
 * si se mira demasiado pronto, parece que no existe.
 *
 * Modos (env MODO): diario | semanal | backfill (MES=AAAA-MM)
 */
import type { Page, BrowserContext } from 'playwright';
import { entregar, log, volcar, hoyMadrid } from './_lib/bandeja.js';
import { cuentasDe, esperarCodigo, guardarSesion, type Cuenta } from './_lib/portal.js';
import { abrir, quitarEstorbos, capturar, mantenPulsado, descargarDeLaPagina } from './_lib/navegador.js';

const P = 'glovo';
const RAIZ = 'https://managers.glovoapp.com';
const MODO = (process.env.MODO || 'diario').toLowerCase();
const MES = process.env.MES || '';

async function dentro(page: Page): Promise<boolean> {
  let ruta = '';
  try { ruta = new URL(page.url()).pathname; } catch { ruta = page.url(); }
  if (/\/(login|signin|sign-in|2fa|otp|verify|verificacion)/i.test(ruta)) return false;
  if (await page.locator('input[type="password"]').count().catch(() => 0)) return false;
  return true;
}

async function escribirCodigo(page: Page, codigo: string): Promise<boolean> {
  const huecos = page.locator('input[autocomplete="one-time-code"], input[maxlength="1"], input[type="tel"], input[name*="code" i], input[id*="otp" i], input[type="number"]');
  const n = await huecos.count().catch(() => 0);
  if (n === 0) return false;
  if (n >= codigo.length) {
    for (let i = 0; i < codigo.length; i++) {
      await huecos.nth(i).click({ timeout: 4000 }).catch(() => {});
      await huecos.nth(i).fill(codigo[i]).catch(() => {});
      await page.waitForTimeout(250);
    }
  } else {
    await huecos.first().click({ timeout: 5000 }).catch(() => {});
    await huecos.first().type(codigo, { delay: 150 }).catch(() => {});
  }
  await page.waitForTimeout(1500);
  const b = page.getByRole('button', { name: /verificar|confirmar|continuar|acceder|entrar|verify|submit|enviar/i }).first();
  if (await b.count().catch(() => 0)) await b.click({ timeout: 8000 }).catch(() => {});
  else await page.keyboard.press('Enter').catch(() => {});
  await page.waitForTimeout(10000);
  return true;
}

async function entrar(page: Page, ctx: BrowserContext, c: Cuenta): Promise<boolean> {
  await page.goto(c.url_base || RAIZ, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(5000);
  await quitarEstorbos(page);
  if (await dentro(page)) { await log(P, 'sesion_ok', `${c.cuenta}: sesión guardada todavía válida`); return true; }

  const email = page.locator('input[type="email"], input[name="email"], input[id*="email" i], input[name="username"]').first();
  await email.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  await email.fill(c.usuario).catch(() => {});
  await page.locator('input[type="password"]').first().fill(c.password).catch(() => {});

  const pedidoEn = new Date();
  await page.getByRole('button', { name: /entrar|log ?in|iniciar|continuar|sign in/i }).first().click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(9000);
  await quitarEstorbos(page);

  if (!(await dentro(page))) {
    const codigo = await esperarCodigo(P, c.otp_remitente || 'glovoapp.com', 240, pedidoEn, c.usuario);
    if (!codigo) { await log(P, 'login_ko', `${c.cuenta}: no llegó el código`); return false; }
    if (!(await escribirCodigo(page, codigo))) { await log(P, 'login_ko', `${c.cuenta}: no encuentro dónde escribir el código`); return false; }
    await quitarEstorbos(page);
  }

  const ok = await dentro(page);
  await log(P, ok ? 'login_ok' : 'login_ko', `${c.cuenta} · url=${page.url()}`);
  if (ok) await guardarSesion(P, c.cuenta, ctx);
  return ok;
}

/** Descarga de Glovo: chip export + candado "mantén pulsado" + confirmar. */
async function descargaGlovo(page: Page, paso: string) {
  const chip = page.locator('[data-testid="export-report-btn"]').first();
  await chip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (!(await chip.count().catch(() => 0))) return descargarDeLaPagina(P, page, paso);

  const f = await capturar(page, P, async () => {
    await chip.click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(4000);
    await mantenPulsado(page, P);
    await page.waitForTimeout(2000);
    const conf = page.getByRole('button', { name: /^(descargar|exportar|confirmar|aceptar|download|export)/i }).last();
    if (await conf.count().catch(() => 0)) await conf.click({ timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await mantenPulsado(page, P);   // a veces el candado sale DESPUÉS de confirmar
  }, 180);

  if (f) { await log(P, 'descarga', `${paso}: ${f.nombre} (${f.datos.length} bytes)`); return f; }
  await volcar(`${P}_export_ko_${paso}`, await page.content().catch(() => ''));
  await log(P, 'sin_descarga', `${paso}: el export no soltó fichero`);
  return null;
}

async function seccion(page: Page, ruta: string, tipo: string, periodo: string, destino: string, cuenta: string) {
  await page.goto(ruta.startsWith('http') ? ruta : `${RAIZ}${ruta}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(9000);
  await quitarEstorbos(page);
  const f = await descargaGlovo(page, `${tipo}_${cuenta}`);
  if (!f) return;
  await entregar({ fuente: P, tipo, nombre: `${cuenta}_${f.nombre}`, datos: f.datos, periodo, destino });
}

async function trabajarCuenta(c: Cuenta) {
  const { browser, ctx, page } = await abrir(P, c.cuenta);
  try {
    if (!(await entrar(page, ctx, c))) return;
    const ayer = hoyMadrid(1);
    const periodo = MODO === 'backfill' && /^\d{4}-\d{2}$/.test(MES) ? MES : ayer;

    await seccion(page, 'https://portal.glovoapp.com/orders', 'glovo_orderdetails', periodo, 'ventas', c.cuenta);
    await seccion(page, 'https://portal.glovoapp.com/invoicing', 'glovo_liquidacion', periodo, 'ventas', c.cuenta);
    await seccion(page, 'https://portal.glovoapp.com/invoices', 'glovo_factura', periodo, 'facturas', c.cuenta);
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
  if (cuentas.length === 0) { await log(P, 'sin_credenciales', 'no hay cuentas activas de Glovo'); return; }
  for (const c of cuentas) await trabajarCuenta(c);
  await log(P, 'fin', `${cuentas.length} cuenta(s)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
