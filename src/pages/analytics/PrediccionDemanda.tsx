import { GRANATE } from '@/styles/neobrutal'
import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { COLORS, FONT, CARDS } from '@/components/panel/resumen/tokens'

interface Momento {
  marca: string
  hora: number
  pedidos: number
  pedidos_prime: number
  pct_prime: number
  incidencias: number
  ticket_medio: number | null
}
interface Salud {
  marca: string
  pedidos: number
  prime: number
  pct_prime: number
  incidencias: number
  pct_incidencias: number
  min_prep_medio: number | null
  min_entrega_medio: number | null
}

const card = CARDS.std
const cardBig = CARDS.big
const lbl: React.CSSProperties = { fontFamily: FONT.heading, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: COLORS.mut, fontWeight: 500 }
const lblSm: React.CSSProperties = { ...lbl, fontSize: 11, letterSpacing: 1.5 }
const td: React.CSSProperties = { padding: '9px 10px', fontFamily: FONT.heading, fontSize: 14, textAlign: 'right', color: COLORS.pri }

function pill(active: boolean): React.CSSProperties {
  return {
    padding: '5px 12px', borderRadius: 7,
    border: active ? 'none' : `0.5px solid ${COLORS.brd}`,
    background: active ? COLORS.pri : COLORS.card,
    color: active ? 'var(--sl-bg)' : COLORS.sec,
    fontFamily: FONT.body, fontSize: 12, fontWeight: 500, cursor: 'pointer',
  }
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ ...card, flex: 1, minWidth: 150 }}>
      <div style={lblSm}>{label}</div>
      <div style={{ fontFamily: FONT.heading, fontSize: 28, fontWeight: 600, color: color || COLORS.pri, lineHeight: 1.1, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default function PulsoOperativa() {
  const [momentos, setMomentos] = useState<Momento[]>([])
  const [salud, setSalud] = useState<Salud[]>([])
  const [loading, setLoading] = useState(true)
  const [marcaSel, setMarcaSel] = useState<string>('todas')

  useEffect(() => {
    Promise.all([
      supabase.from('v_operativa_cliente_momento').select('*'),
      supabase.from('v_salud_servicio').select('*'),
    ]).then(([m, s]) => {
      setMomentos((m.data ?? []) as Momento[])
      setSalud((s.data ?? []) as Salud[])
      setLoading(false)
    })
  }, [])

  const marcas = useMemo(() => Array.from(new Set(salud.map(s => s.marca))).sort(), [salud])

  const momFiltrados = useMemo(() => {
    const src = marcaSel === 'todas' ? momentos : momentos.filter(m => m.marca === marcaSel)
    const map = new Map<number, { hora: number; pedidos: number; prime: number; incidencias: number }>()
    for (const m of src) {
      const cur = map.get(m.hora) || { hora: m.hora, pedidos: 0, prime: 0, incidencias: 0 }
      cur.pedidos += m.pedidos
      cur.prime += m.pedidos_prime
      cur.incidencias += m.incidencias
      map.set(m.hora, cur)
    }
    return Array.from(map.values())
      .sort((a, b) => a.hora - b.hora)
      .map(h => ({ ...h, franja: `${String(h.hora).padStart(2, '0')}h`, pct_prime: h.pedidos > 0 ? Math.round(100 * h.prime / h.pedidos) : 0 }))
  }, [momentos, marcaSel])

  const tot = useMemo(() => {
    const src = marcaSel === 'todas' ? salud : salud.filter(s => s.marca === marcaSel)
    const pedidos = src.reduce((s, x) => s + x.pedidos, 0)
    const prime = src.reduce((s, x) => s + x.prime, 0)
    const incid = src.reduce((s, x) => s + x.incidencias, 0)
    const prep = src.filter(x => x.min_prep_medio != null)
    const entrega = src.filter(x => x.min_entrega_medio != null)
    return {
      pedidos, prime, incid,
      pctPrime: pedidos > 0 ? Math.round(100 * prime / pedidos) : 0,
      pctIncid: pedidos > 0 ? Math.round(100 * incid / pedidos) : 0,
      prepMedio: prep.length ? prep.reduce((s, x) => s + (x.min_prep_medio || 0), 0) / prep.length : null,
      entregaMedio: entrega.length ? entrega.reduce((s, x) => s + (x.min_entrega_medio || 0), 0) / entrega.length : null,
    }
  }, [salud, marcaSel])

  const hayDatos = momentos.length > 0 || salud.length > 0

  return (
    <div style={{ background: 'var(--sl-bg)', padding: '24px 28px', minHeight: '100vh' }}>
      <h1 style={{ fontFamily: FONT.heading, fontSize: 28, fontWeight: 600, color: COLORS.pri, letterSpacing: '0.04em', margin: 0 }}>PULSO DE OPERATIVA</h1>
      <p style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.mut, marginTop: 4, marginBottom: 20 }}>
        Quien compra, a que hora, cuanto tarda el servicio y donde hay incidencias.
      </p>

      {loading ? (
        <div style={{ ...card, textAlign: 'center', color: COLORS.mut, fontFamily: FONT.body }}>Cargando...</div>
      ) : !hayDatos ? (
        <div style={{ ...card, textAlign: 'center', color: COLORS.mut, fontFamily: FONT.body, padding: 32 }}>
          Todavia no hay pedidos con detalle operativo.<br />
          Sube un historial de pedidos de Uber por la Bandeja de entrada y esta pantalla se llena sola.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
            <button onClick={() => setMarcaSel('todas')} style={pill(marcaSel === 'todas')}>Todas</button>
            {marcas.map(m => (
              <button key={m} onClick={() => setMarcaSel(m)} style={pill(marcaSel === m)}>{m}</button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
            <KpiCard label="Pedidos" value={String(tot.pedidos)} />
            <KpiCard label="Clientes Prime" value={`${tot.pctPrime}%`} sub={`${tot.prime} pedidos`} color={COLORS.ok} />
            <KpiCard label="Incidencias" value={`${tot.pctIncid}%`} sub={`${tot.incid} pedidos`} color={tot.pctIncid > 5 ? COLORS.err : COLORS.ok} />
            <KpiCard label="Tiempo entrega" value={tot.entregaMedio != null ? `${tot.entregaMedio.toFixed(0)} min` : '-'} />
          </div>

          <div style={{ ...cardBig, marginBottom: 18 }}>
            <div style={lbl}>Pedidos por hora del dia</div>
            <div style={{ height: 260, marginTop: 12 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={momFiltrados} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.brd} vertical={false} />
                  <XAxis dataKey="franja" tick={{ fontFamily: FONT.body, fontSize: 11, fill: COLORS.sec }} />
                  <YAxis tick={{ fontFamily: FONT.body, fontSize: 11, fill: COLORS.mut }} />
                  <Tooltip formatter={((v: unknown, n: unknown) => [v as number, n === 'pedidos' ? 'Pedidos' : (n as string)]) as never} />
                  <Bar dataKey="pedidos" radius={[6, 6, 0, 0]}>
                    {momFiltrados.map((d, i) => (
                      <Cell key={i} fill={d.hora >= 13 && d.hora <= 15 ? COLORS.uber : d.hora >= 20 && d.hora <= 23 ? GRANATE : COLORS.mut} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={cardBig}>
            <div style={lbl}>Salud del servicio por marca</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
              <thead>
                <tr>
                  {['Marca', 'Pedidos', '% Prime', '% Incidencias', 'Prep.', 'Entrega'].map((h, i) => (
                    <th key={h} style={{ ...lblSm, textAlign: i === 0 ? 'left' : 'right', padding: '8px 10px', borderBottom: `1px solid ${COLORS.brd}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...salud].sort((a, b) => b.pedidos - a.pedidos).map(s => (
                  <tr key={s.marca}>
                    <td style={{ padding: '9px 10px', fontFamily: FONT.body, fontSize: 14, color: COLORS.pri }}>{s.marca}</td>
                    <td style={td}>{s.pedidos}</td>
                    <td style={{ ...td, color: COLORS.ok }}>{s.pct_prime ?? 0}%</td>
                    <td style={{ ...td, color: (s.pct_incidencias ?? 0) > 5 ? COLORS.err : COLORS.pri }}>{s.pct_incidencias ?? 0}%</td>
                    <td style={td}>{s.min_prep_medio != null ? `${s.min_prep_medio} min` : '-'}</td>
                    <td style={td}>{s.min_entrega_medio != null ? `${s.min_entrega_medio} min` : '-'}</td>
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
