/**
 * calcNetoPlataforma.ts
 * Cálculo neto cobrado por canal leyendo SIEMPRE de config_canales en Supabase.
 * Suscripción Realtime: cualquier UPDATE en config_canales invalida cache y emite evento.
 */

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const IVA = 0.21

export interface NetoResult { neto: number; margenPct: number }
export interface CanalConfig {
  canal: string
  comision_pct: number
  fijo_eur: number
  fee_periodo_eur: number
  fee_periodicidad: string
}

let cacheConfig: Record<string, CanalConfig> | null = null
let realtimeInit = false

const MAP_ID_CANAL: Record<string, string> = {
  uber: 'Uber Eats', glovo: 'Glovo', je: 'Just Eat',
  web: 'Web Propia', dir: 'Venta Directa',
}

/** Inicializa suscripción realtime una sola vez. Cualquier cambio en config_canales recarga cache + emite evento global. */
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
    .select('canal, comision_pct, fijo_eur, fee_periodo_eur, fee_periodicidad')
    .eq('activo', true)
  if (error || !data) { cacheConfig = {}; return cacheConfig }
  const out: Record<string, CanalConfig> = {}
  for (const row of data) {
    out[row.canal] = {
      canal: row.canal,
      comision_pct: Number(row.comision_pct ?? 0),
      fijo_eur: Number(row.fijo_eur ?? 0),
      fee_periodo_eur: Number(row.fee_periodo_eur ?? 0),
      fee_periodicidad: String(row.fee_periodicidad ?? 'mensual'),
    }
  }
  cacheConfig = out
  return cacheConfig
}

export function invalidarCacheConfigCanales() { cacheConfig = null }

/** Recarga config desde BBDD ignorando cache. */
export async function recargarConfigCanales(): Promise<Record<string, CanalConfig>> {
  cacheConfig = null
  return loadConfigCanales()
}

/**
 * Hook React: devuelve config_canales y se actualiza automáticamente
 * cuando cambia en BBDD (vía Realtime + evento manual).
 */
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

export function calcNetoPorCanal(
  canalId: string, bruto: number, pedidos: number,
  marcasActivas: number = 1,
  fechaDesde?: Date, fechaHasta?: Date,
  configOverride?: Record<string, CanalConfig>,
): NetoResult {
  const config = configOverride ?? cacheConfig ?? {}
  const nombreCanal = MAP_ID_CANAL[canalId] ?? canalId
  const cfg = config[nombreCanal]
  if (!cfg) return { neto: bruto, margenPct: bruto > 0 ? 100 : 0 }

  const baseComision = (cfg.comision_pct * bruto) + (cfg.fijo_eur * pedidos)
  let feePeriodoTotal = 0
  if (cfg.fee_periodo_eur > 0 && fechaDesde && fechaHasta) {
    const periodos = calcularPeriodos(cfg.fee_periodicidad, fechaDesde, fechaHasta)
    feePeriodoTotal = cfg.fee_periodo_eur * periodos * marcasActivas
  }
  const totalComisionable = baseComision + feePeriodoTotal
  const ivaComision = IVA * totalComisionable
  const neto = Math.max(0, bruto - totalComisionable - ivaComision)
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
