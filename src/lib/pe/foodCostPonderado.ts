/**
 * T-F4-07 — foodCostPonderado
 * Calcula food cost ponderado real según pedidos_plataforma o distribución uniforme.
 * Decisión autónoma F4-H5.
 */
import { supabase } from '@/lib/supabase'

export interface FoodCostPonderadoResult {
  food_cost_pct: number        // % ponderado (0-100)
  n_platos: number             // platos incluidos en el cálculo
  n_sin_precio: number         // platos excluidos por falta de precio
  modo: 'real' | 'uniforme' | 'estimado'  // origen del cálculo
  badge: string | null         // mensaje UI si estimado
}

export async function foodCostPonderado(): Promise<FoodCostPonderadoResult> {
  // 1) Leer carta_platos activos con receta vinculada
  const { data: platos } = await supabase
    .from('carta_platos')
    .select('id, nombre, pvp, marca, receta_id')
    .eq('activo', true)
    .not('receta_id', 'is', null)

  if (!platos?.length) {
    return { food_cost_pct: 28, n_platos: 0, n_sin_precio: 0, modo: 'estimado', badge: 'Estimado — sin platos con receta en Carta' }
  }

  // 2) Leer recetas (coste_rac)
  const receta_ids = platos.map((p: { receta_id: string }) => p.receta_id).filter(Boolean)
  const { data: recetas } = await supabase
    .from('recetas')
    .select('id, coste_rac, pvp_uber, pvp_glovo, pvp_je, pvp_web, pvp_directa')
    .in('id', receta_ids)
  const recetaMap = Object.fromEntries(
    (recetas ?? []).map((r: { id: string; coste_rac: number; pvp_uber: number; pvp_glovo: number; pvp_je: number; pvp_web: number; pvp_directa: number }) => [r.id, r])
  )

  // 3) Intentar pesos reales desde pedidos_plataforma (últimos 30 días)
  const fecha30 = new Date()
  fecha30.setDate(fecha30.getDate() - 30)
  const { data: pedidos } = await supabase
    .from('pedidos_plataforma')
    .select('plato')
    .gte('fecha', fecha30.toISOString().slice(0, 10))

  type PesoMap = Record<string, number>
  let pesoMap: PesoMap = {}
  let modo: 'real' | 'uniforme' | 'estimado' = 'uniforme'

  if (pedidos?.length) {
    // Contar pedidos por nombre de plato
    const conteo: PesoMap = {}
    const total = pedidos.length
    for (const p of pedidos as { plato: string }[]) {
      if (!p.plato) continue
      conteo[p.plato] = (conteo[p.plato] ?? 0) + 1
    }
    // Normalizar
    for (const k of Object.keys(conteo)) conteo[k] /= total
    pesoMap = conteo
    modo = 'real'
  }

  // 4) Calcular food cost ponderado
  let sumFC = 0
  let sumPeso = 0
  let nSinPrecio = 0

  for (const p of platos as { id: string; nombre: string; pvp: number; receta_id: string }[]) {
    const receta = recetaMap[p.receta_id]
    if (!receta) { nSinPrecio++; continue }

    // PVP de referencia = pvp_uber > pvp_glovo > pvp_je > pvp_web > pvp_directa > carta pvp
    const pvpRef = receta.pvp_uber || receta.pvp_glovo || receta.pvp_je || receta.pvp_web || receta.pvp_directa || p.pvp
    if (pvpRef <= 0) { nSinPrecio++; continue }

    const fcPct = (receta.coste_rac / pvpRef) * 100

    // Peso: real por nombre de plato o uniforme
    const peso = modo === 'real'
      ? (pesoMap[p.nombre] ?? 1 / platos.length)
      : 1 / platos.length

    sumFC += fcPct * peso
    sumPeso += peso
  }

  if (sumPeso <= 0) {
    return { food_cost_pct: 28, n_platos: 0, n_sin_precio: nSinPrecio, modo: 'estimado', badge: 'Estimado — sin datos de precio en recetas' }
  }

  const food_cost_pct = Math.round((sumFC / sumPeso) * 10) / 10

  let badge: string | null = null
  if (nSinPrecio > 0) badge = `${nSinPrecio} plato${nSinPrecio > 1 ? 's' : ''} sin precio — food cost parcial`
  // modo is 'real' | 'uniforme' at this point; 'estimado' handled above

  return {
    food_cost_pct,
    n_platos: platos.length - nSinPrecio,
    n_sin_precio: nSinPrecio,
    modo,
    badge,
  }
}
