/**
 * Robot de ingesta diaria · Rushour + Sinqro → Supabase
 * ------------------------------------------------------
 * Descarga ventas del día anterior por marca/plataforma y las deja en
 * `ingesta_robot_diaria`. También vuelca cada pedido de Sinqro como línea POS
 * en `pos_pedidos` (origen=sinqro) para el tablero e informes del POS.
 *
 * CALIBRACIÓN (2026-07-03) con HTML real:
 *   RUSHOUR: manager.rushour.io/login · input[name=username]/password · "Log In".
 *            Panel "Real-time view": KPIs Turnover / Volume of orders.
 *   SINQRO:  app.sinqro.com · #login-email/#login-password/#loginButton.
 *            Historial #/sp/6416/online/orders: marcar tipos de pedido
 *            (#deliveryFilter … #reservationFilter) + fechas dd/mm/yyyy
 *            (#startDateFilter/#endDateFilter) + "Buscar".
 *            Cada pedido = div.listItem.orders con:
 *              .orderNumberBox  "Pedido #88444232 (203 | 101705964155)"
 *              .orderCurrentStatusBox  "FINALIZADO"
 *              .orderClientBox  nombre cliente ("JustEat Client" ⇒ Just Eat)
 *              .orderAmountBox  "36.55 €"
 */

import { chromium, Browser, Page } from 'playwright';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const DIAG = process.env.DIAG === '1';
const ART_DIR = './robot-artifacts';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function ayer(): string { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); }
function ddmmyyyy(iso: string): string { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }
function ensureArtDir() { if (!existsSync(ART_DIR)) mkdirSync(ART_DIR, { recursive: true }); }
async function diag(page: Page, etiqueta: string) {
  if (!DIAG) return; ensureArtDir();
  try { await page.screenshot({ path: `${ART_DIR}/${etiqueta}.png`, fullPage: true }); writeFileSync(`${ART_DIR}/${etiqueta}.html`, await page.content()); console.log(`  · diagnóstico: ${etiqueta}`); } catch {}
}
function numero(txt: string | null | undefined): number | null {
  if (!txt) return null;
  const n = parseFloat(txt.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

type Fila = { fecha: string; agregador: string; plataforma: string; marca: string; pedidos: number | null; bruto: number | null; neto: number | null; ticket_medio: number | null; };
type PedidoSinqro = { ref: string; plataforma: string; cliente: string; estado: string; importe: number | null };

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
    await page.getByRole('button', { name: /close|cerrar/i }).first().click().catch(() => {});
    await page.waitForTimeout(1000);
    await diag(page, 'rushour-02-postlogin');

    const texto = await page.evaluate(() => document.body.innerText).catch(() => '');
    const turnover = numero((texto.match(/([\d.,]+)\s*€/) || [])[1]);
    const volumen = numero((texto.match(/orders?\s*[\r\n]+\s*([\d.,]+)/i) || [])[1]);
    await diag(page, 'rushour-03-report');

    if (turnover == null && volumen == null) {
      ensureArtDir(); writeFileSync(`${ART_DIR}/rushour-EMPTY.html`, await page.content());
      console.warn('  ⚠ rushour: no se leyeron KPIs.'); return [];
    }
    console.log(`  ✓ rushour: turnover=${turnover} volumen=${volumen}`);
    return [{ fecha, agregador: 'rushour', plataforma: 'uber_glovo', marca: 'Streat Lab', pedidos: volumen, bruto: turnover, neto: null, ticket_medio: turnover && volumen ? turnover / volumen : null }];
  } catch (e: any) {
    console.error(`  ✗ rushour: ${e?.message || e}`); await diag(page, 'rushour-ERROR'); return [];
  } finally { await page.close(); }
}

// ---------- SINQRO ----------
async function ingestaSinqro(browser: Browser, fecha: string): Promise<{ filas: Fila[]; pedidos: PedidoSinqro[] }> {
  if (!SINQRO.user || !SINQRO.pass) { console.warn('  ⚠ sinqro: sin credenciales.'); return { filas: [], pedidos: [] }; }
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
    for (const sel of SINQRO.tipoChecks) {
      const chk = page.locator(sel).first();
      if (await chk.count()) await chk.check().catch(() => chk.click().catch(() => {}));
    }
    const f = ddmmyyyy(fecha);
    const sd = page.locator(SINQRO.startDate).first();
    const ed = page.locator(SINQRO.endDate).first();
    if (await sd.count()) { await sd.fill(f).catch(() => {}); await page.keyboard.press('Escape').catch(() => {}); }
    if (await ed.count()) { await ed.fill(f).catch(() => {}); await page.keyboard.press('Escape').catch(() => {}); }
    await page.getByRole('button', { name: /buscar/i }).first().click().catch(() => {});
    await page.waitForTimeout(4000);
    await diag(page, 'sinqro-03-report');

    // Leer cada tarjeta .listItem.orders
    const pedidos: PedidoSinqro[] = await page.$$eval('.listItem.orders', (cards) =>
      cards.map((c) => {
        const q = (sel: string) => (c.querySelector(sel)?.textContent || '').replace(/\s+/g, ' ').trim();
        const numBox = q('.orderNumberBox');
        const cliente = q('.orderClientBox');
        const estado = q('.orderCurrentStatusBox');
        const amount = q('.orderAmountBox');
        const ref = (numBox.match(/#(\d+)/) || [])[1] || numBox;
        return { ref, cliente, estado, amount };
      })
    ).catch(() => [] as { ref: string; cliente: string; estado: string; amount: string }[]);

    if (!pedidos.length) {
      ensureArtDir(); writeFileSync(`${ART_DIR}/sinqro-EMPTY.html`, await page.content());
      console.warn('  ⚠ sinqro: 0 tarjetas (sin ventas en la fecha o estructura distinta).');
      return { filas: [], pedidos: [] };
    }

    const mapped: PedidoSinqro[] = pedidos.map((p) => {
      const cl = (p.cliente || '').toLowerCase();
      const plataforma = /justeat|just eat/.test(cl) ? 'just_eat' : /glovo/.test(cl) ? 'glovo' : /uber/.test(cl) ? 'uber_eats' : 'web';
      return { ref: p.ref, plataforma, cliente: p.cliente, estado: p.estado, importe: numero(p.amount) };
    });

    // Agregado por plataforma para ingesta_robot_diaria
    const agg = new Map<string, { n: number; bruto: number }>();
    mapped.forEach((p) => { const e = agg.get(p.plataforma) || { n: 0, bruto: 0 }; e.n += 1; e.bruto += p.importe || 0; agg.set(p.plataforma, e); });
    const filas: Fila[] = Array.from(agg.entries()).map(([plataforma, e]) => ({
      fecha, agregador: 'sinqro', plataforma, marca: 'Streat Lab',
      pedidos: e.n, bruto: e.bruto, neto: null, ticket_medio: e.n ? e.bruto / e.n : null,
    }));
    console.log(`  ✓ sinqro: ${mapped.length} pedidos · ${filas.length} plataformas`);
    return { filas, pedidos: mapped };
  } catch (e: any) {
    console.error(`  ✗ sinqro: ${e?.message || e}`); await diag(page, 'sinqro-ERROR');
    return { filas: [], pedidos: [] };
  } finally { await page.close(); }
}

// ---------- Guardar ----------
async function guardarAgregado(sb: SupabaseClient, filas: Fila[]) {
  if (!filas.length) { console.log('Agregado: nada que guardar.'); return; }
  const { error } = await sb.from('ingesta_robot_diaria').upsert(filas, { onConflict: 'fecha,agregador,plataforma,marca' });
  if (error) { console.error('✗ ingesta_robot_diaria:', error.message); process.exitCode = 1; }
  else console.log(`✓ ingesta_robot_diaria: ${filas.length} filas.`);
}
async function guardarPedidosPOS(sb: SupabaseClient, pedidos: PedidoSinqro[]) {
  if (!pedidos.length) return;
  const rows = pedidos.map((p) => ({
    origen: 'sinqro', pedido_ref: p.ref,
    canal: p.plataforma === 'just_eat' ? 'je' : p.plataforma === 'glovo' ? 'glovo' : p.plataforma === 'uber_eats' ? 'uber' : 'web',
    marca: 'Streat Lab', cliente_nombre: p.cliente,
    estado: /finaliz|entreg/i.test(p.estado) ? 'entregado' : 'nuevo',
    cobrado: /finaliz|entreg/i.test(p.estado), metodo_pago: 'plataforma',
    items: [], total: p.importe || 0,
  }));
  const { error } = await sb.from('pos_pedidos').upsert(rows, { onConflict: 'origen,pedido_ref', ignoreDuplicates: true });
  if (error) console.error('✗ pos_pedidos (sinqro):', error.message);
  else console.log(`✓ pos_pedidos: ${rows.length} pedidos sinqro volcados al POS.`);
}

async function main() {
  const fecha = ayer();
  console.log(`== Robot ingesta diaria · fecha=${fecha} · DIAG=${DIAG ? 'on' : 'off'} ==`);
  if (!SUPABASE_URL || !SUPABASE_KEY) console.warn('⚠ Sin credenciales Supabase: no se guardará.');
  const sb = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const rush = await ingestaRushour(browser, fecha);
    const { filas: sinqFilas, pedidos: sinqPedidos } = await ingestaSinqro(browser, fecha);
    if (sb) {
      await guardarAgregado(sb, [...rush, ...sinqFilas]);
      await guardarPedidosPOS(sb, sinqPedidos);
    }
  } finally { await browser.close(); }
  console.log('== Fin ==');
}
main().catch((e) => { console.error(e); process.exit(1); });
