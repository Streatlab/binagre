/**
 * ROBOT SINQRO · Descarga los informes de ventas de Sinqro (agregador donde vive
 * Just Eat) y los deja en la bandeja de Papeleo. Just Eat NO tiene informes en su
 * portal: sus ventas salen de aquí.
 *
 * Login: usuario+contraseña de la tabla robot_credenciales (plataforma='sinqro').
 * Si pide código por correo, se lee POR IMAP del buzón de la cuenta (buzones_otp).
 *
 * Primera pasada exploratoria (14-jul-2026): entra, vuelca la pantalla inicial a
 * robot_debug para mapear el menú, y prueba la descarga genérica en las rutas más
 * probables de informes. Con el volcado se afinará la ruta exacta.
 *
 * Modos (env MODO): diario | semanal | mensual | backfill (MES=AAAA-MM)
 */
import type { Page, BrowserContext } from 'playwright';
import { entregar, log, volcar, hoyMadrid } from './_lib/bandeja.js';
import { cuentasDe, esperarCodigo, guardarSesion, type Cuenta } from './_lib/portal.js';
import { abrir, quitarEstorbos, descargarDeLaPagina } from './_lib/navegador.js';

const P = 'sinqro';
const MODO = (process.env.MODO || 'diario').toLowerCase();
const MES = process.env.MES || '';

async function dentro(page: Page): Promise<boolean> {
  let ruta = '';
  try { ruta = new URL(page.url()).pathname; } catch { ruta = page.url(); }
  if (/\/(login|signin|sign-in|auth|2fa|otp|verify)/i.test(ruta)) return false;
  if (await page.locator('input[type="password"]').count().catch(() => 0)) return false;
  return true;
}

async function entrar(page: Page, ctx: BrowserContext, c: Cuenta): Promise<boolean> {
  const base = c.url_base || 'https://panel.sinqro.com';
  await page.goto(base, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(5000);
  await quitarEstorbos(page);
  if (await dentro(page)) { await log(P, 'sesion_ok', `${c.cuenta}: sesión guardada todavía válida`); return true; }

  const email = page.locator('input[type="email"], input[name="email"], input[name="username"], input[id*="email" i], input[type="text"]').first();
  await email.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  await email.fill(c.usuario).catch(() => {});
  const pass = page.locator('input[type="password"]').first();
  if (await pass.count().catch(() => 0)) await pass.fill(c.password).catch(() => {});
  else { await page.keyboard.press('Enter'); await page.waitForTimeout(4000); await page.locator('input[type="password"]').first().fill(c.password).catch(() => {}); }

  const pedidoEn = new Date();
  await page.getByRole('button', { name: /entrar|acceder|log ?in|iniciar|continuar|sign in|submit/i }).first().click({ timeout: 10000 }).catch(async () => { await page.keyboard.press('Enter').catch(() => {}); });
  await page.waitForTimeout(9000);
  await quitarEstorbos(page);

  if (!(await dentro(page))) {
    // Por si Sinqro pide código por correo
    const hayOtp = await page.locator('input[autocomplete="one-time-code"], input[maxlength="1"], input[name*="code" i]').count().catch(() => 0);
    if (hayOtp) {
      const codigo = await esperarCodigo(P, 'sinqro', 240, pedidoEn, c.usuario);
      if (codigo) {
        const hueco = page.locator('input[autocomplete="one-time-code"], input[maxlength="1"], input[name*="code" i]').first();
        await hueco.type(codigo, { delay: 120 }).catch(() => {});
        await page.keyboard.press('Enter').catch(() => {});
        await page.waitForTimeout(8000);
      }
    }
  }

  const ok = await dentro(page);
  await log(P, ok ? 'login_ok' : 'login_ko', `${c.cuenta} · url=${page.url()}`);
  await volcar(`${P}_${ok ? 'panel' : 'login_ko'}`, await page.content().catch(() => ''));
  if (ok) await guardarSesion(P, c.cuenta, ctx);
  return ok;
}

async function seccion(page: Page, ruta: string, tipo: string, periodo: string, cuenta: string) {
  await page.goto(ruta, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(6000);
  await quitarEstorbos(page);
  const f = await descargarDeLaPagina(P, page, `${tipo}_${cuenta}`);
  if (!f) return false;
  await entregar({ fuente: P, tipo, nombre: `${cuenta}_${f.nombre}`, datos: f.datos, periodo, destino: 'ventas' });
  return true;
}

async function trabajarCuenta(c: Cuenta) {
  const { browser, ctx, page } = await abrir(P, c.cuenta);
  try {
    if (!(await entrar(page, ctx, c))) return;
    const base = (c.url_base || 'https://panel.sinqro.com').replace(/\/$/, '');
    const ayer = hoyMadrid(1);
    const periodo = MODO === 'backfill' && /^\d{4}-\d{2}$/.test(MES) ? MES : ayer;

    // Rutas candidatas de informes; para cuando el volcado del panel diga otra cosa, se afina.
    const rutas = ['/reports', '/informes', '/orders', '/pedidos', '/sales', '/ventas', '/stats', '/estadisticas'];
    let alguna = false;
    for (const r of rutas) {
      const ok = await seccion(page, `${base}${r}`, 'sinqro_ventas', periodo, c.cuenta);
      if (ok) { alguna = true; break; }
    }
    if (!alguna) await log(P, 'aviso', 'ninguna ruta candidata soltó fichero; revisar volcados sinqro_* en robot_debug');
  } catch (e: any) {
    await log(P, 'error', `${c.cuenta}: ${e?.message || e}`);
    await volcar(`${P}_error`, await page.content().catch(() => ''));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

async function main() {
  await log(P, 'inicio', `modo=${MODO}${MES ? ` mes=${MES}` : ''}`);
  const cuentas = await cuentasDe(P);
  if (cuentas.length === 0) { await log(P, 'sin_credenciales', 'no hay cuentas activas de Sinqro'); return; }
  for (const c of cuentas) await trabajarCuenta(c);
  await log(P, 'fin', `${cuentas.length} cuenta(s)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
