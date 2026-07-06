import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
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
  comisiones: number | null
  cargos_promocion: number | null
  pedidos: number | null
}

const CANAL_LABEL: Record<string, string> = {
  uber: 'Uber Eats', glovo: 'Glovo', just_eat: 'Just Eat', je: 'Just Eat', web: 'Web', directa: 'Directa',
}
const CANAL_COLOR: Record<string, string> = {
  uber: COLORS.uber, glovo: COLORS.glovo, just_eat: COLORS.je, je: COLORS.je, web: '#6b7cff', directa: '#9b59b6',
}
const MES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

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

export default function MargenCanal() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [mesSel, setMesSel] = useState<string>('todos')

  useEffect(() => {
    supabase
      .from('resumenes_plataforma_marca_mensual')
      .select('plataforma, mes, año, bruto, neto_real_cobrado, comisiones, cargos_promocion, pedidos')
      .then(({ data }) => {
        setRows((data ?? []) as Row[])
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

  const porCanal = useMemo(() => {
    const map = new Map<string, { bruto: number; neto: number; comis: number; promo: number; pedidos: number }>()
    for (const r of filtradas) {
      const k = r.plataforma
      const cur = map.get(k) || { bruto: 0, neto: 0, comis: 0, promo: 0, pedidos: 0 }
      cur.bruto += r.bruto ?? 0
      cur.neto += r.neto_real_cobrado ?? 0
      cur.comis += r.comisiones ?? 0
      cur.promo += r.cargos_promocion ?? 0
      cur.pedidos += r.pedidos ?? 0
      map.set(k, cur)
    }
    return Array.from(map.entries())
      .map(([canal, v]) => ({
        canal,
        label: CANAL_LABEL[canal] || canal,
        color: CANAL_COLOR[canal] || COLORS.mut,
        ...v,
        margenPct: v.bruto > 0 ? (v.neto / v.bruto) * 100 : 0,
      }))
      .sort((a, b) => b.bruto - a.bruto)
  }, [filtradas])

  const tot = useMemo(() => {
    const bruto = porCanal.reduce((s, c) => s + c.bruto, 0)
    const neto = porCanal.reduce((s, c) => s + c.neto, 0)
    const pedidos = porCanal.reduce((s, c) => s + c.pedidos, 0)
    return { bruto, neto, pedidos, margenPct: bruto > 0 ? (neto / bruto) * 100 : 0 }
  }, [porCanal])

  const chartData = porCanal.map(c => ({ name: c.label, margen: Math.round(c.margenPct * 10) / 10, color: c.color }))

  return (
    <div style={{ background: 'var(--sl-bg)', padding: '24px 28px', minHeight: '100vh' }}>
      <h1 style={{ fontFamily: FONT.heading, fontSize: 28, fontWeight: 600, color: COLORS.pri, letterSpacing: '0.04em', margin: 0 }}>MARGEN POR CANAL</h1>
      <p style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.mut, marginTop: 4, marginBottom: 20 }}>
        Cuánto te queda de verdad en cada plataforma, con las ventas reales cargadas.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        <button onClick={() => setMesSel('todos')} style={pill(mesSel === 'todos')}>Todo</button>
        {meses.map(m => (
          <button key={m.key} onClick={() => setMesSel(m.key)} style={pill(mesSel === m.key)}>{m.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ ...card, textAlign: 'center', color: COLORS.mut, fontFamily: FONT.body }}>Cargando ventas…</div>
      ) : porCanal.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: COLORS.mut, fontFamily: FONT.body }}>
          Aún no hay ventas cargadas para este periodo.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
            <KpiCard label="Ventas brutas" value={fmtEur(tot.bruto)} sub={`${tot.pedidos} pedidos`} />
            <KpiCard label="Neto real cobrado" value={fmtEur(tot.neto)} color={COLORS.ok} />
            <KpiCard label="Margen medio" value={`${tot.margenPct.toFixed(1)}%`} sub="neto / bruto" color={tot.margenPct >= 45 ? COLORS.ok : COLORS.warn} />
          </div>

          <div style={{ ...cardBig, marginBottom: 18 }}>
            <div style={lbl}>% de margen por canal</div>
            <div style={{ height: 260, marginTop: 12 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.brd} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontFamily: FONT.body, fontSize: 12, fill: COLORS.sec }} />
                  <YAxis tick={{ fontFamily: FONT.body, fontSize: 11, fill: COLORS.mut }} unit="%" />
                  <Tooltip formatter={(v: number) => [`${v}%`, 'Margen']} />
                  <Bar dataKey="margen" radius={[6, 6, 0, 0]}>
                    {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={cardBig}>
            <div style={lbl}>Detalle por canal</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
              <thead>
                <tr>
                  {['Canal', 'Bruto', 'Comisiones', 'Promo', 'Neto real', 'Margen', 'Pedidos'].map((h, i) => (
                    <th key={h} style={{ ...lblSm, textAlign: i === 0 ? 'left' : 'right', padding: '8px 10px', borderBottom: `1px solid ${COLORS.brd}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {porCanal.map(c => (
                  <tr key={c.canal}>
                    <td style={{ padding: '9px 10px', fontFamily: FONT.body, fontSize: 14, color: COLORS.pri }}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: c.color, marginRight: 8 }} />
                      {c.label}
                    </td>
                    <td style={td}>{fmtEur(c.bruto)}</td>
                    <td style={{ ...td, color: COLORS.err }}>{fmtEur(c.comis)}</td>
                    <td style={{ ...td, color: COLORS.err }}>{fmtEur(c.promo)}</td>
                    <td style={{ ...td, color: COLORS.ok }}>{fmtEur(c.neto)}</td>
                    <td style={{ ...td, fontWeight: 600, color: c.margenPct >= 45 ? COLORS.ok : COLORS.warn }}>{c.margenPct.toFixed(1)}%</td>
                    <td style={td}>{c.pedidos}</td>
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
