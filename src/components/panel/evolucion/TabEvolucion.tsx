/**
 * TabEvolucion — Panel Global v4
 *
 * 4 cards reales basadas en datos Supabase:
 *  1. Ingresos totales: Bruto + Neto (estimado/real) + comparativa elegible + objetivo
 *  2. Heatmap día-semana × plataforma (qué plataforma gana cada día)
 *  3. Top 5 marcas % + delta vs período comparado
 *  4. Grupos de gasto desde tabla `running` (vacía hoy → "sin datos")
 *
 * Selector "Comparar contra":
 *  - Período anterior (mismo nº días justo antes)
 *  - Mismo período año pasado
 *  - Mismo período hace 2 años
 *  - Sin comparar
 */

import { useEffect, useState, useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart, Cell,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/lib/format'
import { COLORS, FONT, OSWALD, LEXEND, card, lbl } from '@/components/panel/resumen/tokens'
import { calcNetoPorCanal, useConfigCanales, useMarcasPorCanal } from '@/lib/panel/calcNetoPlataforma'

/* ─── helpers fecha ─────────────────────────────── */
function toStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function diffDays(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}
function labelDia(fecha: string) {
  const [,m,d] = fecha.split('-')
  return `${Number(d)}/${Number(m)}`
}
function nombreMes(mes: number) {
  return ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][mes-1]
}
function diaSemanaIdx(fecha: string): number {
  // 0=Lun, 6=Dom
  const d = new Date(fecha + 'T00:00:00')
  return (d.getDay() + 6) % 7
}
const NOMBRES_DIAS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']

/* ─── tipos ─────────────────────────────────────── */
interface RowFac {
  fecha: string
  uber_pedidos: number; uber_bruto: number
  glovo_pedidos: number; glovo_bruto: number
  je_pedidos: number; je_bruto: number
  web_pedidos: number; web_bruto: number
  directa_pedidos: number; directa_bruto: number
  total_pedidos: number; total_bruto: number
  marca_id: string | null
}
interface Marca { id: string; nombre: string; activa: boolean }
interface IngMensual { anio: number; mes: number; base_imponible: number; canal: string }
type RowRunningRaw = Record<string, unknown>
interface RunningItem {
  anio: number; mes: number
  ingresos_brutos: number; ingresos_netos: number
  producto: number; personal: number; local: number; controlables: number
}

/* ─── parse running ─────────────────────────────── */
function parseRunning(raw: RowRunningRaw[]): RunningItem[] {
  return raw.map(r => ({
    anio: Number(r['año'] ?? r['anio'] ?? 0),
    mes: Number(r['mes'] ?? 0),
    ingresos_brutos: Number(r['ingresos_brutos'] ?? 0),
    ingresos_netos: Number(r['ingresos_netos'] ?? 0),
    producto: Number(r['producto'] ?? 0),
    personal: Number(r['personal'] ?? 0),
    local: Number(r['local'] ?? 0),
    controlables: Number(r['controlables'] ?? 0),
  }))
}

/* ─── modo comparación ──────────────────────────── */
type Compare = 'previo' | 'y1' | 'y2' | 'none'
const COMPARE_LABELS: Record<Compare, string> = {
  previo: 'vs período anterior',
  y1: 'vs mismo período hace 1 año',
  y2: 'vs mismo período hace 2 años',
  none: 'sin comparar',
}

function calcularRangoComparado(desde: Date, hasta: Date, modo: Compare): { desde: Date; hasta: Date } | null {
  if (modo === 'none') return null
  const dias = diffDays(desde, hasta) + 1
  if (modo === 'previo') {
    const h = new Date(desde); h.setDate(h.getDate() - 1)
    const d = new Date(h);     d.setDate(d.getDate() - (dias - 1))
    return { desde: d, hasta: h }
  }
  const yearsBack = modo === 'y1' ? 1 : 2
  const d = new Date(desde); d.setFullYear(d.getFullYear() - yearsBack)
  const h = new Date(hasta); h.setFullYear(h.getFullYear() - yearsBack)
  return { desde: d, hasta: h }
}

/* ─── tooltip oscuro ────────────────────────────── */
const TooltipOscuro = ({ active, payload, label, suffix }: {
  active?: boolean
  payload?: Array<{name: string; value: number; color: string}>
  label?: string
  suffix?: 'eur' | 'pct'
}) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1e2233', color: '#fff', borderRadius: 8,
      padding: '8px 12px', fontSize: 12, fontFamily: LEXEND,
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)', pointerEvents: 'none',
    }}>
      <div style={{ marginBottom: 4, opacity: 0.7 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
          <span style={{ opacity: 0.8 }}>{p.name}:</span>
          <span style={{ fontWeight: 600 }}>
            {suffix === 'pct'
              ? `${p.value.toFixed(1)}%`
              : fmtEur(p.value, { showEuro: true, decimals: 0 })}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ─── shells ────────────────────────────────────── */
function Skeleton({ h = 160 }: { h?: number }) {
  return (
    <div style={{
      height: h, borderRadius: 8, background: '#ebe8e2',
      animation: 'pulse 1.5s ease-in-out infinite',
    }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:.5} 50%{opacity:1} }`}</style>
    </div>
  )
}
function SinDatos({ h = 160, msg }: { h?: number; msg?: string }) {
  return (
    <div style={{
      height: h, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: COLORS.mut, fontFamily: LEXEND, fontSize: 12, textAlign: 'center',
      padding: '0 16px',
    }}>
      {msg ?? 'Sin datos para el período'}
    </div>
  )
}

function CardEvo({
  label, sub, headerRight, children,
}: { label: string; sub?: React.ReactNode; headerRight?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ ...card, padding: '18px 20px', minHeight: 320, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div style={lbl}>{label}</div>
        {headerRight}
      </div>
      {sub && <div style={{ marginBottom: 12 }}>{sub}</div>}
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      fontSize: 10, fontFamily: OSWALD, letterSpacing: 1, textTransform: 'uppercase',
      background: color + '22', color, fontWeight: 600,
    }}>{children}</span>
  )
}

function Delta({ pct }: { pct: number | null }) {
  if (pct === null || !isFinite(pct)) return null
  const positivo = pct >= 0
  return (
    <span style={{
      fontFamily: OSWALD, fontSize: 11, color: positivo ? '#1D9E75' : '#B01D23',
    }}>
      {positivo ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

/* ─── selector compare ──────────────────────────── */
function SelectorCompare({ value, onChange }: { value: Compare; onChange: (c: Compare) => void }) {
  const opts: { id: Compare; label: string }[] = [
    { id: 'previo', label: 'Período anterior' },
    { id: 'y1',     label: 'Hace 1 año' },
    { id: 'y2',     label: 'Hace 2 años' },
    { id: 'none',   label: 'Sin comparar' },
  ]
  return (
    <div style={{
      display: 'flex', gap: 4, marginBottom: 16, padding: 4,
      background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 8, width: 'fit-content',
    }}>
      <span style={{
        padding: '4px 10px', fontSize: 11, fontFamily: LEXEND, color: COLORS.mut,
        borderRight: '0.5px solid #d0c8bc', display: 'flex', alignItems: 'center',
      }}>Comparar contra</span>
      {opts.map(o => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          style={{
            padding: '4px 12px', borderRadius: 5, fontSize: 11, fontFamily: LEXEND,
            cursor: 'pointer', border: 'none',
            background: value === o.id ? '#3a4050' : 'transparent',
            color: value === o.id ? '#fff' : COLORS.mut,
            fontWeight: value === o.id ? 500 : 400,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ─── Props ─────────────────────────────────────── */
interface Props {
  fechaDesde: Date
  fechaHasta: Date
  canalesFiltro: string[]
}

/* ─── canales ───────────────────────────────────── */
const CANALES_DEF = [
  { id: 'uber',  label: 'Uber Eats', color: '#06C167', brutoKey: 'uber_bruto'    as const, pedKey: 'uber_pedidos'    as const },
  { id: 'glovo', label: 'Glovo',     color: '#aabc00', brutoKey: 'glovo_bruto'   as const, pedKey: 'glovo_pedidos'   as const },
  { id: 'je',    label: 'Just Eat',  color: '#f5a623', brutoKey: 'je_bruto'      as const, pedKey: 'je_pedidos'      as const },
  { id: 'web',   label: 'Web',       color: '#7F77DD', brutoKey: 'web_bruto'     as const, pedKey: 'web_pedidos'     as const },
  { id: 'dir',   label: 'Directa',   color: '#484f66', brutoKey: 'directa_bruto' as const, pedKey: 'directa_pedidos' as const },
]
const COLORES_PLATAFORMA: Record<string, string> = {
  uber: '#06C167', glovo: '#e8f442', je: '#f5a623', web: '#7F77DD', dir: '#484f66',
}

/* ─── componente principal ──────────────────────── */
export default function TabEvolucion({ fechaDesde, fechaHasta, canalesFiltro }: Props) {
  const [compare, setCompare] = useState<Compare>('previo')

  const [rows, setRows]               = useState<RowFac[]>([])
  const [rowsCmp, setRowsCmp]         = useState<RowFac[]>([])
  const [marcas, setMarcas]           = useState<Marca[]>([])
  const [running, setRunning]         = useState<RunningItem[]>([])
  const [runningCmp, setRunningCmp]   = useState<RunningItem[]>([])
  const [objetivoMes, setObjetivoMes] = useState<number>(0)
  const [loading, setLoading]         = useState(true)
  // datos liquidaciones reales (si las hay)
  const [liqUber, setLiqUber]         = useState<Map<string, number>>(new Map())
  const [liqGlovo, setLiqGlovo]       = useState<Map<string, number>>(new Map())
  const [liqJE, setLiqJE]             = useState<Map<string, number>>(new Map())

  const configCanales = useConfigCanales()
  const marcasPorCanal = useMarcasPorCanal()

  const rangoCmp = useMemo(() => calcularRangoComparado(fechaDesde, fechaHasta, compare),
    [fechaDesde, fechaHasta, compare])

  const dias = diffDays(fechaDesde, fechaHasta) + 1

  /* ─── carga datos período actual ─────────────── */
  useEffect(() => {
    setLoading(true)
    supabase
      .from('facturacion_diario')
      .select('*')
      .gte('fecha', toStr(fechaDesde))
      .lte('fecha', toStr(fechaHasta))
      .order('fecha', { ascending: true })
      .then(({ data }) => {
        setRows((data ?? []) as RowFac[])
        setLoading(false)
      })
  }, [fechaDesde, fechaHasta])

  /* ─── carga datos período comparado ──────────── */
  useEffect(() => {
    if (!rangoCmp) { setRowsCmp([]); return }
    supabase
      .from('facturacion_diario')
      .select('*')
      .gte('fecha', toStr(rangoCmp.desde))
      .lte('fecha', toStr(rangoCmp.hasta))
      .order('fecha', { ascending: true })
      .then(({ data }) => setRowsCmp((data ?? []) as RowFac[]))
  }, [rangoCmp])

  /* ─── carga marcas ───────────────────────────── */
  useEffect(() => {
    supabase.from('marcas').select('id,nombre,activa')
      .then(({ data }) => setMarcas((data ?? []) as Marca[]))
  }, [])

  /* ─── carga running período actual ───────────── */
  useEffect(() => {
    const aD = fechaDesde.getFullYear()
    const mD = fechaDesde.getMonth() + 1
    const aH = fechaHasta.getFullYear()
    const mH = fechaHasta.getMonth() + 1
    supabase
      .from('running')
      .select('*')
      .or(`and(año.eq.${aD},mes.gte.${mD}),and(año.eq.${aH},mes.lte.${mH})`)
      .then(({ data }) => setRunning(parseRunning((data ?? []) as RowRunningRaw[])))
  }, [fechaDesde, fechaHasta])

  /* ─── carga running período comparado ────────── */
  useEffect(() => {
    if (!rangoCmp) { setRunningCmp([]); return }
    const aD = rangoCmp.desde.getFullYear()
    const mD = rangoCmp.desde.getMonth() + 1
    const aH = rangoCmp.hasta.getFullYear()
    const mH = rangoCmp.hasta.getMonth() + 1
    supabase
      .from('running')
      .select('*')
      .or(`and(año.eq.${aD},mes.gte.${mD}),and(año.eq.${aH},mes.lte.${mH})`)
      .then(({ data }) => setRunningCmp(parseRunning((data ?? []) as RowRunningRaw[])))
  }, [rangoCmp])

  /* ─── carga objetivo mensual del mes en curso ─ */
  useEffect(() => {
    const a = fechaDesde.getFullYear()
    const m = fechaDesde.getMonth() + 1
    supabase
      .from('objetivos')
      .select('importe')
      .eq('tipo', 'mensual')
      .eq('anio', a).eq('mes', m)
      .then(({ data }) => {
        if (data && data.length > 0) setObjetivoMes(Number(data[0].importe))
        else setObjetivoMes(0)
      })
  }, [fechaDesde])

  /* ─── carga liquidaciones reales si hay ──────── */
  useEffect(() => {
    const fD = toStr(fechaDesde), fH = toStr(fechaHasta)
    Promise.all([
      supabase.from('uber_liquidaciones').select('fecha_inicio,fecha_fin,neto_total').gte('fecha_fin', fD).lte('fecha_inicio', fH).then(r => r.data ?? []),
      supabase.from('glovo_liquidaciones').select('fecha_inicio,fecha_fin,neto_total').gte('fecha_fin', fD).lte('fecha_inicio', fH).then(r => r.data ?? []),
      supabase.from('justeat_liquidaciones').select('fecha_inicio,fecha_fin,neto_total').gte('fecha_fin', fD).lte('fecha_inicio', fH).then(r => r.data ?? []),
    ]).then(([u, g, j]) => {
      const buildMap = (rows: any[]) => {
        const m = new Map<string, number>()
        for (const r of rows) {
          const key = `${r.fecha_inicio}_${r.fecha_fin}`
          m.set(key, (m.get(key) || 0) + Number(r.neto_total || 0))
        }
        return m
      }
      setLiqUber(buildMap(u))
      setLiqGlovo(buildMap(g))
      setLiqJE(buildMap(j))
    })
  }, [fechaDesde, fechaHasta])

  const tieneAlgunaLiqReal = liqUber.size + liqGlovo.size + liqJE.size > 0

  /* ─── agregados período actual ────────────────── */
  const agg = useMemo(() => {
    const filtrar = (c: string) => canalesFiltro.length === 0 || canalesFiltro.includes(c)
    let bruto = 0
    const pCan: Record<string, { bruto: number; pedidos: number }> = {
      uber: {bruto:0,pedidos:0}, glovo:{bruto:0,pedidos:0}, je:{bruto:0,pedidos:0},
      web:{bruto:0,pedidos:0}, dir:{bruto:0,pedidos:0},
    }
    const pMarca = new Map<string, number>()
    const pHeatmap: Record<string, number[]> = {
      uber: [0,0,0,0,0,0,0], glovo: [0,0,0,0,0,0,0], je: [0,0,0,0,0,0,0],
      web: [0,0,0,0,0,0,0], dir: [0,0,0,0,0,0,0],
    }
    const porFecha: Array<{
      fecha: string; bruto: number;
      uber: number; glovo: number; je: number; web: number; dir: number
    }> = []

    for (const r of rows) {
      let dayBruto = 0
      let dayU = 0, dayG = 0, dayJ = 0, dayW = 0, dayD = 0
      const dia = diaSemanaIdx(r.fecha)
      if (filtrar('uber'))  { pCan.uber.bruto  += r.uber_bruto  ?? 0; pCan.uber.pedidos  += r.uber_pedidos  ?? 0; dayBruto += r.uber_bruto ?? 0; dayU = r.uber_bruto ?? 0; pHeatmap.uber[dia] += r.uber_bruto ?? 0 }
      if (filtrar('glovo')) { pCan.glovo.bruto += r.glovo_bruto ?? 0; pCan.glovo.pedidos += r.glovo_pedidos ?? 0; dayBruto += r.glovo_bruto ?? 0; dayG = r.glovo_bruto ?? 0; pHeatmap.glovo[dia] += r.glovo_bruto ?? 0 }
      if (filtrar('je'))    { pCan.je.bruto    += r.je_bruto    ?? 0; pCan.je.pedidos    += r.je_pedidos    ?? 0; dayBruto += r.je_bruto ?? 0; dayJ = r.je_bruto ?? 0; pHeatmap.je[dia] += r.je_bruto ?? 0 }
      if (filtrar('web'))   { pCan.web.bruto   += r.web_bruto   ?? 0; pCan.web.pedidos   += r.web_pedidos   ?? 0; dayBruto += r.web_bruto ?? 0; dayW = r.web_bruto ?? 0; pHeatmap.web[dia] += r.web_bruto ?? 0 }
      if (filtrar('dir'))   { pCan.dir.bruto   += r.directa_bruto ?? 0; pCan.dir.pedidos += r.directa_pedidos ?? 0; dayBruto += r.directa_bruto ?? 0; dayD = r.directa_bruto ?? 0; pHeatmap.dir[dia] += r.directa_bruto ?? 0 }
      bruto += dayBruto
      if (r.marca_id) pMarca.set(r.marca_id, (pMarca.get(r.marca_id) ?? 0) + dayBruto)
      porFecha.push({ fecha: r.fecha, bruto: dayBruto, uber: dayU, glovo: dayG, je: dayJ, web: dayW, dir: dayD })
    }

    // calcular neto estimado por canal con config_canales
    const netoCan: Record<string, number> = {}
    for (const c of CANALES_DEF) {
      const { bruto: b, pedidos } = pCan[c.id]
      const { neto } = calcNetoPorCanal(c.id, b, pedidos, marcasPorCanal, fechaDesde, fechaHasta, configCanales)
      netoCan[c.id] = neto
    }
    const netoEstimado = Object.values(netoCan).reduce((a, n) => a + n, 0)
    return { bruto, netoEstimado, pCan, netoCan, pMarca, pHeatmap, porFecha }
  }, [rows, canalesFiltro, marcasPorCanal, fechaDesde, fechaHasta, configCanales])

  /* ─── agregados período comparado ─────────────── */
  const aggCmp = useMemo(() => {
    const filtrar = (c: string) => canalesFiltro.length === 0 || canalesFiltro.includes(c)
    let bruto = 0
    const pCan: Record<string, { bruto: number; pedidos: number }> = {
      uber: {bruto:0,pedidos:0}, glovo:{bruto:0,pedidos:0}, je:{bruto:0,pedidos:0},
      web:{bruto:0,pedidos:0}, dir:{bruto:0,pedidos:0},
    }
    const pMarca = new Map<string, number>()
    for (const r of rowsCmp) {
      if (filtrar('uber'))  { pCan.uber.bruto  += r.uber_bruto  ?? 0; pCan.uber.pedidos  += r.uber_pedidos  ?? 0; bruto += r.uber_bruto ?? 0 }
      if (filtrar('glovo')) { pCan.glovo.bruto += r.glovo_bruto ?? 0; pCan.glovo.pedidos += r.glovo_pedidos ?? 0; bruto += r.glovo_bruto ?? 0 }
      if (filtrar('je'))    { pCan.je.bruto    += r.je_bruto    ?? 0; pCan.je.pedidos    += r.je_pedidos    ?? 0; bruto += r.je_bruto ?? 0 }
      if (filtrar('web'))   { pCan.web.bruto   += r.web_bruto   ?? 0; pCan.web.pedidos   += r.web_pedidos   ?? 0; bruto += r.web_bruto ?? 0 }
      if (filtrar('dir'))   { pCan.dir.bruto   += r.directa_bruto ?? 0; pCan.dir.pedidos += r.directa_pedidos ?? 0; bruto += r.directa_bruto ?? 0 }
      if (r.marca_id) {
        let dayBruto = 0
        if (filtrar('uber'))  dayBruto += r.uber_bruto ?? 0
        if (filtrar('glovo')) dayBruto += r.glovo_bruto ?? 0
        if (filtrar('je'))    dayBruto += r.je_bruto ?? 0
        if (filtrar('web'))   dayBruto += r.web_bruto ?? 0
        if (filtrar('dir'))   dayBruto += r.directa_bruto ?? 0
        pMarca.set(r.marca_id, (pMarca.get(r.marca_id) ?? 0) + dayBruto)
      }
    }
    return { bruto, pCan, pMarca }
  }, [rowsCmp, canalesFiltro])

  const brutoDelta = aggCmp.bruto > 0 ? ((agg.bruto - aggCmp.bruto) / aggCmp.bruto) * 100 : null

  /* ─── Card 1: serie temporal acumulado vs comparado ─── */
  const dataAcumulado = useMemo(() => {
    const mapAct = new Map<string, number>()
    for (const p of agg.porFecha) mapAct.set(p.fecha, p.bruto)

    const mapCmp = new Map<string, number>()
    for (const r of rowsCmp) {
      const t = (r.uber_bruto??0) + (r.glovo_bruto??0) + (r.je_bruto??0) + (r.web_bruto??0) + (r.directa_bruto??0)
      mapCmp.set(r.fecha, t)
    }

    const fechas: string[] = []
    const d = new Date(fechaDesde)
    while (d <= fechaHasta) { fechas.push(toStr(d)); d.setDate(d.getDate() + 1) }

    const fechasCmp: string[] = []
    if (rangoCmp) {
      const dc = new Date(rangoCmp.desde)
      while (dc <= rangoCmp.hasta) { fechasCmp.push(toStr(dc)); dc.setDate(dc.getDate() + 1) }
    }

    let accAct = 0, accCmp = 0
    const objDiario = objetivoMes > 0 ? objetivoMes / 30 : 0

    return fechas.map((f, i) => {
      accAct += mapAct.get(f) ?? 0
      const fc = fechasCmp[i]
      if (fc) accCmp += mapCmp.get(fc) ?? 0
      const point: Record<string, number | string> = {
        name: labelDia(f),
        Actual: Math.round(accAct),
      }
      if (rangoCmp)   point.Comparado = Math.round(accCmp)
      if (objetivoMes > 0) point.Objetivo = Math.round((i + 1) * objDiario)
      return point
    })
  }, [agg.porFecha, rowsCmp, fechaDesde, fechaHasta, rangoCmp, objetivoMes])

  /* ─── Card 2: heatmap día-semana × plataforma ────── */
  const heatmapData = useMemo(() => {
    // Para cada plataforma, normalizar a % del bruto del día
    return CANALES_DEF.filter(c => canalesFiltro.length === 0 || canalesFiltro.includes(c.id))
      .map(c => {
        const valores = agg.pHeatmap[c.id]
        const max = Math.max(...valores, 1)
        return {
          plataforma: c.label,
          color: c.color,
          id: c.id,
          dias: NOMBRES_DIAS.map((nombre, i) => ({
            dia: nombre, bruto: valores[i], pct: (valores[i] / max) * 100,
          })),
          total: valores.reduce((a, b) => a + b, 0),
        }
      })
  }, [agg.pHeatmap, canalesFiltro])

  /* ─── Card 3: Top 5 marcas + delta vs comparado ───── */
  const topMarcas = useMemo(() => {
    const arr: Array<{ id: string; nombre: string; bruto: number; brutoCmp: number; pct: number; delta: number | null }> = []
    for (const [id, bruto] of agg.pMarca.entries()) {
      const m = marcas.find(x => x.id === id)
      if (!m) continue
      const brutoCmp = aggCmp.pMarca.get(id) ?? 0
      arr.push({
        id, nombre: m.nombre, bruto, brutoCmp,
        pct: agg.bruto > 0 ? (bruto / agg.bruto) * 100 : 0,
        delta: brutoCmp > 0 ? ((bruto - brutoCmp) / brutoCmp) * 100 : null,
      })
    }
    arr.sort((a, b) => b.bruto - a.bruto)
    return arr.slice(0, 5)
  }, [agg.pMarca, agg.bruto, aggCmp.pMarca, marcas])

  /* ─── Card 4: grupos de gasto desde running ─────── */
  const runningAgg = useMemo(() => {
    const sum = (rs: RunningItem[]) => rs.reduce((a, r) => ({
      ingresos: a.ingresos + r.ingresos_netos,
      producto: a.producto + r.producto,
      personal: a.personal + r.personal,
      local: a.local + r.local,
      controlables: a.controlables + r.controlables,
    }), { ingresos: 0, producto: 0, personal: 0, local: 0, controlables: 0 })
    return { act: sum(running), cmp: sum(runningCmp) }
  }, [running, runningCmp])

  /* ─── helpers de cara a UI ──────────────────────── */
  const axisProps = {
    tick: { fontSize: 10, fontFamily: LEXEND, fill: COLORS.mut },
    axisLine: false as const,
    tickLine: false as const,
  }
  const gridProps = { strokeDasharray: '3 3', stroke: '#ebe8e2', vertical: false as const }

  const heatColor = (color: string, pct: number) => {
    const alpha = Math.round((pct / 100) * 220 + 20).toString(16).padStart(2,'0')
    return color + alpha
  }
  const textOnHeat = (pct: number) => pct > 55 ? '#fff' : '#111'

  return (
    <div style={{ marginTop: 18, color: COLORS.pri, fontFamily: FONT.body }}>

      <SelectorCompare value={compare} onChange={setCompare} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* ─── Card 1: Ingresos totales ─── */}
        <CardEvo
          label="INGRESOS TOTALES"
          headerRight={<Delta pct={brutoDelta} />}
          sub={
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: OSWALD, fontSize: 26, fontWeight: 600, color: COLORS.pri }}>
                  {fmtEur(agg.bruto, { showEuro: false, decimals: 0 })}
                </span>
                <span style={{ fontSize: 11, color: COLORS.mut }}>bruto · {dias} {dias === 1 ? 'día' : 'días'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
                <span style={{ fontFamily: OSWALD, fontSize: 18, color: '#1D9E75' }}>
                  {fmtEur(agg.netoEstimado, { showEuro: false, decimals: 0 })}
                </span>
                <span style={{ fontSize: 10, color: COLORS.mut }}>neto</span>
                <Badge color={tieneAlgunaLiqReal ? '#1D9E75' : '#f5a623'}>
                  {tieneAlgunaLiqReal ? 'parcial real' : 'estimado'}
                </Badge>
              </div>
              {compare !== 'none' && (
                <div style={{ fontSize: 11, color: COLORS.mut, marginTop: 4 }}>
                  {COMPARE_LABELS[compare]}: {fmtEur(aggCmp.bruto, { showEuro: true, decimals: 0 })}
                </div>
              )}
            </div>
          }
        >
          {loading ? <Skeleton /> : dataAcumulado.length === 0 ? <SinDatos /> : (
            <ResponsiveContainer width="100%" height={170}>
              <ComposedChart data={dataAcumulado} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gradActE" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#B01D23" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#B01D23" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${v}`} width={42} />
                <Tooltip content={<TooltipOscuro suffix="eur" />} />
                <Area type="monotone" dataKey="Actual" stroke="#B01D23" strokeWidth={2} fill="url(#gradActE)" dot={false} activeDot={{ r: 4, fill: '#B01D23' }} />
                {compare !== 'none' && (
                  <Line type="monotone" dataKey="Comparado" stroke="#7a8090" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                )}
                {objetivoMes > 0 && (
                  <Line type="monotone" dataKey="Objetivo" stroke="#1D9E75" strokeWidth={1.5} strokeDasharray="2 2" dot={false} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          )}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: COLORS.mut, marginTop: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 12, height: 10, background: '#B01D23', borderRadius: 2 }} /> Actual
            </span>
            {compare !== 'none' && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 12, borderTop: '1.5px dashed #7a8090' }} /> {COMPARE_LABELS[compare].replace('vs ','')}
              </span>
            )}
            {objetivoMes > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 12, borderTop: '1.5px dashed #1D9E75' }} /> Objetivo
              </span>
            )}
          </div>
        </CardEvo>

        {/* ─── Card 2: Heatmap día × plataforma ─── */}
        <CardEvo
          label="PLATAFORMA × DÍA DE LA SEMANA"
          sub={
            <div style={{ fontSize: 11, color: COLORS.mut }}>
              Qué plataforma vendió más cada día · facturación bruta
            </div>
          }
        >
          {loading ? <Skeleton h={200} /> :
           heatmapData.length === 0 || heatmapData.every(p => p.total === 0) ? <SinDatos h={200} /> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: LEXEND, fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontFamily: OSWALD, fontSize: 10, letterSpacing: 1, color: COLORS.mut }}>Plataforma</th>
                    {NOMBRES_DIAS.map(d => (
                      <th key={d} style={{ padding: '6px 4px', textAlign: 'center', fontFamily: OSWALD, fontSize: 10, letterSpacing: 1, color: COLORS.mut }}>{d}</th>
                    ))}
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontFamily: OSWALD, fontSize: 10, letterSpacing: 1, color: COLORS.mut }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {heatmapData.filter(p => p.total > 0).map(p => (
                    <tr key={p.id}>
                      <td style={{ padding: '6px 8px', color: p.color, fontFamily: OSWALD, fontSize: 11 }}>{p.plataforma}</td>
                      {p.dias.map((d, i) => (
                        <td key={i} style={{
                          padding: '8px 4px', textAlign: 'center',
                          background: d.bruto > 0 ? heatColor(p.color, d.pct) : 'transparent',
                          color: textOnHeat(d.pct),
                          fontSize: 10, fontFamily: OSWALD,
                          borderRadius: 4,
                        }}>
                          {d.bruto > 0 ? fmtEur(d.bruto, { showEuro: false, decimals: 0 }) : '–'}
                        </td>
                      ))}
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: COLORS.pri, fontFamily: OSWALD, fontSize: 11, fontWeight: 600 }}>
                        {fmtEur(p.total, { showEuro: false, decimals: 0 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardEvo>

        {/* ─── Card 3: Top 5 marcas ─── */}
        <CardEvo
          label="TOP 5 MARCAS · BRUTO"
          sub={
            topMarcas.length > 0 && (
              <div style={{ fontSize: 11, color: COLORS.mut }}>
                {topMarcas[0].nombre} lidera · {topMarcas[0].pct.toFixed(1)}% del total
              </div>
            )
          }
        >
          {loading ? <Skeleton h={220} /> : topMarcas.length === 0 ? <SinDatos h={220} msg="Sin facturación con marca asignada en el período" /> : (
            <div style={{ paddingTop: 4 }}>
              {topMarcas.map(m => (
                <div key={m.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 12, color: COLORS.pri, fontFamily: LEXEND }}>{m.nombre}</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                      <span style={{ fontFamily: OSWALD, fontSize: 13, color: COLORS.pri, fontWeight: 600 }}>
                        {fmtEur(m.bruto, { showEuro: true, decimals: 0 })}
                      </span>
                      <span style={{ fontFamily: OSWALD, fontSize: 11, color: COLORS.mut }}>
                        {m.pct.toFixed(1)}%
                      </span>
                      {compare !== 'none' && <Delta pct={m.delta} />}
                    </div>
                  </div>
                  <div style={{ height: 6, background: '#ebe8e2', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: 6, width: `${Math.min(m.pct, 100)}%`, background: '#B01D23' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardEvo>

        {/* ─── Card 4: Grupos de gasto desde running ─── */}
        <CardEvo
          label="GRUPOS DE GASTO · DESDE RUNNING"
          sub={
            <div style={{ fontSize: 11, color: COLORS.mut }}>
              Producto · Equipo · Local · Controlables · datos mensuales
            </div>
          }
        >
          {running.length === 0 ? (
            <SinDatos h={220} msg="Sin datos en tabla running para este período. Pendiente conectar conciliación → running." />
          ) : (() => {
            const ing = runningAgg.act.ingresos
            if (ing <= 0) return <SinDatos h={220} msg="Tabla running sin ingresos netos registrados." />
            const grupos = [
              { name: 'Producto',     act: runningAgg.act.producto,     cmp: runningAgg.cmp.producto,     color: '#B01D23' },
              { name: 'Equipo',       act: runningAgg.act.personal,     cmp: runningAgg.cmp.personal,     color: '#06C167' },
              { name: 'Local',        act: runningAgg.act.local,        cmp: runningAgg.cmp.local,        color: '#f5a623' },
              { name: 'Controlables', act: runningAgg.act.controlables, cmp: runningAgg.cmp.controlables, color: '#66aaff' },
            ].map(g => {
              const ingCmp = runningAgg.cmp.ingresos
              return {
                ...g,
                pctAct: ing > 0 ? (g.act / ing) * 100 : 0,
                pctCmp: ingCmp > 0 ? (g.cmp / ingCmp) * 100 : 0,
              }
            })
            return (
              <div style={{ paddingTop: 4 }}>
                {grupos.map(g => (
                  <div key={g.name} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, alignItems: 'baseline' }}>
                      <span style={{ fontSize: 12, color: COLORS.pri, fontFamily: LEXEND }}>{g.name}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                        <span style={{ fontFamily: OSWALD, fontSize: 13, color: g.color, fontWeight: 600 }}>
                          {g.pctAct.toFixed(1)}%
                        </span>
                        <span style={{ fontFamily: OSWALD, fontSize: 11, color: COLORS.mut }}>
                          {fmtEur(g.act, { showEuro: true, decimals: 0 })}
                        </span>
                        {compare !== 'none' && g.pctCmp > 0 && (
                          <span style={{ fontFamily: OSWALD, fontSize: 11, color: g.pctAct < g.pctCmp ? '#1D9E75' : '#B01D23' }}>
                            {g.pctAct >= g.pctCmp ? '▲' : '▼'} {Math.abs(g.pctAct - g.pctCmp).toFixed(1)}pp
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ height: 6, background: '#ebe8e2', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: 6, width: `${Math.min(g.pctAct, 100)}%`, background: g.color }} />
                    </div>
                  </div>
                ))}
                <div style={{ fontSize: 10, color: COLORS.mut, marginTop: 8 }}>
                  Prime Cost: {(grupos[0].pctAct + grupos[1].pctAct).toFixed(1)}% · obj 60-65%
                </div>
              </div>
            )
          })()}
        </CardEvo>

      </div>
    </div>
  )
}
