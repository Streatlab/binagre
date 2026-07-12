/**
 * SOLD_PRODUCTS (panel.sinqro.com) · productos vendidos por pedido.
 *   panel.sinqro.com/selling_point_accounts/3976805/reports → SOLD_PRODUCTS → Ver
 *
 * OJO: el panel NO es la app (app.sinqro.com). Es AngularJS antiguo:
 *  - los inputs usan ng-model, y un fill() directo deja el formulario "pristine"
 *    (Angular no se entera) → el login se enviaba vacío y volvía a /login.
 *    Solución: escribir tecla a tecla (pressSequentially) + disparar input/change.
 *  - el botón es #login-submit con ng-click, no un submit de formulario.
 *  - tras pulsar no siempre hay navegación: se espera a salir de /login.
 *
 * PASADA 1 (reconocimiento): entra, pulsa Ver y registra QUÉ devuelve (descarga
 * o tabla en pantalla), con cabeceras y primeras filas en robot_log y el HTML en
 * robot_debug. Todavía NO escribe en ventas_plato: primero hay que ver si el
 * informe separa PRODUCTO de MODIFICADOR (si no se separan, las unidades y los
 * euros de los platos salen inflados).
 */
import { chromium, Page, BrowserContext } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const sb = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const PANEL = 'https://panel.sinqro.com/';
const REPORTS_URL = 'https://panel.sinqro.com/selling_point_accounts/3976805/reports';
const HOY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());

async function log(estado: string, detalle: string) {
  try { await sb.from('robot_log').insert([{ fuente: 'sold_products', estado, detalle }]); } catch { /* noop */ }
}
async function volcar(fuente: string, page: Page) {
  try {
    const html = await page.content();
    const { error } = await sb.from('robot_debug').insert([{ fuente, fecha: HOY, html }]);
    if (error) await log('dump_error', `${fuente}: ${error.message}`);
    else await log('dump', `${fuente} bytes=${html.length} url=${page.url()}`);
  } catch (e: any) { await log('dump_error', String(e?.message || e)); }
}

/** Escribe en un input de AngularJS de forma que el scope se entere. */
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
  if (!/\/login|^https:\/\/panel\.sinqro\.com\/?$/.test(page.url()) && !(await page.locator('#login-email').count().catch(() => 0))) {
    return true; // ya había sesión
  }
  await escribirNg(page, '#login-email', process.env.SINQRO_USER || '');
  await escribirNg(page, '#login-password', process.env.SINQRO_PASS || '');

  const relleno = await page.locator('#login-email').first().inputValue().catch(() => '');
  await log('login', `email escrito=${relleno ? 'sí' : 'NO'} (${relleno.length} car.)`);

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

async function leerTabla(p: Page) {
  const ths = p.locator('table th');
  const nth = await ths.count().catch(() => 0);
  const cab: string[] = [];
  for (let i = 0; i < nth; i++) cab.push(((await ths.nth(i).textContent().catch(() => '')) || '').trim());
  const trs = p.locator('table tbody tr');
  const ntr = await trs.count().catch(() => 0);
  const muestras: string[] = [];
  for (let i = 0; i < Math.min(ntr, 5); i++) {
    muestras.push(((await trs.nth(i).innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim().slice(0, 220));
  }
  await log('tabla', `filas=${ntr} cabeceras=[${cab.join(' | ')}] muestras=${muestras.join(' // ')}`.slice(0, 1900));
}

async function main() {
  await log('inicio', 'SOLD_PRODUCTS reconocimiento');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx: BrowserContext = await browser.newContext({ acceptDownloads: true, timezoneId: 'Europe/Madrid' });
  const page = await ctx.newPage();
  try {
    if (!(await login(page))) { await log('error', 'no he podido entrar en panel.sinqro.com'); return; }

    await page.goto(REPORTS_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(6000);
    await volcar('sold_a_reports', page);

    if (/\/login/.test(page.url())) { await log('error', 'la sesión no aguanta hasta /reports'); return; }

    let fila = page.locator('tr').filter({ hasText: /SOLD[_ ]?PRODUCTS/i }).first();
    if (!(await fila.count().catch(() => 0))) fila = page.locator('tr').filter({ hasText: /producto.*vendid/i }).first();
    if (!(await fila.count().catch(() => 0))) {
      const filas = page.locator('table tbody tr');
      const n = await filas.count().catch(() => 0);
      const nombres: string[] = [];
      for (let i = 0; i < Math.min(n, 20); i++) nombres.push(((await filas.nth(i).innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim().slice(0, 80));
      await log('error', `no encuentro SOLD_PRODUCTS. Informes visibles: ${nombres.join(' // ')}`.slice(0, 1800));
      return;
    }

    const ver = fila.getByRole('button', { name: /ver|view/i }).first();
    const verLink = fila.getByRole('link', { name: /ver|view/i }).first();
    const objetivo = (await ver.count().catch(() => 0)) ? ver : verLink;

    const descargaProm = page.waitForEvent('download', { timeout: 25000 }).catch(() => null);
    const popupProm = ctx.waitForEvent('page', { timeout: 25000 }).catch(() => null);
    await objetivo.click({ timeout: 10000 }).catch(() => {});
    const descarga = await descargaProm;

    if (descarga) {
      const ruta = await descarga.path();
      const nombre = descarga.suggestedFilename();
      let cabeza = '';
      try {
        const txt = readFileSync(ruta || '', 'utf8');
        cabeza = txt.split('\n').slice(0, 6).join(' ⏎ ').slice(0, 1700);
      } catch { cabeza = '(binario, probablemente xlsx)'; }
      await log('descarga', `fichero=${nombre} :: ${cabeza}`);
      await log('fin', 'ok (descarga)');
      return;
    }

    const popup = await popupProm;
    const p = popup || page;
    await p.waitForLoadState('networkidle').catch(() => {});
    await p.waitForTimeout(6000);
    await volcar('sold_b_detalle', p);
    await leerTabla(p);
    await log('fin', 'ok (pantalla)');
  } catch (e: any) {
    await log('error', String(e?.message || e));
    await volcar('sold_error', page);
  } finally { await browser.close(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
