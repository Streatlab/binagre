/**
 * Robot de precios Mercadona + Alcampo (BLOQUE 6) → Supabase.
 * Solo descarga el precio; toda la lógica de datos vive en fn_ingesta_precio_super
 * (histórico, Escandallo, Lista de la compra) y en robot_precios_map (mapeo).
 *
 * BÚSQUEDA: la consulta sale de la columna `busqueda` de v_robot_precios_objetivo
 * (= ingredientes.nombre_super si Rubén lo fijó a mano; si no, el nombre sin
 * sufijo). NUNCA se recalcula desde obj.nombre — eso ignoraría las correcciones.
 *
 * LEY-ANTIFALSOS-01: sin lectura fiable = hueco + log, nunca se adivina.
 */

import { chromium, Browser, Page, Response } from 'playwright';
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

export async function logRobot(fuente: string, estado: string, detalle: string) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
    await sb.from('robot_log').insert([{ fuente, estado, detalle }]);
  } catch {}
}

/**
 * 20-jul: este robot terminaba bien pero nunca tocaba robot_salud, así que el
 * vigilante lo veía como "sin latido" y avisaba en falso cada mañana. Se llama
 * al final de main() (éxito y error) igual que hacen uber.ts/glovo.ts/etc.
 */
export async function latido(fuente: string, detalle: string) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
    const ahora = new Date().toISOString();
    await sb.from('robot_salud').upsert(
      [{ fuente, ultima_ejecucion: ahora, ultimo_dato: ahora, estado: 'ok', detalle }],
      { onConflict: 'fuente' },
    );
  } catch {}
}

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
type Objetivo = { iding: string; nombre: string; proveedor: 'Mercadona' | 'Alcampo'; busqueda: string; formato: string; precio_actual: number | null };
type Mapeo = { iding: string; proveedor: string; url_producto: string | null; ean: string | null; nombre_web: string | null; estado_match: string };
type Credencial = { plataforma: string; usuario: string; password: string; url_base: string };

async function cargarObjetivos(sb: SupabaseClient): Promise<Objetivo[]> {
  const { data, error } = await sb.from('v_robot_precios_objetivo').select('iding, nombre, proveedor, busqueda, formato, precio_actual');
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

async function cerrarModales(page: Page) {
  const nombres = [/aceptar/i, /accept/i, /cerrar/i, /close/i, /entendido/i, /no,? gracias/i, /×/];
  for (const re of nombres) {
    await page.getByRole('button', { name: re }).first().click({ timeout: 1200 }).catch(() => {});
  }
}

// ---------- MERCADONA (API pública) ----------
const MERCADONA_API = 'https://tienda.mercadona.es/api';
const MERCADONA_CP = '28038';

type ProductoCatalogo = { id: string; nombre: string; precio: number | null };

async function fetchJson(url: string, cookie: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, { ...init, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(init?.headers || {}) } });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.json();
}

async function fijarCpMercadonaApi(): Promise<string> {
  const res = await fetch(`${MERCADONA_API}/postal-codes/actions/change-pc/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_postal_code: MERCADONA_CP }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fijando CP`);
  const setCookie = typeof (res.headers as any).getSetCookie === 'function' ? (res.headers as any).getSetCookie() : [];
  return (setCookie as string[]).map((c) => c.split(';')[0]).join('; ');
}

function extraerPrecioProducto(p: any): number | null {
  const candidatos = [p?.price_instructions?.unit_price, p?.price_instructions?.bulk_price, p?.price_instructions?.reference_price];
  for (const c of candidatos) {
    if (c == null) continue;
    const n = typeof c === 'number' ? c : numES(String(c));
    if (n != null && n > 0) return n;
  }
  return null;
}

async function crawlCatalogoMercadona(cookie: string): Promise<ProductoCatalogo[]> {
  const raiz = await fetchJson(`${MERCADONA_API}/categories/`, cookie);
  const categoriasRaiz: any[] = raiz?.results ?? raiz?.categories ?? [];
  const productos: ProductoCatalogo[] = [];
  let subOk = 0, subFallo = 0;

  for (const cat of categoriasRaiz) {
    const subs: any[] = cat?.categories ?? [];
    for (const sub of subs) {
      const subId = sub?.id;
      if (subId == null) continue;
      try {
        const det = await fetchJson(`${MERCADONA_API}/categories/${subId}/`, cookie);
        const listas: any[][] = [];
        if (Array.isArray(det?.products)) listas.push(det.products);
        for (const s of det?.categories ?? []) if (Array.isArray(s?.products)) listas.push(s.products);
        for (const lista of listas) {
          for (const p of lista) {
            const nombre = p?.display_name || p?.name || '';
            if (!nombre) continue;
            productos.push({ id: String(p.id), nombre, precio: extraerPrecioProducto(p) });
          }
        }
        subOk++;
      } catch {
        subFallo++;
      }
      await sleepAleatorio(150, 350);
    }
  }
  await logRobot('precios_super', 'ok', `mercadona API: crawl completo — ${categoriasRaiz.length} categorías raíz, ${subOk} subcategorías ok, ${subFallo} fallidas, ${productos.length} productos indexados`);
  return productos;
}

async function leerPrecioMercadonaPorUrl(url: string, cookie: string): Promise<number | null> {
  try {
    const data = await fetchJson(url, cookie);
    return extraerPrecioProducto(data);
  } catch {
    return null;
  }
}

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
const STOPWORDS_ES = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'en', 'a', 'con', 'para', 'al', 'un', 'una', 'unos', 'unas', 'o', 'su', 'sus']);
function tokensSignificativos(consultaNorm: string): string[] {
  return consultaNorm.split(' ').filter((t) => t.length > 0 && !STOPWORDS_ES.has(t));
}

function desempatarHacendado(consultaNorm: string, empatados: ProductoCatalogo[]): ProductoCatalogo | null {
  const candidatos = empatados.filter((p) => {
    const n = normalizar(p.nombre);
    return n.startsWith(consultaNorm) && /hacendado/.test(n);
  });
  return candidatos.length === 1 ? candidatos[0] : null;
}

// Empate resuelto: coincidencia exacta literal (todos los empatados tienen el
// nombre EXACTAMENTE igual a la consulta, solo cambia pack/id → no es ambiguo,
// se coge el primero), o desempate Hacendado. Devuelve el ganador o null.
function resolverEmpate(consultaNorm: string, empatados: ProductoCatalogo[]): ProductoCatalogo | null {
  if (empatados.every((p) => normalizar(p.nombre) === consultaNorm)) return empatados[0];
  return desempatarHacendado(consultaNorm, empatados);
}

function mejorCoincidencia(consulta: string, catalogo: ProductoCatalogo[]): { mejor: ProductoCatalogo | null; mejorScore: number; empatados: number; confianzaAlta: boolean } {
  const consultaNorm = normalizar(consulta);
  const tokensConsulta = tokensSignificativos(consultaNorm);

  // 1) Subcadena exacta: el nombre contiene la cadena completa normalizada.
  const porSubcadena = catalogo.filter((p) => normalizar(p.nombre).includes(consultaNorm));
  if (porSubcadena.length > 0) {
    porSubcadena.sort((a, b) => a.nombre.length - b.nombre.length);
    const largoMinimo = porSubcadena[0].nombre.length;
    const empatadosArr = porSubcadena.filter((p) => p.nombre.length === largoMinimo);
    if (empatadosArr.length > 1) {
      const ganador = resolverEmpate(consultaNorm, empatadosArr);
      if (ganador) return { mejor: ganador, mejorScore: tokensConsulta.length, empatados: 1, confianzaAlta: true };
      return { mejor: empatadosArr[0], mejorScore: tokensConsulta.length, empatados: empatadosArr.length, confianzaAlta: false };
    }
    return { mejor: porSubcadena[0], mejorScore: tokensConsulta.length, empatados: 1, confianzaAlta: true };
  }

  // 2) Cobertura de palabras: confiable solo si el producto contiene TODAS las
  // palabras significativas de la consulta (sin stopwords).
  const candidatos = catalogo
    .map((p) => {
      const nombreNorm = normalizar(p.nombre);
      const tokensNombre = new Set(nombreNorm.split(' ').filter(Boolean));
      const encontrados = tokensConsulta.filter((t) => tokensNombre.has(t)).length;
      return { p, nombreNorm, encontrados };
    })
    .filter((c) => c.encontrados > 0);

  if (candidatos.length === 0) return { mejor: null, mejorScore: 0, empatados: 0, confianzaAlta: false };

  const cobertosCompletos = tokensConsulta.length > 0 ? candidatos.filter((c) => c.encontrados === tokensConsulta.length) : [];
  if (cobertosCompletos.length > 0) {
    cobertosCompletos.sort((a, b) => a.nombreNorm.length - b.nombreNorm.length);
    const largoMinimo = cobertosCompletos[0].nombreNorm.length;
    const empatadosArr = cobertosCompletos.filter((c) => c.nombreNorm.length === largoMinimo).map((c) => c.p);
    if (empatadosArr.length > 1) {
      const ganador = resolverEmpate(consultaNorm, empatadosArr);
      if (ganador) return { mejor: ganador, mejorScore: tokensConsulta.length, empatados: 1, confianzaAlta: true };
      return { mejor: empatadosArr[0], mejorScore: tokensConsulta.length, empatados: empatadosArr.length, confianzaAlta: false };
    }
    return { mejor: empatadosArr[0], mejorScore: tokensConsulta.length, empatados: 1, confianzaAlta: true };
  }

  candidatos.sort((a, b) => b.encontrados - a.encontrados);
  return { mejor: candidatos[0].p, mejorScore: candidatos[0].encontrados, empatados: candidatos.length, confianzaAlta: false };
}

// ---------- ALCAMPO (Playwright + intercepción JSON) ----------
const ALCAMPO_CP = '28038';

function extraerPrecioNumerico(candidato: any, profundidad = 0): number | null {
  if (candidato == null || profundidad > 3) return null;
  if (typeof candidato === 'number') return candidato > 0 ? candidato : null;
  if (typeof candidato === 'string') return numES(candidato);
  if (typeof candidato === 'object') {
    return extraerPrecioNumerico(candidato.amount ?? candidato.value ?? candidato.price, profundidad + 1);
  }
  return null;
}

function buscarProductosEnJson(obj: any, resultados: ProductoCatalogo[] = [], profundidad = 0): ProductoCatalogo[] {
  if (obj == null || typeof obj !== 'object' || profundidad > 8) return resultados;
  if (Array.isArray(obj)) {
    for (const item of obj) buscarProductosEnJson(item, resultados, profundidad + 1);
    return resultados;
  }
  const nombre = obj.name ?? obj.displayName ?? obj.title ?? obj.productName ?? obj.description;
  const precioRaw = obj.price ?? obj.unitPrice?.price ?? obj.currentPrice ?? obj.finalPrice ?? obj.sellingPrice
    ?? obj?.prices?.price ?? obj?.priceInfo?.price;
  if (typeof nombre === 'string' && nombre.trim().length > 2) {
    const precio = extraerPrecioNumerico(precioRaw);
    if (precio != null && precio > 0) {
      const id = String(obj.id ?? obj.sku ?? obj.productId ?? obj.retailerProductId ?? obj.ean ?? `${nombre}-${precio}`);
      resultados.push({ id, nombre: nombre.trim(), precio });
    }
  }
  for (const key of Object.keys(obj)) buscarProductosEnJson(obj[key], resultados, profundidad + 1);
  return resultados;
}

function extraerBloquesJsonDeHtml(html: string): any[] {
  const bloques: any[] = [];
  const reScript = /<script[^>]*(?:type=["']application\/json["']|id=["'][^"']*(?:NEXT_DATA|__NUXT__|INITIAL_STATE)[^"']*["'])[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = reScript.exec(html))) {
    try { bloques.push(JSON.parse(m[1])); } catch {}
  }
  const reVar = /window\.__[A-Za-z0-9_]+__\s*=\s*(\{[\s\S]*?\})\s*;\s*(?:<\/script>|\n)/g;
  while ((m = reVar.exec(html))) {
    try { bloques.push(JSON.parse(m[1])); } catch {}
  }
  return bloques;
}

async function cookiesComoHeader(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

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
    page.locator('#btnSubmit_login'),
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
  await sleepAleatorio(2000, 3000);

  for (let i = 0; i < 8; i++) {
    if (!/my\.site\.com/i.test(page.url())) break;
    await sleepAleatorio(1000, 1500);
  }

  const siguePassword = await page.locator('input[type="password"]').first().count().catch(() => 0);
  const sigueFueraDeAlcampo = /my\.site\.com/i.test(page.url());
  const logueado = !siguePassword && !sigueFueraDeAlcampo;
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

async function buscarEnAlcampo(page: Page, consulta: string): Promise<{ precio: number | null; url: string | null; nombreWeb: string | null; confianzaAlta: boolean }> {
  const buscador = page.locator('input[type="search"], input[placeholder*="usca" i]').first();
  if (!(await buscador.count().catch(() => 0))) {
    await logRobot('precios_super', 'aviso', `alcampo buscador no encontrado. url=${page.url()} ${await sniffInputs(page)}`);
    return { precio: null, url: null, nombreWeb: null, confianzaAlta: false };
  }

  const capturas: { url: string; productos: ProductoCatalogo[] }[] = [];
  const vistas: string[] = [];
  let debugEndpointPrincipal: string | null = null;
  const onResponse = async (res: Response) => {
    try {
      const headers = await res.headers();
      const ct = headers['content-type'] || '';
      const url = res.url();
      if (vistas.length < 25) vistas.push(`${ct.split(';')[0] || '?'}::${url}`);
      if (ct.includes('json')) {
        const data = await res.json().catch(() => null);
        if (!data) return;
        const productos = buscarProductosEnJson(data);
        if (productos.length) { capturas.push({ url, productos }); return; }
        if (!debugEndpointPrincipal && /webproductpagews/i.test(url)) {
          debugEndpointPrincipal = JSON.stringify(data).slice(0, 1500);
        }
        return;
      }
      if (ct.includes('html') && /search/i.test(url)) {
        const html = await res.text().catch(() => '');
        for (const bloque of extraerBloquesJsonDeHtml(html)) {
          const productos = buscarProductosEnJson(bloque);
          if (productos.length) capturas.push({ url, productos });
        }
      }
    } catch {}
  };
  page.on('response', onResponse);

  await buscador.fill(consulta);
  await page.keyboard.press('Enter');
  await sleepAleatorio(2500, 4000);
  page.off('response', onResponse);
  await diag(page, `alcampo-buscar-${consulta.slice(0, 20)}`);

  if (!capturas.length) {
    await logRobot('precios_super', 'aviso', `alcampo "${consulta}": 0 respuestas JSON con productos interceptadas. debug_webproductpagews=${debugEndpointPrincipal ?? 'sin captura'}`);
    return { precio: null, url: null, nombreWeb: null, confianzaAlta: false };
  }

  capturas.sort((a, b) => b.productos.length - a.productos.length);
  const { url: endpoint, productos } = capturas[0];

  const { mejor, mejorScore, empatados, confianzaAlta } = mejorCoincidencia(consulta, productos);
  if (mejorScore === 0 || !mejor) {
    return { precio: null, url: null, nombreWeb: null, confianzaAlta: false };
  }
  if (!confianzaAlta || empatados > 1) {
    return { precio: null, url: null, nombreWeb: mejor.nombre, confianzaAlta: false };
  }
  return { precio: mejor.precio, url: endpoint, nombreWeb: mejor.nombre, confianzaAlta: true };
}

async function leerPrecioAlcampoDesdeUrl(url: string, cookie: string, nombreEsperado: string): Promise<number | null> {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json', ...(cookie ? { Cookie: cookie } : {}) } });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!data) return null;
    const productos = buscarProductosEnJson(data);
    const nombreNorm = normalizar(nombreEsperado);
    const match = productos.find((p) => normalizar(p.nombre) === nombreNorm);
    return match?.precio ?? null;
  } catch {
    return null;
  }
}

type Resultado = 'cargado' | 'sin_cambio_precio' | 'dudoso' | 'sin_match' | 'fallido';

async function procesarMercadona(sb: SupabaseClient, obj: Objetivo, mapeo: Mapeo | undefined, catalogo: ProductoCatalogo[], cookie: string): Promise<Resultado> {
  try {
    let precio: number | null = null;

    if (mapeo?.estado_match === 'ok' && mapeo.url_producto) {
      precio = await leerPrecioMercadonaPorUrl(mapeo.url_producto, cookie);
    }

    if (precio == null) {
      const consulta = obj.busqueda;
      const { mejor, mejorScore, empatados, confianzaAlta } = mejorCoincidencia(consulta, catalogo);
      if (mejorScore === 0 || !mejor) {
        await guardarMapeo(sb, obj.iding, obj.proveedor, { estado_match: 'sin_match' });
        await logRobot('precios_super', 'sin_match', `${obj.iding} (mercadona API) sin coincidencia para "${consulta}" en catálogo de ${catalogo.length} productos`);
        return 'sin_match';
      }
      if (!confianzaAlta || empatados > 1) {
        await guardarMapeo(sb, obj.iding, obj.proveedor, { estado_match: 'dudoso', nombre_web: mejor.nombre });
        await logRobot('precios_super', 'dudoso', `${obj.iding} (mercadona API) sin confianza alta para "${consulta}" (mejor: "${mejor.nombre}", score=${mejorScore}, empatados=${empatados})`);
        return 'dudoso';
      }
      const urlProducto = `${MERCADONA_API}/products/${mejor.id}/`;
      precio = mejor.precio ?? await leerPrecioMercadonaPorUrl(urlProducto, cookie);
      await guardarMapeo(sb, obj.iding, obj.proveedor, { estado_match: 'ok', url_producto: urlProducto, nombre_web: mejor.nombre });
    }

    if (precio == null || precio <= 0) {
      await logRobot('precios_super', 'fallido', `${obj.iding} precio inválido/no leído (mercadona API)`);
      return 'fallido';
    }
    const ok = await ingestarPrecio(sb, obj.iding, precio);
    if (!ok) return 'fallido';
    return precio === obj.precio_actual ? 'sin_cambio_precio' : 'cargado';
  } catch (e: any) {
    await logRobot('precios_super', 'error', `${obj.iding} excepción mercadona API: ${String(e?.message || e)}`);
    return 'fallido';
  }
}

async function procesarAlcampo(page: Page, sb: SupabaseClient, obj: Objetivo, mapeo: Mapeo | undefined, cookie: string): Promise<Resultado> {
  try {
    let precio: number | null = null;

    if (mapeo?.estado_match === 'ok' && mapeo.url_producto && mapeo.nombre_web) {
      precio = await leerPrecioAlcampoDesdeUrl(mapeo.url_producto, cookie, mapeo.nombre_web);
    }

    if (precio == null) {
      const consulta = obj.busqueda;
      const res = await buscarEnAlcampo(page, consulta);
      if (res.nombreWeb == null) {
        await guardarMapeo(sb, obj.iding, obj.proveedor, { estado_match: 'sin_match' });
        await logRobot('precios_super', 'sin_match', `${obj.iding} sin resultado buscando "${consulta}"`);
        return 'sin_match';
      }
      if (!res.confianzaAlta || res.precio == null || !res.url) {
        await guardarMapeo(sb, obj.iding, obj.proveedor, { estado_match: 'dudoso', nombre_web: res.nombreWeb });
        await logRobot('precios_super', 'dudoso', `${obj.iding} sin confianza alta buscando "${consulta}" (mejor: "${res.nombreWeb}")`);
        return 'dudoso';
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

async function procesarLoteAlcampo(
  browser: Browser, sb: SupabaseClient, objetivos: Objetivo[], mapeos: Map<string, Mapeo>, cred: Credencial | undefined,
): Promise<Record<Resultado, number>> {
  const contadores: Record<Resultado, number> = { cargado: 0, sin_cambio_precio: 0, dudoso: 0, sin_match: 0, fallido: 0 };
  const items = objetivos.filter((o) => o.proveedor === 'Alcampo').slice(0, MAX_ITEMS);
  if (!items.length) return contadores;
  if (!cred) {
    await logRobot('precios_super', 'error', `sin credenciales para Alcampo, se salta el lote (${items.length} ingredientes)`);
    return contadores;
  }

  const page = await browser.newPage();
  try {
    await fijarCpAlcampo(page);
    const logueado = await loginAlcampo(page, cred);
    if (!logueado) {
      await logRobot('precios_super', 'error', `alcampo: login no confirmado, se aborta el lote (${items.length} ingredientes) para no perder tiempo/anti-bot`);
      return contadores;
    }
    await diag(page, 'alcampo-post-login');
    const cookie = await cookiesComoHeader(page);

    for (const obj of items) {
      const mapeo = mapeos.get(obj.iding);
      const resultado = await procesarAlcampo(page, sb, obj, mapeo, cookie);
      contadores[resultado]++;
      await sleepAleatorio(1500, 3500);
    }
  } finally {
    await page.close();
  }
  return contadores;
}

async function procesarLoteMercadona(sb: SupabaseClient, objetivos: Objetivo[], mapeos: Map<string, Mapeo>): Promise<Record<Resultado, number>> {
  const contadores: Record<Resultado, number> = { cargado: 0, sin_cambio_precio: 0, dudoso: 0, sin_match: 0, fallido: 0 };
  const items = objetivos.filter((o) => o.proveedor === 'Mercadona').slice(0, MAX_ITEMS);
  if (!items.length) return contadores;

  let cookie = '';
  try {
    cookie = await fijarCpMercadonaApi();
  } catch (e: any) {
    await logRobot('precios_super', 'error', `mercadona API: no se pudo fijar CP: ${String(e?.message || e)}`);
    return contadores;
  }

  const necesitaCrawl = items.some((o) => mapeos.get(o.iding)?.estado_match !== 'ok' || !mapeos.get(o.iding)?.url_producto);
  let catalogo: ProductoCatalogo[] = [];
  if (necesitaCrawl) {
    try {
      catalogo = await crawlCatalogoMercadona(cookie);
    } catch (e: any) {
      await logRobot('precios_super', 'error', `mercadona API: fallo el crawl de categorías: ${String(e?.message || e)}`);
    }
  }

  for (const obj of items) {
    const mapeo = mapeos.get(obj.iding);
    const resultado = await procesarMercadona(sb, obj, mapeo, catalogo, cookie);
    contadores[resultado]++;
    await sleepAleatorio(300, 800);
  }
  return contadores;
}

// ---------- ESCANDALLO 2.0 · T4: completar-borradores Alcampo ----------
// Playwright no cabe en una función serverless de Vercel (binario de navegador +
// límites de tiempo/tamaño); por eso la mitad Alcampo de "completar-borradores"
// vive aquí, en el mismo robot semanal de GitHub Actions que ya tiene Chromium
// instalado y sesión logueada. La mitad Mercadona (API JSON, sin navegador) sí
// corre en Vercel: ver acción `completar-borradores` en escandallo-auto.ts,
// llamada aparte por pg_cron los domingos. DECISIÓN AUTÓNOMA (ESCANDALLO 2.0 T4.3):
// en vez de un cron nuevo domingo 05:00 Madrid solo para Alcampo, se aprovecha
// este job semanal ya existente (lunes 04:00 UTC) — mismo resultado (barrido
// semanal), sin duplicar infraestructura de navegador headless.
type BorradorAlcampo = { id: string; nombre: string; nombre_super: string | null };

function parsearFormatoYContenido(nombreWeb: string): { formato: string | null; valor: number; unidad: string } | null {
  const m = nombreWeb.match(/([\d]+(?:[.,]\d+)?)\s*(kg|g|gr|l|ml|ud|uds|unidad(?:es)?)\b/i);
  if (!m) return null;
  const valor = parseFloat(m[1].replace(',', '.'));
  if (!Number.isFinite(valor) || valor <= 0) return null;
  let unidad = m[2].toLowerCase();
  if (unidad === 'gr') unidad = 'g';
  if (unidad.startsWith('ud') || unidad.startsWith('unidad')) unidad = 'ud';
  // LEY-ANTIFALSOS: formato solo si el envase aparece escrito; si no, null (no se inventa).
  const formatoMatch = nombreWeb.match(/^(bolsa|caja|bandeja|bote|lata|botella|paquete|malla|tarrina|garrafa)/i);
  const formato = formatoMatch ? formatoMatch[1][0].toUpperCase() + formatoMatch[1].slice(1).toLowerCase() : null;
  return { formato, valor, unidad };
}

function normalizarContenido(valor: number, unidad: string): { std: string | null; min: string | null; uds: number | null } {
  switch (unidad) {
    case 'kg': return { std: 'Kg.', min: 'g.', uds: valor };
    case 'g': return { std: 'Kg.', min: 'g.', uds: valor / 1000 };
    case 'l': return { std: 'L.', min: 'ml.', uds: valor };
    case 'ml': return { std: 'L.', min: 'ml.', uds: valor / 1000 };
    case 'ud': return { std: 'Ud.', min: 'Ud.', uds: valor };
    default: return { std: null, min: null, uds: null };
  }
}

async function completarBorradoresAlcampo(browser: Browser, sb: SupabaseClient, cred: Credencial | undefined): Promise<{ procesados: number; rellenados: number }> {
  // "Necesita completar" = sin contenido normalizado (uds null); formato puede quedar null.
  const { data: borradores, error } = await sb
    .from('ingredientes')
    .select('id, nombre, nombre_super')
    .eq('borrador', true)
    .is('uds', null)
    .eq('proveedor_principal', 'Alcampo')
    .limit(20);
  if (error) { await logRobot('precios_super', 'error', `completar-borradores alcampo: ${error.message}`); return { procesados: 0, rellenados: 0 }; }
  const items = (borradores || []) as BorradorAlcampo[];
  if (!items.length) return { procesados: 0, rellenados: 0 };
  if (!cred) { await logRobot('precios_super', 'error', `completar-borradores alcampo: sin credenciales, se salta (${items.length} borradores)`); return { procesados: items.length, rellenados: 0 }; }

  const page = await browser.newPage();
  let rellenados = 0;
  try {
    await fijarCpAlcampo(page);
    const logueado = await loginAlcampo(page, cred);
    if (!logueado) {
      await logRobot('precios_super', 'error', `completar-borradores alcampo: login no confirmado, se aborta (${items.length} borradores)`);
      return { procesados: items.length, rellenados: 0 };
    }
    for (const b of items) {
      const consulta = b.nombre_super || b.nombre;
      const res = await buscarEnAlcampo(page, consulta);
      if (!res.confianzaAlta || res.precio == null || !res.nombreWeb) {
        await logRobot('precios_super', 'aviso', `completar-borradores alcampo: "${consulta}" sin match/confianza alta`);
        await sleepAleatorio(1500, 3000);
        continue;
      }
      const parsed = parsearFormatoYContenido(res.nombreWeb);
      if (!parsed) {
        await logRobot('precios_super', 'aviso', `completar-borradores alcampo: "${res.nombreWeb}" sin formato/contenido legible en el nombre`);
        await sleepAleatorio(1500, 3000);
        continue;
      }
      const { std, min, uds } = normalizarContenido(parsed.valor, parsed.unidad);
      if (!std || !uds) { await sleepAleatorio(1500, 3000); continue; }
      const eurStd = res.precio / uds;
      const eurMin = min === std ? eurStd : eurStd / 1000;

      await sb.from('ingredientes').update({
        formato: parsed.formato, uds, ud_std: std, ud_min: min,
        precio_total: res.precio, eur_std: eurStd, eur_min: eurMin,
        precio1: res.precio, ultimo_precio: res.precio, precio_activo: res.precio,
      }).eq('id', b.id);
      const fmtTxt = parsed.formato ? parsed.formato + ' ' : '';
      await sb.from('tareas_erp')
        .update({ descripcion: `Completado por robot (Alcampo): ${fmtTxt}${parsed.valor}${parsed.unidad}, ${res.precio}€. Revisa la merma antes de usarlo en recetas.` })
        .eq('ingrediente_id', b.id).neq('columna', 'hecho');
      rellenados++;
      await logRobot('precios_super', 'ok', `completar-borradores alcampo: ${b.nombre} → ${fmtTxt}${parsed.valor}${parsed.unidad} ${res.precio}€`);
      await sleepAleatorio(1500, 3000);
    }
  } finally {
    await page.close();
  }
  return { procesados: items.length, rellenados };
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Faltan SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  await logRobot('precios_super', 'inicio', 'arranque robot precios Mercadona+Alcampo');

  const [objetivos, mapeos, credenciales] = await Promise.all([
    cargarObjetivos(sb), cargarMapeo(sb), cargarCredenciales(sb),
  ]);

  const mer = await procesarLoteMercadona(sb, objetivos, mapeos);

  const alcItems = objetivos.filter((o) => o.proveedor === 'Alcampo').length;
  let alc: Record<Resultado, number> = { cargado: 0, sin_cambio_precio: 0, dudoso: 0, sin_match: 0, fallido: 0 };
  let completados = { procesados: 0, rellenados: 0 };
  if (alcItems > 0) {
    const browser = await chromium.launch({ headless: process.env.HEADFUL !== '1', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    try {
      alc = await procesarLoteAlcampo(browser, sb, objetivos, mapeos, credenciales.get('alcampo'));
      completados = await completarBorradoresAlcampo(browser, sb, credenciales.get('alcampo'));
    } finally {
      await browser.close();
    }
  }
  if (completados.procesados) {
    await logRobot('precios_super', 'resumen', `completar-borradores alcampo: ${completados.rellenados}/${completados.procesados} rellenados`);
  }

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
  await latido('precios_super', detalle);
  console.log(detalle);
}

const esEntryPoint = !!process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (esEntryPoint) {
  main().catch(async (e) => {
    console.error(e);
    const msg = `fallo fatal: ${String(e?.message || e)}`;
    await logRobot('precios_super', 'error', msg);
    await latido('precios_super', msg);
    process.exit(1);
  });
}
