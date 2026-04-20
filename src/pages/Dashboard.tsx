import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur, fmtNum } from '@/utils/format'
import { useTheme } from '@/contexts/ThemeContext'

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

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════ */

const SELECT =
  'fecha,servicio,uber_pedidos,uber_bruto,glovo_pedidos,glovo_bruto,je_pedidos,je_bruto,web_pedidos,web_bruto,total_pedidos,total_bruto'

const CANAL_HEX: Record<string, string> = {
  'Uber Eats':      '#06C167',
  'Glovo':          '#e8f442',
  'Just Eat':       '#f5a623',
  'Web Propia':     '#B01D23',
  'Venta Directa':  '#66aaff',
}

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

const todayStr = () => new Date().toISOString().slice(0, 10)

function startOfWeekStr(): string {
  const now = new Date()
  const day = now.getDay() || 7
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(now.getDate() - day + 1)
  return d.toISOString().slice(0, 10)
}

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
  const { theme } = useTheme()
  const isDark = theme === 'dark'

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
  const weekStart = startOfWeekStr()
  const currentIso = isoWeek(hoy)
  const currentMonth = hoy.slice(0, 7)

  /* row 1: KPIs — semana en curso + mes en curso */
  const rowsSemana = useMemo(
    () => data.filter(r => r.fecha >= weekStart && r.fecha <= hoy),
    [data, weekStart, hoy]
  )
  const kpiSemana = useMemo(() => sumRows(rowsSemana), [rowsSemana])
  const ticketSemana = kpiSemana.pedidos > 0 ? kpiSemana.bruto / kpiSemana.pedidos : 0
  const kpiMes = useMemo(
    () => sumRows(data.filter(r => r.fecha.startsWith(currentMonth))),
    [data, currentMonth]
  )

  /* row 2: canal breakdown — mes en curso */
  const canalStats = useMemo((): CanalStat[] => {
    const rows = data.filter(r => r.fecha.startsWith(currentMonth))
    const uber = sumCanal(rows, 'uber_pedidos', 'uber_bruto')
    const glovo = sumCanal(rows, 'glovo_pedidos', 'glovo_bruto')
    const je = sumCanal(rows, 'je_pedidos', 'je_bruto')
    const web = sumCanal(rows, 'web_pedidos', 'web_bruto')
    const total = rows.reduce((s, r) => s + (r.total_bruto || 0), 0)
    const directaBruto = Math.max(0, total - uber.bruto - glovo.bruto - je.bruto - web.bruto)
    const stats: CanalStat[] = []
    const push = (label: string, bruto: number) => {
      stats.push({
        label,
        bruto,
        pct: total > 0 ? (bruto / total) * 100 : 0,
        color: CANAL_HEX[label] ?? '#888',
      })
    }
    push('Uber Eats', uber.bruto)
    push('Glovo', glovo.bruto)
    push('Just Eat', je.bruto)
    push('Web Propia', web.bruto)
    if (directaBruto > 0) push('Venta Directa', directaBruto)
    return stats
  }, [data, currentMonth])

  /* row 3: last 4 weeks bar chart */
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

  const barColor = isDark ? '#c8d0e8' : '#8896b0'

  /* ── render ────────────────────────────────────────────── */

  if (loading) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-[var(--sl-text-primary)] mb-4">Dashboard</h2>
        <div className="bg-[var(--sl-card)] border border-border rounded-xl p-12 text-center">
          <div className="inline-block h-6 w-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--sl-text-secondary)] text-sm mt-3">Cargando...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-[var(--sl-text-primary)] mb-4">Dashboard</h2>
        <div className="bg-[var(--sl-card)] border border-border rounded-xl p-8 text-center">
          <p className="text-[#dc2626] text-sm">{error}</p>
        </div>
      </div>
    )
  }

  const canalColsClass = canalStats.length === 5
    ? 'grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5'
    : 'grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5'

  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--sl-text-primary)] mb-4">Dashboard</h2>

      {/* Row 1: Main KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard label="Ventas semana" valor={fmtEur(kpiSemana.bruto)} sub={`S${currentIso.week} — bruto`} />
        <KpiCard label="Pedidos semana" valor={fmtNum(kpiSemana.pedidos)} sub="todos los canales" />
        <KpiCard label="Ticket medio" valor={ticketSemana > 0 ? fmtEur(ticketSemana) : '—'} sub="bruto / pedidos (semana)" />
        <KpiCard label="Ventas mes" valor={fmtEur(kpiMes.bruto)} sub={`${currentMonth} — ${fmtNum(kpiMes.pedidos)} ped`} />
      </div>

      {/* Row 2: Canal breakdown */}
      <div className={canalColsClass}>
        {canalStats.map(c => (
          <div key={c.label} className="bg-[var(--sl-card)] border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-[var(--sl-text-secondary)] uppercase tracking-wide">{c.label}</p>
              <span className="text-xs font-bold" style={{ color: c.color }}>
                {fmtNum(c.pct)}%
              </span>
            </div>
            <p className="text-xl font-bold text-[var(--sl-text-primary)]">{fmtEur(c.bruto)}</p>
            <div className="mt-2 h-1.5 bg-[var(--sl-card)]/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ background: c.color, width: `${Math.min(c.pct, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Row 3: Last 4 weeks chart — ancho completo */}
      <div className="bg-[var(--sl-card)] border border-border rounded-xl p-5">
        <p className="text-xs text-[var(--sl-text-secondary)] uppercase tracking-wide mb-4">Últimas 4 semanas</p>
        {weekBars.length === 0 ? (
          <p className="text-[var(--sl-text-secondary)] text-sm text-center py-8">Sin datos</p>
        ) : (
          <div className="flex items-end gap-3 h-40">
            {weekBars.map(bar => (
              <div key={bar.label} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--sl-text-primary)' }}>
                  {fmtEur(bar.bruto)}
                </span>
                <div className="w-full bg-[var(--sl-card)]/5 rounded-t-md overflow-hidden relative" style={{ height: '120px' }}>
                  <div
                    className="absolute bottom-0 w-full rounded-t-md transition-all"
                    style={{ height: `${bar.pct}%`, background: barColor }}
                  />
                </div>
                <span className="text-xs text-[var(--sl-text-secondary)] font-medium">{bar.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   MICRO-COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function KpiCard({ label, valor, sub }: { label: string; valor: string; sub: string }) {
  return (
    <div className="ds-counter" style={{ cursor: 'default' }}>
      <div className="label">{label}</div>
      <div className="value" style={{ fontSize: 22 }}>{valor}</div>
      <div className="sub">{sub}</div>
    </div>
  )
}
