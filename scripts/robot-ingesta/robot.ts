/**
 * Robot de ingesta diaria · Rushour + Sinqro → Supabase
 * ------------------------------------------------------
 * Descarga ventas del día anterior por marca/plataforma y las deja en
 * `ingesta_robot_diaria` (NO toca tablas de conciliación).
 *
 * CALIBRACIÓN (2026-07-03) con HTML real:
 *   RUSHOUR: manager.rushour.io/login · input[name=username]/password · "Log In".
 *            Panel "Real-time view" es SPA de tarjetas con €.
 *   SINQRO:  app.sinqro.com · #login-email/#login-password/#loginButton.
 *            Historial ventas #/sp/6416/online/orders EXIGE marcar tipo de pedido:
 *            checkboxes #deliveryFilter #collectionFilter #insideFilter
 *            #insituFilter #reservationFilter, fechas #startDateFilter
 *            #endDateFilter, y pulsar "Buscar". Sin marcar tipo → "Selecciona
 *            como mínimo un tipo de pedido" y 0 resultados.
 */

import { chromium, Browser, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const DIAG = process.env.DIAG === '1';
const ART_DIR = './robot-artifacts';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function ayer(): string {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
// Sinqro datepicker usa formato dd/mm/yyyy
function ddmmyyyy(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function ensureArtDir() { if (!existsSync(ART_DIR)) mkdirSync(ART_DIR, { recursive: true }); }
async function diag(page: Page, etiqueta: string) {
  if (!DIAG) return;
  ensureArtDir();
  try {
    await page.screenshot({ path: `${ART_DIR}/${etiqueta}.png`, fullPage: true });
    writeFileSync(`${ART_DIR}/${etiqueta}.html`, await page.content());
    console.log(`  · diagnóstico: ${etiqueta}`);
  } catch {}
}
function numero(txt: string | null | undefined): number | null {
  if (!txt) return null;
  const n = parseFloat(txt.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

type Fila = {
  fecha: string; agregador: string; plataforma: string; marca: string;
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

// ---------- RUSHOUR ----------
async function ingestaRushour(browser: Browser, fecha: string): Promise<Fila[]> {
  if (!RUSHOUR.user || !RUSHOUR.pass) { console.warn('  ⚠ rushour: sin credenciales.'); return []; }
  const page = await browser.newPage();
  try {
    console.log('→ rushour: login…');
    await page.goto(RUSHOUR.loginUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await diag(page, 'rushour-01-login');
    await page.waitForSelector(RUSHOUR.userInput, { timeout: 15000 });
    await page.fill(RUSHOUR.userInput, RUSHOUR.user);
    await page.fill(RUSHOUR.passInput, RUSHOUR.pass);
    await Promise.all([page.waitForLoadState('networkidle').catch(() => {}), page.click(RUSHOUR.submitBtn)]);
    await page.waitForTimeout(4000);
    // Cerrar posible modal promocional.
    await page.getByRole('button', { name: /close|cerrar/i }).first().click().catch(() => {});
    await page.waitForTimeout(1000);
    await diag(page, 'rushour-02-postlogin');

    // Real-time view: KPIs de cabecera (Turnover / Volume of orders) + tarjetas.
    const texto = await page.evaluate(() => document.body.innerText).catch(() => '');
    const turnover = numero((texto.match(/([\d.,]+)\s*€/) || [])[1]);
    const volumen = numero((texto.match(/orders?\s*[\r\n]+\s*([\d.,]+)/i) || [])[1]);
    await diag(page, 'rushour-03-report');

    if (turnover == null && volumen == null) {
      ensureArtDir(); writeFileSync(`${ART_DIR}/rushour-EMPTY.html`, await page.content());
      console.warn('  ⚠ rushour: no se leyeron KPIs (revisar rushour-EMPTY.html).');
      return [];
    }
    // El panel muestra "ubereats, glovo" combinados; se guarda como fila agregada.
    console.log(`  ✓ rushour: turnover=${turnover} volumen=${volumen}`);
    return [{
      fecha, agregador: 'rushour', plataforma: 'uber_glovo', marca: 'Streat Lab',
      pedidos: volumen, bruto: turnover, neto: null,
      ticket_medio: turnover && volumen ? turnover / volumen : null,
    }];
  } catch (e: any) {
    console.error(`  ✗ rushour: ${e?.message || e}`);
    await diag(page, 'rushour-ERROR');
    return [];
  } finally { await page.close(); }
}

// ---------- SINQRO ----------
async function ingestaSinqro(browser: Browser, fecha: string): Promise<Fila[]> {
  if (!SINQRO.user || !SINQRO.pass) { console.warn('  ⚠ sinqro: sin credenciales.'); return []; }
  const page = await browser.newPage();
  try {
    console.log('→ sinqro: login…');
    await page.goto(SINQRO.loginUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await diag(page, 'sinqro-01-login');
    await page.waitForSelector(SINQRO.userInput, { timeout: 15000 });
    await page.fill(SINQRO.userInput, SINQRO.user);
    await page.fill(SINQRO.passInput, SINQRO.pass);
    await Promise.all([page.waitForLoadState('networkidle').catch(() => {}), page.click(SINQRO.submitBtn)]);
    await page.waitForTimeout(3000);
    await diag(page, 'sinqro-02-postlogin');

    await page.goto(SINQRO.ventasUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);

    // 1) Marcar TODOS los tipos de pedido (obligatorio para que el buscador funcione).
    for (const sel of SINQRO.tipoChecks) {
      const chk = page.locator(sel).first();
      if (await chk.count()) { await chk.check().catch(() => chk.click().catch(() => {})); }
    }
    // 2) Rango de fechas = ayer (formato dd/mm/yyyy del datepicker).
    const f = ddmmyyyy(fecha);
    const sd = page.locator(SINQRO.startDate).first();
    const ed = page.locator(SINQRO.endDate).first();
    if (await sd.count()) { await sd.fill(f).catch(() => {}); await page.keyboard.press('Escape').catch(() => {}); }
    if (await ed.count()) { await ed.fill(f).catch(() => {}); await page.keyboard.press('Escape').catch(() => {}); }
    // 3) Buscar.
    await page.getByRole('button', { name: /buscar/i }).first().click().catch(() => {});
    await page.waitForTimeout(4000);
    await diag(page, 'sinqro-03-report');

    // 4) Leer filas de la tabla de resultados.
    const filas = await page.$$eval('table tbody tr', (trs) =>
      trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent || '').trim())).filter(c => c.length)
    ).catch(() => [] as string[][]);

    if (!filas.length) {
      ensureArtDir(); writeFileSync(`${ART_DIR}/sinqro-EMPTY.html`, await page.content());
      console.warn('  ⚠ sinqro: 0 filas (sin ventas ayer o estructura distinta; revisar sinqro-EMPTY.html).');
      return [];
    }
    const out: Fila[] = filas.map((cols) => {
      const joined = cols.join(' | ').toLowerCase();
      const plataforma = /glovo/.test(joined) ? 'glovo' : /just|justeat/.test(joined) ? 'just_eat' : /uber/.test(joined) ? 'uber_eats' : 'desconocida';
      return {
        fecha, agregador: 'sinqro', plataforma, marca: cols[0] || 'desconocida',
        pedidos: 1, bruto: numero(cols.find((c) => /€/.test(c))), neto: null, ticket_medio: null,
      };
    });
    console.log(`  ✓ sinqro: ${out.length} filas`);
    return out;
  } catch (e: any) {
    console.error(`  ✗ sinqro: ${e?.message || e}`);
    await diag(page, 'sinqro-ERROR');
    return [];
  } finally { await page.close(); }
}

// ---------- Guardar ----------
async function guardar(filas: Fila[]) {
  if (!filas.length) { console.log('Nada que guardar.'); return; }
  if (!SUPABASE_URL || !SUPABASE_KEY) { console.warn('⚠ Faltan credenciales Supabase.'); return; }
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { error } = await sb.from('ingesta_robot_diaria').upsert(filas, { onConflict: 'fecha,agregador,plataforma,marca' });
  if (error) { console.error('✗ Error Supabase:', error.message); process.exitCode = 1; }
  else console.log(`✓ Guardadas ${filas.length} filas.`);
}

async function main() {
  const fecha = ayer();
  console.log(`== Robot ingesta diaria · fecha=${fecha} · DIAG=${DIAG ? 'on' : 'off'} ==`);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const rush = await ingestaRushour(browser, fecha);
    const sinq = await ingestaSinqro(browser, fecha);
    await guardar([...rush, ...sinq]);
  } finally { await browser.close(); }
  console.log('== Fin ==');
}
main().catch((e) => { console.error(e); process.exit(1); });
