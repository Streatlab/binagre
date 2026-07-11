/**
 * Backfill histórico · Rushour + Sinqro → Supabase
 * Reutiliza las funciones del robot (login, parseo de pedidos, guardado).
 * Recorre día a día HACIA ATRÁS desde BACKFILL_DESDE (por defecto 2025-12-31),
 * cargando lo que cada plataforma permita ver en su histórico.
 *
 * Sinqro: ingestaSinqroHistorico (propia, no la ingestaSinqro del robot diario)
 * fija fecha inicio/fin, CIERRA el calendario de verdad (clic fuera, no solo
 * Escape) y espera a que loadingOrders termine antes de leer → desglosa
 * comida/cena por la hora real de cada pedido.
 *
 * Rushour: la sección /historicals está ROTA (confirmado) — se usa en su lugar
 * la pantalla /rapports, con el mismo cierre de modales promocionales y
 * apertura de selects por teclado ya probados en producción en
 * scripts/robot-ingesta/debug-reports.ts (v4). Sesión reutilizada entre días
 * (un solo login) — solo se reabre si expira. Una fila por plataforma
 * (glovo/ubereats), turno='dia' (Rushour no desglosa por hora).
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
  rapportsUrl: 'https://manager.rushour.io/rapports',
  user: process.env.RUSHOUR_USER || '', pass: process.env.RUSHOUR_PASS || '',
  userInput: 'input[name="username"]', passInput: 'input[name="password"]', submitBtn: 'button[type="submit"]',
  selFecha: '[data-intercom-target="Select du dashboard pour changer la date"]',
  selRange: '.ant-picker-range[data-intercom-target="Calendrier du dashboard pour changer la date"]',
  kpiRevenue: '[data-intercom-target="KPI revenue"]',
  kpiVolumen: '[data-intercom-target="KPI volume de commandes"]',
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

async function volcarHtmlDebug(fuente: string, fecha: string, html: string) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  try { await sb.from('robot_debug').insert([{ fuente, fecha, html }]); } catch { /* nunca rompe el backfill */ }
}

// ───────────────────────── RUSHOUR /rapports ─────────────────────────────
// Cierra TODOS los modales Ant en bucle hasta que no quede ninguno visible.
// Código probado en producción (debug-reports.ts v4): sin esto, /rapports
// bloquea todos los clicks con modales promocionales (WhatsApp, branding) y
// todas las interacciones posteriores fallan en silencio.
async function cerrarTodosLosModalesRushour(page: Page): Promise<number> {
  for (let ronda = 0; ronda < 8; ronda++) {
    const visibles = await page.locator('.ant-modal-wrap:visible').count().catch(() => 0);
    if (!visibles) return ronda;
    await page.locator('.ant-modal-close:visible').first().click({ force: true, timeout: 2000 }).catch(() => {});
    const btns = page.locator('.ant-modal-wrap:visible button');
    const nb = await btns.count().catch(() => 0);
    for (let i = 0; i < nb; i++) {
      const t = ((await btns.nth(i).textContent().catch(() => '')) || '').trim();
      if (/^(close|cerrar|no,? gracias|later|más tarde)$/i.test(t)) {
        await btns.nth(i).click({ force: true, timeout: 2000 }).catch(() => {});
      }
    }
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(1200);
  }
  return -1;
}

// Abre un Ant Select con teclado (inmune a overlays tapando el selector):
// focus + ArrowDown. Si no aparecen opciones, fallback a click normal.
async function abrirSelectAntTeclado(page: Page, contenedor: ReturnType<Page['locator']>): Promise<void> {
  await contenedor.locator('input').first().focus().catch(() => {});
  await page.keyboard.press('ArrowDown').catch(() => {});
  await page.waitForTimeout(1200);
  const hayOpciones = await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').count().catch(() => 0);
  if (!hayOpciones) {
    await contenedor.locator('.ant-select-selector').first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1200);
  }
}

async function loginYAbrirRapports(browser: Browser): Promise<Page> {
  const page = await browser.newPage();
  await page.goto(RUSHOUR.loginUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(RUSHOUR.userInput, { timeout: 20000 });
  await page.fill(RUSHOUR.userInput, RUSHOUR.user);
  await page.fill(RUSHOUR.passInput, RUSHOUR.pass);
  await Promise.all([page.waitForLoadState('networkidle').catch(() => {}), page.click(RUSHOUR.submitBtn)]);
  await page.waitForTimeout(5000);

  await page.goto(RUSHOUR.rapportsUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(8000);
  await cerrarTodosLosModalesRushour(page);
  return page;
}

// Elige "Custom range" en el select de fecha. Devuelve false si no aparece
// (anomalía: no se adivina, el llamador vuelca HTML y para esa fecha).
async function elegirCustomRange(page: Page): Promise<boolean> {
  await abrirSelectAntTeclado(page, page.locator(RUSHOUR.selFecha));
  const items = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option');
  const n = await items.count().catch(() => 0);
  for (let i = 0; i < n; i++) {
    const t = ((await items.nth(i).textContent().catch(() => '')) || '').trim();
    if (/^custom range$/i.test(t)) { await items.nth(i).click().catch(() => {}); return true; }
  }
  return false;
}

async function leerMesAnioPanel(panel: ReturnType<Page['locator']>): Promise<{ mes: number; anio: number } | null> {
  const txtMes = ((await panel.locator('.ant-picker-month-btn').first().textContent().catch(() => '')) || '').trim().toLowerCase();
  const txtAnio = ((await panel.locator('.ant-picker-year-btn').first().textContent().catch(() => '')) || '').trim();
  const anio = parseInt(txtAnio, 10);
  const MESES_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const idx = MESES_EN.findIndex((m) => txtMes.startsWith(m));
  if (!Number.isFinite(anio) || idx < 0) return null;
  return { mes: idx + 1, anio };
}

// Navega el panel del calendario hasta que la celda del día objetivo (ISO,
// title="YYYY-MM-DD" — así lo pone Ant) esté presente. Primero calcula los
// meses de diferencia leyendo la cabecera del panel; si no puede leerla o el
// cálculo se queda corto, sigue pulsando "prev" (dirección del backfill,
// hacia atrás) como red de seguridad, acotado para no bucle infinito.
async function navegarCalendarioHasta(page: Page, fechaISO: string): Promise<boolean> {
  const anioObj = Number(fechaISO.slice(0, 4));
  const mesObj = Number(fechaISO.slice(5, 7));
  const panel = page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)').first();
  const celda = () => panel.locator(`td[title="${fechaISO}"]`).first();

  if (await celda().count().catch(() => 0)) return true;

  const actual = await leerMesAnioPanel(panel);
  if (actual) {
    const diffMeses = (anioObj - actual.anio) * 12 + (mesObj - actual.mes);
    const boton = diffMeses < 0 ? '.ant-picker-header-prev-btn' : '.ant-picker-header-next-btn';
    for (let i = 0; i < Math.abs(diffMeses); i++) {
      await panel.locator(boton).first().click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(300);
    if (await celda().count().catch(() => 0)) return true;
  }

  for (let intento = 0; intento < 36; intento++) {
    if (await celda().count().catch(() => 0)) return true;
    await panel.locator('.ant-picker-header-prev-btn').first().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(150);
  }
  return false;
}

// Fija inicio=fin=fechaISO en el range picker clicando la celda dos veces
// (los inputs son readonly, no se puede escribir). Devuelve false si la
// celda no aparece nunca (anomalía real, no adivinar).
async function fijarDiaUnicoRapports(page: Page, fechaISO: string): Promise<boolean> {
  const picker = page.locator(RUSHOUR.selRange).first();
  if (!(await picker.count().catch(() => 0))) return false;
  await picker.locator('input').first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(800);

  if (!(await navegarCalendarioHasta(page, fechaISO))) return false;
  const panel1 = page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)').first();
  await panel1.locator(`td[title="${fechaISO}"]`).first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(400);

  // Tras el primer clic el panel puede cambiar de vista (pasa a pedir el "end
  // date"); vuelve a navegar hasta la celda por si ha cambiado la vista.
  if (!(await navegarCalendarioHasta(page, fechaISO))) return false;
  const panel2 = page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)').first();
  await panel2.locator(`td[title="${fechaISO}"]`).first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(600);

  await page.keyboard.press('Escape').catch(() => {});
  return true;
}

// Deja seleccionada SOLO la plataforma objetivo en el select múltiple
// (glovo/ubereats), toggleando lo que haga falta.
async function seleccionarSoloPlataforma(page: Page, objetivo: 'glovo' | 'ubereats'): Promise<void> {
  const sel = page.locator('.ant-select-multiple').filter({ hasText: 'ubereats' }).first();
  await abrirSelectAntTeclado(page, sel);
  const items = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option');
  const n = await items.count().catch(() => 0);
  for (let i = 0; i < n; i++) {
    const t = ((await items.nth(i).textContent().catch(() => '')) || '').trim().toLowerCase();
    const clase = (await items.nth(i).getAttribute('class').catch(() => '')) || '';
    const seleccionada = clase.includes('ant-select-item-option-selected');
    const esObjetivo = t.includes(objetivo);
    if (esObjetivo && !seleccionada) await items.nth(i).click().catch(() => {});
    if (!esObjetivo && seleccionada) await items.nth(i).click().catch(() => {});
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(500);
}

async function leerKpiTexto(page: Page, selector: string): Promise<string | null> {
  const t = ((await page.locator(selector).first().textContent().catch(() => '')) || '').trim();
  return t || null;
}

// Espera a que el KPI cambie de valor tras fijar fecha/plataforma (o hasta
// 15s) — no un timeout fijo a ciegas. Un 0 estable tras la espera es un dato
// válido (día sin ventas de esa plataforma), no una anomalía.
async function esperarCambioYLeerKpis(page: Page): Promise<{ turnover: number | null; volumen: number | null }> {
  const inicialRev = await leerKpiTexto(page, RUSHOUR.kpiRevenue);
  const inicialVol = await leerKpiTexto(page, RUSHOUR.kpiVolumen);
  const desde = Date.now();
  let rev = inicialRev, vol = inicialVol;
  while (Date.now() - desde < 15000) {
    await page.waitForTimeout(500);
    rev = await leerKpiTexto(page, RUSHOUR.kpiRevenue);
    vol = await leerKpiTexto(page, RUSHOUR.kpiVolumen);
    if (rev !== inicialRev || vol !== inicialVol) break;
  }
  return { turnover: numES(rev), volumen: numES(vol) };
}

// Núcleo Rushour histórico: reutiliza una página YA logueada y en /rapports
// (ver asegurarSesionRushour). Fija el día en Custom range y lee Turnover +
// Volume of orders para glovo y ubereats por separado. Una fila por
// plataforma; turno='dia' (Rushour no desglosa por hora). Sin page.evaluate.
async function ingestaRushourReports(page: Page, fecha: string): Promise<Fila[]> {
  await cerrarTodosLosModalesRushour(page);

  const eligioCustom = await elegirCustomRange(page);
  if (!eligioCustom) {
    await logRobot('rushour_backfill', 'sin_custom_range', `fecha=${fecha} no se encontró la opción "Custom range" en el select de fecha`);
    await volcarHtmlDebug('rushour_reports_error', fecha, await page.content());
    return [];
  }
  await page.waitForTimeout(1500);
  await cerrarTodosLosModalesRushour(page);

  const fijada = await fijarDiaUnicoRapports(page, fecha);
  if (!fijada) {
    await logRobot('rushour_backfill', 'sin_celda_calendario', `fecha=${fecha} no se encontró la celda del día en el calendario`);
    await volcarHtmlDebug('rushour_reports_error', fecha, await page.content());
    return [];
  }
  await cerrarTodosLosModalesRushour(page);

  const filas: Fila[] = [];
  for (const plataforma of ['glovo', 'ubereats'] as const) {
    await seleccionarSoloPlataforma(page, plataforma);
    await cerrarTodosLosModalesRushour(page);
    const { turnover, volumen } = await esperarCambioYLeerKpis(page);
    if (turnover == null && volumen == null) {
      await logRobot('rushour_backfill', 'sin_kpi', `fecha=${fecha} plataforma=${plataforma} sin lectura de KPI`);
      await volcarHtmlDebug('rushour_reports_error', fecha, await page.content());
      continue;
    }
    filas.push({
      fecha, agregador: 'rushour', plataforma, marca: 'Streat Lab', turno: 'dia',
      pedidos: volumen, bruto: turnover, neto: null,
      ticket_medio: turnover && volumen ? turnover / volumen : null,
    });
    await logRobot('rushour_backfill', 'ok', `fecha=${fecha} plataforma=${plataforma} turnover=${turnover} volumen=${volumen}`);
  }
  return filas;
}

// Sesión Rushour reutilizada entre días (un solo login+goto /rapports); solo
// se vuelve a abrir si expira (el select de fecha deja de estar presente).
let paginaRushour: Page | null = null;
async function asegurarSesionRushour(browser: Browser): Promise<Page> {
  if (paginaRushour && !paginaRushour.isClosed()) {
    const sigueEnRapports = await paginaRushour.locator(RUSHOUR.selFecha).first().count().catch(() => 0);
    if (sigueEnRapports) return paginaRushour;
    await logRobot('rushour_backfill', 'sesion_expirada', 're-logueando en Rushour');
    await paginaRushour.close().catch(() => {});
  }
  paginaRushour = await loginYAbrirRapports(browser);
  return paginaRushour;
}

function leerCursor(): string | null {
  if (!existsSync(CURSOR_PATH)) return null;
  const s = readFileSync(CURSOR_PATH, 'utf-8').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
function guardarCursor(fecha: string) {
  writeFileSync(CURSOR_PATH, fecha, 'utf-8');
}

// ───────────────────────────── SINQRO ─────────────────────────────────────
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
// antes de que la lista se recargara. NO TOCAR sin volcar HTML real primero.
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

    if (!pedidos.length) {
      await logRobot('sinqro_backfill', 'vacio', `fecha=${fecha} pedidos_leidos=0`);
      await volcarHtmlDebug('sinqro_hist_vacio', fecha, await page.content());
      return [];
    }

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

// ─────────────────────── Modo debug (volcado puntual) ─────────────────────
// Vuelca el HTML real de Rushour /rapports tras fijar fecha+plataforma, para
// inspeccionar selectores sin adivinar a ciegas si algo diverge del gate de humo.
async function debugRushourReports(browser: Browser, fecha: string): Promise<void> {
  if (!RUSHOUR.user || !RUSHOUR.pass) { await logRobot('backfill_debug', 'error', 'rushour_reports sin credenciales'); return; }
  const erroresJs: string[] = [];
  try {
    const page = await loginYAbrirRapports(browser);
    page.on('pageerror', (e) => erroresJs.push(`pageerror:${e.message}`));
    page.on('console', (msg) => { if (msg.type() === 'error') erroresJs.push(`console:${msg.text()}`); });

    await elegirCustomRange(page);
    await page.waitForTimeout(1500);
    await fijarDiaUnicoRapports(page, fecha);
    const html = await page.content();
    await volcarHtmlDebug('rushour_reports_debug', fecha, html);
    const err = erroresJs.length ? ` js_errores=${erroresJs.length} :: ${erroresJs.slice(0, 3).join(' | ').slice(0, 400)}` : ' js_errores=0';
    await logRobot('backfill_debug', 'ok', `rushour_reports volcado fecha=${fecha} bytes=${html.length}${err}`);
    await page.close();
  } catch (e: any) {
    await logRobot('backfill_debug', 'error', `rushour_reports fecha=${fecha} ${String(e?.message || e)}`);
  }
}

// Volcado de diagnóstico Sinqro: aplica el filtro de fecha (mismo fix que el
// backfill real) y guarda el HTML completo del resultado en `robot_debug`.
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
    const fechas = debugFecha.split(',').map((s) => s.trim()).filter(Boolean);
    await logRobot('backfill', 'debug_inicio', `volcado html fechas=${fechas.join(',')}`);
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    try {
      for (const f of fechas) {
        await debugRushourReports(browser, f);
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

      let rush: Fila[] = [];
      try {
        const paginaRush = await asegurarSesionRushour(browser);
        rush = await ingestaRushourReports(paginaRush, fecha);
      } catch (e: any) {
        await logRobot('rushour_backfill', 'error', `fecha=${fecha} ${String(e?.message || e)}`);
      }

      const filas: Fila[] = [...rush, ...sinq];

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
    if (paginaRushour && !paginaRushour.isClosed()) await paginaRushour.close().catch(() => {});
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
