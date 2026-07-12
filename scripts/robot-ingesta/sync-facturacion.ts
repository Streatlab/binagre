/**
 * SYNC FACTURACIÓN · robot → tabla facturacion_diario (módulo Facturación del ERP).
 *
 * Lee las tres fuentes él mismo (no depende de otros robots):
 *  - Rushour /rapports: Uber Eats y Glovo por separado (preset Today / Yesterday).
 *  - Sinqro historial: Just Eat, eligiendo el día en el CALENDARIO y marcando
 *    TODOS los tipos de servicio (si no, la búsqueda sale vacía).
 *
 * Turnos:
 *  - ALM   (cron 17:00 Madrid): fila ALM de HOY = lo acumulado hasta esa hora.
 *  - CENAS (cron 01:00 Madrid): fila CENAS de AYER = día completo de ayer − fila ALM de ayer.
 *  - JE    (manual): recalcula SOLO Just Eat de un día ya guardado, sin tocar Uber/Glovo.
 *
 * Bugs corregidos: navegador en hora de Madrid (si va en UTC, "Today" a la 01:00
 * devuelve el día anterior y los datos se etiquetan mal) y turno por hora de
 * Madrid (00:00–05:59 → cierre de ayer). No se fuerza el idioma: Rushour
 * traduciría el desplegable y los presets dejarían de encontrarse.
 *
 * Filas MANUALES (canal null) jamás se tocan. Filas del ROBOT (canal='plataformas') se actualizan.
 * Sin page.evaluate en Rushour (error __name).
 */
import { chromium, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

const RUSHOUR = {
  loginUrl: 'https://manager.rushour.io/login',
  rapportsUrl: 'https://manager.rushour.io/rapports',
  user: process.env.RUSHOUR_USER || '', pass: process.env.RUSHOUR_PASS || '',
  selFecha: '[data-intercom-target="Select du dashboard pour changer la date"]',
};
const SINQRO = {
  loginUrl: 'https://app.sinqro.com/',
  ventasUrl: 'https://app.sinqro.com/#/sp/6416/online/orders',
  user: process.env.SINQRO_USER || '', pass: process.env.SINQRO_PASS || '',
  tipoChecks: ['#deliveryFilter', '#collectionFilter', '#insideFilter', '#insituFilter', '#reservationFilter'],
  startDate: '#startDateFilter', endDate: '#endDateFilter',
};
const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

async function log(estado: string, detalle: string) {
  try { await sb.from('robot_log').insert([{ fuente: 'sync_facturacion', estado, detalle }]); } catch { /* noop */ }
}
function fechaMadrid(offsetDias = 0): string {
  const d = new Date(Date.now() + offsetDias * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(d);
}
function horaMadrid(): number {
  return parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', hour12: false }).format(new Date()), 10);
}
function numES(s: string): number {
  const m = (s || '').match(/-?\d[\d.,]*/);
  if (!m) return 0;
  let x = m[0];
  const up = x.lastIndexOf('.'), uc = x.lastIndexOf(',');
  if (uc > up) x = x.replace(/\./g, '').replace(',', '.'); else x = x.replace(/,/g, '');
  return parseFloat(x) || 0;
}
const r2 = (n: number) => Math.round(n * 100) / 100;

/* ---------- RUSHOUR ---------- */
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
async function abrirSelectFecha(page: Page) {
  await page.locator(`${RUSHOUR.selFecha} input`).first().focus().catch(() => {});
  await page.keyboard.press('ArrowDown').catch(() => {});
  await page.waitForTimeout(1200);
  const n = await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').count().catch(() => 0);
  if (!n) { await page.locator(`${RUSHOUR.selFecha} .ant-select-selector`).first().click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(1200); }
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
async function leerKPIs(page: Page): Promise<{ bruto: number; pedidos: number }> {
  const rev = page.locator('[data-intercom-target="KPI revenue"]').first();
  const vol = page.locator('[data-intercom-target="KPI volume de commandes"]').first();
  let bruto = 0, pedidos = 0, prev = '';
  for (let i = 0; i < 12; i++) {
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
async function soloPlataforma(page: Page, objetivo: 'glovo' | 'ubereats') {
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
    const cls = (await ops.nth(i).getAttribute('class').catch(() => '')) || '';
    const marcada = cls.includes('ant-select-item-option-selected');
    const obj = t.includes(objetivo);
    if (obj && !marcada) await ops.nth(i).click().catch(() => {});
    if (!obj && marcada) await ops.nth(i).click().catch(() => {});
    await page.waitForTimeout(500);
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(2000);
}
async function leerRushour(page: Page, preset: RegExp) {
  await page.goto(RUSHOUR.rapportsUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(8000);
  await cerrarModales(page);
  await abrirSelectFecha(page);
  if (!(await elegirOpcion(page, preset))) { await log('error', `no encontré preset ${preset}`); return null; }
  await page.waitForTimeout(3000);
  const out: any = {};
  for (const plat of ['glovo', 'ubereats'] as const) {
    await soloPlataforma(page, plat);
    out[plat] = await leerKPIs(page);
    await log('lectura', `rushour ${plat} ${JSON.stringify(out[plat])}`);
  }
  return out as { glovo: { bruto: number; pedidos: number }; ubereats: { bruto: number; pedidos: number } };
}

/* ---------- SINQRO (Just Eat) ---------- */
async function elegirFechaCalendario(page: Page, inputSel: string, fechaISO: string): Promise<boolean> {
  const anioObj = Number(fechaISO.slice(0, 4)), mesObj = Number(fechaISO.slice(5, 7)), diaObj = Number(fechaISO.slice(8, 10));
  await page.locator(inputSel).first().click({ timeout: 8000 }).catch(() => {});
  const dp = page.locator('#ui-datepicker-div');
  await dp.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  if (!(await dp.isVisible().catch(() => false))) return false;
  for (let i = 0; i < 60; i++) {
    const mesTxt = ((await dp.locator('.ui-datepicker-month').first().textContent().catch(() => '')) || '').trim().toLowerCase();
    const anioTxt = ((await dp.locator('.ui-datepicker-year').first().textContent().catch(() => '')) || '').trim();
    const anioCur = parseInt(anioTxt, 10);
    const mesCur = MESES_ES.findIndex((m) => mesTxt.startsWith(m.slice(0, 4))) + 1;
    if (!Number.isFinite(anioCur) || mesCur <= 0) return false;
    if (anioCur === anioObj && mesCur === mesObj) break;
    const atras = anioCur > anioObj || (anioCur === anioObj && mesCur > mesObj);
    await dp.locator(atras ? '.ui-datepicker-prev' : '.ui-datepicker-next').first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(250);
  }
  const celda = dp.locator(`td[data-month="${mesObj - 1}"][data-year="${anioObj}"] a`, { hasText: new RegExp(`^${diaObj}$`) }).first();
  if (!(await celda.count().catch(() => 0))) return false;
  await celda.click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
  return true;
}
async function marcarTodosLosTipos(page: Page): Promise<number> {
  let m = 0;
  for (const sel of SINQRO.tipoChecks) {
    const chk = page.locator(sel).first();
    if (!(await chk.count().catch(() => 0))) continue;
    if (!(await chk.isChecked().catch(() => false))) {
      await chk.click({ force: true, timeout: 3000 }).catch(() => {});
      if (!(await chk.isChecked().catch(() => false))) {
        await page.locator(`label[for="${sel.replace('#', '')}"]`).first().click({ force: true, timeout: 3000 }).catch(() => {});
      }
      if (!(await chk.isChecked().catch(() => false))) {
        await chk.dispatchEvent('click').catch(() => {});
        await chk.dispatchEvent('change').catch(() => {});
      }
    }
    if (await chk.isChecked().catch(() => false)) m++;
    await page.waitForTimeout(200);
  }
  return m;
}
/** Devuelve Just Eat del día separado por turno. */
async function leerSinqro(page: Page, fecha: string): Promise<{ comida: { pedidos: number; bruto: number }; cena: { pedidos: number; bruto: number } }> {
  const vacio = { comida: { pedidos: 0, bruto: 0 }, cena: { pedidos: 0, bruto: 0 } };
  if (!SINQRO.user || !SINQRO.pass) return vacio;
  await page.goto(SINQRO.loginUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  if (await page.locator('#login-email').first().count().catch(() => 0)) {
    await page.fill('#login-email', SINQRO.user).catch(() => {});
    await page.fill('#login-password', SINQRO.pass).catch(() => {});
    await Promise.all([page.waitForLoadState('networkidle').catch(() => {}), page.click('#loginButton').catch(() => {})]);
    await page.waitForTimeout(4000);
  }
  await page.goto(SINQRO.ventasUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const ok1 = await elegirFechaCalendario(page, SINQRO.startDate, fecha);
  const ok2 = await elegirFechaCalendario(page, SINQRO.endDate, fecha);
  if (!ok1 || !ok2) { await log('error', `sinqro: no pude fijar la fecha ${fecha}`); return vacio; }
  const marcados = await marcarTodosLosTipos(page);
  await page.getByRole('button', { name: /buscar/i }).first().click({ timeout: 5000 }).catch(() => {});
  const sd = page.locator(SINQRO.startDate).first();
  for (let i = 0; i < 40; i++) {
    if (!(await sd.isDisabled().catch(() => false))) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(2500);

  const texto = ((await page.locator('body').innerText().catch(() => '')) || '').replace(/\u00a0/g, ' ');
  const tarjetas = texto.split(/Pedido\s*#/).slice(1);
  const dd = fecha.slice(8, 10), mm = fecha.slice(5, 7);
  const res = { comida: { pedidos: 0, bruto: 0 }, cena: { pedidos: 0, bruto: 0 } };
  for (const t of tarjetas) {
    if (!/just\s?eat/i.test(t)) continue;
    const mh = t.match(new RegExp(`Entregar el ${dd}/${mm} a las (\\d{1,2}):(\\d{2})`, 'i')) || t.match(/a las (\d{1,2}):(\d{2})h/i);
    const mE = t.match(/(\d[\d.,]*)\s*€/);
    if (!mh || !mE) continue;
    const turno = parseInt(mh[1], 10) < 18 ? 'comida' : 'cena';
    res[turno].pedidos += 1;
    res[turno].bruto += numES(mE[1]);
  }
  res.comida.bruto = r2(res.comida.bruto);
  res.cena.bruto = r2(res.cena.bruto);
  await log('lectura', `sinqro ${fecha} tipos=${marcados} tarjetas=${tarjetas.length} JE=${JSON.stringify(res)}`);
  return res;
}

/* ---------- GUARDADO ---------- */
async function filaExistente(fecha: string, servicio: string) {
  const { data } = await sb.from('facturacion_diario')
    .select('id,canal,uber_pedidos,uber_bruto,glovo_pedidos,glovo_bruto,je_pedidos,je_bruto')
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
    pedidos: total_pedidos, bruto: total_bruto, total_pedidos, total_bruto,
  };
  const previa = await filaExistente(fecha, servicio);
  if (previa && previa.canal !== 'plataformas') { await log('skip', `fila MANUAL ${fecha} ${servicio}: no la piso`); return; }
  if (!total_pedidos && !total_bruto && !previa) { await log('skip', `${fecha} ${servicio}: aún sin ventas, no creo fila vacía`); return; }
  if (previa) {
    const { error } = await sb.from('facturacion_diario').update(fila).eq('id', previa.id);
    if (error) { await log('error', `update ${fecha} ${servicio}: ${error.message}`); return; }
    await log('ok', `actualizada ${fecha} ${servicio} total=${total_bruto}€ / ${total_pedidos} ped`);
    return;
  }
  const { error } = await sb.from('facturacion_diario').insert([fila]);
  if (error) { await log('error', `insert ${fecha} ${servicio}: ${error.message}`); return; }
  await log('ok', `guardada ${fecha} ${servicio} total=${total_bruto}€ / ${total_pedidos} ped`);
}

/** Actualiza SOLO Just Eat (comida→ALM, cena→CENAS) de un día ya guardado. */
async function repararJustEat(page: Page, fecha: string) {
  const je = await leerSinqro(page, fecha);
  for (const [servicio, dato] of [['ALM', je.comida], ['CENAS', je.cena]] as const) {
    const fila = await filaExistente(fecha, servicio);
    if (!fila) { await log('aviso', `no hay fila ${servicio} de ${fecha}`); continue; }
    if (fila.canal !== 'plataformas') { await log('skip', `fila MANUAL ${fecha} ${servicio}: no la piso`); continue; }
    const uber_b = Number(fila.uber_bruto) || 0, glovo_b = Number(fila.glovo_bruto) || 0;
    const uber_p = Number(fila.uber_pedidos) || 0, glovo_p = Number(fila.glovo_pedidos) || 0;
    const total_pedidos = uber_p + glovo_p + dato.pedidos;
    const total_bruto = r2(uber_b + glovo_b + dato.bruto);
    const { error } = await sb.from('facturacion_diario').update({
      je_pedidos: dato.pedidos, je_bruto: dato.bruto,
      pedidos: total_pedidos, bruto: total_bruto, total_pedidos, total_bruto,
    }).eq('id', fila.id);
    if (error) { await log('error', `JE ${fecha} ${servicio}: ${error.message}`); continue; }
    await log('ok', `JE ${fecha} ${servicio}: ${dato.pedidos} ped / ${dato.bruto}€ (total ${total_bruto}€)`);
  }
}

async function main() {
  const h = horaMadrid();
  let servicio = (process.env.SYNC_SERVICIO || '').toUpperCase();
  if (servicio !== 'ALM' && servicio !== 'CENAS' && servicio !== 'JE') servicio = h < 6 ? 'CENAS' : 'ALM';
  const fechaObj = process.env.SYNC_FECHA
    || (servicio === 'JE' ? fechaMadrid(-1)
      : servicio === 'CENAS' ? fechaMadrid(h < 6 ? -1 : 0)
      : fechaMadrid(0));
  await log('inicio', `servicio=${servicio} fecha=${fechaObj} horaMadrid=${h}`);

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  // Solo zona horaria: si se fuerza el idioma, Rushour traduce el desplegable
  // (Today → Hoy) y los presets dejan de encontrarse.
  const ctx = await browser.newContext({ timezoneId: 'Europe/Madrid' });
  const page = await ctx.newPage();
  try {
    if (servicio !== 'JE') {
      await page.goto(RUSHOUR.loginUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('input[name="username"]', { timeout: 20000 });
      await page.fill('input[name="username"]', RUSHOUR.user);
      await page.fill('input[name="password"]', RUSHOUR.pass);
      await Promise.all([page.waitForLoadState('networkidle').catch(() => {}), page.click('button[type="submit"]')]);
      await page.waitForTimeout(5000);
    }

    if (servicio === 'JE') { await repararJustEat(page, fechaObj); return; }

    const esHoy = fechaObj === fechaMadrid(0);
    const HOY = /^(today|hoy|aujourd'hui)$/i;
    const AYER = /^(yesterday|ayer|hier)$/i;
    const rush = await leerRushour(page, esHoy ? HOY : AYER);
    if (!rush) return;

    const je = await leerSinqro(page, fechaObj);

    if (servicio === 'ALM') {
      await guardarFila(fechaObj, 'ALM', rush.ubereats, rush.glovo, je.comida);
    } else {
      const alm = await filaExistente(fechaObj, 'ALM');
      const resta = (dia: any, p: number, b: number) => ({
        pedidos: Math.max((dia.pedidos || 0) - (p || 0), 0),
        bruto: r2(Math.max((dia.bruto || 0) - (b || 0), 0)),
      });
      if (alm) {
        await guardarFila(fechaObj, 'CENAS',
          resta(rush.ubereats, alm.uber_pedidos, Number(alm.uber_bruto)),
          resta(rush.glovo, alm.glovo_pedidos, Number(alm.glovo_bruto)),
          je.cena);
      } else {
        await log('aviso', `sin fila ALM de ${fechaObj}: guardo el día completo como ALM`);
        await guardarFila(fechaObj, 'ALM', rush.ubereats, rush.glovo, {
          pedidos: je.comida.pedidos + je.cena.pedidos,
          bruto: r2(je.comida.bruto + je.cena.bruto),
        });
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
