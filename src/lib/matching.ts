import { supabase } from '@/lib/supabase'

interface MatchingConfigRow {
  proveedor: string | null
  ventana_dias: number
  tolerancia_eur: number
  activo: boolean
}

export interface MatchingParams {
  ventana_dias: number
  tolerancia_eur: number
}

// Caché a nivel de módulo — se carga una vez por sesión
let cachePromise: Promise<MatchingConfigRow[]> | null = null

async function fetchConfig(): Promise<MatchingConfigRow[]> {
  const { data } = await supabase
    .from('matching_config')
    .select('proveedor, ventana_dias, tolerancia_eur, activo')
    .eq('activo', true)
  return (data ?? []) as MatchingConfigRow[]
}

/**
 * Carga la config de emparejamiento y devuelve una función que resuelve
 * los parámetros para un proveedor dado (substring match, cae al default).
 */
export async function cargarMatchingConfig(): Promise<(proveedor: string) => MatchingParams> {
  if (!cachePromise) cachePromise = fetchConfig()
  const rows = await cachePromise

  // LEY-MATCH-01 (14-jul-2026): importe exacto al céntimo — tolerancia siempre 0,
  // se configure lo que se configure. Solo la ventana es por proveedor.
  const FALLBACK: MatchingParams = { ventana_dias: 60, tolerancia_eur: 0 }
  const defaultRow = rows.find(r => r.proveedor === null)
  const defaults: MatchingParams = defaultRow
    ? { ventana_dias: defaultRow.ventana_dias, tolerancia_eur: 0 }
    : FALLBACK

  return function paramsPara(proveedor: string): MatchingParams {
    const needle = proveedor.toLowerCase()
    const match = rows.find(r => r.proveedor !== null && needle.includes(r.proveedor.toLowerCase()))
    return match ? { ventana_dias: match.ventana_dias, tolerancia_eur: 0 } : defaults
  }
}

/** Invalida la caché (útil en tests o tras editar matching_config). */
export function invalidarMatchingCache(): void {
  cachePromise = null
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Devuelve la ventana de fechas [desde, hasta] centrada en fechaMov,
 * calculada en hora local (evita el desfase UTC de toISOString).
 */
export function ventanaFechas(fechaMov: string, ventanaDias: number): { desde: string; hasta: string } {
  const [y, mo, da] = fechaMov.split('-').map(Number)
  const base = new Date(y, mo - 1, da) // medianoche local
  const desde = new Date(base.getTime() - ventanaDias * 86400000)
  const hasta = new Date(base.getTime() + ventanaDias * 86400000)
  return { desde: formatLocalDate(desde), hasta: formatLocalDate(hasta) }
}

/**
 * Devuelve la banda de importe [min, max] sobre valor absoluto.
 * La tolerancia es absoluta en € (no porcentaje).
 * Funciona igual para ingresos positivos y abonos negativos.
 */
export function bandaImporte(importeAbs: number, tolerancia: number): { min: number; max: number } {
  const abs = Math.abs(importeAbs)
  return {
    min: Math.max(0, +(abs - tolerancia).toFixed(4)),
    max: +(abs + tolerancia).toFixed(4),
  }
}
