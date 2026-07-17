/**
 * RUSHOUR REPORTS · informes semanales de /rapports (semana cerrada) + mapa
 * de /business. plan-v2/T7.
 *
 * Reutiliza lo YA PROBADO en ventas-plato.ts para moverse por /rapports:
 * cierre de modales ant-design, apertura de selects por teclado, fijar rango
 * personalizado clicando celdas del calendario. Sin page.evaluate (rompe con
 * tsx: "__name is not defined").
 *
 * /rapports: recorre la página con scroll buscando bloques con un botón
 * exportar/descargar y los baja todos (entregados como rushour_report_<slug>,
 * slug = título del bloque).
 * /business: DECISIÓN AUTÓNOMA — no se ha podido explorar en vivo desde esta
 * sesión; se vuelca el DOM completo a robot_debug (fuente=rushour_business_mapa)
 * en cada pasada para mapear los selectores reales más adelante.
 */
import { chromium, Page } from 'playwright';
import { entregar, log, volcar, latido } from './_lib/bandeja.js';
import { capturar } from './_lib/navegador.js';
import { semanaCerrada } from './_lib/periodos.js';

const P = 'rushour_reports';
const RUSHOUR = {
  loginUrl: 'https://manager.rushour.io/login',
  rapportsUrl: 'https://manager.rushour.io/rapports',
  businessUrl: 'https://manager.rushour.io/business',
  user: process.env.RUSHOUR_USER || '', pass: process.env.RUSHOUR_PASS || '',
  userInput: 'input[name="username"]', passInput: 'input[name="password"]', submitBtn: 'button[type="submit"]',
  selFecha: '[data-intercom-target="Select du dashboard pour changer la date"]',
  selRange: '.ant-picker-range[data-intercom-target="Calendrier du dashboard pour changer la date"]',
};

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
/** Fija un rango de fechas concreto (desde/hasta en YYYY-MM-DD), vía "Custom range". */
async function fijarRangoFechas(page: Page, desde: string, hasta: string): Promise<boolean> {
  await abrirSelectTeclado(page, page.locator(RUSHOUR.selFecha));
  if (!(await elegirOpcion(page, /^custom range$/i))) return false;
  await page.waitForTimeout(1500);
  await cerrarModales(page);

  const picker = page.locator(RUSHOUR.selRange).first();
  if (!(await picker.count().catch(() => 0))) return false;
  await picker.locator('input').first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(800);

  if (!(await navegarHasta(page, desde))) return false;
  await page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)').first().locator(`td[title="${desde}"]`).first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
  if (!(await navegarHasta(page, hasta))) return false;
  await page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)').first().locator(`td[title="${hasta}"]`).first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape').catch(() => {});
  return true;
}

async function login(page: Page): Promise<boolean> {
  await page.goto(RUSHOUR.loginUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForSelector(RUSHOUR.userInput, { timeout: 20000 }).catch(() => {});
  await page.fill(RUSHOUR.userInput, RUSHOUR.user).catch(() => {});
  await page.fill(RUSHOUR.passInput, RUSHOUR.pass).catch(() => {});
  await Promise.all([page.waitForLoadState('networkidle').catch(() => {}), page.click(RUSHOUR.submitBtn).catch(() => {})]);
  await page.waitForTimeout(5000);
  const ok = !/\/login/i.test(page.url());
  await log(P, ok ? 'login_ok' : 'login_ko', `url=${page.url()}`);
  return ok;
}

const RE_EXPORTAR = /descargar|exportar|exporter|export|download|t[e\u00e9]l[e\u00e9]charger|csv|excel|xlsx?/i;

function slugificar(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'bloque';
}

/** Recorre /rapports con scroll y baja todos los bloques con botón exportable. */
async function bajarBloquesExportables(page: Page, periodo: string): Promise<number> {
  let bajados = 0;
  const vistos = new Set<string>();
  for (let scroll = 0; scroll < 15; scroll++) {
    // 16-jul (noche, fix): los bloques de /rapports exportan con botones de SOLO
    // ICONO (anticon download/export/file-excel), sin texto -> el filtro por texto
    // daba 0 bloques. Se unen ambos caminos: texto O icono de descarga.
    const botones = page.locator('button, [role="button"], a').filter({ hasText: RE_EXPORTAR })
      .or(page.locator('button:has(.anticon-download), [role="button"]:has(.anticon-download), a:has(.anticon-download), button:has(.anticon-export), button:has(.anticon-file-excel), button:has(.anticon-cloud-download), [data-intercom-target*="export" i], [data-intercom-target*="telecharger" i]'));
    const n = await botones.count().catch(() => 0);
    for (let i = 0; i < n; i++) {
      const btn = botones.nth(i);
      const texto = ((await btn.textContent().catch(() => '')) || '').trim();
      const clave = `${texto}|${i}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);

      const titulo = ((await btn.locator('xpath=ancestor::*[self::section or self::div][1]//h1|ancestor::*[self::section or self::div][1]//h2|ancestor::*[self::section or self::div][1]//h3')
        .first().textContent().catch(() => '')) || '').trim();
      const slug = slugificar(titulo || texto);

      const f = await capturar(page, P, async () => { await btn.click({ timeout: 6000 }).catch(() => {}); }, 30);
      if (f) {
        await entregar({ fuente: P, tipo: `rushour_report_${slug}`, nombre: f.nombre, datos: f.datos, periodo, destino: 'ventas' });
        bajados++;
      }
    }
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(700);
  }
  return bajados;
}

async function main() {
  if (!RUSHOUR.user || !RUSHOUR.pass) { await log(P, 'sin_credenciales', 'faltan RUSHOUR_USER/RUSHOUR_PASS'); return; }
  const { periodo, from, to } = semanaCerrada();
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    if (!(await login(page))) { await volcar(`${P}_login_ko`, await page.content().catch(() => '')); return; }

    await page.goto(RUSHOUR.rapportsUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(8000);
    await cerrarModales(page);

    if (!(await fijarRangoFechas(page, from, to))) {
      await log(P, 'error', `no pude fijar el rango ${from}..${to}`);
      await volcar(`${P}_sin_rango`, await page.content().catch(() => ''));
    } else {
      await cerrarModales(page);
      const n = await bajarBloquesExportables(page, periodo);
      await log(P, n ? 'descarga' : 'sin_descarga', `/rapports ${from}..${to}: ${n} bloque(s) exportado(s)`);
      if (!n) await volcar(`${P}_rapports_sin_export`, await page.content().catch(() => ''));   // mapa para la siguiente pasada
    }

    // 17-jul (v3): los datos de /rapports viven detras de "See details" (drawers).
    // Se abren hasta 6 y se intenta exportar dentro de cada uno.
    const detalles = page.locator('button, a, [role="button"]').filter({ hasText: /see details|ver detalles/i });
    const nDet = Math.min(await detalles.count().catch(() => 0), 6);
    let deDrawers = 0;
    for (let i = 0; i < nDet; i++) {
      await detalles.nth(i).click({ timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(4000);
      deDrawers += await bajarBloquesExportables(page, `${periodo}_detalle${i}`);
      if (i === 0 && !deDrawers) await volcar(`${P}_drawer`, await page.content().catch(() => ''));
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(1200);
    }
    if (nDet) await log(P, deDrawers ? 'descarga' : 'sin_descarga', `"See details": ${deDrawers} fichero(s) de ${nDet} panel(es)`);

    // 17-jul (fix v2, DOM volcado de /rapports): la vista Reports es un panel de
    // KPIs SIN botones de exportar; los ficheros descargables viven en /vat
    // (VAT Reports) y /historicals. Se recorren ambas y se baja todo lo exportable.
    for (const [ruta, etiqueta] of [['/vat', 'vat'], ['/historicals', 'historicals']] as const) {
      await page.goto(`https://manager.rushour.io${ruta}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(8000);
      await cerrarModales(page);
      const nx = await bajarBloquesExportables(page, `${periodo}_${etiqueta}`);
      await log(P, nx ? 'descarga' : 'sin_descarga', `${ruta}: ${nx} fichero(s)`);
      if (!nx) await volcar(`${P}_${etiqueta}_sin_export`, await page.content().catch(() => ''));
    }

    // /business: sin mapear en vivo — se vuelca el DOM para mapear a mano.
    await page.goto(RUSHOUR.businessUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(8000);
    await cerrarModales(page);
    await volcar('rushour_business_mapa', await page.content().catch(() => ''));
    await log(P, 'mapa', '/business volcado en robot_debug (rushour_business_mapa) para mapear a mano');

    await latido(P, periodo, `semana ${from}..${to}`);
  } catch (e: any) {
    await log(P, 'error', String(e?.message || e));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
