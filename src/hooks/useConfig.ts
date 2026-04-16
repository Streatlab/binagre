import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface ConfigCanal {
  id: string
  canal: string
  comision_pct: number
  coste_fijo: number
  activo: boolean
}

export interface AppConfig {
  canales: ConfigCanal[]
  estructura_pct: number
  margen_deseado_pct: number
  categorias: string[]
  unidades: string[]
  loading: boolean
  refresh: () => void
}

const DEFAULT_CANALES: ConfigCanal[] = [
  { id: '', canal: 'Uber Eats', comision_pct: 30, coste_fijo: 0.82, activo: true },
  { id: '', canal: 'Glovo', comision_pct: 30, coste_fijo: 0, activo: true },
  { id: '', canal: 'Just Eat', comision_pct: 30, coste_fijo: 0, activo: true },
  { id: '', canal: 'Web Propia', comision_pct: 7, coste_fijo: 0, activo: true },
  { id: '', canal: 'Venta Directa', comision_pct: 0, coste_fijo: 0, activo: true },
]

const DEFAULT_CATS = ['Verduras', 'Carnes', 'Pescados', 'Lacteos', 'Cereales', 'Especias', 'Aceites']
const DEFAULT_UNS = ['gr.', 'Kg.', 'ml.', 'L.', 'ud.', 'Docena']

export function useConfig(): AppConfig {
  const [canales, setCanales] = useState<ConfigCanal[]>(DEFAULT_CANALES)
  const [estructuraPct, setEstructuraPct] = useState(30)
  const [margenPct, setMargenPct] = useState(15)
  const [categorias, setCategorias] = useState<string[]>(DEFAULT_CATS)
  const [unidades, setUnidades] = useState<string[]>(DEFAULT_UNS)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [canalRes, confRes] = await Promise.all([
          supabase.from('config_canales').select('*').order('canal'),
          supabase.from('configuracion').select('*'),
        ])
        if (cancelled) return
        if (canalRes.data && canalRes.data.length > 0) {
          setCanales(canalRes.data as ConfigCanal[])
        }
        if (confRes.data) {
          const map = new Map<string, string>()
          for (const r of confRes.data as { clave: string; valor: string }[]) {
            map.set(r.clave, r.valor)
          }
          const e = map.get('estructura_pct')
          if (e) setEstructuraPct(parseFloat(e))
          const m = map.get('margen_deseado_pct')
          if (m) setMargenPct(parseFloat(m))
          try {
            const cats = JSON.parse(map.get('categorias') || '[]')
            if (Array.isArray(cats) && cats.length) setCategorias(cats)
          } catch { /* ignore */ }
          try {
            const uns = JSON.parse(map.get('unidades') || '[]')
            if (Array.isArray(uns) && uns.length) setUnidades(uns)
          } catch { /* ignore */ }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [tick])

  const refresh = useCallback(() => setTick(t => t + 1), [])

  return {
    canales,
    estructura_pct: estructuraPct,
    margen_deseado_pct: margenPct,
    categorias,
    unidades,
    loading,
    refresh,
  }
}

/** Calcula waterfall para un canal concreto */
export function calcWaterfall(
  costeRac: number,
  pvp: number,
  comisionPct: number,
  costeFijo: number,
  estructuraPct: number,
  margenDeseadoPct: number,
) {
  const com = comisionPct / 100
  const estr = estructuraPct / 100
  const margenD = margenDeseadoPct / 100

  const neto = pvp > 0 ? pvp / 1.1 : 0
  const costeMP = costeRac
  const costeEstructura = estr * neto
  const costePlatR = pvp * com + costeFijo
  const costePlatC = pvp * com * 1.21 + costeFijo
  const costeTotalR = costeMP + costeEstructura + costePlatR
  const costeTotalC = costeMP + costeEstructura + costePlatC

  const denom = 1 - estr - com - margenD
  const pvpRec = denom > 0 ? (costeMP * 1.1) / denom : 0

  const k = costeMP > 0 && pvp > 0 ? pvp / costeMP : 0

  const margenR = neto - costeTotalR
  const margenC = neto - costeTotalC
  const pctMargenR = neto > 0 ? (margenR / neto) * 100 : 0
  const pctMargenC = neto > 0 ? (margenC / neto) * 100 : 0

  const ivaNeto = pvp > 0 ? ((pvp - pvp * com * 1.21) / 1.1) * 0.1 - (pvp * com * 0.21) : 0
  const provIva = pvp * com * 0.21

  return {
    neto, costeMP, costeEstructura, costePlatR, costePlatC,
    costeTotalR, costeTotalC, pvpRec, k,
    margenR, margenC, pctMargenR, pctMargenC, ivaNeto, provIva,
    margenDeseadoPct: margenDeseadoPct,
  }
}
