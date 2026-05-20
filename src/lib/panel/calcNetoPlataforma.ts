/**
 * calcNetoPlataforma.ts
 * Cálculo neto cobrado por canal · fórmulas verificadas con facturas reales:
 *
 *   UBER EATS  (33 pedidos individuales analizados al céntimo):
 *     Comisión   = 30% × (Ventas − Promo partner)
 *     Si Prime   = 33% × (Ventas − Promo partner) [se aplicará proximamente]
 *     Fee Promo  = 0,82€ por pedido con promoción
 *     Tarifa periódica = 2,29€/semana × marca
 *     + IVA 21% sobre TODO
 *
 *   GLOVO  (21 pedidos individuales analizados al céntimo):
 *     Comisión   = 30% × (Ventas − Promo partner)
 *     Fee Prime  = 0,74€ por pedido prime
 *     Tarifa periódica = 10€/quincena × marca
 *     + IVA 21% sobre TODO
 *
 *   JUST EAT  (10 facturas analizadas al céntimo, 3 marcas distintas):
 *     Comisión   = 30% × (Ventas − GastosUsuario × 1,21)
 *     Gastos Gestión = 0,30€ × pedidos
 *     + IVA 21% sobre TODO
 *
 *   El campo "GastosUsuario" de Just Eat son los gastos de envío que el
 *   cliente paga al hacer el pedido (con IVA 21%). Just Eat los descuenta
 *   antes de aplicar su comisión, porque no son ingreso del restaurante.
 *
 *   Referencia canónica: Notion 366c8b1f-6139-8145-b854-da4b1a107f08
 *   Verificación mayo 2026 · 64 pedidos individuales + 10 facturas reales
 */

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const IVA = 0.21

export interface NetoResult { neto: number; margenPct: number }
export interface CanalConfig {
  canal: string
  comision_pct: number
  comision_pct_prime: number | null
  fijo_eur: number
  fee_prime_eur: number
  fee_promo_eur: number
  fee_periodo_eur: number
  fee_periodicidad: string
  pct_pedidos_prime_estim: number
  pct_pedidos_promo_estim: number
}

let cacheConfig: Record<string, CanalConfig> | null = null
let realtimeInit = false

const MAP_ID_CANAL: Record<string, string> = {
  uber: 'Uber Eats', glovo: 'Glovo', je: 'Just Eat',
  web: 'Web Propia', dir: 'Venta Directa',
}

function ensureRealtime() {
  if (realtimeInit) return
  realtimeInit = true
  supabase
    .channel('config_canales_changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'config_canales' },
      async () => {
        cacheConfig = null
        await loadConfigCanales()
        window.dispatchEvent(new CustomEvent('config_canales:changed'))
        window.dispatchEvent(new CustomEvent('config_canales_updated'))
      }
    )
    .subscribe()
}

export async function loadConfigCanales(): Promise<Record<string, CanalConfig>> {
  ensureRealtime()
  if (cacheConfig) return cacheConfig
  const { data, error } = await supabase
    .from('config_canales')
    .select('canal, comision_pct, comision_pct_prime, fijo_eur, fee_prime_eur, fee_promo_eur, fee_periodo_eur, fee_periodicidad, pct_pedidos_prime_estim, pct_pedidos_promo_estim')
    .eq('activo', true)
  if (error || !data) { cacheConfig = {}; return cacheConfig }
  const out: Record<string, CanalConfig> = {}
  for (const row of data as any[]) {
    out[row.canal] = {
      canal: row.canal,
      comision_pct: Number(row.comision_pct ?? 0),
      comision_pct_prime: row.comision_pct_prime != null ? Number(row.comision_pct_prime) : null,
      fijo_eur: Number(row.fijo_eur ?? 0),
      fee_prime_eur: Number(row.fee_prime_eur ?? 0),
      fee_promo_eur: Number(row.fee_promo_eur ?? 0),
      fee_periodo_eur: Number(row.fee_periodo_eur ?? 0),
      fee_periodicidad: String(row.fee_periodicidad ?? 'mensual'),
      pct_pedidos_prime_estim: Number(row.pct_pedidos_prime_estim ?? 0),
      pct_pedidos_promo_estim: Number(row.pct_pedidos_promo_estim ?? 0),
    }
  }
  cacheConfig = out
  return cacheConfig
}

export function invalidarCacheConfigCanales() { cacheConfig = null }

export async function recargarConfigCanales(): Promise<Record<string, CanalConfig>> {
  cacheConfig = null
  return loadConfigCanales()
}

export function useConfigCanales(): Record<string, CanalConfig> {
  const [config, setConfig] = useState<Record<string, CanalConfig>>({})
  useEffect(() => {
    let mounted = true
    loadConfigCanales().then(c => { if (mounted) setConfig({ ...c }) })
    const onChange = () => {
      recargarConfigCanales().then(c => { if (mounted) setConfig({ ...c }) })
    }
    window.addEventListener('config_canales:changed', onChange)
    window.addEventListener('config_canales_updated', onChange)
    return () => {
      mounted = false
      window.removeEventListener('config_canales:changed', onChange)
      window.removeEventListener('config_canales_updated', onChange)
    }
  }, [])
  return config
}

function calcularPeriodos(periodicidad: string, fechaDesde: Date, fechaHasta: Date): number {
  const dias = Math.max(1, Math.round((fechaHasta.getTime() - fechaDesde.getTime()) / 86400000) + 1)
  switch (periodicidad) {
    case 'semanal_por_marca':    return Math.ceil(dias / 7)
    case 'quincenal_por_marca':  return Math.ceil(dias / 15)
    case 'mensual':              return Math.ceil(dias / 30)
    default:                     return 1
  }
}

/**
 * Cálculo neto plataforma con fórmula real verificada.
 *
 * @param canalId           uber | glovo | je | web | dir
 * @param bruto             Importe bruto vendido (ventas con IVA del producto)
 * @param pedidos           Número total de pedidos
 * @param marcasActivas     Nº marcas activas en esta plataforma
 * @param fechaDesde        Inicio periodo (para fees periódicos)
 * @param fechaHasta        Fin periodo (para fees periódicos)
 * @param configOverride    Inyectar config alternativa (testing)
 * @param promoSubvencionada Importe total de promo asumida por partner (Uber/Glovo) o gastosUsuario (JE)
 */
export function calcNetoPorCanal(
  canalId: string, bruto: number, pedidos: number,
  marcasActivas: number = 1,
  fechaDesde?: Date, fechaHasta?: Date,
  configOverride?: Record<string, CanalConfig>,
  promoSubvencionada?: number,
): NetoResult {
  const config = configOverride ?? cacheConfig ?? {}
  const nombreCanal = MAP_ID_CANAL[canalId] ?? canalId
  const cfg = config[nombreCanal]
  if (!cfg) return { neto: bruto, margenPct: bruto > 0 ? 100 : 0 }

  const promo = promoSubvencionada ?? 0

  // ─── Factor de descuento sobre la promo según canal ───
  // Just Eat: gastos de usuario tienen IVA 21% que JE descuenta del bruto antes de aplicar comisión
  // Uber/Glovo: la promo se descuenta sin IVA (es descuento al precio de venta)
  const factorPromoIva = canalId === 'je' ? 1.21 : 1.0
  const baseCobrado = Math.max(0, bruto - promo * factorPromoIva)

  // Estimación pedidos prime / promo
  const nPrime = pedidos * cfg.pct_pedidos_prime_estim
  const nPromo = pedidos * cfg.pct_pedidos_promo_estim

  // Comisión variable
  let comisionVariable = 0
  if (cfg.comision_pct_prime != null && cfg.comision_pct_prime > 0) {
    const baseNormal = baseCobrado * (1 - cfg.pct_pedidos_prime_estim)
    const basePrime  = baseCobrado * cfg.pct_pedidos_prime_estim
    comisionVariable = cfg.comision_pct * baseNormal + cfg.comision_pct_prime * basePrime
  } else {
    comisionVariable = cfg.comision_pct * baseCobrado
  }

  const fijoTotal = cfg.fijo_eur * pedidos
  const feePrimeTotal = cfg.fee_prime_eur * nPrime
  const feePromoTotal = cfg.fee_promo_eur * nPromo

  let feePeriodoTotal = 0
  if (cfg.fee_periodo_eur > 0 && fechaDesde && fechaHasta) {
    const periodos = calcularPeriodos(cfg.fee_periodicidad, fechaDesde, fechaHasta)
    feePeriodoTotal = cfg.fee_periodo_eur * periodos * marcasActivas
  }

  const baseImponible = comisionVariable + fijoTotal + feePrimeTotal + feePromoTotal + feePeriodoTotal
  const ivaComision = IVA * baseImponible
  const totalPlataforma = baseImponible + ivaComision

  const neto = Math.max(0, bruto - promo - totalPlataforma)
  const margenPct = bruto > 0 ? (neto / bruto) * 100 : 0
  return { neto, margenPct }
}

export function identificarPlataformaBancaria(concepto: string): string | null {
  const upper = concepto.toUpperCase()
  if (upper.includes('UBER') || upper.includes('PORTIER')) return 'uber'
  if (upper.includes('GLOVO') || upper.includes('GLOVOAPP')) return 'glovo'
  if (upper.includes('JUST EAT') || upper.includes('TAKEAWAY')) return 'just_eat'
  if (upper.includes('STRIPE') || upper.includes('REDSYS') || upper.includes('ADYEN')) return 'web'
  return null
}

export type EstadoValidacion = 'OK' | 'ALERTA' | 'ERROR'
export function calcEstadoValidacion(diferenciaAbsPct: number): EstadoValidacion {
  if (diferenciaAbsPct <= 1) return 'OK'
  if (diferenciaAbsPct <= 5) return 'ALERTA'
  return 'ERROR'
}
