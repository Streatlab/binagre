import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface RunningAnualData {
  ingresos: Record<string, Record<number, number>>
  gastos: Record<string, Record<number, number>>
  gastosPagados: Record<string, Record<number, number>>
  gastosEstimados: Record<string, Record<number, boolean>>
  facturacionFutura: Record<number, { importe: number; origen: 'objetivo'|'anyo_anterior'|'mes_anterior' }>
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

// Categorías de gastos fijos que se estiman (mismo valor mes anterior si no hay del mes)
const CATS_ESTIMABLES_FIJOS = ['2.31','2.32','2.33','2.34','2.3','2.21','2.22']

export function useRunningAnual(año: number, titularId: string|null): RunningAnualData {
  const [ingresos, setIngresos] = useState<Record<string, Record<number, number>>>({})
  const [gastos, setGastos] = useState<Record<string, Record<number, number>>>({})
  const [gastosPagados, setGastosPagados] = useState<Record<string, Record<number, number>>>({})
  const [gastosEstimados, setGastosEstimados] = useState<Record<string, Record<number, boolean>>>({})
  const [facturacionFutura, setFacturacionFutura] = useState<RunningAnualData['facturacionFutura']>({})
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

      // GASTOS por factura (tabla gastos, base_imponible)
      let qGas = supabase.from('gastos').select('fecha,categoria_codigo,base_imponible').gte('fecha',`${año}-01-01`).lte('fecha',`${año}-12-31`)
      if (titularId) qGas = qGas.eq('titular_id', titularId)
      const { data: dGas } = await qGas
      const gasMap: Record<string, Record<number, number>> = {}
      ;(dGas || []).forEach((r: any) => { const mes = new Date(r.fecha).getMonth()+1; const cat = r.categoria_codigo; if (!gasMap[cat]) gasMap[cat] = {}; gasMap[cat][mes] = (gasMap[cat][mes]||0) + Math.abs(Number(r.base_imponible||0)) })

      // PUNTO 14: GASTOS REALES pagados banco (conciliacion tipo=gasto)
      let qGasPag = supabase.from('conciliacion').select('fecha,categoria,importe').eq('tipo','gasto').like('categoria','2.%').gte('fecha',`${año}-01-01`).lte('fecha',`${año}-12-31`)
      if (titularId) qGasPag = qGasPag.eq('titular_id', titularId)
      const { data: dGasPag } = await qGasPag
      const gasPagMap: Record<string, Record<number, number>> = {}
      ;(dGasPag || []).forEach((r: any) => { const mes = new Date(r.fecha).getMonth()+1; const cat = r.categoria; if (!gasPagMap[cat]) gasPagMap[cat] = {}; gasPagMap[cat][mes] = (gasPagMap[cat][mes]||0) + Math.abs(Number(r.importe||0)) })

      // PUNTO 18: GASTOS ESTIMADOS (fijos sin factura del mes → valor mes anterior)
      const gasEstMap: Record<string, Record<number, boolean>> = {}
      const mesActual = new Date().getMonth() + 1
      const anioActual = new Date().getFullYear()
      for (const cat of CATS_ESTIMABLES_FIJOS) {
        if (!gasMap[cat]) gasMap[cat] = {}
        if (!gasEstMap[cat]) gasEstMap[cat] = {}
        for (let mes = 1; mes <= 12; mes++) {
          // Si no hay factura del mes Y es mes pasado o presente del año actual
          const sinFactura = !gasMap[cat][mes] || gasMap[cat][mes] === 0
          const esMesElegible = año < anioActual || (año === anioActual && mes <= mesActual)
          if (sinFactura && esMesElegible) {
            // Buscar mes anterior con valor
            for (let mPrev = mes - 1; mPrev >= 1; mPrev--) {
              if (gasMap[cat][mPrev] && gasMap[cat][mPrev] > 0) {
                gasMap[cat][mes] = gasMap[cat][mPrev]
                gasEstMap[cat][mes] = true
                break
              }
            }
          }
        }
      }

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

      // PUNTO 17: CASCADA FACTURACION FUTURA
      // Para meses futuros sin bruto real:
      // 1. Buscar Objetivos del mes
      // 2. Si no hay, buscar mismo mes año anterior
      // 3. Si no hay, usar mes anterior
      const facFutMap: RunningAnualData['facturacionFutura'] = {}
      // Objetivos del año
      const { data: dObj } = await supabase.from('objetivos').select('mes,facturacion_objetivo').eq('año', año).maybeSingle ? supabase.from('objetivos').select('mes,facturacion_objetivo').eq('año', año) : { data: [] } as any
      const objMap: Record<number, number> = {}
      ;(dObj || []).forEach((r: any) => { if (r.mes && r.facturacion_objetivo) objMap[r.mes] = Number(r.facturacion_objetivo || 0) })
      // Brutos año anterior
      let qBrutPrev = supabase.from('facturacion_diario').select('fecha,total_bruto').gte('fecha',`${año-1}-01-01`).lte('fecha',`${año-1}-12-31`)
      if (titularId) qBrutPrev = qBrutPrev.eq('titular_id', titularId)
      const { data: dBrutPrev } = await qBrutPrev
      const brutPrevMap: Record<number, number> = {}
      ;(dBrutPrev || []).forEach((r: any) => { const mes = new Date(r.fecha).getMonth()+1; brutPrevMap[mes] = (brutPrevMap[mes]||0) + Number(r.total_bruto||0) })
      // Aplicar cascada solo a meses futuros del año en curso o años futuros
      for (let mes = 1; mes <= 12; mes++) {
        const brutoReal = brutMap[mes]?.total || 0
        const esFuturo = año > anioActual || (año === anioActual && mes > mesActual)
        if (brutoReal === 0 && esFuturo) {
          if (objMap[mes] && objMap[mes] > 0) {
            facFutMap[mes] = { importe: objMap[mes], origen: 'objetivo' }
          } else if (brutPrevMap[mes] && brutPrevMap[mes] > 0) {
            facFutMap[mes] = { importe: brutPrevMap[mes], origen: 'anyo_anterior' }
          } else {
            // Mes anterior (real o estimado previamente)
            for (let mPrev = mes - 1; mPrev >= 1; mPrev--) {
              const prevReal = brutMap[mPrev]?.total || 0
              const prevEst = facFutMap[mPrev]?.importe || 0
              const prevValor = prevReal || prevEst
              if (prevValor > 0) {
                facFutMap[mes] = { importe: prevValor, origen: 'mes_anterior' }
                break
              }
            }
          }
        }
      }

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
        setIngresos(ingMap); setGastos(gasMap); setGastosPagados(gasPagMap); setGastosEstimados(gasEstMap); setFacturacionFutura(facFutMap); setBrutos(brutMap); setPedidosCanal(pedMap); setDiasOp(dOp); setCategorias(dCat||[]); setBenchmarks((dBench||[]).map((b:any)=>({...b,pct_min:Number(b.pct_min),pct_max:Number(b.pct_max)}))); setComisiones(comMap); setFeesFijos(feesMap); setMarcasActivas(marcasCount && marcasCount > 0 ? marcasCount : 1); setLoading(false)
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

  return { ingresos, gastos, gastosPagados, gastosEstimados, facturacionFutura, brutos, pedidosCanal, diasOp, categorias, benchmarks, comisiones, feesFijos, marcasActivas, loading }
}

/**
 * Calcula neto cobrado COMPLETO para un canal:
 *   neto = bruto - (comision%·bruto + fijo€·pedidos + fee_periodo·periodos·marcas) × (1 + IVA)
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

export function diasDeMeses(meses: number[], año: number): number {
  let total = 0
  for (const m of meses) { const d = new Date(año, m, 0).getDate(); total += d }
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
