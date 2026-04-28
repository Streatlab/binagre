import { useEffect, useState } from 'react'
import { useTheme, FONT, cardStyle } from '@/styles/tokens'
import { calcularFoodCostReal, type FoodCostResumen } from '@/lib/inventario/foodCostReal'
import { getPeriodoFechas, type PeriodoInventario } from '@/pages/stock/Inventario'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

const PERIODOS: { key: PeriodoInventario; label: string }[] = [
  { key: 'semana',       label: 'Semana actual' },
  { key: 'mes',          label: 'Mes actual' },
  { key: 'mes_anterior', label: 'Mes anterior' },
  { key: 'tres_meses',   label: 'Últimos 3 meses' },
  { key: 'anio',         label: 'Año actual' },
]

export default function TabAnalisisFoodCost() {
  const { T } = useTheme()
  const [periodo, setPeriodo] = useState<PeriodoInventario>('mes')
  const [data, setData] = useState<FoodCostResumen | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const { desde, hasta } = getPeriodoFechas(periodo)
    setLoading(true)
    calcularFoodCostReal(desde, hasta)
      .then(r => { setData(r); setLoading(false) })
      .catch(() => setLoading(false))
  }, [periodo])

  const semaforoColor = (desv: number | null) => {
    if (desv === null) return T.sec
    if (desv <= 1) return '#4caf50'
    if (desv <= 3) return '#f5a623'
    return '#e24b4a'
  }

  const semaforoLabel = (desv: number | null) => {
    if (desv === null) return 'Sin datos'
    if (desv <= 1) return 'OK'
    if (desv <= 3) return 'Atención'
    return 'Alerta'
  }

  const fmtPctValue = (v: number | null) =>
    v !== null ? v.toFixed(1) + ' %' : '—'

  const cardBigStyle = (color: string): React.CSSProperties => ({
    ...cardStyle(T),
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  })

  return (
    <div>
      {/* Selector periodo del tab */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <select
          value={periodo}
          onChange={e => setPeriodo(e.target.value as PeriodoInventario)}
          style={{
            padding: '7px 12px', borderRadius: 8,
            border: `0.5px solid ${T.brd}`, background: '#1e1e1e',
            color: T.pri, fontSize: 13, fontFamily: FONT.body, cursor: 'pointer',
          }}
        >
          {PERIODOS.map(p => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Alerta si real > teórico + 3% */}
      {data && data.desviacion !== null && data.desviacion > 3 && (
        <div style={{
          background: '#2a1a1a', border: '1px solid #B01D23',
          borderRadius: 8, padding: '12px 16px', marginBottom: 16,
          color: '#e24b4a', fontFamily: FONT.body, fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 18 }}>⚠</span>
          Food cost real supera el teórico en {data.desviacion.toFixed(1)} pp — revisar consumos y precios.
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Calculando...</div>
      ) : (
        <>
          {/* 3 Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 24 }}>
            {/* Card 1: Teórico */}
            <div style={cardBigStyle('#ffffff')}>
              <div style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut }}>
                Food cost teórico
              </div>
              <div style={{ fontFamily: FONT.heading, fontSize: '2.4rem', fontWeight: 700, color: T.pri, lineHeight: 1 }}>
                {fmtPctValue(data?.teorico ?? null)}
              </div>
              <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: T.mut }}>
                Escandallo
              </div>
            </div>

            {/* Card 2: Real */}
            <div style={cardBigStyle('#ffffff')}>
              <div style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut }}>
                Food cost real
              </div>
              <div style={{
                fontFamily: FONT.heading, fontSize: '2.4rem', fontWeight: 700, lineHeight: 1,
                color: data?.sinDatos ? T.mut : (data?.desviacion && data.desviacion > 3 ? '#e24b4a' : T.pri),
              }}>
                {data?.sinDatos ? '—' : fmtPctValue(data?.real ?? null)}
              </div>
              <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: T.mut }}>
                {data?.sinDatos ? 'Sin datos suficientes' : 'Inventario'}
              </div>
            </div>

            {/* Card 3: Desviación */}
            <div style={cardBigStyle('#ffffff')}>
              <div style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut }}>
                Desviación
              </div>
              <div style={{
                fontFamily: FONT.heading, fontSize: '2.4rem', fontWeight: 700, lineHeight: 1,
                color: semaforoColor(data?.desviacion ?? null),
              }}>
                {data?.desviacion !== null && data?.desviacion !== undefined
                  ? (data.desviacion >= 0 ? '+' : '') + data.desviacion.toFixed(1) + ' pp'
                  : '—'}
              </div>
              <div style={{
                fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase',
                color: semaforoColor(data?.desviacion ?? null),
              }}>
                {semaforoLabel(data?.desviacion ?? null)}
              </div>
            </div>
          </div>

          {/* Gráfico evolución mensual */}
          {data && data.evolucion.length > 0 ? (
            <div style={{ ...cardStyle(T), padding: '20px 16px' }}>
              <h3 style={{ fontFamily: FONT.heading, fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', color: T.sec, marginBottom: 16 }}>
                Evolución food cost
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.evolucion} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.brd} />
                  <XAxis
                    dataKey="mes"
                    tick={{ fill: T.mut, fontSize: 11, fontFamily: FONT.body }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={v => v + '%'}
                    tick={{ fill: T.mut, fontSize: 11, fontFamily: FONT.body }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1a', border: `1px solid ${T.brd}`, borderRadius: 8, fontFamily: FONT.body, fontSize: 12 }}
                    labelStyle={{ color: T.sec }}
                    formatter={(value: unknown) => [typeof value === 'number' ? value.toFixed(1) + '%' : '—', '']}
                  />
                  <Legend
                    wrapperStyle={{ fontFamily: FONT.body, fontSize: 12, color: T.sec }}
                  />
                  <Line
                    type="monotone"
                    dataKey="teorico"
                    stroke="#66aaff"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Teórico"
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="real"
                    stroke="#B01D23"
                    strokeWidth={2}
                    dot={{ fill: '#B01D23', r: 3 }}
                    name="Real"
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ ...cardStyle(T), padding: 32, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>
              Sin datos suficientes para mostrar el gráfico de evolución.
              Registra conteos con precios de ingredientes para activar esta vista.
            </div>
          )}
        </>
      )}
    </div>
  )
}
