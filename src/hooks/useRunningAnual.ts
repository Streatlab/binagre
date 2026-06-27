import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { loadConfigCanales, loadMarcasPorCanal, type CanalConfig, type MarcasPorCanal } from '@/lib/panel/calcNetoPlataforma'
import { resolverNeto, loadVentasReales, loadRatiosCalibrados } from '@/lib/panel/netoResolver'

export interface RunningAnualData {
  ingresos: Record<string, Record<number, number>>
  gastos: Record<string, Record<number, number>>
  gastosEstimados: Record<string, Record<number, boolean>>
  facturacionFutura: Record<number, { importe: number; origen: 'objetivo'|'anyo_anterior'|'mes_anterior' }>
  brutos: Record<number, { uber:number; glovo:number; je:number; web:number; directa:number; total:number; pedidos:number }>
  pedidosCanal: Record<number, { uber:number; glovo:number; je:number; web:number; directa:number }>
  diasOp: Record<number, number>
  categorias: { id:string; nombre:string; parent_id:string|null; nivel:number; bloque:string; orden:number }[]
  benchmarks: { categoria:string; pct_min:number; pct_max:number }[]
  comisiones: Record<string, number>
  feesFijos: Record<string, { fijoEur:number; feePeriodoEur:number; feePeriodicidad:string }>
  configCanales: Record<string, CanalConfig>
  marcasActivas: MarcasPorCanal
  objetivosMensuales: Record<number, number>
  loading: boolean
}

// Lista explícita de categorías estimables (gastos fijos que se repiten mes a mes)
const CATEGORIAS_ESTIMABLES = new Set<string>([
  // Equipo
  '2.21.1','2.21.2','2.21.3','2.21.4','2.21.5','2.21.6','2.21.7','2.21.10','2.21.11','2.21.12',
  // Local
  '2.31.1','2.31.2','2.31.3',
  // Internet
  '2.42.1','2.42.2','2.42.3',
  // Integraciones
  '2.43.2','2.43.3','2.43.4',
  // Suministros (todos)
  '2.44.1','2.44.2','2.44.3','2.44.4',
])

function esCategoriaFijaEstimable(catId: string): boolean {
  return CATEGORIAS_ESTIMABLES.has(catId)
}

export function useRunningAnual(año: number, titularId: string|null): RunningAnualData {
  const [ingresos, setIngresos] = useState<Record<string, Record<number, number>>>({})
  const [gastos, setGastos] = useState<Record<string, Record<number, number>>>({})
  const [gastosEstimados, setGastosEstimados] = useState<Record<string, Record<number, boolean>>>({})
  const [facturacionFutura, setFacturacionFutura] = useState<RunningAnualData['facturacionFutura']>({})
  const [brutos, setBrutos] = useState<RunningAnualData['brutos']>({})
  const [pedidosCanal, setPedidosCanal] = useState<RunningAnualData['pedidosCanal']>({})
  const [diasOp, setDiasOp] = useState<Record<number, number>>({})
  const [categorias, setCategorias] = useState<RunningAnualData['categorias']>([])
  const [benchmarks, setBenchmarks] = useState<RunningAnualData['benchmarks']>([])
  const [comisiones, setComisiones] = useState<Record<string, number>>({})
  const [feesFijos, setFeesFijos] = useState<RunningAnualData['feesFijos']>({})
  const [configCanales, setConfigCanales] = useState<Record<string, CanalConfig>>({})
  const [marcasActivas, setMarcasActivas] = useState<MarcasPorCanal>({ uber: 1, glovo: 1, je: 1, web: 1, dir: 1 })
  const [objetivosMensuales, setObjetivosMensuales] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)

      const ingMap: Record<string, Record<number, number>> = {}
      const gasMap: Record<string, Record<number, number>> = {}

      if (!titularId) {
        const { data: dView } = await supabase.from('v_running_mensual').select('mes,codigo,tipo,total').eq('año', año)
        ;(dView || []).forEach((r: any) => {
          const map = r.tipo === 'ingreso' ? ingMap : gasMap
          if (!map[r.codigo]) map[r.codigo] = {}
          map[r.codigo][r.mes] = (map[r.codigo][r.mes] || 0) + Number(r.total || 0)
        })
      } else {
        let qIng = supabase.from('conciliacion').select('fecha,categoria,importe').eq('tipo','ingreso').like('categoria','1.%').gte('fecha',`${año}-01-01`).lte('fecha',`${año}-12-31`)
        qIng = qIng.eq('titular_id', titularId)
        const { data: dIng } = await qIng
        ;(dIng || []).forEach((r: any) => { const mes = new Date(r.fecha).getMonth()+1; const cat = r.categoria; if (!ingMap[cat]) ingMap[cat] = {}; ingMap[cat][mes] = (ingMap[cat][mes]||0) + Number(r.importe||0) })

        let qGas = supabase.from('gastos').select('fecha,categoria_codigo,base_imponible').gte('fecha',`${año}-01-01`).lte('fecha',`${año}-12-31`)
        qGas = qGas.eq('titular_id', titularId)
        const { data: dGas } = await qGas
        ;(dGas || []).forEach((r: any) => { const mes = new Date(r.fecha).getMonth()+1; const cat = r.categoria_codigo; if (!gasMap[cat]) gasMap[cat] = {}; gasMap[cat][mes] = (gasMap[cat][mes]||0) + Math.abs(Number(r.base_imponible||0)) })
      }

      const { data: dCat } = await supabase.from('categorias_pyg').select('id,nombre,parent_id,nivel,bloque,orden').eq('activa',true).order('orden')
      const cats = dCat || []

      // === GASTOS FIJOS ESTIMABLES (lista explícita) ===
      const gasEstMap: Record<string, Record<number, boolean>> = {}
      for (const cat of Array.from(CATEGORIAS_ESTIMABLES)) {
        if (!gasMap[cat]) gasMap[cat] = {}
        if (!gasEstMap[cat]) gasEstMap[cat] = {}
        // Forward fill: replicar último importe real hacia delante
        let ultimoImporte = 0
        for (let mes = 1; mes <= 12; mes++) {
          const valorReal = gasMap[cat][mes] || 0
          if (valorReal > 0) {
            ultimoImporte = valorReal
          } else if (ultimoImporte > 0) {
            gasMap[cat][mes] = ultimoImporte
            gasEstMap[cat][mes] = true
          }
        }
        // Backward fill: si los primeros meses están vacíos, replicar el primer importe real
        let primerImporte = 0
        for (let mes = 1; mes <= 12; mes++) {
          if (gasMap[cat][mes] && gasMap[cat][mes] > 0 && !gasEstMap[cat][mes]) {
            primerImporte = gasMap[cat][mes]
            break
          }
        }
        if (primerImporte > 0) {
          for (let mes = 1; mes <= 12; mes++) {
            if (!gasMap[cat][mes] || gasMap[cat][mes] === 0) {
              gasMap[cat][mes] = primerImporte
              gasEstMap[cat][mes] = true
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

      const mesActual = new Date().getMonth() + 1
      const anioActual = new Date().getFullYear()
      const { data: dDias } = await supabase.from('objetivos_dia_semana').select('dia,importe').order('dia')
      const { data: dObjGen } = await supabase.from('objetivos').select('tipo,importe').in('tipo', ['semanal','mensual','anual'])
      const sumaSemanal = (dDias || []).reduce((a:number, r:any) => a + Number(r.importe || 0), 0)
      const objSemanalManual = Number((dObjGen || []).find((r:any) => r.tipo === 'semanal')?.importe || 0)
      const objMensualManual = Number((dObjGen || []).find((r:any) => r.tipo === 'mensual')?.importe || 0)
      const semanalEfectivo = objSemanalManual > 0 ? objSemanalManual : sumaSemanal
      const objMesMap: Record<number, number> = {}
      for (let m = 1; m <= 12; m++) {
        const diasMes = new Date(año, m, 0).getDate()
        const calc = semanalEfectivo > 0 ? Math.round((semanalEfectivo / 7) * diasMes) : 0
        objMesMap[m] = (objMensualManual > 0 && m === mesActual && año === anioActual) ? objMensualManual : calc
      }

      const facFutMap: RunningAnualData['facturacionFutura'] = {}
      let qBrutPrev = supabase.from('facturacion_diario').select('fecha,total_bruto').gte('fecha',`${año-1}-01-01`).lte('fecha',`${año-1}-12-31`)
      if (titularId) qBrutPrev = qBrutPrev.eq('titular_id', titularId)
      const { data: dBrutPrev } = await qBrutPrev
      const brutPrevMap: Record<number, number> = {}
      ;(dBrutPrev || []).forEach((r: any) => { const mes = new Date(r.fecha).getMonth()+1; brutPrevMap[mes] = (brutPrevMap[mes]||0) + Number(r.total_bruto||0) })
      for (let mes = 1; mes <= 12; mes++) {
        const brutoReal = brutMap[mes]?.total || 0
        const esFuturo = año > anioActual || (año === anioActual && mes > mesActual)
        if (brutoReal === 0 && esFuturo) {
          if (objMesMap[mes] && objMesMap[mes] > 0) {
            facFutMap[mes] = { importe: objMesMap[mes], origen: 'objetivo' }
          } else if (brutPrevMap[mes] && brutPrevMap[mes] > 0) {
            facFutMap[mes] = { importe: brutPrevMap[mes], origen: 'anyo_anterior' }
          } else {
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

      const { data: dBench } = await supabase.from('categorias_rango').select('categoria,pct_min,pct_max')
      const cfg = await loadConfigCanales()
      await loadVentasReales(); await loadRatiosCalibrados()
      const marcasMap = await loadMarcasPorCanal()

      const CANAL_BBDD_TO_KEY: Record<string, string> = {
        'Uber Eats': 'uber', 'Glovo': 'glovo', 'Just Eat': 'je', 'Web Propia': 'web', 'Venta Directa': 'directa',
      }
      const comMap: Record<string, number> = {}
      const feesMap: RunningAnualData['feesFijos'] = {}
      for (const [canal, c] of Object.entries(cfg)) {
        const key = CANAL_BBDD_TO_KEY[canal]
        if (!key) continue
        comMap[key] = c.comision_pct
        feesMap[key] = {
          fijoEur: c.fijo_eur,
          feePeriodoEur: c.fee_periodo_eur,
          feePeriodicidad: c.fee_periodicidad,
        }
      }

      if (!cancelled) {
        setIngresos(ingMap); setGastos(gasMap); setGastosEstimados(gasEstMap); setFacturacionFutura(facFutMap); setBrutos(brutMap); setPedidosCanal(pedMap); setDiasOp(dOp); setCategorias(cats); setBenchmarks((dBench||[]).map((b:any)=>({...b,pct_min:Number(b.pct_min),pct_max:Number(b.pct_max)}))); setComisiones(comMap); setFeesFijos(feesMap); setConfigCanales(cfg); setMarcasActivas(marcasMap); setObjetivosMensuales(objMesMap); setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [año, titularId, tick])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onChange = () => setTick(t => t + 1)
    window.addEventListener('config_canales:changed', onChange)
    window.addEventListener('objetivos:changed', onChange)
    return () => {
      window.removeEventListener('config_canales:changed', onChange)
      window.removeEventListener('objetivos:changed', onChange)
    }
  }, [])

  return { ingresos, gastos, gastosEstimados, facturacionFutura, brutos, pedidosCanal, diasOp, categorias, benchmarks, comisiones, feesFijos, configCanales, marcasActivas, objetivosMensuales, loading }
}

export function calcNetoCanal(
  canalKey: 'uber'|'glovo'|'je'|'web'|'directa',
  bruto: number,
  pedidos: number,
  _comisionDec: number,
  _fee: { fijoEur:number; feePeriodoEur:number; feePeriodicidad:string } | undefined,
  diasPeriodo: number,
  marcasActivas: number | MarcasPorCanal,
  fechaDesde?: Date,
  fechaHasta?: Date,
  configCanales?: Record<string, CanalConfig>,
): number {
  if (bruto <= 0) return 0
  let fIni = fechaDesde, fFin = fechaHasta
  if (!fIni || !fFin) {
    fFin = new Date()
    fIni = new Date()
    fIni.setDate(fFin.getDate() - Math.max(1, diasPeriodo - 1))
  }
  const id = canalKey === 'directa' ? 'dir' : canalKey
  const { neto } = resolverNeto(id, bruto, pedidos, marcasActivas, fIni, fFin, configCanales)
  return neto
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
