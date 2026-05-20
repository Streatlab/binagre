import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface RunningAnualData {
  ingresos: Record<string, Record<number, number>>
  gastos: Record<string, Record<number, number>>
  brutos: Record<number, { uber:number; glovo:number; je:number; web:number; directa:number; total:number; pedidos:number }>
  pedidosCanal: Record<number, { uber:number; glovo:number; je:number; web:number; directa:number }>
  diasOp: Record<number, number>
  categorias: { id:string; nombre:string; parent_id:string|null; nivel:number; bloque:string; orden:number }[]
  benchmarks: { categoria:string; pct_min:number; pct_max:number }[]
  comisiones: Record<string, number>
  feesFijos: Record<string, { fijoEur:number; feePeriodoEur:number; feePeriodicidad:string }>
  marcasActivas: number
  loading: boolean
}

const CANAL_MAP: Record<string, string> = {
  'Uber Eats': 'uber',
  'Glovo': 'glovo',
  'Just Eat': 'je',
  'Web Propia': 'web',
  'Venta Directa': 'directa',
}

const IVA = 0.21

export function useRunningAnual(año: number, titularId: string|null): RunningAnualData {
  const [ingresos, setIngresos] = useState<Record<string, Record<number, number>>>({})
  const [gastos, setGastos] = useState<Record<string, Record<number, number>>>({})
  const [brutos, setBrutos] = useState<RunningAnualData['brutos']>({})
  const [pedidosCanal, setPedidosCanal] = useState<RunningAnualData['pedidosCanal']>({})
  const [diasOp, setDiasOp] = useState<Record<number, number>>({})
  const [categorias, setCategorias] = useState<RunningAnualData['categorias']>([])
  const [benchmarks, setBenchmarks] = useState<RunningAnualData['benchmarks']>([])
  const [comisiones, setComisiones] = useState<Record<string, number>>({})
  const [feesFijos, setFeesFijos] = useState<RunningAnualData['feesFijos']>({})
  const [marcasActivas, setMarcasActivas] = useState<number>(1)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      let qIng = supabase.from('conciliacion').select('fecha,categoria,importe').eq('tipo','ingreso').like('categoria','1.%').gte('fecha',`${año}-01-01`).lte('fecha',`${año}-12-31`)
      if (titularId) qIng = qIng.eq('titular_id', titularId)
      const { data: dIng } = await qIng
      const ingMap: Record<string, Record<number, number>> = {}
      ;(dIng || []).forEach((r: any) => { const mes = new Date(r.fecha).getMonth()+1; const cat = r.categoria; if (!ingMap[cat]) ingMap[cat] = {}; ingMap[cat][mes] = (ingMap[cat][mes]||0) + Number(r.importe||0) })

      let qGas = supabase.from('gastos').select('fecha,categoria_codigo,base_imponible').gte('fecha',`${año}-01-01`).lte('fecha',`${año}-12-31`)
      if (titularId) qGas = qGas.eq('titular_id', titularId)
      const { data: dGas } = await qGas
      const gasMap: Record<string, Record<number, number>> = {}
      ;(dGas || []).forEach((r: any) => { const mes = new Date(r.fecha).getMonth()+1; const cat = r.categoria_codigo; if (!gasMap[cat]) gasMap[cat] = {}; gasMap[cat][mes] = (gasMap[cat][mes]||0) + Math.abs(Number(r.base_imponible||0)) })

      let qBrut = supabase.from('facturacion_diario').select('fecha,uber_bruto,glovo_bruto,je_bruto,web_bruto,directa_bruto,total_bruto,total_pedidos,uber_pedidos,glovo_pedidos,je_pedidos,web_pedidos,directa_pedidos').gte('fecha',`${año}-01-01`).lte('fecha',`${año}-12-31`)
      if (titularId) qBrut = qBrut.eq('titular_id', titularId)
      const { data: dBrut } = await qBrut
      const brutMap: RunningAnualData['brutos'] = {}
      const pedMap: RunningAnualData['pedidosCanal'] = {}
      const diasMap: Record<number, Set<string>> = {}
      ;(dBrut || []).forEach((r: any) => {
        const mes = new Date(r.fecha).getMonth()+1
        if (!brutMap[mes]) brutMap[mes]={uber:0,glovo:0,je:0,web:0,directa:0,total:0,pedidos:0}
        if (!pedMap[mes]) pedMap[mes]={uber:0,glovo:0,je:0,web:0,directa:0}
        brutMap[mes].uber+=Number(r.uber_bruto||0); brutMap[mes].glovo+=Number(r.glovo_bruto||0); brutMap[mes].je+=Number(r.je_bruto||0); brutMap[mes].web+=Number(r.web_bruto||0); brutMap[mes].directa+=Number(r.directa_bruto||0); brutMap[mes].total+=Number(r.total_bruto||0); brutMap[mes].pedidos+=Number(r.total_pedidos||0)
        pedMap[mes].uber+=Number(r.uber_pedidos||0); pedMap[mes].glovo+=Number(r.glovo_pedidos||0); pedMap[mes].je+=Number(r.je_pedidos||0); pedMap[mes].web+=Number(r.web_pedidos||0); pedMap[mes].directa+=Number(r.directa_pedidos||0)
        if (!diasMap[mes]) diasMap[mes] = new Set()
        diasMap[mes].add(r.fecha)
      })
      const dOp: Record<number, number> = {}
      for (const [m, s] of Object.entries(diasMap)) dOp[Number(m)] = s.size

      const { data: dCat } = await supabase.from('categorias_pyg').select('id,nombre,parent_id,nivel,bloque,orden').eq('activa',true).order('orden')
      const { data: dBench } = await supabase.from('categorias_rango').select('categoria,pct_min,pct_max')
      const { data: dCom } = await supabase.from('config_canales').select('canal,comision_pct,fijo_eur,coste_fijo,fee_periodo_eur,fee_periodicidad').eq('activo',true)
      const { count: marcasCount } = await supabase.from('marcas').select('id', { count:'exact', head:true }).eq('activo', true)

      const comMap: Record<string, number> = {}
      const feesMap: RunningAnualData['feesFijos'] = {}
      ;(dCom || []).forEach((r: any) => {
        const key = CANAL_MAP[r.canal]
        if (!key) return
        const com = Number(r.comision_pct || 0)
        comMap[key] = com > 1 ? com / 100 : com
        feesMap[key] = {
          fijoEur: Number(r.fijo_eur || r.coste_fijo || 0),
          feePeriodoEur: Number(r.fee_periodo_eur || 0),
          feePeriodicidad: r.fee_periodicidad || 'mensual',
        }
      })

      if (!cancelled) { 
        setIngresos(ingMap); setGastos(gasMap); setBrutos(brutMap); setPedidosCanal(pedMap); setDiasOp(dOp); setCategorias(dCat||[]); setBenchmarks((dBench||[]).map((b:any)=>({...b,pct_min:Number(b.pct_min),pct_max:Number(b.pct_max)}))); setComisiones(comMap); setFeesFijos(feesMap); setMarcasActivas(marcasCount && marcasCount > 0 ? marcasCount : 1); setLoading(false) 
      }
    }
    load()
    return () => { cancelled = true }
  }, [año, titularId, tick])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onChange = () => setTick(t => t + 1)
    window.addEventListener('config_canales:changed', onChange)
    return () => window.removeEventListener('config_canales:changed', onChange)
  }, [])

  return { ingresos, gastos, brutos, pedidosCanal, diasOp, categorias, benchmarks, comisiones, feesFijos, marcasActivas, loading }
}

/**
 * Calcula neto cobrado COMPLETO para un canal:
 *   neto = bruto - (comision%·bruto + fijo€·pedidos + fee_periodo·periodos·marcas) × (1 + IVA)
 * Esta es la fórmula unificada del ERP (mismo cálculo que calcNetoPorCanal en calcNetoPlataforma.ts)
 */
export function calcNetoCanal(
  canalKey: 'uber'|'glovo'|'je'|'web'|'directa',
  bruto: number,
  pedidos: number,
  comisionDec: number,
  fee: { fijoEur:number; feePeriodoEur:number; feePeriodicidad:string } | undefined,
  diasPeriodo: number,
  marcasActivas: number,
): number {
  if (bruto <= 0) return 0
  const fijoEur = fee?.fijoEur ?? 0
  const feePeriodoEur = fee?.feePeriodoEur ?? 0
  const periodicidad = fee?.feePeriodicidad ?? 'mensual'
  
  let periodos = 1
  if (feePeriodoEur > 0 && diasPeriodo > 0) {
    switch (periodicidad) {
      case 'semanal_por_marca':   periodos = Math.ceil(diasPeriodo / 7); break
      case 'quincenal_por_marca': periodos = Math.ceil(diasPeriodo / 15); break
      case 'mensual':             periodos = Math.ceil(diasPeriodo / 30); break
      default:                    periodos = 1
    }
  }
  
  const baseComision = (comisionDec * bruto) + (fijoEur * pedidos)
  const feeTotal = feePeriodoEur > 0 ? feePeriodoEur * periodos * marcasActivas : 0
  const totalComisionable = baseComision + feeTotal
  const ivaCom = IVA * totalComisionable
  return Math.max(0, bruto - totalComisionable - ivaCom)
}

/** Helper: días en una lista de meses (asume mes completo) */
export function diasDeMeses(meses: number[], año: number): number {
  let total = 0
  for (const m of meses) {
    const d = new Date(año, m, 0).getDate()
    total += d
  }
  return total
}

export function sumMeses(map: Record<number, number>, meses: number[]): number {
  return meses.reduce((s, m) => s + (map[m] || 0), 0)
}

export function sumCatMeses(gastos: Record<string, Record<number, number>>, prefix: string, meses: number[]): number {
  let total = 0
  for (const [cat, mesMap] of Object.entries(gastos)) { if (cat.startsWith(prefix)) total += sumMeses(mesMap, meses) }
  return total
}

export function fmtN(n: number | undefined): string {
  if (n === undefined || n === 0) return '—'
  return (n < 0 ? '−' : '') + Math.round(Math.abs(n)).toLocaleString('es-ES')
}
