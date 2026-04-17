import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */

interface Row {
  fecha: string
  servicio: string
  uber_pedidos: number; uber_bruto: number
  glovo_pedidos: number; glovo_bruto: number
  je_pedidos: number; je_bruto: number
  web_pedidos: number; web_bruto: number
  total_pedidos: number; total_bruto: number
}

interface CanalStat { label: string; bruto: number; pct: number; color: string }
interface WeekBar { label: string; bruto: number; pct: number }
interface TopDay { fecha: string; bruto: number }

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════ */

const SELECT =
  'fecha,servicio,uber_pedidos,uber_bruto,glovo_pedidos,glovo_bruto,je_pedidos,je_bruto,web_pedidos,web_bruto,total_pedidos,total_bruto'

const CANAL_COLORS: Record<string, string> = {
  'Uber Eats': 'bg-green-500',
  'Glovo':     'bg-amber-500',
  'Just Eat':  'bg-orange-500',
  'Web':       'bg-accent',
}
const CANAL_TEXT: Record<string, string> = {
  'Uber Eats': 'text-[#16a34a]',
  'Glovo':     'text-[#d97706]',
  'Just Eat':  'text-[#ea580c]',
  'Web':       'text-[#1a1a1a]',
}

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

const eur = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
const num = (n: number) => n.toLocaleString('es-ES')
const todayStr = () => new Date().toISOString().slice(0, 10)

function isoWeek(dateStr: string): { year: number; week: number } {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay() || 7
  d.setDate(d.getDate() + 4 - day)
  const y = d.getFullYear()
  const jan1 = new Date(y, 0, 1)
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + 1) / 7)
  return { year: y, week }
}

function sumRows(rows: Row[]): { pedidos: number; bruto: number } {
  let pedidos = 0, bruto = 0
  for (const r of rows) { pedidos += r.total_pedidos || 0; bruto += r.total_bruto || 0 }
  return { pedidos, bruto }
}

function sumCanal(rows: Row[], ped: keyof Row, bru: keyof Row): { pedidos: number; bruto: number } {
  let pedidos = 0, bruto = 0
  for (const r of rows) { pedidos += (r[ped] as number) || 0; bruto += (r[bru] as number) || 0 }
  return { pedidos, bruto }
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function Dashboard() {
  const [data, setData] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: rows, error: e } = await supabase
          .from('facturacion_diario')
          .select(SELECT)
          .order('fecha', { ascending: false })
        if (e) throw e
        if (!cancelled) setData((rows as Row[]) ?? [])
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  /* ── derived data ──────────────────────────────────────── */

  const hoy = todayStr()
  const currentIso = isoWeek(hoy)
  const currentMonth = hoy.slice(0, 7)

  /* row 1: KPIs */
  const kpiHoy = useMemo(() => sumRows(data.filter(r => r.fecha === hoy)), [data, hoy])
  const kpiSemana = useMemo(() => {
    const rows = data.filter(r => {
      const w = isoWeek(r.fecha)
      return w.year === currentIso.year && w.week === currentIso.week
    })
    return sumRows(rows)
  }, [data, currentIso.year, currentIso.week])
  const ticketHoy = kpiHoy.pedidos > 0 ? kpiHoy.bruto / kpiHoy.pedidos : 0

  /* row 2: canal breakdown last 30 days */
  const canalStats = useMemo((): CanalStat[] => {
    const rows = data.filter(r => r.fecha >= currentMonth.slice(0, 7) && r.fecha.startsWith(currentMonth))
    const uber = sumCanal(rows, 'uber_pedidos', 'uber_bruto')
    const glovo = sumCanal(rows, 'glovo_pedidos', 'glovo_bruto')
    const je = sumCanal(rows, 'je_pedidos', 'je_bruto')
    const web = sumCanal(rows, 'web_pedidos', 'web_bruto')
    const total = uber.bruto + glovo.bruto + je.bruto + web.bruto
    const pct = (v: number) => total > 0 ? (v / total) * 100 : 0
    return [
      { label: 'Uber Eats', bruto: uber.bruto, pct: pct(uber.bruto), color: 'green' },
      { label: 'Glovo',     bruto: glovo.bruto, pct: pct(glovo.bruto), color: 'amber' },
      { label: 'Just Eat',  bruto: je.bruto, pct: pct(je.bruto), color: 'orange' },
      { label: 'Web',       bruto: web.bruto, pct: pct(web.bruto), color: 'accent' },
    ]
  }, [data, currentMonth])

  /* row 3a: last 4 weeks bar chart */
  const weekBars = useMemo((): WeekBar[] => {
    const map = new Map<string, number>()
    for (const r of data) {
      const { year, week } = isoWeek(r.fecha)
      const key = `${year}-${String(week).padStart(2, '0')}`
      map.set(key, (map.get(key) || 0) + (r.total_bruto || 0))
    }
    const sorted = [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 4).reverse()
    const max = Math.max(...sorted.map(([, v]) => v), 1)
    return sorted.map(([key, bruto]) => ({
      label: `S${parseInt(key.split('-')[1])}`,
      bruto,
      pct: (bruto / max) * 100,
    }))
  }, [data])

  /* row 3b: top 5 days */
  const topDays = useMemo((): TopDay[] => {
    const map = new Map<string, number>()
    for (const r of data) {
      map.set(r.fecha, (map.get(r.fecha) || 0) + (r.total_bruto || 0))
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([fecha, bruto]) => ({ fecha, bruto }))
  }, [data])

  /* ── render ────────────────────────────────────────────── */

  if (loading) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-[#1a1a1a] mb-4">Dashboard</h2>
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <div className="inline-block h-6 w-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-[#555] text-sm mt-3">Cargando...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-[#1a1a1a] mb-4">Dashboard</h2>
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-[#dc2626] text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-[#1a1a1a] mb-4">Dashboard</h2>

      {/* Row 1: Main KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard label="Ventas hoy" valor={eur(kpiHoy.bruto)} sub="bruto diario" />
        <KpiCard label="Pedidos hoy" valor={num(kpiHoy.pedidos)} sub="todos los canales" />
        <KpiCard label="Ticket medio" valor={ticketHoy > 0 ? eur(ticketHoy) : '—'} sub="bruto / pedidos" />
        <KpiCard label="Ventas semana" valor={eur(kpiSemana.bruto)} sub={`S${currentIso.week} — ${num(kpiSemana.pedidos)} ped`} />
      </div>

      {/* Row 2: Canal breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {canalStats.map(c => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-[#555] uppercase tracking-wide">{c.label}</p>
              <span className={`text-xs font-bold ${CANAL_TEXT[c.label] ?? 'text-[#1a1a1a]'}`}>
                {c.pct.toFixed(1)}%
              </span>
            </div>
            <p className="text-xl font-bold text-[#1a1a1a]">{eur(c.bruto)}</p>
            {/* progress bar */}
            <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${CANAL_COLORS[c.label] ?? 'bg-accent'}`}
                style={{ width: `${Math.min(c.pct, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Row 3: Chart + Top days */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar chart */}
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs text-[#555] uppercase tracking-wide mb-4">Bruto ultimas 4 semanas</p>
          {weekBars.length === 0 ? (
            <p className="text-[#555] text-sm text-center py-8">Sin datos</p>
          ) : (
            <div className="flex items-end gap-3 h-40">
              {weekBars.map(bar => (
                <div key={bar.label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-[#555] tabular-nums">{eur(bar.bruto)}</span>
                  <div className="w-full bg-white/5 rounded-t-md overflow-hidden relative" style={{ height: '120px' }}>
                    <div
                      className="absolute bottom-0 w-full bg-accent/80 rounded-t-md transition-all"
                      style={{ height: `${bar.pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-[#555] font-medium">{bar.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top 5 days */}
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs text-[#555] uppercase tracking-wide mb-4">Top 5 dias con mas ventas</p>
          {topDays.length === 0 ? (
            <p className="text-[#555] text-sm text-center py-8">Sin datos</p>
          ) : (
            <div className="space-y-3">
              {topDays.map((d, i) => {
                const maxBruto = topDays[0].bruto || 1
                const pct = (d.bruto / maxBruto) * 100
                return (
                  <div key={d.fecha}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          i === 0 ? 'bg-accent text-black' : 'bg-white/5 text-[#555]'
                        }`}>
                          {i + 1}
                        </span>
                        <span className="text-sm text-[#1a1a1a]">{d.fecha}</span>
                      </div>
                      <span className="text-sm font-semibold text-[#1a1a1a] tabular-nums">{eur(d.bruto)}</span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden ml-7">
                      <div
                        className="h-full bg-accent/60 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   MICRO-COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function KpiCard({ label, valor, sub }: { label: string; valor: string; sub: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <p className="text-xs text-[#555] uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold text-[#1a1a1a] mt-2">{valor}</p>
      <p className="text-xs text-[#555] mt-1">{sub}</p>
    </div>
  )
}
