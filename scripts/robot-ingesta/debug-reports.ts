/**
 * DEBUG puntual · Rushour Reports → volcado de HTML a robot_debug.
 * v2: la sección Reports vive en la ruta /rapports (hrefs reales del menú:
 * /business /historicals /rapports /vat ...). El click por texto no navegaba,
 * así que se va DIRECTO por URL.
 */
import { chromium, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// supabase-js query builder: thenable pero sin .catch() → siempre try/catch.
async function log(estado: string, detalle: string) {
  try { await sb.from('robot_log').insert([{ fuente: 'debug_reports', estado, detalle }]); } catch { /* noop */ }
}
async function dump(fuente: string, fecha: string, page: Page) {
  try {
    const html = await page.content();
    await sb.from('robot_debug').insert([{ fuente, fecha, html }]);
    await log('dump', `${fuente} bytes=${html.length} url=${page.url()}`);
  } catch (e: any) {
    await log('dump_error', `${fuente} ${String(e?.message || e)}`);
  }
}
async function cerrarModales(page: Page) {
  const nombres = [/close/i, /cerrar/i, /no,? gracias/i, /aceptar/i, /got it/i, /entendido/i, /×/];
  for (const re of nombres) {
    await page.getByRole('button', { name: re }).first().click({ timeout: 1200 }).catch(() => {});
  }
  await page.keyboard.press('Escape').catch(() => {});
}

async function main() {
  const fecha = process.env.DEBUG_FECHA || '2026-06-01';
  await log('inicio', `v2 fecha=${fecha}`);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  const erroresJs: string[] = [];
  page.on('pageerror', (e) => erroresJs.push(e.message));
  try {
    await page.goto('https://manager.rushour.io/login', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[name="username"]', { timeout: 20000 });
    await page.fill('input[name="username"]', process.env.RUSHOUR_USER || '');
    await page.fill('input[name="password"]', process.env.RUSHOUR_PASS || '');
    await Promise.all([page.waitForLoadState('networkidle').catch(() => {}), page.click('button[type="submit"]')]);
    await page.waitForTimeout(5000);
    await cerrarModales(page); await page.waitForTimeout(1000); await cerrarModales(page);

    // A) Directo a /rapports (SPA React: espera generosa a que pinte)
    await page.goto('https://manager.rushour.io/rapports', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(8000);
    await cerrarModales(page);
    await dump('rapports_a_pagina', fecha, page);

    // B) Abrir el selector de fechas/rango y volcar con el picker abierto
    for (const sel of ['.ant-picker', 'input[type="date"]', '[class*="rangepicker"]', '[class*="date"]']) {
      const el = page.locator(sel).first();
      if (await el.count().catch(() => 0)) { await el.click({ timeout: 3000 }).catch(() => {}); break; }
    }
    await page.waitForTimeout(2000);
    await dump('rapports_b_picker', fecha, page);

    // C) Abrir TODOS los desplegables uno a uno y volcar con opciones visibles
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
    const combos = page.locator('.ant-select, select, [role="combobox"]');
    const n = await combos.count().catch(() => 0);
    await log('info', `combos_encontrados=${n}`);
    for (let i = 0; i < Math.min(n, 4); i++) {
      await combos.nth(i).click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(1500);
      await dump(`rapports_c_dropdown_${i}`, fecha, page);
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(500);
    }

    await log('fin', `ok js_errores=${erroresJs.length} :: ${erroresJs.slice(0, 3).join(' | ').slice(0, 300)}`);
  } catch (e: any) {
    await log('error', String(e?.message || e));
    await dump('rapports_error', fecha, page);
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
