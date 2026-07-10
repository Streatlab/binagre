/**
 * Backfill histórico · Rushour + Sinqro → Supabase
 * Reutiliza las funciones del robot (login, lectura de KPIs, parseo de pedidos,
 * guardado). Recorre día a día HACIA ATRÁS desde BACKFILL_DESDE (por defecto
 * 2025-12-31), cargando lo que cada plataforma permita ver en su histórico.
 *
 * Sinqro: su filtro de fechas ya admite cualquier fecha pasada (los mismos
 * selectores #startDateFilter/#endDateFilter que usa el robot del día en
 * curso), así que se reutiliza ingestaSinqro tal cual → desglosa comida/cena
 * por la hora real de cada pedido.
 *
 * Rushour: el dashboard en vivo (Turnover/Volume of orders) no tiene selector
 * de fecha confirmado; este script intenta localizar una sección/pestaña
 * "Historical" con selector tolerante y, si no la encuentra o no da un total
 * fiable para ese día, guarda SOLO Sinqro y lo anota en robot_log (no inventa
 * el dato de Rushour). Cuando hay total histórico de Rushour, no hay desglose
 * por hora → se guarda como turno='dia'.
 *
 * Ejecutar en LOCAL (no en Actions) con Playwright y las credenciales reales:
 *   BACKFILL_DESDE=2025-12-31 npx tsx scripts/robot-ingesta/backfill.ts
 *
 * Persiste la última fecha procesada en .backfill-cursor para poder reanudar
 * si se corta a medias (Ctrl+C, caída de red, etc.).
 */

import { chromium, Browser, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  Fila, guardar, logRobot, ingestaSinqro,
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
// Duplicado deliberado del SINQRO de robot.ts (no exportado): solo para el
// volcado de diagnóstico de esta pasada, sin tocar el robot diario.
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

function leerCursor(): string | null {
  if (!existsSync(CURSOR_PATH)) return null;
  const s = readFileSync(CURSOR_PATH, 'utf-8').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
function guardarCursor(fecha: string) {
  writeFileSync(CURSOR_PATH, fecha, 'utf-8');
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

    // Sondeo tolerante de un enlace/pestaña a la sección histórica.
    const navHistorico = page.getByRole('link', { name: /historical/i }).or(page.getByRole('tab', { name: /historical/i })).or(page.getByText(/historical/i)).first();
    if (!(await navHistorico.count().catch(() => 0))) {
      await logRobot('rushour_backfill', 'sin_seccion', `fecha=${fecha} no se encontró navegación "Historical"`);
      return null;
    }
    await navHistorico.click({ timeout: 5000 }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    await cerrarModales(page);

    // Sondeo tolerante de un selector de fecha dentro de la sección histórica.
    const f = ddmmyyyy(fecha);
    const inputFecha = page.locator('input[type="date"], input[placeholder*="date" i], input[placeholder*="fecha" i]').first();
    let fechaFijada = false;
    if (await inputFecha.count().catch(() => 0)) {
      await inputFecha.fill(fecha).catch(async () => { await inputFecha.fill(f).catch(() => {}); });
      await page.keyboard.press('Enter').catch(() => {});
      fechaFijada = true;
    }
    if (!fechaFijada) {
      await logRobot('rushour_backfill', 'sin_selector_fecha', `fecha=${fecha} sección histórica encontrada pero sin selector de fecha reconocible`);
      return null;
    }
    await page.waitForTimeout(2500);

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

    const navHistorico = page.getByRole('link', { name: /historical/i }).or(page.getByRole('tab', { name: /historical/i })).or(page.getByText(/historical/i)).first();
    if (await navHistorico.count().catch(() => 0)) {
      await navHistorico.click({ timeout: 5000 }).catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(2000);
      await cerrarModales(page);

      const f = ddmmyyyy(fecha);
      const inputFecha = page.locator('input[type="date"], input[placeholder*="date" i], input[placeholder*="fecha" i]').first();
      if (await inputFecha.count().catch(() => 0)) {
        await inputFecha.fill(fecha).catch(async () => { await inputFecha.fill(f).catch(() => {}); });
        await page.keyboard.press('Enter').catch(() => {});
        await page.waitForTimeout(2500);
      }
    }
    const html = await page.content();
    await volcarHtmlDebug('rushour_hist', fecha, html);
    await logRobot('backfill_debug', 'ok', `rushour_hist volcado fecha=${fecha} bytes=${html.length}`);
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
  try {
    await page.goto(SINQRO_DEBUG.loginUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.waitForSelector(SINQRO_DEBUG.userInput, { timeout: 15000 });
    await page.fill(SINQRO_DEBUG.userInput, SINQRO_DEBUG.user);
    await page.fill(SINQRO_DEBUG.passInput, SINQRO_DEBUG.pass);
    await Promise.all([page.waitForLoadState('networkidle').catch(() => {}), page.click(SINQRO_DEBUG.submitBtn)]);
    await page.waitForTimeout(3000);

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
    if (await sd.count()) { await sd.fill(f).catch(() => {}); await page.keyboard.press('Escape').catch(() => {}); }
    if (await ed.count()) { await ed.fill(f).catch(() => {}); await page.keyboard.press('Escape').catch(() => {}); }

    await page.getByRole('button', { name: /buscar/i }).first().click().catch(() => {});
    await page.waitForTimeout(4000);

    const html = await page.content();
    await volcarHtmlDebug('sinqro_hist', fecha, html);
    await logRobot('backfill_debug', 'ok', `sinqro_hist volcado fecha=${fecha} bytes=${html.length}`);
  } catch (e: any) {
    await logRobot('backfill_debug', 'error', `sinqro_hist fecha=${fecha} ${String(e?.message || e)}`);
  } finally { await page.close(); }
}

async function main() {
  // Modo debug: vuelca el HTML real de una sola fecha a `robot_debug` y
  // termina. No toca el backfill normal ni recorre el histórico.
  const debugFecha = process.env.BACKFILL_DEBUG_FECHA;
  if (debugFecha) {
    await logRobot('backfill', 'debug_inicio', `volcado html fecha=${debugFecha}`);
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    try {
      await debugRushourHistorico(browser, debugFecha);
      await debugSinqroHistorico(browser, debugFecha);
      await logRobot('backfill', 'debug', `volcado ${debugFecha} hecho`);
    } finally {
      await browser.close();
    }
    return;
  }

  const desdeParam = process.env.BACKFILL_DESDE;
  const inicio = desdeParam || leerCursor() || new Date().toISOString().slice(0, 10);
  await logRobot('backfill', 'inicio', `desde=${inicio}`);

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  let fecha = inicio;
  let rachaVacia = 0;
  let diasConDatos = 0;
  try {
    while (rachaVacia < RACHA_VACIA_LIMITE) {
      const sinq = await ingestaSinqro(browser, fecha);
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
    await logRobot('backfill', 'fin', `parado por ${RACHA_VACIA_LIMITE} días vacíos seguidos, antes de ${fecha}. dias_con_datos=${diasConDatos}`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
