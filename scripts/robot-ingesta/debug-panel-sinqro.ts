/**
 * DEBUG · panel.sinqro.com → buscar el informe de productos vendidos.
 * Solo mira y vuelca a robot_debug: menú del panel, y si hay una sección de
 * informes/estadísticas/productos, su HTML. No escribe datos de negocio.
 */
import { chromium, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

async function log(estado: string, detalle: string) {
  try { await sb.from('robot_log').insert([{ fuente: 'debug_panel_sinqro', estado, detalle }]); } catch { /* noop */ }
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
  await log('inicio', 'panel.sinqro.com');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  try {
    await page.goto('https://panel.sinqro.com/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    await volcar('panel_a_login', page);

    // Login: probar los ids del otro panel y, si no, cualquier input de email/password
    const userSels = ['#login-email', 'input[type="email"]', 'input[name="email"]', 'input[name="username"]'];
    const passSels = ['#login-password', 'input[type="password"]', 'input[name="password"]'];
    let uOk = false;
    for (const s of userSels) {
      const l = page.locator(s).first();
      if (await l.count().catch(() => 0)) { await l.fill(process.env.SINQRO_USER || '').catch(() => {}); uOk = true; break; }
    }
    for (const s of passSels) {
      const l = page.locator(s).first();
      if (await l.count().catch(() => 0)) { await l.fill(process.env.SINQRO_PASS || '').catch(() => {}); break; }
    }
    await log('info', `campos_login_encontrados=${uOk}`);
    const btn = page.locator('#loginButton, button[type="submit"]').first();
    await Promise.all([page.waitForLoadState('networkidle').catch(() => {}), btn.click({ timeout: 8000 }).catch(() => {})]);
    await page.waitForTimeout(6000);
    await volcar('panel_b_dentro', page);

    // Menú lateral: registrar todos los enlaces (texto + href) para localizar informes
    const links = page.locator('a');
    const n = await links.count().catch(() => 0);
    const items: string[] = [];
    for (let i = 0; i < Math.min(n, 60); i++) {
      const t = ((await links.nth(i).textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
      const h = (await links.nth(i).getAttribute('href').catch(() => '')) || '';
      if (t || h) items.push(`${t}→${h}`);
    }
    await log('menu', items.join(' | ').slice(0, 1800));

    // Si hay algo tipo informes/estadísticas/productos, entrar y volcar
    for (const re of [/informe/i, /estad/i, /report/i, /producto/i, /venta/i, /analytic/i]) {
      const l = page.getByRole('link', { name: re }).first();
      if (await l.count().catch(() => 0)) {
        await l.click({ timeout: 5000 }).catch(() => {});
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(5000);
        await volcar(`panel_c_${re.source.replace(/[^a-z]/gi, '')}`, page);
        await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
        await page.waitForTimeout(3000);
      }
    }
    await log('fin', 'ok');
  } catch (e: any) {
    await log('error', String(e?.message || e));
    await volcar('panel_error', page);
  } finally { await browser.close(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
