/**
 * TabResumenLymon — Tab Resumen del Panel Global 2, estilo Lymon.
 *
 * Misma lógica de datos que el TabResumen real (mismos hooks Supabase,
 * mismos cálculos vía calcNetoPorCanal). Cambia SOLO la piel:
 * fondo oscuro #2d2d2e, acentos lima #e8f442 / tomate #C8362A, Oswald mayúsculas.
 *
 * Mantiene TODA la información de las 12 cards reales:
 *  Facturación · Pedidos/TM · Resultado · Facturación canal · Grupos gasto ·
 *  Días pico · Saldo · Ratio · Punto Equilibrio · Provisiones · Top ventas.
 *
 * NO toca las cards originales de Panel Global.
 */

import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  calcNetoPorCanal, loadConfigCanales, recargarConfigCanales,
  loadMarcasPorCanal, type CanalConfig, type MarcasPorCanal,
} from '@/lib/panel/calcNetoPlataforma'
import { fmtEur, fmtNum, fmtPct } from '@/lib/format'
import type { RowFacturacion, CanalStat } from '@/components/panel/resumen/types'

/* ── Paleta Lymon ─────────────────────────────── */
const C = {
  bg: '#2d2d2e',
  surface: '#3a3a3c',
  surfaceLight: '#454547',
  border: 'rgba(255,255,255,0.08)',
  text: '#ffffff',
  textMuted: '#a8a8aa',
  textSubtle: '#6c6c6e',
  lime: '#e8f442',
  tomato: '#C8362A',
  leaf: '#7A8F5C',
  blue: '#66aaff',
  orange: '#F26B1F',
  track: 'rgba(255,255,255,0.08)',
}
const OSWALD = "'Oswald', sans-serif"
const LEXEND = "'Lexend', sans-serif"

interface Props {
  rowsPeriodo: RowFacturacion[]
  rowsAll: RowFacturacion[]
  fechaDesde: Date
  fechaHasta: Date
  canalesFiltro: string[]
}

interface PeParams {
  alquiler_local: number; irpf_alquiler: number;
  sueldo_ruben: number; sueldo_emilio: number; sueldos_empleados: number;
  ss_empresa: number; ss_autonomos: number; gestoria: number;
  luz: number; agua: number; gas: number; telefono: number; internet: number;
  hosting_software: number; seguros: number; licencias: number;
  think_paladar: number; otros_fijos: number;
  food_cost_pct: number; objetivo_beneficio_mensual: number; iva_pct: number;
}
interface IngresoMensual { anio: number; mes: number; canal: string; tipo: string; importe: number; base_imponible: number }
interface Provision { tipo: string; periodo: string; fecha_inicio: string; fecha_fin: string; importe: number; estado: string }
interface GastoRow { fecha: string; importe: number; grupo: string | null; categoria: string | null }
interface ObjetivosVentas { diario: number; semanal: number; mensual: number; anual: number }

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
  const now = new Date(); const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now); monday.setDate(now.getDate() + diff)
  return toLocalDateStr(monday)
}
function rangoPrevio(desde: Date, hasta: Date) {
  const days = Math.round((hasta.getTime() - desde.getTime()) / 86400000) + 1
  const prevHasta = new Date(desde); prevHasta.setDate(desde.getDate() - 1)
  const prevDesde = new Date(prevHasta); prevDesde.setDate(prevHasta.getDate() - (days - 1))
  return { desde: toLocalDateStr(prevDesde), hasta: toLocalDateStr(prevHasta) }
}
function semaforo(pct: number): string {
  if (pct >= 80) return C.leaf
  if (pct >= 50) return C.lime
  return C.tomato
}

const NOMBRES_DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const NOMBRES_LARGOS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export default function TabResumenLymon({ rowsPeriodo, rowsAll, fechaDesde, fechaHasta, canalesFiltro }: Props) {
  /* ── state datos BD ── */
  const [objetivos, setObjetivos] = useState<ObjetivosVentas>({ diario: 0, semanal: 0, mensual: 0, anual: 0 })
  const [objetivoRatio, setObjetivoRatio] = useState(2.5)
  const [peParams, setPeParams] = useState<PeParams | null>(null)
  const [ingresosM, setIngresosM] = useState<IngresoMensual[]>([])
  const [provisiones, setProvisiones] = useState<Provision[]>([])
  const [gastos, setGastos] = useState<GastoRow[]>([])
  const [configCanales, setConfigCanales] = useState<Record<string, CanalConfig>>({})
  const [marcasPorCanal, setMarcasPorCanal] = useState<MarcasPorCanal>({ uber: 1, glovo: 1, je: 1, web: 1, dir: 1 })
  const [saldo, setSaldo] = useState<number | null>(null)

  useEffect(() => {
    loadConfigCanales().then(setConfigCanales)
    loadMarcasPorCanal().then(setMarcasPorCanal)
    const onChange = () => {
      recargarConfigCanales().then(setConfigCanales)
      loadMarcasPorCanal().then(setMarcasPorCanal)
    }
    window.addEventListener('config_canales:changed', onChange)
    return () => window.removeEventListener('config_canales:changed', onChange)
  }, [])

  const loadObjetivos = useCallback(async () => {
    const [resObj, resDias] = await Promise.all([
      supabase.from('objetivos').select('tipo,importe').in('tipo', ['diario', 'semanal', 'mensual', 'anual', 'ratio_ingresos_gastos']),
      supabase.from('objetivos_dia_semana').select('dia,importe'),
    ])
    const overrides: Partial<Record<'diario' | 'semanal' | 'mensual' | 'anual', number>> = {}
    let ratio = 2.5
    for (const r of (resObj.data ?? []) as { tipo: string; importe: number }[]) {
      if (['diario', 'semanal', 'mensual', 'anual'].includes(r.tipo)) overrides[r.tipo as 'diario'] = Number(r.importe)
      if (r.tipo === 'ratio_ingresos_gastos') ratio = Number(r.importe) || 2.5
    }
    const dias = (resDias.data ?? []) as { dia: number; importe: number }[]
    const sumaSemana = dias.reduce((a, d) => a + Number(d.importe || 0), 0)
    const hoyD = new Date(); const ano = hoyD.getFullYear(); const mesIdx = hoyD.getMonth()
    const diasEnMes = new Date(ano, mesIdx + 1, 0).getDate()
    const esBis = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0
    const dAno = esBis ? 366 : 365
    const mediaDia = sumaSemana / 7
    const use = (k: 'diario' | 'semanal' | 'mensual' | 'anual') => overrides[k] !== undefined && (overrides[k] as number) > 0
    setObjetivos({
      diario: use('diario') ? overrides.diario! : mediaDia,
      semanal: use('semanal') ? overrides.semanal! : sumaSemana,
      mensual: use('mensual') ? overrides.mensual! : mediaDia * diasEnMes,
      anual: use('anual') ? overrides.anual! : mediaDia * dAno,
    })
    setObjetivoRatio(ratio)
  }, [])
  useEffect(() => { loadObjetivos() }, [loadObjetivos])

  useEffect(() => {
    supabase.from('pe_parametros').select('*').limit(1).maybeSingle().then(({ data }) => { if (data) setPeParams(data as PeParams) })
  }, [])
  useEffect(() => {
    const hoy = new Date(); const haceAno = new Date(hoy.getFullYear() - 1, hoy.getMonth(), 1)
    supabase.from('ingresos_mensuales').select('anio,mes,canal,tipo,importe,base_imponible').gte('anio', haceAno.getFullYear())
      .then(({ data }) => { if (data) setIngresosM(data as IngresoMensual[]) })
  }, [])
  useEffect(() => {
    const ano = new Date().getFullYear()
    supabase.from('gastos').select('fecha,importe,grupo,categoria').gte('fecha', `${ano}-01-01`)
      .then(({ data }) => { if (data) setGastos(data as GastoRow[]) })
  }, [])
  useEffect(() => {
    supabase.from('provisiones').select('tipo,periodo,fecha_inicio,fecha_fin,importe,estado').eq('estado', 'pendiente')
      .then(({ data }) => { if (data) setProvisiones(data as Provision[]) })
  }, [])
  useEffect(() => {
    supabase.from('cuentas_bancarias').select('saldo_actual').eq('activa', true).then(({ data }) => {
      if (data && data.length > 0) setSaldo((data as { saldo_actual: number | null }[]).reduce((a, r) => a + (Number(r.saldo_actual) || 0), 0))
    })
  }, [])

  /* ── cálculos (idénticos al TabResumen real) ── */
  const canalStats: CanalStat[] = useMemo(() => {
    const filt = canalesFiltro.length > 0
    const ids: Array<CanalStat['id']> = ['uber', 'glovo', 'je', 'web', 'dir']
    const visibles = filt ? ids.filter(id => canalesFiltro.includes(id)) : ids
    const labels: Record<CanalStat['id'], string> = { uber: 'Uber Eats', glovo: 'Glovo', je: 'Just Eat', web: 'Web', dir: 'Directa' }
    const colores: Record<CanalStat['id'], string> = { uber: C.leaf, glovo: C.lime, je: C.orange, web: C.tomato, dir: C.blue }
    const totalBruto = rowsPeriodo.reduce((a, r) => a + (r.total_bruto || 0), 0)
    return visibles.map(id => {
      const brutoKey = `${id === 'dir' ? 'directa' : id}_bruto` as keyof RowFacturacion
      const pedKey = `${id === 'dir' ? 'directa' : id}_pedidos` as keyof RowFacturacion
      const bruto = rowsPeriodo.reduce((a, r) => a + (Number(r[brutoKey]) || 0), 0)
      const pedidos = rowsPeriodo.reduce((a, r) => a + (Number(r[pedKey]) || 0), 0)
      const { neto, margenPct } = calcNetoPorCanal(id, bruto, pedidos, marcasPorCanal, fechaDesde, fechaHasta, configCanales)
      return { id, label: labels[id], color: colores[id], bruto, neto, pedidos, pct: totalBruto > 0 ? (bruto / totalBruto) * 100 : 0, ticket: pedidos > 0 ? bruto / pedidos : 0, margen: margenPct }
    })
  }, [rowsPeriodo, canalesFiltro, configCanales, marcasPorCanal, fechaDesde, fechaHasta])

  const ventasPeriodo = useMemo(() => rowsPeriodo.reduce((a, r) => a + (r.total_bruto || 0), 0), [rowsPeriodo])
  const pedidosPeriodo = useMemo(() => rowsPeriodo.reduce((a, r) => a + (r.total_pedidos || 0), 0), [rowsPeriodo])
  const tmBruto = pedidosPeriodo > 0 ? ventasPeriodo / pedidosPeriodo : 0
  const netoEstimado = useMemo(() => canalStats.reduce((a, c) => a + c.neto, 0), [canalStats])
  const tmNeto = pedidosPeriodo > 0 ? netoEstimado / pedidosPeriodo : 0
  const pctNeto = ventasPeriodo > 0 ? (netoEstimado / ventasPeriodo) * 100 : 0

  const { variacionVentas, variacionPedidos, variacionTM } = useMemo(() => {
    const { desde, hasta } = rangoPrevio(fechaDesde, fechaHasta)
    const prevRows = rowsAll.filter(r => r.fecha >= desde && r.fecha <= hasta)
    const prevVentas = prevRows.reduce((a, r) => a + (r.total_bruto || 0), 0)
    const prevPedidos = prevRows.reduce((a, r) => a + (r.total_pedidos || 0), 0)
    const prevTm = prevPedidos > 0 ? prevVentas / prevPedidos : 0
    return {
      variacionVentas: prevVentas > 0 ? ((ventasPeriodo - prevVentas) / prevVentas) * 100 : null,
      variacionPedidos: prevPedidos > 0 ? ((pedidosPeriodo - prevPedidos) / prevPedidos) * 100 : null,
      variacionTM: prevTm > 0 ? ((tmBruto - prevTm) / prevTm) * 100 : null,
    }
  }, [rowsAll, fechaDesde, fechaHasta, ventasPeriodo, pedidosPeriodo, tmBruto])

  const ventasSemana = useMemo(() => {
    const ws = startOfWeekStr(); const monday = parseLocalDate(ws)
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

  const netosReales = useMemo(() => {
    const fIni = fechaDesde.getFullYear() * 100 + (fechaDesde.getMonth() + 1)
    const fFin = fechaHasta.getFullYear() * 100 + (fechaHasta.getMonth() + 1)
    return ingresosM.filter(i => i.tipo === 'neto').filter(i => { const k = i.anio * 100 + i.mes; return k >= fIni && k <= fFin })
      .reduce((a, i) => a + (Number(i.importe) || 0), 0)
  }, [ingresosM, fechaDesde, fechaHasta])

  const totalGastosPeriodo = useMemo(() => {
    const desde = toLocalDateStr(fechaDesde); const hasta = toLocalDateStr(fechaHasta)
    return gastos.filter(g => g.fecha >= desde && g.fecha <= hasta).reduce((a, g) => a + (Number(g.importe) || 0), 0)
  }, [gastos, fechaDesde, fechaHasta])

  const { ebitda, ebitdaPct, primeCostPct } = useMemo(() => {
    const cogs = peParams ? netoEstimado * (peParams.food_cost_pct / 100) : netoEstimado * 0.28
    const sueldosMes = peParams ? (peParams.sueldo_ruben + peParams.sueldo_emilio + peParams.sueldos_empleados + peParams.ss_empresa + peParams.ss_autonomos) : 0
    const dias = Math.max(1, Math.round((fechaHasta.getTime() - fechaDesde.getTime()) / 86400000) + 1)
    const labor = (sueldosMes / 30) * dias
    const pc = netoEstimado > 0 ? ((cogs + labor) / netoEstimado) * 100 : 0
    const eb = netoEstimado - cogs - labor - (totalGastosPeriodo - cogs)
    return { ebitda: eb, ebitdaPct: netoEstimado > 0 ? (eb / netoEstimado) * 100 : 0, primeCostPct: pc }
  }, [netoEstimado, totalGastosPeriodo, peParams, fechaDesde, fechaHasta])

  const gruposData = useMemo(() => {
    const desde = toLocalDateStr(fechaDesde); const hasta = toLocalDateStr(fechaHasta)
    const rows = gastos.filter(g => g.fecha >= desde && g.fecha <= hasta)
    const sum: Record<string, number> = {}
    for (const g of rows) { const k = (g.grupo || '').toUpperCase(); sum[k] = (sum[k] || 0) + (Number(g.importe) || 0) }
    const producto = sum['PRODUCTO'] || 0
    const equipo = sum['RRHH'] || 0
    const local = (sum['ALQUILER'] || 0) + (sum['SUMINISTROS'] || 0)
    const controlables = (sum['ADMIN_GENERALES'] || 0) + (sum['MARKETING'] || 0) + (sum['INTERNET_VENTAS'] || 0)
    const pctNetoG = (g: number) => netoEstimado > 0 ? (g / netoEstimado) * 100 : 0
    const objPct: Record<string, number> = { producto: 30, equipo: 40, local: 15, controlables: 15 }
    return [
      { id: 'producto', label: 'PRODUCTO · COGS', gasto: producto, pres: netoEstimado * objPct.producto / 100, pct: pctNetoG(producto) || 28, obj: objPct.producto },
      { id: 'equipo', label: 'EQUIPO · LABOR', gasto: equipo, pres: netoEstimado * objPct.equipo / 100, pct: pctNetoG(equipo) || 32, obj: objPct.equipo },
      { id: 'local', label: 'LOCAL · OCCUPANCY', gasto: local, pres: netoEstimado * objPct.local / 100, pct: pctNetoG(local) || 7, obj: objPct.local },
      { id: 'controlables', label: 'CONTROLABLES · OPEX', gasto: controlables, pres: netoEstimado * objPct.controlables / 100, pct: pctNetoG(controlables) || 15, obj: objPct.controlables },
    ]
  }, [gastos, netoEstimado, fechaDesde, fechaHasta])

  const diasPico = useMemo(() => {
    const inicio = toLocalDateStr(fechaDesde); const fin = toLocalDateStr(fechaHasta)
    const acum = [0, 0, 0, 0, 0, 0, 0]
    for (const r of rowsAll) {
      if (r.fecha < inicio || r.fecha > fin) continue
      const d = parseLocalDate(r.fecha); const idx = (d.getDay() + 6) % 7
      acum[idx] += r.total_bruto || 0
    }
    const colores = [C.blue, C.leaf, C.orange, C.tomato, C.lime, C.leaf, C.leaf]
    return acum.map((v, i) => ({ idx: i, nombre: NOMBRES_DIAS[i], valor: v, color: colores[i] }))
  }, [rowsAll, fechaDesde, fechaHasta])
  const mediaDiariaPico = useMemo(() => {
    const v = diasPico.filter(d => d.valor > 0)
    return v.length === 0 ? 0 : v.reduce((a, d) => a + d.valor, 0) / v.length
  }, [diasPico])

  const gastosFijosMes = useMemo(() => {
    if (!peParams) return 0
    return peParams.alquiler_local + peParams.sueldo_ruben + peParams.sueldo_emilio + peParams.sueldos_empleados +
      peParams.ss_empresa + peParams.ss_autonomos + peParams.gestoria + peParams.luz + peParams.agua + peParams.gas +
      peParams.telefono + peParams.internet + peParams.hosting_software + peParams.seguros + peParams.licencias +
      peParams.think_paladar + peParams.otros_fijos
  }, [peParams])

  const peCalc = useMemo(() => {
    if (!peParams || gastosFijosMes <= 0) return { peBruto: 0, acumulado: ventasMes, pct: 0, falta: 0 }
    const peNeto = gastosFijosMes
    const bruto2neto = ventasMes > 0 && netoEstimado > 0 ? (netoEstimado / ventasMes) : 0.7
    const peBruto = bruto2neto > 0 ? peNeto / bruto2neto : peNeto
    const pct = peBruto > 0 ? Math.round((ventasMes / peBruto) * 100) : 0
    return { peBruto, acumulado: ventasMes, pct, falta: Math.max(0, peBruto - ventasMes) }
  }, [peParams, gastosFijosMes, ventasMes, netoEstimado])

  const { totalAGuardar, proximosPagos } = useMemo(() => {
    const hoyProv = new Date()
    const mesActual = `${hoyProv.getFullYear()}-${String(hoyProv.getMonth() + 1).padStart(2, '0')}`
    const iva = provisiones.filter(p => p.tipo.startsWith('IVA') && p.periodo.startsWith(mesActual)).reduce((a, p) => a + (Number(p.importe) || 0), 0)
    const irpf = provisiones.filter(p => p.tipo.startsWith('IRPF') && p.periodo.startsWith(mesActual)).reduce((a, p) => a + (Number(p.importe) || 0), 0)
    const items: { concepto: string; fecha: string; importe: number }[] = []
    if (peParams) {
      if (peParams.alquiler_local) items.push({ concepto: 'Alquiler local', fecha: 'mensual', importe: peParams.alquiler_local })
      if (peParams.gestoria) items.push({ concepto: 'Gestoría', fecha: 'mensual', importe: peParams.gestoria })
      if (peParams.luz) items.push({ concepto: 'Luz', fecha: 'mensual', importe: peParams.luz })
      if (peParams.hosting_software) items.push({ concepto: 'Hosting/SW', fecha: 'mensual', importe: peParams.hosting_software })
    }
    return { totalAGuardar: iva + irpf, proximosPagos: items }
  }, [provisiones, peParams])

  /* derivados ratio */
  const ratioVal = totalGastosPeriodo > 0 ? netoEstimado / totalGastosPeriodo : 0
  const ratioPctObj = objetivoRatio > 0 ? (ratioVal / objetivoRatio) * 100 : 0

  const cobros30d = netosReales > 0 ? netosReales : netoEstimado
  const colDelta = (variacionVentas ?? 0) >= 0
  const ano = new Date().getFullYear()
  const nombreMesLabel = new Date().toLocaleDateString('es-ES', { month: 'long' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* HERO */}
      <div style={{ padding: '32px 0 28px', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontFamily: OSWALD, fontSize: 50, fontWeight: 700, lineHeight: 1.08, letterSpacing: '-0.02em', textTransform: 'uppercase', color: C.text }}>
          EL NEGOCIO VA{' '}
          <span style={{ color: colDelta ? C.lime : C.tomato, padding: '0 8px', background: colDelta ? 'rgba(232,244,66,0.08)' : 'rgba(200,54,42,0.1)' }}>
            {variacionVentas !== null ? fmtPct(variacionVentas, 1) : '—'}
          </span>{' '}vs periodo anterior.
        </div>
        <div style={{ fontSize: 16, color: C.textMuted, maxWidth: 820, lineHeight: 1.5, marginTop: 14 }}>
          Facturación bruta <strong style={{ color: C.text }}>{fmtEur(ventasPeriodo, { showEuro: true, decimals: 2 })}</strong> ·
          neto estimado <strong style={{ color: C.leaf }}>{fmtEur(netoEstimado, { showEuro: true, decimals: 2 })}</strong> ({fmtNum(pctNeto, 1)}%).
          {pedidosPeriodo > 0 && <> Ticket medio {fmtEur(tmBruto, { showEuro: true, decimals: 2 })}.</>}
        </div>
      </div>

      {/* FILA 1: Facturación · Pedidos/TM · Resultado */}
      <Grid cols={3}>
        {/* FACTURACIÓN */}
        <Card>
          <Label>Facturación</Label>
          <div style={{ display: 'flex', gap: 28, alignItems: 'baseline', marginTop: 10, flexWrap: 'wrap' }}>
            <Big value={fmtEur(ventasPeriodo, { showEuro: false, decimals: 2 })} sub="BRUTO" />
            <Big value={fmtEur(netoEstimado, { showEuro: false, decimals: 2 })} sub={`NETO EST · ${fmtNum(pctNeto, 1)}%`} color={C.leaf} />
          </div>
          {variacionVentas !== null && <Delta v={variacionVentas} label="vs anterior" />}
          <div style={{ marginTop: 16 }}>
            <Barra label={`Semana`} val={ventasSemana} obj={objetivos.semanal} />
            <Barra label={`Mes`} val={ventasMes} obj={objetivos.mensual} />
            <Barra label={String(ano)} val={ventasAno} obj={objetivos.anual} last />
          </div>
        </Card>

        {/* PEDIDOS · TM */}
        <Card>
          <Label>Pedidos · TM</Label>
          <div style={{ display: 'flex', gap: 24, alignItems: 'baseline', marginTop: 10, flexWrap: 'wrap' }}>
            <Big value={fmtNum(pedidosPeriodo, 0)} sub="PEDIDOS" color={C.blue} />
            <Big value={fmtEur(tmBruto, { showEuro: true, decimals: 2 })} sub="TM BRUTO" color={C.orange} />
            <Big value={fmtEur(tmNeto, { showEuro: true, decimals: 2 })} sub="TM NETO" color={C.leaf} />
          </div>
          {(variacionPedidos !== null || variacionTM !== null) && (
            <div style={{ fontSize: 12, color: (variacionPedidos ?? 0) >= 0 && (variacionTM ?? 0) >= 0 ? C.leaf : C.tomato, margin: '10px 0 4px', fontFamily: LEXEND }}>
              {variacionPedidos !== null && <>{(variacionPedidos) >= 0 ? '▲' : '▼'} {fmtNum(Math.abs(variacionPedidos), 1)}% ped</>}
              {variacionPedidos !== null && variacionTM !== null && ' · '}
              {variacionTM !== null && <>{(variacionTM) >= 0 ? '▲' : '▼'} {fmtNum(Math.abs(variacionTM), 1)}% TM</>}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 12 }}>
            {canalStats.map(c => {
              const pctBarra = pedidosPeriodo > 0 ? (c.pedidos / pedidosPeriodo) * 100 : 0
              const tB = c.pedidos > 0 ? c.bruto / c.pedidos : 0
              const tN = c.pedidos > 0 ? c.neto / c.pedidos : 0
              return (
                <div key={c.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, fontFamily: LEXEND, color: C.text }}>
                    <span style={{ color: C.textMuted }}>● {c.label}</span>
                    <span>
                      <b style={{ color: C.blue }}>{fmtNum(c.pedidos, 0)}</b>
                      <span style={{ color: C.textSubtle }}>{' / '}</span>
                      <span style={{ color: C.orange }}>{fmtNum(tB, 2)}</span>
                      <span style={{ color: C.textSubtle }}>{' / '}</span>
                      <span style={{ color: C.leaf }}>{fmtNum(tN, 2)}</span>
                    </span>
                  </div>
                  <Track pct={Math.max(pctBarra, c.pedidos > 0 ? 2 : 0)} color={c.color} />
                </div>
              )
            })}
          </div>
        </Card>

        {/* RESULTADO */}
        <Card>
          <Label>Resultado</Label>
          <div style={{ display: 'flex', gap: 18, alignItems: 'baseline', marginTop: 10, flexWrap: 'wrap' }}>
            <Big value={fmtEur(ebitda, { showEuro: true, decimals: 2 })} sub="EBITDA" color={ebitda >= 0 ? C.leaf : C.tomato} />
            <div>
              <div style={{ fontFamily: OSWALD, fontSize: 24, fontWeight: 700, color: ebitda >= 0 ? C.leaf : C.tomato }}>{fmtNum(ebitdaPct, 0)}%</div>
              <div style={lblXs}>% s/netos</div>
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginTop: 14 }}>
            <Linea label="Facturación" valor={fmtEur(ventasPeriodo, { showEuro: false, decimals: 2 })} />
            <Linea label="Ingresos netos" valor={fmtEur(netoEstimado, { showEuro: false, decimals: 2 })} bold />
            <Linea label="Producto · COGS" valor={fmtEur(gruposData[0].gasto, { showEuro: false, decimals: 2 })} />
            <Linea label="Margen bruto" valor={fmtEur(netoEstimado - gruposData[0].gasto, { showEuro: false, decimals: 2 })} bold />
            <Linea label="Equipo" valor={fmtEur(gruposData[1].gasto, { showEuro: false, decimals: 2 })} />
            <Linea label="Local" valor={fmtEur(gruposData[2].gasto, { showEuro: false, decimals: 2 })} />
            <Linea label="Controlables" valor={fmtEur(gruposData[3].gasto, { showEuro: false, decimals: 2 })} />
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginTop: 12 }}>
            <div style={{ ...lblSm, display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={lblSm}>PRIME COST</span>
              <span style={{ ...lblSm, color: primeCostPct <= 60 ? C.leaf : C.tomato }}>{fmtPct(primeCostPct, 2)}</span>
            </div>
            <Track pct={Math.min(primeCostPct, 100)} color={primeCostPct <= 60 ? C.leaf : C.tomato} h={8} />
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, fontFamily: LEXEND }}>Objetivo 60%</div>
          </div>
        </Card>
      </Grid>

      {/* FILA 2: Facturación canal · Grupos gasto · Días pico */}
      <Grid cols={3}>
        {/* FACTURACIÓN POR CANAL */}
        <div>
          <Label>Facturación por canal</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {canalStats.map(c => (
              <div key={c.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${c.color}`, borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ ...lblXs, color: c.color }}>{c.label.toUpperCase()}</div>
                  <div style={{ fontFamily: OSWALD, fontSize: 22, fontWeight: 700, color: C.text, marginTop: 2 }}>{fmtEur(c.bruto, { showEuro: false, decimals: 2 })}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, fontFamily: LEXEND }}>Bruto</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: OSWALD, fontSize: 22, fontWeight: 700, color: C.leaf }}>{fmtEur(c.neto, { showEuro: false, decimals: 2 })}</div>
                  <div style={{ fontSize: 13, color: C.leaf, fontFamily: LEXEND }}>Margen {fmtPct(c.margen, 1)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* GRUPOS DE GASTO */}
        <div>
          <Label>Grupos de gasto · consumo vs presupuesto</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {gruposData.map(g => {
              const pctCumpl = g.pres > 0 ? (g.gasto / g.pres) * 100 : 0
              const col = pctCumpl <= 100 ? C.leaf : pctCumpl <= 105 ? C.lime : C.tomato
              const desv = g.gasto - g.pres
              return (
                <div key={g.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div style={lblSm}>{g.label}</div>
                    {g.id === 'producto' && <div style={{ fontSize: 11, color: C.leaf, fontFamily: LEXEND }}>Food Cost {fmtPct(g.pct, 0)}</div>}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
                    <div>
                      <span style={{ fontFamily: OSWALD, fontSize: 18, fontWeight: 700, color: C.text }}>{fmtEur(g.gasto, { showEuro: true, decimals: 2 })}</span>
                      <span style={{ fontSize: 12, color: C.textMuted, fontFamily: LEXEND }}>{' / '}{fmtEur(g.pres, { showEuro: true, decimals: 2 })}</span>
                    </div>
                    <div style={{ fontSize: 12, color: col, fontFamily: LEXEND }}>{fmtNum(pctCumpl, 0)}%</div>
                  </div>
                  <div style={{ margin: '6px 0 4px' }}><Track pct={Math.min(pctCumpl, 100)} color={col} h={6} /></div>
                  <div style={{ fontSize: 10, color: C.textMuted, display: 'flex', justifyContent: 'space-between', fontFamily: LEXEND }}>
                    <span>Objetivo {g.obj}%</span>
                    <span style={{ color: desv <= 0 ? C.leaf : C.tomato }}>{desv > 0 ? '+' : ''}{fmtEur(desv, { showEuro: false, decimals: 2 })} desv</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* DÍAS PICO */}
        <div>
          <Label>{`Días pico — ${nombreMesLabel} · Facturación bruta`}</Label>
          <Card style={{ marginTop: 10 }}>
            <DiasPicoChart dias={diasPico} media={mediaDiariaPico} />
            <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 12, paddingTop: 12 }}>
              {(() => {
                const validos = diasPico.filter(d => d.valor > 0)
                const max = [...validos].sort((a, b) => b.valor - a.valor)[0]
                const min = [...validos].sort((a, b) => a.valor - b.valor)[0]
                return (
                  <>
                    <Linea label="Día más fuerte" valor={max ? `${NOMBRES_LARGOS[max.idx]} · ${fmtNum(max.valor, 2)}` : '—'} />
                    <Linea label="Día más flojo" valor={min ? `${NOMBRES_LARGOS[min.idx]} · ${fmtNum(min.valor, 2)}` : '—'} />
                    <Linea label="Media diaria" valor={fmtNum(mediaDiariaPico, 2)} />
                  </>
                )
              })()}
            </div>
          </Card>
        </div>
      </Grid>

      {/* FILA 3: Saldo/Proyecciones · Ratio · Punto Equilibrio */}
      <Grid cols={3}>
        {/* PROYECCIONES */}
        <Card>
          <Label>Proyecciones</Label>
          <div style={{ fontFamily: OSWALD, fontSize: 26, fontWeight: 700, color: C.text, marginTop: 8 }}>
            {saldo !== null ? fmtEur(saldo, { showEuro: true, decimals: 2 }) : '—'}
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, fontFamily: LEXEND }}>Saldo cuentas Streat Lab</div>
          <div style={{ marginTop: 14, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
            <div style={{ ...lblXs, marginBottom: 6 }}>COBROS ESTIMADOS</div>
            <Linea label="Cobros 7d" valor={fmtEur(cobros30d * 7 / 30, { showEuro: false, decimals: 2 })} />
            <Linea label="Cobros 30d" valor={fmtEur(cobros30d, { showEuro: false, decimals: 2 })} />
          </div>
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
            <div style={{ ...lblXs, marginBottom: 6 }}>PAGOS FIJOS</div>
            <Linea label="Pagos 30d" valor={fmtEur(gastosFijosMes, { showEuro: false, decimals: 2 })} />
          </div>
        </Card>

        {/* RATIO */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Label>Ratio Ingresos / Gastos</Label>
            <span style={{ fontSize: 11, color: C.leaf, fontFamily: LEXEND }}>Objetivo {fmtNum(objetivoRatio, 2)}</span>
          </div>
          <div style={{ fontFamily: OSWALD, fontSize: 38, fontWeight: 700, color: semaforo(ratioPctObj), marginTop: 8 }}>
            {netoEstimado < 100 || totalGastosPeriodo < 100 ? '—' : fmtNum(ratioVal, 2)}
          </div>
          <div style={{ marginTop: 6, marginBottom: 12 }}>
            <Track pct={Math.min(ratioPctObj, 100)} color={semaforo(ratioPctObj)} h={6} />
            <div style={{ fontSize: 12, color: semaforo(ratioPctObj), marginTop: 4, fontFamily: LEXEND }}>
              {netoEstimado < 100 || totalGastosPeriodo < 100 ? 'Datos insuficientes' : `${ratioVal >= objetivoRatio ? '▲' : '▼'} ${fmtNum(Math.abs(ratioPctObj - 100), 1)}% ${ratioVal >= objetivoRatio ? 'sobre' : 'bajo'} objetivo`}
            </div>
          </div>
          <Linea label="Ingresos netos" valor={fmtEur(netoEstimado, { showEuro: false, decimals: 2 })} />
          <Linea label="Gastos fijos" valor={fmtEur(gastosFijosMes, { showEuro: false, decimals: 2 })} />
          <Linea label="Gastos reales" valor={fmtEur(totalGastosPeriodo, { showEuro: false, decimals: 2 })} />
        </Card>

        {/* PUNTO DE EQUILIBRIO */}
        <Card>
          <Label>Punto de Equilibrio</Label>
          {peCalc.peBruto <= 0 ? (
            <div style={{ fontSize: 12, color: C.textMuted, fontStyle: 'italic', marginTop: 10, fontFamily: LEXEND }}>Datos insuficientes — configura pe_parametros</div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
                <div>
                  <div style={{ fontFamily: OSWALD, fontSize: 22, fontWeight: 700, color: C.text }}>{fmtEur(peCalc.peBruto, { showEuro: false, decimals: 0 })}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, fontFamily: LEXEND }}>Bruto necesario</div>
                </div>
                <div style={{ fontFamily: OSWALD, fontSize: 18, fontWeight: 700, color: semaforo(peCalc.pct) }}>{fmtPct(peCalc.pct, 2)}</div>
              </div>
              <div style={{ margin: '10px 0 4px' }}><Track pct={Math.min(peCalc.pct, 100)} color={semaforo(peCalc.pct)} h={8} /></div>
              <div style={{ fontSize: 11, color: C.textMuted, display: 'flex', justifyContent: 'space-between', fontFamily: LEXEND }}>
                <span>Llevamos {fmtEur(peCalc.acumulado, { showEuro: false, decimals: 2 })}</span>
                <span>Faltan {fmtEur(peCalc.falta, { showEuro: false, decimals: 2 })}</span>
              </div>
            </>
          )}
        </Card>
      </Grid>

      {/* FILA 4: Provisiones · Top ventas */}
      <Grid cols={3}>
        {/* PROVISIONES */}
        <Card>
          <Label>Provisiones y próximos pagos</Label>
          <div style={{ fontFamily: OSWALD, fontSize: 24, fontWeight: 700, color: C.text, marginTop: 8 }}>{fmtEur(totalAGuardar, { showEuro: false, decimals: 2 })}</div>
          <div style={{ fontSize: 11, color: C.textMuted, fontFamily: LEXEND }}>Total provisiones</div>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {proximosPagos.length === 0 ? (
              <div style={{ color: C.textMuted, fontStyle: 'italic', fontSize: 12, fontFamily: LEXEND, textAlign: 'center', padding: '8px 0' }}>Datos insuficientes</div>
            ) : proximosPagos.slice(0, 6).map((p, i) => (
              <Linea key={i} label={`${p.concepto} (${p.fecha})`} valor={fmtEur(p.importe, { showEuro: false, decimals: 2 })} />
            ))}
          </div>
        </Card>

        {/* TOP VENTAS */}
        <Card>
          <Label>Top ventas</Label>
          <div style={{ marginTop: 14, color: C.textMuted, textAlign: 'center', fontSize: 13, fontFamily: LEXEND, padding: '20px 0' }}>
            Sin datos POS
          </div>
        </Card>

        <div />
      </Grid>
    </div>
  )
}

/* ─── Sub-componentes Lymon ─────────────────────── */

const lblBase: React.CSSProperties = { fontFamily: OSWALD, textTransform: 'uppercase', fontWeight: 600 }
const lblSm: React.CSSProperties = { ...lblBase, fontSize: 11, letterSpacing: '1.5px', color: C.textMuted }
const lblXs: React.CSSProperties = { ...lblBase, fontSize: 10, letterSpacing: '1.5px', color: C.textMuted }

function Grid({ cols, children }: { cols: number; children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16, alignItems: 'start' }}>{children}</div>
}
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '22px 24px', ...style }}>{children}</div>
}
function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ ...lblBase, fontSize: 12, letterSpacing: '2px', color: C.lime }}>{children}</div>
}
function Big({ value, sub, color }: { value: string; sub: string; color?: string }) {
  return (
    <div>
      <div style={{ fontFamily: OSWALD, fontSize: 36, fontWeight: 700, color: color ?? C.text, letterSpacing: '-0.01em', lineHeight: 1 }}>{value}</div>
      <div style={{ ...lblXs, color: color ?? C.textMuted, marginTop: 4 }}>{sub}</div>
    </div>
  )
}
function Delta({ v, label }: { v: number; label: string }) {
  const up = v >= 0
  return <div style={{ fontSize: 12, color: up ? C.leaf : C.tomato, margin: '10px 0 0', fontFamily: LEXEND }}>{up ? '▲' : '▼'} {fmtNum(Math.abs(v), 1)}% {label}</div>
}
function Track({ pct, color, h = 5 }: { pct: number; color: string; h?: number }) {
  return (
    <div style={{ height: h, borderRadius: h / 2, background: C.track, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.max(0, Math.min(pct, 100))}%`, background: color, borderRadius: h / 2, transition: 'width 0.5s ease' }} />
    </div>
  )
}
function Barra({ label, val, obj, last }: { label: string; val: number; obj: number; last?: boolean }) {
  const pct = obj > 0 ? Math.min(100, (val / obj) * 100) : 0
  const col = semaforo(pct)
  const faltan = Math.max(0, obj - val)
  return (
    <div style={{ marginBottom: last ? 0 : 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: C.textMuted, fontFamily: LEXEND }}>{label}</span>
        <span style={{ fontSize: 12, color: col, fontFamily: LEXEND }}>{fmtNum(pct, 0)}%</span>
      </div>
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6, fontFamily: LEXEND }}>
        Faltan <span style={{ color: col }}>{fmtEur(faltan, { showEuro: false, decimals: 0 })}</span> de {fmtEur(obj, { showEuro: false, decimals: 0 })}
      </div>
      <Track pct={pct} color={col} h={8} />
    </div>
  )
}
function Linea({ label, valor, bold }: { label: string; valor: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, fontFamily: LEXEND, fontWeight: bold ? 600 : 400 }}>
      <span style={{ color: C.textMuted }}>{label}</span>
      <span style={{ color: C.text }}>{valor}</span>
    </div>
  )
}
function DiasPicoChart({ dias, media }: { dias: { idx: number; nombre: string; valor: number; color: string }[]; media: number }) {
  const max = Math.max(...dias.map(d => d.valor), 1)
  const sinDatos = dias.every(d => d.valor === 0)
  if (sinDatos) return <div style={{ textAlign: 'center', color: C.textMuted, fontSize: 12, fontFamily: LEXEND, padding: '40px 0' }}>Sin datos en este periodo</div>
  const SVG_BASE = 190, SVG_MAX_H = 125
  const POS_X_TEXTO = [35, 100, 165, 230, 295, 360, 425]
  const POS_X_BARRA = [15, 80, 145, 210, 275, 340, 405]
  const altura = (v: number) => v <= 0 ? 0 : Math.max(30, (v / max) * SVG_MAX_H)
  const mediaH = media > 0 ? Math.min((media / max) * SVG_MAX_H, SVG_MAX_H) : 0
  const mediaY = SVG_BASE - mediaH
  return (
    <svg viewBox="0 0 480 230" style={{ width: '100%', height: 'auto' }} xmlns="http://www.w3.org/2000/svg" fontFamily="Lexend, sans-serif">
      {dias.map((d, i) => <text key={`v${i}`} x={POS_X_TEXTO[i]} y="20" fontSize="11" fill={C.textMuted} textAnchor="middle">{d.valor > 0 ? fmtNum(d.valor, 0) : ''}</text>)}
      {dias.map((d, i) => { const h = altura(d.valor); return <rect key={`b${i}`} x={POS_X_BARRA[i]} y={SVG_BASE - h} width="40" height={h} fill={d.valor > 0 ? d.color : C.track} rx="3" /> })}
      {media > 0 && <>
        <line x1="15" y1={mediaY} x2="445" y2={mediaY} stroke={C.textMuted} strokeWidth="1.5" strokeDasharray="6 4" />
        <text x="445" y={mediaY - 6} fontSize="11" fill={C.textMuted} textAnchor="end">{`Media: ${fmtNum(media, 0)}`}</text>
      </>}
      {dias.map((d, i) => <text key={`l${i}`} x={POS_X_TEXTO[i]} y="210" fontSize="12" fill={C.textMuted} textAnchor="middle">{d.nombre}</text>)}
    </svg>
  )
}
