import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT } from '@/styles/tokens'
import { COLORS } from '@/components/panel/resumen/tokens'

const BG_OPS = '#111111'

interface FacturacionRow {
  fecha: string
  [key: string]: unknown
}

interface ChannelData {
  key: string
  label: string
  color: string
  todayRevenue: number
  todayOrders: number
  avgRevenue: number
  avgOrders: number
}

const CHANNELS = [
  { key: 'uber',    label: 'Uber Eats', color: '#06C167', revKey: 'uber_neto',    ordKey: 'uber_pedidos' },
  { key: 'glovo',   label: 'Glovo',     color: '#e8f442', revKey: 'glovo_neto',   ordKey: 'glovo_pedidos' },
  { key: 'je',      label: 'JustEat',   color: '#f5a623', revKey: 'je_neto',      ordKey: 'je_pedidos' },
  { key: 'web',     label: 'Web',       color: COLORS.redSL, revKey: 'web_neto',     ordKey: 'web_pedidos' },
  { key: 'directa', label: 'Directa',   color: '#66aaff', revKey: 'directa_neto', ordKey: 'directa_pedidos' },
]

function localDateStr(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function getDow(dateStr: string): number { return new Date(dateStr).getDay() }

function fmtE(n: number): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function numVal(row: FacturacionRow, key: string): number {
  const v = row[key]
  return typeof v === 'number' ? v : 0
}

export default function PulsoCocina() {
  const [channels, setChannels] = useState<ChannelData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const today = localDateStr()
      const todayDow = getDow(today)

      const { data: todayData, error: e1 } = await supabase
        .from('facturacion_diario').select('*').eq('fecha', today).maybeSingle()
      if (e1 && e1.code !== 'PGRST116') throw e1

      const { data: histData, error: e2 } = await supabase
        .from('facturacion_diario').select('*').lt('fecha', today).order('fecha', { ascending: false }).limit(60)
      if (e2) throw e2

      const sameDow = ((histData ?? []) as FacturacionRow[])
        .filter(r => getDow(r.fecha) === todayDow).slice(0, 4)

      const td = todayData as FacturacionRow | null
      const result: ChannelData[] = CHANNELS.map(ch => {
        const todayRev = td ? numVal(td, ch.revKey) : 0
        const todayOrd = td ? numVal(td, ch.ordKey) : 0
        const avgRev = sameDow.length > 0 ? sameDow.reduce((s, r) => s + numVal(r, ch.revKey), 0) / sameDow.length : 0
        const avgOrd = sameDow.length > 0 ? sameDow.reduce((s, r) => s + numVal(r, ch.ordKey), 0) / sameDow.length : 0
        return { key: ch.key, label: ch.label, color: ch.color, todayRevenue: todayRev, todayOrders: todayOrd, avgRevenue: avgRev, avgOrders: avgOrd }
      })

      setChannels(result)
      setLastRefresh(new Date())
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg.includes('42P01') ? 'Tabla facturacion_diario no encontrada.' : `Error: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  const totalRevToday = channels.reduce((s, c) => s + c.todayRevenue, 0)
  const totalOrdToday = channels.reduce((s, c) => s + c.todayOrders, 0)
  const totalRevAvg   = channels.reduce((s, c) => s + c.avgRevenue, 0)
  const totalOrdAvg   = channels.reduce((s, c) => s + c.avgOrders, 0)

  const DeltaBadge = ({ val, avg }: { val: number; avg: number }) => {
    if (avg === 0) return <span style={{ color: '#555555' }}>—</span>
    const d = ((val - avg) / avg) * 100
    return <span style={{ color: d >= 0 ? COLORS.ok : COLORS.redSL, fontFamily: FONT.heading, fontSize: 12, fontWeight: 600 }}>{d >= 0 ? '▲' : '▼'} {Math.abs(d).toFixed(1)}%</span>
  }

  return (
    <div style={{ fontFamily: FONT.body, padding: '28px', background: BG_OPS, minHeight: '100vh', color: '#ffffff' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: FONT.heading, fontSize: 22, letterSpacing: '3px', color: COLORS.redSL, fontWeight: 600, textTransform: 'uppercase', margin: '0 0 4px' }}>PULSO COCINA</h1>
          <span style={{ fontSize: 13, color: '#777777' }}>
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
            {' · '}Actualizado {lastRefresh.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <button onClick={loadData} style={{ padding: '8px 16px', background: '#1e1e1e', border: '1px solid #383838', borderRadius: 6, color: '#cccccc', fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>Actualizar</button>
      </div>

      {error && <div style={{ backgroundColor: '#2d1515', border: '1px solid #aa3030', borderRadius: 8, padding: '14px 18px', color: '#ffaaaa', fontSize: 13, marginBottom: 20 }}>{error}</div>}

      {loading ? <div style={{ color: '#777777', fontSize: 13, padding: '20px 0' }}>Cargando…</div> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 28 }}>
            {[
              { label: 'Facturación Hoy', val: fmtE(totalRevToday), avg: fmtE(totalRevAvg), delta: totalRevAvg > 0 ? ((totalRevToday - totalRevAvg) / totalRevAvg) * 100 : null },
              { label: 'Pedidos Hoy', val: Math.round(totalOrdToday).toString(), avg: `Media: ${Math.round(totalOrdAvg)}`, delta: totalOrdAvg > 0 ? ((totalOrdToday - totalOrdAvg) / totalOrdAvg) * 100 : null },
            ].map(kpi => (
              <div key={kpi.label} style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 10, padding: '20px 22px' }}>
                <div style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: '#777777', marginBottom: 8 }}>{kpi.label}</div>
                <div style={{ fontFamily: FONT.heading, fontSize: 32, fontWeight: 600, lineHeight: 1 }}>{kpi.val}</div>
                <div style={{ fontSize: 12, color: '#555555', marginTop: 6 }}>{kpi.avg}</div>
                {kpi.delta !== null && (
                  <div style={{ fontFamily: FONT.heading, fontSize: 13, marginTop: 6, color: kpi.delta >= 0 ? COLORS.ok : COLORS.redSL, fontWeight: 600 }}>
                    {kpi.delta >= 0 ? '▲' : '▼'} {Math.abs(kpi.delta).toFixed(1)}% vs media
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #2a2a2a' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#0a0a0a' }}>
                  {['Canal', 'Facturación Hoy', 'Media (mismo día)', 'Var.', 'Pedidos Hoy', 'Media Pedidos', 'Var.'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#777777', fontWeight: 600, borderBottom: '1px solid #2a2a2a', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {channels.map((ch, i) => (
                  <tr key={ch.key} style={{ background: i % 2 === 0 ? '#111111' : '#141414', borderBottom: '1px solid #1e1e1e' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: ch.color, flexShrink: 0 }} />
                        <span style={{ fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', color: '#cccccc' }}>{ch.label}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>{fmtE(ch.todayRevenue)}</td>
                    <td style={{ padding: '12px 14px', color: '#777777' }}>{fmtE(ch.avgRevenue)}</td>
                    <td style={{ padding: '12px 14px' }}><DeltaBadge val={ch.todayRevenue} avg={ch.avgRevenue} /></td>
                    <td style={{ padding: '12px 14px' }}>{Math.round(ch.todayOrders)}</td>
                    <td style={{ padding: '12px 14px', color: '#777777' }}>{Math.round(ch.avgOrders)}</td>
                    <td style={{ padding: '12px 14px' }}><DeltaBadge val={ch.todayOrders} avg={ch.avgOrders} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
