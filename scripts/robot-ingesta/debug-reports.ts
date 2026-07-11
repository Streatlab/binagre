/**
 * DEBUG puntual v3 · Rushour /rapports → volcado quirúrgico a robot_debug.
 * Ya conocemos los selectores base (data-intercom-target). Esta pasada abre
 * de verdad: (1) el select de fecha y sus opciones, (2) la opción Custom y su
 * range picker, (3) el select de plataforma y sus opciones. Con esto el
 * parser se escribe sin ninguna incógnita.
 */
import { chromium, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function log(estado: string, detalle: string) {
  try { await sb.from('robot_log').insert([{ fuente: 'debug_reports', estado, detalle }]); } catch { /* noop */ }
}
async function dump(fuente: string, fecha: string, page: Page) {
  try {
    const html = await page.content();
    await sb.from('robot_debug').insert([{ fuente, fecha, html }]);
    await log('dump', `${fuente} bytes=${html.length}`);
  } catch (e: any) { await log('dump_error', `${fuente} ${String(e?.message || e)}`); }
}
async function cerrarModales(page: Page) {
  const nombres = [/close/i, /cerrar/i, /no,? gracias/i, /aceptar/i, /got it/i, /entendido/i, /×/];
  for (const re of nombres) {
    await page.getByRole('button', { name: re }).first().click({ timeout: 1200 }).catch(() => {});
  }
  await page.keyboard.press('Escape').catch(() => {});
}
// Texto de las opciones del dropdown Ant abierto (viven en un portal en body)
async function opcionesAbiertas(page: Page): Promise<string> {
  const ops = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option');
  const n = await ops.count().catch(() => 0);
  const txts: string[] = [];
  for (let i = 0; i < n; i++) txts.push(((await ops.nth(i).textContent().catch(() => '')) || '').trim());
  return `${n} :: ${txts.join(' | ')}`;
}

async function main() {
  const fecha = process.env.DEBUG_FECHA || '2026-06-01';
  await log('inicio', `v3 fecha=${fecha}`);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  try {
    await page.goto('https://manager.rushour.io/login', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[name="username"]', { timeout: 20000 });
    await page.fill('input[name="username"]', process.env.RUSHOUR_USER || '');
    await page.fill('input[name="password"]', process.env.RUSHOUR_PASS || '');
    await Promise.all([page.waitForLoadState('networkidle').catch(() => {}), page.click('button[type="submit"]')]);
    await page.waitForTimeout(5000);
    await cerrarModales(page); await page.waitForTimeout(800); await cerrarModales(page);

    await page.goto('https://manager.rushour.io/rapports', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(8000);
    await cerrarModales(page);

    // 1) Abrir select de FECHA y volcar opciones
    const selFecha = page.locator('[data-intercom-target="Select du dashboard pour changer la date"] .ant-select-selector').first();
    await selFecha.click({ timeout: 8000 }).catch(async () => {
      await page.locator('[data-intercom-target="Select du dashboard pour changer la date"]').first().click({ timeout: 5000 }).catch(() => {});
    });
    await page.waitForTimeout(1500);
    await log('opciones_fecha', await opcionesAbiertas(page));
    await dump('v3_fecha_abierto', fecha, page);

    // 2) Elegir la opción tipo Custom/Personalizado y volcar el picker resultante
    const ops = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option');
    const n = await ops.count().catch(() => 0);
    let elegida = '';
    for (let i = 0; i < n; i++) {
      const t = ((await ops.nth(i).textContent().catch(() => '')) || '').trim();
      if (/custom|personnalis|personaliz/i.test(t)) { elegida = t; await ops.nth(i).click().catch(() => {}); break; }
    }
    await log('custom_elegida', elegida || 'NO ENCONTRADA');
    await page.waitForTimeout(2500);
    await dump('v3_custom_picker', fecha, page);

    // 3) Abrir select de PLATAFORMA (el ant-select-multiple que contiene 'ubereats') y volcar opciones
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
    const selPlat = page.locator('.ant-select-multiple').filter({ hasText: 'ubereats' }).first();
    await selPlat.locator('.ant-select-selector').click({ timeout: 8000 }).catch(async () => {
      await selPlat.click({ timeout: 5000 }).catch(() => {});
    });
    await page.waitForTimeout(1500);
    await log('opciones_plataforma', await opcionesAbiertas(page));
    await dump('v3_plataforma_abierto', fecha, page);

    await log('fin', 'ok v3');
  } catch (e: any) {
    await log('error', String(e?.message || e));
    await dump('v3_error', fecha, page);
  } finally { await browser.close(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
