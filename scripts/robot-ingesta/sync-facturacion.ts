/**
 * SYNC FACTURACIÓN · robot → tabla facturacion_diario (módulo Facturación del ERP).
 * - Modo ALM  (17:00 Madrid): lee Rushour Reports "Today" por plataforma (glovo, ubereats)
 *   y crea la fila ALM de HOY. Just Eat sale de ingesta_robot_diaria (sinqro comida) si existe.
 * - Modo CENAS (01:00 Madrid): lee Reports "Yesterday" por plataforma (total día de AYER)
 *   y crea la fila CENAS de AYER = total día − fila ALM ya guardada. JE = sinqro cena si existe.
 * Filas MANUALES (canal null) jamás se tocan. Filas del ROBOT (canal='plataformas') se actualizan.
 * Interacciones Rushour verificadas en debug-reports v4 (modales, selects por teclado).
 * PROHIBIDO page.evaluate en Rushour (error __name): solo locators.
 */
import { chromium, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

async function log(estado: string, detalle: string) {
  try { await sb.from('robot_log').insert([{ fuente: 'sync_facturacion', estado, detalle }]); } catch { /* noop */ }
}

function fechaMadrid(offsetDias = 0): string {
  const d = new Date(Date.now() + offsetDias * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(d); // AAAA-MM-DD
}
function horaMadrid(): number {
  return parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', hour12: false }).format(new Date()), 10);
}
function numES(s: string): number {
  // Soporta "520.64" (punto decimal, formato Rushour Reports), "1.234,56" y "1,234.56"
  const m = s.match(/-?\d[\d.,]*/);
  if (!m) return 0;
  let x = m[0];
  const ultimoPunto = x.lastIndexOf('.');
  const ultimaComa = x.lastIndexOf(',');
  if (ultimaComa > ultimoPunto) x = x.replace(/\./g, '').replace(',', '.');
  else x = x.replace(/,/g, '');
  return parseFloat(x) || 0;
}
const r2 = (n: number) => Math.round(n * 100) / 100;

async function cerrarTodosLosModales(page: Page): Promise<void> {
  for (let ronda = 0; ronda < 8; ronda++) {
    const visibles = await page.locator('.ant-modal-wrap:visible').count().catch(() => 0);
    if (!visibles) return;
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
}

async function abrirSelectFecha(page: Page): Promise<void> {
  const input = page.locator('[data-intercom-target="Select du dashboard pour changer la date"] input').first();
  await input.focus().catch(() => {});
  await page.keyboard.press('ArrowDown').catch(() => {});
  await page.waitForTimeout(1200);
  const abiertas = await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').count().catch(() => 0);
  if (!abiertas) {
    await page.locator('[data-intercom-target="Select du dashboard pour changer la date"] .ant-select-selector').first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1200);
  }
}
async function elegirOpcion(page: Page, texto: RegExp): Promise<boolean> {
  const ops = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option');
  const n = await ops.count().catch(() => 0);
  for (let i = 0; i < n; i++) {
    const t = ((await ops.nth(i).textContent().catch(() => '')) || '').trim();
    if (texto.test(t)) { await ops.nth(i).click().catch(() => {}); await page.waitForTimeout(800); return true; }
  }
  return false;
}

async function leerKPIs(page: Page): Promise<{ bruto: number; pedidos: number }> {
  const rev = page.locator('[data-intercom-target="KPI revenue"]').first();
  const vol = page.locator('[data-intercom-target="KPI volume de commandes"]').first();
  let bruto = 0, pedidos = 0, prev = '';
  for (let i = 0; i < 12; i++) { // hasta ~18 s, esperando valor estable
    const t1 = ((await rev.textContent().catch(() => '')) || '').replace(/\s+/g, ' ');
    const t2 = ((await vol.textContent().catch(() => '')) || '').replace(/\s+/g, ' ');
    const cur = t1 + '||' + t2;
    if (cur === prev && t1) {
      bruto = numES(t1);
      const mv = t2.match(/\d[\d.]*/);
      pedidos = mv ? parseInt(mv[0].replace(/\./g, ''), 10) : 0;
      break;
    }
    prev = cur;
    await page.waitForTimeout(1500);
  }
  return { bruto: r2(bruto), pedidos };
}

/** Deja seleccionada SOLO la plataforma objetivo en el select multiple. */
async function soloPlataforma(page: Page, objetivo: 'glovo' | 'ubereats'): Promise<void> {
  const sel = page.locator('.ant-select-multiple').filter({ hasText: /ubereats|glovo/ }).first();
  await sel.locator('input').first().focus().catch(() => {});
  await page.keyboard.press('ArrowDown').catch(() => {});
  await page.waitForTimeout(1200);
  let ops = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option');
  if (!(await ops.count().catch(() => 0))) {
    await sel.locator('.ant-select-selector').click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1200);
    ops = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option');
  }
  const n = await ops.count().catch(() => 0);
  for (let i = 0; i < n; i++) {
    const t = ((await ops.nth(i).textContent().catch(() => '')) || '').trim().toLowerCase();
    const clase = (await ops.nth(i).getAttribute('class').catch(() => '')) || '';
    const seleccionada = clase.includes('ant-select-item-option-selected');
    const esObjetivo = t.includes(objetivo);
    if (esObjetivo && !seleccionada) await ops.nth(i).click().catch(() => {});
    if (!esObjetivo && seleccionada) await ops.nth(i).click().catch(() => {});
    await page.waitForTimeout(600);
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(1500);
}

async function leerRushourPorPlataforma(page: Page, preset: RegExp): Promise<{ glovo: { bruto: number; pedidos: number }; ubereats: { bruto: number; pedidos: number } } | null> {
  await page.goto('https://manager.rushour.io/rapports', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(8000);
  await cerrarTodosLosModales(page);
  await abrirSelectFecha(page);
  const ok = await elegirOpcion(page, preset);
  if (!ok) { await log('error', `no encontré preset de fecha ${preset}`); return null; }
  await page.waitForTimeout(3000);
  const out: any = {};
  for (const plat of ['glovo', 'ubereats'] as const) {
    await soloPlataforma(page, plat);
    out[plat] = await leerKPIs(page);
    await log('lectura', `rushour ${plat} ${JSON.stringify(out[plat])}`);
  }
  return out;
}

async function jeDesdeSinqro(fecha: string, turno: 'comida' | 'cena'): Promise<{ bruto: number; pedidos: number }> {
  try {
    const { data } = await sb.from('ingesta_robot_diaria').select('pedidos,bruto')
      .eq('fecha', fecha).eq('agregador', 'sinqro').eq('turno', turno);
    if (data && data.length) return { pedidos: Number(data[0].pedidos) || 0, bruto: r2(Number(data[0].bruto) || 0) };
  } catch { /* noop */ }
  await log('aviso', `JE sin dato sinqro para ${fecha} ${turno} → 0`);
  return { bruto: 0, pedidos: 0 };
}

async function filaExistente(fecha: string, servicio: string) {
  const { data } = await sb.from('facturacion_diario').select('id,canal,uber_pedidos,uber_bruto,glovo_pedidos,glovo_bruto,je_pedidos,je_bruto')
    .eq('fecha', fecha).eq('servicio', servicio).is('marca_id', null);
  return data && data.length ? data[0] : null;
}

async function guardarFila(fecha: string, servicio: 'ALM' | 'CENAS', uber: any, glovo: any, je: any) {
  const total_pedidos = (uber.pedidos || 0) + (glovo.pedidos || 0) + (je.pedidos || 0);
  const total_bruto = r2((uber.bruto || 0) + (glovo.bruto || 0) + (je.bruto || 0));
  const fila = {
    fecha, servicio, canal: 'plataformas',
    uber_pedidos: uber.pedidos, uber_bruto: uber.bruto,
    glovo_pedidos: glovo.pedidos, glovo_bruto: glovo.bruto,
    je_pedidos: je.pedidos, je_bruto: je.bruto,
    web_pedidos: 0, web_bruto: 0, directa_pedidos: 0, directa_bruto: 0,
    pedidos: total_pedidos, bruto: total_bruto,
    total_pedidos, total_bruto,
  };
  const previa = await filaExistente(fecha, servicio);
  if (previa && previa.canal !== 'plataformas') { await log('skip', `fila MANUAL ${fecha} ${servicio}: no la piso`); return false; }
  if (previa) {
    const { error } = await sb.from('facturacion_diario').update(fila).eq('id', previa.id);
    if (error) { await log('error', `update ${fecha} ${servicio}: ${error.message}`); return false; }
    await log('ok', `actualizada ${fecha} ${servicio} total=${total_bruto}€ / ${total_pedidos} ped`);
    return true;
  }
  const { error } = await sb.from('facturacion_diario').insert([fila]);
  if (error) { await log('error', `insert ${fecha} ${servicio}: ${error.message}`); return false; }
  await log('ok', `guardada ${fecha} ${servicio} total=${total_bruto}€ / ${total_pedidos} ped`);
  return true;
}

async function main() {
  let servicio = (process.env.SYNC_SERVICIO || '').toUpperCase();
  if (servicio !== 'ALM' && servicio !== 'CENAS') servicio = horaMadrid() < 20 ? 'ALM' : 'CENAS';
  await log('inicio', `servicio=${servicio} horaMadrid=${horaMadrid()}`);

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  try {
    await page.goto('https://manager.rushour.io/login', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[name="username"]', { timeout: 20000 });
    await page.fill('input[name="username"]', process.env.RUSHOUR_USER || '');
    await page.fill('input[name="password"]', process.env.RUSHOUR_PASS || '');
    await Promise.all([page.waitForLoadState('networkidle').catch(() => {}), page.click('button[type="submit"]')]);
    await page.waitForTimeout(5000);

    if (servicio === 'ALM') {
      const fecha = fechaMadrid(0);
      const r = await leerRushourPorPlataforma(page, /^Today$/i);
      if (!r) return;
      const je = await jeDesdeSinqro(fecha, 'comida');
      await guardarFila(fecha, 'ALM', r.ubereats, r.glovo, je);
    } else {
      // CENAS del DÍA ANTERIOR (corre a la 01:00 de Madrid)
      const fecha = horaMadrid() < 12 ? fechaMadrid(-1) : fechaMadrid(0);
      const r = await leerRushourPorPlataforma(page, /^Yesterday$/i);
      if (!r) return;
      const alm = await filaExistente(fecha, 'ALM');
      const resta = (dia: any, almP: number, almB: number) => ({
        pedidos: Math.max((dia.pedidos || 0) - (almP || 0), 0),
        bruto: r2(Math.max((dia.bruto || 0) - (almB || 0), 0)),
      });
      const je = await jeDesdeSinqro(fecha, 'cena');
      if (alm) {
        const uber = resta(r.ubereats, alm.uber_pedidos, Number(alm.uber_bruto));
        const glovo = resta(r.glovo, alm.glovo_pedidos, Number(alm.glovo_bruto));
        await guardarFila(fecha, 'CENAS', uber, glovo, je);
      } else {
        await log('aviso', `sin fila ALM de ${fecha}: guardo el DÍA COMPLETO en ALM para no perder el dato`);
        await guardarFila(fecha, 'ALM', r.ubereats, r.glovo, await jeDesdeSinqro(fecha, 'comida'));
      }
    }
  } catch (e: any) {
    await log('error', String(e?.message || e));
    process.exitCode = 1;
  } finally {
    await browser.close();
    await log('fin', 'sync terminado');
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
