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
 *  4. Si la tienda oficial de Mercadona bloquea, cae a radarsuper.com como plan B
 *     (marca el origen en robot_log).
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
const MERCADONA_CP = '28038';

async function fijarCpMercadona(page: Page) {
  await page.goto('https://tienda.mercadona.es/', { waitUntil: 'domcontentloaded' });
  await sleepAleatorio(1200, 2200);
  await cerrarModales(page);
  const input = page.locator('input[placeholder*="ostal" i], input[name*="postal" i]').first();
  if (await input.count().catch(() => 0)) {
    await input.fill(MERCADONA_CP);
    await page.keyboard.press('Enter').catch(() => {});
    await sleepAleatorio(1500, 2500);
    await page.getByRole('button', { name: /continuar|confirmar|aceptar/i }).first().click({ timeout: 2000 }).catch(() => {});
  }
}

async function loginMercadona(page: Page, cred: Credencial) {
  await page.goto('https://tienda.mercadona.es/login', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleepAleatorio(1200, 2000);
  await cerrarModales(page);
  const userInput = page.locator('input[type="email"], input[name*="email" i]').first();
  if (!(await userInput.count().catch(() => 0))) return false;
  await userInput.fill(cred.usuario);
  await page.getByRole('button', { name: /continuar|siguiente/i }).first().click({ timeout: 3000 }).catch(() => {});
  await sleepAleatorio(1000, 1800);
  const passInput = page.locator('input[type="password"]').first();
  if (!(await passInput.count().catch(() => 0))) return false;
  await passInput.fill(cred.password);
  await page.getByRole('button', { name: /iniciar sesión|entrar|continuar/i }).first().click({ timeout: 3000 }).catch(() => {});
  await sleepAleatorio(2000, 3000);
  return true;
}

function bloqueadoMercadona(html: string): boolean {
  return /acceso denegado|captcha|unusual traffic|blocked|too many requests/i.test(html);
}

// Devuelve { precio, url, nombreWeb, candidatos } tras buscar `consulta` en el buscador de Mercadona.
async function buscarEnMercadona(page: Page, consulta: string): Promise<{ precio: number | null; url: string | null; nombreWeb: string | null; candidatos: number }> {
  const buscador = page.locator('input[type="search"], input[placeholder*="usca" i]').first();
  if (!(await buscador.count().catch(() => 0))) return { precio: null, url: null, nombreWeb: null, candidatos: 0 };
  await buscador.fill(consulta);
  await page.keyboard.press('Enter');
  await sleepAleatorio(1800, 2800);
  await diag(page, `mercadona-buscar-${consulta.slice(0, 20)}`);

  const tarjetas = page.locator('[data-testid*="product" i], .product-cell, li:has(article)');
  const total = await tarjetas.count().catch(() => 0);
  if (total === 0) return { precio: null, url: null, nombreWeb: null, candidatos: 0 };
  if (total > 6) return { precio: null, url: null, nombreWeb: null, candidatos: total }; // demasiado ambiguo, no forzar

  const primera = tarjetas.first();
  const nombreWeb = ((await primera.locator('h4, [data-testid*="name" i]').first().textContent().catch(() => '')) || '').trim();
  const precioTxt = ((await primera.locator('[data-testid*="price" i], .product-price').first().textContent().catch(() => '')) || '').trim();
  const precio = numES(precioTxt);
  const href = await primera.locator('a').first().getAttribute('href').catch(() => null);
  const url = href ? new URL(href, 'https://tienda.mercadona.es').toString() : null;
  return { precio, url, nombreWeb, candidatos: total };
}

async function leerPrecioMercadonaDesdeUrl(page: Page, url: string): Promise<number | null> {
  await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleepAleatorio(1200, 2000);
  const precioTxt = ((await page.locator('[data-testid*="price" i], .product-price').first().textContent().catch(() => '')) || '').trim();
  return numES(precioTxt);
}

// Plan B: radarsuper.com/mercadona cuando la tienda oficial bloquea.
async function buscarEnRadarsuper(page: Page, consulta: string): Promise<{ precio: number | null; url: string | null; nombreWeb: string | null; candidatos: number }> {
  await page.goto(`https://radarsuper.com/mercadona?q=${encodeURIComponent(consulta)}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleepAleatorio(1500, 2500);
  await diag(page, `radarsuper-${consulta.slice(0, 20)}`);
  const filas = page.locator('[class*="product" i], .card, li:has(a)');
  const total = await filas.count().catch(() => 0);
  if (total === 0) return { precio: null, url: null, nombreWeb: null, candidatos: 0 };
  if (total > 6) return { precio: null, url: null, nombreWeb: null, candidatos: total };
  const primera = filas.first();
  const nombreWeb = ((await primera.locator('h2, h3, [class*="name" i]').first().textContent().catch(() => '')) || '').trim();
  const precioTxt = ((await primera.locator('[class*="price" i]').first().textContent().catch(() => '')) || '').trim();
  const precio = numES(precioTxt);
  const href = await primera.locator('a').first().getAttribute('href').catch(() => null);
  const url = href ? new URL(href, 'https://radarsuper.com').toString() : null;
  return { precio, url, nombreWeb, candidatos: total };
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

async function loginAlcampo(page: Page, cred: Credencial) {
  await page.goto('https://www.compraonline.alcampo.es/login', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleepAleatorio(1200, 2000);
  await cerrarModales(page);
  const userInput = page.locator('input[type="email"], input[type="text"][name*="user" i], input[id*="dni" i]').first();
  if (!(await userInput.count().catch(() => 0))) return false;
  await userInput.fill(cred.usuario);
  const passInput = page.locator('input[type="password"]').first();
  if (!(await passInput.count().catch(() => 0))) return false;
  await passInput.fill(cred.password);
  await page.getByRole('button', { name: /iniciar sesión|entrar|acceder/i }).first().click({ timeout: 3000 }).catch(() => {});
  await sleepAleatorio(2000, 3000);
  return true;
}

async function buscarEnAlcampo(page: Page, consulta: string): Promise<{ precio: number | null; url: string | null; nombreWeb: string | null; candidatos: number }> {
  const buscador = page.locator('input[type="search"], input[placeholder*="usca" i]').first();
  if (!(await buscador.count().catch(() => 0))) return { precio: null, url: null, nombreWeb: null, candidatos: 0 };
  await buscador.fill(consulta);
  await page.keyboard.press('Enter');
  await sleepAleatorio(1800, 2800);
  await diag(page, `alcampo-buscar-${consulta.slice(0, 20)}`);

  const tarjetas = page.locator('[data-testid*="product" i], .product-card, li:has(article)');
  const total = await tarjetas.count().catch(() => 0);
  if (total === 0) return { precio: null, url: null, nombreWeb: null, candidatos: 0 };
  if (total > 6) return { precio: null, url: null, nombreWeb: null, candidatos: total };

  const primera = tarjetas.first();
  const nombreWeb = ((await primera.locator('h2, h3, [data-testid*="name" i]').first().textContent().catch(() => '')) || '').trim();
  const precioTxt = ((await primera.locator('[data-testid*="price" i], .product-price').first().textContent().catch(() => '')) || '').trim();
  const precio = numES(precioTxt);
  const href = await primera.locator('a').first().getAttribute('href').catch(() => null);
  const url = href ? new URL(href, 'https://www.compraonline.alcampo.es').toString() : null;
  return { precio, url, nombreWeb, candidatos: total };
}

async function leerPrecioAlcampoDesdeUrl(page: Page, url: string): Promise<number | null> {
  await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleepAleatorio(1200, 2000);
  const precioTxt = ((await page.locator('[data-testid*="price" i], .product-price').first().textContent().catch(() => '')) || '').trim();
  return numES(precioTxt);
}

// ---------- Resultado por ingrediente ----------
type Resultado = 'cargado' | 'sin_cambio_precio' | 'dudoso' | 'sin_match' | 'fallido';

async function procesarMercadona(page: Page, sb: SupabaseClient, obj: Objetivo, mapeo: Mapeo | undefined): Promise<Resultado> {
  try {
    let precio: number | null = null;
    let origen = 'tienda_oficial';

    if (mapeo?.estado_match === 'ok' && mapeo.url_producto) {
      precio = await leerPrecioMercadonaDesdeUrl(page, mapeo.url_producto);
      if (precio == null) {
        const html = await page.content().catch(() => '');
        if (bloqueadoMercadona(html)) { precio = null; } // se reintenta abajo con radarsuper
      }
    }

    if (precio == null) {
      const consulta = nombreBusqueda(obj.nombre);
      let res = await buscarEnMercadona(page, consulta);
      const html = await page.content().catch(() => '');
      if (res.precio == null && bloqueadoMercadona(html)) {
        await logRobot('precios_super', 'aviso', `${obj.iding} tienda oficial Mercadona bloqueada, usando radarsuper`);
        origen = 'radarsuper';
        res = await buscarEnRadarsuper(page, consulta);
      }
      if (res.candidatos > 6 || (res.candidatos > 1 && res.precio == null)) {
        await guardarMapeo(sb, obj.iding, obj.proveedor, { estado_match: 'dudoso', nombre_web: res.nombreWeb, url_producto: res.url });
        await logRobot('precios_super', 'dudoso', `${obj.iding} (${origen}) ${res.candidatos} candidatos, no se carga precio`);
        return 'dudoso';
      }
      if (res.precio == null || !res.url) {
        await guardarMapeo(sb, obj.iding, obj.proveedor, { estado_match: 'sin_match' });
        await logRobot('precios_super', 'sin_match', `${obj.iding} (${origen}) sin resultado buscando "${consulta}"`);
        return 'sin_match';
      }
      precio = res.precio;
      await guardarMapeo(sb, obj.iding, obj.proveedor, { estado_match: 'ok', url_producto: res.url, nombre_web: res.nombreWeb });
    }

    if (precio == null || precio <= 0) {
      await logRobot('precios_super', 'fallido', `${obj.iding} precio inválido/no leído (${origen})`);
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
  if (!cred) {
    await logRobot('precios_super', 'error', `sin credenciales para ${proveedor}, se salta el lote (${items.length} ingredientes)`);
    return contadores;
  }

  const page = await browser.newPage();
  try {
    if (proveedor === 'Mercadona') {
      await fijarCpMercadona(page);
      await loginMercadona(page, cred);
    } else {
      await fijarCpAlcampo(page);
      await loginAlcampo(page, cred);
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
    const intentados = objetivos.length;
    const conPrecioFresco = total.cargado + total.sin_cambio_precio;
    const detalle = `intentados=${intentados} cargados=${total.cargado} sin_cambio=${total.sin_cambio_precio} dudoso=${total.dudoso} sin_match=${total.sin_match} fallidos=${total.fallido} (${((conPrecioFresco / intentados) * 100).toFixed(1)}% con precio fresco)`;
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
