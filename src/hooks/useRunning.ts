import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

export interface RunningData {
  ingresos: Record<string, Record<number, number>>
  gastos: Record<string, Record<number, number>>
  brutos: Record<number, { uber:number; glovo:number; je:number; web:number; directa:number; total:number; pedidos:number }>
  categorias: { id:string; nombre:string; parent_id:string|null; nivel:number; bloque:string; orden:number }[]
  benchmarks: { categoria:string; pct_min:number; pct_max:number }[]
  loading: boolean
}

export function useRunning(año: number, titularId: string|null): RunningData {
  const [ingresos, setIngresos] = useState<Record<string, Record<number, number>>>({})
  const [gastos, setGastos] = useState<Record<string, Record<number, number>>>({})
  const [brutos, setBrutos] = useState<RunningData['brutos']>({})
  const [categorias, setCategorias] = useState<RunningData['categorias']>([])
  const [benchmarks, setBenchmarks] = useState<RunningData['benchmarks']>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)

      let qIng = supabase
        .from('conciliacion')
        .select('fecha,categoria,importe')
        .eq('tipo', 'ingreso')
        .like('categoria', '1.%')
        .gte('fecha', `${año}-01-01`)
        .lte('fecha', `${año}-12-31`)
      if (titularId) qIng = qIng.eq('titular_id', titularId)
      const { data: dIng } = await qIng

      const ingMap: Record<string, Record<number, number>> = {}
      ;(dIng || []).forEach((r: any) => {
        const mes = new Date(r.fecha).getMonth() + 1
        const cat = r.categoria
        if (!ingMap[cat]) ingMap[cat] = {}
        ingMap[cat][mes] = (ingMap[cat][mes] || 0) + Number(r.importe || 0)
      })

      let qGas = supabase
        .from('gastos')
        .select('fecha,categoria_codigo,base_imponible')
        .gte('fecha', `${año}-01-01`)
        .lte('fecha', `${año}-12-31`)
      if (titularId) qGas = qGas.eq('titular_id', titularId)
      const { data: dGas } = await qGas

      const gasMap: Record<string, Record<number, number>> = {}
      ;(dGas || []).forEach((r: any) => {
        const mes = new Date(r.fecha).getMonth() + 1
        const cat = r.categoria_codigo
        if (!gasMap[cat]) gasMap[cat] = {}
        gasMap[cat][mes] = (gasMap[cat][mes] || 0) + Math.abs(Number(r.base_imponible || 0))
      })

      let qBrut = supabase
        .from('facturacion_diario')
        .select('fecha,uber_bruto,glovo_bruto,je_bruto,web_bruto,directa_bruto,total_bruto,total_pedidos')
        .gte('fecha', `${año}-01-01`)
        .lte('fecha', `${año}-12-31`)
      if (titularId) qBrut = qBrut.eq('titular_id', titularId)
      const { data: dBrut } = await qBrut

      const brutMap: RunningData['brutos'] = {}
      ;(dBrut || []).forEach((r: any) => {
        const mes = new Date(r.fecha).getMonth() + 1
        if (!brutMap[mes]) brutMap[mes] = { uber:0, glovo:0, je:0, web:0, directa:0, total:0, pedidos:0 }
        brutMap[mes].uber += Number(r.uber_bruto || 0)
        brutMap[mes].glovo += Number(r.glovo_bruto || 0)
        brutMap[mes].je += Number(r.je_bruto || 0)
        brutMap[mes].web += Number(r.web_bruto || 0)
        brutMap[mes].directa += Number(r.directa_bruto || 0)
        brutMap[mes].total += Number(r.total_bruto || 0)
        brutMap[mes].pedidos += Number(r.total_pedidos || 0)
      })

      const { data: dCat } = await supabase
        .from('categorias_pyg')
        .select('id,nombre,parent_id,nivel,bloque,orden')
        .eq('activa', true)
        .order('orden')

      const { data: dBench } = await supabase
        .from('categorias_rango')
        .select('categoria,pct_min,pct_max')

      if (!cancelled) {
        setIngresos(ingMap)
        setGastos(gasMap)
        setBrutos(brutMap)
        setCategorias(dCat || [])
        setBenchmarks((dBench || []).map((b: any) => ({ ...b, pct_min: Number(b.pct_min), pct_max: Number(b.pct_max) })))
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [año, titularId])

  return { ingresos, gastos, brutos, categorias, benchmarks, loading }
}

export function sumMeses(map: Record<number, number>, meses: number[]): number {
  return meses.reduce((s, m) => s + (map[m] || 0), 0)
}

export function sumCatMeses(gastos: Record<string, Record<number, number>>, prefix: string, meses: number[]): number {
  let total = 0
  for (const [cat, mesMap] of Object.entries(gastos)) {
    if (cat.startsWith(prefix)) {
      total += sumMeses(mesMap, meses)
    }
  }
  return total
}

export function fmtN(n: number | undefined): string {
  if (n === undefined || n === 0) return '—'
  const abs = Math.abs(n)
  if (abs >= 1000) return (n < 0 ? '−' : '') + Math.round(abs).toLocaleString('es-ES')
  return (n < 0 ? '−' : '') + Math.round(abs).toLocaleString('es-ES')
}

export function fmtPct(n: number | undefined, total: number): string {
  if (!n || !total) return '—'
  return (n / total * 100).toFixed(1) + '%'
}
