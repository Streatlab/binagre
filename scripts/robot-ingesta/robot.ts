/**
 * Robot de ingesta diaria · Rushour + Sinqro → Supabase
 * ------------------------------------------------------
 * Descarga ventas del día anterior por marca y plataforma y las deja en la
 * tabla de aterrizaje `ingesta_robot_diaria` (NO toca tablas de conciliación).
 *
 * ESTADO CALIBRACIÓN (2026-07-03) — login de ambos CALIBRADO con HTML real:
 *   - RUSHOUR: manager.rushour.io/login · input[name=username] / input[name=password]
 *     / button[type=submit] "Log In". Ventas: menú "Historique/Terminés" en la app —
 *     el robot navega al panel y lee las tarjetas de pedido.
 *   - SINQRO: app.sinqro.com · #login-email / #login-password / #loginButton.
 *     Ventas históricas: #/sp/6416/online/orders → hay que pulsar "Buscar" con rango
 *     de fechas; los pedidos salen como filas. El robot rellena fecha y busca.
 */

import { chromium, Browser, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const DIAG = process.env.DIAG === '1';
const ART_DIR = './robot-artifacts';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function ayer(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
function ensureArtDir() { if (!existsSync(ART_DIR)) mkdirSync(ART_DIR, { recursive: true }); }
async function diag(page: Page, etiqueta: string) {
  if (!DIAG) return;
  ensureArtDir();
  try {
    await page.screenshot({ path: `${ART_DIR}/${etiqueta}.png`, fullPage: true });
    writeFileSync(`${ART_DIR}/${etiqueta}.html`, await page.content());
    console.log(`  · diagnóstico guardado: ${etiqueta}`);
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
  nombre: 'rushour',
  loginUrl: 'https://manager.rushour.io/login',
  user: process.env.RUSHOUR_USER || '',
  pass: process.env.RUSHOUR_PASS || '',
  userInput: 'input[name="username"]',
  passInput: 'input[name="password"]',
  submitBtn: 'button[type="submit"]',
};
const SINQRO = {
  nombre: 'sinqro',
  loginUrl: 'https://app.sinqro.com/',
  user: process.env.SINQRO_USER || '',
  pass: process.env.SINQRO_PASS || '',
  userInput: '#login-email',
  passInput: '#login-password',
  submitBtn: '#loginButton',
  ventasUrl: 'https://app.sinqro.com/#/sp/6416/online/orders',
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
    await page.waitForTimeout(3500);
    await diag(page, 'rushour-02-postlogin');

    // Rushour Business Manager es una SPA de tarjetas de pedido (no tabla).
    // Se leen las tarjetas del día: nº pedido, marca/artículos e importe.
    const tarjetas = await page.$$eval('[class*="order"], [class*="commande"], [class*="card"]', (els) =>
      els.map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter((t) => /€/.test(t))
    ).catch(() => [] as string[]);
    await diag(page, 'rushour-03-report');

    if (!tarjetas.length) {
      ensureArtDir();
      writeFileSync(`${ART_DIR}/rushour-EMPTY.html`, await page.content());
      console.warn('  ⚠ rushour: 0 tarjetas de pedido leídas (revisar rushour-EMPTY.html).');
      return [];
    }
    // Cada tarjeta → una venta. Plataforma/marca se afinan tras ver datos reales.
    const filas: Fila[] = tarjetas.map((t) => ({
      fecha, agregador: 'rushour',
      plataforma: /glovo/i.test(t) ? 'glovo' : /uber/i.test(t) ? 'uber_eats' : 'desconocida',
      marca: 'desconocida',
      pedidos: 1, bruto: numero((t.match(/([\d.,]+)\s*€/) || [])[1]), neto: null, ticket_medio: null,
    }));
    console.log(`  ✓ rushour: ${filas.length} pedidos leídos`);
    return filas;
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

    // Ir a Historial de ventas, fijar rango = ayer, y buscar.
    await page.goto(SINQRO.ventasUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    // Rellenar fechas si existen los inputs (placeholder "Inicio" / "Fin").
    const inicio = page.locator('input[placeholder="Inicio"]').first();
    const fin = page.locator('input[placeholder="Fin"]').first();
    if (await inicio.count()) { await inicio.fill(fecha).catch(() => {}); }
    if (await fin.count()) { await fin.fill(fecha).catch(() => {}); }
    // Pulsar "Buscar".
    const buscar = page.getByRole('button', { name: /buscar/i }).first();
    if (await buscar.count()) { await buscar.click().catch(() => {}); await page.waitForTimeout(3000); }
    await diag(page, 'sinqro-03-report');

    const filas = await page.$$eval('table tbody tr', (trs) =>
      trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent || '').trim()))
    ).catch(() => [] as string[][]);

    if (!filas.length) {
      ensureArtDir();
      writeFileSync(`${ART_DIR}/sinqro-EMPTY.html`, await page.content());
      console.warn('  ⚠ sinqro: 0 filas (posible sin ventas ayer o tabla distinta; revisar sinqro-EMPTY.html).');
      return [];
    }
    const out: Fila[] = filas.map((cols) => ({
      fecha, agregador: 'sinqro',
      plataforma: (cols.find((c) => /glovo|just|uber/i.test(c)) || '').toLowerCase().replace(/\s+/g, '_') || 'desconocida',
      marca: cols[0] || 'desconocida',
      pedidos: 1, bruto: numero(cols.find((c) => /€/.test(c))), neto: null, ticket_medio: null,
    }));
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
