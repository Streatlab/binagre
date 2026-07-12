/**
 * SONDA RUSHOUR · Investigación (no toca datos).
 *
 * Objetivo: averiguar si los datos en vivo de Rushour (facturación y nº de
 * pedidos del día) se pueden leer con una simple llamada HTTP, sin abrir un
 * navegador. Si es que sí, el panel en vivo se puede refrescar cada pocos
 * minutos a coste CERO (desde Supabase) en vez de gastar minutos de GitHub.
 *
 * Qué hace: entra en Rushour con Playwright y APUNTA todas las llamadas que la
 * web hace por debajo (URL, método, si lleva token, qué devuelve). Lo guarda en
 * robot_log y robot_debug. No escribe ni un dato de ventas.
 */
import { chromium } from 'playwright';
import { log, volcar } from './_lib/bandeja.js';

const P = 'sonda_rushour';
const LOGIN = 'https://manager.rushour.io/login';

interface Llamada { metodo: string; url: string; estado: number; tipo: string; auth: string; muestra: string }

async function main() {
  await log(P, 'inicio', 'buscando si Rushour se puede leer sin navegador');
  const user = process.env.RUSHOUR_USER || '';
  const pass = process.env.RUSHOUR_PASS || '';
  if (!user || !pass) { await log(P, 'sin_credenciales', 'faltan RUSHOUR_USER/RUSHOUR_PASS'); return; }

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ timezoneId: 'Europe/Madrid', locale: 'es-ES' });
  const page = await ctx.newPage();
  const llamadas: Llamada[] = [];

  page.on('response', async (res) => {
    try {
      const req = res.request();
      const url = res.url();
      if (!/api|graphql|rapport|report|order|turnover|stat/i.test(url)) return;
      if (/\.(js|css|png|jpg|svg|woff2?|ico)(\?|$)/i.test(url)) return;
      const ct = (res.headers()['content-type'] || '').split(';')[0];
      if (!/json/i.test(ct)) return;
      const cab = await req.allHeaders();
      const auth = cab['authorization'] ? 'Bearer' : (cab['cookie'] ? 'cookie' : 'ninguno');
      let muestra = '';
      try { muestra = (await res.text()).slice(0, 400); } catch { /* noop */ }
      llamadas.push({ metodo: req.method(), url, estado: res.status(), tipo: ct, auth, muestra });
    } catch { /* noop */ }
  });

  try {
    await page.goto(LOGIN, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await page.locator('input[type="email"], input[name="email"], input[type="text"]').first().fill(user).catch(() => {});
    await page.locator('input[type="password"]').first().fill(pass).catch(() => {});
    await page.getByRole('button', { name: /login|entrar|sign in|connexion|iniciar/i }).first().click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(12000);

    // Paseo por las pantallas con datos en vivo
    for (const ruta of ['https://manager.rushour.io/', 'https://manager.rushour.io/rapports']) {
      await page.goto(ruta, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(10000);
    }

    const resumen = llamadas.map((l) => `${l.metodo} ${l.estado} auth=${l.auth} ${l.url}`).join('\n');
    await volcar('sonda_rushour_llamadas', JSON.stringify(llamadas, null, 2));
    await log(P, 'resultado', `${llamadas.length} llamadas JSON detectadas`);
    if (resumen) await log(P, 'llamadas', resumen.slice(0, 4000));
  } catch (e: any) {
    await log(P, 'error', String(e?.message || e));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
