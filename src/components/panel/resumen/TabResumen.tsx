import { BLANCO } from '@/styles/neobrutal'
/**
 * Tab Resumen v8 — Panel Global
 * Lógica de cálculo (la presentación está en ResumenLanding).
 * v8 (tanda 2): variación por marca (sube/baja), proyección de cierre de mes
 * (a este ritmo) y coste por pedido real (comisión de plataforma + producto).
 * v9: wrapper neobrutal sin marco redondeado.
 * v10: periodoRango (fechas concretas) para la card de estado de salud.
 */

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { resolverNeto } from '@/lib/panel/netoResolver'
import { useNetoContext } from '@/lib/panel/useNetoContext'
import { calcPorCobrar, type PorCobrarResult } from '@/lib/panel/calcPorCobrar'
import { COLOR, LEXEND } from './tokens'
import { toLocalDateStr } from '@/lib/dateRange'
import { useEsMovil } from '@/hooks/useEsMovil'
import ResumenLanding from './ResumenLanding'
import type { MetricasInsight } from './frasesInsight'
import { type GrupoGasto } from './ColGruposGasto'
import { type DiaPico } from './ColDiasPico'
import type {
  RowFacturacion, CanalStat, ObjetivosVentas, PagoProximoItem,
  TopVentaItem,
} from './types'

type NavTab = 'operaciones' | 'finanzas' | 'cashflow' | 'marcas' | 'evolucion'

interface Props {
  rowsPeriodo: RowFacturacion[]
  rowsAll: RowFacturacion[]
  fechaDesde: Date
  fechaHasta: Date
  canalesFiltro: string[]
  periodoLabel?: string
  onFiltrarDiaSemana?: (idxDow: number) => void
  onNavTab?: (tab: NavTab) => void
}

interface ToastMsg { id: number; msg: string; type: 'success' | 'warning' }
interface RepartoRow { nombre: string; bruto: number; neto: number; pedidos: number; pct: number }
interface MarcaRealRow { nombre: string; neto: number; bruto: number; pedidos: number; tmBruto: number; pct: number; serie: number[]; varPct: number | null }

const NOMBRES_DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const COLORES_DIAS = [
  COLOR.diaLun, COLOR.diaMar, COLOR.diaMie, COLOR.diaJue,
  COLOR.diaVie, COLOR.diaSab, COLOR.diaDom,
]
const NOMBRES_DIAS_CORTOS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
const SERV_LABEL: Record<string, string> = { ALM: 'Almuerzo', CENAS: 'Cenas', CENA: 'Cenas', TODO: 'Todo el día' }


function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function startOfWeekStr(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  return toLocalDateStr(monday)
}

function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function rangoPrevio(desde: Date, hasta: Date) {
  const days = Math.round((hasta.getTime() - desde.getTime()) / 86400000) + 1
  const prevHasta = new Date(desde); prevHasta.setDate(desde.getDate() - 1)
  const prevDesde = new Date(prevHasta); prevDesde.setDate(prevHasta.getDate() - (days - 1))
  return { desde: toLocalDateStr(prevDesde), hasta: toLocalDateStr(prevHasta) }
}

interface PeParams {
  alquiler_local: number; irpf_alquiler: number;
  sueldo_ruben: number; sueldo_emilio: number; sueldos_empleados: number;
  ss_empresa: number; ss_autonomos: number; gestoria: number;
  luz: number; agua: number; gas: number; telefono: number; internet: number;
  hosting_software: number; seguros: number; licencias: number;
  think_paladar: number; otros_fijos: number;
  food_cost_pct: number; objetivo_beneficio_mensual: number;
  iva_pct: number;
  caja_minima_verde?: number; caja_minima_ambar?: number; tasa_fiscal_pct?: number;
}

interface IngresoMensual {
  anio: number; mes: number; canal: string; tipo: string; importe: number; base_imponible: number
}

interface Provision {
  tipo: string; periodo: string; fecha_inicio: string; fecha_fin: string; importe: number; estado: string;
}

interface GastoRow {
  fecha: string; importe: number; grupo: string | null; categoria: string | null;
}

interface PresupuestoRow {
  anio: number; mes: number; categoria: string; tope: number;
}

const GRUPO_DEFAULT_PCT: Record<GrupoGasto, number> = {
  producto: 28,
  equipo: 32,
  local: 7,
  controlables: 15,
}

export default function TabResumen({
  rowsPeriodo, rowsAll, fechaDesde, fechaHasta, canalesFiltro, periodoLabel, onFiltrarDiaSemana, onNavTab,
}: Props) {
  const navigate = useNavigate()

  /* ── state datos BD ──────────────────────────── */
  const [objetivos, setObjetivos] = useState<ObjetivosVentas>({
    diario: 0, semanal: 0, mensual: 0, anual: 0,
  })
  const [objetivoRatio, setObjetivoRatio] = useState<number>(2.5)
  const [presupuestosGrupo, setPresupuestosGrupo] = useState<Record<GrupoGasto, number>>({
    producto: 0, equipo: 0, local: 0, controlables: 0,
  })
  const [peParams, setPeParams] = useState<PeParams | null>(null)
  const [ingresosM, setIngresosM] = useState<IngresoMensual[]>([])
  const [provisiones, setProvisiones] = useState<Provision[]>([])
  const [gastos, setGastos] = useState<GastoRow[]>([])
  const [presupuestosBD, setPresupuestosBD] = useState<PresupuestoRow[]>([])
  const [datosDemo, setDatosDemo] = useState<boolean>(false)
  const [topDatosDemo, setTopDatosDemo] = useState<boolean>(false)
  const { configCanales, marcasPorCanal, ventasListas } = useNetoContext()
  const [festivos, setFestivos] = useState<Set<string>>(new Set())
  const [frontera, setFrontera] = useState<Record<string, string>>({})
  const [ventasMarca, setVentasMarca] = useState<Array<{ marca: string; neto: number; bruto: number; pedidos: number; fecha: string }>>([])
  const [marcasActivas, setMarcasActivas] = useState<string[]>([])
  const [saldoBanco, setSaldoBanco] = useState<number | null>(null)

  /* ── state UI ──────────────────────────────── */
  const [topTab, setTopTab] = useState<'productos' | 'modificadores'>('productos')
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const isMobile = useEsMovil()
  void isMobile

  const showToast = useCallback((msg: string, type: 'success' | 'warning') => {
    const id = Date.now()
    setToasts(p => [...p, { id, msg, type }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000)
  }, [])
  void showToast

  /* ── config_canales + marcas + liquidaciones reales: precarga centralizada en useNetoContext ─── */

  /* ── saldo REAL de banco (v_caja_mensual, igual que Cashflow) ── */
  useEffect(() => {
    supabase.from('v_caja_mensual').select('saldo_mes').then(({ data }) => {
      const rows = (data ?? []) as { saldo_mes: number | null }[]
      setSaldoBanco(rows.length ? rows.reduce((s, r) => s + (Number(r.saldo_mes) || 0), 0) : null)
    })
  }, [])

  /* ── festivos + frontera de cobro del banco (para deuda de plataformas) ── */
  useEffect(() => {
    supabase.from('festivos').select('fecha').then(({ data }) => {
      const fe = (data ?? []) as { fecha: string }[]
      if (fe.length) setFestivos(new Set(fe.map(x => x.fecha.slice(0, 10))))
    })
    supabase.from('v_frontera_cobro_banco').select('canal,ultima_fecha').then(({ data }) => {
      const f: Record<string, string> = {}
      for (const r of (data ?? []) as { canal: string; ultima_fecha: string }[]) {
        if (r.canal && r.ultima_fecha) f[r.canal] = String(r.ultima_fecha).slice(0, 10)
      }
      setFrontera(f)
    })
  }, [])

  /* ── ventas por marca real (90 días): bruto + pedidos + fecha. Con fallback si no hay 'pedidos'. ── */
  useEffect(() => {
    const hace90 = toLocalDateStr(new Date(Date.now() - 90 * 86400000))
    ;(async () => {
      let rows: Array<{ marca: string; neto: number; bruto: number | null; pedidos?: number | null; fecha_inicio_periodo: string }> = []
      const full = await supabase.from('ventas_plataforma').select('marca,neto,bruto,pedidos,fecha_inicio_periodo').gte('fecha_inicio_periodo', hace90).neq('marca', 'SIN_MARCA')
      if (full.error) {
        const noped = await supabase.from('ventas_plataforma').select('marca,neto,bruto,fecha_inicio_periodo').gte('fecha_inicio_periodo', hace90).neq('marca', 'SIN_MARCA')
        rows = (noped.data ?? []) as Array<{ marca: string; neto: number; bruto: number | null; fecha_inicio_periodo: string }>
      } else {
        rows = (full.data ?? []) as Array<{ marca: string; neto: number; bruto: number | null; pedidos: number | null; fecha_inicio_periodo: string }>
      }
      setVentasMarca(rows.map(v => ({
        marca: v.marca,
        neto: Number(v.neto) || 0,
        bruto: Number(v.bruto) || 0,
        pedidos: Number(v.pedidos) || 0,
        fecha: String(v.fecha_inicio_periodo || '').slice(0, 10),
      })))
    })()
    supabase.from('v_marcas_activas').select('nombre').then(({ data }) => {
      setMarcasActivas(((data as { nombre: string }[]) ?? []).map(x => x.nombre))
    })
  }, [])

  /* ── fetch objetivos ventas ─────────────────── */
  const loadObjetivos = useCallback(async () => {
    const [resObj, resDias] = await Promise.all([
      supabase.from('objetivos').select('tipo,importe').in('tipo', ['diario', 'semanal', 'mensual', 'anual', 'ratio_ingresos_gastos']),
      supabase.from('objetivos_dia_semana').select('dia,importe'),
    ])

    const overrides: Partial<Record<'diario' | 'semanal' | 'mensual' | 'anual', number>> = {}
    let ratio = 2.5
    for (const r of (resObj.data ?? []) as { tipo: string; importe: number }[]) {
      if (r.tipo === 'diario' || r.tipo === 'semanal' || r.tipo === 'mensual' || r.tipo === 'anual') {
        overrides[r.tipo] = Number(r.importe)
      }
      if (r.tipo === 'ratio_ingresos_gastos') {
        ratio = Number(r.importe) || 2.5
      }
    }

    const dias = (resDias.data ?? []) as { dia: number; importe: number }[]
    const findDia = (d: number) => Number(dias.find(x => x.dia === d)?.importe || 0)
    const sumaSemana = dias.reduce((a, d) => a + Number(d.importe || 0), 0)

    const hoyD = new Date()
    const ano = hoyD.getFullYear()
    const mesIdx = hoyD.getMonth()
    const diasEnMes = new Date(ano, mesIdx + 1, 0).getDate()
    const esBis = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0
    const dAno = esBis ? 366 : 365
    const diaActual = hoyD.getDay() === 0 ? 7 : hoyD.getDay()

    const mediaDia = sumaSemana / 7
    const sumaMes = mediaDia * diasEnMes
    const sumaAno = mediaDia * dAno

    const useOverride = (k: 'diario' | 'semanal' | 'mensual' | 'anual') =>
      overrides[k] !== undefined && (overrides[k] as number) > 0

    const obj: ObjetivosVentas = {
      diario:  useOverride('diario')  ? (overrides.diario  as number) : findDia(diaActual),
      semanal: useOverride('semanal') ? (overrides.semanal as number) : sumaSemana,
      mensual: useOverride('mensual') ? (overrides.mensual as number) : sumaMes,
      anual:   useOverride('anual')   ? (overrides.anual   as number) : sumaAno,
    }
    setObjetivos(obj)
    setObjetivoRatio(ratio)
  }, [])

  useEffect(() => { loadObjetivos() }, [loadObjetivos])

  useEffect(() => {
    supabase.from('pe_parametros').select('*').limit(1).maybeSingle().then(({ data }) => {
      if (data) setPeParams(data as PeParams)
    })
  }, [])

  useEffect(() => {
    const hoy = new Date()
    const haceAno = new Date(hoy.getFullYear() - 1, hoy.getMonth(), 1)
    supabase
      .from('ingresos_mensuales')
      .select('anio,mes,canal,tipo,importe,base_imponible')
      .gte('anio', haceAno.getFullYear())
      .then(({ data }) => {
        if (data) setIngresosM(data as IngresoMensual[])
      })
  }, [])

  useEffect(() => {
    const ano = new Date().getFullYear()
    supabase
      .from('gastos')
      .select('fecha,importe,grupo,categoria')
      .gte('fecha', `${ano}-01-01`)
      .then(({ data }) => {
        if (data) setGastos(data as GastoRow[])
      })
  }, [])

  useEffect(() => {
    const ahora = new Date()
    supabase
      .from('presupuestos_mensuales')
      .select('anio,mes,categoria,tope')
      .eq('anio', ahora.getFullYear())
      .eq('mes', ahora.getMonth() + 1)
      .then(({ data }) => {
        if (data) setPresupuestosBD(data as PresupuestoRow[])
      })
  }, [])

  useEffect(() => {
    const ahora = new Date()
    supabase
      .from('objetivos')
      .select('tipo,importe,categoria_codigo,anio,mes')
      .eq('tipo', 'presupuesto_grupo')
      .eq('anio', ahora.getFullYear())
      .eq('mes', ahora.getMonth() + 1)
      .then(({ data }) => {
        if (!data) return
        const out: Record<GrupoGasto, number> = { producto: 0, equipo: 0, local: 0, controlables: 0 }
        for (const r of data as { categoria_codigo: string | null; importe: number }[]) {
          const k = r.categoria_codigo as GrupoGasto | null
          if (k && (k === 'producto' || k === 'equipo' || k === 'local' || k === 'controlables')) {
            out[k] = Number(r.importe) || 0
          }
        }
        setPresupuestosGrupo(out)
      })
  }, [])

  useEffect(() => {
    supabase
      .from('provisiones')
      .select('tipo,periodo,fecha_inicio,fecha_fin,importe,estado')
      .eq('estado', 'pendiente')
      .then(({ data }) => {
        if (data) setProvisiones(data as Provision[])
      })
  }, [])

  /* ── días con datos reales en el periodo (para prorrateo de fees) ── */
  const diasConDatosPeriodo = useMemo(
    () => new Set(rowsPeriodo.filter(r => (r.total_bruto || 0) > 0).map(r => r.fecha)).size,
    [rowsPeriodo]
  )

  /* ── derivar canalStats del periodo ─────────── */
  const canalStats: CanalStat[] = useMemo(() => {
    const filt = canalesFiltro.length > 0
    const ids: Array<CanalStat['id']> = ['uber', 'glovo', 'je', 'web', 'dir']
    const visibles = filt ? ids.filter(id => canalesFiltro.includes(id)) : ids
    const labels: Record<CanalStat['id'], string> = {
      uber: 'Uber Eats', glovo: 'Glovo', je: 'Just Eat', web: 'Web', dir: 'Directa',
    }
    const colores: Record<CanalStat['id'], string> = {
      uber: COLOR.uber, glovo: COLOR.glovo, je: COLOR.je, web: COLOR.webSL, dir: COLOR.directa,
    }
    const totalBruto = rowsPeriodo.reduce((a, r) => a + (r.total_bruto || 0), 0)
    return visibles.map(id => {
      const brutoKey = `${id === 'dir' ? 'directa' : id}_bruto` as keyof RowFacturacion
      const pedKey = `${id === 'dir' ? 'directa' : id}_pedidos` as keyof RowFacturacion
      const bruto = rowsPeriodo.reduce((a, r) => a + (Number(r[brutoKey]) || 0), 0)
      const pedidos = rowsPeriodo.reduce((a, r) => a + (Number(r[pedKey]) || 0), 0)
      const { neto, margenPct } = resolverNeto(id, bruto, pedidos, { modo: 'agregado_canal', marcasPorCanal, fechaDesde, fechaHasta, configCanales, diasConDatos: diasConDatosPeriodo })
      return {
        id, label: labels[id], color: colores[id], bruto, neto, pedidos,
        pct: totalBruto > 0 ? (bruto / totalBruto) * 100 : 0,
        ticket: pedidos > 0 ? bruto / pedidos : 0,
        margen: margenPct,
      }
    })
  }, [rowsPeriodo, canalesFiltro, configCanales, marcasPorCanal, fechaDesde, fechaHasta, diasConDatosPeriodo, ventasListas])

  const ventasPeriodo = useMemo(() => rowsPeriodo.reduce((a, r) => a + (r.total_bruto || 0), 0), [rowsPeriodo])
  const pedidosPeriodo = useMemo(() => rowsPeriodo.reduce((a, r) => a + (r.total_pedidos || 0), 0), [rowsPeriodo])
  const tmBruto = pedidosPeriodo > 0 ? ventasPeriodo / pedidosPeriodo : 0
  const netoEstimado = useMemo(() => canalStats.reduce((a, c) => a + c.neto, 0), [canalStats])
  const tmNeto = pedidosPeriodo > 0 ? netoEstimado / pedidosPeriodo : 0
  const margenNetoReal = ventasPeriodo > 0 ? (netoEstimado / ventasPeriodo) * 100 : 0

  /* ── coste por pedido real: comisión de plataforma + coste de producto ── */
  const costePorPedido = useMemo(() => {
    const comision = pedidosPeriodo > 0 ? (ventasPeriodo - netoEstimado) / pedidosPeriodo : 0
    const fcPct = peParams ? peParams.food_cost_pct / 100 : 0.28
    const producto = pedidosPeriodo > 0 ? (netoEstimado * fcPct) / pedidosPeriodo : 0
    return { comision, producto, total: comision + producto }
  }, [ventasPeriodo, netoEstimado, pedidosPeriodo, peParams])

  /* ── deuda de plataformas a hoy (misma fuente que Cashflow) ── */
  const porCobrar: PorCobrarResult = useMemo(
    () => calcPorCobrar(rowsAll as unknown as Parameters<typeof calcPorCobrar>[0], { config: configCanales, marcasPorCanal, festivos, frontera }),
    [rowsAll, configCanales, marcasPorCanal, festivos, frontera]
  )

  /* ── reparto por SERVICIO (almuerzo / cenas) del periodo ── */
  const { servicios, serviciosHay } = useMemo(() => {
    const rs = rowsPeriodo as Array<RowFacturacion & { servicio?: string | null }>
    const hay = rs.some(r => r.servicio != null && r.servicio !== '' && r.servicio !== 'TODO')
    if (!hay) return { servicios: [] as RepartoRow[], serviciosHay: false }
    const map: Record<string, { bruto: number; pedidos: number }> = {}
    for (const r of rs) {
      const raw = (r.servicio || '').toString()
      if (!raw) continue
      const k = SERV_LABEL[raw] || raw
      if (!map[k]) map[k] = { bruto: 0, pedidos: 0 }
      map[k].bruto += r.total_bruto || 0
      map[k].pedidos += r.total_pedidos || 0
    }
    const totalB = Object.values(map).reduce((a, m) => a + m.bruto, 0)
    const ratioNeto = ventasPeriodo > 0 && netoEstimado > 0 ? netoEstimado / ventasPeriodo : 0.7
    const arr: RepartoRow[] = Object.entries(map)
      .map(([nombre, s]) => ({ nombre, bruto: s.bruto, neto: s.bruto * ratioNeto, pedidos: s.pedidos, pct: totalB > 0 ? (s.bruto / totalB) * 100 : 0 }))
      .sort((a, b) => b.bruto - a.bruto)
    return { servicios: arr, serviciosHay: arr.length > 0 }
  }, [rowsPeriodo, ventasPeriodo, netoEstimado])

  /* ── ranking de MARCAS reales (ventas_plataforma 90d): bruto, pedidos, TM bruto, serie + variación ── */
  const { marcasReales, marcasRealesHay } = useMemo(() => {
    const tot: Record<string, { neto: number; bruto: number; ped: number }> = {}
    const porFecha: Record<string, Record<string, number>> = {}
    const fechasSet = new Set<string>()
    for (const v of ventasMarca) {
      if (!tot[v.marca]) tot[v.marca] = { neto: 0, bruto: 0, ped: 0 }
      const e = tot[v.marca]
      e.neto += v.neto || 0
      e.bruto += v.bruto || 0
      e.ped += v.pedidos || 0
      if (v.fecha) {
        if (!porFecha[v.marca]) porFecha[v.marca] = {}
        porFecha[v.marca][v.fecha] = (porFecha[v.marca][v.fecha] || 0) + (v.bruto || 0)
        fechasSet.add(v.fecha)
      }
    }
    const fechas = [...fechasSet].sort()
    const base = marcasActivas.length ? marcasActivas : Object.keys(tot)
    const totalB = base.reduce((a, mm) => a + (tot[mm]?.bruto || 0), 0)
    const arr: MarcaRealRow[] = base
      .map(nombre => {
        const e = tot[nombre] || { neto: 0, bruto: 0, ped: 0 }
        const serie = fechas.map(f => porFecha[nombre]?.[f] || 0)
        const noCero = serie.filter(x => x > 0)
        const varPct = noCero.length >= 2 && noCero[noCero.length - 2] > 0
          ? ((noCero[noCero.length - 1] - noCero[noCero.length - 2]) / noCero[noCero.length - 2]) * 100
          : null
        return {
          nombre,
          neto: e.neto,
          bruto: e.bruto,
          pedidos: e.ped,
          tmBruto: e.ped > 0 ? e.bruto / e.ped : 0,
          pct: totalB > 0 ? (e.bruto / totalB) * 100 : 0,
          serie,
          varPct,
        }
      })
      .sort((a, b) => b.bruto - a.bruto)
    return { marcasReales: arr, marcasRealesHay: arr.some(mm => mm.bruto > 0) }
  }, [ventasMarca, marcasActivas])

  const { variacionVentas, variacionPedidos, variacionTM } = useMemo(() => {
    const { desde, hasta } = rangoPrevio(fechaDesde, fechaHasta)
    const prevRows = rowsAll.filter(r => r.fecha >= desde && r.fecha <= hasta)
    const prevVentas  = prevRows.reduce((a, r) => a + (r.total_bruto || 0), 0)
    const prevPedidos = prevRows.reduce((a, r) => a + (r.total_pedidos || 0), 0)
    const prevTm = prevPedidos > 0 ? prevVentas / prevPedidos : 0
    return {
      variacionVentas:  prevVentas  > 0 ? ((ventasPeriodo  - prevVentas)  / prevVentas)  * 100 : null,
      variacionPedidos: prevPedidos > 0 ? ((pedidosPeriodo - prevPedidos) / prevPedidos) * 100 : null,
      variacionTM:      prevTm      > 0 ? ((tmBruto        - prevTm)      / prevTm)      * 100 : null,
    }
  }, [rowsAll, fechaDesde, fechaHasta, ventasPeriodo, pedidosPeriodo, tmBruto])

  const ventasSemana = useMemo(() => {
    const ws = startOfWeekStr()
    const monday = parseLocalDate(ws)
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
    const we = toLocalDateStr(sunday)
    return rowsAll.filter(r => r.fecha >= ws && r.fecha <= we).reduce((a, r) => a + (r.total_bruto || 0), 0)
  }, [rowsAll])
  const ventasMes = useMemo(() => {
    const mm = toLocalDateStr(new Date()).slice(0, 7)
    return rowsAll.filter(r => r.fecha.startsWith(mm)).reduce((a, r) => a + (r.total_bruto || 0), 0)
  }, [rowsAll])
  const ventasAno = useMemo(() => {
    const aa = toLocalDateStr(new Date()).slice(0, 4)
    return rowsAll.filter(r => r.fecha.startsWith(aa)).reduce((a2, r) => a2 + (r.total_bruto || 0), 0)
  }, [rowsAll])

  /* ── proyección de cierre de mes: a este ritmo, dónde cerramos vs objetivo ── */
  const proyeccionMes = useMemo(() => {
    const hoy = new Date()
    const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
    const diaActual = hoy.getDate()
    const ritmo = diaActual > 0 ? ventasMes / diaActual : 0
    const cierre = ritmo * diasMes
    const objetivo = objetivos.mensual
    return {
      cierre,
      objetivo,
      pctObjetivo: objetivo > 0 ? (cierre / objetivo) * 100 : 0,
      diasMes,
      diaActual,
    }
  }, [ventasMes, objetivos.mensual])

  const serieMes = useMemo(() => {
    const mm = toLocalDateStr(new Date()).slice(0, 7)
    const map = new Map<string, number>()
    for (const r of rowsAll) { if (r.fecha.startsWith(mm)) map.set(r.fecha, (map.get(r.fecha) || 0) + (r.total_bruto || 0)) }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(e => e[1])
  }, [rowsAll])

  const nSemana = isoWeek(new Date())
  const inicioSemStr = startOfWeekStr()
  const inicioSem = parseLocalDate(inicioSemStr)
  const finSem = new Date(inicioSem); finSem.setDate(inicioSem.getDate() + 6)
  const fmtDM = (dt: Date) => dt.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  const periodoRango = `${fmtDM(fechaDesde)} – ${fmtDM(fechaHasta)}`
  const semanaLabel = `Semana ${nSemana}`
  const semanaRango = `${fmtDM(inicioSem)} – ${fmtDM(finSem)}`
  const nombreMesRaw = new Date().toLocaleDateString('es-ES', { month: 'long' })
  const mesLabel = nombreMesRaw.charAt(0).toUpperCase() + nombreMesRaw.slice(1)
  const ano = new Date().getFullYear()

  const netosReales = useMemo(() => {
    const fIni = fechaDesde.getFullYear() * 100 + (fechaDesde.getMonth() + 1)
    const fFin = fechaHasta.getFullYear() * 100 + (fechaHasta.getMonth() + 1)
    return ingresosM
      .filter(i => i.tipo === 'neto')
      .filter(i => {
        const k = i.anio * 100 + i.mes
        return k >= fIni && k <= fFin
      })
      .reduce((a, i) => a + (Number(i.importe) || 0), 0)
  }, [ingresosM, fechaDesde, fechaHasta])

  const totalGastosPeriodo = useMemo(() => {
    const desde = toLocalDateStr(fechaDesde)
    const hasta = toLocalDateStr(fechaHasta)
    return gastos
      .filter(g => g.fecha >= desde && g.fecha <= hasta)
      .reduce((a, g) => a + (Number(g.importe) || 0), 0)
  }, [gastos, fechaDesde, fechaHasta])

  const { ebitda, ebitdaPct, primeCostPct } = useMemo(() => {
    const cogs = peParams ? netoEstimado * (peParams.food_cost_pct / 100) : netoEstimado * 0.28
    const sueldosMes = peParams ? (peParams.sueldo_ruben + peParams.sueldo_emilio + peParams.sueldos_empleados + peParams.ss_empresa + peParams.ss_autonomos) : 0
    const dias = Math.max(1, Math.round((fechaHasta.getTime() - fechaDesde.getTime()) / 86400000) + 1)
    const labor = (sueldosMes / 30) * dias
    const pc = netoEstimado > 0 ? ((cogs + labor) / netoEstimado) * 100 : 0
    const eb = netoEstimado - cogs - labor - (totalGastosPeriodo - cogs)
    const ebPct = netoEstimado > 0 ? (eb / netoEstimado) * 100 : 0
    return { ebitda: eb, ebitdaPct: ebPct, primeCostPct: pc }
  }, [netoEstimado, totalGastosPeriodo, peParams, fechaDesde, fechaHasta])

  const gruposData = useMemo(() => {
    const desde = toLocalDateStr(fechaDesde)
    const hasta = toLocalDateStr(fechaHasta)
    const rows = gastos.filter(g => g.fecha >= desde && g.fecha <= hasta)
    const sumPorGrupo: Record<string, number> = {}
    for (const g of rows) {
      const key = (g.grupo || '').toUpperCase()
      sumPorGrupo[key] = (sumPorGrupo[key] || 0) + (Number(g.importe) || 0)
    }
    const producto = sumPorGrupo['PRODUCTO'] || 0
    const equipo = sumPorGrupo['RRHH'] || 0
    const local = (sumPorGrupo['ALQUILER'] || 0) + (sumPorGrupo['SUMINISTROS'] || 0)
    const controlables = (sumPorGrupo['ADMIN_GENERALES'] || 0) + (sumPorGrupo['MARKETING'] || 0) + (sumPorGrupo['INTERNET_VENTAS'] || 0)

    function presFromBD(prefijos: string[]): number {
      return presupuestosBD
        .filter(p => prefijos.some(pr => p.categoria.startsWith(pr)))
        .reduce((a, p) => a + (Number(p.tope) || 0), 0)
    }
    const presProducto     = presupuestosGrupo.producto     || presFromBD(['2.11.', '2.12.', '2.13.'])
    const presEquipo       = presupuestosGrupo.equipo       || presFromBD(['2.21.', '2.22.'])
    const presLocal        = presupuestosGrupo.local        || presFromBD(['2.31.'])
    const presControlables = presupuestosGrupo.controlables || presFromBD(['2.41.', '2.42.', '2.43.', '2.44.'])

    const pctNeto = (g: number) => netoEstimado > 0 ? (g / netoEstimado) * 100 : 0
    return {
      producto:     { gasto: producto,     presupuesto: presProducto,     pctSobreNetos: pctNeto(producto)     || GRUPO_DEFAULT_PCT.producto },
      equipo:       { gasto: equipo,       presupuesto: presEquipo,       pctSobreNetos: pctNeto(equipo)       || GRUPO_DEFAULT_PCT.equipo },
      local:        { gasto: local,        presupuesto: presLocal,        pctSobreNetos: pctNeto(local)        || GRUPO_DEFAULT_PCT.local },
      controlables: { gasto: controlables, presupuesto: presControlables, pctSobreNetos: pctNeto(controlables) || GRUPO_DEFAULT_PCT.controlables },
    }
  }, [gastos, presupuestosBD, presupuestosGrupo, netoEstimado, fechaDesde, fechaHasta])

  const diasPico: DiaPico[] = useMemo(() => {
    const acum = [0, 0, 0, 0, 0, 0, 0]
    for (const r of rowsPeriodo) {
      const d = parseLocalDate(r.fecha)
      const idx = (d.getDay() + 6) % 7
      acum[idx] += r.total_bruto || 0
    }
    return acum.map((v, i) => ({ idx: i, nombre: NOMBRES_DIAS[i], valor: v, color: COLORES_DIAS[i] }))
  }, [rowsPeriodo])
  const mediaDiariaPico = useMemo(() => {
    const validos = diasPico.filter(d => d.valor > 0)
    if (validos.length === 0) return 0
    return validos.reduce((a, d) => a + d.valor, 0) / validos.length
  }, [diasPico])

  const gastosFijosMes = useMemo(() => {
    if (!peParams) return 0
    return peParams.alquiler_local + peParams.sueldo_ruben + peParams.sueldo_emilio + peParams.sueldos_empleados +
      peParams.ss_empresa + peParams.ss_autonomos + peParams.gestoria + peParams.luz + peParams.agua + peParams.gas +
      peParams.telefono + peParams.internet + peParams.hosting_software + peParams.seguros + peParams.licencias +
      peParams.think_paladar + peParams.otros_fijos
  }, [peParams])

  const saldoData = useMemo(() => {
    if (gastos.length === 0 && rowsAll.length === 0) {
      return { saldoHoy: 0, cobros7d: 0, pagos7d: 0, cobros30d: 0, pagos30d: 0 }
    }
    const hoy = new Date()
    const hace7 = new Date(hoy); hace7.setDate(hoy.getDate() - 7)
    const hace30 = new Date(hoy); hace30.setDate(hoy.getDate() - 30)
    const desde7  = toLocalDateStr(hace7)
    const desde30 = toLocalDateStr(hace30)
    const hasta = toLocalDateStr(hoy)

    function netoRows(d1: string, d2: string, fIni: Date, fFin: Date): number {
      const rs = rowsAll.filter(r => r.fecha >= d1 && r.fecha <= d2)
      const diasDatos = new Set(rs.filter(r => (r.total_bruto || 0) > 0).map(r => r.fecha)).size
      const ids: Array<CanalStat['id']> = ['uber', 'glovo', 'je', 'web', 'dir']
      let n = 0
      for (const id of ids) {
        const bk = `${id === 'dir' ? 'directa' : id}_bruto` as keyof RowFacturacion
        const pk = `${id === 'dir' ? 'directa' : id}_pedidos` as keyof RowFacturacion
        const bruto = rs.reduce((a, r) => a + (Number(r[bk]) || 0), 0)
        const pedidos = rs.reduce((a, r) => a + (Number(r[pk]) || 0), 0)
        n += resolverNeto(id, bruto, pedidos, { modo: 'agregado_canal', marcasPorCanal, fechaDesde: fIni, fechaHasta: fFin, configCanales, diasConDatos: diasDatos }).neto
      }
      return n
    }
    const cobros7d = netoRows(desde7, hasta, hace7, hoy)
    const cobros30d = netoRows(desde30, hasta, hace30, hoy)

    // Pagos previstos = costes fijos configurados (prorrateo mensual) + provisiones
    // con vencimiento real en la ventana. Sin factores heurísticos sobre gastos pasados.
    const hoy0 = new Date(hoy); hoy0.setHours(0, 0, 0, 0)
    const provEnVentana = (dias: number): number => {
      const limite = new Date(hoy0); limite.setDate(hoy0.getDate() + dias)
      return provisiones
        .filter(p => { const f = parseLocalDate(p.fecha_fin); return f >= hoy0 && f <= limite })
        .reduce((a, p) => a + (Number(p.importe) || 0), 0)
    }
    const fijosMes = gastosFijosMes || (peParams ? 0 : 3500)
    const pagos7d  = (fijosMes / 30) * 7 + provEnVentana(7)
    const pagos30d = fijosMes + provEnVentana(30)

    const saldoHoy = Math.max(0, cobros30d - pagos30d) + (peParams?.caja_minima_verde ?? 0)
    return { saldoHoy, cobros7d, pagos7d, cobros30d, pagos30d }
  }, [rowsAll, gastos, peParams, configCanales, marcasPorCanal, gastosFijosMes, provisiones, ventasListas])

  const ratioActual = gastosFijosMes > 0 ? netoEstimado / gastosFijosMes : 0

  const peCalc = useMemo(() => {
    if (!peParams || gastosFijosMes <= 0) {
      return {
        peBruto: 0, peNeto: 0, acumulado: ventasMes,
        pctProgreso: 0, diaVerdeEstimado: null as { fecha: string; diaSemana: string } | null,
        facturacionDia: 0, pedidosDia: 0, tmActual: tmBruto,
        realFacDia: 0, realPedDia: 0,
      }
    }
    const peNeto = gastosFijosMes
    const bruto2neto = ventasMes > 0 && netoEstimado > 0 ? (netoEstimado / ventasMes) : 0.7
    const peBruto = bruto2neto > 0 ? peNeto / bruto2neto : peNeto
    const pctProgreso = peBruto > 0 ? Math.round((ventasMes / peBruto) * 100) : 0

    const hoy = new Date()
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
    const diasMes = finMes.getDate()
    const diasOpHoy = hoy.getDate()
    const ritmoDiario = diasOpHoy > 0 ? ventasMes / diasOpHoy : 0
    const facturacionDia = ritmoDiario
    const pedidosDia = pedidosPeriodo > 0 && rowsPeriodo.length > 0 ? Math.round(pedidosPeriodo / rowsPeriodo.length) : 0
    const tmActual = tmBruto
    const realFacDia = ritmoDiario
    const realPedDia = pedidosDia

    let diaVerdeEstimado: { fecha: string; diaSemana: string } | null = null
    if (ritmoDiario > 0 && peBruto > ventasMes) {
      const restan = peBruto - ventasMes
      const diasRestan = Math.ceil(restan / ritmoDiario)
      const fechaVerde = new Date(hoy)
      fechaVerde.setDate(hoy.getDate() + diasRestan)
      if (fechaVerde <= finMes) {
        const dd = String(fechaVerde.getDate()).padStart(2, '0')
        const mm = String(fechaVerde.getMonth() + 1).padStart(2, '0')
        const yy = String(fechaVerde.getFullYear()).slice(2)
        diaVerdeEstimado = { fecha: `${dd}/${mm}/${yy}`, diaSemana: NOMBRES_DIAS_CORTOS[(fechaVerde.getDay() + 6) % 7] }
      } else {
        diaVerdeEstimado = { fecha: '❌ no cubre este mes', diaSemana: '' }
      }
    } else if (ventasMes >= peBruto) {
      diaVerdeEstimado = { fecha: 'Alcanzado', diaSemana: '✓' }
    }
    void diasMes
    return { peBruto, peNeto, acumulado: ventasMes, pctProgreso, diaVerdeEstimado, facturacionDia, pedidosDia, tmActual, realFacDia, realPedDia }
  }, [peParams, gastosFijosMes, ventasMes, netoEstimado, pedidosPeriodo, rowsPeriodo.length, tmBruto])

  const { totalAGuardar, provIVA, provIRPF, proximosPagos } = useMemo(() => {
    const hoyProv = new Date()
    const mesActual = `${hoyProv.getFullYear()}-${String(hoyProv.getMonth() + 1).padStart(2, '0')}`
    const iva  = provisiones.filter(p => p.tipo.startsWith('IVA') && p.periodo.startsWith(mesActual)).reduce((a, p) => a + (Number(p.importe) || 0), 0)
    const irpf = provisiones.filter(p => p.tipo.startsWith('IRPF') && p.periodo.startsWith(mesActual)).reduce((a, p) => a + (Number(p.importe) || 0), 0)

    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const en30 = new Date(hoy); en30.setDate(hoy.getDate() + 30)
    const items: PagoProximoItem[] = []
    for (const p of provisiones) {
      const f = parseLocalDate(p.fecha_fin)
      if (f >= hoy && f <= en30) {
        items.push({ concepto: p.tipo, fecha: p.periodo, importe: Number(p.importe) })
      }
    }
    if (peParams) {
      if (peParams.alquiler_local) items.push({ concepto: 'Alquiler local', fecha: 'mensual', importe: peParams.alquiler_local })
      if (peParams.gestoria)       items.push({ concepto: 'Gestoría',        fecha: 'mensual', importe: peParams.gestoria })
      if (peParams.luz)            items.push({ concepto: 'Luz',             fecha: 'mensual', importe: peParams.luz })
      if (peParams.hosting_software) items.push({ concepto: 'Hosting/SW',    fecha: 'mensual', importe: peParams.hosting_software })
    }
    items.sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
    return { totalAGuardar: iva + irpf, provIVA: iva, provIRPF: irpf, proximosPagos: items }
  }, [provisiones, peParams])

  // Top ventas · pestaña Productos: ranking real desde lineas_producto_operativa
  // (detalle de pedidos de plataforma ya volcado por los parsers de Uber/Glovo/Just
  // Eat). La pestaña Modificadores no tiene fuente real hoy (el POS no está
  // conectado) y se deja vacía a propósito, sin inventar datos.
  const [topItemsProductos, setTopItemsProductos] = useState<TopVentaItem[]>([])
  useEffect(() => {
    if (topTab !== 'productos') return
    const desde = toLocalDateStr(fechaDesde)
    const hasta = toLocalDateStr(fechaHasta)
    const CANAL_MAP: Record<string, TopVentaItem['canal']> = { uber: 'uber', glovo: 'glovo', just_eat: 'je' }
    supabase
      .from('lineas_producto_operativa')
      .select('plataforma, producto, cantidad, importe, tipo_linea')
      .gte('fecha', desde).lte('fecha', hasta)
      .then(({ data, error }) => {
        if (error || !data) { setTopItemsProductos([]); return }
        const agg = new Map<string, { producto: string; canal: TopVentaItem['canal']; pedidos: number; importe: number }>()
        for (const r of data) {
          if (r.tipo_linea && r.tipo_linea !== 'producto') continue // no mezclar ads/promo/prime en el ranking de productos
          const canal = CANAL_MAP[r.plataforma as string]
          if (!canal) continue
          const key = `${canal}||${r.producto}`
          const prev = agg.get(key)
          if (prev) { prev.pedidos += Number(r.cantidad) || 0; prev.importe += Number(r.importe) || 0 }
          else agg.set(key, { producto: r.producto as string, canal, pedidos: Number(r.cantidad) || 0, importe: Number(r.importe) || 0 })
        }
        const ranked: TopVentaItem[] = Array.from(agg.values())
          .sort((a, b) => b.importe - a.importe)
          .slice(0, 10)
          .map((x, i) => ({ ranking: i + 1, ...x }))
        setTopItemsProductos(ranked)
      })
  }, [fechaDesde, fechaHasta, topTab])

  const topItems: TopVentaItem[] = topTab === 'productos' ? topItemsProductos : []

  useEffect(() => {
    setTopDatosDemo(false)
  }, [])

  /* ── cache anti-parpadeo: recuerda que ya hubo datos ── */
  useEffect(() => {
    if (rowsPeriodo.length > 0 || rowsAll.length > 0) {
      try { localStorage.setItem('binagre_resumen_visto', '1') } catch { /* noop */ }
    }
  }, [rowsPeriodo.length, rowsAll.length])

  const dataInicializadaRef = useRef(false)
  useEffect(() => {
    if (dataInicializadaRef.current) return
    dataInicializadaRef.current = true
    let visto = false
    try { visto = localStorage.getItem('binagre_resumen_visto') === '1' } catch { visto = false }
    if (rowsAll.length === 0 && gastos.length === 0 && !visto) {
      setDatosDemo(true)
    }
  }, [rowsAll.length, gastos.length])

  async function saveObjetivoVenta(tipo: 'semanal' | 'mensual' | 'anual', valor: number | null) {
    if (valor == null) {
      await supabase.from('objetivos').delete().eq('tipo', tipo)
      await loadObjetivos()
      return
    }
    setObjetivos(p => ({ ...p, [tipo]: valor }))
    await supabase.from('objetivos').upsert({ tipo, importe: valor }, { onConflict: 'tipo' })
    await loadObjetivos()
  }

  async function saveObjetivoRatio(valor: number | null) {
    if (valor == null) {
      const { data } = await supabase.from('objetivos').select('importe').eq('tipo', 'ratio_ingresos_gastos').maybeSingle()
      if (data) setObjetivoRatio(Number((data as { importe: number }).importe))
      return
    }
    setObjetivoRatio(valor)
    await supabase.from('objetivos').upsert({ tipo: 'ratio_ingresos_gastos', importe: valor }, { onConflict: 'tipo' })
  }

  async function savePresupuestoGrupo(grupo: GrupoGasto, valor: number | null) {
    if (valor == null) return
    setPresupuestosGrupo(p => ({ ...p, [grupo]: valor }))
    const ahora = new Date()
    await supabase.from('objetivos').upsert(
      { tipo: 'presupuesto_grupo', categoria_codigo: grupo, anio: ahora.getFullYear(), mes: ahora.getMonth() + 1, importe: valor },
      { onConflict: 'tipo,categoria_codigo,anio,mes' }
    )
  }

  /* ── métricas para frases-insight, alertas y canal más rentable ── */
  const mejorCanalO = canalStats.filter(c => c.pedidos > 0).map(c => ({ label: c.label, np: c.neto / c.pedidos })).sort((a, b) => b.np - a.np)[0]
  const diasV = diasPico.filter(x => x.valor > 0)
  const diaFuerteO = diasV.length ? diasV.reduce((a, x) => (x.valor > a.valor ? x : a)) : null
  const diaFlojoO = diasV.length ? diasV.reduce((a, x) => (x.valor < a.valor ? x : a)) : null
  const metricas: MetricasInsight = {
    comisionPct: ventasPeriodo > 0 ? (1 - netoEstimado / ventasPeriodo) * 100 : 0,
    webPct: canalStats.find(c => c.id === 'web')?.pct ?? 0,
    margenNetoPct: margenNetoReal,
    primeCostPct,
    foodCostPct: gruposData.producto.pctSobreNetos,
    laborPct: gruposData.equipo.pctSobreNetos,
    variacionVentas, variacionPedidos, variacionTM,
    ratioActual, ratioObjetivo: objetivoRatio, ratioGap: ratioActual - objetivoRatio,
    pePctProgreso: peCalc.pctProgreso, faltaPE: Math.max(0, peCalc.peBruto - peCalc.acumulado),
    ebitda, tmBruto,
    mejorCanal: mejorCanalO?.label ?? '—', mejorCanalNetoPed: mejorCanalO?.np ?? 0,
    diaFlojo: diaFlojoO?.nombre ?? '—', diaFlojoValor: diaFlojoO?.valor ?? 0,
    diaFuerte: diaFuerteO?.nombre ?? '—', diaFuerteValor: diaFuerteO?.valor ?? 0,
  }
  const sameDay = toLocalDateStr(fechaDesde) === toLocalDateStr(fechaHasta)
  const esHoy = sameDay && toLocalDateStr(fechaHasta) === toLocalDateStr(new Date())
  const diario = esHoy ? { objetivo: objetivos.diario, real: ventasPeriodo } : null

  void navigate

  return (
    <div style={{ color: COLOR.textPri, fontFamily: LEXEND, marginTop: 14 }}>

      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: t.type === 'success' ? COLOR.verde : COLOR.ambar,
            color: BLANCO, padding: '8px 16px', border: '3px solid #140f08', fontSize: 13, fontFamily: LEXEND,
            boxShadow: '4px 4px 0 #140f08',
          }}>{t.msg}</div>
        ))}
      </div>

      <ResumenLanding
        datosDemo={datosDemo}
        periodoLabel={periodoLabel}
        periodoRango={periodoRango}
        semanaLabel={semanaLabel}
        semanaRango={semanaRango}
        mesLabel={mesLabel}
        anoLabel={ano}
        ventasPeriodo={ventasPeriodo}
        netoEstimado={netoEstimado}
        margenNetoReal={margenNetoReal}
        variacionVentas={variacionVentas}
        variacionPedidos={variacionPedidos}
        variacionTM={variacionTM}
        pedidosPeriodo={pedidosPeriodo}
        tmBruto={tmBruto}
        tmNeto={tmNeto}
        ebitda={ebitda}
        ebitdaPct={ebitdaPct}
        primeCostPct={primeCostPct}
        costePorPedido={costePorPedido}
        cierreMes={proyeccionMes.cierre}
        objetivoMes={proyeccionMes.objetivo}
        serie={serieMes}
        ventasSemana={ventasSemana}
        ventasMes={ventasMes}
        ventasAno={ventasAno}
        objetivos={objetivos}
        diario={diario}
        canalStats={canalStats}
        grupos={gruposData}
        diasPico={diasPico}
        mediaDiariaPico={mediaDiariaPico}
        saldo={saldoData}
        saldoBanco={saldoBanco}
        ratioActual={ratioActual}
        objetivoRatio={objetivoRatio}
        gastosFijosMes={gastosFijosMes}
        gastosReales={totalGastosPeriodo}
        netosReales={netosReales}
        pe={{ peBruto: peCalc.peBruto, acumulado: peCalc.acumulado, pctProgreso: peCalc.pctProgreso, faltan: Math.max(0, peCalc.peBruto - peCalc.acumulado), diaVerdeEstimado: peCalc.diaVerdeEstimado, realFacDia: peCalc.realFacDia, realPedDia: peCalc.realPedDia }}
        provisiones={{ totalAGuardar, provIVA, provIRPF, proximosPagos }}
        porCobrar={porCobrar}
        topItems={topItems}
        topDatosDemo={topDatosDemo}
        topTab={topTab}
        onTopTab={setTopTab}
        servicios={servicios}
        serviciosHay={serviciosHay}
        marcasReales={marcasReales}
        marcasRealesHay={marcasRealesHay}
        metricas={metricas}
        onSaveObjetivoVenta={saveObjetivoVenta}
        onSaveObjetivoRatio={saveObjetivoRatio}
        onSavePresupuestoGrupo={savePresupuestoGrupo}
        onFiltrarDiaSemana={onFiltrarDiaSemana}
        onNavTab={onNavTab}
      />
    </div>
  )
}
