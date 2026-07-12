/**
 * SOLD_PRODUCTS (panel.sinqro.com) · UNA LÍNEA POR PRODUCTO DE CADA PEDIDO.
 *   panel.sinqro.com/selling_point_accounts/3976805/reports → SOLD_PRODUCTS → Ver
 *
 * Qué devuelve el informe (comprobado el 12-jul-2026, 2.714 filas):
 *   ID | CODE | TYPE | MARKET | ADDRESS | ADDRESS DETAILS | PHONE | QUANTITY |
 *   DESCRIPTION | PAYMENT METHOD | CASH PAYMENTS | CREATION TIME |
 *   TOTAL LINE PRICE | TOTAL PRODUCTS | TOTAL ORDER
 *
 * Cobertura: Glovo y JustEat. Uber Eats NO pasa por Sinqro (0 apariciones) →
 * los platos de Uber vienen de su propio informe, no de aquí.
 * Alcance del informe: mes en curso + mes anterior.
 *
 * Clasificación de cada línea (TOTAL LINE PRICE):
 *   < 0  → 'promo'        (línea "Promos", el descuento aplicado)
 *   = 0  → 'modificador'  (guarnición/opción incluida, p.ej. "PURÉ PARMENTIER..")
 *   > 0  → 'producto'     (plato de carta o extra de pago)
 * Solo 'producto' cuenta como venta de plato. Contar los modificadores como
 * platos es lo que inflaba las unidades al doble en la carga anterior.
 *
 * El panel es AngularJS: los inputs usan ng-model y un fill() directo deja el
 * formulario "pristine" → hay que escribir tecla a tecla. El botón de acceso es
 * #login-submit con ng-click, no un submit.
 */
import { chromium, Page, BrowserContext } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const PANEL = 'https://panel.sinqro.com/';
const REPORTS_URL = 'https://panel.sinqro.com/selling_point_accounts/3976805/reports';
const HOY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
const SOLO_LEER = process.env.SOLD_DRY === '1';

type Linea = {
  pedido_id: string; codigo: string | null; canal: string; fecha: string; hora: number;
  creado_en: string; producto: string; cantidad: number; precio_linea: number;
  total_productos: number | null; total_pedido: number | null; tipo: string; origen: string;
};

async function log(estado: string, detalle: string) {
  try { await sb.from('robot_log').insert([{ fuente: 'sold_products', estado, detalle }]); } catch { /* noop */ }
}
async function volcar(fuente: string, page: Page) {
  try {
    const html = await page.content();
    await sb.from('robot_debug').insert([{ fuente, fecha: HOY, html }]);
    await log('dump', `${fuente} bytes=${html.length} url=${page.url()}`);
  } catch (e: any) { await log('dump_error', String(e?.message || e)); }
}
function num(s: string): number {
  const t = (s || '').replace(/[^\d,.\-]/g, '');
  if (!t) return 0;
  let x = t;
  const up = x.lastIndexOf('.'), uc = x.lastIndexOf(',');
  if (uc > up) x = x.replace(/\./g, '').replace(',', '.'); else x = x.replace(/,/g, '');
  return parseFloat(x) || 0;
}
function canalDe(market: string): string {
  const m = (market || '').toLowerCase();
  if (m.includes('glovo')) return 'glovo';
  if (m.includes('just')) return 'justeat';
  if (m.includes('uber')) return 'uber';
  return m.trim() || 'otro';
}

async function escribirNg(page: Page, sel: string, valor: string) {
  const el = page.locator(sel).first();
  await el.waitFor({ state: 'visible', timeout: 20000 });
  await el.click({ timeout: 5000 }).catch(() => {});
  await el.fill('').catch(() => {});
  await el.pressSequentially(valor, { delay: 40 });
  await el.dispatchEvent('input').catch(() => {});
  await el.dispatchEvent('change').catch(() => {});
  await el.dispatchEvent('blur').catch(() => {});
}
async function login(page: Page): Promise<boolean> {
  await page.goto(PANEL, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);
  if (!(await page.locator('#login-email').count().catch(() => 0))) return true;
  await escribirNg(page, '#login-email', process.env.SINQRO_USER || '');
  await escribirNg(page, '#login-password', process.env.SINQRO_PASS || '');
  await page.locator('#login-submit').first().click({ timeout: 10000 }).catch(() => {});
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);
    if (!/\/login/.test(page.url()) && !(await page.locator('#login-email').count().catch(() => 0))) break;
  }
  const dentro = !/\/login/.test(page.url()) && !(await page.locator('#login-email').count().catch(() => 0));
  await log(dentro ? 'login_ok' : 'login_ko', `url=${page.url()}`);
  if (!dentro) await volcar('sold_login_ko', page);
  return dentro;
}

/** Índice de cada columna a partir de las cabeceras (no fío del orden). */
async function mapaColumnas(p: Page): Promise<Record<string, number>> {
  const ths = p.locator('table th');
  const n = await ths.count().catch(() => 0);
  const idx: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const t = ((await ths.nth(i).textContent().catch(() => '')) || '').trim().toUpperCase();
    if (t) idx[t] = i;
  }
  return idx;
}

async function leerLineas(p: Page): Promise<Linea[]> {
  const col = await mapaColumnas(p);
  const nec = ['ID', 'MARKET', 'QUANTITY', 'DESCRIPTION', 'CREATION TIME', 'TOTAL LINE PRICE'];
  const faltan = nec.filter((c) => col[c] === undefined);
  if (faltan.length) { await log('error', `faltan columnas: ${faltan.join(', ')} · hay: ${Object.keys(col).join(' | ')}`); return []; }

  const trs = p.locator('table tbody tr');
  const n = await trs.count().catch(() => 0);
  await log('filas', `${n} filas en el informe`);
  const out: Linea[] = [];
  for (let i = 0; i < n; i++) {
    const tds = trs.nth(i).locator('td');
    if ((await tds.count().catch(() => 0)) < 6) continue;
    const val = async (c: string) => ((await tds.nth(col[c]).textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();

    const pedido_id = await val('ID');
    const producto = await val('DESCRIPTION');
    const creado = await val('CREATION TIME');
    if (!pedido_id || !producto || !creado) continue;

    const m = creado.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (!m) continue;
    const fecha = `${m[1]}-${m[2]}-${m[3]}`;
    const hora = parseInt(m[4], 10);

    const precio = num(await val('TOTAL LINE PRICE'));
    const cantidad = Math.max(num(await val('QUANTITY')) || 1, 1);
    const tipo = precio < 0 ? 'promo' : (precio === 0 ? 'modificador' : 'producto');

    out.push({
      pedido_id, codigo: col['CODE'] !== undefined ? await val('CODE') : null,
      canal: canalDe(await val('MARKET')), fecha, hora,
      creado_en: creado.replace(' ', 'T') + '+02:00',
      producto, cantidad, precio_linea: precio,
      total_productos: col['TOTAL PRODUCTS'] !== undefined ? num(await val('TOTAL PRODUCTS')) : null,
      total_pedido: col['TOTAL ORDER'] !== undefined ? num(await val('TOTAL ORDER')) : null,
      tipo, origen: 'sinqro_sold_products',
    });
  }
  return out;
}

async function guardar(lineas: Linea[]) {
  if (!lineas.length) { await log('aviso', 'sin líneas que guardar'); return; }
  const fechas = lineas.map((l) => l.fecha).sort();
  const desde = fechas[0], hasta = fechas[fechas.length - 1];
  const canales = Array.from(new Set(lineas.map((l) => l.canal)));

  // Reemplazo limpio del tramo que cubre el informe: nunca se acumula ni se duplica.
  const { error: eDel } = await sb.from('pedidos_lineas').delete()
    .gte('fecha', desde).lte('fecha', hasta).in('canal', canales).eq('origen', 'sinqro_sold_products');
  if (eDel) { await log('error', `limpiando ${desde}→${hasta}: ${eDel.message}`); return; }

  for (let i = 0; i < lineas.length; i += 500) {
    const { error } = await sb.from('pedidos_lineas').insert(lineas.slice(i, i + 500));
    if (error) { await log('error', `insert lote ${i}: ${error.message}`); return; }
  }
  const res: Record<string, number> = {};
  for (const l of lineas) res[l.tipo] = (res[l.tipo] || 0) + 1;
  await log('ok', `guardadas ${lineas.length} líneas ${desde}→${hasta} [${canales.join(',')}] · ${Object.entries(res).map(([k, v]) => `${k}=${v}`).join(' ')}`);

  // Ventas por plato: SOLO los productos. Los modificadores y las promos no son platos.
  const { error: eRpc } = await sb.rpc('fn_rehacer_ventas_plato', { p_desde: desde, p_hasta: hasta });
  if (eRpc) await log('aviso', `no pude rehacer ventas_plato: ${eRpc.message}`);
  else await log('ok', `ventas_plato reconstruido ${desde}→${hasta}`);
}

async function main() {
  await log('inicio', `SOLD_PRODUCTS carga${SOLO_LEER ? ' (solo lectura)' : ''}`);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx: BrowserContext = await browser.newContext({ acceptDownloads: true, timezoneId: 'Europe/Madrid' });
  const page = await ctx.newPage();
  try {
    if (!(await login(page))) { await log('error', 'no he podido entrar en panel.sinqro.com'); return; }

    await page.goto(REPORTS_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(6000);

    let fila = page.locator('tr').filter({ hasText: /SOLD[_ ]?PRODUCTS/i }).first();
    if (!(await fila.count().catch(() => 0))) fila = page.locator('tr').filter({ hasText: /producto.*vendid/i }).first();
    if (!(await fila.count().catch(() => 0))) { await log('error', 'no encuentro el informe SOLD_PRODUCTS'); await volcar('sold_sin_fila', page); return; }

    const ver = fila.getByRole('button', { name: /ver|view/i }).first();
    const verLink = fila.getByRole('link', { name: /ver|view/i }).first();
    const objetivo = (await ver.count().catch(() => 0)) ? ver : verLink;
    const popupProm = ctx.waitForEvent('page', { timeout: 25000 }).catch(() => null);
    await objetivo.click({ timeout: 10000 }).catch(() => {});
    const popup = await popupProm;
    const p = popup || page;
    await p.waitForLoadState('networkidle').catch(() => {});
    await p.waitForTimeout(8000);

    const lineas = await leerLineas(p);
    if (!lineas.length) { await volcar('sold_sin_lineas', p); await log('error', 'informe abierto pero sin líneas legibles'); return; }
    if (SOLO_LEER) {
      const res: Record<string, number> = {};
      for (const l of lineas) res[l.tipo] = (res[l.tipo] || 0) + 1;
      await log('simulacro', `${lineas.length} líneas · ${Object.entries(res).map(([k, v]) => `${k}=${v}`).join(' ')} · no guardo nada`);
      return;
    }
    await guardar(lineas);
    await log('fin', 'ok');
  } catch (e: any) {
    await log('error', String(e?.message || e));
    await volcar('sold_error', page);
    process.exitCode = 1;
  } finally { await browser.close(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
