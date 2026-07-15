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
 *  4. Mercadona usa la API JSON pública de tienda.mercadona.es (sin login, sin
 *     Playwright, sin anti-bot) — ver bloque MERCADONA. Alcampo usa Playwright
 *     con login real + intercepción de las respuestas JSON internas de la SPA
 *     (nunca se parsea el HTML renderizado) — ver bloque ALCAMPO.
 *
 * Nada de precios inventados: sin lectura fiable = hueco + log, nunca se adivina.
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

// ---------- MERCADONA (API pública, sin Playwright ni login) ----------
// tienda.mercadona.es expone una API JSON pública (misma que usa su propia web).
// Nada de anti-bot ni RadarSuper: fetch directo. Referencia de esquema:
// github.com/datania/mercadona-catalog (api.md).
const MERCADONA_API = 'https://tienda.mercadona.es/api';
const MERCADONA_CP = '28038';

type ProductoCatalogo = { id: string; nombre: string; precio: number | null };

async function fetchJson(url: string, cookie: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, { ...init, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(init?.headers || {}) } });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.json();
}

// Fija el CP de la cocina y devuelve la cookie de sesión (identifica el
// almacén) que hay que reenviar en el resto de peticiones.
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

// Recorre categorías → subcategorías → productos y devuelve el catálogo plano
// en memoria. Se hace una sola vez por pasada (no por ingrediente): más rápido
// y evita 200 búsquedas sueltas. Subcategorías puntuales que fallan se saltan,
// no tumban el crawl.
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

// Quita tildes/puntuación para comparar nombres sin depender del acentuado exacto.
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
// Coincidencia por solape de palabras (sin depender de clases CSS ni de un
// endpoint de búsqueda): cuenta cuántas palabras de la consulta aparecen en el
// nombre del producto. Si el mejor resultado está empatado con otro, es dudoso.
// Desempate Hacendado: entre varios candidatos empatados, si solo uno empieza
// literalmente por el término buscado y es marca propia Hacendado (la más
// habitual en el Escandallo), se elige sin marcar dudoso — es la coincidencia
// más directa posible. Si el mejor candidato ni siquiera contiene el término
// base no se fuerza nada (p.ej. "Cebolla blanca" no debe resolver a "Alubia").
function desempatarHacendado(consultaNorm: string, empatados: ProductoCatalogo[]): ProductoCatalogo | null {
  const candidatos = empatados.filter((p) => {
    const n = normalizar(p.nombre);
    return n.startsWith(consultaNorm) && /hacendado/.test(n);
  });
  return candidatos.length === 1 ? candidatos[0] : null;
}

function mejorCoincidencia(consulta: string, catalogo: ProductoCatalogo[]): { mejor: ProductoCatalogo | null; mejorScore: number; empatados: number } {
  const consultaNorm = normalizar(consulta);
  const tokensConsulta = consultaNorm.split(' ').filter(Boolean);

  // 1) Subcadena exacta: el nombre del producto contiene la consulta completa
  // literal. Mucho más fiable que el solape de palabras para consultas cortas
  // (p.ej. "Limón" solapa con decenas de productos, pero muy pocos lo tienen
  // como subcadena exacta). Desempata por nombre más corto = coincidencia más directa.
  const porSubcadena = catalogo.filter((p) => normalizar(p.nombre).includes(consultaNorm));
  if (porSubcadena.length > 0) {
    porSubcadena.sort((a, b) => a.nombre.length - b.nombre.length);
    const largoMinimo = porSubcadena[0].nombre.length;
    const empatadosArr = porSubcadena.filter((p) => p.nombre.length === largoMinimo);
    if (empatadosArr.length > 1) {
      const ganador = desempatarHacendado(consultaNorm, empatadosArr);
      if (ganador) return { mejor: ganador, mejorScore: tokensConsulta.length, empatados: 1 };
    }
    return { mejor: porSubcadena[0], mejorScore: tokensConsulta.length, empatados: empatadosArr.length };
  }

  // 2) Solape de palabras (fallback), desempatando también por nombre más corto.
  let mejor: ProductoCatalogo | null = null;
  let mejorScore = 0;
  let mejorLen = Infinity;
  let empatadosArr: ProductoCatalogo[] = [];
  for (const p of catalogo) {
    const nombreNorm = normalizar(p.nombre);
    const tokensNombre = new Set(nombreNorm.split(' ').filter(Boolean));
    let score = 0;
    for (const t of tokensConsulta) if (tokensNombre.has(t)) score++;
    if (score === 0) continue;
    if (score > mejorScore || (score === mejorScore && nombreNorm.length < mejorLen)) {
      mejor = p; mejorScore = score; mejorLen = nombreNorm.length; empatadosArr = [p];
    } else if (score === mejorScore && nombreNorm.length === mejorLen) {
      empatadosArr.push(p);
    }
  }
  if (empatadosArr.length > 1) {
    const ganador = desempatarHacendado(consultaNorm, empatadosArr);
    if (ganador) return { mejor: ganador, mejorScore, empatados: 1 };
  }
  return { mejor, mejorScore, empatados: empatadosArr.length };
}

// ---------- ALCAMPO (Playwright con login + intercepción de red JSON interna) ----------
const ALCAMPO_CP = '28038';

// La SPA de compraonline.alcampo.es no tiene API pública documentada: en vez
// de parsear el HTML renderizado (comprobado en vivo que nombre y precio
// viven en ramas distintas del DOM, sin forma fiable de emparejarlos) se
// interceptan las respuestas JSON que la propia SPA dispara al buscar.
// Escanea cualquier JSON recursivamente en busca de objetos "producto": un
// campo de nombre y uno de precio numérico >0. No se asume un esquema fijo.
// El precio casi nunca es un número/string suelto: suele venir anidado como
// {amount:"1.45", currency:"EUR"} o {value:1.45} (confirmado en vivo con el
// endpoint real de Alcampo: price.amount). Se baja recursivamente hasta dar
// con un número — un `??` normal no sirve aquí porque el objeto anidado no es
// null/undefined y por tanto nunca deja pasar al siguiente candidato.
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

// Algunas SPAs no llaman a un endpoint JSON aparte para la búsqueda: renderizan
// el resultado en servidor y embeben el estado inicial en un <script> del HTML
// (__NEXT_DATA__, __NUXT__, window.__INITIAL_STATE__…). Se extraen esos bloques
// para pasarlos también por buscarProductosEnJson.
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
  await sleepAleatorio(2000, 3000);

  // El login pasa por varios saltos de Salesforce Identity (authorization →
  // intermediary → vuelta a alcampo.es) — comprobado en vivo: a los 2.5-3s
  // seguía en un salto intermedio y se marcaba como fallo en falso. Se espera
  // a que la URL salga del dominio my.site.com antes de decidir.
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

// Busca en Alcampo interceptando las respuestas JSON internas que la SPA
// dispara al escribir en el buscador — NO se parsea el HTML renderizado.
// LEY-ANTIFALSOS: solo se carga si el nombre casa de verdad contra la
// consulta (mejorCoincidencia); ambiguo o sin match no fuerza nada.
async function buscarEnAlcampo(page: Page, consulta: string): Promise<{ precio: number | null; url: string | null; nombreWeb: string | null; candidatos: number }> {
  const buscador = page.locator('input[type="search"], input[placeholder*="usca" i]').first();
  if (!(await buscador.count().catch(() => 0))) {
    await logRobot('precios_super', 'aviso', `alcampo buscador no encontrado. url=${page.url()} ${await sniffInputs(page)}`);
    return { precio: null, url: null, nombreWeb: null, candidatos: 0 };
  }

  const capturas: { url: string; productos: ProductoCatalogo[] }[] = [];
  const vistas: string[] = [];
  // Patrón de endpoint confirmado en vivo: /api/webproductpagews/v6/product-pages/search
  // — si su JSON no produce productos (forma real desconocida), se vuelca un
  // fragmento para ajustar buscarProductosEnJson.
  let debugEndpointPrincipal: string | null = null;
  const onResponse = async (res: Response) => {
    try {
      const headers = await res.headers();
      const ct = headers['content-type'] || '';
      const url = res.url();
      if (vistas.length < 25) vistas.push(`${ct.split(';')[0] || '?'}::${url}`);
      // Sin filtrar por palabra clave en la URL (podría ser GraphQL u otro
      // endpoint sin nombre reconocible) — cualquier JSON cuenta, el filtro
      // real es que buscarProductosEnJson encuentre objetos con forma de
      // producto (nombre + precio), no ruido de analítica/config.
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
      // Fallback: SPAs con renderizado en servidor embeben el estado inicial
      // en el HTML (sin llamada JSON aparte) — se busca ahí también.
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
  await sleepAleatorio(2500, 4000); // deja tiempo a que la SPA dispare y resuelva las llamadas
  page.off('response', onResponse);
  await diag(page, `alcampo-buscar-${consulta.slice(0, 20)}`);

  if (!capturas.length) {
    await logRobot('precios_super', 'aviso', `alcampo "${consulta}": 0 respuestas JSON con productos interceptadas. debug_webproductpagews=${debugEndpointPrincipal ?? 'sin captura'}`);
    return { precio: null, url: null, nombreWeb: null, candidatos: 0 };
  }

  // Nos quedamos con la captura que trae más productos (la de resultados de
  // búsqueda; descarta llamadas sueltas de recomendaciones/analítica).
  capturas.sort((a, b) => b.productos.length - a.productos.length);
  const { url: endpoint, productos } = capturas[0];

  const { mejor, mejorScore, empatados } = mejorCoincidencia(consulta, productos);
  if (mejorScore === 0 || !mejor) {
    return { precio: null, url: null, nombreWeb: null, candidatos: 0 };
  }
  if (empatados > 1) {
    return { precio: null, url: null, nombreWeb: mejor.nombre, candidatos: empatados };
  }
  return { precio: mejor.precio, url: endpoint, nombreWeb: mejor.nombre, candidatos: 1 };
}

// Reutiliza el patrón de endpoint JSON guardado en el mapeo con la cookie de
// sesión capturada tras el login — evita repetir la búsqueda completa por
// Playwright cuando ya sabemos qué endpoint y qué nombre de producto buscar.
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

// ---------- Resultado por ingrediente ----------
type Resultado = 'cargado' | 'sin_cambio_precio' | 'dudoso' | 'sin_match' | 'fallido';

async function procesarMercadona(sb: SupabaseClient, obj: Objetivo, mapeo: Mapeo | undefined, catalogo: ProductoCatalogo[], cookie: string): Promise<Resultado> {
  try {
    let precio: number | null = null;

    if (mapeo?.estado_match === 'ok' && mapeo.url_producto) {
      precio = await leerPrecioMercadonaPorUrl(mapeo.url_producto, cookie);
    }

    if (precio == null) {
      const consulta = nombreBusqueda(obj.nombre);
      const { mejor, mejorScore, empatados } = mejorCoincidencia(consulta, catalogo);
      if (mejorScore === 0 || !mejor) {
        await guardarMapeo(sb, obj.iding, obj.proveedor, { estado_match: 'sin_match' });
        await logRobot('precios_super', 'sin_match', `${obj.iding} (mercadona API) sin coincidencia para "${consulta}" en catálogo de ${catalogo.length} productos`);
        return 'sin_match';
      }
      if (empatados > 1) {
        await guardarMapeo(sb, obj.iding, obj.proveedor, { estado_match: 'dudoso', nombre_web: mejor.nombre });
        await logRobot('precios_super', 'dudoso', `${obj.iding} (mercadona API) ${empatados} candidatos empatados para "${consulta}" (mejor: "${mejor.nombre}")`);
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
      await sleepAleatorio(1500, 3500); // ritmo humano entre productos
    }
  } finally {
    await page.close();
  }
  return contadores;
}

// Mercadona vía API: sin Playwright, un solo crawl del catálogo por pasada
// (si hace falta) y fetch directo para los que ya tienen mapeo 'ok'.
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

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Faltan SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  await logRobot('precios_super', 'inicio', 'arranque robot precios Mercadona+Alcampo');

  const [objetivos, mapeos, credenciales] = await Promise.all([
    cargarObjetivos(sb), cargarMapeo(sb), cargarCredenciales(sb),
  ]);

  // Mercadona (API, sin navegador) va primero y no necesita Playwright.
  const mer = await procesarLoteMercadona(sb, objetivos, mapeos);

  const alcItems = objetivos.filter((o) => o.proveedor === 'Alcampo').length;
  let alc: Record<Resultado, number> = { cargado: 0, sin_cambio_precio: 0, dudoso: 0, sin_match: 0, fallido: 0 };
  if (alcItems > 0) {
    const browser = await chromium.launch({ headless: process.env.HEADFUL !== '1', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    try {
      alc = await procesarLoteAlcampo(browser, sb, objetivos, mapeos, credenciales.get('alcampo'));
    } finally {
      await browser.close();
    }
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
  console.log(detalle);
}

const esEntryPoint = !!process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (esEntryPoint) {
  main().catch(async (e) => {
    console.error(e);
    await logRobot('precios_super', 'error', `fallo fatal: ${String(e?.message || e)}`);
    process.exit(1);
  });
}
