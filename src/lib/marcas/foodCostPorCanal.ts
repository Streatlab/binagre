/**
 * foodCostPorCanal · Margen por canal a nivel PLATO INDIVIDUAL
 *
 * OPCIÓN B ACTIVA: aplica mezcla ponderada Prime/Promo desde config_canales.
 * Los % Prime/Promo se actualizan automáticamente vía trigger cuando llegan
 * resúmenes OCR nuevos a estadisticas_prime_promo.
 *
 * Verificado mayo 2026: Notion 366c8b1f-6139-8145-b854-da4b1a107f08
 */
import { supabase } from '@/lib/supabase'

const IVA = 0.21

export interface CanalComision {
  canal: string
  comision_pct: number       // fracción 0-1 (base, ej 0.30)
  comision_pct_prime: number // fracción 0-1 (prime, ej 0.33) — 0 si no aplica
  fijo_eur: number           // € fijo por pedido
  fee_prime_eur: number      // € extra por pedido Prime
  fee_promo_eur: number      // € extra por pedido con promo
  pct_pedidos_prime: number  // 0-1, media ponderada últimos 3 meses
  pct_pedidos_promo: number  // 0-1, media ponderada últimos 3 meses
}

export interface MargenPorCanal {
  canal: string
  pvp: number
  comision_importe: number
  food_cost: number
  margen: number
  margen_pct: number
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
    .select('canal, comision_pct, comision_pct_prime, fijo_eur, fee_prime_eur, fee_promo_eur, pct_pedidos_prime_estim, pct_pedidos_promo_estim')
    .eq('activo', true)
    .order('canal')

  const canales: CanalComision[] = (data ?? []).map((r: any) => ({
    canal: r.canal,
    comision_pct: Number(r.comision_pct ?? 0),
    comision_pct_prime: Number(r.comision_pct_prime ?? 0),
    fijo_eur: Number(r.fijo_eur ?? 0),
    fee_prime_eur: Number(r.fee_prime_eur ?? 0),
    fee_promo_eur: Number(r.fee_promo_eur ?? 0),
    pct_pedidos_prime: Number(r.pct_pedidos_prime_estim ?? 0),
    pct_pedidos_promo: Number(r.pct_pedidos_promo_estim ?? 0),
  }))

  _canalesCache = canales
  _cacheTs = now
  return canales
}

export function invalidarCacheFoodCost() { _canalesCache = null }

/**
 * Margen para un único canal a nivel plato individual con mezcla Prime/Promo.
 *
 * Comisión ponderada:
 *   Si hay comision_pct_prime (Uber One):
 *     comision_media = (1-pctPrime) × comision_base + pctPrime × comision_prime
 *   Si no:
 *     comision_media = comision_base
 *
 * Fees ponderados:
 *   fee_prime_medio = fee_prime_eur × pctPrime
 *   fee_promo_medio = fee_promo_eur × pctPromo
 *
 * Total plataforma por pedido:
 *   base_imp = pvp × comision_media + fijo_eur + fee_prime_medio + fee_promo_medio
 *   total = base_imp × 1.21
 *
 * Margen = pvp - total - foodCost
 */
export function calcularMargenCanal(
  pvp: number,
  foodCost: number,
  canal: CanalComision,
): MargenPorCanal {
  const pctPrime = canal.pct_pedidos_prime
  const pctPromo = canal.pct_pedidos_promo

  // Comisión ponderada
  let comisionMedia: number
  if (canal.comision_pct_prime > 0) {
    comisionMedia = (1 - pctPrime) * canal.comision_pct + pctPrime * canal.comision_pct_prime
  } else {
    comisionMedia = canal.comision_pct
  }

  const comisionVar = pvp * comisionMedia
  const feePrime = canal.fee_prime_eur * pctPrime
  const feePromo = canal.fee_promo_eur * pctPromo
  const baseImp = comisionVar + canal.fijo_eur + feePrime + feePromo
  const comision_importe = baseImp * (1 + IVA)

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
