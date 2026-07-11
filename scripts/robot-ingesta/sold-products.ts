/**
 * SOLD_PRODUCTS (panel.sinqro.com) · productos vendidos por pedido.
 * Ruta confirmada por Rubén:
 *   panel.sinqro.com/selling_point_accounts/3976805/reports → SOLD_PRODUCTS → Ver
 *   ("Productos vendidos por pedido (este mes y el anterior)")
 *
 * PASADA 1 (reconocimiento): entra, pulsa Ver, y registra QUÉ devuelve
 * (descarga CSV/XLSX o tabla en pantalla), con cabeceras y primeras filas en
 * robot_log y el HTML en robot_debug. No escribe aún en ventas_plato: primero
 * hay que ver las columnas reales (canal, marca, producto, unidades, importe).
 */
import { chromium, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const sb = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const REPORTS_URL = 'https://panel.sinqro.com/selling_point_accounts/3976805/reports';

async function log(estado: string, detalle: string) {
  try { await sb.from('robot_log').insert([{ fuente: 'sold_products', estado, detalle }]); } catch { /* noop */ }
}
async function volcar(fuente: string, page: Page) {
  try {
    const html = await page.content();
    const { error } = await sb.from('robot_debug').insert([{ fuente, fecha: '2026-07-11', html }]);
    if (error) await log('dump_error', `${fuente}: ${error.message}`);
    else await log('dump', `${fuente} bytes=${html.length} url=${page.url()}`);
  } catch (e: any) { await log('dump_error', String(e?.message || e)); }
}

async function main() {
  await log('inicio', 'SOLD_PRODUCTS reconocimiento');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  try {
    // Login (el panel comparte credenciales con app.sinqro.com)
    await page.goto('https://panel.sinqro.com/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    for (const s of ['#login-email', 'input[type="email"]', 'input[name="email"]']) {
      const l = page.locator(s).first();
      if (await l.count().catch(() => 0)) { await l.fill(process.env.SINQRO_USER || '').catch(() => {}); break; }
    }
    for (const s of ['#login-password', 'input[type="password"]', 'input[name="password"]']) {
      const l = page.locator(s).first();
      if (await l.count().catch(() => 0)) { await l.fill(process.env.SINQRO_PASS || '').catch(() => {}); break; }
    }
    await Promise.all([
      page.waitForLoadState('networkidle').catch(() => {}),
      page.locator('#loginButton, button[type="submit"]').first().click({ timeout: 8000 }).catch(() => {}),
    ]);
    await page.waitForTimeout(5000);

    await page.goto(REPORTS_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(5000);
    await volcar('sold_a_reports', page);

    // Fila SOLD_PRODUCTS → botón Ver
    const fila = page.locator('tr').filter({ hasText: 'SOLD_PRODUCTS' }).first();
    if (!(await fila.count().catch(() => 0))) {
      await log('error', 'no encuentro la fila SOLD_PRODUCTS');
      return;
    }
    const ver = fila.getByRole('button', { name: /ver|view/i }).first();
    const verLink = fila.getByRole('link', { name: /ver|view/i }).first();
    const objetivo = (await ver.count().catch(() => 0)) ? ver : verLink;

    // Puede abrir una tabla, una pestaña nueva o disparar una descarga: cubrimos los tres.
    const descargaProm = page.waitForEvent('download', { timeout: 20000 }).catch(() => null);
    const popupProm = ctx.waitForEvent('page', { timeout: 20000 }).catch(() => null);
    await objetivo.click({ timeout: 10000 }).catch(() => {});
    const descarga = await descargaProm;

    if (descarga) {
      const ruta = await descarga.path();
      const nombre = descarga.suggestedFilename();
      let cabeza = '';
      try {
        const txt = readFileSync(ruta || '', 'utf8');
        cabeza = txt.split('\n').slice(0, 4).join(' ⏎ ').slice(0, 1500);
      } catch { cabeza = '(binario, no es texto plano)'; }
      await log('descarga', `fichero=${nombre} :: ${cabeza}`);
      await log('fin', 'ok (descarga)');
      return;
    }

    const popup = await popupProm;
    const p = popup || page;
    await p.waitForLoadState('networkidle').catch(() => {});
    await p.waitForTimeout(6000);
    await volcar('sold_b_detalle', p);

    // Si hay tabla en pantalla, registrar cabeceras y 3 primeras filas
    const ths = p.locator('table th');
    const nth = await ths.count().catch(() => 0);
    const cab: string[] = [];
    for (let i = 0; i < nth; i++) cab.push(((await ths.nth(i).textContent().catch(() => '')) || '').trim());
    const trs = p.locator('table tbody tr');
    const ntr = await trs.count().catch(() => 0);
    const muestras: string[] = [];
    for (let i = 0; i < Math.min(ntr, 3); i++) {
      muestras.push(((await trs.nth(i).innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim().slice(0, 200));
    }
    await log('tabla', `filas=${ntr} cabeceras=[${cab.join(' | ')}] muestras=${muestras.join(' // ')}`.slice(0, 1800));
    await log('fin', 'ok (pantalla)');
  } catch (e: any) {
    await log('error', String(e?.message || e));
    await volcar('sold_error', page);
  } finally { await browser.close(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
