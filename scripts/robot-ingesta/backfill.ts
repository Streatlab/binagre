/**
 * Backfill histórico · Rushour + Sinqro → Supabase
 * Reutiliza las funciones del robot (login, lectura de KPIs, parseo de pedidos,
 * guardado). Recorre día a día HACIA ATRÁS desde BACKFILL_DESDE (por defecto
 * 2025-12-31), cargando lo que cada plataforma permita ver en su histórico.
 *
 * Sinqro: variante propia (ingestaSinqroHistorico, no la ingestaSinqro del
 * robot diario) que fija fecha inicio/fin, CIERRA el calendario de verdad
 * (clic fuera, no solo Escape) y espera a que loadingOrders termine antes de
 * leer → desglosa comida/cena por la hora real de cada pedido.
 *
 * Rushour: navega a la sección "Historical" del menú lateral (texto exacto,
 * para no confundirla con "Real-time view") y espera a que el RangePicker de
 * Ant Design esté VISIBLE antes de fijar la fecha. Si no la encuentra o no da
 * un total fiable para ese día, guarda SOLO Sinqro y lo anota en robot_log
 * (no inventa el dato de Rushour). Cuando hay total histórico de Rushour, no
 * hay desglose por hora → se guarda como turno='dia'.
 *
 * Se ejecuta vía GitHub Actions (workflow_dispatch de backfill.yml), que es
 * donde viven las credenciales reales (RUSHOUR_USER/PASS, SINQRO_USER/PASS).
 *
 * Persiste la última fecha procesada en .backfill-cursor para poder reanudar
 * si se corta a medias (Ctrl+C, caída de red, etc.) — solo sirve dentro de un
 * mismo proceso largo; si se corta el propio job de Actions, se retoma desde
 * el mínimo `fecha` ya guardado en ingesta_robot_diaria.
 */

import { chromium, Browser, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  Fila, Turno, guardar, logRobot, turnoDeTextoPedido,
} from './robot.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CURSOR_PATH = join(__dirname, '.backfill-cursor');
const RACHA_VACIA_LIMITE = 10;

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const RUSHOUR = {
  loginUrl: 'https://manager.rushour.io/login',
  user: process.env.RUSHOUR_USER || '', pass: process.env.RUSHOUR_PASS || '',
  userInput: 'input[name="username"]', passInput: 'input[name="password"]', submitBtn: 'button[type="submit"]',
};
// Duplicado deliberado del SINQRO de robot.ts (no exportado): la variante
// histórica (ingestaSinqroHistorico) y el volcado de diagnóstico usan esta
// copia propia, sin tocar el robot diario en vivo.
const SINQRO_DEBUG = {
  loginUrl: 'https://app.sinqro.com/', ventasUrl: 'https://app.sinqro.com/#/sp/6416/online/orders',
  user: process.env.SINQRO_USER || '', pass: process.env.SINQRO_PASS || '',
  userInput: '#login-email', passInput: '#login-password', submitBtn: '#loginButton',
  tipoChecks: ['#deliveryFilter', '#collectionFilter', '#insideFilter', '#insituFilter', '#reservationFilter'],
  startDate: '#startDateFilter', endDate: '#endDateFilter',
};

function numES(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function ddmmyyyy(iso: string): string { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }
function diaAnterior(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
async function cerrarModales(page: Page) {
  const nombres = [/close/i, /cerrar/i, /no,? gracias/i, /aceptar/i, /got it/i, /entendido/i, /×/];
  for (const re of nombres) {
    await page.getByRole('button', { name: re }).first().click({ timeout: 1200 }).catch(() => {});
  }
  await page.keyboard.press('Escape').catch(() => {});
}
async function leerKpiRushour(page: Page, etiqueta: RegExp, conEuro: boolean): Promise<number | null> {
  const lbl = page.locator('span').filter({ hasText: etiqueta }).first();
  if (!(await lbl.count().catch(() => 0))) return null;
  for (const lvl of [2, 3, 1, 4]) {
    const card = lbl.locator(`xpath=ancestor::div[${lvl}]`);
    if (!(await card.count().catch(() => 0))) continue;
    const spans = card.locator('span');
    const total = await spans.count().catch(() => 0);
    for (let i = 0; i < total; i++) {
      const t = ((await spans.nth(i).textContent().catch(() => '')) || '').trim();
      if (!/\d/.test(t)) continue;
      if (conEuro ? /€/.test(t) : /^[\d.,]+$/.test(t)) {
        const v = numES(t);
        if (v != null) return v;
      }
    }
  }
  return null;
}

// Rushour /historicals usa un RangePicker de Ant Design (.ant-picker con dos
// .ant-picker-input input: [0]=inicio, [1]=fin). Fija el mismo día en ambos
// extremos para quedarse con un solo día. Devuelve true si encontró el picker.
async function fijarRangoAntPicker(page: Page, fecha: string): Promise<boolean> {
  const picker = page.locator('.ant-picker').first();
  if (!(await picker.count().catch(() => 0))) return false;
  await picker.click().catch(() => {});
  const inputs = page.locator('.ant-picker-input input');
  if (!(await inputs.count().catch(() => 0))) return false;
  await inputs.nth(0).fill('').catch(() => {});
  await inputs.nth(0).type(fecha, { delay: 40 }).catch(() => {});
  await page.keyboard.press('Enter').catch(() => {});
  await inputs.nth(1).fill('').catch(() => {});
  await inputs.nth(1).type(fecha, { delay: 40 }).catch(() => {});
  await page.keyboard.press('Enter').catch(() => {});
  await page.waitForTimeout(2500);
  return true;
}

// Navega a la sección histórica de Rushour. OJO: el menú lateral tiene
// "Real-time view" (dashboard de HOY, es la vista por defecto) y "Historical"
// como secciones DISTINTAS — un match de texto parcial (/historical/i) podía
// coincidir con el elemento equivocado y el robot se quedaba leyendo el
// dashboard en vivo creyendo que era el histórico. Se usa el texto EXACTO
// "Historical" para no confundirlo con "Real-time view".
async function irAHistoricalRushour(page: Page): Promise<void> {
  const navHistorico = page.getByText('Historical', { exact: true }).first();
  if (await navHistorico.count().catch(() => 0)) {
    await navHistorico.click({ timeout: 5000 }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await cerrarModales(page);
  }
  if (!/historicals/.test(page.url())) {
    // Fallback: navegación directa por URL (el enlace trae href="/historicals").
    await page.goto('https://manager.rushour.io/historicals', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await cerrarModales(page);
  }
  // SPA React: domcontentloaded/networkidle no garantizan que el bundle ya
  // haya pintado el contenido de la ruta. Espera real a que el RangePicker
  // esté VISIBLE (no solo presente en el DOM) en vez de un timeout fijo.
  await page.locator('.ant-picker').first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
}

function leerCursor(): string | null {
  if (!existsSync(CURSOR_PATH)) return null;
  const s = readFileSync(CURSOR_PATH, 'utf-8').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
function guardarCursor(fecha: string) {
  writeFileSync(CURSOR_PATH, fecha, 'utf-8');
}

// Fija una fecha en un input ng-model de Sinqro (AngularJS): escribe carácter
// a carácter y dispara input+change+blur para que el modelo registre.
async function fijarFechaSinqro(loc: ReturnType<Page['locator']>, fecha: string) {
  if (!(await loc.count().catch(() => 0))) return;
  await loc.fill('').catch(() => {});
  await loc.type(fecha, { delay: 40 }).catch(() => {});
  await loc.dispatchEvent('input').catch(() => {});
  await loc.dispatchEvent('change').catch(() => {});
  await loc.dispatchEvent('blur').catch(() => {});
}

// Aplica el filtro de fecha de Sinqro para un día histórico y espera a que
// la búsqueda TERMINE de verdad antes de leer. Fallo detectado con datos
// reales: se leía el HTML con el calendario aún abierto (nunca se cerraba,
// solo con Escape) y sin esperar a que loadingOrders terminara → el clic en
// "Buscar" podía caer sobre el propio calendario en vez del botón, o leerse
// antes de que la lista se recargara.
async function irAVentasSinqroHistorico(page: Page, fecha: string): Promise<void> {
  await page.goto(SINQRO_DEBUG.ventasUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);

  for (const sel of SINQRO_DEBUG.tipoChecks) {
    const chk = page.locator(sel).first();
    if (!(await chk.count())) continue;
    if (await chk.isChecked().catch(() => false)) continue;
    await chk.dispatchEvent('click').catch(() => {});
    await chk.dispatchEvent('change').catch(() => {});
  }
  await page.waitForTimeout(1000);

  const f = ddmmyyyy(fecha);
  const sd = page.locator(SINQRO_DEBUG.startDate).first();
  const ed = page.locator(SINQRO_DEBUG.endDate).first();

  await fijarFechaSinqro(sd, f);
  // Cierra el calendario haciendo clic fuera (Escape solo no basta siempre
  // para cerrar el datepicker jQuery UI) antes de tocar el segundo campo.
  await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  await fijarFechaSinqro(ed, f);
  await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});

  await page.getByRole('button', { name: /buscar/i }).first().click().catch(() => {});

  // Espera real a que loadingOrders termine (los inputs de fecha llevan
  // ng-disabled="loadingOrders"), no un timeout fijo a ciegas.
  for (let i = 0; i < 20; i++) {
    const cargando = await sd.isDisabled().catch(() => false);
    if (!cargando) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(500);
}

// Intenta localizar la sección "Historical" de Rushour y leer el total de un
// día concreto. Best-effort: si no hay selector conocido para fijar la fecha,
// o los KPIs no aparecen, devuelve null y el llamador se queda solo con Sinqro.
async function ingestaRushourHistorico(browser: Browser, fecha: string): Promise<Fila | null> {
  if (!RUSHOUR.user || !RUSHOUR.pass) { await logRobot('rushour_backfill', 'error', 'sin credenciales'); return null; }
  const page = await browser.newPage();
  try {
    await page.goto(RUSHOUR.loginUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.waitForSelector(RUSHOUR.userInput, { timeout: 15000 });
    await page.fill(RUSHOUR.userInput, RUSHOUR.user);
    await page.fill(RUSHOUR.passInput, RUSHOUR.pass);
    await Promise.all([page.waitForLoadState('networkidle').catch(() => {}), page.click(RUSHOUR.submitBtn)]);
    await page.waitForTimeout(4000);
    await cerrarModales(page);
    await page.waitForTimeout(1000);
    await cerrarModales(page);

    await irAHistoricalRushour(page);
    if (!/historicals/.test(page.url())) {
      await logRobot('rushour_backfill', 'sin_seccion', `fecha=${fecha} no se pudo navegar a /historicals (url=${page.url()})`);
      return null;
    }

    const fechaFijada = await fijarRangoAntPicker(page, fecha);
    if (!fechaFijada) {
      await logRobot('rushour_backfill', 'sin_selector_fecha', `fecha=${fecha} en /historicals pero sin .ant-picker reconocible`);
      return null;
    }

    let turnover: number | null = null, volumen: number | null = null;
    for (let intento = 1; intento <= 3; intento++) {
      turnover = await leerKpiRushour(page, /Turnover/i, true);
      volumen = await leerKpiRushour(page, /Volume of orders/i, false);
      if (turnover != null || volumen != null) break;
      await page.waitForTimeout(2000);
    }
    if (turnover == null && volumen == null) {
      await logRobot('rushour_backfill', 'vacio', `fecha=${fecha} sin KPIs tras fijar fecha histórica`);
      return null;
    }
    await logRobot('rushour_backfill', 'ok', `fecha=${fecha} turnover=${turnover} volumen=${volumen}`);
    return {
      fecha, agregador: 'rushour', plataforma: 'uber_glovo', marca: 'Streat Lab', turno: 'dia',
      pedidos: volumen, bruto: turnover, neto: null,
      ticket_medio: turnover && volumen ? turnover / volumen : null,
    };
  } catch (e: any) {
    await logRobot('rushour_backfill', 'error', `fecha=${fecha} ${String(e?.message || e)}`);
    return null;
  } finally { await page.close(); }
}

// Sinqro histórico con el fix real (calendario cerrado + espera a
// loadingOrders). No toca ingestaSinqro/irAVentasSinqro de robot.ts (robot
// diario en vivo, ya verificado) — variante propia solo para el backfill.
async function ingestaSinqroHistorico(browser: Browser, fecha: string): Promise<Fila[]> {
  if (!SINQRO_DEBUG.user || !SINQRO_DEBUG.pass) { await logRobot('sinqro_backfill', 'error', 'sin credenciales'); return []; }
  const page = await browser.newPage();
  try {
    await page.goto(SINQRO_DEBUG.loginUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.waitForSelector(SINQRO_DEBUG.userInput, { timeout: 15000 });
    await page.fill(SINQRO_DEBUG.userInput, SINQRO_DEBUG.user);
    await page.fill(SINQRO_DEBUG.passInput, SINQRO_DEBUG.pass);
    await Promise.all([page.waitForLoadState('networkidle').catch(() => {}), page.click(SINQRO_DEBUG.submitBtn)]);
    await page.waitForTimeout(3000);

    await irAVentasSinqroHistorico(page, fecha);

    const bloques = page.locator('[ng-repeat*="order in orders"]');
    const total = await bloques.count().catch(() => 0);
    const pedidos: { cliente: string; importe: string; textoBloque: string }[] = [];
    for (let i = 0; i < total; i++) {
      const b = bloques.nth(i);
      const cliente = ((await b.locator('.orderClientBox').first().textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
      const importe = ((await b.locator('.orderAmountBox').first().textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
      const textoBloque = ((await b.textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
      pedidos.push({ cliente, importe, textoBloque });
    }

    if (!pedidos.length) { await logRobot('sinqro_backfill', 'vacio', `fecha=${fecha} pedidos_leidos=0`); return []; }

    // Mismo dedupe que en vivo: de Sinqro solo Just Eat (Glovo se cuenta desde Rushour).
    const acc = new Map<Turno, { pedidos: number; bruto: number }>();
    let sinHora = 0;
    for (const p of pedidos) {
      const t = `${p.cliente} ${p.importe}`.toLowerCase();
      if (!/just\s?eat/.test(t)) continue;
      const turno = turnoDeTextoPedido(p.textoBloque);
      if (!turno) { sinHora++; continue; }
      const cur = acc.get(turno) || { pedidos: 0, bruto: 0 };
      cur.pedidos += 1; cur.bruto += (numES(p.importe) || 0);
      acc.set(turno, cur);
    }
    const out: Fila[] = Array.from(acc.entries()).map(([turno, v]) => ({
      fecha, agregador: 'sinqro', plataforma: 'just_eat', marca: 'Streat Lab', turno,
      pedidos: v.pedidos, bruto: Math.round(v.bruto * 100) / 100, neto: null,
      ticket_medio: v.pedidos ? Math.round((v.bruto / v.pedidos) * 100) / 100 : null,
    }));
    await logRobot('sinqro_backfill', 'ok', `fecha=${fecha} pedidos_leidos=${pedidos.length} filas=${out.length} sin_hora=${sinHora}`);
    return out;
  } catch (e: any) {
    await logRobot('sinqro_backfill', 'error', `fecha=${fecha} ${String(e?.message || e)}`);
    return [];
  } finally { await page.close(); }
}

async function volcarHtmlDebug(fuente: string, fecha: string, html: string) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  await sb.from('robot_debug').insert([{ fuente, fecha, html }]);
}

// Volcado de diagnóstico: navega Rushour hasta la sección "Historical" (mismo
// sondeo tolerante que ingestaRushourHistorico) y guarda el HTML completo en
// `robot_debug`, se haya encontrado o no la fecha exacta — así se puede
// inspeccionar el selector real sin adivinar a ciegas.
async function debugRushourHistorico(browser: Browser, fecha: string): Promise<void> {
  if (!RUSHOUR.user || !RUSHOUR.pass) { await logRobot('backfill_debug', 'error', 'rushour_hist sin credenciales'); return; }
  const page = await browser.newPage();
  // #root sigue vacío incluso esperando el picker: puede ser un error JS real
  // al aterrizar por goto() en /historicals (no page.evaluate, solo listeners
  // de eventos del navegador).
  const erroresJs: string[] = [];
  page.on('pageerror', (e) => erroresJs.push(`pageerror:${e.message}`));
  page.on('console', (msg) => { if (msg.type() === 'error') erroresJs.push(`console:${msg.text()}`); });
  try {
    await page.goto(RUSHOUR.loginUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.waitForSelector(RUSHOUR.userInput, { timeout: 15000 });
    await page.fill(RUSHOUR.userInput, RUSHOUR.user);
    await page.fill(RUSHOUR.passInput, RUSHOUR.pass);
    await Promise.all([page.waitForLoadState('networkidle').catch(() => {}), page.click(RUSHOUR.submitBtn)]);
    await page.waitForTimeout(4000);
    await cerrarModales(page);
    await page.waitForTimeout(1000);
    await cerrarModales(page);

    await irAHistoricalRushour(page);
    if (/historicals/.test(page.url())) {
      await fijarRangoAntPicker(page, fecha);
    }
    const html = await page.content();
    await volcarHtmlDebug('rushour_hist', fecha, html);
    const err = erroresJs.length ? ` js_errores=${erroresJs.length} :: ${erroresJs.slice(0, 3).join(' | ').slice(0, 400)}` : ' js_errores=0';
    await logRobot('backfill_debug', 'ok', `rushour_hist volcado fecha=${fecha} bytes=${html.length}${err}`);
  } catch (e: any) {
    await logRobot('backfill_debug', 'error', `rushour_hist fecha=${fecha} ${String(e?.message || e)}`);
  } finally { await page.close(); }
}

// Volcado de diagnóstico: aplica el filtro de fecha de Sinqro (mismo fix de
// checkboxes con dispatchEvent que el robot diario) y guarda el HTML completo
// del resultado en `robot_debug`.
async function debugSinqroHistorico(browser: Browser, fecha: string): Promise<void> {
  if (!SINQRO_DEBUG.user || !SINQRO_DEBUG.pass) { await logRobot('backfill_debug', 'error', 'sinqro_hist sin credenciales'); return; }
  const page = await browser.newPage();
  const erroresJs: string[] = [];
  page.on('pageerror', (e) => erroresJs.push(`pageerror:${e.message}`));
  page.on('console', (msg) => { if (msg.type() === 'error') erroresJs.push(`console:${msg.text()}`); });
  try {
    await page.goto(SINQRO_DEBUG.loginUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.waitForSelector(SINQRO_DEBUG.userInput, { timeout: 15000 });
    await page.fill(SINQRO_DEBUG.userInput, SINQRO_DEBUG.user);
    await page.fill(SINQRO_DEBUG.passInput, SINQRO_DEBUG.pass);
    await Promise.all([page.waitForLoadState('networkidle').catch(() => {}), page.click(SINQRO_DEBUG.submitBtn)]);
    await page.waitForTimeout(3000);

    // Misma navegación con el fix real (calendario cerrado + espera a
    // loadingOrders) que usa el backfill de verdad — un solo sitio con la
    // lógica de fecha, sin duplicados que puedan divergir.
    await irAVentasSinqroHistorico(page, fecha);

    const html = await page.content();
    await volcarHtmlDebug('sinqro_hist', fecha, html);
    const err = erroresJs.length ? ` js_errores=${erroresJs.length} :: ${erroresJs.slice(0, 3).join(' | ').slice(0, 400)}` : ' js_errores=0';
    await logRobot('backfill_debug', 'ok', `sinqro_hist volcado fecha=${fecha} bytes=${html.length}${err}`);
  } catch (e: any) {
    await logRobot('backfill_debug', 'error', `sinqro_hist fecha=${fecha} ${String(e?.message || e)}`);
  } finally { await page.close(); }
}

async function main() {
  // Modo debug: vuelca el HTML real de una sola fecha a `robot_debug` y
  // termina. No toca el backfill normal ni recorre el histórico.
  const debugFecha = process.env.BACKFILL_DEBUG_FECHA;
  if (debugFecha) {
    // Admite varias fechas separadas por coma para acotar en una sola pasada
    // hasta qué antigüedad admite Sinqro búsquedas (el fix de ng-model ya
    // probado funciona para fechas recientes; hay que ver dónde falla).
    const fechas = debugFecha.split(',').map((s) => s.trim()).filter(Boolean);
    await logRobot('backfill', 'debug_inicio', `volcado html fechas=${fechas.join(',')}`);
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    try {
      for (const f of fechas) {
        await debugRushourHistorico(browser, f);
        await debugSinqroHistorico(browser, f);
      }
      await logRobot('backfill', 'debug', `volcado ${fechas.join(',')} hecho`);
    } finally {
      await browser.close();
    }
    return;
  }

  const desdeParam = process.env.BACKFILL_DESDE;
  // Límite opcional hacia atrás (inclusive) — para acotar una pasada de
  // verificación a un solo día sin recorrer todo el histórico. Vacío = sin límite.
  const hastaParam = process.env.BACKFILL_HASTA;
  const inicio = desdeParam || leerCursor() || new Date().toISOString().slice(0, 10);
  await logRobot('backfill', 'inicio', `desde=${inicio}${hastaParam ? ` hasta=${hastaParam}` : ''}`);

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  let fecha = inicio;
  let rachaVacia = 0;
  let diasConDatos = 0;
  let motivoParada: 'racha_vacia' | 'hasta' = 'racha_vacia';
  try {
    while (rachaVacia < RACHA_VACIA_LIMITE) {
      if (hastaParam && fecha < hastaParam) { motivoParada = 'hasta'; break; }
      const sinq = await ingestaSinqroHistorico(browser, fecha);
      const rush = await ingestaRushourHistorico(browser, fecha);
      const filas: Fila[] = [...(rush ? [rush] : []), ...sinq];

      if (filas.length === 0) {
        rachaVacia++;
      } else {
        rachaVacia = 0;
        diasConDatos++;
        await guardar(filas);
      }
      guardarCursor(fecha);
      await logRobot('backfill', 'dia', `fecha=${fecha} filas=${filas.length} racha_vacia=${rachaVacia}`);

      fecha = diaAnterior(fecha);
    }
    const msg = motivoParada === 'hasta'
      ? `parado por límite hasta=${hastaParam}, en ${fecha}. dias_con_datos=${diasConDatos}`
      : `parado por ${RACHA_VACIA_LIMITE} días vacíos seguidos, antes de ${fecha}. dias_con_datos=${diasConDatos}`;
    await logRobot('backfill', 'fin', msg);
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
