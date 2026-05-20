/**
 * foodCostPorCanal · Margen por canal a nivel PLATO INDIVIDUAL
 * Calcula margen = PVP − comisión canal − food cost por canal.
 *
 * Aplicación: análisis ranking platos por margen, MenuEngineering.
 *
 * NOTA: A nivel plato individual NO se modela Prime/Promo porque no sabemos si el cliente
 * final será Prime ni si aplicará promo. Se usa la comisión BASE (sin variaciones), con IVA 21%.
 * Para nivel plataforma (Panel Global, Running, Facturación) se usa calcNetoPorCanal en
 * src/lib/panel/calcNetoPlataforma.ts (fórmula completa con Prime/Promo/fees).
 *
 * Verificado mayo 2026: fórmulas reales en Notion 366c8b1f-6139-8145-b854-da4b1a107f08
 */
import { supabase } from '@/lib/supabase'

const IVA_COMISION = 0.21

export interface CanalComision {
  canal: string
  comision_pct: number // fracción 0-1
  fijo_eur: number     // € por pedido
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

let _canalesCache: CanalComision[] | null = null
let _cacheTs = 0
const CACHE_TTL = 5 * 60 * 1000

export async function getCanalesComisiones(): Promise<CanalComision[]> {
  const now = Date.now()
  if (_canalesCache && now - _cacheTs < CACHE_TTL) return _canalesCache

  const { data } = await supabase
    .from('config_canales')
    .select('canal, comision_pct, fijo_eur')
    .eq('activo', true)
    .order('canal')

  const canales: CanalComision[] = (data ?? []).map((r: { canal: string; comision_pct: number | null; fijo_eur: number | null }) => ({
    canal: r.canal,
    comision_pct: r.comision_pct ?? 0,
    fijo_eur: r.fijo_eur ?? 0,
  }))

  _canalesCache = canales
  _cacheTs = now
  return canales
}

export function invalidarCacheFoodCost() { _canalesCache = null }

/**
 * Margen para un único canal a nivel plato individual:
 *   comisión_importe = pvp × comision_pct × 1.21 + fijo_eur × 1.21
 *   margen           = pvp − comisión_importe − food_cost
 *
 * El 1.21 viene del IVA 21% que la plataforma carga sobre su comisión y fees.
 */
export function calcularMargenCanal(
  pvp: number,
  foodCost: number,
  canal: CanalComision,
): MargenPorCanal {
  const comisionVar = pvp * canal.comision_pct
  const baseImp = comisionVar + canal.fijo_eur
  const comision_importe = baseImp * (1 + IVA_COMISION)
  const margen = pvp - comision_importe - foodCost
  const margen_pct = pvp > 0 ? (margen / pvp) * 100 : 0
  const estado: 'verde' | 'amarillo' | 'rojo' =
    margen_pct >= 25 ? 'verde' : margen_pct >= 15 ? 'amarillo' : 'rojo'
  return { canal: canal.canal, pvp, comision_importe, food_cost: foodCost, margen, margen_pct, estado }
}

export async function marginPorTodosCanales(
  pvp: number,
  foodCost: number,
): Promise<MargenPorCanal[]> {
  const canales = await getCanalesComisiones()
  return canales.map(c => calcularMargenCanal(pvp, foodCost, c))
}
