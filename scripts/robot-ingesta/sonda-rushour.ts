/**
 * SONDA RUSHOUR · Investigación (no toca datos).
 *
 * Objetivo: averiguar si los datos en vivo de Rushour (facturación y nº de
 * pedidos del día) se pueden leer con una simple llamada HTTP, sin abrir un
 * navegador. Si es que sí, el panel en vivo se puede refrescar cada pocos
 * minutos a coste CERO (desde Supabase) en vez de gastar minutos de GitHub.
 *
 * v2: captura TODAS las respuestas JSON (menos ruido de terceros) y comprueba
 * de verdad si el login ha entrado.
 */
import { chromium } from 'playwright';
import { log, volcar } from './_lib/bandeja.js';

const P = 'sonda_rushour';
const LOGIN = 'https://manager.rushour.io/login';
const RUIDO = /locize|stripe|google|sentry|segment|hotjar|intercom|amplitude|datadog|cloudflare|gstatic/i;

interface Llamada { metodo: string; url: string; estado: number; auth: string; muestra: string }

async function main() {
  await log(P, 'inicio', 'v2 · buscando si Rushour se puede leer sin navegador');
  const user = process.env.RUSHOUR_USER || '';
  const pass = process.env.RUSHOUR_PASS || '';
  if (!user || !pass) { await log(P, 'sin_credenciales', 'faltan RUSHOUR_USER/RUSHOUR_PASS'); return; }

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ timezoneId: 'Europe/Madrid', locale: 'es-ES' });
  const page = await ctx.newPage();
  const llamadas: Llamada[] = [];

  page.on('response', async (res) => {
    try {
      const url = res.url();
      if (RUIDO.test(url)) return;
      if (/\.(js|css|png|jpg|jpeg|svg|woff2?|ico|map)(\?|$)/i.test(url)) return;
      const ct = (res.headers()['content-type'] || '');
      if (!/json|graphql/i.test(ct)) return;
      const req = res.request();
      const cab = await req.allHeaders();
      const auth = cab['authorization'] ? 'Bearer' : (cab['cookie'] ? 'cookie' : 'ninguno');
      let muestra = '';
      try { muestra = (await res.text()).slice(0, 300); } catch { /* noop */ }
      llamadas.push({ metodo: req.method(), url, estado: res.status(), auth, muestra });
    } catch { /* noop */ }
  });

  try {
    await page.goto(LOGIN, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    const campos = await page.locator('input').count().catch(() => 0);
    await page.locator('input[type="email"], input[name="email"], input[type="text"]').first().fill(user).catch(() => {});
    await page.locator('input[type="password"]').first().fill(pass).catch(() => {});
    await page.getByRole('button', { name: /login|entrar|sign in|connexion|iniciar|acceder/i }).first().click({ timeout: 10000 }).catch(async () => {
      await page.locator('button[type="submit"]').first().click({ timeout: 5000 }).catch(() => {});
    });
    await page.waitForTimeout(15000);

    const urlTrasLogin = page.url();
    const entrado = !/login/i.test(urlTrasLogin);
    await log(P, entrado ? 'login_ok' : 'login_ko', `inputs=${campos} url=${urlTrasLogin}`);
    if (!entrado) await volcar('sonda_rushour_login', await page.content());

    for (const ruta of ['https://manager.rushour.io/', 'https://manager.rushour.io/rapports']) {
      await page.goto(ruta, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(10000);
    }

    const utiles = llamadas.filter((l) => !/manager\.rushour\.io\/(login|static)/i.test(l.url));
    await volcar('sonda_rushour_llamadas', JSON.stringify(utiles, null, 2));
    await log(P, 'resultado', `${utiles.length} llamadas JSON`);
    const resumen = utiles.map((l) => `${l.metodo} ${l.estado} auth=${l.auth} ${l.url}`).join('\n');
    if (resumen) await log(P, 'llamadas', resumen.slice(0, 6000));
  } catch (e: any) {
    await log(P, 'error', String(e?.message || e));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
