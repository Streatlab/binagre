import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { OSW, LEX, INK, CREMA, GRIS, VERDE, GRANATE, NAR, BLANCO, CORP } from '@/styles/neobrutal'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel, SHADOW_DURA } from '@/components/kit/cantera'

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

function pill(active: boolean): React.CSSProperties {
  return {
    padding: '6px 14px', border: `2px solid ${INK}`, borderRadius: 0,
    background: active ? INK : BLANCO, color: active ? CREMA : INK,
    boxShadow: active ? SHADOW_DURA : 'none',
    fontFamily: OSW, fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', cursor: 'pointer',
  }
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
  const incidAlta = tot.pctIncid > 5

  const titular = tot.pedidos === 0
    ? 'Todavía no hay pedidos con detalle operativo.'
    : incidAlta
      ? 'Las incidencias están por encima de lo razonable: revisa el servicio.'
      : 'El servicio funciona con buena salud operativa.'

  const atencion = [
    `${tot.pctPrime}% clientes Prime`,
    `${tot.pctIncid}% incidencias`,
    tot.entregaMedio != null ? `Entrega media ${tot.entregaMedio.toFixed(0)} min` : null,
  ].filter(Boolean) as string[]

  return (
    <PantallaCantera>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button onClick={() => setMarcaSel('todas')} style={pill(marcaSel === 'todas')}>Todas</button>
        {marcas.map(m => (
          <button key={m} onClick={() => setMarcaSel(m)} style={pill(marcaSel === m)}>{m}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 32, color: GRIS, fontFamily: LEX }}>Cargando…</div>
      ) : !hayDatos ? (
        <Papel ceja={NAR}>
          <div style={{ color: GRIS, fontFamily: LEX }}>
            Todavía no hay pedidos con detalle operativo.<br />
            Sube un historial de pedidos de Uber por la Bandeja de entrada y esta pantalla se llena sola.
          </div>
        </Papel>
      ) : (
        <>
          {/* 1 · Héroe del área Ventas (verde) */}
          <HeroCantera
            area="ventas"
            periodo={marcaSel === 'todas' ? 'Todas las marcas' : marcaSel}
            titular={titular}
            etiquetaDato="Pedidos del periodo"
            cifra={tot.pedidos.toLocaleString('es-ES')}
            resumen={<>{tot.pctPrime}% de clientes Prime · entrega media {tot.entregaMedio != null ? `${tot.entregaMedio.toFixed(0)} min` : '—'}.</>}
            atencion={atencion}
          />

          {/* 2 · Plancha KPIs */}
          <div>
            <SeccionLabel bg={VERDE}>Salud del servicio</SeccionLabel>
            <Plancha>
              <PlanchaCelda first>
                <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Pedidos</div>
                <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{tot.pedidos}</div>
              </PlanchaCelda>
              <PlanchaCelda bg={VERDE} color={BLANCO}>
                <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Clientes Prime</div>
                <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{tot.pctPrime}%</div>
                <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>{tot.prime} pedidos</div>
              </PlanchaCelda>
              <PlanchaCelda bg={incidAlta ? GRANATE : BLANCO} color={incidAlta ? BLANCO : INK}>
                <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Incidencias</div>
                <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{tot.pctIncid}%</div>
                <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>{tot.incid} pedidos</div>
              </PlanchaCelda>
              <PlanchaCelda>
                <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Tiempo entrega</div>
                <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{tot.entregaMedio != null ? `${tot.entregaMedio.toFixed(0)} min` : '—'}</div>
              </PlanchaCelda>
            </Plancha>
          </div>

          {/* 3 · Frase potente (color por significado, distinto del héroe verde) */}
          {incidAlta
            ? <FrasePotente significado="coste">Las incidencias superan el 5%: revisa la operativa antes de que dañe la reputación en plataforma.</FrasePotente>
            : <FrasePotente significado="oportunidad">Buena salud de servicio: aprovecha para empujar más pedidos sin perder calidad.</FrasePotente>}

          {/* Gráfico — papel (sin sombra) */}
          <div>
            <SeccionLabel bg={NAR}>Pedidos por hora del día</SeccionLabel>
            <Papel ceja={NAR}>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={momFiltrados} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CREMA} vertical={false} />
                    <XAxis dataKey="franja" tick={{ fontFamily: LEX, fontSize: 11, fill: INK }} />
                    <YAxis tick={{ fontFamily: LEX, fontSize: 11, fill: GRIS }} />
                    <Tooltip formatter={((v: unknown, n: unknown) => [v as number, n === 'pedidos' ? 'Pedidos' : (n as string)]) as never} />
                    <Bar dataKey="pedidos" radius={0}>
                      {momFiltrados.map((d, i) => (
                        <Cell key={i} fill={d.hora >= 13 && d.hora <= 15 ? CORP.uber : d.hora >= 20 && d.hora <= 23 ? GRANATE : GRIS} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Papel>
          </div>

          {/* Tabla detalle — papel (sin sombra) */}
          <div>
            <SeccionLabel bg={GRANATE}>Salud del servicio por marca</SeccionLabel>
            <Papel ceja={GRANATE} pad="0" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX }}>
                <thead>
                  <tr style={{ background: INK }}>
                    {['Marca', 'Pedidos', '% Prime', '% Incidencias', 'Prep.', 'Entrega'].map((h, i) => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: i === 0 ? 'left' : 'right', fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...salud].sort((a, b) => b.pedidos - a.pedidos).map(s => (
                    <tr key={s.marca} style={{ borderBottom: `2px solid ${INK}` }}>
                      <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600 }}>{s.marca}</td>
                      <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600, textAlign: 'right' }}>{s.pedidos}</td>
                      <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600, textAlign: 'right', color: VERDE }}>{s.pct_prime ?? 0}%</td>
                      <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600, textAlign: 'right', color: (s.pct_incidencias ?? 0) > 5 ? GRANATE : INK }}>{s.pct_incidencias ?? 0}%</td>
                      <td style={{ padding: '10px 12px', fontFamily: LEX, textAlign: 'right', color: GRIS }}>{s.min_prep_medio != null ? `${s.min_prep_medio} min` : '—'}</td>
                      <td style={{ padding: '10px 12px', fontFamily: LEX, textAlign: 'right', color: GRIS }}>{s.min_entrega_medio != null ? `${s.min_entrega_medio} min` : '—'}</td>
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
