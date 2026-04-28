/**
 * T-F4-06 — foodCostPorCanal
 * Calcula margen real = PVP - comisión_canal - food_cost por canal.
 * Comisiones leídas de tabla canales (BD), no hardcoded.
 */
import { supabase } from '@/lib/supabase'

export interface CanalComision {
  canal: string
  comision_pct: number // fracción 0-1
  coste_fijo: number   // € por pedido
}

export interface MargenPorCanal {
  canal: string
  pvp: number
  comision_importe: number
  food_cost: number
  margen: number
  margen_pct: number // % sobre PVP
  estado: 'verde' | 'amarillo' | 'rojo'
}

// Cache simple para evitar re-fetch en cada llamada
let _canalesCache: CanalComision[] | null = null
let _cacheTs = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 min

export async function getCanalesComisiones(): Promise<CanalComision[]> {
  const now = Date.now()
  if (_canalesCache && now - _cacheTs < CACHE_TTL) return _canalesCache

  const { data } = await supabase
    .from('config_canales')
    .select('canal, comision_pct, coste_fijo')
    .order('canal')

  const canales: CanalComision[] = (data ?? []).map((r: { canal: string; comision_pct: number | null; coste_fijo: number | null }) => ({
    canal: r.canal,
    comision_pct: r.comision_pct ?? 0,
    coste_fijo: r.coste_fijo ?? 0,
  }))

  _canalesCache = canales
  _cacheTs = now
  return canales
}

/** Margen para un único canal dado PVP y food cost */
export function calcularMargenCanal(
  pvp: number,
  foodCost: number,
  canal: CanalComision,
): MargenPorCanal {
  const comision_importe = pvp * canal.comision_pct + canal.coste_fijo
  const margen = pvp - comision_importe - foodCost
  const margen_pct = pvp > 0 ? (margen / pvp) * 100 : 0
  const estado: 'verde' | 'amarillo' | 'rojo' =
    margen_pct >= 25 ? 'verde' : margen_pct >= 15 ? 'amarillo' : 'rojo'
  return { canal: canal.canal, pvp, comision_importe, food_cost: foodCost, margen, margen_pct, estado }
}

/** Calcula margen para todos los canales en BD */
export async function marginPorTodosCanales(
  pvp: number,
  foodCost: number,
): Promise<MargenPorCanal[]> {
  const canales = await getCanalesComisiones()
  return canales.map(c => calcularMargenCanal(pvp, foodCost, c))
}
