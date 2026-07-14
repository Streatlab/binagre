/**
 * ROBOT SINQRO · Los pedidos de Just Eat viven aquí. Entra SIEMPRE por
 * panel.sinqro.com (NO por app.sinqro.com) y baja los informes del punto de venta.
 *
 * 15-jul-2026 · Los volcados enseñaron el mapa real: los informes NO están en
 * /report a secas, sino como INFORMES CONCRETOS bajo /reports/<uuid> (6 del punto
 * de venta y 10 del negocio, enlaces "Ver"). El robot entra en cada uno, pulsa
 * generar/buscar si hace falta y baja lo que suelte. Las facturas cuelgan de
 * /billing_accounts/<id> con enlaces directos.
 *
 * Login: robot_credenciales (plataforma='sinqro'). Código por correo si lo pide:
 * IMAP del buzón de la cuenta (buzones_otp).
 */
import type { Page, BrowserContext } from 'playwright';
import { entregar, log, volcar, hoyMadrid } from './_lib/bandeja.js';
import { cuentasDe, esperarCodigo, guardarSesion, type Cuenta } from './_lib/portal.js';
import { abrir, quitarEstorbos, descargarDeLaPagina, bajarEnlaces } from './_lib/navegador.js';

const P = 'sinqro';
const PANEL = 'https://panel.sinqro.com';          // ← nunca app.sinqro.com
const PUNTO_VENTA = '3976805';
const NEGOCIO = '3976804';
const MODO = (process.env.MODO || 'diario').toLowerCase();
const MES = process.env.MES || '';

// Informes reales sacados de los volcados del 14-jul (enlaces "Ver").
const INFORMES_PV = [
  'a1c65330-e574-11ed-b711-0a45390d346d',
  'db45a292-ac3d-11ec-9df1-0af3e1ac2047',
  'ea4bc8ac-19c7-11f0-b6d7-0a908e191b4f',
  '6954d855-dba0-11ee-8d50-0a45390d346d',
  '67950c6b-7bd5-11ed-b711-0a45390d346d',
  '60deafe8-47c8-11f1-b6d7-0a908e191b4f',
];
const INFORMES_NEG = [
  '6bcfa718-6507-11ed-b711-0a45390d346d',
  '16c388c7-7e89-11ec-8e1b-0a3b86cabde9',
  '5394c5d6-58b2-11f0-b6d7-0a908e191b4f',
  '6c5d11aa-f9de-11ef-b169-0a908e191b4f',
  'ceca93a5-3247-11f0-b6d7-0a908e191b4f',
];
const CUENTAS_FACTURACION = ['3956530', '8644027'];

async function dentro(page: Page): Promise<boolean> {
  if (await page.locator('input[type="password"]').count().catch(() => 0)) return false;
  return !/\/(login|signin|sign_in|auth)/i.test(page.url());
}

async function entrar(page: Page, ctx: BrowserContext, c: Cuenta): Promise<boolean> {
  await page.goto(PANEL, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(5000);
  await quitarEstorbos(page);
  if (await dentro(page)) { await log(P, 'sesion_ok', `${c.cuenta}: sesión guardada todavía válida`); return true; }

  const email = page.locator('input[type="email"], input[name="email"], input[name="username"], input[id*="email" i], input[type="text"]').first();
  await email.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  await email.fill(c.usuario).catch(() => {});
  await page.locator('input[type="password"]').first().fill(c.password).catch(() => {});

  const pedidoEn = new Date();
  await page.getByRole('button', { name: /entrar|acceder|log ?in|iniciar|continuar|sign in/i }).first()
    .click({ timeout: 10000 })
    .catch(async () => { await page.keyboard.press('Enter').catch(() => {}); });
  await page.waitForTimeout(9000);
  await quitarEstorbos(page);

  if (!(await dentro(page))) {
    const hayOtp = await page.locator('input[autocomplete="one-time-code"], input[maxlength="1"], input[name*="code" i]').count().catch(() => 0);
    if (hayOtp) {
      const codigo = await esperarCodigo(P, 'sinqro', 240, pedidoEn, c.usuario);
      if (codigo) {
        await page.locator('input[autocomplete="one-time-code"], input[maxlength="1"], input[name*="code" i]').first().type(codigo, { delay: 120 }).catch(() => {});
        await page.keyboard.press('Enter').catch(() => {});
        await page.waitForTimeout(8000);
      }
    }
  }

  const ok = await dentro(page);
  await log(P, ok ? 'login_ok' : 'login_ko', `${c.cuenta} · url=${page.url()}`);
  if (ok) await guardarSesion(P, c.cuenta, ctx);
  else await volcar(`${P}_login_ko`, await page.content().catch(() => ''));
  return ok;
}

/** Dentro de un informe: pulsar generar/buscar si existe y bajar lo que suelte. */
async function bajarInforme(page: Page, url: string, tipo: string, periodo: string, cuenta: string): Promise<boolean> {
  await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(6000);
  await quitarEstorbos(page);

  const generar = page.getByRole('button', { name: /generar|buscar|aplicar|consultar|ver informe/i }).first();
  if (await generar.count().catch(() => 0)) {
    await generar.click({ timeout: 8000 }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(8000);
  }

  const f = await descargarDeLaPagina(P, page, `${tipo}_${cuenta}`);
  if (!f) return false;
  await entregar({ fuente: P, tipo, nombre: `${cuenta}_${f.nombre}`, datos: f.datos, periodo, destino: 'ventas' });
  return true;
}

/** Cuentas de facturación: bajar los PDF enlazados. */
async function facturas(page: Page, periodo: string, cuenta: string): Promise<boolean> {
  let alguno = false;
  for (const id of CUENTAS_FACTURACION) {
    await page.goto(`${PANEL}/billing_accounts/${id}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(6000);
    await quitarEstorbos(page);
    await volcar(`${P}_billing_${id}`, await page.content().catch(() => ''));
    const ficheros = await bajarEnlaces(P, page, `factura_${id}_${cuenta}`, 12);
    for (const f of ficheros) {
      await entregar({ fuente: P, tipo: 'sinqro_factura', nombre: `${cuenta}_${f.nombre}`, datos: f.datos, periodo, destino: 'facturas' });
      alguno = true;
    }
  }
  return alguno;
}

async function trabajarCuenta(c: Cuenta) {
  const { browser, ctx, page } = await abrir(P, c.cuenta);
  try {
    if (!(await entrar(page, ctx, c))) return;
    const periodo = MODO === 'backfill' && /^\d{4}-\d{2}$/.test(MES) ? MES : hoyMadrid(1);

    let alguno = false;
    for (const uuid of INFORMES_PV) {
      if (await bajarInforme(page, `${PANEL}/selling_point_accounts/${PUNTO_VENTA}/reports/${uuid}`, `sinqro_informe_pv_${uuid.slice(0, 8)}`, periodo, c.cuenta)) alguno = true;
    }
    for (const uuid of INFORMES_NEG) {
      if (await bajarInforme(page, `${PANEL}/business_accounts/${NEGOCIO}/reports/${uuid}`, `sinqro_informe_neg_${uuid.slice(0, 8)}`, periodo, c.cuenta)) alguno = true;
    }
    if (await facturas(page, periodo, c.cuenta)) alguno = true;

    if (!alguno) await log(P, 'aviso', 'ningún informe soltó fichero; revisar volcados sinqro_* en robot_debug');
  } catch (e: any) {
    await log(P, 'error', `${c.cuenta}: ${e?.message || e}`);
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
