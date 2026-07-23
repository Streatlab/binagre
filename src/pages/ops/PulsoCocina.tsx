import { AZUL_CL, BLANCO, CREMA, GRANATE, GRIS, INK, NAR, ROJO_S, VERDE, SHADOW } from '@/styles/neobrutal'
import { ERROR_BANNER_BG, ERROR_BANNER_BORDE } from '@/styles/palettes'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT } from '@/styles/tokens'
import { COLORS } from '@/components/panel/resumen/tokens'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'

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
  { key: 'uber',    label: 'Uber Eats', color: VERDE, revKey: 'uber_neto',    ordKey: 'uber_pedidos' },
  { key: 'glovo',   label: 'Glovo',     color: COLORS.glovo, revKey: 'glovo_neto',   ordKey: 'glovo_pedidos' },
  { key: 'je',      label: 'JustEat',   color: NAR, revKey: 'je_neto',      ordKey: 'je_pedidos' },
  { key: 'web',     label: 'Web',       color: COLORS.redSL, revKey: 'web_neto',     ordKey: 'web_pedidos' },
  { key: 'directa', label: 'Directa',   color: AZUL_CL, revKey: 'directa_neto', ordKey: 'directa_pedidos' },
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
    if (avg === 0) return <span style={{ color: GRIS }}>—</span>
    const d = ((val - avg) / avg) * 100
    return <span style={{ color: d >= 0 ? COLORS.ok : COLORS.redSL, fontFamily: FONT.heading, fontSize: 12, fontWeight: 600 }}>{d >= 0 ? '▲' : '▼'} {Math.abs(d).toFixed(1)}%</span>
  }

  const deltaRev = totalRevAvg > 0 ? ((totalRevToday - totalRevAvg) / totalRevAvg) * 100 : null

  const titularHero = channels.length === 0 || (totalRevToday === 0 && totalRevAvg === 0)
    ? 'Aún no hay facturación registrada hoy.'
    : deltaRev === null ? 'Facturación de hoy, sin media previa para comparar.'
    : deltaRev >= 0 ? 'Hoy factura más que la media de este día de la semana.'
    : 'Hoy factura por debajo de la media de este día de la semana.'

  const atencionHero = [
    `${Math.round(totalOrdToday)} pedidos hoy`,
    totalOrdAvg > 0 ? `Media pedidos ${Math.round(totalOrdAvg)}` : null,
    `Actualizado ${lastRefresh.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`,
  ].filter(Boolean) as string[]

  return (
    <PantallaCantera>

      {/* Filtros propios planos */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={loadData} style={{ padding: '9px 16px', background: BLANCO, border: `3px solid ${INK}`, boxShadow: SHADOW, color: INK, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>Actualizar</button>
      </div>

      {/* 1 · Héroe del área Operaciones (naranja) */}
      <HeroCantera
        area="ops"
        periodo={new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^\w/, c => c.toUpperCase())}
        titular={titularHero}
        etiquetaDato="Facturación hoy"
        cifra={fmtE(totalRevToday)}
        variacionPct={deltaRev}
        atencion={atencionHero}
      />

      {error && <Papel ceja={ROJO_S} style={{ background: ERROR_BANNER_BG, border: `1px solid ${ERROR_BANNER_BORDE}`, color: ROJO_S }}>{error}</Papel>}

      {loading ? <div style={{ color: GRIS, fontSize: 13, padding: '20px 0' }}>Cargando…</div> : (
        <>
          {/* 3 · Frase potente (una sola, según el pulso del día) */}
          {deltaRev !== null && (
            deltaRev >= 0
              ? <FrasePotente significado="logro">El día va por encima de la media: mantén el ritmo de cocina.</FrasePotente>
              : <FrasePotente significado="peligro">El día va por debajo de la media: revisa pedidos parados o canales caídos.</FrasePotente>
          )}

          {/* 2 · Plancha comparativa de KPIs del día */}
          <div>
            <SeccionLabel bg={NAR}>Hoy vs. media del mismo día</SeccionLabel>
            <Plancha>
              <PlanchaCelda bg={VERDE} first>
                <div style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600 }}>Facturación hoy</div>
                <div style={{ fontFamily: FONT.heading, fontSize: 26, fontWeight: 700, marginTop: 6 }}>{fmtE(totalRevToday)}</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Media: {fmtE(totalRevAvg)}</div>
              </PlanchaCelda>
              <PlanchaCelda bg={NAR}>
                <div style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600 }}>Pedidos hoy</div>
                <div style={{ fontFamily: FONT.heading, fontSize: 26, fontWeight: 700, marginTop: 6 }}>{Math.round(totalOrdToday)}</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Media: {Math.round(totalOrdAvg)}</div>
              </PlanchaCelda>
            </Plancha>
          </div>

          {/* Detalle por canal — papel (sin sombra) */}
          <div>
            <SeccionLabel bg={GRANATE}>Detalle por canal</SeccionLabel>
            <Papel ceja={GRANATE} pad="0" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: INK }}>
                    {['Canal', 'Facturación Hoy', 'Media (mismo día)', 'Var.', 'Pedidos Hoy', 'Media Pedidos', 'Var.'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {channels.map(ch => (
                    <tr key={ch.key} style={{ borderBottom: `2px solid ${INK}` }}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: ch.color, flexShrink: 0 }} />
                          <span style={{ fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', color: GRIS }}>{ch.label}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>{fmtE(ch.todayRevenue)}</td>
                      <td style={{ padding: '12px 14px', color: GRIS }}>{fmtE(ch.avgRevenue)}</td>
                      <td style={{ padding: '12px 14px' }}><DeltaBadge val={ch.todayRevenue} avg={ch.avgRevenue} /></td>
                      <td style={{ padding: '12px 14px' }}>{Math.round(ch.todayOrders)}</td>
                      <td style={{ padding: '12px 14px', color: GRIS }}>{Math.round(ch.avgOrders)}</td>
                      <td style={{ padding: '12px 14px' }}><DeltaBadge val={ch.todayOrders} avg={ch.avgOrders} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Papel>
          </div>
        </>
      )}
    </PantallaCantera>
  )
}
