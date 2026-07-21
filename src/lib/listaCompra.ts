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
