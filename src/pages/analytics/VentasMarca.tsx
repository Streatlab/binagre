import { GRANATE, NAR, VERDE, OSW, LEX, INK, CREMA, GRIS, BLANCO } from '@/styles/neobrutal'
import { ANALYTICS_WEB_ALT, ANALYTICS_DIRECTA_ALT, VENTASMARCA_CHART_EXTRA } from '@/styles/palettes'
import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel, SHADOW_DURA } from '@/components/kit/cantera'

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

function pill(active: boolean): React.CSSProperties {
  return {
    padding: '6px 14px', border: `2px solid ${INK}`, borderRadius: 0,
    background: active ? INK : BLANCO, color: active ? CREMA : INK,
    boxShadow: active ? SHADOW_DURA : 'none',
    fontFamily: OSW, fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', cursor: 'pointer',
  }
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

  const lider = porMarca[0]
  const periodoLabel = mesSel === 'todos' ? 'Acumulado' : (meses.find(m => m.key === mesSel)?.label ?? mesSel)

  const titular = porMarca.length === 0
    ? 'Aún no hay ventas cargadas por marca.'
    : porMarca.length === 1
      ? 'Todas las ventas del periodo entran bajo una sola marca.'
      : <>La marca que más vende es <b>{lider.marca}</b>.</>

  const atencion = [
    `${porMarca.length} marcas con ventas`,
    lider ? `Líder: ${lider.marca} · ${fmtEur(lider.bruto)}` : null,
    `${tot.pedidos} pedidos`,
  ].filter(Boolean) as string[]

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
      ) : porMarca.length === 0 ? (
        <Papel ceja={NAR}><div style={{ color: GRIS, fontFamily: LEX }}>Aún no hay ventas cargadas para este periodo.</div></Papel>
      ) : (
        <>
          {/* 1 · Héroe del área Ventas (verde) */}
          <HeroCantera
            area="ventas"
            periodo={periodoLabel}
            titular={titular}
            etiquetaDato="Ventas brutas totales"
            cifra={fmtEur(tot.bruto)}
            resumen={<>Neto real cobrado: <b>{fmtEur(tot.neto)}</b> · {tot.pedidos} pedidos.</>}
            atencion={atencion}
          />

          {/* 2 · Plancha KPIs generales */}
          <div>
            <SeccionLabel bg={VERDE}>Resumen del periodo</SeccionLabel>
            <Plancha>
              <PlanchaCelda first>
                <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Ventas brutas</div>
                <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{fmtEur(tot.bruto)}</div>
                <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>{porMarca.length} marcas</div>
              </PlanchaCelda>
              <PlanchaCelda bg={VERDE} color={BLANCO}>
                <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Neto real</div>
                <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{fmtEur(tot.neto)}</div>
              </PlanchaCelda>
              <PlanchaCelda>
                <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Pedidos</div>
                <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{tot.pedidos}</div>
              </PlanchaCelda>
            </Plancha>
          </div>

          {/* 3 · Frase potente (color por significado, distinto del héroe verde) */}
          {porMarca.length > 1 && (
            <FrasePotente significado="oportunidad">Concentra foco comercial en {lider.marca}: es la marca que más tracción tiene ahora mismo.</FrasePotente>
          )}

          {/* Gráfico — papel (sin sombra) */}
          <div>
            <SeccionLabel bg={NAR}>Top marcas por ventas</SeccionLabel>
            <Papel ceja={NAR}>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CREMA} horizontal={false} />
                    <XAxis type="number" tick={{ fontFamily: LEX, fontSize: 11, fill: GRIS }} />
                    <YAxis type="category" dataKey="name" width={130} tick={{ fontFamily: LEX, fontSize: 12, fill: INK }} />
                    <Tooltip formatter={((v: number) => [fmtEur(v), 'Bruto']) as never} />
                    <Bar dataKey="bruto" radius={0}>
                      {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Papel>
          </div>

          {/* Tabla detalle — papel (sin sombra) */}
          <div>
            <SeccionLabel bg={GRANATE}>Detalle por marca</SeccionLabel>
            <Papel ceja={GRANATE} pad="0" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX }}>
                <thead>
                  <tr style={{ background: INK }}>
                    {['Marca', 'Bruto', 'Neto real', 'Pedidos', 'Ticket medio'].map((h, i) => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: i === 0 ? 'left' : 'right', fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {porMarca.map(c => (
                    <tr key={c.marca} style={{ borderBottom: `2px solid ${INK}` }}>
                      <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600 }}>
                        <span style={{ display: 'inline-block', width: 10, height: 10, background: c.color, marginRight: 8, border: `1px solid ${INK}` }} />
                        {c.marca}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600, textAlign: 'right' }}>{fmtEur(c.bruto)}</td>
                      <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600, textAlign: 'right', color: VERDE }}>{fmtEur(c.neto)}</td>
                      <td style={{ padding: '10px 12px', fontFamily: LEX, textAlign: 'right', color: GRIS }}>{c.pedidos}</td>
                      <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600, textAlign: 'right' }}>{fmtEur(c.ticket)}</td>
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
