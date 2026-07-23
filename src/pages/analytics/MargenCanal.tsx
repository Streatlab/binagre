import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { fmtDec } from '@/components/panel/resumen/tokens'
import { OSW, LEX, INK, CREMA, GRIS, VERDE, GRANATE, NAR, BLANCO, CORP, CLARA } from '@/styles/neobrutal'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel, SHADOW_DURA } from '@/components/kit/cantera'

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
const CANAL_CORP_KEY: Record<string, string> = {
  uber: 'uber', glovo: 'glovo', just_eat: 'je', je: 'je', web: 'web', directa: 'dir',
}
const MES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function pill(active: boolean): React.CSSProperties {
  return {
    padding: '6px 14px', border: `2px solid ${INK}`, borderRadius: 0,
    background: active ? INK : BLANCO, color: active ? CREMA : INK,
    boxShadow: active ? SHADOW_DURA : 'none',
    fontFamily: OSW, fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', cursor: 'pointer',
  }
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
        color: CORP[CANAL_CORP_KEY[canal]] ?? INK,
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

  const margenSano = tot.margenPct >= 45
  const periodoLabel = mesSel === 'todos' ? 'Acumulado' : (meses.find(m => m.key === mesSel)?.label ?? mesSel)

  const titular = tot.bruto === 0
    ? 'Aún no hay ventas cargadas para calcular margen.'
    : margenSano
      ? 'El margen se mantiene sano en la mayoría de canales.'
      : 'El margen aprieta: comisiones y promociones se comen más de la cuenta.'

  const atencion = [
    `${porCanal.length} canales con ventas`,
    `${tot.pedidos} pedidos`,
    `Margen medio ${fmtDec(tot.margenPct, 1)}%`,
  ]

  return (
    <PantallaCantera>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button onClick={() => setMesSel('todos')} style={pill(mesSel === 'todos')}>Todo</button>
        {meses.map(m => (
          <button key={m.key} onClick={() => setMesSel(m.key)} style={pill(mesSel === m.key)}>{m.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 32, color: GRIS, fontFamily: LEX }}>Cargando ventas…</div>
      ) : porCanal.length === 0 ? (
        <Papel ceja={NAR}><div style={{ color: GRIS, fontFamily: LEX }}>Aún no hay ventas cargadas para este periodo.</div></Papel>
      ) : (
        <>
          {/* 1 · Héroe del área Ventas (verde) */}
          <HeroCantera
            area="ventas"
            periodo={periodoLabel}
            titular={titular}
            etiquetaDato="Margen medio · neto / bruto"
            cifra={`${fmtDec(tot.margenPct, 1)}%`}
            resumen={<>Neto real cobrado: <b>{fmtEur(tot.neto)}</b> sobre <b>{fmtEur(tot.bruto)}</b> de bruto.</>}
            atencion={atencion}
          />

          {/* 2 · Plancha comparativa por canal */}
          <div>
            <SeccionLabel bg={VERDE}>Margen por canal</SeccionLabel>
            <Plancha>
              {porCanal.map((c, i) => {
                const fg = CLARA[CANAL_CORP_KEY[c.canal]] === false ? BLANCO : INK
                return (
                  <PlanchaCelda key={c.canal} bg={c.color} color={fg} first={i === 0}>
                    <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>{c.label}</div>
                    <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{fmtDec(c.margenPct, 1)}%</div>
                    <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>{fmtEur(c.bruto)} bruto</div>
                  </PlanchaCelda>
                )
              })}
            </Plancha>
          </div>

          {/* 3 · Frase potente (color por significado, distinto del héroe verde) */}
          {margenSano
            ? <FrasePotente significado="oportunidad">Mantén el foco en los canales de mejor margen: cada punto que ganes ahí pesa más que en el resto.</FrasePotente>
            : <FrasePotente significado="coste">Revisa comisiones y cargos de promoción por canal antes de que sigan erosionando el neto real.</FrasePotente>}

          {/* Gráfico — papel (sin sombra) */}
          <div>
            <SeccionLabel bg={NAR}>% de margen por canal</SeccionLabel>
            <Papel ceja={NAR}>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CREMA} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontFamily: LEX, fontSize: 12, fill: INK }} />
                    <YAxis tick={{ fontFamily: LEX, fontSize: 11, fill: GRIS }} unit="%" />
                    <Tooltip formatter={((v: number) => [`${v}%`, 'Margen']) as never} />
                    <Bar dataKey="margen" radius={0}>
                      {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Papel>
          </div>

          {/* Tabla detalle — papel (sin sombra) */}
          <div>
            <SeccionLabel bg={GRANATE}>Detalle por canal</SeccionLabel>
            <Papel ceja={GRANATE} pad="0" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX }}>
                <thead>
                  <tr style={{ background: INK }}>
                    {['Canal', 'Bruto', 'Comisiones', 'Promo', 'Neto real', 'Margen', 'Pedidos'].map((h, i) => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: i === 0 ? 'left' : 'right', fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {porCanal.map(c => (
                    <tr key={c.canal} style={{ borderBottom: `2px solid ${INK}` }}>
                      <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600 }}>
                        <span style={{ display: 'inline-block', width: 10, height: 10, background: c.color, marginRight: 8, border: `1px solid ${INK}` }} />
                        {c.label}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600, textAlign: 'right' }}>{fmtEur(c.bruto)}</td>
                      <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600, textAlign: 'right', color: GRANATE }}>{fmtEur(c.comis)}</td>
                      <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600, textAlign: 'right', color: GRANATE }}>{fmtEur(c.promo)}</td>
                      <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600, textAlign: 'right', color: VERDE }}>{fmtEur(c.neto)}</td>
                      <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 700, textAlign: 'right', color: c.margenPct >= 45 ? VERDE : NAR }}>{fmtDec(c.margenPct, 1)}%</td>
                      <td style={{ padding: '10px 12px', fontFamily: LEX, textAlign: 'right', color: GRIS }}>{c.pedidos}</td>
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
