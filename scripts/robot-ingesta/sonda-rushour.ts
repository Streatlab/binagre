/**
 * SONDA RUSHOUR v3 · Investigación (no toca datos).
 *
 * Ya sabemos (v2) que Rushour funciona así por debajo:
 *   · Acceso: AWS Cognito (cognito-idp.eu-west-2) → devuelve un token
 *   · Datos en vivo: GET .../production/statsv3/restaurants/<id>/stats?from&to
 *     con ese token → facturación y pedidos del día, incluso por horas
 * Eso significa que se puede leer SIN navegador → panel en vivo a coste 0.
 *
 * Esta sonda captura lo que falta para montarlo: el identificador de cliente de
 * Cognito y un ejemplo de respuesta de stats.
 */
import { chromium } from 'playwright';
import { log, volcar } from './_lib/bandeja.js';

const P = 'sonda_rushour';
const LOGIN = 'https://manager.rushour.io/login';

async function main() {
  await log(P, 'inicio', 'v3 · sacando ClientId de Cognito y ejemplo de stats');
  const user = process.env.RUSHOUR_USER || '';
  const pass = process.env.RUSHOUR_PASS || '';
  if (!user || !pass) { await log(P, 'sin_credenciales', 'faltan RUSHOUR_USER/RUSHOUR_PASS'); return; }

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ timezoneId: 'Europe/Madrid', locale: 'es-ES' });
  const page = await ctx.newPage();
  const hallazgos: Record<string, unknown> = {};

  page.on('request', (req) => {
    const url = req.url();
    if (/cognito-idp/i.test(url)) {
      const cuerpo = req.postData() || '';
      // El cuerpo lleva ClientId y AuthFlow. Quitamos la contraseña antes de guardar.
      const limpio = cuerpo.replace(new RegExp(pass.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '***');
      const cab = req.headers();
      hallazgos[`cognito_${Object.keys(hallazgos).length}`] = {
        target: cab['x-amz-target'] || null,
        cuerpo: limpio.slice(0, 800),
      };
    }
  });

  page.on('response', async (res) => {
    const url = res.url();
    if (/statsv3\/restaurants\/.+\/stats/i.test(url) && !hallazgos.stats_ejemplo) {
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
    await page.getByRole('button', { name: /login|entrar|sign in|connexion|iniciar|acceder/i }).first().click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(20000);
    await page.goto('https://manager.rushour.io/', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(12000);

    await volcar('sonda_rushour_v3', JSON.stringify(hallazgos, null, 2));
    await log(P, 'v3_ok', `claves halladas: ${Object.keys(hallazgos).join(', ')}`);
  } catch (e: any) {
    await log(P, 'error', String(e?.message || e));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
