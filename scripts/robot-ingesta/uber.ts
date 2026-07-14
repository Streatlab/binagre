/**
 * ROBOT UBER EATS · Descarga informes y los deja en la bandeja.
 *
 * ENTRADA: sesión sembrada (cookies del navegador de Rubén en
 * sesiones/uber__streatlab.json). Uber bloquea el login automático desde
 * servidores, así que la sesión es el camino. Si caduca: correo → "Más opciones"
 * → CORREO ELECTRÓNICO → el código llega a direccion@streatlab.com y se lee por
 * IMAP (buzones_otp).
 *
 * DESCARGA (14-jul-2026): la sección "Informes" (/manager/reports) lista informes
 * ya generados con estado "Disponible" y un menú "Acción" por fila con la descarga.
 * El robot: 1) abre Informes, 2) en la fila más reciente disponible abre Acción y
 * pulsa Descargar, 3) si no hay ninguno, pulsa "Solicitar de nuevo" en el último y
 * espera a que se genere.
 *
 * Modos (env MODO): diario | semanal | mensual | backfill (MES=AAAA-MM)
 */
import type { Page, BrowserContext } from 'playwright';
import { entregar, log, volcar, hoyMadrid } from './_lib/bandeja.js';
import { cuentasDe, esperarCodigo, guardarSesion, type Cuenta } from './_lib/portal.js';
import { abrir, quitarEstorbos, capturar } from './_lib/navegador.js';

const P = 'uber';
const RAIZ = 'https://merchants.ubereats.com';
const MODO = (process.env.MODO || 'diario').toLowerCase();
const MES = process.env.MES || '';

const RE_MAS = /m[aá]s opciones|otras opciones|otra forma|otro m[eé]todo|more options|try another way|enlace/i;
const RE_CORREO = /correo electr[oó]nico|email|e-mail/i;
const RE_SEGUIR = /^(continuar|siguiente|continue|next|acceder|iniciar sesi[oó]n|verificar)$/i;

async function dentro(page: Page): Promise<boolean> {
  const u = page.url();
  return /merchants\.ubereats\.com/i.test(u) && !/auth\.uber\.com|\/login|\/signin/i.test(u);
}

async function seguir(page: Page) {
  const b = page.getByRole('button', { name: RE_SEGUIR }).first();
  if (await b.count().catch(() => 0)) await b.click({ timeout: 8000 }).catch(() => {});
  else await page.keyboard.press('Enter').catch(() => {});
  await page.waitForTimeout(6000);
}

async function entrar(page: Page, ctx: BrowserContext, c: Cuenta): Promise<boolean> {
  await page.goto(`${RAIZ}/manager/`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(7000);
  await quitarEstorbos(page);
  if (await dentro(page)) { await log(P, 'sesion_ok', `${c.cuenta}: sesión sembrada válida`); return true; }

  const email = page.locator('#PHONE_NUMBER_or_EMAIL_ADDRESS, input[type="email"], input[name="email"]').first();
  if (await email.count().catch(() => 0)) {
    await email.click({ timeout: 8000 }).catch(() => {});
    await email.type(c.usuario, { delay: 90 }).catch(() => {});
    const pedidoEn = new Date();
    await seguir(page);

    for (let i = 0; i < 3; i++) {
      if (await page.locator('input[autocomplete="one-time-code"], input[maxlength="1"]').count().catch(() => 0)) break;
      const mas = page.locator('button, a, [role="button"], span[tabindex]').filter({ hasText: RE_MAS }).first();
      if (await mas.count().catch(() => 0)) { await mas.click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(3000); }
      const correo = page.locator('button, a, li, label, div[role="button"], [role="radio"]').filter({ hasText: RE_CORREO }).first();
      if (await correo.count().catch(() => 0)) { await correo.click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(2500); await seguir(page); }
    }

    const codigo = await esperarCodigo(P, c.otp_remitente || 'uber.com', 240, pedidoEn, c.usuario);
    if (codigo) {
      const huecos = page.locator('input[autocomplete="one-time-code"], input[maxlength="1"], input[name*="code" i]');
      const n = await huecos.count().catch(() => 0);
      if (n >= codigo.length) for (let i = 0; i < codigo.length; i++) await huecos.nth(i).fill(codigo[i]).catch(() => {});
      else await huecos.first().type(codigo, { delay: 130 }).catch(() => {});
      await seguir(page);
    }
  }

  const ok = await dentro(page);
  await log(P, ok ? 'login_ok' : 'login_ko', `${c.cuenta} · url=${page.url()}`);
  if (!ok) await volcar(`${P}_login_ko`, await page.content().catch(() => ''));
  else await guardarSesion(P, c.cuenta, ctx);
  return ok;
}

/** Informes de Uber: descarga el informe disponible más reciente. */
async function bajarInforme(page: Page, periodo: string): Promise<boolean> {
  await page.goto(`${RAIZ}/manager/reports`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(8000);
  await quitarEstorbos(page);

  // 1) Filas con estado Disponible → menú Acción → Descargar
  const filas = page.locator('tr, [role="row"]').filter({ hasText: /disponible|available/i });
  const n = Math.min(await filas.count().catch(() => 0), 4);

  for (let i = 0; i < n; i++) {
    const fila = filas.nth(i);
    const f = await capturar(page, P, async () => {
      const accion = fila.getByRole('button').last().or(fila.locator('button, [role="button"]').last());
      if (await accion.count().catch(() => 0)) { await accion.click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(2500); }
      const desc = page.getByRole('menuitem', { name: /descargar|download/i }).first()
        .or(page.getByRole('button', { name: /descargar|download/i }).first())
        .or(page.locator('li, a').filter({ hasText: /descargar|download/i }).first());
      if (await desc.count().catch(() => 0)) await desc.click({ timeout: 6000 }).catch(() => {});
    }, 90);

    if (f) {
      await log(P, 'descarga', `informe: ${f.nombre} (${f.datos.length} bytes)`);
      await entregar({ fuente: P, tipo: 'uber_informe', nombre: f.nombre, datos: f.datos, periodo, destino: 'ventas' });
      return true;
    }
  }

  // 2) Nada disponible: pedir de nuevo el último informe y esperar a que se genere
  const rehacer = page.getByRole('button', { name: /solicitar de nuevo|request again/i }).first()
    .or(page.locator('button, [role="button"]').filter({ hasText: /solicitar de nuevo/i }).first());
  if (await rehacer.count().catch(() => 0)) {
    await rehacer.click({ timeout: 8000 }).catch(() => {});
    await log(P, 'aviso', 'informe solicitado de nuevo; se descargará en la siguiente pasada');
    await page.waitForTimeout(60000);
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(8000);
    const f = await capturar(page, P, async () => {
      const fila = page.locator('tr, [role="row"]').filter({ hasText: /disponible|available/i }).first();
      const accion = fila.locator('button, [role="button"]').last();
      if (await accion.count().catch(() => 0)) { await accion.click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(2500); }
      const desc = page.getByRole('menuitem', { name: /descargar|download/i }).first();
      if (await desc.count().catch(() => 0)) await desc.click({ timeout: 6000 }).catch(() => {});
    }, 120);
    if (f) {
      await entregar({ fuente: P, tipo: 'uber_informe', nombre: f.nombre, datos: f.datos, periodo, destino: 'ventas' });
      await log(P, 'descarga', `informe (tras solicitar): ${f.nombre}`);
      return true;
    }
  }

  await volcar(`${P}_informes`, await page.content().catch(() => ''));
  await log(P, 'sin_descarga', 'informes: no he podido bajar ninguno (pantalla volcada)');
  return false;
}

async function trabajarCuenta(c: Cuenta) {
  const { browser, ctx, page } = await abrir(P, c.cuenta);
  try {
    if (!(await entrar(page, ctx, c))) return;
    const periodo = MODO === 'backfill' && /^\d{4}-\d{2}$/.test(MES) ? MES : hoyMadrid(1);
    await bajarInforme(page, periodo);
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
  if (cuentas.length === 0) { await log(P, 'sin_credenciales', 'no hay cuentas activas de Uber'); return; }
  for (const c of cuentas) await trabajarCuenta(c);
  await log(P, 'fin', `${cuentas.length} cuenta(s)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
