/**
 * ROBOT GLOVO · Descarga los informes del portal de comercio y los deja en la bandeja.
 * Dos cuentas (posmodernos y streatlab). Entra solo: sesión guardada + código por
 * correo (IMAP del buzón de la cuenta) si hace falta.
 *
 * 15-jul-2026 · RUTAS REALES (confirmadas por Rubén con capturas):
 *   portal.glovoapp.com/reports  → Rendimiento: pestañas Ventas / Operaciones / Clientes  (botón "Descargar")
 *   portal.glovoapp.com/orders   → Historial de pedidos                                    (botón "Descargar informe")
 *   managers.glovoapp.com/finance y /gv-finance → facturas y liquidaciones (enlaces PDF directos)
 * El botón de descarga baja el fichero con la sesión real; se captura con captureExport
 * (evento download o respuesta XHR). Las rutas viejas (/invoicing, managers/orders) NO existían
 * y por eso el portal metía verificaciones: con las rutas correctas y la sesión sembrada baja limpio.
 *
 * Modos (env MODO): diario | semanal | backfill (MES=AAAA-MM)
 */
import type { Page, BrowserContext } from 'playwright';
import { entregar, log, volcar, hoyMadrid } from './_lib/bandeja.js';
import { cuentasDe, esperarCodigo, guardarSesion, type Cuenta } from './_lib/portal.js';
import { abrir, quitarEstorbos, descargarDeLaPagina, bajarEnlaces } from './_lib/navegador.js';
import { captureExport } from './_lib/capturar-export.js';

const P = 'glovo';
const PORTAL = 'https://portal.glovoapp.com';
const MANAGERS = 'https://managers.glovoapp.com';
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
    for (let i = 0; i < codigo.length; i++) { await huecos.nth(i).click({ timeout: 4000 }).catch(() => {}); await huecos.nth(i).fill(codigo[i]).catch(() => {}); await page.waitForTimeout(200); }
  } else { await huecos.first().click({ timeout: 5000 }).catch(() => {}); await huecos.first().type(codigo, { delay: 150 }).catch(() => {}); }
  await page.waitForTimeout(1500);
  const b = page.getByRole('button', { name: /verificar|confirmar|continuar|acceder|entrar|verify|submit|enviar/i }).first();
  if (await b.count().catch(() => 0)) await b.click({ timeout: 8000 }).catch(() => {});
  else await page.keyboard.press('Enter').catch(() => {});
  await page.waitForTimeout(10000);
  return true;
}

async function entrar(page: Page, ctx: BrowserContext, c: Cuenta): Promise<boolean> {
  await page.goto(c.url_base || MANAGERS, { waitUntil: 'domcontentloaded' }).catch(() => {});
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

/** Rango de fechas para la URL de los informes (from/to = AAAA-MM-DD). */
function rango(): { from: string; to: string } {
  if (MODO === 'backfill' && /^\d{4}-\d{2}$/.test(MES)) {
    const [a, m] = MES.split('-').map(Number);
    const from = `${MES}-01`;
    const fin = new Date(Date.UTC(a, m, 0)).getUTCDate();
    return { from, to: `${MES}-${String(fin).padStart(2, '0')}` };
  }
  return { from: hoyMadrid(7), to: hoyMadrid(1) };   // últimos 7 días cerrados
}

/** Pulsa "Descargar" (o "Descargar informe") en la página actual y captura el fichero. */
async function bajarDescargar(page: Page, paso: string): Promise<{ nombre: string; datos: Buffer } | null> {
  const boton = page.getByRole('button', { name: /descargar( informe)?/i }).first()
    .or(page.locator('button, a, [role="button"]').filter({ hasText: /descargar( informe)?/i }).first());
  if (!(await boton.count().catch(() => 0))) {
    await volcar(`${P}_${paso}`, await page.content().catch(() => ''));
    await log(P, 'sin_descarga', `${paso}: no veo el botón Descargar (HTML volcado)`);
    return null;
  }
  try {
    const f = await captureExport(page, async () => { await boton.click({ timeout: 10000 }).catch(() => {}); });
    await log(P, 'descarga', `${paso}: ${f.filename} (${f.buffer.length} bytes · ${f.source})`);
    return { nombre: f.filename, datos: f.buffer };
  } catch (e: any) {
    await volcar(`${P}_${paso}`, await page.content().catch(() => ''));
    await log(P, 'sin_descarga', `${paso}: el export no soltó fichero (${e?.message || e})`);
    return null;
  }
}

/** Rendimiento: pestañas Ventas y Operaciones (Clientes lo dejamos para CRM más adelante). */
async function rendimiento(page: Page, periodo: string, cuenta: string, from: string, to: string) {
  await page.goto(`${PORTAL}/reports?from=${from}&to=${to}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(9000);
  await quitarEstorbos(page);

  for (const [nombreTab, tipo] of [['Ventas', 'glovo_ventas'], ['Operaciones', 'glovo_operaciones']] as const) {
    const tab = page.getByRole('tab', { name: new RegExp(`^${nombreTab}$`, 'i') }).first()
      .or(page.locator('[role="tab"], button, a').filter({ hasText: new RegExp(`^${nombreTab}$`, 'i') }).first());
    if (await tab.count().catch(() => 0)) {
      await tab.click({ timeout: 6000 }).catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(5000);
    }
    const f = await bajarDescargar(page, `${tipo}_${cuenta}`);
    if (f) await entregar({ fuente: P, tipo, nombre: `${cuenta}_${f.nombre}`, datos: f.datos, periodo, destino: 'ventas' });
  }
}

/** Historial de pedidos: cada pedido con estado, marca, reclamaciones y subtotal. */
async function historial(page: Page, periodo: string, cuenta: string, from: string, to: string) {
  await page.goto(`${PORTAL}/orders?from=${from}&to=${to}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(9000);
  await quitarEstorbos(page);
  const f = await bajarDescargar(page, `historial_${cuenta}`);
  if (f) await entregar({ fuente: P, tipo: 'glovo_historial', nombre: `${cuenta}_${f.nombre}`, datos: f.datos, periodo, destino: 'ventas' });
}

/** Finanzas: facturas y liquidaciones (PDF con enlace directo). */
async function finanzas(page: Page, periodo: string, cuenta: string) {
  for (const ruta of ['/finance', '/gv-finance']) {
    await page.goto(`${MANAGERS}${ruta}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(9000);
    await quitarEstorbos(page);
    const ficheros = await bajarEnlaces(P, page, `fin${ruta.replace(/\//g, '_')}_${cuenta}`, 8);
    for (const f of ficheros) {
      await entregar({ fuente: P, tipo: 'glovo_finanzas', nombre: `${cuenta}_${f.nombre}`, datos: f.datos, periodo, destino: 'facturas' });
    }
    if (!ficheros.length) {
      const f = await descargarDeLaPagina(P, page, `fin${ruta.replace(/\//g, '_')}_${cuenta}`);
      if (f) await entregar({ fuente: P, tipo: 'glovo_finanzas', nombre: `${cuenta}_${f.nombre}`, datos: f.datos, periodo, destino: 'facturas' });
    }
  }
}

async function trabajarCuenta(c: Cuenta) {
  const { browser, ctx, page } = await abrir(P, c.cuenta);
  try {
    if (!(await entrar(page, ctx, c))) return;
    const { from, to } = rango();
    const periodo = MODO === 'backfill' && /^\d{4}-\d{2}$/.test(MES) ? MES : hoyMadrid(1);

    await rendimiento(page, periodo, c.cuenta, from, to);   // Ventas + Operaciones
    await historial(page, periodo, c.cuenta, from, to);     // Historial de pedidos
    await finanzas(page, periodo, c.cuenta);                // Facturas y liquidaciones
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
