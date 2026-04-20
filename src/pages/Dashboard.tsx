import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'

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

interface CanalStat { nombre: string; total: number; pct: number }
interface WeekBar { label: string; total: number }

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════ */

const SELECT =
  'fecha,servicio,uber_pedidos,uber_bruto,glovo_pedidos,glovo_bruto,je_pedidos,je_bruto,web_pedidos,web_bruto,total_pedidos,total_bruto'

const CANAL_COLOR: Record<string, string> = {
  'Uber Eats':     '#06C167',
  'Glovo':         '#e8f442',
  'Just Eat':      '#f5a623',
  'Web Propia':    '#B01D23',
  'Venta Directa': '#66aaff',
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

  const [isDark, setIsDark] = useState(
    typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark'
  )
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
    )
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

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
  const nSemana = isoWeek(hoy).week
  const currentMonth = hoy.slice(0, 7)

  const rowsSemana = useMemo(
    () => data.filter(r => r.fecha >= weekStart && r.fecha <= hoy),
    [data, weekStart, hoy]
  )
  const agSemana = useMemo(() => sumRows(rowsSemana), [rowsSemana])
  const ventasSemana = agSemana.bruto
  const pedidosSemana = agSemana.pedidos

  const agMes = useMemo(
    () => sumRows(data.filter(r => r.fecha.startsWith(currentMonth))),
    [data, currentMonth]
  )
  const ventasMes = agMes.bruto

  const canalStats = useMemo((): CanalStat[] => {
    const rows = data.filter(r => r.fecha.startsWith(currentMonth))
    const uber = sumCanal(rows, 'uber_pedidos', 'uber_bruto')
    const glovo = sumCanal(rows, 'glovo_pedidos', 'glovo_bruto')
    const je = sumCanal(rows, 'je_pedidos', 'je_bruto')
    const web = sumCanal(rows, 'web_pedidos', 'web_bruto')
    const total = rows.reduce((s, r) => s + (r.total_bruto || 0), 0)
    const directa = Math.max(0, total - uber.bruto - glovo.bruto - je.bruto - web.bruto)
    const list: CanalStat[] = [
      { nombre: 'Uber Eats',  total: uber.bruto,  pct: total > 0 ? (uber.bruto / total) * 100 : 0 },
      { nombre: 'Glovo',      total: glovo.bruto, pct: total > 0 ? (glovo.bruto / total) * 100 : 0 },
      { nombre: 'Just Eat',   total: je.bruto,    pct: total > 0 ? (je.bruto / total) * 100 : 0 },
      { nombre: 'Web Propia', total: web.bruto,   pct: total > 0 ? (web.bruto / total) * 100 : 0 },
    ]
    if (directa > 0) {
      list.push({ nombre: 'Venta Directa', total: directa, pct: total > 0 ? (directa / total) * 100 : 0 })
    }
    return list
  }, [data, currentMonth])

  const weekBars = useMemo((): WeekBar[] => {
    const map = new Map<string, number>()
    for (const r of data) {
      const { year, week } = isoWeek(r.fecha)
      const key = `${year}-${String(week).padStart(2, '0')}`
      map.set(key, (map.get(key) || 0) + (r.total_bruto || 0))
    }
    const sorted = [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 4).reverse()
    return sorted.map(([key, total]) => ({
      label: `S${parseInt(key.split('-')[1])}`,
      total,
    }))
  }, [data])

  /* ── tokens tema ───────────────────────────────────────── */

  const surface = isDark ? '#111111' : '#ffffff'
  const border  = isDark ? '#2a2a2a' : '#e5e0d8'
  const textPri = isDark ? '#f0f0ff' : '#1a1a1a'
  const textSec = isDark ? '#7080a8' : '#6b7280'
  const highlight = isDark ? '#e8f442' : '#7a6200'
  const groupBg = isDark ? '#0d0d0d' : '#fafaf8'
  const barBgOther = isDark ? '#2a3050' : '#d1d5db'

  const mesCurso = new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  const mesLabel = mesCurso.charAt(0).toUpperCase() + mesCurso.slice(1)

  /* ── render ────────────────────────────────────────────── */

  const titleStyle: React.CSSProperties = {
    fontFamily: 'Oswald, sans-serif',
    fontSize: '1.1rem',
    letterSpacing: '3px',
    color: textSec,
    marginBottom: 20,
    textTransform: 'uppercase',
  }

  if (loading) {
    return (
      <div>
        <h1 style={titleStyle}>Dashboard</h1>
        <div style={{ backgroundColor: surface, border: `1px solid ${border}`, borderRadius: 10, padding: 48, textAlign: 'center' }}>
          <div className="inline-block h-6 w-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p style={{ color: textSec, fontSize: 13, marginTop: 12 }}>Cargando…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h1 style={titleStyle}>Dashboard</h1>
        <div style={{ backgroundColor: surface, border: `1px solid ${border}`, borderRadius: 10, padding: 32, textAlign: 'center' }}>
          <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>
        </div>
      </div>
    )
  }

  const kpis = [
    { label: 'VENTAS SEMANA',  valor: fmtEur(ventasSemana), sub: `S${nSemana} · bruto` },
    { label: 'PEDIDOS SEMANA', valor: Math.round(pedidosSemana).toString(), sub: 'todos los canales' },
    { label: 'TICKET MEDIO',   valor: pedidosSemana > 0 ? fmtEur(ventasSemana / pedidosSemana) : '—', sub: 'bruto / pedido' },
    { label: 'VENTAS MES',     valor: fmtEur(ventasMes), sub: mesLabel },
  ]

  const totalChart = weekBars.reduce((a, w) => a + w.total, 0)

  return (
    <div>
      <h1 style={titleStyle}>Dashboard</h1>

      {/* Sección KPIs semana — agrupados */}
      <div style={{ border: `1px solid ${border}`, borderRadius: 10, padding: 16, marginBottom: 16, backgroundColor: groupBg }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.55rem', letterSpacing: '2px', color: textSec, marginBottom: 12, textTransform: 'uppercase' }}>
          Esta semana — S{nSemana}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ backgroundColor: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '14px 18px' }}>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.55rem', letterSpacing: '1.5px', color: textSec, marginBottom: 5, textTransform: 'uppercase' }}>
                {k.label}
              </div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.4rem', fontWeight: 600, color: textPri }}>
                {k.valor}
              </div>
              <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: '0.68rem', color: textSec, marginTop: 3 }}>
                {k.sub}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cards canales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        {canalStats.map(canal => {
          const color = CANAL_COLOR[canal.nombre] ?? '#888'
          return (
            <div key={canal.nombre} style={{ backgroundColor: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.55rem', letterSpacing: '1.5px', color: textSec, textTransform: 'uppercase' }}>
                  {canal.nombre}
                </span>
                <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.72rem', fontWeight: 600, color }}>
                  {canal.pct.toFixed(1)}%
                </span>
              </div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.15rem', fontWeight: 600, color: textPri, marginBottom: 8 }}>
                {fmtEur(canal.total)}
              </div>
              <div style={{ height: 3, backgroundColor: border, borderRadius: 2 }}>
                <div style={{ height: 3, width: `${Math.min(canal.pct, 100)}%`, backgroundColor: color, borderRadius: 2 }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Gráfico últimas 4 semanas */}
      <div style={{ backgroundColor: surface, border: `1px solid ${border}`, borderRadius: 10, padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.6rem', letterSpacing: '2px', color: textSec, textTransform: 'uppercase' }}>
            Últimas 4 semanas
          </span>
          <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: '0.72rem', color: textSec }}>
            Total: {fmtEur(totalChart)}
          </span>
        </div>
        {weekBars.length === 0 ? (
          <p style={{ color: textSec, fontSize: 13, textAlign: 'center', padding: '32px 0' }}>Sin datos</p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 160 }}>
            {weekBars.map((w, idx) => {
              const maxVal = Math.max(...weekBars.map(x => x.total), 1)
              const pct = (w.total / maxVal) * 100
              const isLast = idx === weekBars.length - 1
              const barColor = isLast ? highlight : barBgOther
              const textColor = isLast ? highlight : textSec
              return (
                <div key={w.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: '0.68rem', color: textColor, fontWeight: isLast ? 600 : 400 }}>
                    {fmtEur(w.total)}
                  </span>
                  <div style={{ width: '100%', height: `${pct}%`, backgroundColor: barColor, borderRadius: '4px 4px 0 0', minHeight: 4, transition: 'height 0.3s ease' }} />
                  <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.62rem', color: textColor, letterSpacing: '1px', fontWeight: isLast ? 600 : 400 }}>
                    {w.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
