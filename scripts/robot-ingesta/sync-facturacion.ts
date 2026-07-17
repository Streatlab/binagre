/**
 * SYNC FACTURACIÓN · robot → tabla facturacion_diario (módulo Facturación del ERP).
 *
 * Fuentes (las lee él mismo, no depende de otros robots):
 *  - Rushour /rapports → Uber Eats y Glovo por separado. Usa los presets
 *    Today / Yesterday, así que el navegador DEBE ir en hora de Madrid (con UTC,
 *    "Today" a la 01:00 devuelve el día anterior y los datos se etiquetan mal).
 *    No se fuerza el idioma: Rushour traduciría el desplegable y los presets no
 *    se encontrarían.
 *  - Sinqro historial → Just Eat. Sinqro NO usa hoy/ayer: se le clava la fecha
 *    exacta en el calendario y se marcan TODOS los tipos de servicio (sin eso la
 *    búsqueda sale vacía). Se guarda el importe de CADA pedido (je_items), igual
 *    que el modal "Editar día" del ERP.
 *
 * Servicios del ERP (misma semántica que el modal Editar día):
 *  - ALM   = fila del almuerzo.
 *  - CENAS = fila de la cena, SOLO cena. Regla de la casa: cena = día completo − almuerzo.
 *  - TODO  = fila única de día completo (histórico enero–abril, manual).
 *  - CENAS/ALM = modo de captura del modal, no un servicio: se teclea el total del
 *    día y el ERP resta el ALM para guardar la fila CENAS. El robot hace lo mismo.
 *
 * Modos:
 *  - ALM   (cron 17:00 Madrid): fila ALM de HOY.
 *  - CENAS (cron 01:00 Madrid): fila CENAS de AYER = día completo − ALM.
 *  - DIA   (manual): rehace AYER entero (ALM + CENAS, con Uber/Glovo/Just Eat).
 *  - JE    (manual): recalcula SOLO Just Eat de un día ya guardado.
 * El turno automático se decide por hora de Madrid: 00:00–05:59 → cierre de ayer.
 *
 * CANDADO: en ejecución automática, el ALM solo se lee entre las 16:00 y las 23:59
 * de Madrid. Un disparo a deshora (p.ej. las 15:00) leería un almuerzo a medias.
 * Filas MANUALES (canal null) jamás se tocan. Filas del ROBOT (canal='plataformas') se actualizan.
 * Blindaje: una lectura incompleta nunca puede rebajar una fila que ya tenía ventas.
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
async function latido(ultimoDato: string, detalle: string) {
  try { await sb.from('robot_salud').upsert([{ fuente: 'sync_facturacion', ultima_ejecucion: new Date().toISOString(), ultimo_dato: ultimoDato, estado: 'ok', detalle }]); } catch { /* noop */ }
}

/**
 * plan-v2/T3: mientras corren en paralelo el robot.ts viejo (agregador
 * rushour/sinqro) y el corte-fórmula nuevo (agregador formula, fn_corte_turno
 * en Supabase), compara el total del día de cada uno. Si difieren más de 2€,
 * deja un log estado='divergencia' para poder decidir con datos cuándo
 * jubilar robot.ts (5 días sin divergencias).
 */
async function compararFormulaVsRobot(fecha: string) {
  try {
    const { data } = await sb.from('ingesta_robot_diaria').select('agregador, bruto').eq('fecha', fecha);
    if (!data || !data.length) return;
    const sum = (ags: string[]) => data.filter((r: any) => ags.includes(r.agregador)).reduce((a: number, r: any) => a + Number(r.bruto || 0), 0);
    const totalFormula = sum(['formula']);
    const totalRobot = sum(['rushour', 'sinqro']);
    if (totalFormula === 0 && totalRobot === 0) return; // nada que comparar todavía
    const diff = Math.round((totalFormula - totalRobot) * 100) / 100;
    if (Math.abs(diff) > 2) {
      await log('divergencia', `${fecha}: formula=${totalFormula.toFixed(2)} robot=${totalRobot.toFixed(2)} diff=${diff.toFixed(2)}`);
    } else {
      await log('cuadra', `${fecha}: formula=${totalFormula.toFixed(2)} robot=${totalRobot.toFixed(2)} diff=${diff.toFixed(2)}`);
    }
  } catch (e: any) { await log('divergencia_error', String(e?.message || e)); }
}

/**
 * plan-v2/T4: detecta pedidos aún pendientes en Rushour/Sinqro — compara lo
 * que se acaba de consolidar en facturacion_diario contra el último snapshot
 * de ventas_vivo de ese día (si el vivo vio más pedidos que los consolidados,
 * algo se quedó fuera del cierre nocturno).
 */
async function detectarPendientes(fecha: string) {
  try {
    const { data: filas } = await sb.from('facturacion_diario').select('total_pedidos').eq('fecha', fecha).is('marca_id', null);
    const totalConsolidado = (filas || []).reduce((a: number, r: any) => a + Number(r.total_pedidos || 0), 0);

    const { data: vivos } = await sb.from('ventas_vivo').select('plataforma, marca, pedidos, momento').eq('fecha', fecha).order('momento', { ascending: false });
    if (!vivos || !vivos.length) return;
    const vistos = new Set<string>();
    let totalVivo = 0;
    for (const v of vivos) {
      const clave = `${v.plataforma}|${v.marca}`;
      if (vistos.has(clave) || v.plataforma === 'TOTAL') continue;
      vistos.add(clave);
      totalVivo += Number(v.pedidos || 0);
    }
    if (totalVivo > totalConsolidado + 2) {
      await log('pendientes', `${fecha}: vivo vio ${totalVivo} pedidos, consolidado quedó en ${totalConsolidado} — revisar pedidos aún pendientes en Rushour/Sinqro`);
    }
  } catch (e: any) { await log('pendientes_error', String(e?.message || e)); }
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
type Turno = { pedidos: number; bruto: number; items: number[] };

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
/** Just Eat del día, separado por turno y con el importe de cada pedido. */
async function leerSinqro(page: Page, fecha: string): Promise<{ comida: Turno; cena: Turno }> {
  const vacio: { comida: Turno; cena: Turno } = { comida: { pedidos: 0, bruto: 0, items: [] }, cena: { pedidos: 0, bruto: 0, items: [] } };
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
  const res: { comida: Turno; cena: Turno } = { comida: { pedidos: 0, bruto: 0, items: [] }, cena: { pedidos: 0, bruto: 0, items: [] } };
  for (const t of tarjetas) {
    if (!/just\s?eat/i.test(t)) continue;
    const mh = t.match(new RegExp(`Entregar el ${dd}/${mm} a las (\\d{1,2}):(\\d{2})`, 'i')) || t.match(/a las (\d{1,2}):(\d{2})h/i);
    const mE = t.match(/(\d[\d.,]*)\s*€/);
    if (!mh || !mE) continue;
    const turno = parseInt(mh[1], 10) < 18 ? 'comida' : 'cena';
    const imp = r2(numES(mE[1]));
    res[turno].pedidos += 1;
    res[turno].bruto += imp;
    res[turno].items.push(imp);
  }
  res.comida.bruto = r2(res.comida.bruto);
  res.cena.bruto = r2(res.cena.bruto);
  await log('lectura', `sinqro ${fecha} tipos=${marcados} tarjetas=${tarjetas.length} JE=${JSON.stringify(res)}`);
  return res;
}

/* ---------- GUARDADO ---------- */
async function filaExistente(fecha: string, servicio: string) {
  const { data } = await sb.from('facturacion_diario')
    .select('id,canal,uber_pedidos,uber_bruto,glovo_pedidos,glovo_bruto,je_pedidos,je_bruto,je_items,total_bruto')
    .eq('fecha', fecha).eq('servicio', servicio).is('marca_id', null);
  return data && data.length ? data[0] : null;
}
async function guardarFila(fecha: string, servicio: 'ALM' | 'CENAS', uber: any, glovo: any, je: any, forzar = false) {
  const total_pedidos = (uber.pedidos || 0) + (glovo.pedidos || 0) + (je.pedidos || 0);
  const total_bruto = r2((uber.bruto || 0) + (glovo.bruto || 0) + (je.bruto || 0));
  const fila = {
    fecha, servicio, canal: 'plataformas',
    uber_pedidos: uber.pedidos, uber_bruto: uber.bruto,
    glovo_pedidos: glovo.pedidos, glovo_bruto: glovo.bruto,
    je_pedidos: je.pedidos, je_bruto: je.bruto, je_items: je.items || [],
    web_pedidos: 0, web_bruto: 0, directa_pedidos: 0, directa_bruto: 0,
    pedidos: total_pedidos, bruto: total_bruto, total_pedidos, total_bruto,
  };
  const previa = await filaExistente(fecha, servicio);
  if (previa && previa.canal !== 'plataformas') { await log('skip', `fila MANUAL ${fecha} ${servicio}: no la piso`); return; }
  if (!total_pedidos && !total_bruto && !previa) { await log('skip', `${fecha} ${servicio}: aún sin ventas, no creo fila vacía`); return; }
  // BLINDAJE: una lectura incompleta (web caída, sesión perdida, ejecución fuera de hora)
  // jamás puede rebajar una fila que ya tenía ventas. Solo el modo DIA (forzar) corrige a la baja.
  if (previa && !forzar && total_bruto + 0.005 < (Number(previa.total_bruto) || 0)) {
    await log('skip', `${fecha} ${servicio}: lectura ${total_bruto}€ < guardado ${previa.total_bruto}€ → no la piso`);
    return;
  }
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

/** Aplica una lectura Just Eat (comida→ALM, cena→CENAS) sobre filas ya guardadas.
 * forzar=false (automático): solo corrige AL ALZA — nunca borra un JE ya guardado
 * con una lectura peor. forzar=true (modo JE manual): pisa siempre. */
async function aplicarJustEat(fecha: string, je: any, forzar = false) {
  for (const [servicio, dato] of [['ALM', je.comida], ['CENAS', je.cena]] as const) {
    const fila = await filaExistente(fecha, servicio);
    if (!fila) { if (forzar) await log('aviso', `no hay fila ${servicio} de ${fecha}`); continue; }
    if (fila.canal !== 'plataformas') { await log('skip', `fila MANUAL ${fecha} ${servicio}: no la piso`); continue; }
    // FIX 17-jul: la lectura de Sinqro en vivo (17:00) puede salir a 0 y dejar el
    // ALM sin Just Eat; la lectura nocturna es la fiable y aquí lo repara.
    if (!forzar && r2(dato.bruto) <= (Number(fila.je_bruto) || 0)) continue;
    const uber_b = Number(fila.uber_bruto) || 0, glovo_b = Number(fila.glovo_bruto) || 0;
    const uber_p = Number(fila.uber_pedidos) || 0, glovo_p = Number(fila.glovo_pedidos) || 0;
    const total_pedidos = uber_p + glovo_p + dato.pedidos;
    const total_bruto = r2(uber_b + glovo_b + dato.bruto);
    const { error } = await sb.from('facturacion_diario').update({
      je_pedidos: dato.pedidos, je_bruto: dato.bruto, je_items: dato.items || [],
      pedidos: total_pedidos, bruto: total_bruto, total_pedidos, total_bruto,
    }).eq('id', fila.id);
    if (error) { await log('error', `JE ${fecha} ${servicio}: ${error.message}`); continue; }
    await log('ok', `JE ${fecha} ${servicio}: ${dato.pedidos} ped / ${dato.bruto}€ (total ${total_bruto}€)`);
  }
}

/** Recalcula SOLO Just Eat de un día ya guardado (modo JE manual: pisa siempre). */
async function repararJustEat(page: Page, fecha: string) {
  const je = await leerSinqro(page, fecha);
  await aplicarJustEat(fecha, je, true);
}

/**
 * Rehace AYER completo: Rushour "Yesterday" da el total del día; el ALM ya
 * guardado (leído en vivo a las 17:00) se conserva y CENAS = total − ALM,
 * exactamente igual que el modo CENAS/ALM del modal Editar día.
 * Just Eat se lee de Sinqro por su fecha exacta y se reparte por turno.
 */
async function rehacerDia(page: Page, fecha: string) {
  const rush = await leerRushour(page, /^(yesterday|ayer|hier)$/i);
  if (!rush) { await log('error', `no pude leer Rushour para ${fecha}`); return; }
  const je = await leerSinqro(page, fecha);

  const alm = await filaExistente(fecha, 'ALM');
  if (!alm) {
    await log('aviso', `sin fila ALM de ${fecha}: guardo el día completo como ALM`);
    await guardarFila(fecha, 'ALM', rush.ubereats, rush.glovo, {
      pedidos: je.comida.pedidos + je.cena.pedidos,
      bruto: r2(je.comida.bruto + je.cena.bruto),
      items: [...je.comida.items, ...je.cena.items],
    }, true);
    return;
  }
  await guardarFila(fecha, 'ALM',
    { pedidos: Number(alm.uber_pedidos) || 0, bruto: Number(alm.uber_bruto) || 0 },
    { pedidos: Number(alm.glovo_pedidos) || 0, bruto: Number(alm.glovo_bruto) || 0 },
    je.comida, true);
  const resta = (dia: any, p: any, b: any) => ({
    pedidos: Math.max((dia.pedidos || 0) - (Number(p) || 0), 0),
    bruto: r2(Math.max((dia.bruto || 0) - (Number(b) || 0), 0)),
  });
  await guardarFila(fecha, 'CENAS',
    resta(rush.ubereats, alm.uber_pedidos, alm.uber_bruto),
    resta(rush.glovo, alm.glovo_pedidos, alm.glovo_bruto),
    je.cena, true);
}

async function main() {
  const h = horaMadrid();
  const manual = process.env.SYNC_MANUAL === '1' || !!(process.env.SYNC_SERVICIO || '').trim();
  let servicio = (process.env.SYNC_SERVICIO || '').toUpperCase();
  if (!['ALM', 'CENAS', 'JE', 'DIA'].includes(servicio)) servicio = h < 6 ? 'CENAS' : 'ALM';
  const fechaObj = process.env.SYNC_FECHA
    || (servicio === 'JE' || servicio === 'DIA' ? fechaMadrid(-1)
      : servicio === 'CENAS' ? fechaMadrid(h < 6 ? -1 : 0)
      : fechaMadrid(0));
  await log('inicio', `servicio=${servicio} fecha=${fechaObj} horaMadrid=${h} manual=${manual}`);

  // CANDADO: el almuerzo automático solo se lee cuando ya ha terminado (>=16:00 Madrid).
  // Un disparo a deshora guardaría un ALM a medias y falsearía la cena de la noche.
  if (!manual && servicio === 'ALM' && h < 16) {
    await log('skip', `ALM automático a las ${h}h Madrid: aún no ha cerrado el almuerzo, no escribo`);
    return;
  }

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
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
    if (servicio === 'DIA') {
      if (fechaObj !== fechaMadrid(-1)) {
        await log('error', `DIA solo rehace AYER (${fechaMadrid(-1)}); pediste ${fechaObj}. Rushour solo expone el preset Yesterday.`);
        return;
      }
      await rehacerDia(page, fechaObj);
      return;
    }

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
        // FIX 17-jul: aunque el blindaje no pise la fila, el Just Eat leído de
        // noche (el bueno) se aplica igualmente a ALM y CENAS, solo al alza.
        await aplicarJustEat(fechaObj, je);
      } else {
        await log('aviso', `sin fila ALM de ${fechaObj}: guardo el día completo como ALM`);
        await guardarFila(fechaObj, 'ALM', rush.ubereats, rush.glovo, {
          pedidos: je.comida.pedidos + je.cena.pedidos,
          bruto: r2(je.comida.bruto + je.cena.bruto),
          items: [...je.comida.items, ...je.cena.items],
        });
      }
    }
  } catch (e: any) {
    await log('error', String(e?.message || e));
    process.exitCode = 1;
  } finally {
    await browser.close();
    await log('fin', 'sync terminado');
    await compararFormulaVsRobot(fechaObj);
    await detectarPendientes(fechaObj);
    await latido(fechaObj, `servicio=${servicio}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
