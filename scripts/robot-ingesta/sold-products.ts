/**
 * SOLD_PRODUCTS (panel.sinqro.com) · DESCARGA EL INFORME Y LO DEJA EN LA BANDEJA.
 *   panel.sinqro.com/selling_point_accounts/3976805/reports → SOLD_PRODUCTS → Ver
 *
 * v2 (12-jul-2026). Cambio de enfoque: este robot YA NO interpreta ventas ni
 * escribe en pedidos_lineas / ventas_plato. Su único trabajo es dejar el fichero
 * del informe en la misma bandeja donde caen las subidas manuales de Papeleo:
 *
 *   bucket 'informes-plataforma'  +  fila en imports_log (estado='pendiente')
 *
 * El parser único de ventas (Papeleo) lo recoge de ahí. Un solo sitio donde se
 * interpretan las ventas, vengan del robot o de una subida a mano.
 *
 * Cómo obtiene el fichero:
 *   1. Si el informe tiene botón de exportar/descargar → usa ese fichero tal cual.
 *   2. Si no lo hay → serializa la tabla completa a CSV de una sola pasada
 *      (page.evaluate en memoria, NO celda a celda: eso es lo que agotaba el
 *      tiempo del workflow con 2.714 filas).
 *
 * Cobertura: Glovo y Just Eat. Uber NO pasa por Sinqro.
 * Alcance del informe: mes en curso + mes anterior.
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
const BUCKET = 'informes-plataforma';
const HOY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
const SOLO_LEER = process.env.SOLD_DRY === '1';

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

/** Intento 1: botón de exportar/descargar del propio informe. */
async function intentarDescarga(ctx: BrowserContext, p: Page): Promise<{ nombre: string; datos: Buffer } | null> {
  const candidatos = [
    p.getByRole('button', { name: /export|exportar|descargar|download|csv|excel|xls/i }).first(),
    p.getByRole('link', { name: /export|exportar|descargar|download|csv|excel|xls/i }).first(),
    p.locator('a[download], [class*="export"], [class*="download"], [ng-click*="export"], [ng-click*="download"]').first(),
  ];
  for (const c of candidatos) {
    if (!(await c.count().catch(() => 0))) continue;
    try {
      const espera = p.waitForEvent('download', { timeout: 30000 });
      await c.click({ timeout: 8000 });
      const dl = await espera;
      const ruta = await dl.path();
      if (!ruta) continue;
      const fs = await import('fs/promises');
      const datos = await fs.readFile(ruta);
      const nombre = dl.suggestedFilename() || 'sold_products.csv';
      await log('descarga', `${nombre} bytes=${datos.length}`);
      return { nombre, datos };
    } catch { /* siguiente candidato */ }
  }
  return null;
}

/** Intento 2: serializar la tabla entera a CSV de una sola pasada, en memoria. */
async function tablaACsv(p: Page): Promise<{ nombre: string; datos: Buffer; filas: number } | null> {
  const csv = await p.evaluate(() => {
    const tabla = document.querySelector('table');
    if (!tabla) return null;
    const esc = (s: string) => '"' + (s || '').replace(/\s+/g, ' ').trim().replace(/"/g, '""') + '"';
    const filas: string[] = [];
    const ths = Array.from(tabla.querySelectorAll('th')).map((e) => esc(e.textContent || ''));
    if (ths.length) filas.push(ths.join(','));
    const trs = Array.from(tabla.querySelectorAll('tbody tr'));
    for (const tr of trs) {
      const tds = Array.from(tr.querySelectorAll('td'));
      if (tds.length < 6) continue;
      filas.push(tds.map((e) => esc(e.textContent || '')).join(','));
    }
    return { texto: filas.join('\n'), filas: Math.max(filas.length - 1, 0) };
  });
  if (!csv || !csv.filas) return null;
  await log('tabla', `${csv.filas} filas serializadas a CSV`);
  return { nombre: 'sold_products.csv', datos: Buffer.from(csv.texto, 'utf-8'), filas: csv.filas };
}

/** Deja el fichero en la bandeja de Papeleo y lo registra como pendiente. */
async function aBandeja(nombre: string, datos: Buffer) {
  const sello = new Date().toISOString().replace(/[:.]/g, '-');
  const ext = (nombre.match(/\.[a-z0-9]+$/i) || ['.csv'])[0];
  const ruta = `sinqro/sold_products_${HOY}_${sello}${ext}`;
  const tipoMime = /\.csv$/i.test(ext) ? 'text/csv' : 'application/octet-stream';

  const { error: eUp } = await sb.storage.from(BUCKET).upload(ruta, datos, { contentType: tipoMime, upsert: true });
  if (eUp) { await log('error', `subiendo a la bandeja: ${eUp.message}`); return; }

  const { error: eLog } = await sb.from('imports_log').insert([{
    archivo_nombre: `sold_products_${HOY}${ext}`,
    archivo_url: `${BUCKET}/${ruta}`,
    tipo_detectado: 'sinqro_sold_products',
    estado: 'pendiente',
    destino_modulo: 'ventas',
    detalle: `Informe SOLD_PRODUCTS de Sinqro (Glovo + Just Eat). Depositado por el robot el ${HOY}. Pendiente de parsear.`,
  }]);
  if (eLog) { await log('aviso', `fichero subido pero no registrado en imports_log: ${eLog.message}`); return; }

  await log('ok', `informe en bandeja: ${BUCKET}/${ruta} (${datos.length} bytes) · imports_log=pendiente`);
}

async function main() {
  await log('inicio', `SOLD_PRODUCTS → bandeja Papeleo${SOLO_LEER ? ' (simulacro)' : ''}`);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx: BrowserContext = await browser.newContext({ acceptDownloads: true, timezoneId: 'Europe/Madrid' });
  const page = await ctx.newPage();
  try {
    if (!(await login(page))) { await log('error', 'no he podido entrar en panel.sinqro.com'); process.exitCode = 1; return; }

    await page.goto(REPORTS_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(6000);

    let fila = page.locator('tr').filter({ hasText: /SOLD[_ ]?PRODUCTS/i }).first();
    if (!(await fila.count().catch(() => 0))) fila = page.locator('tr').filter({ hasText: /producto.*vendid/i }).first();
    if (!(await fila.count().catch(() => 0))) { await log('error', 'no encuentro el informe SOLD_PRODUCTS'); await volcar('sold_sin_fila', page); process.exitCode = 1; return; }

    const ver = fila.getByRole('button', { name: /ver|view/i }).first();
    const verLink = fila.getByRole('link', { name: /ver|view/i }).first();
    const objetivo = (await ver.count().catch(() => 0)) ? ver : verLink;
    const popupProm = ctx.waitForEvent('page', { timeout: 25000 }).catch(() => null);
    await objetivo.click({ timeout: 10000 }).catch(() => {});
    const popup = await popupProm;
    const p = popup || page;
    await p.waitForLoadState('networkidle').catch(() => {});
    await p.waitForTimeout(8000);

    let fichero = await intentarDescarga(ctx, p);
    if (!fichero) {
      const csv = await tablaACsv(p);
      if (!csv) { await volcar('sold_sin_lineas', p); await log('error', 'informe abierto pero sin tabla legible'); process.exitCode = 1; return; }
      fichero = { nombre: csv.nombre, datos: csv.datos };
    }

    if (SOLO_LEER) { await log('simulacro', `${fichero.nombre} (${fichero.datos.length} bytes) · no dejo nada en la bandeja`); return; }
    await aBandeja(fichero.nombre, fichero.datos);
    await log('fin', 'ok');
  } catch (e: any) {
    await log('error', String(e?.message || e));
    await volcar('sold_error', page);
    process.exitCode = 1;
  } finally { await browser.close(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
