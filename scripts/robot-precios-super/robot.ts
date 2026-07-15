/**
 * Robot de precios Mercadona + Alcampo (BLOQUE 6) → Supabase.
 * Solo descarga el precio; toda la lógica de datos vive en fn_ingesta_precio_super
 * (histórico, Escandallo, Lista de la compra) y en robot_precios_map (mapeo).
 *
 * FLUJO por ingrediente:
 *  1. Si hay mapeo `ok` con url_producto → entra directo por la URL.
 *  2. Si no hay mapeo, o está `sin_match`/`dudoso` → busca por nombre en la web.
 *     - Coincidencia única y clara por nombre+formato → guarda mapeo `ok` y sigue.
 *     - Varias candidatas o formato distinto → guarda `dudoso`, NO carga precio.
 *  3. Precio leído → fn_ingesta_precio_super(iding, precio).
 *  4. Mercadona va siempre por radarsuper.com (agregador público): la tienda
 *     oficial bloquea todos los intentos por anti-bot, así que no se ni intenta.
 *
 * Nada de precios inventados: sin lectura fiable = hueco + log, nunca se adivina.
 */

import { chromium, Browser, Page } from 'playwright';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIAG = process.env.DIAG === '1';
const ART_DIR = './robot-artifacts';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const MAX_ITEMS = process.env.MAX_ITEMS ? parseInt(process.env.MAX_ITEMS, 10) : Infinity;

function ensureArtDir() { if (!existsSync(ART_DIR)) mkdirSync(ART_DIR, { recursive: true }); }
async function diag(page: Page, etiqueta: string) {
  if (!DIAG) return;
  ensureArtDir();
  try {
    await page.screenshot({ path: `${ART_DIR}/${etiqueta}.png`, fullPage: true });
    writeFileSync(`${ART_DIR}/${etiqueta}.html`, await page.content());
  } catch {}
}
function sleepAleatorio(minMs: number, maxMs: number) {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise((r) => setTimeout(r, ms));
}
function numES(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
// Limpia el sufijo de proveedor (_MER/_ALC/_ALC_MRM…) y separadores para buscar en la web.
function nombreBusqueda(nombre: string): string {
  return nombre.replace(/_(MER|ALC)(_MRM)?$/i, '').replace(/_/g, ' ').trim();
}

export async function logRobot(fuente: string, estado: string, detalle: string) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
    await sb.from('robot_log').insert([{ fuente, estado, detalle }]);
  } catch {}
}

// Vuelca a robot_log los <input> reales de la página (type/name/id/placeholder) para
// diagnosticar selectores sin depender de capturas (el storage de artifacts no es accesible).
async function sniffInputs(page: Page, limite = 15): Promise<string> {
  const inputs = page.locator('input');
  const total = await inputs.count().catch(() => 0);
  const partes: string[] = [];
  for (let i = 0; i < Math.min(total, limite); i++) {
    const el = inputs.nth(i);
    const type = (await el.getAttribute('type').catch(() => null)) || '?';
    const name = (await el.getAttribute('name').catch(() => null)) || '';
    const id = (await el.getAttribute('id').catch(() => null)) || '';
    const ph = (await el.getAttribute('placeholder').catch(() => null)) || '';
    partes.push(`[type=${type} name=${name} id=${id} ph=${ph}]`);
  }
  return `inputs(${total} total, primeros ${partes.length}): ${partes.join(' ')}`;
}
type Objetivo = { iding: string; nombre: string; proveedor: 'Mercadona' | 'Alcampo'; formato: string; precio_actual: number | null };
type Mapeo = { iding: string; proveedor: string; url_producto: string | null; ean: string | null; nombre_web: string | null; estado_match: string };
type Credencial = { plataforma: string; usuario: string; password: string; url_base: string };

async function cargarObjetivos(sb: SupabaseClient): Promise<Objetivo[]> {
  const { data, error } = await sb.from('v_robot_precios_objetivo').select('iding, nombre, proveedor, formato, precio_actual');
  if (error) throw new Error(`v_robot_precios_objetivo: ${error.message}`);
  return (data || []) as Objetivo[];
}
async function cargarMapeo(sb: SupabaseClient): Promise<Map<string, Mapeo>> {
  const { data, error } = await sb.from('robot_precios_map').select('iding, proveedor, url_producto, ean, nombre_web, estado_match');
  if (error) throw new Error(`robot_precios_map: ${error.message}`);
  const m = new Map<string, Mapeo>();
  for (const row of (data || []) as Mapeo[]) m.set(row.iding, row);
  return m;
}
async function cargarCredenciales(sb: SupabaseClient): Promise<Map<string, Credencial>> {
  const { data, error } = await sb.from('robot_credenciales').select('plataforma, usuario, password, url_base').in('plataforma', ['mercadona', 'alcampo']).eq('activo', true);
  if (error) throw new Error(`robot_credenciales: ${error.message}`);
  const m = new Map<string, Credencial>();
  for (const row of (data || []) as Credencial[]) m.set(row.plataforma, row);
  return m;
}
async function guardarMapeo(sb: SupabaseClient, iding: string, proveedor: string, patch: Partial<Mapeo>) {
  await sb.from('robot_precios_map').upsert(
    { iding, proveedor, ...patch, actualizado_en: new Date().toISOString() },
    { onConflict: 'iding' },
  );
}
async function ingestarPrecio(sb: SupabaseClient, iding: string, precio: number): Promise<boolean> {
  const { data, error } = await sb.rpc('fn_ingesta_precio_super', { p_iding: iding, p_precio: precio });
  if (error) { await logRobot('precios_super', 'error', `${iding} fn_ingesta_precio_super: ${error.message}`); return false; }
  const ok = (data as any)?.ok !== false;
  if (!ok) await logRobot('precios_super', 'error', `${iding} rechazado por fn_ingesta_precio_super: ${JSON.stringify(data)}`);
  return ok;
}

// ---------- Cierre de banners/cookies genérico ----------
async function cerrarModales(page: Page) {
  const nombres = [/aceptar/i, /accept/i, /cerrar/i, /close/i, /entendido/i, /no,? gracias/i, /×/];
  for (const re of nombres) {
    await page.getByRole('button', { name: re }).first().click({ timeout: 1200 }).catch(() => {});
  }
}

// ---------- MERCADONA ----------
// La tienda oficial bloquea siempre (anti-bot) → no se intenta, va directa a RadarSuper
// (agregador público, sin login) para no quemar tiempo/IP en un camino muerto.
const RADARSUPER_PRECIO = /\d{1,3}[.,]\d{2}\s*€/;

function extraerPrecio(texto: string): number | null {
  const m = texto.match(RADARSUPER_PRECIO);
  return m ? numES(m[0]) : null;
}

// Busca por proximidad: localiza nodos de texto con precio en € y sube al <a>
// ancestro más cercano (la tarjeta de producto), filtrando por si su texto
// contiene la palabra clave — evita adivinar la clase CSS de la tarjeta o
// asumir que el precio vive dentro del propio <a> (comprobado en vivo: el
// precio de RadarSuper está fuera del enlace, no dentro).
async function candidatosPorPrecioCercano(page: Page, primeraPalabra: string, base: string, limite = 30): Promise<{ texto: string; url: string | null; precio: number | null }[]> {
  const precios = page.getByText(RADARSUPER_PRECIO);
  const total = await precios.count().catch(() => 0);
  const vistos = new Set<string>();
  const candidatos: { texto: string; url: string | null; precio: number | null }[] = [];
  for (let i = 0; i < Math.min(total, limite); i++) {
    const ancla = precios.nth(i).locator('xpath=ancestor::a[1]');
    if (!(await ancla.count().catch(() => 0))) continue;
    const href = await ancla.getAttribute('href').catch(() => null);
    if (!href || vistos.has(href)) continue;
    const texto = ((await ancla.textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
    if (!new RegExp(primeraPalabra, 'i').test(texto)) continue;
    vistos.add(href);
    candidatos.push({ texto, url: new URL(href, base).toString(), precio: extraerPrecio(texto) });
  }
  return candidatos;
}

// Busca en RadarSuper: primero intenta el buscador on-page (si existe), si no
// hay prueba el parámetro ?q= por si acaso.
async function buscarEnRadarsuper(page: Page, consulta: string): Promise<{ precio: number | null; url: string | null; nombreWeb: string | null; candidatos: number }> {
  await page.goto('https://radarsuper.com/mercadona', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleepAleatorio(1500, 2500);
  await cerrarModales(page);

  const buscador = page.locator('input[type="search"], input[placeholder*="usca" i]').first();
  if (await buscador.count().catch(() => 0)) {
    await buscador.fill(consulta);
    await page.keyboard.press('Enter').catch(() => {});
    await sleepAleatorio(1500, 2500);
  } else {
    await page.goto(`https://radarsuper.com/mercadona?q=${encodeURIComponent(consulta)}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await sleepAleatorio(1500, 2500);
  }
  await page.waitForLoadState('networkidle').catch(() => {});
  await diag(page, `radarsuper-${consulta.slice(0, 20)}`);

  const primeraPalabra = consulta.split(/\s+/)[0];
  const candidatos = await candidatosPorPrecioCercano(page, primeraPalabra, 'https://radarsuper.com');
  if (candidatos.length === 0) {
    const totalPrecios = await page.getByText(RADARSUPER_PRECIO).count().catch(() => 0);
    await logRobot('precios_super', 'aviso', `radarsuper "${consulta}": 0 candidatos tras filtrar por nombre (${totalPrecios} nodos con precio en la página, url=${page.url()})`);
    return { precio: null, url: null, nombreWeb: null, candidatos: 0 };
  }
  if (candidatos.length > 6) {
    await logRobot('precios_super', 'aviso', `radarsuper "${consulta}": ${candidatos.length} candidatos ambiguos → ${candidatos.slice(0, 5).map((c) => `"${c.texto.slice(0, 60)}"`).join(' | ')}`);
    return { precio: null, url: null, nombreWeb: null, candidatos: candidatos.length };
  }
  const c = candidatos[0];
  return { precio: c.precio, url: c.url, nombreWeb: c.texto.slice(0, 80), candidatos: candidatos.length };
}

// ---------- ALCAMPO ----------
const ALCAMPO_CP = '28038';

async function fijarCpAlcampo(page: Page) {
  await page.goto('https://www.compraonline.alcampo.es/', { waitUntil: 'domcontentloaded' });
  await sleepAleatorio(1200, 2200);
  await cerrarModales(page);
  const input = page.locator('input[placeholder*="ostal" i], input[name*="postal" i], input[id*="postal" i]').first();
  if (await input.count().catch(() => 0)) {
    await input.fill(ALCAMPO_CP);
    await page.keyboard.press('Enter').catch(() => {});
    await sleepAleatorio(1500, 2500);
    await page.getByRole('button', { name: /continuar|confirmar|aceptar|buscar tienda/i }).first().click({ timeout: 2000 }).catch(() => {});
    await sleepAleatorio(1000, 1800);
    await page.getByRole('button', { name: /seleccionar|elegir|confirmar/i }).first().click({ timeout: 2000 }).catch(() => {});
  }
}

// Devuelve si el login quedó confirmado (no basta con haber pulsado "entrar":
// si el formulario sigue ahí o la URL sigue en /login, no ha entrado de verdad).
// El login de Alcampo redirige a un dominio Salesforce Experience Cloud
// (*.my.site.com/authorization) — probamos primero sus selectores estándar
// (#username/#password/#Login) y varios candidatos de envío, con Enter como
// último recurso si ningún botón hace nada.
async function loginAlcampo(page: Page, cred: Credencial): Promise<boolean> {
  await page.goto('https://www.compraonline.alcampo.es/login', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleepAleatorio(1200, 2000);
  await cerrarModales(page);
  const userInput = page.locator('#username, input[type="email"], input[type="text"][name*="user" i], input[id*="dni" i]').first();
  if (!(await userInput.count().catch(() => 0))) {
    await logRobot('precios_super', 'error', `alcampo login: campo usuario no encontrado. url=${page.url()} title="${await page.title().catch(() => '')}" ${await sniffInputs(page)}`);
    return false;
  }
  await userInput.fill(cred.usuario);
  const passInput = page.locator('#password, input[type="password"]').first();
  if (!(await passInput.count().catch(() => 0))) {
    await logRobot('precios_super', 'error', `alcampo login: campo password no encontrado tras rellenar usuario. url=${page.url()} ${await sniffInputs(page)}`);
    return false;
  }
  await passInput.fill(cred.password);

  const submitCandidatos = [
    page.locator('#btnSubmit_login'), // botón real confirmado en vivo: id=btnSubmit_login, texto "Conectarme"
    page.locator('#Login'),
    page.getByRole('button', { name: /iniciar sesión|entrar|acceder|conectarme|log ?in/i }),
    page.locator('input[type="submit"]'),
    page.locator('button[type="submit"]'),
  ];
  let clicado = false;
  for (const cand of submitCandidatos) {
    if (await cand.first().count().catch(() => 0)) {
      await cand.first().click({ timeout: 2000 }).catch(() => {});
      clicado = true;
      break;
    }
  }
  if (!clicado) await passInput.press('Enter').catch(() => {});
  await sleepAleatorio(2500, 3500);

  const siguePassword = await page.locator('input[type="password"]').first().count().catch(() => 0);
  const sigueEnLogin = /login|authorization/i.test(page.url());
  const logueado = !siguePassword && !sigueEnLogin;
  if (logueado) {
    await logRobot('precios_super', 'ok', `alcampo login confirmado: url=${page.url()}`);
    return true;
  }
  const botones = page.locator('button, input[type="submit"], input[type="button"]');
  const totalBotones = await botones.count().catch(() => 0);
  const muestraBotones: string[] = [];
  for (let i = 0; i < Math.min(totalBotones, 8); i++) {
    const b = botones.nth(i);
    const txt = ((await b.textContent().catch(() => '')) || (await b.getAttribute('value').catch(() => '')) || '').trim();
    const id = (await b.getAttribute('id').catch(() => null)) || '';
    muestraBotones.push(`[id=${id} "${txt}"]`);
  }
  await logRobot('precios_super', 'error', `alcampo login FALLÓ: url=${page.url()} password_visible=${!!siguePassword} clicado=${clicado} botones: ${muestraBotones.join(' ')}`);
  return false;
}

async function buscarEnAlcampo(page: Page, consulta: string): Promise<{ precio: number | null; url: string | null; nombreWeb: string | null; candidatos: number }> {
  const buscador = page.locator('input[type="search"], input[placeholder*="usca" i]').first();
  if (!(await buscador.count().catch(() => 0))) {
    await logRobot('precios_super', 'aviso', `alcampo buscador no encontrado. url=${page.url()} ${await sniffInputs(page)}`);
    return { precio: null, url: null, nombreWeb: null, candidatos: 0 };
  }
  await buscador.fill(consulta);
  await page.keyboard.press('Enter');
  await sleepAleatorio(1800, 2800);
  await diag(page, `alcampo-buscar-${consulta.slice(0, 20)}`);

  const primeraPalabra = consulta.split(/\s+/)[0];
  const candidatos = await candidatosPorPrecioCercano(page, primeraPalabra, 'https://www.compraonline.alcampo.es');
  if (candidatos.length === 0) {
    const totalPrecios = await page.getByText(RADARSUPER_PRECIO).count().catch(() => 0);
    await logRobot('precios_super', 'aviso', `alcampo "${consulta}": 0 candidatos tras filtrar por nombre (${totalPrecios} nodos con precio en la página, url=${page.url()})`);
    return { precio: null, url: null, nombreWeb: null, candidatos: 0 };
  }
  if (candidatos.length > 6) {
    return { precio: null, url: null, nombreWeb: null, candidatos: candidatos.length };
  }
  const c = candidatos[0];
  return { precio: c.precio, url: c.url, nombreWeb: c.texto.slice(0, 80), candidatos: candidatos.length };
}

async function leerPrecioAlcampoDesdeUrl(page: Page, url: string): Promise<number | null> {
  await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleepAleatorio(1200, 2000);
  const texto = ((await page.locator('main, body').first().textContent().catch(() => '')) || '');
  return extraerPrecio(texto);
}

async function leerPrecioRadarsuperDesdeUrl(page: Page, url: string): Promise<number | null> {
  await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleepAleatorio(1200, 2000);
  const texto = ((await page.locator('main, body').first().textContent().catch(() => '')) || '');
  return extraerPrecio(texto);
}

// ---------- Resultado por ingrediente ----------
type Resultado = 'cargado' | 'sin_cambio_precio' | 'dudoso' | 'sin_match' | 'fallido';

async function procesarMercadona(page: Page, sb: SupabaseClient, obj: Objetivo, mapeo: Mapeo | undefined): Promise<Resultado> {
  try {
    let precio: number | null = null;

    if (mapeo?.estado_match === 'ok' && mapeo.url_producto) {
      precio = await leerPrecioRadarsuperDesdeUrl(page, mapeo.url_producto);
    }

    if (precio == null) {
      const consulta = nombreBusqueda(obj.nombre);
      const res = await buscarEnRadarsuper(page, consulta);
      if (res.candidatos > 6 || (res.candidatos > 1 && res.precio == null)) {
        await guardarMapeo(sb, obj.iding, obj.proveedor, { estado_match: 'dudoso', nombre_web: res.nombreWeb, url_producto: res.url });
        await logRobot('precios_super', 'dudoso', `${obj.iding} (radarsuper) ${res.candidatos} candidatos, no se carga precio`);
        return 'dudoso';
      }
      if (res.precio == null || !res.url) {
        await guardarMapeo(sb, obj.iding, obj.proveedor, { estado_match: 'sin_match' });
        await logRobot('precios_super', 'sin_match', `${obj.iding} (radarsuper) sin resultado buscando "${consulta}"`);
        return 'sin_match';
      }
      precio = res.precio;
      await guardarMapeo(sb, obj.iding, obj.proveedor, { estado_match: 'ok', url_producto: res.url, nombre_web: res.nombreWeb });
    }

    if (precio == null || precio <= 0) {
      await logRobot('precios_super', 'fallido', `${obj.iding} precio inválido/no leído (radarsuper)`);
      return 'fallido';
    }
    const ok = await ingestarPrecio(sb, obj.iding, precio);
    if (!ok) return 'fallido';
    return precio === obj.precio_actual ? 'sin_cambio_precio' : 'cargado';
  } catch (e: any) {
    await logRobot('precios_super', 'error', `${obj.iding} excepción: ${String(e?.message || e)}`);
    return 'fallido';
  }
}

async function procesarAlcampo(page: Page, sb: SupabaseClient, obj: Objetivo, mapeo: Mapeo | undefined): Promise<Resultado> {
  try {
    let precio: number | null = null;

    if (mapeo?.estado_match === 'ok' && mapeo.url_producto) {
      precio = await leerPrecioAlcampoDesdeUrl(page, mapeo.url_producto);
    }

    if (precio == null) {
      const consulta = nombreBusqueda(obj.nombre);
      const res = await buscarEnAlcampo(page, consulta);
      if (res.candidatos > 6 || (res.candidatos > 1 && res.precio == null)) {
        await guardarMapeo(sb, obj.iding, obj.proveedor, { estado_match: 'dudoso', nombre_web: res.nombreWeb, url_producto: res.url });
        await logRobot('precios_super', 'dudoso', `${obj.iding} ${res.candidatos} candidatos, no se carga precio`);
        return 'dudoso';
      }
      if (res.precio == null || !res.url) {
        await guardarMapeo(sb, obj.iding, obj.proveedor, { estado_match: 'sin_match' });
        await logRobot('precios_super', 'sin_match', `${obj.iding} sin resultado buscando "${consulta}"`);
        return 'sin_match';
      }
      precio = res.precio;
      await guardarMapeo(sb, obj.iding, obj.proveedor, { estado_match: 'ok', url_producto: res.url, nombre_web: res.nombreWeb });
    }

    if (precio == null || precio <= 0) {
      await logRobot('precios_super', 'fallido', `${obj.iding} precio inválido/no leído`);
      return 'fallido';
    }
    const ok = await ingestarPrecio(sb, obj.iding, precio);
    if (!ok) return 'fallido';
    return precio === obj.precio_actual ? 'sin_cambio_precio' : 'cargado';
  } catch (e: any) {
    await logRobot('precios_super', 'error', `${obj.iding} excepción: ${String(e?.message || e)}`);
    return 'fallido';
  }
}

async function procesarLote(
  browser: Browser, sb: SupabaseClient, proveedor: 'Mercadona' | 'Alcampo',
  objetivos: Objetivo[], mapeos: Map<string, Mapeo>, cred: Credencial | undefined,
): Promise<Record<Resultado, number>> {
  const contadores: Record<Resultado, number> = { cargado: 0, sin_cambio_precio: 0, dudoso: 0, sin_match: 0, fallido: 0 };
  const items = objetivos.filter((o) => o.proveedor === proveedor).slice(0, MAX_ITEMS);
  if (!items.length) return contadores;
  // RadarSuper (Mercadona) es público, sin login. Alcampo sí necesita credenciales.
  if (proveedor === 'Alcampo' && !cred) {
    await logRobot('precios_super', 'error', `sin credenciales para Alcampo, se salta el lote (${items.length} ingredientes)`);
    return contadores;
  }

  const page = await browser.newPage();
  try {
    if (proveedor === 'Alcampo') {
      await fijarCpAlcampo(page);
      const logueado = await loginAlcampo(page, cred!);
      if (!logueado) {
        await logRobot('precios_super', 'error', `alcampo: login no confirmado, se aborta el lote (${items.length} ingredientes) para no perder tiempo/anti-bot`);
        return contadores;
      }
    }
    await diag(page, `${proveedor}-post-login`);

    for (const obj of items) {
      const mapeo = mapeos.get(obj.iding);
      const resultado = proveedor === 'Mercadona'
        ? await procesarMercadona(page, sb, obj, mapeo)
        : await procesarAlcampo(page, sb, obj, mapeo);
      contadores[resultado]++;
      await sleepAleatorio(1500, 3500); // ritmo humano entre productos
    }
  } finally {
    await page.close();
  }
  return contadores;
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Faltan SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  await logRobot('precios_super', 'inicio', 'arranque robot precios Mercadona+Alcampo');

  const [objetivos, mapeos, credenciales] = await Promise.all([
    cargarObjetivos(sb), cargarMapeo(sb), cargarCredenciales(sb),
  ]);

  const browser = await chromium.launch({ headless: process.env.HEADFUL !== '1', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const mer = await procesarLote(browser, sb, 'Mercadona', objetivos, mapeos, credenciales.get('mercadona'));
    const alc = await procesarLote(browser, sb, 'Alcampo', objetivos, mapeos, credenciales.get('alcampo'));

    const total: Record<Resultado, number> = {
      cargado: mer.cargado + alc.cargado,
      sin_cambio_precio: mer.sin_cambio_precio + alc.sin_cambio_precio,
      dudoso: mer.dudoso + alc.dudoso,
      sin_match: mer.sin_match + alc.sin_match,
      fallido: mer.fallido + alc.fallido,
    };
    const intentados = total.cargado + total.sin_cambio_precio + total.dudoso + total.sin_match + total.fallido;
    const conPrecioFresco = total.cargado + total.sin_cambio_precio;
    const pct = intentados ? ((conPrecioFresco / intentados) * 100).toFixed(1) : '0.0';
    const detalle = `objetivo=${objetivos.length} intentados=${intentados} cargados=${total.cargado} sin_cambio=${total.sin_cambio_precio} dudoso=${total.dudoso} sin_match=${total.sin_match} fallidos=${total.fallido} (${pct}% con precio fresco)`;
    await logRobot('precios_super', 'resumen', detalle);
    console.log(detalle);
  } finally {
    await browser.close();
  }
}

const esEntryPoint = !!process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (esEntryPoint) {
  main().catch(async (e) => {
    console.error(e);
    await logRobot('precios_super', 'error', `fallo fatal: ${String(e?.message || e)}`);
    process.exit(1);
  });
}
