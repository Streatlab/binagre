/**
 * SONDA RUSHOUR v4 · Investigación (no toca datos).
 *
 * Confirmado en v2: Rushour usa AWS Cognito para el acceso y una API de stats
 * (statsv3/restaurants/<id>/stats?from&to) con token Bearer. O sea: se puede
 * leer SIN navegador → panel en vivo a coste 0.
 *
 * v4 recupera el login que sí funcionó en v2 y captura lo que falta:
 * el identificador de cliente de Cognito y un ejemplo de respuesta de stats.
 */
import { chromium } from 'playwright';
import { log, volcar } from './_lib/bandeja.js';

const P = 'sonda_rushour';
const LOGIN = 'https://manager.rushour.io/login';

async function main() {
  await log(P, 'inicio', 'v4 · ClientId de Cognito + ejemplo de stats');
  const user = process.env.RUSHOUR_USER || '';
  const pass = process.env.RUSHOUR_PASS || '';
  if (!user || !pass) { await log(P, 'sin_credenciales', 'faltan RUSHOUR_USER/RUSHOUR_PASS'); return; }

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ timezoneId: 'Europe/Madrid', locale: 'es-ES' });
  const page = await ctx.newPage();
  const hallazgos: Record<string, unknown> = {};
  let cognitoVistos = 0;

  const oculta = (s: string) =>
    s.replace(new RegExp(pass.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '***');

  page.on('request', (req) => {
    const url = req.url();
    if (/cognito-idp/i.test(url)) {
      cognitoVistos++;
      const cab = req.headers();
      hallazgos[`cognito_${cognitoVistos}`] = {
        target: cab['x-amz-target'] || null,
        cuerpo: oculta(req.postData() || '').slice(0, 800),
      };
    }
  });

  page.on('response', async (res) => {
    const url = res.url();
    if (/stats/i.test(url) && !hallazgos.stats_ejemplo && res.status() === 200) {
      try {
        hallazgos.stats_url = url;
        hallazgos.stats_ejemplo = (await res.text()).slice(0, 1500);
      } catch { /* noop */ }
    }
  });

  try {
    await page.goto(LOGIN, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    await page.locator('input[type="email"], input[name="email"], input[type="text"]').first().fill(user).catch(() => {});
    await page.locator('input[type="password"]').first().fill(pass).catch(() => {});
    await page.getByRole('button', { name: /login|entrar|sign in|connexion|iniciar|acceder/i }).first().click({ timeout: 10000 }).catch(async () => {
      await page.locator('button[type="submit"]').first().click({ timeout: 5000 }).catch(() => {});
    });
    await page.waitForTimeout(15000);
    const entrado = !/login/i.test(page.url());
    await log(P, entrado ? 'login_ok' : 'login_ko', `url=${page.url()} cognito=${cognitoVistos}`);

    for (const ruta of ['https://manager.rushour.io/', 'https://manager.rushour.io/rapports']) {
      await page.goto(ruta, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(10000);
    }

    await volcar('sonda_rushour_v4', JSON.stringify(hallazgos, null, 2));
    await log(P, 'v4_ok', `cognito=${cognitoVistos} · claves: ${Object.keys(hallazgos).join(', ') || 'ninguna'}`);
  } catch (e: any) {
    await log(P, 'error', String(e?.message || e));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
