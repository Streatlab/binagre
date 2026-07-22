/* ═══════════════════════════════════════════════════════════════════════════
 * Lista de Compra — helpers de dominio (proveedor, agrupación, semana ISO)
 * Usado por src/pages/cocina/ListaCompra.tsx
 * ═══════════════════════════════════════════════════════════════════════════ */

export type Proveedor = 'alcampo' | 'mercadona' | 'otros'

/** Orden fijo del documento: Alcampo · Mercadona · Otros. */
export const PROVEEDOR_ORDEN: Proveedor[] = ['alcampo', 'mercadona', 'otros']

export const PROVEEDOR_LABEL: Record<Proveedor, string> = {
  alcampo: 'Alcampo',
  mercadona: 'Mercadona',
  otros: 'Otros',
}

/** Proveedor derivado del sufijo (abv) del ingrediente — fallback cuando no hay fila en el diccionario. */
export function proveedorPorAbv(abv: string | null): Proveedor {
  if (abv === 'MER') return 'mercadona'
  if (abv === 'ALC') return 'alcampo'
  return 'otros'
}

/** Nombre a mostrar: usa nombre_base si existe; si no, quita el/los sufijo(s) _XXX del nombre técnico. */
export function nombreMostrar(nombreBase: string | null, nombre: string): string {
  if (nombreBase && nombreBase.trim()) return nombreBase.trim()
  return nombre.replace(/(_[A-Z]{2,5})+$/, '').trim()
}

export function eur(v: number): string {
  return v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/* ─── Semana ISO-8601 ─── */

/** Nº de semana ISO-8601 (lunes=inicio, semana 1 = la que contiene el primer jueves del año). */
export function semanaISO(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = (date.getUTCDay() + 6) % 7 // lunes=0 .. domingo=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3)
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000))
}

/** Lunes y domingo de la semana ISO que contiene la fecha dada. */
export function rangoSemana(d: Date): { inicio: Date; fin: Date } {
  const dayNum = (d.getDay() + 6) % 7 // lunes=0
  const inicio = new Date(d); inicio.setDate(d.getDate() - dayNum)
  const fin = new Date(inicio); fin.setDate(inicio.getDate() + 6)
  return { inicio, fin }
}

export function fmtDiaCorto(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function fmtDiaLargo(d: Date): string {
  return `${fmtDiaCorto(d)}/${d.getFullYear()}`
}

/** "Semana N · dd/mm–dd/mm/yyyy" para la fecha dada. */
export function metaSemana(d: Date): string {
  const { inicio, fin } = rangoSemana(d)
  return `Semana ${semanaISO(d)} · ${fmtDiaCorto(inicio)}–${fmtDiaLargo(fin)}`
}

/* ─── Tipos de dominio ─── */

export interface IngredienteLC {
  id: string
  nombre: string
  nombre_base: string | null
  abv: string | null
  categoria_id: string | null
  ud_std: string | null
  ud_min: string | null
  precio_activo: number | null
}

export interface CategoriaLC { id: string; nombre: string; orden: number }

export interface ProductoLC {
  ingrediente_id: string
  proveedor: string
  unidad_minima_txt: string | null
  precio_robot: number | null
}

export interface LineaLC {
  ing: IngredienteLC
  nombreMostrar: string
  precio: number | null
  origenPrecio: 'robot' | 'escandallo' | null
  unidad: string
}

export interface CategoriaBloque { catId: string; catNombre: string; orden: number; items: LineaLC[] }
export interface ProveedorBloque { prov: Proveedor; categorias: CategoriaBloque[]; total: number }

/* ─── Cobertura de precios del robot (avance hacia el 100%) ─── */

export interface CoberturaGap { prov: Proveedor; nombre: string; unidad: string; origen: 'escandallo' | 'sin' }
export interface Cobertura {
  total: number
  robot: number        // líneas con precio de robot
  escandallo: number   // líneas que caen a precio de escandallo (el robot aún no las casó)
  sin: number          // líneas sin ningún precio
  pctRobot: number
  gaps: CoberturaGap[] // lo que falta por casar (sin precio primero, luego escandallo)
}

/** Mide, sobre lo que se ve en el documento, cuánto precio viene del robot y qué falta por casar. */
export function coberturaPrecios(bloques: ProveedorBloque[]): Cobertura {
  let robot = 0, escandallo = 0, sin = 0
  const gaps: CoberturaGap[] = []
  for (const b of bloques) for (const c of b.categorias) for (const li of c.items) {
    if (li.origenPrecio === 'robot') { robot++; continue }
    const origen: 'escandallo' | 'sin' = li.origenPrecio === 'escandallo' ? 'escandallo' : 'sin'
    if (origen === 'escandallo') escandallo++; else sin++
    gaps.push({ prov: b.prov, nombre: li.nombreMostrar, unidad: li.unidad, origen })
  }
  const total = robot + escandallo + sin
  gaps.sort((a, b) =>
    (a.origen === b.origen ? 0 : a.origen === 'sin' ? -1 : 1) || a.nombre.localeCompare(b.nombre, 'es'))
  return { total, robot, escandallo, sin, pctRobot: total ? (robot / total) * 100 : 0, gaps }
}

/* ─── Comparador Mercadona vs Alcampo (ahorro potencial) ─── */

export interface ComparativaItem {
  ingId: string
  nombre: string
  unidad: string
  mercadona: number
  alcampo: number
  cheaper: 'mercadona' | 'alcampo' | 'empate'
  ahorroPct: number
}

export interface Comparativa {
  items: ComparativaItem[]        // ordenados por mayor diferencia %
  nComparables: number            // ingredientes con precio de robot en AMBOS súper
  nMercadona: number              // en cuántos gana Mercadona
  nAlcampo: number                // en cuántos gana Alcampo
  nEmpate: number
  ahorroMedioPct: number          // media de la diferencia % entre súper
}

/**
 * Compara el mismo ingrediente "común" entre Mercadona y Alcampo agrupando por NOMBRE BASE
 * (los ingredientes están partidos por proveedor con sufijo `_MER`/`_ALC`, así que
 * "Cebolla blanca_MER" y "Cebolla blanca_ALC" son la misma cosa en dos súper).
 * Precio por súper = mejor `precio_robot` del diccionario para ese súper; si no hay,
 * cae al precio de escandallo (`precio_activo`) del ingrediente de ese súper.
 * Solo entra en la comparativa lo que tiene precio en AMBOS súper.
 */
export function compararSupers(
  ingredientes: IngredienteLC[],
  productos: ProductoLC[],
  excluidos: Set<string>,
): Comparativa {
  // Mejor precio_robot del diccionario por (ingrediente_id, súper).
  const dictMin = new Map<string, { mercadona?: number; alcampo?: number }>()
  for (const p of productos) {
    if (p.precio_robot == null || p.precio_robot <= 0) continue
    if (p.proveedor !== 'mercadona' && p.proveedor !== 'alcampo') continue
    const e = dictMin.get(p.ingrediente_id) ?? {}
    const cur = e[p.proveedor as 'mercadona' | 'alcampo']
    if (cur == null || p.precio_robot < cur) e[p.proveedor as 'mercadona' | 'alcampo'] = p.precio_robot
    dictMin.set(p.ingrediente_id, e)
  }

  // Agrupa por nombre base; mejor precio por súper (robot preferido, escandallo de reserva).
  interface Acc { nombre: string; unidad: string; mercadona?: number; alcampo?: number }
  const grupos = new Map<string, Acc>()
  const anota = (g: Acc, prov: 'mercadona' | 'alcampo', precio: number | null | undefined) => {
    if (precio == null || precio <= 0) return
    if (g[prov] == null || precio < g[prov]!) g[prov] = precio
  }

  for (const ing of ingredientes) {
    if (excluidos.has(ing.id)) continue
    const nombre = nombreMostrar(ing.nombre_base, ing.nombre)
    const clave = nombre.toLowerCase()
    const g = grupos.get(clave) ?? { nombre, unidad: ing.ud_min || ing.ud_std || '' }
    const dm = dictMin.get(ing.id)
    // Mercadona: robot del diccionario, o escandallo si el ingrediente es de Mercadona.
    anota(g, 'mercadona', dm?.mercadona ?? (proveedorPorAbv(ing.abv) === 'mercadona' ? ing.precio_activo : null))
    anota(g, 'alcampo', dm?.alcampo ?? (proveedorPorAbv(ing.abv) === 'alcampo' ? ing.precio_activo : null))
    grupos.set(clave, g)
  }

  const items: ComparativaItem[] = []
  for (const g of grupos.values()) {
    if (g.mercadona == null || g.alcampo == null) continue
    const mer = g.mercadona, alc = g.alcampo
    const cheaper = mer < alc ? 'mercadona' : alc < mer ? 'alcampo' : 'empate'
    const base = Math.max(mer, alc)
    const ahorroPct = base > 0 ? (Math.abs(mer - alc) / base) * 100 : 0
    items.push({ ingId: g.nombre, nombre: g.nombre, unidad: g.unidad, mercadona: mer, alcampo: alc, cheaper, ahorroPct })
  }
  items.sort((a, b) => b.ahorroPct - a.ahorroPct || a.nombre.localeCompare(b.nombre, 'es'))

  return {
    items,
    nComparables: items.length,
    nMercadona: items.filter(i => i.cheaper === 'mercadona').length,
    nAlcampo: items.filter(i => i.cheaper === 'alcampo').length,
    nEmpate: items.filter(i => i.cheaper === 'empate').length,
    ahorroMedioPct: items.length ? items.reduce((s, i) => s + i.ahorroPct, 0) / items.length : 0,
  }
}

const CAT_SIN_CLASIFICAR: CategoriaLC = { id: '__sin_clasificar__', nombre: 'Sin clasificar', orden: 999 }

/**
 * Construye los 3 bloques del documento (Alcampo · Mercadona · Otros), agrupados por
 * categoría (orden canónico) y con los ingredientes en orden alfabético dentro de cada una.
 *
 * Un ingrediente aparece en un proveedor SOLO si hay fila activa en `ingrediente_productos`
 * para ese (ingrediente, proveedor). Si un ingrediente no tiene ninguna fila en el diccionario
 * para ningún proveedor, cae en el proveedor derivado de su sufijo (abv) como fallback, para
 * que sea alcanzable ("salen TODOS los ingredientes").
 *
 * Precio = mínimo `precio_robot` entre las filas del diccionario de ese (ingrediente, proveedor).
 * Si no hay precio_robot (null/ausente), fallback al precio de escandallo (`precio_activo`).
 */
export function construirBloques(
  ingredientes: IngredienteLC[],
  categorias: CategoriaLC[],
  productos: ProductoLC[],
  excluidos: Set<string>,
): ProveedorBloque[] {
  const dict = new Map<string, Map<Proveedor, ProductoLC[]>>()
  for (const p of productos) {
    const prov = p.proveedor as Proveedor
    if (!PROVEEDOR_ORDEN.includes(prov)) continue
    if (!dict.has(p.ingrediente_id)) dict.set(p.ingrediente_id, new Map())
    const m = dict.get(p.ingrediente_id)!
    if (!m.has(prov)) m.set(prov, [])
    m.get(prov)!.push(p)
  }

  const catMap = new Map<string, CategoriaLC>()
  categorias.forEach(c => catMap.set(c.id, c))

  const bloques: Record<Proveedor, Map<string, LineaLC[]>> = {
    alcampo: new Map(), mercadona: new Map(), otros: new Map(),
  }

  for (const ing of ingredientes) {
    if (excluidos.has(ing.id)) continue
    const nombreMostrarIng = nombreMostrar(ing.nombre_base, ing.nombre)
    const filasPorProv = dict.get(ing.id)
    const provs: Proveedor[] = filasPorProv && filasPorProv.size > 0
      ? Array.from(filasPorProv.keys())
      : [proveedorPorAbv(ing.abv)]

    for (const prov of provs) {
      const filas = filasPorProv?.get(prov) ?? []
      const conPrecio = filas.filter(f => f.precio_robot != null && f.precio_robot > 0)

      let precio: number | null = null
      let origen: 'robot' | 'escandallo' | null = null
      let unidadDicc: string | null = null

      if (conPrecio.length > 0) {
        const min = conPrecio.reduce((a, b) => (b.precio_robot! < a.precio_robot! ? b : a))
        precio = min.precio_robot
        origen = 'robot'
        unidadDicc = min.unidad_minima_txt
      } else {
        precio = ing.precio_activo ?? null
        origen = precio != null ? 'escandallo' : null
        unidadDicc = filas[0]?.unidad_minima_txt ?? null
      }

      const unidad = ing.ud_min || unidadDicc || ing.ud_std || ''
      const linea: LineaLC = { ing, nombreMostrar: nombreMostrarIng, precio, origenPrecio: origen, unidad }

      const catId = ing.categoria_id && catMap.has(ing.categoria_id) ? ing.categoria_id : CAT_SIN_CLASIFICAR.id
      const m = bloques[prov]
      if (!m.has(catId)) m.set(catId, [])
      m.get(catId)!.push(linea)
    }
  }

  return PROVEEDOR_ORDEN.map(prov => {
    const catBloques: CategoriaBloque[] = Array.from(bloques[prov].entries())
      .map(([catId, items]) => {
        const cat = catId === CAT_SIN_CLASIFICAR.id ? CAT_SIN_CLASIFICAR : catMap.get(catId)!
        items.sort((a, b) => a.nombreMostrar.localeCompare(b.nombreMostrar, 'es'))
        return { catId, catNombre: cat.nombre, orden: cat.orden, items }
      })
      .sort((a, b) => a.orden - b.orden || a.catNombre.localeCompare(b.catNombre, 'es'))
    const total = catBloques.reduce((s, c) => s + c.items.length, 0)
    return { prov, categorias: catBloques, total }
  })
}

/* ─── Filtros de vista (proveedor + cobertura) ─── */

export type FiltroCobertura = 'todos' | 'robot' | 'gaps'

/** Devuelve nuevos bloques filtrados por proveedor y por cobertura de precio, recalculando totales. */
export function filtrarBloques(
  bloques: ProveedorBloque[],
  prov: Proveedor | 'todos',
  cob: FiltroCobertura,
): ProveedorBloque[] {
  return bloques
    .filter(b => prov === 'todos' || b.prov === prov)
    .map(b => {
      const categorias = b.categorias
        .map(c => ({
          ...c,
          items: c.items.filter(li =>
            cob === 'todos' ? true : cob === 'robot' ? li.origenPrecio === 'robot' : li.origenPrecio !== 'robot'),
        }))
        .filter(c => c.items.length > 0)
      return { ...b, categorias, total: categorias.reduce((s, c) => s + c.items.length, 0) }
    })
}

/* ─── Exportaciones (CSV Excel-ES + texto para WhatsApp) ─── */

/** CSV compatible con Excel español: separador `;`, decimales con coma, BOM UTF-8. */
export function listaCompraCSV(bloques: ProveedorBloque[]): string {
  const esc = (s: string) => `"${(s ?? '').replace(/"/g, '""')}"`
  const precio = (n: number | null) => (n != null ? n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')
  const filas = ['Proveedor;Categoría;Producto;Ud. mínima;Precio (€);Origen']
  for (const b of bloques) for (const c of b.categorias) for (const li of c.items) {
    filas.push([
      PROVEEDOR_LABEL[b.prov], c.catNombre, li.nombreMostrar, li.unidad,
      precio(li.precio), li.origenPrecio ?? 'sin',
    ].map(x => esc(String(x))).join(';'))
  }
  return '﻿' + filas.join('\r\n')
}

/** Resumen en texto plano (WhatsApp/portapapeles) agrupado por proveedor y categoría. */
export function listaCompraTexto(bloques: ProveedorBloque[], meta: string): string {
  const out: string[] = ['🛒 LISTA DE COMPRA', meta, '']
  for (const b of bloques) {
    if (b.total === 0) continue
    out.push(`*${PROVEEDOR_LABEL[b.prov].toUpperCase()}* (${b.total})`)
    for (const c of b.categorias) {
      out.push(`_${c.catNombre}_`)
      for (const li of c.items) out.push(`• ${li.nombreMostrar} — ${li.precio != null ? eur(li.precio) : '—'}/${li.unidad}`)
    }
    out.push('')
  }
  return out.join('\n').trim()
}
