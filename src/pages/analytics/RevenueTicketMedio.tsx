import { useState, useEffect, useMemo } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { OSW, LEX, INK, CREMA, GRIS, VERDE, GRANATE, NAR, CORP } from '@/styles/neobrutal'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'

interface Row {
  plataforma: string
  mes: number
  año: number
  bruto: number | null
  neto_real_cobrado: number | null
  pedidos: number | null
}

const MES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

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
  const subeTicket = deltaTicket != null && deltaTicket >= 0

  const titular = serie.length === 0
    ? 'Aún no hay ventas cargadas.'
    : deltaTicket == null
      ? 'Tu revenue y ticket medio del periodo, sin comparativa previa.'
      : subeTicket ? 'Subes el ticket medio: cada pedido deja un poco más.'
      : 'El ticket medio afloja respecto al mes anterior.'

  const atencion = [
    ult ? `Último mes: ${ult.label} · ${fmtEur(ult.bruto)}` : null,
    `${tot.pedidos} pedidos en el periodo`,
    deltaTicket != null ? `Tendencia ${subeTicket ? '+' : '−'}${Math.abs(deltaTicket).toFixed(1)}% vs mes anterior` : null,
  ].filter(Boolean) as string[]

  return (
    <PantallaCantera>
      {loading ? (
        <div style={{ padding: 32, color: GRIS, fontFamily: LEX }}>Cargando ventas…</div>
      ) : serie.length === 0 ? (
        <Papel ceja={NAR}><div style={{ color: GRIS, fontFamily: LEX }}>Aún no hay ventas cargadas.</div></Papel>
      ) : (
        <>
          {/* 1 · Héroe del área Ventas (verde) */}
          <HeroCantera
            area="ventas"
            periodo={ult?.label}
            titular={titular}
            etiquetaDato="Ticket medio global"
            cifra={fmtEur(tot.ticket)}
            variacionPct={deltaTicket}
            resumen={<>Ventas totales del periodo: <b>{fmtEur(tot.bruto)}</b> · {tot.pedidos} pedidos.</>}
            atencion={atencion}
          />

          {/* 2 · Plancha KPIs */}
          <div>
            <SeccionLabel bg={VERDE}>Resumen del periodo</SeccionLabel>
            <Plancha>
              <PlanchaCelda first>
                <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Ventas totales</div>
                <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{fmtEur(tot.bruto)}</div>
                <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>{tot.pedidos} pedidos</div>
              </PlanchaCelda>
              <PlanchaCelda bg={deltaTicket != null && !subeTicket ? GRANATE : VERDE} color={CREMA}>
                <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Ticket medio</div>
                <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{fmtEur(tot.ticket)}</div>
              </PlanchaCelda>
              <PlanchaCelda>
                <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Último mes</div>
                <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{ult ? fmtEur(ult.bruto) : '—'}</div>
                <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>{ult?.label ?? '—'}</div>
              </PlanchaCelda>
            </Plancha>
          </div>

          {/* 3 · Frase potente (color por significado, distinto del héroe verde) */}
          {deltaTicket != null && (
            subeTicket
              ? <FrasePotente significado="oportunidad">Cada euro de ticket medio es margen sin coste de adquisición: la palanca más barata para crecer.</FrasePotente>
              : <FrasePotente significado="coste">El ticket medio cae: revisa upselling y combos antes de que arrastre la facturación.</FrasePotente>
          )}

          {/* Gráfico — papel (sin sombra) */}
          <div>
            <SeccionLabel bg={NAR}>Ventas y ticket medio por mes</SeccionLabel>
            <Papel ceja={NAR}>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={serie} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CREMA} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontFamily: LEX, fontSize: 11, fill: INK }} />
                    <YAxis yAxisId="l" tick={{ fontFamily: LEX, fontSize: 11, fill: GRIS }} />
                    <YAxis yAxisId="r" orientation="right" tick={{ fontFamily: LEX, fontSize: 11, fill: GRIS }} unit="€" />
                    <Tooltip formatter={((v: number, n: string) => [fmtEur(v), n === 'ticket' ? 'Ticket medio' : 'Ventas']) as never} />
                    <Bar yAxisId="l" dataKey="bruto" fill={CORP.uber} radius={0} />
                    <Line yAxisId="r" type="monotone" dataKey="ticket" stroke={GRANATE} strokeWidth={2.5} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Papel>
          </div>

          {/* Tabla detalle — papel (sin sombra) */}
          <div>
            <SeccionLabel bg={GRANATE}>Detalle mensual</SeccionLabel>
            <Papel ceja={GRANATE} pad="0" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX }}>
                <thead>
                  <tr style={{ background: INK }}>
                    {['Mes', 'Ventas', 'Neto real', 'Pedidos', 'Ticket medio'].map((h, i) => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: i === 0 ? 'left' : 'right', fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...serie].reverse().map(m => (
                    <tr key={m.key} style={{ borderBottom: `2px solid ${INK}` }}>
                      <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600, textTransform: 'uppercase' }}>{m.label}</td>
                      <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600, textAlign: 'right' }}>{fmtEur(m.bruto)}</td>
                      <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600, textAlign: 'right', color: VERDE }}>{fmtEur(m.neto)}</td>
                      <td style={{ padding: '10px 12px', fontFamily: LEX, textAlign: 'right', color: GRIS }}>{m.pedidos}</td>
                      <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 700, textAlign: 'right' }}>{fmtEur(m.ticket)}</td>
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
