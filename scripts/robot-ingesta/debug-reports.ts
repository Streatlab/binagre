/**
 * DEBUG puntual · Rushour Reports → volcado de HTML a robot_debug.
 * Script independiente: NO toca robot.ts ni backfill.ts.
 * Objetivo: ver el HTML real de la pantalla Reports (rango personalizado +
 * desplegable de plataforma) para escribir selectores exactos antes de
 * programar el parser del backfill.
 */
import { chromium, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// OJO: el query builder de supabase-js es "thenable" pero NO una Promise:
// no tiene .catch() hasta que se hace await. Siempre try/catch, nunca .catch().
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
  await log('inicio', `fecha=${fecha}`);
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

    // A) Menú tras login (para ver el link exacto de Reports)
    await dump('reports_a_menu', fecha, page);

    // B) Click en "Reports" del menú lateral (varios intentos de texto)
    for (const re of [/^Reports$/, /^Informes$/, /Reports/i]) {
      const el = page.getByText(re).first();
      if (await el.count().catch(() => 0)) { await el.click({ timeout: 5000 }).catch(() => {}); break; }
    }
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(6000);
    await cerrarModales(page);
    await dump('reports_b_pagina', fecha, page);

    // C) Best-effort: abrir el selector de fechas/rango y volcar con el picker abierto
    for (const sel of ['.ant-picker', 'input[type="date"]', '[class*="date"]', '[class*="range"]']) {
      const el = page.locator(sel).first();
      if (await el.count().catch(() => 0)) { await el.click({ timeout: 3000 }).catch(() => {}); break; }
    }
    await page.waitForTimeout(2000);
    await dump('reports_c_picker', fecha, page);

    // D) Best-effort: abrir el desplegable (selects / ant-select) y volcar con opciones visibles
    await page.keyboard.press('Escape').catch(() => {});
    for (const sel of ['.ant-select', 'select', '[role="combobox"]']) {
      const els = page.locator(sel);
      const n = await els.count().catch(() => 0);
      if (n) { await els.nth(n - 1).click({ timeout: 3000 }).catch(() => {}); break; }
    }
    await page.waitForTimeout(2000);
    await dump('reports_d_dropdown', fecha, page);

    await log('fin', `ok js_errores=${erroresJs.length} :: ${erroresJs.slice(0, 3).join(' | ').slice(0, 300)}`);
  } catch (e: any) {
    await log('error', String(e?.message || e));
    await dump('reports_error', fecha, page);
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
