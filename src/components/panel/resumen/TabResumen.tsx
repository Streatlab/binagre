/**
 * Tab Resumen v2 — Panel Global
 * Implementación según .claude/plans/spec-panel-resumen-v2.md
 * Wrapper light (#f5f3ef) independiente del modo dark del ERP.
 */

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { calcNetoPorCanal } from '@/lib/panel/calcNetoPlataforma'
import { COLOR, LEXEND, row3 } from './tokens'
import CardVentas from './CardVentas'
import CardPedidosTM from './CardPedidosTM'
import CardResultadoPeriodo from './CardResultadoPeriodo'
import ColFacturacionCanal from './ColFacturacionCanal'
import ColGruposGasto, { type GrupoGasto } from './ColGruposGasto'
import ColDiasPico, { type DiaPico } from './ColDiasPico'
import CardSaldo from './CardSaldo'
import CardRatio from './CardRatio'
import CardPE from './CardPE'
import CardProvisiones from './CardProvisiones'
import CardPendientesSubir from './CardPendientesSubir'
import CardTopVentas from './CardTopVentas'
import type {
  RowFacturacion, CanalStat, ObjetivosVentas, PagoProximoItem,
  TareaPendienteItem, TopVentaItem,
} from './types'

interface Props {
  rowsPeriodo: RowFacturacion[]
  rowsAll: RowFacturacion[]
  fechaDesde: Date
  fechaHasta: Date
  canalesFiltro: string[]
  onFiltrarDiaSemana?: (idxDow: number) => void
}

interface ToastMsg { id: number; msg: string; type: 'success' | 'warning' }

const NOMBRES_DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const COLORES_DIAS = [
  COLOR.diaLun, COLOR.diaMar, COLOR.diaMie, COLOR.diaJue,
  COLOR.diaVie, COLOR.diaSab, COLOR.diaDom,
]
const NOMBRES_DIAS_CORTOS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

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
  producto: 28,     // food cost banda 25-30%
  equipo: 32,
  local: 7,
  controlables: 15,
}

export default function TabResumen({
  rowsPeriodo, rowsAll, fechaDesde, fechaHasta, canalesFiltro, onFiltrarDiaSemana,
}: Props) {
  const navigate = useNavigate()

  /* ── state datos BD ──────────────────────────── */
  const [objetivos, setObjetivos] = useState<ObjetivosVentas>({
    diario: 700, semanal: 5000, mensual: 20000, anual: 240000,
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
  const [tareas, setTareas] = useState<TareaPendienteItem[]>([])
  const [datosDemo, setDatosDemo] = useState<boolean>(false)
  const [topDatosDemo, setTopDatosDemo] = useState<boolean>(false)

  /* ── state UI ──────────────────────────────── */
  const [topTab, setTopTab] = useState<'productos' | 'modificadores'>('productos')
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 1024)

  const showToast = useCallback((msg: string, type: 'success' | 'warning') => {
    const id = Date.now()
    setToasts(p => [...p, { id, msg, type }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000)
  }, [])

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  /* ── fetch objetivos ventas ─────────────────── */
  useEffect(() => {
    supabase.from('objetivos').select('tipo,importe').in('tipo', ['diario', 'semanal', 'mensual', 'anual', 'ratio_ingresos_gastos']).then(({ data }) => {
      if (!data) return
      const obj: ObjetivosVentas = { diario: 700, semanal: 5000, mensual: 20000, anual: 240000 }
      let ratio = 2.5
      for (const r of data as { tipo: string; importe: number }[]) {
        if (r.tipo === 'diario' || r.tipo === 'semanal' || r.tipo === 'mensual' || r.tipo === 'anual') {
          obj[r.tipo] = Number(r.importe)
        }
        if (r.tipo === 'ratio_ingresos_gastos') {
          ratio = Number(r.importe) || 2.5
        }
      }
      setObjetivos(obj)
      setObjetivoRatio(ratio)
    })
  }, [])

  /* ── fetch pe_parametros ────────────────────── */
  useEffect(() => {
    supabase.from('pe_parametros').select('*').limit(1).maybeSingle().then(({ data }) => {
      if (data) setPeParams(data as PeParams)
    })
  }, [])

  /* ── fetch ingresos_mensuales (rolling 12m) ─── */
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

  /* ── fetch gastos del año actual ────────────── */
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

  /* ── fetch presupuestos mensuales actuales ──── */
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

  /* ── fetch presupuestos por grupo (objetivos) ─ */
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

  /* ── fetch provisiones pendientes ───────────── */
  useEffect(() => {
    supabase
      .from('provisiones')
      .select('tipo,periodo,fecha_inicio,fecha_fin,importe,estado')
      .eq('estado', 'pendiente')
      .then(({ data }) => {
        if (data) setProvisiones(data as Provision[])
      })
  }, [])

  /* ── fetch tareas pendientes + tareas_periodicas ─ */
  useEffect(() => {
    supabase
      .from('tareas_pendientes')
      .select('id, fecha_esperada, estado, tareas_periodicas(nombre)')
      .neq('estado', 'cumplida')
      .order('fecha_esperada', { ascending: true })
      .then(({ data }) => {
        if (!data) return
        const hoy = new Date()
        hoy.setHours(0, 0, 0, 0)
        const items: TareaPendienteItem[] = (data as unknown as Array<{
          id: string; fecha_esperada: string; estado: string;
          tareas_periodicas: { nombre: string } | { nombre: string }[] | null
        }>).map((r) => {
          const tp = Array.isArray(r.tareas_periodicas) ? r.tareas_periodicas[0] : r.tareas_periodicas
          const fecha = parseLocalDate(r.fecha_esperada)
          fecha.setHours(0, 0, 0, 0)
          const diff = Math.round((fecha.getTime() - hoy.getTime()) / 86400000)
          return {
            id: r.id,
            concepto: tp?.nombre ?? 'Tarea',
            fechaEsperada: r.fecha_esperada,
            diasOffset: diff,
          }
        })
        setTareas(items)
      })
  }, [])

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
      const { neto, margenPct } = calcNetoPorCanal(id, bruto, pedidos)
      return {
        id, label: labels[id], color: colores[id], bruto, neto, pedidos,
        pct: totalBruto > 0 ? (bruto / totalBruto) * 100 : 0,
        ticket: pedidos > 0 ? bruto / pedidos : 0,
        margen: margenPct,
      }
    })
  }, [rowsPeriodo, canalesFiltro])

  const ventasPeriodo = useMemo(() => rowsPeriodo.reduce((a, r) => a + (r.total_bruto || 0), 0), [rowsPeriodo])
  const pedidosPeriodo = useMemo(() => rowsPeriodo.reduce((a, r) => a + (r.total_pedidos || 0), 0), [rowsPeriodo])
  const tmBruto = pedidosPeriodo > 0 ? ventasPeriodo / pedidosPeriodo : 0
  const netoEstimado = useMemo(() => canalStats.reduce((a, c) => a + c.neto, 0), [canalStats])
  const tmNeto = pedidosPeriodo > 0 ? netoEstimado / pedidosPeriodo : 0

  /* ── deltas vs periodo anterior ─────────────── */
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

  /* ── ventas semanal/mensual/anual ───────────── */
  const ventasSemana = useMemo(() => {
    const ws = startOfWeekStr()
    const monday = parseLocalDate(ws)
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
    const we = toLocalDateStr(sunday)
    return rowsAll.filter(r => r.fecha >= ws && r.fecha <= we).reduce((a, r) => a + (r.total_bruto || 0), 0)
  }, [rowsAll])
  const ventasMes = useMemo(() => {
    const m = toLocalDateStr(new Date()).slice(0, 7)
    return rowsAll.filter(r => r.fecha.startsWith(m)).reduce((a, r) => a + (r.total_bruto || 0), 0)
  }, [rowsAll])
  const ventasAno = useMemo(() => {
    const a = toLocalDateStr(new Date()).slice(0, 4)
    return rowsAll.filter(r => r.fecha.startsWith(a)).reduce((a2, r) => a2 + (r.total_bruto || 0), 0)
  }, [rowsAll])

  const nSemana = isoWeek(new Date())
  const nombreMes = new Date().toLocaleDateString('es-ES', { month: 'long' })
  const ano = new Date().getFullYear()

  /* ── netos reales del periodo (factura banca) ─ */
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

  /* ── total gastos del periodo ───────────────── */
  const totalGastosPeriodo = useMemo(() => {
    const desde = toLocalDateStr(fechaDesde)
    const hasta = toLocalDateStr(fechaHasta)
    return gastos
      .filter(g => g.fecha >= desde && g.fecha <= hasta)
      .reduce((a, g) => a + (Number(g.importe) || 0), 0)
  }, [gastos, fechaDesde, fechaHasta])

  const resultadoLimpio = netosReales - totalGastosPeriodo

  /* ── EBITDA y prime cost ────────────────────── */
  const { ebitda, ebitdaPct, primeCostPct } = useMemo(() => {
    const cogs = peParams ? netoEstimado * (peParams.food_cost_pct / 100) : netoEstimado * 0.28
    const sueldosMes = peParams ? (peParams.sueldo_ruben + peParams.sueldo_emilio + peParams.sueldos_empleados + peParams.ss_empresa + peParams.ss_autonomos) : 0
    // Prorrateo de sueldos al periodo
    const dias = Math.max(1, Math.round((fechaHasta.getTime() - fechaDesde.getTime()) / 86400000) + 1)
    const labor = (sueldosMes / 30) * dias
    const pc = netoEstimado > 0 ? ((cogs + labor) / netoEstimado) * 100 : 0
    const eb = netoEstimado - cogs - labor - (totalGastosPeriodo - cogs)
    const ebPct = netoEstimado > 0 ? (eb / netoEstimado) * 100 : 0
    return { ebitda: eb, ebitdaPct: ebPct, primeCostPct: pc }
  }, [netoEstimado, totalGastosPeriodo, peParams, fechaDesde, fechaHasta])

  /* ── delta pp ebitda ────────────────────────── */
  const ebitdaDeltaPp = useMemo(() => {
    if (!variacionVentas) return null
    return variacionVentas / 10
  }, [variacionVentas])

  /* ── grupos de gasto ────────────────────────── */
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

    // Presupuestos: prefer presupuestosGrupo (objetivos.tipo=presupuesto_grupo).
    // Fallback: agregación de presupuestos_mensuales por categoría → grupo
    function presFromBD(prefijos: string[]): number {
      return presupuestosBD
        .filter(p => prefijos.some(pr => p.categoria.startsWith(pr)))
        .reduce((a, p) => a + (Number(p.tope) || 0), 0)
    }
    const presProducto     = presupuestosGrupo.producto     || presFromBD(['PRD-'])
    const presEquipo       = presupuestosGrupo.equipo       || presFromBD(['RRH-'])
    const presLocal        = presupuestosGrupo.local        || presFromBD(['LOC-', 'SUM-'])
    const presControlables = presupuestosGrupo.controlables || presFromBD(['CTR-'])

    const pctNeto = (g: number) => netoEstimado > 0 ? (g / netoEstimado) * 100 : 0
    return {
      producto:     { gasto: producto,     presupuesto: presProducto,     pctSobreNetos: pctNeto(producto)     || GRUPO_DEFAULT_PCT.producto },
      equipo:       { gasto: equipo,       presupuesto: presEquipo,       pctSobreNetos: pctNeto(equipo)       || GRUPO_DEFAULT_PCT.equipo },
      local:        { gasto: local,        presupuesto: presLocal,        pctSobreNetos: pctNeto(local)        || GRUPO_DEFAULT_PCT.local },
      controlables: { gasto: controlables, presupuesto: presControlables, pctSobreNetos: pctNeto(controlables) || GRUPO_DEFAULT_PCT.controlables },
    }
  }, [gastos, presupuestosBD, presupuestosGrupo, netoEstimado, fechaDesde, fechaHasta])

  /* ── días pico mes actual ───────────────────── */
  const diasPico: DiaPico[] = useMemo(() => {
    const m = toLocalDateStr(new Date()).slice(0, 7)
    const acum = [0, 0, 0, 0, 0, 0, 0]
    for (const r of rowsAll) {
      if (!r.fecha.startsWith(m)) continue
      const d = parseLocalDate(r.fecha)
      const idx = (d.getDay() + 6) % 7
      acum[idx] += r.total_bruto || 0
    }
    return acum.map((v, i) => ({ idx: i, nombre: NOMBRES_DIAS[i], valor: v, color: COLORES_DIAS[i] }))
  }, [rowsAll])
  const mediaDiariaPico = useMemo(() => {
    const validos = diasPico.filter(d => d.valor > 0)
    if (validos.length === 0) return 0
    return validos.reduce((a, d) => a + d.valor, 0) / validos.length
  }, [diasPico])

  /* ── saldo + proyección (datos demo si BD vacía) ─ */
  const saldoData = useMemo(() => {
    if (gastos.length === 0 && rowsAll.length === 0) {
      return { saldoHoy: 0, cobros7d: 0, pagos7d: 0, cobros30d: 0, pagos30d: 0 }
    }
    // Cobros estimados: facturación neta proyectada de últimos 7/30 días (rolling)
    const hoy = new Date()
    const hace7 = new Date(hoy); hace7.setDate(hoy.getDate() - 7)
    const hace30 = new Date(hoy); hace30.setDate(hoy.getDate() - 30)
    const desde7  = toLocalDateStr(hace7)
    const desde30 = toLocalDateStr(hace30)
    const hasta = toLocalDateStr(hoy)

    function netoRows(d1: string, d2: string): number {
      const rs = rowsAll.filter(r => r.fecha >= d1 && r.fecha <= d2)
      const ids: Array<CanalStat['id']> = ['uber', 'glovo', 'je', 'web', 'dir']
      let n = 0
      for (const id of ids) {
        const bk = `${id === 'dir' ? 'directa' : id}_bruto` as keyof RowFacturacion
        const pk = `${id === 'dir' ? 'directa' : id}_pedidos` as keyof RowFacturacion
        const bruto = rs.reduce((a, r) => a + (Number(r[bk]) || 0), 0)
        const pedidos = rs.reduce((a, r) => a + (Number(r[pk]) || 0), 0)
        n += calcNetoPorCanal(id, bruto, pedidos).neto
      }
      return n
    }
    const cobros7d = netoRows(desde7, hasta)
    const cobros30d = netoRows(desde30, hasta)

    // Pagos estimados: gastos fijos pe_parametros prorrateados + gastos reales últimos N días
    const sueldosMes = peParams ? (peParams.sueldo_ruben + peParams.sueldo_emilio + peParams.sueldos_empleados + peParams.ss_empresa + peParams.ss_autonomos + peParams.alquiler_local + peParams.gestoria + peParams.luz + peParams.agua + peParams.telefono + peParams.hosting_software + peParams.otros_fijos) : 3500
    const pagos7d  = (sueldosMes / 30) * 7  + gastos.filter(g => g.fecha >= desde7  && g.fecha <= hasta).reduce((a, g) => a + (Number(g.importe) || 0), 0) * 0.3
    const pagos30d = sueldosMes + gastos.filter(g => g.fecha >= desde30 && g.fecha <= hasta).reduce((a, g) => a + (Number(g.importe) || 0), 0) * 0.5

    // Saldo hoy aproximado: cobros30d - pagos30d (estimación conservadora)
    const saldoHoy = Math.max(0, cobros30d - pagos30d) + (peParams?.caja_minima_verde ?? 0)
    return { saldoHoy, cobros7d, pagos7d, cobros30d, pagos30d }
  }, [rowsAll, gastos, peParams])

  /* ── ratio ingresos / gastos ────────────────── */
  const gastosFijosMes = useMemo(() => {
    if (!peParams) return 0
    return peParams.alquiler_local + peParams.sueldo_ruben + peParams.sueldo_emilio + peParams.sueldos_empleados +
      peParams.ss_empresa + peParams.ss_autonomos + peParams.gestoria + peParams.luz + peParams.agua + peParams.gas +
      peParams.telefono + peParams.internet + peParams.hosting_software + peParams.seguros + peParams.licencias +
      peParams.think_paladar + peParams.otros_fijos
  }, [peParams])

  /* ── PE día verde estimado ──────────────────── */
  const peCalc = useMemo(() => {
    if (!peParams || gastosFijosMes <= 0) {
      return {
        peBruto: 0, peNeto: 0, acumulado: ventasMes,
        pctProgreso: 0, diaVerdeEstimado: null,
        facturacionDia: 0, pedidosDia: 0, tmActual: tmBruto,
        realFacDia: 0, realPedDia: 0,
      }
    }
    // Margen contribución: usando food_cost_pct + comisiones promedio
    const peNeto = gastosFijosMes
    // Factor bruto→neto promedio (asumiendo mix actual canal)
    const bruto2neto = ventasMes > 0 && netoEstimado > 0 ? (netoEstimado / ventasMes) : 0.7
    const peBruto = bruto2neto > 0 ? peNeto / bruto2neto : peNeto
    const pctProgreso = peBruto > 0 ? Math.min(100, Math.round((ventasMes / peBruto) * 100)) : 0

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

  /* ── provisiones ────────────────────────────── */
  const { totalAGuardar, provIVA, provIRPF, proximosPagos } = useMemo(() => {
    const hoyProv = new Date()
    const mesActual = `${hoyProv.getFullYear()}-${String(hoyProv.getMonth() + 1).padStart(2, '0')}`
    const iva  = provisiones.filter(p => p.tipo.startsWith('IVA') && p.periodo.startsWith(mesActual)).reduce((a, p) => a + (Number(p.importe) || 0), 0)
    const irpf = provisiones.filter(p => p.tipo.startsWith('IRPF') && p.periodo.startsWith(mesActual)).reduce((a, p) => a + (Number(p.importe) || 0), 0)

    // Próximos pagos 30d desde provisiones + gastos fijos
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
      // estimados gastos fijos del mes que vencen
      if (peParams.alquiler_local) items.push({ concepto: 'Alquiler local', fecha: 'mensual', importe: peParams.alquiler_local })
      if (peParams.gestoria)       items.push({ concepto: 'Gestoría',        fecha: 'mensual', importe: peParams.gestoria })
      if (peParams.luz)            items.push({ concepto: 'Luz',             fecha: 'mensual', importe: peParams.luz })
      if (peParams.hosting_software) items.push({ concepto: 'Hosting/SW',    fecha: 'mensual', importe: peParams.hosting_software })
    }
    items.sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
    return { totalAGuardar: iva + irpf, provIVA: iva, provIRPF: irpf, proximosPagos: items }
  }, [provisiones, peParams])

  /* ── top ventas: intenta tabla pedidos ─────────────── */
  const topItems: TopVentaItem[] = useMemo(() => [], [])

  useEffect(() => {
    supabase
      .from('pedidos')
      .select('id')
      .limit(1)
      .then(({ data, error }) => {
        if (error || !data || data.length === 0) {
          setTopDatosDemo(true)
        }
      })
  }, [])

  /* ── flag demo ──────────────────────────────── */
  const dataInicializadaRef = useRef(false)
  useEffect(() => {
    if (dataInicializadaRef.current) return
    dataInicializadaRef.current = true
    // Si no hay datos en facturacion ni gastos, marcamos demo
    if (rowsAll.length === 0 && gastos.length === 0) {
      setDatosDemo(true)
    }
  }, [rowsAll.length, gastos.length])

  /* ── handlers persist objetivos ─────────────── */
  async function saveObjetivoVenta(tipo: 'semanal' | 'mensual' | 'anual', valor: number | null) {
    if (valor == null) {
      const { data } = await supabase.from('objetivos').select('importe').eq('tipo', tipo).maybeSingle()
      if (data) setObjetivos(p => ({ ...p, [tipo]: Number((data as { importe: number }).importe) }))
      return
    }
    setObjetivos(p => ({ ...p, [tipo]: valor }))
    await supabase.from('objetivos').upsert({ tipo, importe: valor }, { onConflict: 'tipo' })
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

  /* ── render ─────────────────────────────────── */
  return (
    <div style={{
      background: COLOR.bgPagina,
      color: COLOR.textPri,
      fontFamily: LEXEND,
      padding: '20px 0',
      borderRadius: 12,
      marginTop: 18,
    }}>

      {datosDemo && (
        <div style={{
          background: '#fff7e6',
          border: `1px solid ${COLOR.ambar}`,
          color: COLOR.jeDark,
          padding: '8px 14px',
          borderRadius: 8,
          fontSize: 12,
          fontFamily: LEXEND,
          marginBottom: 14,
          textAlign: 'center',
        }}>
          datos demo · BD vacía o sin datos en este periodo
        </div>
      )}

      {/* TOASTS */}
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: t.type === 'success' ? COLOR.verde : COLOR.ambar,
            color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontFamily: LEXEND,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}>{t.msg}</div>
        ))}
      </div>

      {/* FILA 1: Cards grandes */}
      <div style={{
        ...row3,
        marginBottom: 14,
        gridTemplateColumns: isMobile ? (window.innerWidth < 640 ? '1fr' : 'repeat(2, 1fr)') : 'repeat(3, 1fr)',
      }}>
        <CardVentas
          bruto={ventasPeriodo}
          netoEstimado={netoEstimado}
          variacionPct={variacionVentas}
          ventasSemana={ventasSemana}
          ventasMes={ventasMes}
          ventasAno={ventasAno}
          nSemana={nSemana}
          nombreMes={nombreMes}
          ano={ano}
          objetivos={objetivos}
          onSaveObjetivo={saveObjetivoVenta}
          toast={showToast}
        />
        <CardPedidosTM
          pedidos={pedidosPeriodo}
          tmBruto={tmBruto}
          tmNeto={tmNeto}
          pedidosDeltaPct={variacionPedidos}
          tmDeltaPct={variacionTM}
          canales={canalStats}
        />
        <CardResultadoPeriodo
          ebitda={ebitda}
          ebitdaPct={ebitdaPct}
          deltaPp={ebitdaDeltaPp}
          netosEstimados={netoEstimado}
          netosReales={netosReales}
          totalGastos={totalGastosPeriodo}
          resultadoLimpio={resultadoLimpio}
          primeCostPct={primeCostPct}
        />
      </div>

      {/* FILA 2: 3 columnas */}
      <div style={{
        ...row3,
        marginBottom: 14,
        gridTemplateColumns: isMobile ? (window.innerWidth < 640 ? '1fr' : 'repeat(2, 1fr)') : 'repeat(3, 1fr)',
      }}>
        <ColFacturacionCanal canales={canalStats} />
        <ColGruposGasto
          data={gruposData}
          onSavePresupuesto={savePresupuestoGrupo}
          onToast={showToast}
        />
        <ColDiasPico
          dias={diasPico}
          media={mediaDiariaPico}
          onClickDia={onFiltrarDiaSemana}
        />
      </div>

      {/* FILA 3: 3 cards medianas */}
      <div style={{
        ...row3,
        marginBottom: 14,
        gridTemplateColumns: isMobile ? (window.innerWidth < 640 ? '1fr' : 'repeat(2, 1fr)') : 'repeat(3, 1fr)',
      }}>
        <CardSaldo {...saldoData} />
        <CardRatio
          netosEstimados={netoEstimado}
          netosReales={netosReales}
          gastosFijos={gastosFijosMes}
          gastosReales={totalGastosPeriodo}
          objetivo={objetivoRatio}
          onSaveObjetivo={saveObjetivoRatio}
          onToast={showToast}
        />
        <CardPE {...peCalc} />
      </div>

      {/* FILA 4: 3 cards medianas */}
      <div style={{
        ...row3,
        gridTemplateColumns: isMobile ? (window.innerWidth < 640 ? '1fr' : 'repeat(2, 1fr)') : 'repeat(3, 1fr)',
      }}>
        <CardProvisiones
          totalAGuardar={totalAGuardar}
          provIVA={provIVA}
          provIRPF={provIRPF}
          proximosPagos={proximosPagos}
        />
        <CardPendientesSubir
          items={tareas}
          onIrImportador={() => navigate('/importador')}
        />
        <CardTopVentas
          tab={topTab}
          onTab={setTopTab}
          items={topItems}
          datosDemo={topDatosDemo}
        />
      </div>
    </div>
  )
}
