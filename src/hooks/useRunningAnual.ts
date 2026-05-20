import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { repartirCobro, type BrutoDiario, type CanalKey } from './casarFechaCobro'

export interface CeldaIngreso {
  importe: number
  esEstimado: boolean
  origen: 'banco' | 'ocr' | 'estimado_bruto_x_comision'
}

export interface RunningAnualData {
  ingresos: Record<string, Record<number, number>>
  ingresosPorCanal: Record<CanalKey, Record<number, CeldaIngreso>>
  gastos: Record<string, Record<number, number>>
  brutos: Record<number, { uber:number; glovo:number; je:number; web:number; directa:number; total:number; pedidos:number }>
  diasOp: Record<number, number>
  categorias: { id:string; nombre:string; parent_id:string|null; nivel:number; bloque:string; orden:number }[]
  benchmarks: { categoria:string; pct_min:number; pct_max:number }[]
  comisiones: Record<string, number>
  feesFijos: Record<string, { fijoEur:number; feePeriodoEur:number; feePeriodicidad:string }>
  loading: boolean
}

const CANAL_MAP: Record<string, string> = {
  'Uber Eats': 'uber',
  'Glovo': 'glovo',
  'Just Eat': 'je',
  'Web Propia': 'web',
  'Venta Directa': 'directa',
}

// Detecta canal de un movimiento de conciliacion a partir de su descripcion/contraparte
function detectarCanal(row: any): CanalKey | null {
  const txt = `${row.contraparte || ''} ${row.concepto || ''} ${row.descripcion || ''}`.toLowerCase()
  if (txt.includes('uber')) return 'uber'
  if (txt.includes('glovo')) return 'glovo'
  if (txt.includes('just eat') || txt.includes('justeat') || txt.includes('je ')) return 'je'
  if (txt.includes('stripe') || txt.includes('redsys') || txt.includes('shopify')) return 'web'
  return null
}

export function useRunningAnual(anio: number, titularId: string|null): RunningAnualData {
  const [ingresos, setIngresos] = useState<Record<string, Record<number, number>>>({})
  const [ingresosPorCanal, setIngresosPorCanal] = useState<RunningAnualData['ingresosPorCanal']>({
    uber: {}, glovo: {}, je: {}, web: {}, directa: {},
  })
  const [gastos, setGastos] = useState<Record<string, Record<number, number>>>({})
  const [brutos, setBrutos] = useState<RunningAnualData['brutos']>({})
  const [diasOp, setDiasOp] = useState<Record<number, number>>({})
  const [categorias, setCategorias] = useState<RunningAnualData['categorias']>([])
  const [benchmarks, setBenchmarks] = useState<RunningAnualData['benchmarks']>([])
  const [comisiones, setComisiones] = useState<Record<string, number>>({})
  const [feesFijos, setFeesFijos] = useState<RunningAnualData['feesFijos']>({})
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)

      // 1. INGRESOS BANCO. Ampliamos +/- 60 dias porque los cobros de ventas
      //    del anio pueden caer fuera del anio natural.
      let qIng = supabase.from('conciliacion')
        .select('fecha,categoria,importe,contraparte,concepto,descripcion')
        .eq('tipo','ingreso')
        .like('categoria','1.%')
        .gte('fecha',`${anio-1}-11-01`)
        .lte('fecha',`${anio+1}-02-29`)
      if (titularId) qIng = qIng.eq('titular_id', titularId)
      const { data: dIng } = await qIng

      // 2. GASTOS (imputados a fecha de pago real)
      let qGas = supabase.from('gastos').select('fecha,categoria_codigo,base_imponible').gte('fecha',`${anio}-01-01`).lte('fecha',`${anio}-12-31`)
      if (titularId) qGas = qGas.eq('titular_id', titularId)
      const { data: dGas } = await qGas
      const gasMap: Record<string, Record<number, number>> = {}
      ;(dGas || []).forEach((r: any) => { const mes = new Date(r.fecha).getMonth()+1; const cat = r.categoria_codigo; if (!gasMap[cat]) gasMap[cat] = {}; gasMap[cat][mes] = (gasMap[cat][mes]||0) + Math.abs(Number(r.base_imponible||0)) })

      // 3. BRUTOS POR DIA
      let qBrut = supabase.from('facturacion_diario').select('fecha,uber_bruto,glovo_bruto,je_bruto,web_bruto,directa_bruto,total_bruto,total_pedidos').gte('fecha',`${anio}-01-01`).lte('fecha',`${anio}-12-31`)
      if (titularId) qBrut = qBrut.eq('titular_id', titularId)
      const { data: dBrut } = await qBrut

      const brutosDiarios: BrutoDiario[] = (dBrut || []).map((r: any) => ({
        fecha: r.fecha,
        uber_bruto: Number(r.uber_bruto || 0),
        glovo_bruto: Number(r.glovo_bruto || 0),
        je_bruto: Number(r.je_bruto || 0),
        web_bruto: Number(r.web_bruto || 0),
        directa_bruto: Number(r.directa_bruto || 0),
      }))

      const brutMap: RunningAnualData['brutos'] = {}
      const diasMap: Record<number, Set<string>> = {}
      ;(dBrut || []).forEach((r: any) => {
        const mes = new Date(r.fecha).getMonth()+1
        if (!brutMap[mes]) brutMap[mes]={uber:0,glovo:0,je:0,web:0,directa:0,total:0,pedidos:0}
        brutMap[mes].uber+=Number(r.uber_bruto||0); brutMap[mes].glovo+=Number(r.glovo_bruto||0); brutMap[mes].je+=Number(r.je_bruto||0); brutMap[mes].web+=Number(r.web_bruto||0); brutMap[mes].directa+=Number(r.directa_bruto||0); brutMap[mes].total+=Number(r.total_bruto||0); brutMap[mes].pedidos+=Number(r.total_pedidos||0)
        if (!diasMap[mes]) diasMap[mes] = new Set()
        diasMap[mes].add(r.fecha)
      })
      const dOp: Record<number, number> = {}
      for (const [m, s] of Object.entries(diasMap)) dOp[Number(m)] = s.size

      // 4. CONFIG
      const { data: dCat } = await supabase.from('categorias_pyg').select('id,nombre,parent_id,nivel,bloque,orden').eq('activa',true).order('orden')
      const { data: dBench } = await supabase.from('categorias_rango').select('categoria,pct_min,pct_max')
      const { data: dCom } = await supabase.from('config_canales').select('canal,comision_pct,fijo_eur,coste_fijo,fee_periodo_eur,fee_periodicidad').eq('activo',true)

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

      // 5. CASADO COBROS -> MES DE VENTA
      const ingPorCanalReal: Record<CanalKey, Record<number, number>> = {
        uber: {}, glovo: {}, je: {}, web: {}, directa: {},
      }
      ;(dIng || []).forEach((r: any) => {
        const canal = detectarCanal(r)
        if (!canal) return
        const importe = Number(r.importe || 0)
        if (importe === 0) return
        const repartos = repartirCobro(canal, r.fecha, importe, brutosDiarios)
        for (const rep of repartos) {
          if (rep.anio !== anio) continue
          ingPorCanalReal[canal][rep.mes] = (ingPorCanalReal[canal][rep.mes] || 0) + rep.importe
        }
      })

      // 6. ingresosPorCanal: real si hay cobro casado, estimado si no
      const ipc: RunningAnualData['ingresosPorCanal'] = {
        uber: {}, glovo: {}, je: {}, web: {}, directa: {},
      }
      const canales: CanalKey[] = ['uber','glovo','je','web','directa']
      for (let mes = 1; mes <= 12; mes++) {
        for (const c of canales) {
          const real = ingPorCanalReal[c][mes] || 0
          if (real > 0) {
            ipc[c][mes] = { importe: real, esEstimado: false, origen: 'banco' }
          } else {
            const brutoCanal = (brutMap[mes]?.[c]) || 0
            if (brutoCanal > 0) {
              const com = comMap[c] ?? 0
              const estimado = brutoCanal * (1 - com)
              ipc[c][mes] = { importe: estimado, esEstimado: true, origen: 'estimado_bruto_x_comision' }
            } else {
              ipc[c][mes] = { importe: 0, esEstimado: false, origen: 'banco' }
            }
          }
        }
      }

      // 7. ingresos[categoria][mes] compat: alimentado por cobros casados.
      const ingMap: Record<string, Record<number, number>> = {}
      for (let mes = 1; mes <= 12; mes++) {
        const totalMes = canales.reduce((s, c) => s + (ipc[c][mes]?.importe || 0), 0)
        if (totalMes > 0) {
          if (!ingMap['1.1']) ingMap['1.1'] = {}
          ingMap['1.1'][mes] = totalMes
        }
      }

      if (!cancelled) {
        setIngresos(ingMap)
        setIngresosPorCanal(ipc)
        setGastos(gasMap)
        setBrutos(brutMap)
        setDiasOp(dOp)
        setCategorias(dCat||[])
        setBenchmarks((dBench||[]).map((b:any)=>({...b,pct_min:Number(b.pct_min),pct_max:Number(b.pct_max)})))
        setComisiones(comMap)
        setFeesFijos(feesMap)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [anio, titularId, tick])

  // Recarga global cuando Configuracion guarda cambios en config_canales
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onChange = () => setTick(t => t + 1)
    window.addEventListener('config_canales:changed', onChange)
    return () => window.removeEventListener('config_canales:changed', onChange)
  }, [])

  return { ingresos, ingresosPorCanal, gastos, brutos, diasOp, categorias, benchmarks, comisiones, feesFijos, loading }
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
