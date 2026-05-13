/**
 * TabEvolucion — Panel Global v3
 * Card 1: Ingresos brutos acumulados vs mes anterior + objetivo
 * Card 2: Plataforma — barras apiladas diarias
 * Card 3: Top 5 marcas (horizontal)
 * Card 4: Grupos de gasto — % s/ingresos, últimos 7 meses (siempre fijo)
 */

import { useEffect, useState, useMemo } from 'react'
import {
  AreaChart, Area,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/lib/format'
import { COLORS, FONT, OSWALD, LEXEND, card, lbl } from '@/components/panel/resumen/tokens'

/* ── helpers ───────────────────────────────────── */
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
function nombreMes(mes: number, short = true) {
  const m = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return short ? m[mes-1] : m[mes-1]
}

/* ── tipos ─────────────────────────────────────── */
interface RowFac {
  fecha: string
  uber_bruto: number; glovo_bruto: number; je_bruto: number
  web_bruto: number; directa_bruto: number; total_bruto: number
  marca_id: number | null
}

type RowRunningRaw = Record<string, unknown>

interface RunningItem {
  anio: number
  mes: number
  ingresos_netos: number
  producto: number
  equipo: number
  local: number
  controlables: number
}

interface Marca { id: number; nombre: string }

function parseRunning(raw: RowRunningRaw[]): RunningItem[] {
  return raw.map(r => ({
    anio: Number(r['año'] ?? r['anio'] ?? 0),
    mes: Number(r['mes'] ?? 0),
    ingresos_netos: Number(r['ingresos_netos'] ?? r['neto'] ?? 0),
    producto: Number(r['producto'] ?? 0),
    equipo: Number(r['personal'] ?? r['equipo'] ?? 0),
    local: Number(r['local'] ?? 0),
    controlables: Number(r['controlables'] ?? 0),
  }))
}

/* ── tooltip oscuro ────────────────────────────── */
const TooltipOscuro = ({ active, payload, label, suffix }: {
  active?: boolean
  payload?: Array<{name: string; value: number; color: string; dataKey?: string}>
  label?: string
  suffix?: string
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
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, display: 'inline-block' }} />
          <span style={{ opacity: 0.8 }}>{p.name}:</span>
          <span style={{ fontWeight: 600 }}>
            {suffix === '%'
              ? `${p.value.toFixed(1)}%`
              : fmtEur(p.value, { showEuro: true, decimals: 0 })}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ── skeleton ──────────────────────────────────── */
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
function SinDatos({ h = 160 }: { h?: number }) {
  return (
    <div style={{
      height: h, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: COLORS.mut, fontFamily: LEXEND, fontSize: 13,
    }}>
      Sin datos para el período
    </div>
  )
}

/* ── card shell ────────────────────────────────── */
function CardEvo({
  label, headerExtra, children,
}: { label: string; headerExtra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ ...card, padding: '18px 20px', minHeight: 300 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div style={lbl}>{label}</div>
        {headerExtra}
      </div>
      {children}
    </div>
  )
}

/* ── leyenda inline ────────────────────────────── */
function LegendInline({ items }: { items: Array<{ color: string; label: string; dashed?: boolean; border?: string }> }) {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: COLORS.mut, marginTop: 8, fontFamily: LEXEND }}>
      {items.map((it, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            width: 12, height: it.dashed ? 0 : 10, borderRadius: 2,
            background: it.dashed ? 'transparent' : it.color,
            borderTop: it.dashed ? `1.5px dashed ${it.color}` : undefined,
            border: it.border ? it.border : undefined,
          }} />
          {it.label}
        </span>
      ))}
    </div>
  )
}

/* ── Props ─────────────────────────────────────── */
interface Props {
  fechaDesde: Date
  fechaHasta: Date
  canalesFiltro: string[]
}

/* ── componente principal ──────────────────────── */
export default function TabEvolucion({ fechaDesde, fechaHasta }: Props) {
  const [rows, setRows]         = useState<RowFac[]>([])
  const [rowsPrev, setRowsPrev] = useState<RowFac[]>([])
  const [running, setRunning]   = useState<RunningItem[]>([])
  const [marcas, setMarcas]     = useState<Marca[]>([])
  const [loading, setLoading]   = useState(true)
  const [objetivoMensual, setObjetivoMensual] = useState<number>(0)

  const dias = diffDays(fechaDesde, fechaHasta) + 1

  // Período anterior (mismo nº días, justo antes)
  const fechaDesdePrev = useMemo(() => {
    const d = new Date(fechaDesde); d.setDate(d.getDate() - dias); return d
  }, [fechaDesde, dias])
  const fechaHastaPrev = useMemo(() => {
    const d = new Date(fechaDesde); d.setDate(d.getDate() - 1); return d
  }, [fechaDesde])

  // Cargar facturacion período actual
  useEffect(() => {
    setLoading(true)
    supabase
      .from('facturacion_diario')
      .select('fecha,uber_bruto,glovo_bruto,je_bruto,web_bruto,directa_bruto,total_bruto,marca_id')
      .gte('fecha', toStr(fechaDesde))
      .lte('fecha', toStr(fechaHasta))
      .order('fecha', { ascending: true })
      .then(({ data }) => {
        setRows((data ?? []) as RowFac[])
        setLoading(false)
      })
  }, [fechaDesde, fechaHasta])

  // Cargar facturacion período anterior
  useEffect(() => {
    supabase
      .from('facturacion_diario')
      .select('fecha,uber_bruto,glovo_bruto,je_bruto,web_bruto,directa_bruto,total_bruto,marca_id')
      .gte('fecha', toStr(fechaDesdePrev))
      .lte('fecha', toStr(fechaHastaPrev))
      .order('fecha', { ascending: true })
      .then(({ data }) => {
        setRowsPrev((data ?? []) as RowFac[])
      })
  }, [fechaDesdePrev, fechaHastaPrev])

  // Cargar running — últimos 7 meses FIJO (independiente del rango)
  useEffect(() => {
    supabase
      .from('running')
      .select('*')
      .order('año' as any, { ascending: false })
      .order('mes', { ascending: false })
      .limit(7)
      .then(({ data }) => {
        const parsed = parseRunning((data ?? []) as RowRunningRaw[])
        parsed.sort((a, b) => a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes)
        setRunning(parsed)
      })
  }, [])

  // Cargar marcas activas
  useEffect(() => {
    supabase.from('marcas').select('id,nombre').eq('estado', 'activa')
      .then(({ data }) => setMarcas((data ?? []) as Marca[]))
  }, [])

  // Cargar objetivo mensual
  useEffect(() => {
    supabase.from('objetivos').select('tipo,importe').eq('tipo', 'mensual')
      .then(({ data }) => {
        if (data && data.length > 0) {
          setObjetivoMensual(Number((data[0] as { importe: number | string }).importe))
        }
      })
  }, [])

  /* ── derivados ───────────────────────────────── */
  const totalPeriodo = useMemo(() => rows.reduce((a, r) => a + (r.total_bruto || 0), 0), [rows])
  const totalPrev    = useMemo(() => rowsPrev.reduce((a, r) => a + (r.total_bruto || 0), 0), [rowsPrev])
  const deltaPct     = totalPrev > 0 ? ((totalPeriodo - totalPrev) / totalPrev) * 100 : null

  // Card 1: acumulado actual vs anterior vs objetivo
  const dataAcumulado = useMemo(() => {
    // Construir mapa fecha → bruto día actual
    const mapAct = new Map<string, number>()
    for (const r of rows) mapAct.set(r.fecha, (mapAct.get(r.fecha) || 0) + (r.total_bruto || 0))

    const mapPrev = new Map<string, number>()
    for (const r of rowsPrev) mapPrev.set(r.fecha, (mapPrev.get(r.fecha) || 0) + (r.total_bruto || 0))

    // Generar serie de fechas del período actual
    const fechas: string[] = []
    const d = new Date(fechaDesde)
    while (d <= fechaHasta) {
      fechas.push(toStr(d))
      d.setDate(d.getDate() + 1)
    }

    // Acumular
    let accAct = 0, accPrev = 0
    const prevFechas = Array.from(mapPrev.keys()).sort()
    const objDiario = objetivoMensual > 0 ? objetivoMensual / 30 : 0

    return fechas.map((f, i) => {
      accAct += mapAct.get(f) || 0
      const prevKey = prevFechas[i]
      if (prevKey) accPrev += mapPrev.get(prevKey) || 0
      return {
        name: labelDia(f),
        Actual: Math.round(accAct),
        Anterior: Math.round(accPrev),
        Objetivo: Math.round((i + 1) * objDiario),
      }
    })
  }, [rows, rowsPrev, fechaDesde, fechaHasta, objetivoMensual])

  // Card 2: barras apiladas plataforma por día
  const dataPlataforma = useMemo(() => {
    const map = new Map<string, { Uber: number; Glovo: number; JE: number; Web: number; Directa: number }>()
    for (const r of rows) {
      const e = map.get(r.fecha) || { Uber: 0, Glovo: 0, JE: 0, Web: 0, Directa: 0 }
      e.Uber    += r.uber_bruto || 0
      e.Glovo   += r.glovo_bruto || 0
      e.JE      += r.je_bruto || 0
      e.Web     += r.web_bruto || 0
      e.Directa += r.directa_bruto || 0
      map.set(r.fecha, e)
    }
    return Array.from(map.entries()).sort(([a],[b]) => a.localeCompare(b))
      .map(([fecha, v]) => ({ name: labelDia(fecha), ...v }))
  }, [rows])

  const totalesPlataforma = useMemo(() => {
    const t = { uber: 0, glovo: 0, je: 0 }
    for (const r of rows) {
      t.uber  += r.uber_bruto || 0
      t.glovo += r.glovo_bruto || 0
      t.je    += r.je_bruto || 0
    }
    const total = t.uber + t.glovo + t.je
    return {
      uber:  total > 0 ? (t.uber  / total) * 100 : 0,
      glovo: total > 0 ? (t.glovo / total) * 100 : 0,
      je:    total > 0 ? (t.je    / total) * 100 : 0,
    }
  }, [rows])

  // Card 3: top 5 marcas
  const topMarcas = useMemo(() => {
    const map = new Map<number, number>()
    for (const r of rows) {
      if (r.marca_id) map.set(r.marca_id, (map.get(r.marca_id) || 0) + (r.total_bruto || 0))
    }
    const arr = Array.from(map.entries())
      .map(([id, bruto]) => ({
        nombre: marcas.find(m => m.id === id)?.nombre ?? `Marca ${id}`,
        bruto,
      }))
      .sort((a, b) => b.bruto - a.bruto)
      .slice(0, 5)

    const totalTop = arr.reduce((a, m) => a + m.bruto, 0)
    return { arr, totalTop }
  }, [rows, marcas])

  const PALETA_MARCAS = ['#B01D23','#F26B1F','#1D9E75','#06C167','#7a8090']

  // Card 4: grupos de gasto % s/ingresos netos
  const runningPct = useMemo(() => {
    const hoy = new Date()
    const mesActual = hoy.getMonth() + 1
    const anioActual = hoy.getFullYear()
    return running.map(r => {
      const isCurrent = r.anio === anioActual && r.mes === mesActual
      const ing = r.ingresos_netos || 0
      const pct = (v: number) => ing > 0 ? (v / ing) * 100 : 0
      return {
        name: nombreMes(r.mes) + (isCurrent ? '*' : ''),
        Producto:     +pct(r.producto).toFixed(1),
        Equipo:       +pct(r.equipo).toFixed(1),
        Local:        +pct(r.local).toFixed(1),
        Controlables: +pct(r.controlables).toFixed(1),
      }
    })
  }, [running])

  const primeCostActual = useMemo(() => {
    if (runningPct.length === 0) return null
    const ult = runningPct[runningPct.length - 1]
    return Math.round(ult.Producto + ult.Equipo)
  }, [runningPct])

  const primeCostPrev = useMemo(() => {
    if (runningPct.length < 2) return null
    const ant = runningPct[runningPct.length - 2]
    return Math.round(ant.Producto + ant.Equipo)
  }, [runningPct])

  const primeCostDelta = primeCostActual !== null && primeCostPrev !== null
    ? primeCostActual - primeCostPrev : null

  /* ── estilos ejes ────────────────────────────── */
  const axisProps = {
    tick: { fontSize: 10, fontFamily: LEXEND, fill: COLORS.mut },
    axisLine: false as const,
    tickLine: false as const,
  }
  const gridProps = {
    strokeDasharray: '3 3',
    stroke: '#ebe8e2',
    vertical: false as const,
  }

  return (
    <div style={{ marginTop: 18, color: COLORS.pri, fontFamily: FONT.body }}>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* ─── Card 1: Ingresos totales acumulado ─── */}
        <CardEvo
          label="INGRESOS TOTALES · BRUTO"
          headerExtra={deltaPct !== null && (
            <div style={{ fontSize: 11, color: deltaPct >= 0 ? '#1D9E75' : '#B01D23', fontFamily: OSWALD }}>
              {deltaPct >= 0 ? '▲' : '▼'} {Math.abs(deltaPct).toFixed(1)}%
            </div>
          )}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
            <span style={{ fontFamily: OSWALD, fontSize: 28, fontWeight: 600, color: COLORS.pri }}>
              {fmtEur(totalPeriodo, { showEuro: false, decimals: 0 })}
            </span>
            <span style={{ fontSize: 11, color: COLORS.mut }}>
              vs {fmtEur(totalPrev, { showEuro: false, decimals: 0 })} anterior
            </span>
          </div>
          <div style={{ fontSize: 11, color: COLORS.mut, marginBottom: 12 }}>
            Acumulado · {dias} {dias === 1 ? 'día' : 'días'}
          </div>
          {loading ? <Skeleton /> : dataAcumulado.length === 0 ? <SinDatos /> : (
            <ResponsiveContainer width="100%" height={160}>
              <ComposedChart data={dataAcumulado} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gradAct" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#B01D23" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#B01D23" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${v}`} width={42} />
                <Tooltip content={<TooltipOscuro />} />
                <Area type="monotone" dataKey="Actual" stroke="#B01D23" strokeWidth={2} fill="url(#gradAct)" dot={false} activeDot={{ r: 4, fill: '#B01D23' }} />
                <Line type="monotone" dataKey="Anterior" stroke="#7a8090" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                {objetivoMensual > 0 && (
                  <Line type="monotone" dataKey="Objetivo" stroke="#1D9E75" strokeWidth={1.5} strokeDasharray="2 2" dot={false} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          )}
          <LegendInline items={[
            { color: '#B01D23', label: 'Este período' },
            { color: '#7a8090', label: 'Anterior', dashed: true },
            ...(objetivoMensual > 0 ? [{ color: '#1D9E75', label: 'Objetivo', dashed: true }] : []),
          ]} />
        </CardEvo>

        {/* ─── Card 2: Plataforma ─── */}
        <CardEvo label="INGRESOS POR PLATAFORMA">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
            {(() => {
              const mayor = [
                { label: 'Uber',  pct: totalesPlataforma.uber,  color: '#06C167' },
                { label: 'Glovo', pct: totalesPlataforma.glovo, color: '#aabc00' },
                { label: 'JE',    pct: totalesPlataforma.je,    color: '#f5a623' },
              ].sort((a,b) => b.pct - a.pct)
              return (
                <>
                  <span style={{ fontFamily: OSWALD, fontSize: 18, color: mayor[0].color }}>
                    {mayor[0].label} {mayor[0].pct.toFixed(0)}%
                  </span>
                  <span style={{ fontSize: 11, color: COLORS.mut }}>
                    · {mayor[1].label} {mayor[1].pct.toFixed(0)}% · {mayor[2].label} {mayor[2].pct.toFixed(0)}%
                  </span>
                </>
              )
            })()}
          </div>
          {loading ? <Skeleton h={180} /> : dataPlataforma.length === 0 ? <SinDatos h={180} /> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dataPlataforma} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="20%">
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${v}`} width={42} />
                <Tooltip content={<TooltipOscuro />} />
                <Bar dataKey="Uber"    name="Uber Eats" stackId="p" fill="#06C167" />
                <Bar dataKey="Glovo"   name="Glovo"     stackId="p" fill="#e8f442" />
                <Bar dataKey="JE"      name="Just Eat"  stackId="p" fill="#f5a623" />
                <Bar dataKey="Web"     name="Web"       stackId="p" fill="#7F77DD" />
                <Bar dataKey="Directa" name="Directa"   stackId="p" fill="#484f66" />
              </BarChart>
            </ResponsiveContainer>
          )}
          <LegendInline items={[
            { color: '#06C167', label: 'Uber Eats' },
            { color: '#e8f442', label: 'Glovo', border: '1px solid #8a7800' },
            { color: '#f5a623', label: 'Just Eat' },
          ]} />
        </CardEvo>

        {/* ─── Card 3: Top 5 marcas ─── */}
        <CardEvo label="INGRESOS POR MARCA · TOP 5">
          {topMarcas.arr.length > 0 && (
            <div style={{ fontSize: 11, color: COLORS.mut, marginBottom: 12 }}>
              {topMarcas.arr[0].nombre} lidera · {topMarcas.totalTop > 0 ? Math.round((topMarcas.arr[0].bruto / topMarcas.totalTop) * 100) : 0}% del top 5
            </div>
          )}
          {loading ? <Skeleton h={200} /> : topMarcas.arr.length === 0 ? <SinDatos h={200} /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={topMarcas.arr.map((m, i) => ({ ...m, fill: PALETA_MARCAS[i % PALETA_MARCAS.length] }))}
                layout="vertical"
                margin={{ top: 4, right: 30, bottom: 0, left: 0 }}
                barCategoryGap="25%"
              >
                <CartesianGrid {...gridProps} horizontal={false} vertical />
                <XAxis type="number" {...axisProps} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${v}`} />
                <YAxis type="category" dataKey="nombre" {...axisProps} width={80} />
                <Tooltip content={<TooltipOscuro />} />
                <Bar dataKey="bruto" name="Bruto" radius={[0,4,4,0]}>
                  {topMarcas.arr.map((_, i) => (
                    <text key={i} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardEvo>

        {/* ─── Card 4: Grupos de gasto ─── */}
        <CardEvo
          label="GRUPOS DE GASTO · % S/INGRESOS"
          headerExtra={
            <div style={{ fontSize: 10, color: COLORS.mut }}>últimos 7 meses</div>
          }
        >
          {primeCostActual !== null && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
              <span style={{ fontFamily: OSWALD, fontSize: 18, color: '#B01D23' }}>
                Prime Cost {primeCostActual}%
              </span>
              {primeCostDelta !== null && primeCostDelta !== 0 && (
                <span style={{ fontSize: 11, color: primeCostDelta > 0 ? '#f5a623' : '#1D9E75' }}>
                  {primeCostDelta > 0 ? '▲' : '▼'} {Math.abs(primeCostDelta)}pp vs mes anterior
                </span>
              )}
            </div>
          )}
          {runningPct.length === 0 ? <SinDatos h={180} /> : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={runningPct} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={v => `${v}%`} width={42} />
                <Tooltip content={<TooltipOscuro suffix="%" />} />
                <Line type="monotone" dataKey="Producto"     stroke="#B01D23" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="Equipo"       stroke="#06C167" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="Local"        stroke="#f5a623" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="Controlables" stroke="#66aaff" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
          <LegendInline items={[
            { color: '#B01D23', label: 'Producto' },
            { color: '#06C167', label: 'Equipo' },
            { color: '#f5a623', label: 'Local' },
            { color: '#66aaff', label: 'Controlables' },
          ]} />
        </CardEvo>

      </div>
    </div>
  )
}
