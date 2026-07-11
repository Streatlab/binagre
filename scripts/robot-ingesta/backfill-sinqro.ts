/**
 * BACKFILL SINQRO (Just Eat) · histórico, independiente de backfill.ts.
 *
 * Reglas de la pantalla "Historial de ventas" (confirmadas por Rubén y por el
 * HTML real volcado a robot_debug):
 *  1) La fecha NO se puede teclear: hay que ELEGIRLA CLICANDO en el datepicker
 *     jQuery UI (#ui-datepicker-div). Tecleándola, Sinqro responde
 *     "Oops! Algo ha fallado" y no devuelve nada.
 *  2) Hay que MARCAR TODOS los tipos de servicio (a domicilio, para recoger,
 *     en el local, reserva simple, pedido desde la mesa). Si no se marcan,
 *     la búsqueda sale vacía SIEMPRE.
 *  3) Orden: fechas → tipos → Buscar → esperar a que loadingOrders termine.
 *
 * Los pedidos de Just Eat aparecen como "JustEat Client"; los de Glovo/Uber
 * traen nombre de persona. Cada tarjeta lleva "Entregar el DD/MM a las HH:MMh".
 *
 * No toca robot.ts ni backfill.ts. Escribe en ingesta_robot_diaria
 * (agregador='sinqro', plataforma='just_eat', turno comida/cena).
 */
import { chromium, Browser, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

const SINQRO = {
  loginUrl: 'https://app.sinqro.com/',
  ventasUrl: 'https://app.sinqro.com/#/sp/6416/online/orders',
  user: process.env.SINQRO_USER || '',
  pass: process.env.SINQRO_PASS || '',
  userInput: '#login-email',
  passInput: '#login-password',
  submitBtn: '#loginButton',
  tipoChecks: ['#deliveryFilter', '#collectionFilter', '#insideFilter', '#insituFilter', '#reservationFilter'],
  startDate: '#startDateFilter',
  endDate: '#endDateFilter',
};
const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

async function log(estado: string, detalle: string) {
  try { await sb.from('robot_log').insert([{ fuente: 'sinqro_backfill2', estado, detalle }]); } catch { /* noop */ }
}
async function volcar(fuente: string, fecha: string, html: string) {
  try {
    const { error } = await sb.from('robot_debug').insert([{ fuente, fecha, html }]);
    if (error) await log('dump_error', `${fuente} ${fecha}: ${error.message}`);
  } catch (e: any) { await log('dump_error', `${fuente} ${fecha}: ${String(e?.message || e)}`); }
}
function numES(s: string): number {
  const m = (s || '').match(/-?\d[\d.,]*/);
  if (!m) return 0;
  let x = m[0];
  const up = x.lastIndexOf('.'), uc = x.lastIndexOf(',');
  if (uc > up) x = x.replace(/\./g, '').replace(',', '.'); else x = x.replace(/,/g, '');
  return parseFloat(x) || 0;
}
function diaAnterior(f: string): string {
  const d = new Date(f + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Selecciona una fecha CLICANDO en el datepicker jQuery UI (nunca tecleando). */
async function elegirFechaCalendario(page: Page, inputSel: string, fechaISO: string): Promise<boolean> {
  const anioObj = Number(fechaISO.slice(0, 4));
  const mesObj = Number(fechaISO.slice(5, 7)); // 1-12
  const diaObj = Number(fechaISO.slice(8, 10));

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

    const atras = (anioCur > anioObj) || (anioCur === anioObj && mesCur > mesObj);
    const btn = atras ? '.ui-datepicker-prev' : '.ui-datepicker-next';
    const b = dp.locator(btn).first();
    const clase = (await b.getAttribute('class').catch(() => '')) || '';
    if (clase.includes('ui-state-disabled')) return false;
    await b.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(250);
    if (i === 59) return false;
  }

  const celda = dp.locator(`td[data-month="${mesObj - 1}"][data-year="${anioObj}"] a`, { hasText: new RegExp(`^${diaObj}$`) }).first();
  if (!(await celda.count().catch(() => 0))) return false;
  await celda.click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
  return true;
}

/** Marca TODOS los tipos de servicio. Sin esto la búsqueda sale siempre vacía. */
async function marcarTodosLosTipos(page: Page): Promise<number> {
  let marcados = 0;
  for (const sel of SINQRO.tipoChecks) {
    const chk = page.locator(sel).first();
    if (!(await chk.count().catch(() => 0))) continue;
    if (!(await chk.isChecked().catch(() => false))) {
      await chk.click({ force: true, timeout: 3000 }).catch(() => {});
      if (!(await chk.isChecked().catch(() => false))) {
        const id = sel.replace('#', '');
        await page.locator(`label[for="${id}"]`).first().click({ force: true, timeout: 3000 }).catch(() => {});
      }
      if (!(await chk.isChecked().catch(() => false))) {
        await chk.dispatchEvent('click').catch(() => {});
        await chk.dispatchEvent('change').catch(() => {});
      }
    }
    if (await chk.isChecked().catch(() => false)) marcados++;
    await page.waitForTimeout(200);
  }
  return marcados;
}

async function leerDia(page: Page, fecha: string): Promise<{ pedidos: number; bruto: number; turno: 'comida' | 'cena' }[]> {
  await page.goto(SINQRO.ventasUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const okIni = await elegirFechaCalendario(page, SINQRO.startDate, fecha);
  const okFin = await elegirFechaCalendario(page, SINQRO.endDate, fecha);
  if (!okIni || !okFin) {
    await log('error', `no pude fijar fecha ${fecha} (ini=${okIni} fin=${okFin})`);
    await volcar('sinqro2_sin_fecha', fecha, await page.content());
    return [];
  }

  const marcados = await marcarTodosLosTipos(page);
  await log('info', `fecha=${fecha} tipos_marcados=${marcados}`);

  await page.getByRole('button', { name: /buscar/i }).first().click({ timeout: 5000 }).catch(() => {});
  const sd = page.locator(SINQRO.startDate).first();
  for (let i = 0; i < 40; i++) {
    const cargando = await sd.isDisabled().catch(() => false);
    if (!cargando) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(2500);

  const html = await page.content();
  if (/Oops!\s*Algo ha fallado/i.test(html)) {
    await log('error', `Sinqro respondió error de formulario en ${fecha}`);
    await volcar('sinqro2_oops', fecha, html);
    return [];
  }

  // Las tarjetas de pedido llevan siempre el texto "Pedido #<n>". Ese es el
  // ancla fiable, independientemente del ng-repeat que use la vista.
  // Se registran también otros candidatos para diagnóstico.
  const CANDIDATOS = ['[ng-repeat*="order in orders"]', '[ng-repeat*="order in"]', '.orderClientBox', '.orderAmountBox'];
  const conteos: string[] = [];
  for (const c of CANDIDATOS) conteos.push(`${c}=${await page.locator(c).count().catch(() => 0)}`);

  const texto = ((await page.locator('body').innerText().catch(() => '')) || '').replace(/\u00a0/g, ' ');
  const tarjetas = texto.split(/Pedido\s*#/).slice(1);
  await log('diag', `fecha=${fecha} tarjetas=${tarjetas.length} ${conteos.join(' ')}`);

  if (!tarjetas.length) {
    await log('vacio', `fecha=${fecha} tipos=${marcados} pantalla="${texto.replace(/\s+/g, ' ').slice(0, 300)}"`);
    await volcar('sinqro2_vacio', fecha, html);
    return [];
  }

  const dd = fecha.slice(8, 10), mm = fecha.slice(5, 7);
  const acc = new Map<'comida' | 'cena', { pedidos: number; bruto: number }>();
  let ignoradas = 0;
  for (const t of tarjetas) {
    if (!/just\s?eat/i.test(t)) continue; // Glovo/Uber vienen de Rushour (dedupe)
    // Hora de entrega del día objetivo: "Entregar el 09/07 a las 21:39h"
    const mh = t.match(new RegExp(`Entregar el ${dd}/${mm} a las (\\d{1,2}):(\\d{2})`, 'i'))
      || t.match(/a las (\d{1,2}):(\d{2})h/i);
    const mEur = t.match(/(\d[\d.,]*)\s*€/);
    if (!mh || !mEur) { ignoradas++; continue; }
    const hora = parseInt(mh[1], 10);
    const turno: 'comida' | 'cena' = hora < 18 ? 'comida' : 'cena';
    const cur = acc.get(turno) || { pedidos: 0, bruto: 0 };
    cur.pedidos += 1; cur.bruto += numES(mEur[1]);
    acc.set(turno, cur);
  }
  if (ignoradas) await log('aviso', `fecha=${fecha} tarjetas_JE_sin_hora_o_importe=${ignoradas}`);
  return Array.from(acc.entries()).map(([turno, v]) => ({ turno, pedidos: v.pedidos, bruto: Math.round(v.bruto * 100) / 100 }));
}

async function guardar(fecha: string, filas: { pedidos: number; bruto: number; turno: 'comida' | 'cena' }[]) {
  for (const f of filas) {
    const fila = {
      fecha, agregador: 'sinqro', plataforma: 'just_eat', marca: 'Streat Lab', turno: f.turno,
      pedidos: f.pedidos, bruto: f.bruto, neto: null,
      ticket_medio: f.pedidos ? Math.round((f.bruto / f.pedidos) * 100) / 100 : null,
    };
    const { error } = await sb.from('ingesta_robot_diaria')
      .upsert([fila], { onConflict: 'fecha,agregador,plataforma,marca,turno' });
    if (error) await log('error', `upsert ${fecha} ${f.turno}: ${error.message}`);
  }
  if (filas.length) await log('ok', `fecha=${fecha} filas=${filas.length}`);
}

async function main() {
  const desde = process.env.SINQRO_DESDE || '2026-07-10';
  const hasta = process.env.SINQRO_HASTA || '';
  const LIMITE_VACIOS = 12;
  await log('inicio', `desde=${desde}${hasta ? ` hasta=${hasta}` : ''}`);

  const browser: Browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  try {
    await page.goto(SINQRO.loginUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.waitForSelector(SINQRO.userInput, { timeout: 20000 });
    await page.fill(SINQRO.userInput, SINQRO.user);
    await page.fill(SINQRO.passInput, SINQRO.pass);
    await Promise.all([page.waitForLoadState('networkidle').catch(() => {}), page.click(SINQRO.submitBtn)]);
    await page.waitForTimeout(4000);

    let fecha = desde;
    let vacios = 0;
    while (vacios < LIMITE_VACIOS) {
      if (hasta && fecha < hasta) break;
      const filas = await leerDia(page, fecha);
      if (filas.length) { vacios = 0; await guardar(fecha, filas); } else { vacios++; }
      fecha = diaAnterior(fecha);
    }
    await log('fin', `parado en ${fecha} (vacios seguidos=${vacios})`);
  } catch (e: any) {
    await log('error', String(e?.message || e));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
