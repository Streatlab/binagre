/**
 * ROBOT PANTALLAS UBER EATS · 22-jul-2026
 *
 * PARA QUÉ. Hay datos del portal de Uber que NO salen en ningún informe
 * descargable y solo se ven en pantalla:
 *   · Evaluación comparativa del mercado (nosotros vs competencia)
 *   · Segmentos de cliente (nuevo / ocasional / frecuente) y su repetición
 *   · Ventas por hora (mapa día × hora) y horas pico
 *   · Códigos postales de entrega
 *   · Operaciones (fallos, reembolsos, tasa online) al detalle
 * Este robot entra, mira esas pantallas y guarda lo que ve. Lo que SÍ se
 * exporta (ganancias, artículos, facturas) lo sigue trayendo uber.ts; aquí no
 * se descarga nada.
 *
 * CUÁNDO. Lunes 02:00 Madrid. Uber refresca la comparativa de mercado el
 * domingo de madrugada, así que el lunes a las 02:00 el dato de la semana
 * cerrada ya está firme. A esa hora no corre ningún otro robot y no se pisa la
 * sesión de Uber con la pasada de las 04:00.
 *
 * CÓMO GUARDA. Dos redes, por si una falla:
 *   1) JSON de red: se escuchan las respuestas del propio panel de Uber (que es
 *      de donde la pantalla saca sus cifras) y se guardan enteras.
 *   2) Texto visible: se guarda el texto de la pantalla tal cual se lee. Aunque
 *      Uber cambie sus APIs internas, el dato sigue estando.
 * Todo va a la tabla uber_pantallas, con huella para no duplicar. El robot NO
 * interpreta nada: eso lo hace después el ERP, igual que con la bandeja.
 *
 * TIENDAS. La primera vez descubre las tiendas desde el selector del portal y
 * las guarda en uber_tiendas; a partir de ahí trabaja con esa lista. Si el
 * descubrimiento falla, hace al menos la pasada global (todas las tiendas).
 */
import { createHash } from 'crypto';
import type { Page, BrowserContext, Response } from 'playwright';
import { sb, log, volcar, hoyMadrid, latido, objetivoPendiente, registrarIntento, marcarConseguido } from './_lib/bandeja.js';
import { cuentasDe, esperarCodigo, guardarSesion, type Cuenta } from './_lib/portal.js';
import { abrir, quitarEstorbos } from './_lib/navegador.js';
import { semanaCerrada } from './_lib/periodos.js';

const P = 'uber_pantallas';
const RAIZ = 'https://merchants.ubereats.com';
const SIMULACRO = process.env.ROBOT_DRY === '1';
// Tope de minutos de la corrida: va guardando sobre la marcha, así que si se
// agota el tiempo lo capturado hasta ese punto ya está a salvo.
const MAX_MIN = Number(process.env.UBER_PANTALLAS_MAX_MIN || 50);
// Cuántas tiendas recorrer como mucho (28 hoy; margen por si crecen).
const MAX_TIENDAS = Number(process.env.UBER_PANTALLAS_MAX_TIENDAS || 40);
// Solo una tienda concreta, para pruebas.
const SOLO_TIENDA = process.env.UBER_PANTALLAS_TIENDA || '';

const RE_MAS = /m[aá]s opciones|otras opciones|otra forma|otro m[eé]todo|more options|try another way|enlace/i;
const RE_CORREO = /correo electr[oó]nico|email|e-mail/i;
const RE_SEGUIR = /^(continuar|siguiente|continue|next|acceder|iniciar sesi[oó]n|verificar)$/i;
const RE_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

interface Pantalla { clave: string; ruta: (uuid: string) => string; }

const PANTALLAS: Pantalla[] = [
  { clave: 'ventas', ruta: (u) => `/manager/home/${u}/analytics/sales-v2` },
  { clave: 'operaciones', ruta: (u) => `/manager/home/${u}/analytics/operations` },
  { clave: 'clientes', ruta: (u) => `/manager/home/${u}/analytics` },
  { clave: 'mercado', ruta: (u) => `/manager/competitive-insights?restaurantUUID=${u}` },
];

// Pantallas globales (todas las tiendas): la ruta no lleva uuid de tienda.
const PANTALLAS_GLOBALES: Array<{ clave: string; ruta: string }> = [
  { clave: 'ventas_global', ruta: '/manager/analytics/sales-v2' },
  { clave: 'operaciones_global', ruta: '/manager/analytics/operations' },
];

const t0 = Date.now();
function quedaTiempo(): boolean { return Date.now() - t0 < MAX_MIN * 60_000; }

/* ─────────────────────────── entrada al portal ─────────────────────────── */

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

    const codigo = await esperarCodigo('uber', c.otp_remitente || 'uber.com', 240, pedidoEn, c.usuario);
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
  else await guardarSesion('uber', c.cuenta, ctx);
  return ok;
}

/* ─────────────────────────────── guardado ──────────────────────────────── */

interface Guardado {
  periodo: string;
  pantalla: string;
  marcaUuid: string | null;
  marcaNombre: string | null;
  endpoint: string;
  payload: any;
}

async function guardar(g: Guardado): Promise<boolean> {
  const crudo = JSON.stringify(g.payload ?? null);
  const huella = createHash('sha256').update(`${g.pantalla}|${g.marcaUuid || ''}|${crudo}`).digest('hex');
  if (SIMULACRO) {
    await log(P, 'simulacro', `${g.pantalla} · ${g.marcaNombre || 'global'} · ${crudo.length} bytes`);
    return false;
  }
  const { error } = await sb.from('uber_pantallas').insert([{
    fecha: hoyMadrid(),
    periodo: g.periodo,
    pantalla: g.pantalla,
    marca_uuid: g.marcaUuid,
    marca_nombre: g.marcaNombre,
    endpoint: g.endpoint.slice(0, 500),
    huella,
    bytes: crudo.length,
    payload: g.payload,
  }]);
  if (error) {
    // 23505 = ya teníamos exactamente este dato para este periodo: es normal.
    if (!/duplicate key|23505/i.test(error.message)) {
      await log(P, 'error', `guardando ${g.pantalla}: ${error.message}`);
      process.exitCode = 1;
    }
    return false;
  }
  return true;
}

/* ──────────────────────── captura de una pantalla ──────────────────────── */

const RE_RUIDO = /\.(js|css|png|jpg|jpeg|svg|gif|woff2?|ico|map)(\?|$)|google|facebook|sentry|segment|datadog|braze|optimizely/i;

/**
 * Abre una pantalla y se queda con todo lo que sirva: las respuestas de datos
 * del panel y el texto que se ve.
 */
async function capturarPantalla(
  page: Page,
  pantalla: string,
  ruta: string,
  periodo: string,
  marcaUuid: string | null,
  marcaNombre: string | null,
): Promise<number> {
  const respuestas: Array<{ url: string; cuerpo: any }> = [];

  const oyente = async (r: Response) => {
    try {
      const url = r.url();
      if (!/ubereats\.com|uber\.com/i.test(url) || RE_RUIDO.test(url)) return;
      const ct = (r.headers()['content-type'] || '').toLowerCase();
      if (!ct.includes('json')) return;
      const texto = await r.text().catch(() => '');
      if (!texto || texto.length < 300 || texto.length > 1_500_000) return;
      respuestas.push({ url, cuerpo: JSON.parse(texto) });
    } catch { /* una respuesta ilegible nunca tumba la captura */ }
  };

  page.on('response', oyente);
  try {
    await page.goto(`${RAIZ}${ruta}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(9000);
    await quitarEstorbos(page);
    // Algunas pantallas cargan los bloques de abajo al hacer scroll.
    await page.mouse.wheel(0, 2400).catch(() => {});
    await page.waitForTimeout(3500);
    await page.mouse.wheel(0, 2400).catch(() => {});
    await page.waitForTimeout(3500);
  } finally {
    page.off('response', oyente);
  }

  let guardados = 0;

  // 1) Texto visible: la red de seguridad. Siempre se guarda.
  const texto = await page.locator('body').innerText().catch(() => '');
  if (texto && texto.length > 200) {
    if (await guardar({ periodo, pantalla, marcaUuid, marcaNombre, endpoint: ruta, payload: { formato: 'texto', url: page.url(), texto } })) guardados++;
  }

  // 2) Respuestas de datos del panel, tal cual las devuelve Uber.
  const vistas = new Set<string>();
  for (const r of respuestas.slice(0, 25)) {
    const clave = createHash('sha256').update(JSON.stringify(r.cuerpo)).digest('hex');
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    if (await guardar({ periodo, pantalla, marcaUuid, marcaNombre, endpoint: r.url, payload: { formato: 'json', datos: r.cuerpo } })) guardados++;
  }

  await log(P, guardados ? 'captura' : 'vacio', `${pantalla} · ${marcaNombre || 'todas las tiendas'}: ${guardados} bloque(s)`);
  return guardados;
}

/* ───────────────────────── catálogo de tiendas ─────────────────────────── */

async function tiendasGuardadas(): Promise<Array<{ uuid: string; nombre: string | null }>> {
  try {
    const { data } = await sb.from('uber_tiendas').select('uuid, nombre').eq('activa', true).order('nombre');
    return (data || []) as Array<{ uuid: string; nombre: string | null }>;
  } catch { return []; }
}

/** Recorre el selector de tiendas del portal y apunta uuid + nombre. */
async function descubrirTiendas(page: Page): Promise<Array<{ uuid: string; nombre: string | null }>> {
  const encontradas = new Map<string, string | null>();

  await page.goto(`${RAIZ}/manager/`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(7000);
  await quitarEstorbos(page);

  const selector = () => page.locator('[data-testid="location-selector-button-testid"], [data-testid*="location-selector" i], [data-testid*="store-switcher" i]').first();
  if (!(await selector().count().catch(() => 0))) {
    await volcar('uber_pantallas_sin_selector', await page.content().catch(() => ''));
    await log(P, 'aviso', 'no veo el selector de tiendas; solo haré la pasada global');
    return [];
  }

  const opciones = () => page.locator('[data-baseweb="popover"], [data-baseweb="menu"], [role="dialog"], [role="listbox"], [role="menu"]')
    .locator('[role="option"], [role="menuitem"], li, label, [data-testid*="option" i]');

  await selector().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(2500);

  // Primero: enlaces con el uuid dentro, que es lo más limpio si existen.
  const enlaces = page.locator('a[href*="/manager/home/"]');
  const ne = Math.min(await enlaces.count().catch(() => 0), MAX_TIENDAS + 10);
  for (let i = 0; i < ne; i++) {
    const href = (await enlaces.nth(i).getAttribute('href').catch(() => '')) || '';
    const m = href.match(RE_UUID);
    if (!m) continue;
    const nombre = ((await enlaces.nth(i).textContent().catch(() => '')) || '').trim().slice(0, 80) || null;
    if (!encontradas.has(m[0])) encontradas.set(m[0], nombre);
  }

  // Si no había enlaces, se pincha opción a opción y se lee el uuid de la URL.
  if (encontradas.size === 0) {
    const total = Math.min(await opciones().count().catch(() => 0), MAX_TIENDAS);
    for (let i = 0; i < total && quedaTiempo(); i++) {
      const sel = selector();
      if (await sel.count().catch(() => 0)) { await sel.click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(1800); }
      const opt = opciones().nth(i);
      if (!(await opt.count().catch(() => 0))) break;
      const crudo = ((await opt.textContent().catch(() => '')) || '').trim();
      const nombre = (crudo.split(/calle|c\/|avda|avenida|[0-9a-f]{8}-/i)[0].trim() || `tienda_${i}`).slice(0, 80);
      await opt.click({ timeout: 6000 }).catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(3500);
      const m = page.url().match(RE_UUID);
      if (m && !encontradas.has(m[0])) encontradas.set(m[0], nombre);
    }
  }

  await page.keyboard.press('Escape').catch(() => {});

  if (encontradas.size === 0) {
    await volcar('uber_pantallas_selector', await page.content().catch(() => ''));
    await log(P, 'aviso', 'el selector no soltó ninguna tienda legible');
    return [];
  }

  const filas = [...encontradas.entries()].map(([uuid, nombre]) => ({ uuid, nombre, activa: true, vista_en: new Date().toISOString() }));
  if (!SIMULACRO) {
    const { error } = await sb.from('uber_tiendas').upsert(filas, { onConflict: 'uuid' });
    if (error) await log(P, 'error', `guardando catálogo de tiendas: ${error.message}`);
  }
  await log(P, 'catalogo', `${filas.length} tienda(s) descubiertas`);
  return filas.map(f => ({ uuid: f.uuid, nombre: f.nombre }));
}

/* ────────────────────────────── corrida ────────────────────────────────── */

async function trabajarCuenta(c: Cuenta, periodo: string): Promise<number> {
  const { browser, ctx, page } = await abrir('uber', c.cuenta);
  let bloques = 0;
  try {
    if (!(await entrar(page, ctx, c))) return 0;

    // 1) Pasada global: la foto del conjunto, siempre, aunque falle el resto.
    for (const g of PANTALLAS_GLOBALES) {
      if (!quedaTiempo()) break;
      bloques += await capturarPantalla(page, g.clave, g.ruta, periodo, null, null);
    }

    // 2) Catálogo de tiendas.
    let tiendas = await tiendasGuardadas();
    if (tiendas.length === 0) tiendas = await descubrirTiendas(page);
    if (SOLO_TIENDA) tiendas = tiendas.filter(t => t.uuid === SOLO_TIENDA || (t.nombre || '').toLowerCase().includes(SOLO_TIENDA.toLowerCase()));
    tiendas = tiendas.slice(0, MAX_TIENDAS);

    // 3) Tienda a tienda, las cuatro pantallas.
    for (const t of tiendas) {
      if (!quedaTiempo()) { await log(P, 'aviso', `me quedo sin tiempo tras ${MAX_MIN} min; lo capturado ya está guardado`); break; }
      for (const p of PANTALLAS) {
        if (!quedaTiempo()) break;
        bloques += await capturarPantalla(page, p.clave, p.ruta(t.uuid), periodo, t.uuid, t.nombre);
      }
    }

    await log(P, 'fin_cuenta', `${c.cuenta}: ${tiendas.length} tienda(s), ${bloques} bloque(s) guardados`);
  } catch (e: any) {
    await log(P, 'error', `${c.cuenta}: ${e?.message || e}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
  return bloques;
}

async function main() {
  const sem = semanaCerrada();
  await log(P, 'inicio', `semana ${sem.periodo} (${sem.from} a ${sem.to})`);

  const cuentas = await cuentasDe('uber');
  if (cuentas.length === 0) {
    await log(P, 'sin_credenciales', 'no hay cuentas activas de Uber');
    await latido(P, hoyMadrid(), 'sin credenciales');
    return;
  }

  const pendiente = await objetivoPendiente('uber', sem.periodo, 'pantallas');
  if (!pendiente) {
    await log(P, 'nada_que_hacer', `las pantallas de ${sem.periodo} ya estaban capturadas`);
    await latido(P, hoyMadrid(), 'ya capturado');
    return;
  }

  let bloques = 0;
  for (const c of cuentas) bloques += await trabajarCuenta(c, sem.periodo);

  if (bloques > 0) await marcarConseguido('uber', sem.periodo, 'pantallas', `${bloques} bloque(s)`);
  else await registrarIntento('uber', sem.periodo, 'pantallas', 'sin capturas');

  await log(P, 'fin', `${cuentas.length} cuenta(s) · ${bloques} bloque(s)`);
  await latido(P, hoyMadrid(), `${bloques} bloque(s) · semana ${sem.periodo}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
