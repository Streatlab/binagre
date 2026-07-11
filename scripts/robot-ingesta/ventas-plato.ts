/**
 * VENTAS POR PLATO · Rushour /rapports → tabla ventas_plato.
 *
 * Para un MES completo (rango personalizado del día 1 al último) y por cada
 * plataforma (glovo, ubereats) por separado, abre el detalle de "Productos
 * totales vendidos" y lee producto + unidades (+ importe si la vista lo da).
 * Guarda en ventas_plato con origen='rushour_robot'.
 *
 * Reutiliza lo YA PROBADO en producción: cierre de modales promocionales,
 * apertura de selects por teclado, Custom range clicando celdas del calendario.
 * Sin page.evaluate en Rushour (error __name).
 *
 * Si no encuentra el detalle de productos, vuelca el HTML real a robot_debug
 * y para: nunca adivina selectores.
 */
import { chromium, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

const RUSHOUR = {
  loginUrl: 'https://manager.rushour.io/login',
  rapportsUrl: 'https://manager.rushour.io/rapports',
  user: process.env.RUSHOUR_USER || '', pass: process.env.RUSHOUR_PASS || '',
  userInput: 'input[name="username"]', passInput: 'input[name="password"]', submitBtn: 'button[type="submit"]',
  selFecha: '[data-intercom-target="Select du dashboard pour changer la date"]',
  selRange: '.ant-picker-range[data-intercom-target="Calendrier du dashboard pour changer la date"]',
};

async function log(estado: string, detalle: string) {
  try { await sb.from('robot_log').insert([{ fuente: 'ventas_plato', estado, detalle }]); } catch { /* noop */ }
}
async function volcar(fuente: string, fecha: string, html: string) {
  try {
    const { error } = await sb.from('robot_debug').insert([{ fuente, fecha, html }]);
    if (error) await log('dump_error', `${fuente}: ${error.message}`);
  } catch (e: any) { await log('dump_error', String(e?.message || e)); }
}
function numES(s: string): number {
  const m = (s || '').match(/-?\d[\d.,]*/);
  if (!m) return 0;
  let x = m[0];
  const up = x.lastIndexOf('.'), uc = x.lastIndexOf(',');
  if (uc > up) x = x.replace(/\./g, '').replace(',', '.'); else x = x.replace(/,/g, '');
  return parseFloat(x) || 0;
}
function ultimoDia(anio: number, mes: number): number { return new Date(Date.UTC(anio, mes, 0)).getUTCDate(); }
function iso(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

async function cerrarModales(page: Page) {
  for (let r = 0; r < 8; r++) {
    const v = await page.locator('.ant-modal-wrap:visible').count().catch(() => 0);
    if (!v) return;
    await page.locator('.ant-modal-close:visible').first().click({ force: true, timeout: 2000 }).catch(() => {});
    const btns = page.locator('.ant-modal-wrap:visible button');
    const nb = await btns.count().catch(() => 0);
    for (let i = 0; i < nb; i++) {
      const t = ((await btns.nth(i).textContent().catch(() => '')) || '').trim();
      if (/^(close|cerrar|no,? gracias|later|más tarde)$/i.test(t)) await btns.nth(i).click({ force: true, timeout: 2000 }).catch(() => {});
    }
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(1000);
  }
}
async function abrirSelectTeclado(page: Page, loc: ReturnType<Page['locator']>) {
  await loc.locator('input').first().focus().catch(() => {});
  await page.keyboard.press('ArrowDown').catch(() => {});
  await page.waitForTimeout(1200);
  const n = await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').count().catch(() => 0);
  if (!n) { await loc.locator('.ant-select-selector').first().click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(1200); }
}
async function elegirOpcion(page: Page, re: RegExp): Promise<boolean> {
  const ops = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option');
  const n = await ops.count().catch(() => 0);
  for (let i = 0; i < n; i++) {
    const t = ((await ops.nth(i).textContent().catch(() => '')) || '').trim();
    if (re.test(t)) { await ops.nth(i).click().catch(() => {}); await page.waitForTimeout(800); return true; }
  }
  return false;
}
const MESES_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
async function navegarHasta(page: Page, fechaISO: string): Promise<boolean> {
  const anio = Number(fechaISO.slice(0, 4)), mes = Number(fechaISO.slice(5, 7));
  const panel = page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)').first();
  const celda = () => panel.locator(`td[title="${fechaISO}"]`).first();
  if (await celda().count().catch(() => 0)) return true;
  for (let i = 0; i < 40; i++) {
    const mTxt = ((await panel.locator('.ant-picker-month-btn').first().textContent().catch(() => '')) || '').trim().toLowerCase();
    const aTxt = ((await panel.locator('.ant-picker-year-btn').first().textContent().catch(() => '')) || '').trim();
    const aCur = parseInt(aTxt, 10);
    const mCur = MESES_EN.findIndex((m) => mTxt.startsWith(m)) + 1;
    if (!Number.isFinite(aCur) || mCur <= 0) break;
    if (aCur === anio && mCur === mes) break;
    const atras = aCur > anio || (aCur === anio && mCur > mes);
    await panel.locator(atras ? '.ant-picker-header-prev-btn' : '.ant-picker-header-next-btn').first().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(200);
  }
  return (await celda().count().catch(() => 0)) > 0;
}
/** Fija el rango del mes completo (día 1 → último día). */
async function fijarRangoMes(page: Page, anio: number, mes: number): Promise<boolean> {
  await abrirSelectTeclado(page, page.locator(RUSHOUR.selFecha));
  if (!(await elegirOpcion(page, /^custom range$/i))) return false;
  await page.waitForTimeout(1500);
  await cerrarModales(page);

  const ini = iso(anio, mes, 1);
  const fin = iso(anio, mes, ultimoDia(anio, mes));
  const picker = page.locator(RUSHOUR.selRange).first();
  if (!(await picker.count().catch(() => 0))) return false;
  await picker.locator('input').first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(800);

  if (!(await navegarHasta(page, ini))) return false;
  await page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)').first().locator(`td[title="${ini}"]`).first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
  if (!(await navegarHasta(page, fin))) return false;
  await page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)').first().locator(`td[title="${fin}"]`).first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape').catch(() => {});
  return true;
}
async function soloPlataforma(page: Page, objetivo: 'glovo' | 'ubereats') {
  const sel = page.locator('.ant-select-multiple').filter({ hasText: /ubereats|glovo/ }).first();
  await abrirSelectTeclado(page, sel);
  const ops = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option');
  const n = await ops.count().catch(() => 0);
  for (let i = 0; i < n; i++) {
    const t = ((await ops.nth(i).textContent().catch(() => '')) || '').trim().toLowerCase();
    const cls = (await ops.nth(i).getAttribute('class').catch(() => '')) || '';
    const sel_ = cls.includes('ant-select-item-option-selected');
    const obj = t.includes(objetivo);
    if (obj && !sel_) await ops.nth(i).click().catch(() => {});
    if (!obj && sel_) await ops.nth(i).click().catch(() => {});
    await page.waitForTimeout(400);
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(2500);
}

/** Abre el detalle de "Productos totales vendidos" y lee producto + unidades. */
async function leerProductos(page: Page, etiqueta: string): Promise<{ plato: string; unidades: number; importe: number }[]> {
  // El botón "Ver detalles" del bloque de productos vendidos
  const bloque = page.locator('div').filter({ hasText: /Productos totales vendidos|Total products sold/i }).last();
  const btn = bloque.getByRole('button', { name: /ver detalles|see details|details/i }).first();
  if (!(await btn.count().catch(() => 0))) {
    await log('sin_boton', `${etiqueta}: no encuentro "Ver detalles" de productos`);
    await volcar('ventas_plato_sin_boton', etiqueta.slice(0, 10), await page.content());
    return [];
  }
  await btn.click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(4000);

  const filas: { plato: string; unidades: number; importe: number }[] = [];
  const trs = page.locator('.ant-modal-wrap:visible tbody tr, .ant-drawer-open tbody tr, tbody tr');
  const n = await trs.count().catch(() => 0);
  for (let i = 0; i < n; i++) {
    const celdas = trs.nth(i).locator('td');
    const nc = await celdas.count().catch(() => 0);
    if (nc < 2) continue;
    const plato = ((await celdas.nth(0).textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
    if (!plato) continue;
    const textos: string[] = [];
    for (let c = 1; c < nc; c++) textos.push(((await celdas.nth(c).textContent().catch(() => '')) || '').trim());
    const conEuro = textos.find((t) => /€/.test(t)) || '';
    const sinEuro = textos.find((t) => !/€|%/.test(t) && /\d/.test(t)) || '';
    const unidades = Math.round(numES(sinEuro));
    const importe = numES(conEuro);
    if (!unidades && !importe) continue;
    filas.push({ plato, unidades, importe });
  }
  if (!filas.length) {
    await log('sin_filas', `${etiqueta}: detalle abierto pero sin filas legibles`);
    await volcar('ventas_plato_sin_filas', etiqueta.slice(0, 10), await page.content());
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(1000);
  return filas;
}

async function guardar(anio: number, mes: number, canal: string, filas: { plato: string; unidades: number; importe: number }[]) {
  if (!filas.length) return;
  const rows = filas.map((f) => ({
    canal, marca: 'Streat Lab', plato: f.plato, mes, año: anio,
    unidades: f.unidades, ingresos_brutos: f.importe || null,
    precio_medio: f.unidades && f.importe ? Math.round((f.importe / f.unidades) * 100) / 100 : null,
    estimado: false, origen: 'rushour_robot',
  }));
  // Limpia lo que este mismo robot guardó antes para ese mes/canal (idempotente)
  await sb.from('ventas_plato').delete().eq('año', anio).eq('mes', mes).eq('canal', canal).eq('origen', 'rushour_robot');
  const { error } = await sb.from('ventas_plato').insert(rows);
  if (error) { await log('error', `guardar ${anio}-${mes} ${canal}: ${error.message}`); return; }
  await log('ok', `${anio}-${String(mes).padStart(2, '0')} ${canal}: ${rows.length} platos, ${rows.reduce((a, r) => a + r.unidades, 0)} uds`);
}

async function main() {
  const meses = (process.env.VP_MESES || '2026-06').split(',').map((s) => s.trim()).filter(Boolean);
  await log('inicio', `meses=${meses.join(',')}`);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  try {
    await page.goto(RUSHOUR.loginUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(RUSHOUR.userInput, { timeout: 20000 });
    await page.fill(RUSHOUR.userInput, RUSHOUR.user);
    await page.fill(RUSHOUR.passInput, RUSHOUR.pass);
    await Promise.all([page.waitForLoadState('networkidle').catch(() => {}), page.click(RUSHOUR.submitBtn)]);
    await page.waitForTimeout(5000);

    for (const m of meses) {
      const anio = Number(m.slice(0, 4)), mes = Number(m.slice(5, 7));
      for (const plat of ['glovo', 'ubereats'] as const) {
        await page.goto(RUSHOUR.rapportsUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(8000);
        await cerrarModales(page);

        if (!(await fijarRangoMes(page, anio, mes))) {
          await log('error', `no pude fijar el rango de ${m}`);
          await volcar('ventas_plato_sin_rango', iso(anio, mes, 1), await page.content());
          continue;
        }
        await cerrarModales(page);
        await soloPlataforma(page, plat);
        await cerrarModales(page);

        const filas = await leerProductos(page, `${m} ${plat}`);
        await guardar(anio, mes, plat === 'ubereats' ? 'uber_eats' : 'glovo', filas);
      }
    }
    await log('fin', 'ok');
  } catch (e: any) {
    await log('error', String(e?.message || e));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
