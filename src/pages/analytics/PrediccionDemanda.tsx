import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { COLORS, FONT, CARDS } from '@/components/panel/resumen/tokens'

interface SaludRow {
  marca: string
  pedidos: number
  pct_prime: number | null
  pct_incidencias: number | null
  min_entrega_medio: number | null
  min_prep_medio: number | null
}
interface MomentoRow {
  marca: string
  hora: number
  pedidos: number
  pedidos_prime: number
  pct_prime: number | null
  incidencias: number
  ticket_medio: number | null
}

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

export default function PulsoOperativa() {
  const [salud, setSalud] = useState<SaludRow[]>([])
  const [momentos, setMomentos] = useState<MomentoRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('v_salud_servicio').select('*'),
      supabase.from('v_operativa_cliente_momento').select('marca, hora, pedidos, pedidos_prime, pct_prime, incidencias, ticket_medio'),
    ]).then(([s, m]) => {
      setSalud((s.data ?? []) as SaludRow[])
      setMomentos((m.data ?? []) as MomentoRow[])
      setLoading(false)
    })
  }, [])

  const porHora = useMemo(() => {
    const map = new Map<number, { hora: number; pedidos: number; prime: number; incidencias: number }>()
    for (const r of momentos) {
      const cur = map.get(r.hora) || { hora: r.hora, pedidos: 0, prime: 0, incidencias: 0 }
      cur.pedidos += r.pedidos
      cur.prime += r.pedidos_prime
      cur.incidencias += r.incidencias
      map.set(r.hora, cur)
    }
    return Array.from(map.values()).sort((a, b) => a.hora - b.hora)
      .map(h => ({ ...h, pct_prime: h.pedidos > 0 ? Math.round(100 * h.prime / h.pedidos) : 0, label: `${h.hora}h` }))
  }, [momentos])

  const tot = useMemo(() => {
    const pedidos = salud.reduce((s, r) => s + r.pedidos, 0)
    const prime = momentos.reduce((s, r) => s + r.pedidos_prime, 0)
    const inc = momentos.reduce((s, r) => s + r.incidencias, 0)
    return {
      pedidos,
      pctPrime: pedidos > 0 ? Math.round(100 * prime / pedidos) : 0,
      pctInc: pedidos > 0 ? Math.round(1000 * inc / pedidos) / 10 : 0,
    }
  }, [salud, momentos])

  return (
    <div style={{ background: 'var(--sl-bg)', padding: '24px 28px', minHeight: '100vh' }}>
      <h1 style={{ fontFamily: FONT.heading, fontSize: 28, fontWeight: 600, color: COLORS.pri, letterSpacing: '0.04em', margin: 0 }}>PULSO DE OPERATIVA</h1>
      <p style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.mut, marginTop: 4, marginBottom: 20 }}>
        Quién compra, a qué horas, cuánto tardáis y cuántas incidencias hay.
      </p>

      {loading ? (
        <div style={{ ...card, textAlign: 'center', color: COLORS.mut, fontFamily: FONT.body }}>Cargando…</div>
      ) : salud.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: COLORS.mut, fontFamily: FONT.body }}>
          Aún no hay pedidos con detalle. Sube un "historial de pedidos" de Uber por la Bandeja.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
            <KpiCard label="Pedidos con detalle" value={String(tot.pedidos)} />
            <KpiCard label="Clientes Prime" value={`${tot.pctPrime}%`} sub="suscriptores Uber One" color={COLORS.ok} />
            <KpiCard label="Incidencias" value={`${tot.pctInc}%`} sub="cancelaciones / problemas" color={tot.pctInc > 5 ? COLORS.err : COLORS.ok} />
          </div>

          <div style={{ ...cardBig, marginBottom: 18 }}>
            <div style={lbl}>Pedidos por hora del día</div>
            <div style={{ height: 260, marginTop: 12 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porHora} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.brd} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontFamily: FONT.body, fontSize: 11, fill: COLORS.sec }} />
                  <YAxis tick={{ fontFamily: FONT.body, fontSize: 11, fill: COLORS.mut }} />
                  <Tooltip formatter={(v: number, n: string) => [v, n === 'pedidos' ? 'Pedidos' : n]} />
                  <Bar dataKey="pedidos" radius={[6, 6, 0, 0]}>
                    {porHora.map((h, i) => <Cell key={i} fill={h.hora >= 13 && h.hora <= 15 ? COLORS.uber : h.hora >= 20 && h.hora <= 22 ? '#B01D23' : COLORS.mut} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={cardBig}>
            <div style={lbl}>Salud de servicio por marca</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
              <thead>
                <tr>
                  {['Marca', 'Pedidos', '% Prime', '% Incidencias', 'Min. prep.', 'Min. entrega'].map((h, i) => (
                    <th key={h} style={{ ...lblSm, textAlign: i === 0 ? 'left' : 'right', padding: '8px 10px', borderBottom: `1px solid ${COLORS.brd}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {salud.sort((a, b) => b.pedidos - a.pedidos).map(r => (
                  <tr key={r.marca}>
                    <td style={{ padding: '9px 10px', fontFamily: FONT.body, fontSize: 14, color: COLORS.pri }}>{r.marca}</td>
                    <td style={td}>{r.pedidos}</td>
                    <td style={{ ...td, color: COLORS.ok }}>{r.pct_prime ?? 0}%</td>
                    <td style={{ ...td, color: (r.pct_incidencias ?? 0) > 5 ? COLORS.err : COLORS.pri }}>{r.pct_incidencias ?? 0}%</td>
                    <td style={td}>{r.min_prep_medio ?? '—'}</td>
                    <td style={td}>{r.min_entrega_medio ?? '—'}</td>
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
