/**
 * TabEvolucion — Panel Global
 * 4 cards: Ingresos Totales, Por Plataforma, Por Marca, Grupos de Gasto
 * Granularidad automática: día ≤31d / semana ≤90d / mes >90d
 */

import { useEffect, useState, useMemo } from 'react'
import {
  AreaChart, Area,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/lib/format'
import { COLORS, FONT, OSWALD, LEXEND, card, lbl } from '@/components/panel/resumen/tokens'

/* ── helpers fecha ─────────────────────────────── */
function toStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function diffDays(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}
function labelDia(fecha: string) {
  const [,m,d] = fecha.split('-')
  return `${d}/${m}`
}
function labelMes(anio: number, mes: number) {
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${meses[mes-1]} ${String(anio).slice(2)}`
}
function isoWeekKey(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay() || 7
  d.setDate(d.getDate() + 4 - day)
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2,'0')}`
}
function weekLabel(key: string) {
  return `S${key.split('W')[1]}`
}

/* ── tipos ─────────────────────────────────────── */
interface RowFac {
  fecha: string
  uber_bruto: number; glovo_bruto: number; je_bruto: number
  web_bruto: number; directa_bruto: number; total_bruto: number
  marca_id: number | null
}

// "año" con tilde rompe el parser de tipos de Supabase — usar Record<string,unknown>
type RowRunningRaw = Record<string, unknown>

interface RunningItem {
  anio: number
  mes: number
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
    producto: Number(r['producto'] ?? 0),
    equipo: Number(r['personal'] ?? 0),
    local: Number(r['local'] ?? 0),
    controlables: Number(r['controlables'] ?? 0),
  }))
}

/* ── tooltip oscuro ────────────────────────────── */
const TooltipOscuro = ({ active, payload, label }: {
  active?: boolean; payload?: Array<{name: string; value: number; color: string}>; label?: string
}) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1e2233', color: '#fff', borderRadius: 8,
      padding: '8px 12px', fontSize: 12, fontFamily: LEXEND,
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    }}>
      <div style={{ marginBottom: 4, opacity: 0.7 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
          <span style={{ opacity: 0.8 }}>{p.name}:</span>
          <span style={{ fontWeight: 600 }}>{fmtEur(p.value, { showEuro: true, decimals: 0 })}</span>
        </div>
      ))}
    </div>
  )
}

/* ── skeleton loading ──────────────────────────── */
function Skeleton() {
  return (
    <div style={{
      height: 200, borderRadius: 8, background: '#ebe8e2',
      animation: 'pulse 1.5s ease-in-out infinite',
    }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:.5} 50%{opacity:1} }`}</style>
    </div>
  )
}

/* ── sin datos ─────────────────────────────────── */
function SinDatos() {
  return (
    <div style={{
      height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: COLORS.mut, fontFamily: LEXEND, fontSize: 13,
    }}>
      Sin datos para el período
    </div>
  )
}

/* ── card shell ────────────────────────────────── */
function CardEvo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ ...card, padding: '20px 22px', minHeight: 280 }}>
      <div style={{ ...lbl, marginBottom: 14 }}>{label}</div>
      {children}
    </div>
  )
}

/* ── granularidad ──────────────────────────────── */
type Granularidad = 'dia' | 'semana' | 'mes'

function autoGran(dias: number): Granularidad {
  if (dias <= 31) return 'dia'
  if (dias <= 90) return 'semana'
  return 'mes'
}

/* ── subtabs granularidad ──────────────────────── */
function SubtabsGran({ value, onChange }: { value: Granularidad; onChange: (g: Granularidad) => void }) {
  const opts: { id: Granularidad; label: string }[] = [
    { id: 'dia', label: 'Día' },
    { id: 'semana', label: 'Semana' },
    { id: 'mes', label: 'Mes' },
  ]
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
      {opts.map(o => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          style={{
            padding: '4px 10px', borderRadius: 5, fontSize: 11, fontFamily: LEXEND,
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

/* ── agrupar rows por granularidad ─────────────── */
function agruparPorGran(rows: RowFac[], gran: Granularidad) {
  const map = new Map<string, { label: string; total: number; uber: number; glovo: number; je: number; web: number; dir: number; byMarca: Map<number, number> }>()

  for (const r of rows) {
    let key: string
    let label: string
    if (gran === 'dia') {
      key = r.fecha
      label = labelDia(r.fecha)
    } else if (gran === 'semana') {
      key = isoWeekKey(r.fecha)
      label = weekLabel(key)
    } else {
      const [y, m] = r.fecha.split('-')
      key = `${y}-${m}`
      label = labelMes(Number(y), Number(m))
    }

    if (!map.has(key)) {
      map.set(key, { label, total: 0, uber: 0, glovo: 0, je: 0, web: 0, dir: 0, byMarca: new Map() })
    }
    const entry = map.get(key)!
    entry.total += r.total_bruto || 0
    entry.uber  += r.uber_bruto || 0
    entry.glovo += r.glovo_bruto || 0
    entry.je    += r.je_bruto || 0
    entry.web   += r.web_bruto || 0
    entry.dir   += r.directa_bruto || 0
    if (r.marca_id) {
      entry.byMarca.set(r.marca_id, (entry.byMarca.get(r.marca_id) || 0) + (r.total_bruto || 0))
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v)
}

/* ── agrupar running ───────────────────────────── */
function agruparRunning(rows: RunningItem[], gran: Granularidad) {
  const sorted = [...rows].sort((a, b) => a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes)
  const suffix = gran !== 'mes' ? '*' : ''
  return sorted.map(r => ({
    label: labelMes(r.anio, r.mes) + suffix,
    producto: r.producto,
    equipo: r.equipo,
    local: r.local,
    controlables: r.controlables,
  }))
}

/* ── paleta marcas ─────────────────────────────── */
const PALETA_MARCAS = ['#B01D23','#06C167','#f5a623','#66aaff','#F26B1F','#1D9E75','#484f66']

/* ── Props ─────────────────────────────────────── */
interface Props {
  fechaDesde: Date
  fechaHasta: Date
  canalesFiltro: string[]
}

/* ── componente principal ──────────────────────── */
export default function TabEvolucion({ fechaDesde, fechaHasta }: Props) {
  const [rows, setRows]           = useState<RowFac[]>([])
  const [running, setRunning]     = useState<RunningItem[]>([])
  const [marcas, setMarcas]       = useState<Marca[]>([])
  const [loading, setLoading]     = useState(true)

  const dias = diffDays(fechaDesde, fechaHasta)
  const [gran, setGran] = useState<Granularidad>(() => autoGran(dias))

  useEffect(() => {
    setGran(autoGran(diffDays(fechaDesde, fechaHasta)))
  }, [fechaDesde, fechaHasta])

  // Cargar facturacion_diario
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

  // Cargar running — select('*') para evitar parser con "año" tilde
  useEffect(() => {
    const anioDesde = fechaDesde.getFullYear()
    const mesDesde  = fechaDesde.getMonth() + 1
    const anioHasta = fechaHasta.getFullYear()
    const mesHasta  = fechaHasta.getMonth() + 1
    supabase
      .from('running')
      .select('*')
      .or(`and(año.eq.${anioDesde},mes.gte.${mesDesde}),and(año.eq.${anioHasta},mes.lte.${mesHasta})`)
      .then(({ data }) => {
        setRunning(parseRunning((data ?? []) as RowRunningRaw[]))
      })
  }, [fechaDesde, fechaHasta])

  // Cargar marcas activas
  useEffect(() => {
    supabase.from('marcas').select('id,nombre').eq('estado', 'activa')
      .then(({ data }) => setMarcas((data ?? []) as Marca[]))
  }, [])

  /* ── datos derivados ─────────────────────────── */
  const agrupado        = useMemo(() => agruparPorGran(rows, gran), [rows, gran])
  const runningAgrupado = useMemo(() => agruparRunning(running, gran), [running, gran])

  const dataTotales = useMemo(() =>
    agrupado.map(r => ({ name: r.label, Ingresos: r.total }))
  , [agrupado])

  const dataPlataforma = useMemo(() =>
    agrupado.map(r => ({ name: r.label, 'Uber Eats': r.uber, Glovo: r.glovo, 'Just Eat': r.je, Web: r.web, Directa: r.dir }))
  , [agrupado])

  const dataMarcas = useMemo(() => {
    return agrupado.map(r => {
      const obj: Record<string, number | string> = { name: r.label }
      for (const m of marcas) {
        obj[m.nombre] = r.byMarca.get(m.id) || 0
      }
      return obj
    })
  }, [agrupado, marcas])

  const totalPeriodo = useMemo(() => rows.reduce((a, r) => a + (r.total_bruto || 0), 0), [rows])

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

      <SubtabsGran value={gran} onChange={setGran} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* Card 1: Ingresos Totales */}
        <CardEvo label="INGRESOS TOTALES · EVOLUCIÓN">
          <div style={{ fontFamily: OSWALD, fontSize: 22, fontWeight: 600, color: COLORS.pri, marginBottom: 12 }}>
            {fmtEur(totalPeriodo, { showEuro: true, decimals: 0 })}
          </div>
          {loading ? <Skeleton /> : dataTotales.length === 0 ? <SinDatos /> : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={dataTotales} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.redSL} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={COLORS.redSL} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={v => fmtEur(v as number, { showEuro: false, decimals: 0 })} width={52} />
                <Tooltip content={<TooltipOscuro />} />
                <Area type="monotone" dataKey="Ingresos" stroke={COLORS.redSL} strokeWidth={2} fill="url(#gradTotal)" dot={false} activeDot={{ r: 4, fill: COLORS.redSL }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardEvo>

        {/* Card 2: Por Plataforma */}
        <CardEvo label="INGRESOS POR PLATAFORMA">
          {loading ? <Skeleton /> : dataPlataforma.length === 0 ? <SinDatos /> : (
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={dataPlataforma} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={v => fmtEur(v as number, { showEuro: false, decimals: 0 })} width={52} />
                <Tooltip content={<TooltipOscuro />} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: LEXEND, paddingTop: 8 }} />
                <Line type="monotone" dataKey="Uber Eats" stroke={COLORS.uber}     strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Glovo"     stroke={COLORS.glovoDark} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Just Eat"  stroke={COLORS.je}        strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Web"       stroke={COLORS.web}       strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Directa"   stroke={COLORS.directa}   strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardEvo>

        {/* Card 3: Por Marca */}
        <CardEvo label="INGRESOS POR MARCA">
          {loading ? <Skeleton /> : dataMarcas.length === 0 || marcas.length === 0 ? <SinDatos /> : (
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={dataMarcas} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={v => fmtEur(v as number, { showEuro: false, decimals: 0 })} width={52} />
                <Tooltip content={<TooltipOscuro />} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: LEXEND, paddingTop: 8 }} />
                {marcas.map((m, i) => (
                  <Line key={m.id} type="monotone" dataKey={m.nombre} stroke={PALETA_MARCAS[i % PALETA_MARCAS.length]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardEvo>

        {/* Card 4: Grupos de Gasto */}
        <CardEvo label="GRUPOS DE GASTO · EVOLUCIÓN">
          {runningAgrupado.length === 0 ? <SinDatos /> : (
            <>
              {gran !== 'mes' && (
                <div style={{ fontSize: 10, color: COLORS.mut, fontFamily: LEXEND, marginBottom: 8 }}>
                  * Datos mensuales (granularidad mínima disponible)
                </div>
              )}
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={runningAgrupado} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="30%">
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis {...axisProps} tickFormatter={v => fmtEur(v as number, { showEuro: false, decimals: 0 })} width={52} />
                  <Tooltip content={<TooltipOscuro />} />
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: LEXEND, paddingTop: 8 }} />
                  <Bar dataKey="producto"     name="Producto"     fill={COLORS.catPrd} radius={[3,3,0,0]} />
                  <Bar dataKey="equipo"       name="Equipo"       fill={COLORS.catEqp} radius={[3,3,0,0]} />
                  <Bar dataKey="local"        name="Local"        fill={COLORS.catLoc} radius={[3,3,0,0]} />
                  <Bar dataKey="controlables" name="Controlables" fill={COLORS.catCtr} radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </CardEvo>

      </div>
    </div>
  )
}
