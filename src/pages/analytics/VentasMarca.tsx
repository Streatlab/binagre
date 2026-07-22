import { GRANATE, NAR, VERDE } from '@/styles/neobrutal'
import { ANALYTICS_WEB_ALT, ANALYTICS_DIRECTA_ALT, VENTASMARCA_CHART_EXTRA } from '@/styles/palettes'
import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { COLORS, FONT, CARDS } from '@/components/panel/resumen/tokens'

interface Row {
  marca: string
  plataforma: string
  mes: number
  año: number
  bruto: number | null
  neto_real_cobrado: number | null
  pedidos: number | null
}

const MES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const PALETA = [GRANATE, VERDE, NAR, ANALYTICS_WEB_ALT, ANALYTICS_DIRECTA_ALT, VERDE, ...VENTASMARCA_CHART_EXTRA]

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
    <div style={{ ...card, flex: 1, minWidth: 160 }}>
      <div style={lblSm}>{label}</div>
      <div style={{ fontFamily: FONT.heading, fontSize: 30, fontWeight: 600, color: color || COLORS.pri, lineHeight: 1.1, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default function VentasMarca() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [mesSel, setMesSel] = useState<string>('todos')

  useEffect(() => {
    supabase
      .from('resumenes_plataforma_marca_mensual')
      .select('marca, plataforma, mes, año, bruto, neto_real_cobrado, pedidos')
      .then(({ data }) => {
        setRows((data ?? []) as unknown as Row[])
        setLoading(false)
      })
  }, [])

  const meses = useMemo(() => {
    const set = new Map<string, { key: string; label: string }>()
    for (const r of rows) {
      const key = `${r.año}-${r.mes}`
      set.set(key, { key, label: `${MES[r.mes]} ${String(r.año).slice(2)}` })
    }
    return Array.from(set.values()).sort((a, b) => b.key.localeCompare(a.key))
  }, [rows])

  const filtradas = useMemo(() => {
    if (mesSel === 'todos') return rows
    return rows.filter(r => `${r.año}-${r.mes}` === mesSel)
  }, [rows, mesSel])

  const porMarca = useMemo(() => {
    const map = new Map<string, { bruto: number; neto: number; pedidos: number }>()
    for (const r of filtradas) {
      const k = r.marca
      const cur = map.get(k) || { bruto: 0, neto: 0, pedidos: 0 }
      cur.bruto += r.bruto ?? 0
      cur.neto += r.neto_real_cobrado ?? 0
      cur.pedidos += r.pedidos ?? 0
      map.set(k, cur)
    }
    return Array.from(map.entries())
      .map(([marca, v], i) => ({
        marca,
        color: PALETA[i % PALETA.length],
        ...v,
        ticket: v.pedidos > 0 ? v.bruto / v.pedidos : 0,
      }))
      .sort((a, b) => b.bruto - a.bruto)
  }, [filtradas])

  const tot = useMemo(() => {
    const bruto = porMarca.reduce((s, c) => s + c.bruto, 0)
    const neto = porMarca.reduce((s, c) => s + c.neto, 0)
    const pedidos = porMarca.reduce((s, c) => s + c.pedidos, 0)
    return { bruto, neto, pedidos }
  }, [porMarca])

  const chartData = porMarca.slice(0, 10).map(c => ({ name: c.marca, bruto: Math.round(c.bruto), color: c.color }))

  return (
    <div style={{ background: 'var(--sl-bg)', padding: '24px 28px', minHeight: '100vh' }}>
      <h1 style={{ fontFamily: FONT.heading, fontSize: 28, fontWeight: 600, color: COLORS.pri, letterSpacing: '0.04em', margin: 0 }}>VENTAS POR MARCA</h1>
      <p style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.mut, marginTop: 4, marginBottom: 20 }}>
        Qué marcas venden más, con las cifras reales de plataforma.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        <button onClick={() => setMesSel('todos')} style={pill(mesSel === 'todos')}>Todo</button>
        {meses.map(m => (
          <button key={m.key} onClick={() => setMesSel(m.key)} style={pill(mesSel === m.key)}>{m.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ ...card, textAlign: 'center', color: COLORS.mut, fontFamily: FONT.body }}>Cargando ventas…</div>
      ) : porMarca.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: COLORS.mut, fontFamily: FONT.body }}>
          Aún no hay ventas cargadas para este periodo.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
            <KpiCard label="Ventas brutas" value={fmtEur(tot.bruto)} sub={`${porMarca.length} marcas`} />
            <KpiCard label="Neto real" value={fmtEur(tot.neto)} color={COLORS.ok} />
            <KpiCard label="Pedidos" value={String(tot.pedidos)} />
          </div>

          <div style={{ ...cardBig, marginBottom: 18 }}>
            <div style={lbl}>Top marcas por ventas</div>
            <div style={{ height: 300, marginTop: 12 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.brd} horizontal={false} />
                  <XAxis type="number" tick={{ fontFamily: FONT.body, fontSize: 11, fill: COLORS.mut }} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontFamily: FONT.body, fontSize: 12, fill: COLORS.sec }} />
                  <Tooltip formatter={((v: number) => [fmtEur(v), 'Bruto']) as never} />
                  <Bar dataKey="bruto" radius={[0, 6, 6, 0]}>
                    {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={cardBig}>
            <div style={lbl}>Detalle por marca</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
              <thead>
                <tr>
                  {['Marca', 'Bruto', 'Neto real', 'Pedidos', 'Ticket medio'].map((h, i) => (
                    <th key={h} style={{ ...lblSm, textAlign: i === 0 ? 'left' : 'right', padding: '8px 10px', borderBottom: `1px solid ${COLORS.brd}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {porMarca.map(c => (
                  <tr key={c.marca}>
                    <td style={{ padding: '9px 10px', fontFamily: FONT.body, fontSize: 14, color: COLORS.pri }}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: c.color, marginRight: 8 }} />
                      {c.marca}
                    </td>
                    <td style={td}>{fmtEur(c.bruto)}</td>
                    <td style={{ ...td, color: COLORS.ok }}>{fmtEur(c.neto)}</td>
                    <td style={td}>{c.pedidos}</td>
                    <td style={td}>{fmtEur(c.ticket)}</td>
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
