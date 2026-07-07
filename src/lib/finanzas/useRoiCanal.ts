/**
 * useRoiCanal — ROI por canal de venta.
 * ROI = neto_real_cobrado (retorno) / (comisiones + fees + cargos_promocion) (inversión).
 * Fuente: resumenes_plataforma_marca_mensual (agregado sobre TODAS las marcas) +
 * config_canales (coste de referencia configurado, solo informativo).
 */
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CORP } from '@/styles/neobrutal'

export type PeriodoRoi = 'ultimo_mes' | 'año_actual'

export const MESES_ROI = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

interface ResumenRow {
  plataforma: string
  mes: number
  año: number
  bruto: number | null
  comisiones: number | null
  fees: number | null
  cargos_promocion: number | null
  neto_real_cobrado: number | null
  pedidos: number | null
}

interface ConfigCanalRow {
  canal: string
  comision_pct: number | null
  fijo_eur: number | null
  fee_periodo_eur: number | null
}

export interface CanalRoi {
  plataforma: string
  corpKey: keyof typeof CORP
  label: string
  color: string
  clara: boolean
  bruto: number
  inversion: number
  retorno: number
  roi: number | null
  pedidos: number
  mesUsado: number | null
  refComisionPct: number | null
  refFijoEur: number | null
  refFeePeriodoEur: number | null
}

/** Normaliza el nombre de plataforma (BD) o de canal (config_canales) a una clave corporativa fija. */
function corpKeyOf(nombre: string): keyof typeof CORP {
  const s = (nombre || '').toLowerCase()
  if (s.includes('uber')) return 'uber'
  if (s.includes('glovo')) return 'glovo'
  if (s.includes('just') || s === 'je') return 'je'
  if (s.includes('web')) return 'web'
  return 'dir'
}

const LABEL_POR_KEY: Record<keyof typeof CORP, string> = {
  uber: 'Uber Eats', glovo: 'Glovo', je: 'Just Eat', web: 'Web Propia', dir: 'Venta Directa',
}

export function useRoiCanal(periodo: PeriodoRoi, año: number = new Date().getFullYear()) {
  const [rows, setRows] = useState<ResumenRow[]>([])
  const [config, setConfig] = useState<ConfigCanalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const [resRes, cfgRes] = await Promise.all([
          supabase
            .from('resumenes_plataforma_marca_mensual')
            .select('plataforma,mes,año,bruto,comisiones,fees,cargos_promocion,neto_real_cobrado,pedidos')
            .eq('año', año),
          supabase.from('config_canales').select('canal,comision_pct,fijo_eur,fee_periodo_eur').eq('activo', true),
        ])
        if (cancelled) return
        if (resRes.error) throw resRes.error
        if (cfgRes.error) throw cfgRes.error
        setRows((resRes.data ?? []) as unknown as ResumenRow[])
        setConfig((cfgRes.data ?? []) as unknown as ConfigCanalRow[])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error cargando ROI por canal')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [año])

  const canales = useMemo<CanalRoi[]>(() => {
    // 1) agrega TODAS las marcas por (plataforma, mes) — la tabla es por marca/mes/plataforma.
    const porPlataformaMes = new Map<string, {
      plataforma: string; mes: number; bruto: number; comisiones: number; fees: number; promo: number; neto: number; pedidos: number
    }>()
    for (const r of rows) {
      const k = `${r.plataforma}|${r.mes}`
      const cur = porPlataformaMes.get(k) || { plataforma: r.plataforma, mes: r.mes, bruto: 0, comisiones: 0, fees: 0, promo: 0, neto: 0, pedidos: 0 }
      cur.bruto += r.bruto ?? 0
      cur.comisiones += r.comisiones ?? 0
      cur.fees += r.fees ?? 0
      cur.promo += r.cargos_promocion ?? 0
      cur.neto += r.neto_real_cobrado ?? 0
      cur.pedidos += r.pedidos ?? 0
      porPlataformaMes.set(k, cur)
    }

    // 2) por plataforma: "Último mes completo" = su mes más reciente con datos (por canal);
    //    "Año en curso" = suma de todos sus meses del año seleccionado.
    const porPlataforma = new Map<string, {
      plataforma: string; bruto: number; comisiones: number; fees: number; promo: number; neto: number; pedidos: number; mesUsado: number | null
    }>()
    for (const v of porPlataformaMes.values()) {
      if (periodo === 'ultimo_mes') {
        const cur = porPlataforma.get(v.plataforma)
        if (!cur || v.mes > (cur.mesUsado ?? 0)) {
          porPlataforma.set(v.plataforma, { plataforma: v.plataforma, bruto: v.bruto, comisiones: v.comisiones, fees: v.fees, promo: v.promo, neto: v.neto, pedidos: v.pedidos, mesUsado: v.mes })
        }
      } else {
        const acc = porPlataforma.get(v.plataforma) || { plataforma: v.plataforma, bruto: 0, comisiones: 0, fees: 0, promo: 0, neto: 0, pedidos: 0, mesUsado: null }
        acc.bruto += v.bruto
        acc.comisiones += v.comisiones
        acc.fees += v.fees
        acc.promo += v.promo
        acc.neto += v.neto
        acc.pedidos += v.pedidos
        porPlataforma.set(v.plataforma, acc)
      }
    }

    const list: CanalRoi[] = Array.from(porPlataforma.values()).map(v => {
      const inversion = v.comisiones + v.fees + v.promo
      const retorno = v.neto
      const roi = inversion > 0 ? retorno / inversion : null
      const key = corpKeyOf(v.plataforma)
      const cfg = config.find(c => corpKeyOf(c.canal) === key)
      let refComisionPct: number | null = null
      if (cfg && cfg.comision_pct != null) {
        const com = Number(cfg.comision_pct)
        refComisionPct = com > 1 ? com : com * 100 // BD guarda 0.30 → mostrar 30
      }
      return {
        plataforma: v.plataforma,
        corpKey: key,
        label: LABEL_POR_KEY[key],
        color: CORP[key],
        clara: key === 'uber' || key === 'glovo',
        bruto: v.bruto,
        inversion,
        retorno,
        roi,
        pedidos: v.pedidos,
        mesUsado: v.mesUsado,
        refComisionPct,
        refFijoEur: cfg?.fijo_eur != null ? Number(cfg.fijo_eur) : null,
        refFeePeriodoEur: cfg?.fee_periodo_eur != null ? Number(cfg.fee_periodo_eur) : null,
      }
    })

    // Ranking descendente por ROI; sin inversión (roi=null) al final, ordenadas por inversión desc.
    return list.sort((a, b) => {
      if (a.roi === null && b.roi === null) return b.inversion - a.inversion
      if (a.roi === null) return 1
      if (b.roi === null) return -1
      return b.roi - a.roi
    })
  }, [rows, config, periodo])

  const conRoi = canales.filter(c => c.roi !== null)
  const mejor = conRoi.length ? conRoi.reduce((a, b) => (b.roi! > a.roi! ? b : a)) : null
  const peor = conRoi.length ? conRoi.reduce((a, b) => (b.roi! < a.roi! ? b : a)) : null
  const sumInversion = canales.reduce((s, c) => s + c.inversion, 0)
  const sumRetorno = canales.reduce((s, c) => s + c.retorno, 0)
  const roiMedio = sumInversion > 0 ? sumRetorno / sumInversion : null

  return { loading, error, canales, mejor, peor, roiMedio, año }
}
