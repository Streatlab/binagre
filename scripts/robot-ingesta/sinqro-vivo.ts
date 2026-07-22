/**
 * SINQRO VIVO v4 · snapshot de pedidos Just Eat del día en curso, cada ~5 min
 * durante servicio (11:00–00:30 Madrid). Solo corre en horario de restaurante:
 * fuera de servicio la vista sale "No se han encontrado pedidos" y no se guarda.
 *
 * v4 (22-jul): desglose por marca. La vista "en vivo" no trae marca en la
 * tarjeta, pero cada tarjeta enlaza (ng-repeat="order in orders...") al
 * detalle del pedido (#/sp/6416/online/orders/{id}), que sí la muestra. Por
 * cada pedido nuevo (no visto antes hoy, ver caché en ventas_vivo.crudo) se
 * visita su detalle y se busca el nombre de marca conocido (tabla `marcas`)
 * en el texto. LEY-ANTIFALSOS: si CUALQUIER pedido del lote no resuelve
 * marca, el lote ENTERO cae al agregado de siempre (marca='Streat Lab') — el
 * fallback es más importante que el desglose, nunca se inventa una marca ni
 * se pierde importe. Lógica de agrupación/caché/fallback: ./_lib/justEatMarca.ts
 * (pura, testeada en tests/sinqro-vivo-justeat-marca.test.ts).
 *
 * v3 (19-jul): además de pedidos + € (que anclan el Panel), extrae:
 *   - por_horas: nº de pedidos y bruto agrupados por hora del pedido.
 *   - top_productos: unidades por producto del día (agregado de las tarjetas JE).
 * Ambos son ADITIVOS: si no se detectan, quedan null/[] y NUNCA alteran el
 * cálculo de pedidos/importe (LEY-ANTIFALSOS: un hueco antes que un dato malo).
 * Se vuelca el DOM (máx 1/hora) SOLO cuando hay pedidos, para poder afinar el
 * parser de productos contra una lectura real en horario.
 *
 * HISTORIA (guardas que se mantienen):
 *   - INCIDENTE 16-jul: nunca se escribe una lectura en 0 (se descarta y loguea).
 *   - Solo se escriben filas plataforma='just_eat' (una o varias, una por
 *     marca); jamás una fila TOTAL propia (el Panel ancla el vivo a la fila
 *     TOTAL de Rushour).
 *   - Lector probado (datepicker real + marcado robusto de tipos + espera a que
 *     termine la búsqueda), autocontenido aquí.
 */
import { chromium, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { hoyMadrid, log, latido } from './_lib/bandeja.js';
import {
  idDeHref, marcaEnTexto, cacheDesdeHistorico, agruparPorMarca, mismoConjuntoJE,
  type PedidoJE, type LineaJEMarca,
} from './_lib/justEatMarca.js';

const P = 'sinqro_vivo';
const TABLA_VIVO = 'ventas_vivo';
const sb = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

const SINQRO = {
  loginUrl: 'https://app.sinqro.com/',
  ventasUrl: 'https://app.sinqro.com/#/sp/6416/online/orders',
  user: process.env.SINQRO_USER || '', pass: process.env.SINQRO_PASS || '',
  tipoChecks: ['#deliveryFilter', '#collectionFilter', '#insideFilter', '#insituFilter', '#reservationFilter'],
  startDate: '#startDateFilter', endDate: '#endDateFilter',
};
const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const r2 = (n: number) => Math.round(n * 100) / 100;
function numES(s: string): number {
  const m = (s || '').match(/-?\d[\d.,]*/);
  if (!m) return 0;
  let x = m[0];
  const up = x.lastIndexOf('.'), uc = x.lastIndexOf(',');
  if (uc > up) x = x.replace(/\./g, '').replace(',', '.'); else x = x.replace(/,/g, '');
  return parseFloat(x) || 0;
}

/* ---------- extracción aditiva (v3): hora y productos por tarjeta ---------- */

/** Hora del pedido dentro de una tarjeta (primer HH:MM plausible). */
function horaDeTarjeta(t: string): string | null {
  const m = t.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!m) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

/** Líneas de producto dentro de una tarjeta. Defensivo: varios formatos.
 * Devuelve [{nombre, unidades}]. Si nada encaja, [] (nunca inventa). */
function productosDeTarjeta(t: string): { nombre: string; unidades: number }[] {
  const out: { nombre: string; unidades: number }[] = [];
  const limpio = (s: string) => s.replace(/\s+/g, ' ').replace(/[·•\-–—:]+$/, '').trim();
  const valido = (s: string) => {
    const n = limpio(s);
    // descarta ruido: importes, fechas, horas, estados, etiquetas conocidas
    if (n.length < 3 || n.length > 80) return false;
    if (/€|\d{1,2}:\d{2}|\d{2}\/\d{2}|just\s?eat|glovo|uber|pedido|total|cliente|direcci|estado|pago|reparto|domicilio|recoger/i.test(n)) return false;
    if (!/[a-záéíóúñ]/i.test(n)) return false;
    return true;
  };
  for (const raw of t.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    // "2 x Producto" | "2x Producto" | "2 × Producto"
    let m = line.match(/^(\d{1,3})\s*[x×]\s*(.+)$/i);
    if (m && valido(m[2])) { out.push({ nombre: limpio(m[2]), unidades: Number(m[1]) || 1 }); continue; }
    // "Producto x2" | "Producto × 2"
    m = line.match(/^(.+?)\s*[x×]\s*(\d{1,3})$/i);
    if (m && valido(m[1])) { out.push({ nombre: limpio(m[1]), unidades: Number(m[2]) || 1 }); continue; }
    // "1  Producto" (cantidad al inicio, sin x)
    m = line.match(/^(\d{1,3})\s+([a-záéíóúñ].{2,})$/i);
    if (m && valido(m[2])) { out.push({ nombre: limpio(m[2]), unidades: Number(m[1]) || 1 }); continue; }
  }
  return out;
}

/* ---------- LECTOR PROBADO (mismo método que sync-facturacion) ---------- */
async function elegirFechaCalendario(page: Page, inputSel: string, fechaISO: string): Promise<boolean> {
  const anioObj = Number(fechaISO.slice(0, 4)), mesObj = Number(fechaISO.slice(5, 7)), diaObj = Number(fechaISO.slice(8, 10));
  await page.locator(inputSel).first().click({ timeout: 8000 }).catch(() => {});
  const dp = page.locator('#ui-datepicker-div');
  await dp.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  if (!(await dp.isVisible().catch(() => false))) return false;
  for (let i = 0; i < 60; i++) {
    const mesTxt = ((await dp.locator('.ui-datepicker-month').first().textContent().catch(() => '')) || '').trim().toLowerCase();
    const anioTxt = ((await dp.locator('.ui-datepicker-year').first().textContent().catch(() => '')) || '').trim();
    const anioCur = parseInt(anioTxt, 10);
    const mesCur = MESES_ES.findIndex((m) => mesTxt.startsWith(m.slice(0, 4))) + 1;
    if (!Number.isFinite(anioCur) || mesCur <= 0) return false;
    if (anioCur === anioObj && mesCur === mesObj) break;
    const atras = anioCur > anioObj || (anioCur === anioObj && mesCur > mesObj);
    await dp.locator(atras ? '.ui-datepicker-prev' : '.ui-datepicker-next').first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(250);
  }
  const celda = dp.locator(`td[data-month="${mesObj - 1}"][data-year="${anioObj}"] a`, { hasText: new RegExp(`^${diaObj}$`) }).first();
  if (!(await celda.count().catch(() => 0))) return false;
  await celda.click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
  return true;
}
async function marcarTodosLosTipos(page: Page): Promise<number> {
  let m = 0;
  for (const sel of SINQRO.tipoChecks) {
    const chk = page.locator(sel).first();
    if (!(await chk.count().catch(() => 0))) continue;
    if (!(await chk.isChecked().catch(() => false))) {
      await chk.click({ force: true, timeout: 3000 }).catch(() => {});
      if (!(await chk.isChecked().catch(() => false))) {
        await page.locator(`label[for="${sel.replace('#', '')}"]`).first().click({ force: true, timeout: 3000 }).catch(() => {});
      }
      if (!(await chk.isChecked().catch(() => false))) {
        await chk.dispatchEvent('click').catch(() => {});
        await chk.dispatchEvent('change').catch(() => {});
      }
    }
    if (await chk.isChecked().catch(() => false)) m++;
    await page.waitForTimeout(200);
  }
  return m;
}

type LecturaJE = {
  pedidos: number; bruto: number; tarjetas: number;
  porHoras: { hora: string; pedidos: number; bruto: number }[];
  topProductos: { nombre: string; unidades: number }[];
  dom: string;
  pedidosJE: PedidoJE[];
};

/** Ids de pedido de cada tarjeta del listado, en el mismo orden que aparecen
 * en el DOM (y por tanto alineados con el split por "Pedido #" del texto):
 * cada tarjeta es <a href="#/sp/6416/online/orders/{id}" ng-repeat="order in
 * orders...">. Si el selector no encuentra nada devuelve [] (defensivo). */
async function idsDePedidosDelListado(page: Page): Promise<(string | null)[]> {
  const hrefs = await page.$$eval('a[ng-repeat^="order in orders"]', (as) => as.map((a) => a.getAttribute('href'))).catch(() => [] as (string | null)[]);
  return hrefs.map(idDeHref);
}

/** Just Eat del día: pedidos, bruto, desglose por horas y top productos. */
async function leerJustEatDia(page: Page, fecha: string): Promise<LecturaJE> {
  const vacio: LecturaJE = { pedidos: 0, bruto: 0, tarjetas: 0, porHoras: [], topProductos: [], dom: '', pedidosJE: [] };
  await page.goto(SINQRO.loginUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  if (await page.locator('#login-email').first().count().catch(() => 0)) {
    await page.fill('#login-email', SINQRO.user).catch(() => {});
    await page.fill('#login-password', SINQRO.pass).catch(() => {});
    await Promise.all([page.waitForLoadState('networkidle').catch(() => {}), page.click('#loginButton').catch(() => {})]);
    await page.waitForTimeout(4000);
  }
  await page.goto(SINQRO.ventasUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const ok1 = await elegirFechaCalendario(page, SINQRO.startDate, fecha);
  const ok2 = await elegirFechaCalendario(page, SINQRO.endDate, fecha);
  if (!ok1 || !ok2) { await log(P, 'error', `no pude fijar la fecha ${fecha} en el calendario`); return vacio; }
  const marcados = await marcarTodosLosTipos(page);
  await page.getByRole('button', { name: /buscar/i }).first().click({ timeout: 5000 }).catch(() => {});
  const sd = page.locator(SINQRO.startDate).first();
  for (let i = 0; i < 40; i++) {
    if (!(await sd.isDisabled().catch(() => false))) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(2500);

  const dom = (await page.content().catch(() => '')) || '';
  const texto = ((await page.locator('body').innerText().catch(() => '')) || '').replace(/\u00a0/g, ' ');
  const tarjetas = texto.split(/Pedido\s*#/).slice(1);
  // ids de pedido alineados con `tarjetas` (mismo orden de aparición en el DOM).
  // Si el nº de anchors no cuadra con el nº de tarjetas de texto, mejor no
  // alinear nada (defensivo) que alinear mal: id=null para todas → fallback.
  const hrefsIds = await idsDePedidosDelListado(page);
  const idsAlineados = hrefsIds.length === tarjetas.length ? hrefsIds : tarjetas.map(() => null);

  const horas = new Map<string, { pedidos: number; bruto: number }>();
  const prods = new Map<string, number>();
  const pedidosJE: PedidoJE[] = [];
  let pedidos = 0, bruto = 0;
  tarjetas.forEach((t, i) => {
    if (!/just\s?eat/i.test(t)) return;
    const mE = t.match(/(\d[\d.,]*)\s*€/);
    if (!mE) return;
    const imp = r2(numES(mE[1]));
    pedidos += 1;
    bruto += imp;
    pedidosJE.push({ id: idsAlineados[i] ?? null, importe: imp });
    // por horas (aditivo)
    const h = horaDeTarjeta(t);
    if (h) { const cur = horas.get(h) || { pedidos: 0, bruto: 0 }; cur.pedidos += 1; cur.bruto = r2(cur.bruto + imp); horas.set(h, cur); }
    // top productos (aditivo, defensivo)
    for (const p of productosDeTarjeta(t)) prods.set(p.nombre, (prods.get(p.nombre) || 0) + p.unidades);
  });

  const porHoras = [...horas.entries()].map(([hora, v]) => ({ hora, pedidos: v.pedidos, bruto: v.bruto })).sort((a, b) => a.hora.localeCompare(b.hora));
  const topProductos = [...prods.entries()].map(([nombre, unidades]) => ({ nombre, unidades })).sort((a, b) => b.unidades - a.unidades).slice(0, 15);

  await log(P, 'lectura', `${fecha} tipos=${marcados} tarjetas=${tarjetas.length} JE=${pedidos} ped / ${r2(bruto)}€ · horas=${porHoras.length} prod=${topProductos.length} · ids=${idsAlineados.filter(Boolean).length}/${tarjetas.length}`);
  return { pedidos, bruto: r2(bruto), tarjetas: tarjetas.length, porHoras, topProductos, dom, pedidosJE };
}

/** Detalle de un pedido: busca en su texto visible el nombre de alguna marca
 * conocida. null si no encaja ninguna (defensivo — nunca inventa marca). */
async function marcaDePedido(page: Page, id: string, candidatas: string[]): Promise<string | null> {
  const url = `${SINQRO.ventasUrl}/${id}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1500);
  const texto = (await page.locator('body').innerText().catch(() => '')) || '';
  return marcaEnTexto(texto, candidatas);
}

/** Nombres de marca conocidos (actuales + anteriores) para reconocer en el
 * detalle de pedido. Todas las marcas, no solo activas: una marca recién
 * desactivada puede seguir teniendo pedidos JE de hoy en curso. */
async function marcasConocidas(): Promise<string[]> {
  const { data } = await sb.from('marcas').select('nombre, nombre_anterior');
  const out = new Set<string>();
  for (const m of (data || []) as { nombre: string | null; nombre_anterior: string | null }[]) {
    if (m.nombre) out.add(m.nombre);
    if (m.nombre_anterior) out.add(m.nombre_anterior);
  }
  return [...out];
}

/** Caché id→marca de lo ya resuelto hoy (evita revisitar el detalle de
 * pedidos ya conocidos en cada tick de 5 min). */
async function cacheMarcasHoy(fecha: string): Promise<Map<string, string>> {
  const { data } = await sb.from(TABLA_VIVO).select('marca, crudo').eq('fecha', fecha).eq('plataforma', 'just_eat');
  return cacheDesdeHistorico((data || []) as { marca: string; crudo: unknown }[]);
}

// Tope defensivo: nº máximo de pedidos NUEVOS (no cacheados) que se visitan
// en un solo tick, para no colgar un tick visitando decenas de detalles tras
// una caída larga del robot. Si hay más pendientes que el tope, se visita
// igualmente hasta el tope (así el backlog SIEMPRE se reduce tick a tick) y
// el resto se queda para el siguiente — este tick cae a fallback porque
// agruparPorMarca no encuentra marca para los que aún no se visitaron.
const MAX_DETALLES_POR_TICK = 40;

/** Resuelve el desglose por marca de los pedidos JE del día, usando caché +
 * detalle de pedido para lo nuevo. Todo o nada (ver agruparPorMarca). */
async function resolverDesgloseJE(page: Page, fecha: string, pedidosJE: PedidoJE[]) {
  const candidatas = await marcasConocidas();
  const cache = await cacheMarcasHoy(fecha);

  const pendientesTodos = [...new Set(pedidosJE.map((p) => p.id).filter((id): id is string => !!id && !cache.has(id)))];
  const pendientes = pendientesTodos.slice(0, MAX_DETALLES_POR_TICK);
  for (const id of pendientes) {
    const marca = await marcaDePedido(page, id, candidatas);
    if (marca) cache.set(id, marca);
    // si no resuelve, se queda fuera de la caché: agruparPorMarca hará fallback para este pedido.
  }
  if (pendientes.length) await log(P, 'marca_je', `${fecha}: ${pendientes.length} detalle(s) de pedido visitado(s), caché=${cache.size}`);
  if (pendientesTodos.length > pendientes.length) {
    await log(P, 'marca_je_tope', `${fecha}: tope de ${MAX_DETALLES_POR_TICK}/tick alcanzado, ${pendientesTodos.length - pendientes.length} pedido(s) quedan para el siguiente tick`);
  }

  return agruparPorMarca(pedidosJE, (id) => cache.get(id) ?? null);
}

/** Vuelca el DOM como máximo 1 vez/hora, solo cuando hay pedidos (para afinar). */
async function volcarDomSiToca(fecha: string, dom: string) {
  if (!dom) return;
  const { data: ya } = await sb.from('robot_debug').select('ts')
    .eq('fuente', 'sinqro_vivo_dom').gte('ts', new Date(Date.now() - 3600e3).toISOString()).limit(1);
  if (!ya?.length) await sb.from('robot_debug').insert([{ fuente: 'sinqro_vivo_dom', fecha, html: dom }]);
}

async function main() {
  const fecha = hoyMadrid();
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ timezoneId: 'Europe/Madrid' });
  const page = await ctx.newPage();
  try {
    const { pedidos, bruto, tarjetas, porHoras, topProductos, dom, pedidosJE } = await leerJustEatDia(page, fecha);

    // GUARDA 1: una lectura en 0 no se escribe jamás.
    if (pedidos === 0 && bruto === 0) {
      await log(P, tarjetas > 0 ? 'sin_je' : 'sospechoso', `${fecha}: 0 JE (tarjetas totales: ${tarjetas}) — no se guarda`);
      await latido(P, fecha, `0 JE (tarjetas: ${tarjetas}), nada que guardar`);
      return;
    }

    // Hay pedidos: vuelca el DOM (máx 1/hora) para poder afinar el parser.
    await volcarDomSiToca(fecha, dom);

    // Desglose por marca (todo o nada) — ver ./_lib/justEatMarca.ts.
    const desglose = await resolverDesgloseJE(page, fecha, pedidosJE);

    type FilaVivo = {
      fecha: string; plataforma: 'just_eat'; marca: string; pedidos: number; facturacion: number;
      por_horas: { hora: string; pedidos: number; bruto: number }[] | null;
      crudo: Record<string, unknown>;
    };

    const filasNuevas: FilaVivo[] = desglose.resuelto
      ? desglose.lineas.map((l: LineaJEMarca, i: number) => ({
          fecha, plataforma: 'just_eat', marca: l.marca,
          pedidos: l.pedidos, facturacion: l.bruto,
          // por_horas/topProducts son del día completo de JE (no por marca): se
          // adjuntan solo a la 1ª fila para no triplicar el conteo aguas abajo
          // (fn_informe_cierre suma por_horas de TODAS las filas del momento).
          por_horas: i === 0 && porHoras.length ? porHoras : null,
          crudo: {
            origen: 'sinqro_vivo_v4', resuelto: true, pedidos_ids: l.ids,
            topProducts: i === 0 && topProductos.length ? topProductos : null,
          },
        }))
      : [{
          // GUARDA 2 (fallback obligatorio): fila agregada exactamente como
          // antes de v4 — nunca se pierde importe ni se inventa marca.
          fecha, plataforma: 'just_eat', marca: 'Streat Lab',
          pedidos, facturacion: bruto,
          por_horas: porHoras.length ? porHoras : null,
          crudo: {
            origen: 'sinqro_vivo_v4', resuelto: false, motivo: desglose.motivo,
            topProducts: topProductos.length ? topProductos : null,
          },
        }];

    // ¿Cambió algo respecto a la última tanda guardada? (todas las filas de
    // just_eat con el momento más reciente de hoy, sea 1 fila o desglosadas).
    const { data: ultimoMomento } = await sb.from(TABLA_VIVO).select('momento')
      .eq('fecha', fecha).eq('plataforma', 'just_eat')
      .order('momento', { ascending: false }).limit(1).maybeSingle();

    let filasAnteriores: { marca: string; pedidos: number; facturacion: number }[] = [];
    if (ultimoMomento?.momento) {
      const { data } = await sb.from(TABLA_VIVO).select('marca, pedidos, facturacion')
        .eq('fecha', fecha).eq('plataforma', 'just_eat').eq('momento', ultimoMomento.momento);
      filasAnteriores = (data || []) as typeof filasAnteriores;
    }
    const comparablesNuevas = filasNuevas.map((f) => ({ marca: f.marca, pedidos: f.pedidos, facturacion: f.facturacion }));
    const cambiado = !mismoConjuntoJE(filasAnteriores, comparablesNuevas);

    if (cambiado) {
      // GUARDA 2: solo filas plataforma='just_eat'; jamás una fila TOTAL. Se
      // insertan todas en una sola llamada para que compartan `momento`
      // (default now() del propio INSERT) — así fn_informe_cierre las agrupa
      // como el mismo tick.
      await sb.from(TABLA_VIVO).insert(filasNuevas);
    }

    const resumenMarcas = desglose.resuelto
      ? desglose.lineas.map((l: LineaJEMarca) => `${l.marca}=${l.pedidos}/${l.bruto}€`).join(', ')
      : `agregado sin desglosar (${desglose.motivo})`;
    await log(P, 'ok', `${fecha} · pedidos=${pedidos} facturacion=${bruto} · ${resumenMarcas} · horas=${porHoras.length} prod=${topProductos.length} · ${cambiado ? 'guardado' : 'sin cambios'} · tabla=${TABLA_VIVO}`);
    await latido(P, fecha, `pedidos=${pedidos} facturacion=${bruto} · tabla=${TABLA_VIVO}`);
  } catch (e: any) {
    await log(P, 'error', String(e?.message || e));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
