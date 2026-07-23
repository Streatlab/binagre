/**
 * platoHub — lógica PURA del hub de platos (LEY-PLATO-01) y de la pestaña Hoy
 * (Bloque 2). Sin Supabase ni React: testeable y única fuente de las reglas.
 *
 * Identidad del plato = platos_maestros. Vincular plato↔receta se hace UNA vez
 * sobre el maestro y se refleja en las tres tablas de `vinculoTargets()`
 * (análisis vía mapeo_plato_receta, Carta vía carta_platos, y el propio maestro).
 */
import { normPlato, similitudPlato } from '@/utils/normPlato'

export interface MaestroLite {
  id: number
  nombre: string
  es_extra?: boolean | null
  receta_id?: string | null
  euros?: number | null
  tipo_linea?: string | null
}

const TIPOS_SIN_RECETA = new Set(['bebida', 'extra', 'promo', 'agua'])

/** Bebida/extra/promo (o marcado es_extra) JAMÁS pide receta ni cuenta como
 *  "sin vincular". El resto de platos sí. */
export function requiereReceta(m: Pick<MaestroLite, 'es_extra' | 'tipo_linea'>): boolean {
  if (m.es_extra === true) return false
  const t = (m.tipo_linea ?? '').toLowerCase().trim()
  if (TIPOS_SIN_RECETA.has(t)) return false
  return true
}

/**
 * Casación por candidatos (normPlato exacto). Candidato ÚNICO → se casa; 0 → se
 * crea maestro (no es cola); >1 → NADA se casa y va a la cola de revisión. Sin fuzzy.
 */
export function resolverCandidato(candidatos: number[]): { maestroId: number | null; aCola: boolean; motivo?: string } {
  const uniq = Array.from(new Set(candidatos.filter(c => c != null)))
  if (uniq.length === 1) return { maestroId: uniq[0], aCola: false }
  if (uniq.length === 0) return { maestroId: null, aCola: false }
  return { maestroId: null, aCola: true, motivo: `El nombre casa con ${uniq.length} platos maestros distintos; revísalo a mano.` }
}

/** Las tres tablas que un vínculo sobre el maestro debe actualizar a la vez. */
export function vinculoTargets(): readonly ['platos_maestros', 'mapeo_plato_receta', 'carta_platos'] {
  return ['platos_maestros', 'mapeo_plato_receta', 'carta_platos'] as const
}

/**
 * Auto-propuesta de vínculo: para un plato sin receta, la receta cuyo nombre
 * normalizado casa exacto (score 1) o con similitud alta. NUNCA autovincula:
 * devuelve la mejor sugerencia para confirmación humana de 1 clic.
 */
export function sugerirReceta(
  nombrePlato: string,
  recetas: { id: string; nombre: string }[],
  umbral = 0.7,
): { recetaId: string; nombre: string; score: number } | null {
  const np = normPlato(nombrePlato)
  let best: { recetaId: string; nombre: string; score: number } | null = null
  for (const r of recetas) {
    const score = normPlato(r.nombre) === np ? 1 : similitudPlato(nombrePlato, r.nombre)
    if (score >= umbral && (!best || score > best.score)) best = { recetaId: r.id, nombre: r.nombre, score }
  }
  return best
}

// ─────────────────────────── Pestaña Hoy (Bloque 2) ───────────────────────────

export interface HoyPlato {
  euros: number
  receta_id?: string | null
  es_extra?: boolean | null
  tipo_linea?: string | null
  foodCostPct?: number | null
}

export interface HoyKpis {
  pctConCoste: number      // % de ventas (€) con coste calculado
  foodCostMedio: number    // food cost real medio ponderado por ventas
  eurosPorEscribir: number // € de ventas de platos sin receta
  alertasPrecio: number    // nº de alertas de precio de ingrediente
}

/** KPIs de Hoy. Con datos vacíos devuelve ceros, nunca revienta (÷0 protegido). */
export function computeHoyKpis(p: { platos: HoyPlato[]; alertasPrecio?: number }): HoyKpis {
  const platos = p.platos ?? []
  const conReceta = platos.filter(x => requiereReceta(x))
  const totalEuros = conReceta.reduce((s, x) => s + (x.euros || 0), 0)
  const conCoste = conReceta.filter(x => x.receta_id != null)
  const eurosConCoste = conCoste.reduce((s, x) => s + (x.euros || 0), 0)
  const eurosPorEscribir = conReceta.filter(x => x.receta_id == null).reduce((s, x) => s + (x.euros || 0), 0)

  let fcNum = 0, fcDen = 0
  for (const x of conCoste) {
    if (x.foodCostPct == null) continue
    const w = x.euros || 0
    fcNum += x.foodCostPct * (w || 1)
    fcDen += (w || 1)
  }
  return {
    pctConCoste: totalEuros > 0 ? (eurosConCoste / totalEuros) * 100 : 0,
    foodCostMedio: fcDen > 0 ? fcNum / fcDen : 0,
    eurosPorEscribir,
    alertasPrecio: p.alertasPrecio ?? 0,
  }
}

export type TareaTipo = 'vincular' | 'confirmar' | 'escribir' | 'foodcost' | 'precio' | 'ep' | 'ingsinprecio'

export interface Tarea {
  key: string
  tipo: TareaTipo
  euros: number       // impacto en € para ordenar
  frase: string       // una frase en cristiano
  maestroId?: number
  recetaId?: string
}

export interface HoyTareasInput {
  platos: (MaestroLite & { foodCostPct?: number | null; sugerencia?: { recetaId: string; nombre: string; score: number } | null })[]
  propuestas?: { id: number; maestroId: number; nombre: string; recetaNombre: string; recetaId: string; euros?: number }[]
  ingredientesSinPrecio?: { count: number }
  epHuecos?: { count: number }
}

const fcImplausible = (fc: number | null | undefined) => fc != null && (fc < 10 || fc > 40)

/** Lista de tareas de Hoy ordenada por € (mayor impacto primero). Vacío → []. */
export function buildTareasHoy(input: HoyTareasInput): Tarea[] {
  const tareas: Tarea[] = []
  for (const p of input.platos ?? []) {
    const euros = p.euros || 0
    if (requiereReceta(p) && p.receta_id == null) {
      if (p.sugerencia) {
        tareas.push({ key: `sug-${p.id}`, tipo: 'confirmar', euros, maestroId: p.id, recetaId: p.sugerencia.recetaId,
          frase: `«${p.nombre}» parece la receta «${p.sugerencia.nombre}» — confírmalo con un clic.` })
      } else {
        tareas.push({ key: `vin-${p.id}`, tipo: 'vincular', euros, maestroId: p.id,
          frase: `«${p.nombre}» vende ${euros.toFixed(0)} € y no tiene receta. Vincúlalo o escríbela.` })
      }
    } else if (p.receta_id != null && fcImplausible(p.foodCostPct)) {
      tareas.push({ key: `fc-${p.id}`, tipo: 'foodcost', euros, maestroId: p.id, recetaId: p.receta_id ?? undefined,
        frase: `«${p.nombre}» tiene un food cost de ${Math.round(p.foodCostPct as number)} % (raro). Revisa ración o vínculo.` })
    }
  }
  for (const pr of input.propuestas ?? []) {
    tareas.push({ key: `prop-${pr.id}`, tipo: 'confirmar', euros: pr.euros || 0, maestroId: pr.maestroId, recetaId: pr.recetaId,
      frase: `«${pr.nombre}» coincide con la receta «${pr.recetaNombre}» — confírmalo con un clic.` })
  }
  if (input.ingredientesSinPrecio && input.ingredientesSinPrecio.count > 0) {
    tareas.push({ key: 'ing-sin-precio', tipo: 'ingsinprecio', euros: 0,
      frase: `${input.ingredientesSinPrecio.count} ingredientes sin precio: sin ellos el coste de sus platos va incompleto.` })
  }
  if (input.epHuecos && input.epHuecos.count > 0) {
    tareas.push({ key: 'ep-huecos', tipo: 'ep', euros: 0,
      frase: `${input.epHuecos.count} líneas de elaboración (EP) sin coste. Complétalas para cerrar el escandallo.` })
  }
  return tareas.sort((a, b) => b.euros - a.euros)
}
