/**
 * SINQRO VIVO v2 · snapshot de pedidos Just Eat del día en curso, cada ~10 min
 * durante servicio (11:00–01:00 Madrid).
 *
 * HISTORIA:
 *  - INCIDENTE 16-jul (mañana): una versión anterior escribió lecturas en 0 en
 *    `ventas_vivo` y tumbó el Panel en vivo. Guardas desde entonces (se mantienen):
 *      1. NUNCA se escribe una lectura en 0 pedidos/0€ (se descarta y se loguea).
 *      2. SOLO se escribe la fila plataforma='just_eat' (jamás una fila TOTAL
 *         propia que compita con la de Rushour, a la que el Panel ancla el vivo).
 *  - AVERÍA 16-jul (tarde): el lector antiguo (ingestaSinqro de robot.ts) empezó
 *    a devolver 0 intradía: la página carga y el login va bien, pero la búsqueda
 *    sale "No se han encontrado" (verificado en robot_debug/sinqro_vivo_dom).
 *    Causa: su marcado de filtros de tipo dejó de activar la búsqueda tras un
 *    cambio de Sinqro. El lector de sync-facturacion (datepicker real + marcado
 *    robusto de checkboxes + espera a que termine la búsqueda) SIGUE funcionando
 *    (verificado: lectura nocturna del 16-jul leyó 12 tarjetas y 3 JE).
 *  - v2 (17-jul): este robot deja de depender de robot.ts y usa el lector
 *    probado, autocontenido aquí. Con las guardas 1 y 2 activas, escribe ya en
 *    `ventas_vivo` (tabla real del Panel): una lectura buena suma, una mala se
 *    descarta sin tocar nada.
 */
import { chromium, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { hoyMadrid, log, latido } from './_lib/bandeja.js';

const P = 'sinqro_vivo';
const TABLA_VIVO = 'ventas_vivo';
const sb = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

const SINQRO = {
  loginUrl: 'https://app.sinqro.com/',
  ventasUrl: 'https://app.sinqro.com/#/sp/6416/online/orders',
  user: process.env.SINQRO_USER || '', pass: process.env.SINQRO_PASS || '',
  tipoChecks: ['#deliveryFilter', '#collectionFilter', '#insideFilter', '#insituFilter', '#reservationFilter'],
  startDate: '#startDateFilter', endDate: '#endDateFilter',
};
const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const r2 = (n: number) => Math.round(n * 100) / 100;
function numES(s: string): number {
  const m = (s || '').match(/-?\d[\d.,]*/);
  if (!m) return 0;
  let x = m[0];
  const up = x.lastIndexOf('.'), uc = x.lastIndexOf(',');
  if (uc > up) x = x.replace(/\./g, '').replace(',', '.'); else x = x.replace(/,/g, '');
  return parseFloat(x) || 0;
}

/* ---------- LECTOR PROBADO (mismo método que sync-facturacion) ---------- */
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
/** Just Eat del día: nº pedidos y bruto acumulado (todas las horas). */
async function leerJustEatDia(page: Page, fecha: string): Promise<{ pedidos: number; bruto: number; tarjetas: number }> {
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
  if (!ok1 || !ok2) { await log(P, 'error', `no pude fijar la fecha ${fecha} en el calendario`); return { pedidos: 0, bruto: 0, tarjetas: 0 }; }
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
  let pedidos = 0, bruto = 0;
  for (const t of tarjetas) {
    if (!/just\s?eat/i.test(t)) continue;
    const mE = t.match(/(\d[\d.,]*)\s*€/);
    if (!mE) continue;
    pedidos += 1;
    bruto += r2(numES(mE[1]));
  }
  await log(P, 'lectura', `${fecha} tipos=${marcados} tarjetas=${tarjetas.length} JE=${pedidos} ped / ${r2(bruto)}€`);
  return { pedidos, bruto: r2(bruto), tarjetas: tarjetas.length };
}

async function main() {
  const fecha = hoyMadrid();
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ timezoneId: 'Europe/Madrid' });
  const page = await ctx.newPage();
  try {
    const { pedidos, bruto, tarjetas } = await leerJustEatDia(page, fecha);

    // GUARDA 1: una lectura en 0 no se escribe jamás (evita repetir el incidente
    // del 16-jul). Distinguimos "sin pedidos aún" (hay tarjetas de otras
    // plataformas o simplemente 0 JE reales) de un fallo de scrape: en ambos
    // casos, con 0 no hay nada que guardar.
    if (pedidos === 0 && bruto === 0) {
      await log(P, tarjetas > 0 ? 'sin_je' : 'sospechoso', `${fecha}: 0 JE (tarjetas totales: ${tarjetas}) — no se guarda`);
      await latido(P, fecha, `0 JE (tarjetas: ${tarjetas}), nada que guardar`);
      return;
    }

    const { data: ultimo } = await sb
      .from(TABLA_VIVO)
      .select('pedidos, facturacion')
      .eq('fecha', fecha).eq('plataforma', 'just_eat').eq('marca', 'Streat Lab')
      .order('momento', { ascending: false })
      .limit(1)
      .maybeSingle();

    const cambiado = !ultimo || Number(ultimo.pedidos) !== pedidos || Number(ultimo.facturacion) !== bruto;
    if (cambiado) {
      // GUARDA 2: solo la fila plataforma='just_eat'; jamás una fila TOTAL.
      await sb.from(TABLA_VIVO).insert([{
        fecha, plataforma: 'just_eat', marca: 'Streat Lab',
        pedidos, facturacion: bruto, por_horas: null, crudo: { origen: 'sinqro_vivo_v2' },
      }]);
    }

    await log(P, 'ok', `${fecha} · pedidos=${pedidos} facturacion=${bruto} · ${cambiado ? 'guardado' : 'sin cambios'} · tabla=${TABLA_VIVO}`);
    await latido(P, fecha, `pedidos=${pedidos} facturacion=${bruto} · tabla=${TABLA_VIVO}`);
  } catch (e: any) {
    await log(P, 'error', String(e?.message || e));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
