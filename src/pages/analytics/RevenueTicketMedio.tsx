import { useState, useEffect, useMemo } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { COLORS, FONT, CARDS } from '@/components/panel/resumen/tokens'

interface Row {
  plataforma: string
  mes: number
  año: number
  bruto: number | null
  neto_real_cobrado: number | null
  pedidos: number | null
}

const MES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const card = CARDS.std
const cardBig = CARDS.big
const lbl: React.CSSProperties = { fontFamily: FONT.heading, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: COLORS.mut, fontWeight: 500 }
const lblSm: React.CSSProperties = { ...lbl, fontSize: 11, letterSpacing: 1.5 }
const td: React.CSSProperties = { padding: '9px 10px', fontFamily: FONT.heading, fontSize: 14, textAlign: 'right', color: COLORS.pri }

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ ...card, flex: 1, minWidth: 160 }}>
      <div style={lblSm}>{label}</div>
      <div style={{ fontFamily: FONT.heading, fontSize: 30, fontWeight: 600, color: color || COLORS.pri, lineHeight: 1.1, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default function RevenueTicketMedio() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('resumenes_plataforma_marca_mensual')
      .select('plataforma, mes, año, bruto, neto_real_cobrado, pedidos')
      .then(({ data }) => {
        setRows((data ?? []) as unknown as Row[])
        setLoading(false)
      })
  }, [])

  const serie = useMemo(() => {
    const map = new Map<string, { key: string; label: string; bruto: number; neto: number; pedidos: number }>()
    for (const r of rows) {
      const key = `${r.año}-${String(r.mes).padStart(2, '0')}`
      const cur = map.get(key) || { key, label: `${MES[r.mes]} ${String(r.año).slice(2)}`, bruto: 0, neto: 0, pedidos: 0 }
      cur.bruto += r.bruto ?? 0
      cur.neto += r.neto_real_cobrado ?? 0
      cur.pedidos += r.pedidos ?? 0
      map.set(key, cur)
    }
    return Array.from(map.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(m => ({ ...m, ticket: m.pedidos > 0 ? Math.round((m.bruto / m.pedidos) * 100) / 100 : 0 }))
  }, [rows])

  const tot = useMemo(() => {
    const bruto = serie.reduce((s, m) => s + m.bruto, 0)
    const pedidos = serie.reduce((s, m) => s + m.pedidos, 0)
    return { bruto, pedidos, ticket: pedidos > 0 ? bruto / pedidos : 0 }
  }, [serie])

  const ult = serie[serie.length - 1]
  const penult = serie[serie.length - 2]
  const deltaTicket = ult && penult && penult.ticket > 0 ? ((ult.ticket - penult.ticket) / penult.ticket) * 100 : null

  return (
    <div style={{ background: 'var(--sl-bg)', padding: '24px 28px', minHeight: '100vh' }}>
      <h1 style={{ fontFamily: FONT.heading, fontSize: 28, fontWeight: 600, color: COLORS.pri, letterSpacing: '0.04em', margin: 0 }}>REVENUE Y TICKET MEDIO</h1>
      <p style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.mut, marginTop: 4, marginBottom: 20 }}>
        Evolución de ventas y de lo que gasta cada cliente por pedido.
      </p>

      {loading ? (
        <div style={{ ...card, textAlign: 'center', color: COLORS.mut, fontFamily: FONT.body }}>Cargando ventas…</div>
      ) : serie.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: COLORS.mut, fontFamily: FONT.body }}>
          Aún no hay ventas cargadas.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
            <KpiCard label="Ventas totales" value={fmtEur(tot.bruto)} sub={`${tot.pedidos} pedidos`} />
            <KpiCard label="Ticket medio" value={fmtEur(tot.ticket)}
              sub={deltaTicket != null ? `${deltaTicket >= 0 ? '▲' : '▼'} ${Math.abs(deltaTicket).toFixed(1)}% vs mes anterior` : undefined}
              color={deltaTicket != null && deltaTicket >= 0 ? COLORS.ok : COLORS.err} />
            <KpiCard label="Último mes" value={ult ? fmtEur(ult.bruto) : '—'} sub={ult?.label} />
          </div>

          <div style={{ ...cardBig, marginBottom: 18 }}>
            <div style={lbl}>Ventas y ticket medio por mes</div>
            <div style={{ height: 300, marginTop: 12 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={serie} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.brd} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontFamily: FONT.body, fontSize: 11, fill: COLORS.sec }} />
                  <YAxis yAxisId="l" tick={{ fontFamily: FONT.body, fontSize: 11, fill: COLORS.mut }} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontFamily: FONT.body, fontSize: 11, fill: COLORS.mut }} unit="€" />
                  <Tooltip formatter={((v: number, n: string) => [fmtEur(v), n === 'ticket' ? 'Ticket medio' : 'Ventas']) as never} />
                  <Bar yAxisId="l" dataKey="bruto" fill={COLORS.uber} radius={[6, 6, 0, 0]} />
                  <Line yAxisId="r" type="monotone" dataKey="ticket" stroke="#B01D23" strokeWidth={2.5} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={cardBig}>
            <div style={lbl}>Detalle mensual</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
              <thead>
                <tr>
                  {['Mes', 'Ventas', 'Neto real', 'Pedidos', 'Ticket medio'].map((h, i) => (
                    <th key={h} style={{ ...lblSm, textAlign: i === 0 ? 'left' : 'right', padding: '8px 10px', borderBottom: `1px solid ${COLORS.brd}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...serie].reverse().map(m => (
                  <tr key={m.key}>
                    <td style={{ padding: '9px 10px', fontFamily: FONT.body, fontSize: 14, color: COLORS.pri }}>{m.label}</td>
                    <td style={td}>{fmtEur(m.bruto)}</td>
                    <td style={{ ...td, color: COLORS.ok }}>{fmtEur(m.neto)}</td>
                    <td style={td}>{m.pedidos}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{fmtEur(m.ticket)}</td>
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
