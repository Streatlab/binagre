/**
 * DEBUG puntual v4 · Rushour /rapports.
 * Hallazgo v3: hay ~2-3 modales promocionales (ant-modal: WhatsApp, branding)
 * que BLOQUEAN todos los clicks — por eso todos los volcados eran idénticos.
 * v4: cierra TODOS los modales en bucle hasta que no quede ninguno visible,
 * verifica que la página responde, y abre fecha (con teclado, inmune a
 * overlays) + plataforma, volcando las opciones.
 */
import { chromium, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

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

// Cierra TODOS los modales Ant en bucle hasta que no quede ninguno visible.
async function cerrarTodosLosModales(page: Page): Promise<number> {
  for (let ronda = 0; ronda < 8; ronda++) {
    const visibles = await page.locator('.ant-modal-wrap:visible').count().catch(() => 0);
    if (!visibles) return ronda;
    // X de cierre estándar de Ant
    await page.locator('.ant-modal-close:visible').first().click({ force: true, timeout: 2000 }).catch(() => {});
    // Botones "Close"/"Cerrar" dentro del modal
    const btns = page.locator('.ant-modal-wrap:visible button');
    const nb = await btns.count().catch(() => 0);
    for (let i = 0; i < nb; i++) {
      const t = ((await btns.nth(i).textContent().catch(() => '')) || '').trim();
      if (/^(close|cerrar|no,? gracias|later|más tarde)$/i.test(t)) {
        await btns.nth(i).click({ force: true, timeout: 2000 }).catch(() => {});
      }
    }
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(1200);
  }
  return -1; // no se pudo con todos
}

async function opcionesAbiertas(page: Page): Promise<string> {
  const ops = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option');
  const n = await ops.count().catch(() => 0);
  const txts: string[] = [];
  for (let i = 0; i < n; i++) txts.push(((await ops.nth(i).textContent().catch(() => '')) || '').trim());
  return `${n} :: ${txts.join(' | ')}`;
}

async function main() {
  const fecha = process.env.DEBUG_FECHA || '2026-06-01';
  await log('inicio', `v4 fecha=${fecha}`);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  try {
    await page.goto('https://manager.rushour.io/login', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[name="username"]', { timeout: 20000 });
    await page.fill('input[name="username"]', process.env.RUSHOUR_USER || '');
    await page.fill('input[name="password"]', process.env.RUSHOUR_PASS || '');
    await Promise.all([page.waitForLoadState('networkidle').catch(() => {}), page.click('button[type="submit"]')]);
    await page.waitForTimeout(5000);

    await page.goto('https://manager.rushour.io/rapports', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(8000);

    const rondas = await cerrarTodosLosModales(page);
    const quedan = await page.locator('.ant-modal-wrap:visible').count().catch(() => 0);
    await log('modales', `rondas=${rondas} visibles_restantes=${quedan}`);
    await dump('v4_sin_modales', fecha, page);

    // 1) FECHA: abrir con teclado (inmune a overlays): focus + ArrowDown
    const inputFecha = page.locator('[data-intercom-target="Select du dashboard pour changer la date"] input').first();
    await inputFecha.focus().catch(() => {});
    await page.keyboard.press('ArrowDown').catch(() => {});
    await page.waitForTimeout(1500);
    let ops = await opcionesAbiertas(page);
    if (ops.startsWith('0')) {
      // Fallback: click normal ahora que no hay modales
      await page.locator('[data-intercom-target="Select du dashboard pour changer la date"] .ant-select-selector').first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1500);
      ops = await opcionesAbiertas(page);
    }
    await log('opciones_fecha', ops);
    await dump('v4_fecha_abierto', fecha, page);

    // 2) Elegir opción Custom/Personalizado y volcar el picker
    const items = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option');
    const n = await items.count().catch(() => 0);
    let elegida = '';
    for (let i = 0; i < n; i++) {
      const t = ((await items.nth(i).textContent().catch(() => '')) || '').trim();
      if (/custom|personnalis|personaliz/i.test(t)) { elegida = t; await items.nth(i).click().catch(() => {}); break; }
    }
    await log('custom_elegida', elegida || 'NO ENCONTRADA');
    await page.waitForTimeout(2500);
    await dump('v4_custom_picker', fecha, page);

    // 3) PLATAFORMA: abrir con teclado el multiple que contiene ubereats
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
    const selPlat = page.locator('.ant-select-multiple').filter({ hasText: 'ubereats' }).first();
    await selPlat.locator('input').first().focus().catch(() => {});
    await page.keyboard.press('ArrowDown').catch(() => {});
    await page.waitForTimeout(1500);
    let opsP = await opcionesAbiertas(page);
    if (opsP.startsWith('0')) {
      await selPlat.locator('.ant-select-selector').click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1500);
      opsP = await opcionesAbiertas(page);
    }
    await log('opciones_plataforma', opsP);
    await dump('v4_plataforma_abierto', fecha, page);

    await log('fin', 'ok v4');
  } catch (e: any) {
    await log('error', String(e?.message || e));
    await dump('v4_error', fecha, page);
  } finally { await browser.close(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
