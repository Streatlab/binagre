/**
 * Robot de ingesta diaria · Rushour + Sinqro → Supabase
 * FUENTES: Rushour = Uber + Glovo (agregado, solo total del día). Sinqro = Just Eat (por pedido, con hora).
 * DEDUPE: Glovo se cuenta desde Rushour; de Sinqro solo Just Eat.
 * TURNOS: comida = antes de las 17:00 (Madrid), cena = 17:00 en adelante.
 * Escribe diagnóstico en `robot_log` para verificar sin descargar artefactos.
 *
 * NOTA: la lectura de los KPIs de Rushour se hace con LOCATORS de Playwright (en
 * Node), NO con page.evaluate, porque tsx/esbuild inyecta el helper `__name` que
 * no existe dentro del navegador y rompía el evaluate ("__name is not defined").
 *
 * 16-jul: si la lectura de pedidos de Sinqro devuelve 0 bloques, se vuelca el
 * DOM completo a robot_debug (fuente 'sinqro_vivo_dom') para poder auditar por
 * SQL qué pinta tiene la página (la lectura lleva días en 0 y sin DOM no se
 * puede saber si cambió el selector, el filtro de fecha o el login de app.*).
 */

import { chromium, Browser, Page } from 'playwright';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIAG = process.env.DIAG === '1';
const ART_DIR = './robot-artifacts';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export type Toma = 'comida' | 'cena';
export type Turno = 'comida' | 'cena' | 'dia';

// ---------- Fecha/hora Madrid (el runner de Actions va en UTC) ----------
export function fechaMadrid(offsetDias = 0): string {
  const base = new Date(Date.now() + offsetDias * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(base);
}
export function horaMadridActual(): number {
  const s = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', hour12: false }).format(new Date());
  return parseInt(s, 10);
}
// Deriva la toma cuando no viene explícita (crons de calendario, sin inputs).
// Ventana comida: 12h-19h Madrid (cubre 16:30 verano e invierno). Ventana cena:
// resto del día, pero SIEMPRE antes de medianoche (~23:30 verano e invierno) —
// el contador en vivo de Rushour se reinicia pasada la medianoche local, así
// que leer después de las 00:00 da el total del día que EMPIEZA, no el que
// cierra. Así el disparo "de más" que provoca el cambio de hora (los 4 crons
// están siempre activos) cae en la ventana correcta sin romper el reparto.
export function tomaPorHoraMadrid(): Toma {
  const h = horaMadridActual();
  return h >= 12 && h < 20 ? 'comida' : 'cena';
}
function ddmmyyyy(iso: string): string { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }
function ensureArtDir() { if (!existsSync(ART_DIR)) mkdirSync(ART_DIR, { recursive: true }); }
function numES(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
async function diag(page: Page, etiqueta: string) {
  if (!DIAG) return;
  ensureArtDir();
  try {
    await page.screenshot({ path: `${ART_DIR}/${etiqueta}.png`, fullPage: true });
    writeFileSync(`${ART_DIR}/${etiqueta}.html`, await page.content());
  } catch {}
}

export type Fila = {
  fecha: string; agregador: string; plataforma: string; marca: string; turno: Turno;
  pedidos: number | null; bruto: number | null; neto: number | null; ticket_medio: number | null;
};

const RUSHOUR = {
  loginUrl: 'https://manager.rushour.io/login',
  user: process.env.RUSHOUR_USER || '', pass: process.env.RUSHOUR_PASS || '',
  userInput: 'input[name="username"]', passInput: 'input[name="password"]', submitBtn: 'button[type="submit"]',
};
const SINQRO = {
  loginUrl: 'https://app.sinqro.com/', ventasUrl: 'https://app.sinqro.com/#/sp/6416/online/orders',
  user: process.env.SINQRO_USER || '', pass: process.env.SINQRO_PASS || '',
  userInput: '#login-email', passInput: '#login-password', submitBtn: '#loginButton',
  tipoChecks: ['#deliveryFilter', '#collectionFilter', '#insideFilter', '#insituFilter', '#reservationFilter'],
  startDate: '#startDateFilter', endDate: '#endDateFilter',
};

async function cerrarModales(page: Page) {
  const nombres = [/close/i, /cerrar/i, /no,? gracias/i, /aceptar/i, /got it/i, /entendido/i, /×/];
  for (const re of nombres) {
    await page.getByRole('button', { name: re }).first().click({ timeout: 1200 }).catch(() => {});
  }
  await page.locator('button:has(span:text-is("Close"))').first().click({ timeout: 1500 }).catch(() => {});
  await page.getByRole('button', { name: 'Close', exact: true }).first().click({ timeout: 1500 }).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
}

export async function logRobot(fuente: string, estado: string, detalle: string) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
    await sb.from('robot_log').insert([{ fuente, estado, detalle }]);
  } catch {}
}

async function latidoRobot(ultimoDato: string, detalle: string) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
    await sb.from('robot_salud').upsert([{ fuente: 'robot', ultima_ejecucion: new Date().toISOString(), ultimo_dato: ultimoDato, estado: 'ok', detalle }]);
  } catch {}
}

// Vuelca el DOM completo de una página a robot_debug para poder auditarlo por SQL.
async function volcarDom(page: Page, fuente: string, fecha: string) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
    const html = await page.content().catch(() => '');
    if (html) await sb.from('robot_debug').insert([{ fuente, fecha, html }]);
  } catch {}
}

// Lee un KPI de Rushour con locators: localiza el <span> etiqueta, sube por sus
// ancestros <div> (la card) y devuelve el primer valor numérico (con € para
// importes, entero para volumen). Todo en Node → sin page.evaluate.
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

async function loginRushour(page: Page) {
  await page.goto(RUSHOUR.loginUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await diag(page, 'rushour-01-login');
  await page.waitForSelector(RUSHOUR.userInput, { timeout: 15000 });
  await page.fill(RUSHOUR.userInput, RUSHOUR.user);
  await page.fill(RUSHOUR.passInput, RUSHOUR.pass);
  await Promise.all([page.waitForLoadState('networkidle').catch(() => {}), page.click(RUSHOUR.submitBtn)]);
  await page.waitForTimeout(4000);
  await cerrarModales(page);
  await page.waitForTimeout(1200);
  await cerrarModales(page);
  await page.waitForTimeout(800);
  await diag(page, 'rushour-02-postlogin');
}

async function leerKpisConReintentos(page: Page): Promise<{ turnover: number | null; volumen: number | null }> {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForSelector('span', { timeout: 10000 }).catch(() => {});
  let turnover: number | null = null;
  let volumen: number | null = null;
  for (let intento = 1; intento <= 5; intento++) {
    turnover = await leerKpiRushour(page, /Turnover/i, true);
    volumen = await leerKpiRushour(page, /Volume of orders/i, false);
    if (turnover != null || volumen != null) break;
    await cerrarModales(page);
    await page.waitForTimeout(2500);
    if (intento === 2) {
      await page.goto('https://manager.rushour.io/', { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(3500);
      await cerrarModales(page);
      await page.waitForTimeout(1000);
    }
  }
  return { turnover, volumen };
}

// Fila 'rushour/comida' de Supabase ya guardada para esa fecha (para restar en la toma de cena).
async function leerComidaGuardada(sb: SupabaseClient | null, fecha: string): Promise<{ pedidos: number; bruto: number } | null> {
  if (!sb) return null;
  const { data } = await sb
    .from('ingesta_robot_diaria')
    .select('pedidos, bruto')
    .eq('fecha', fecha).eq('agregador', 'rushour').eq('plataforma', 'uber_glovo').eq('marca', 'Streat Lab').eq('turno', 'comida')
    .maybeSingle();
  if (!data) return null;
  return { pedidos: Number(data.pedidos) || 0, bruto: Number(data.bruto) || 0 };
}

// ---------- RUSHOUR (toma del día en curso) ----------
export async function ingestaRushour(browser: Browser, fecha: string, toma: Toma): Promise<Fila[]> {
  if (!RUSHOUR.user || !RUSHOUR.pass) { await logRobot('rushour', 'error', 'sin credenciales'); return []; }
  const page = await browser.newPage();
  try {
    await loginRushour(page);
    const { turnover, volumen } = await leerKpisConReintentos(page);
    await diag(page, 'rushour-03-report');
    await logRobot('rushour', turnover != null ? 'ok' : 'vacio', `toma=${toma} turnover=${turnover} volumen=${volumen}`);

    if (turnover == null && volumen == null) return [];

    if (toma === 'comida') {
      return [{
        fecha, agregador: 'rushour', plataforma: 'uber_glovo', marca: 'Streat Lab', turno: 'comida',
        pedidos: volumen, bruto: turnover, neto: null,
        ticket_medio: turnover && volumen ? turnover / volumen : null,
      }];
    }

    // toma === 'cena': el KPI de Rushour es el acumulado del día → restar lo ya
    // guardado en el turno de comida para quedarnos solo con la franja de cena.
    const sb = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
    const comida = await leerComidaGuardada(sb, fecha);
    if (!comida) {
      return [{
        fecha, agregador: 'rushour', plataforma: 'uber_glovo', marca: 'Streat Lab', turno: 'dia',
        pedidos: volumen, bruto: turnover, neto: null,
        ticket_medio: turnover && volumen ? turnover / volumen : null,
      }];
    }
    const brutoCena = (turnover ?? 0) - comida.bruto;
    const pedidosCena = (volumen ?? 0) - comida.pedidos;
    if (brutoCena < 0 || pedidosCena < 0) {
      await logRobot('rushour', 'aviso', `resta negativa cena (bruto=${brutoCena} pedidos=${pedidosCena}) → guardado como turno=dia con el total`);
      return [{
        fecha, agregador: 'rushour', plataforma: 'uber_glovo', marca: 'Streat Lab', turno: 'dia',
        pedidos: volumen, bruto: turnover, neto: null,
        ticket_medio: turnover && volumen ? turnover / volumen : null,
      }];
    }
    return [{
      fecha, agregador: 'rushour', plataforma: 'uber_glovo', marca: 'Streat Lab', turno: 'cena',
      pedidos: pedidosCena, bruto: Math.round(brutoCena * 100) / 100, neto: null,
      ticket_medio: pedidosCena ? Math.round((brutoCena / pedidosCena) * 100) / 100 : null,
    }];
  } catch (e: any) {
    await logRobot('rushour', 'error', String(e?.message || e));
    await diag(page, 'rushour-ERROR');
    return [];
  } finally { await page.close(); }
}

async function loginSinqro(page: Page) {
  await page.goto(SINQRO.loginUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await diag(page, 'sinqro-01-login');
  await page.waitForSelector(SINQRO.userInput, { timeout: 15000 });
  await page.fill(SINQRO.userInput, SINQRO.user);
  await page.fill(SINQRO.passInput, SINQRO.pass);
  await Promise.all([page.waitForLoadState('networkidle').catch(() => {}), page.click(SINQRO.submitBtn)]);
  await page.waitForTimeout(3000);
  await diag(page, 'sinqro-02-postlogin');
}

async function irAVentasSinqro(page: Page, fecha: string) {
  await page.goto(SINQRO.ventasUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);

  for (const sel of SINQRO.tipoChecks) {
    const chk = page.locator(sel).first();
    if (!(await chk.count())) continue;
    if (await chk.isChecked().catch(() => false)) continue;
    // AngularJS necesita click+change en el input (aunque esté oculto) para activar
    // el filtro; dispatchEvent del locator lanza el evento nativo sin page.evaluate.
    await chk.dispatchEvent('click').catch(() => {});
    await chk.dispatchEvent('change').catch(() => {});
  }
  await page.waitForTimeout(1000);

  // AngularJS (ng-model) no registra .fill(): hay que escribir carácter a
  // carácter y disparar input+change para que el filtro de fecha se aplique.
  const f = ddmmyyyy(fecha);
  const sd = page.locator(SINQRO.startDate).first();
  const ed = page.locator(SINQRO.endDate).first();
  if (await sd.count()) {
    await sd.fill('').catch(() => {});
    await sd.type(f, { delay: 40 }).catch(() => {});
    await sd.dispatchEvent('input').catch(() => {});
    await sd.dispatchEvent('change').catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});
  }
  if (await ed.count()) {
    await ed.fill('').catch(() => {});
    await ed.type(f, { delay: 40 }).catch(() => {});
    await ed.dispatchEvent('input').catch(() => {});
    await ed.dispatchEvent('change').catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});
  }

  await page.getByRole('button', { name: /buscar/i }).first().click().catch(() => {});
  await page.waitForTimeout(4000);
}

// Clasifica un texto de bloque de pedido en comida (<17:00) / cena (>=17:00) Madrid.
// Busca "a las HH:MMh" (p.ej. "Entregar hoy a las 13:42h"). Si no encuentra hora, null.
export function turnoDeTextoPedido(texto: string): Turno | null {
  const m = texto.match(/(\d{1,2}):(\d{2})\s*h/);
  if (!m) return null;
  const horas = parseInt(m[1], 10);
  return horas < 17 ? 'comida' : 'cena';
}

// ---------- SINQRO (una fecha completa: separa comida/cena por hora real del pedido) ----------
export async function ingestaSinqro(browser: Browser, fecha: string): Promise<Fila[]> {
  if (!SINQRO.user || !SINQRO.pass) { await logRobot('sinqro', 'error', 'sin credenciales'); return []; }
  const page = await browser.newPage();
  try {
    await loginSinqro(page);
    await irAVentasSinqro(page, fecha);
    await diag(page, 'sinqro-03-report');

    // Leer pedidos con locators (cada pedido = bloque ng-repeat "order in orders").
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

    if (!pedidos.length) {
      await logRobot('sinqro', 'vacio', 'pedidos_leidos=0 (DOM volcado a robot_debug: sinqro_vivo_dom)');
      await volcarDom(page, 'sinqro_vivo_dom', fecha);
      return [];
    }

    // DEDUPE: de Sinqro solo Just Eat (Glovo se cuenta desde Rushour).
    const acc = new Map<Turno, { pedidos: number; bruto: number }>();
    let sinHora = 0;
    for (const p of pedidos) {
      const t = `${p.cliente} ${p.importe}`.toLowerCase();
      if (!/just\s?eat/.test(t)) continue;
      const turno = turnoDeTextoPedido(p.textoBloque);
      if (!turno) { sinHora++; continue; } // sin hora legible: no se inventa turno, se descarta del reparto
      const cur = acc.get(turno) || { pedidos: 0, bruto: 0 };
      cur.pedidos += 1; cur.bruto += (numES(p.importe) || 0);
      acc.set(turno, cur);
    }
    const out: Fila[] = Array.from(acc.entries()).map(([turno, v]) => ({
      fecha, agregador: 'sinqro', plataforma: 'just_eat', marca: 'Streat Lab', turno,
      pedidos: v.pedidos, bruto: Math.round(v.bruto * 100) / 100, neto: null,
      ticket_medio: v.pedidos ? Math.round((v.bruto / v.pedidos) * 100) / 100 : null,
    }));
    await logRobot('sinqro', 'ok', `pedidos_leidos=${pedidos.length} filas_justeat=${out.length} sin_hora=${sinHora}`);
    return out;
  } catch (e: any) {
    await logRobot('sinqro', 'error', String(e?.message || e));
    await diag(page, 'sinqro-ERROR');
    return [];
  } finally { await page.close(); }
}

export async function guardar(filas: Fila[]) {
  if (!filas.length) { await logRobot('guardar', 'vacio', '0 filas'); return; }
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { error } = await sb.from('ingesta_robot_diaria').upsert(filas, { onConflict: 'fecha,agregador,plataforma,marca,turno' });
  if (error) { await logRobot('guardar', 'error', error.message); process.exitCode = 1; }
  else { await logRobot('guardar', 'ok', `${filas.length} filas`); }
}

async function main() {
  const toma: Toma = process.env.TOMA === 'comida' ? 'comida' : (process.env.TOMA === 'cena' ? 'cena' : tomaPorHoraMadrid());
  // La toma de cena corre ~23:30 Madrid, MISMO día (ver por qué en el cron: el
  // contador en vivo de Rushour se reinicia pasada la medianoche, así que leer
  // después de las 00:00 devuelve el total del día NUEVO, no el que cierra).
  const fecha = process.env.FECHA || fechaMadrid(0);
  await logRobot('main', 'inicio', `toma=${toma} fecha=${fecha}`);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const rush = await ingestaRushour(browser, fecha, toma);
    const sinq = await ingestaSinqro(browser, fecha);
    await guardar([...rush, ...sinq]);
    await latidoRobot(fecha, `toma=${toma} filas=${rush.length + sinq.length}`);
  } finally { await browser.close(); }
}

// Solo se auto-ejecuta cuando este archivo es el punto de entrada directo
// (tsx robot.ts), nunca cuando backfill.ts lo importa como módulo.
const esEntryPoint = !!process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (esEntryPoint) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
