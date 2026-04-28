import { useEffect, useState } from 'react'
import { useTheme, FONT, cardStyle } from '@/styles/tokens'
import { fmtNum, fmtEur } from '@/utils/format'
import { calcularMermas, type MermaIngrediente } from '@/lib/inventario/calcularMermas'

interface Props {
  desde: string
  hasta: string
}

export default function TabMermas({ desde, hasta }: Props) {
  const { T } = useTheme()
  const [mermas, setMermas] = useState<MermaIngrediente[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    calcularMermas(desde, hasta)
      .then(data => { setMermas(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [desde, hasta])

  const conDatos = mermas.filter(m => !m.sin_datos)
  const conAlerta = conDatos.filter(m => m.merma_pct !== null && m.merma_pct > 5)
  const top5 = [...conDatos].sort((a, b) => (b.merma_eur ?? 0) - (a.merma_eur ?? 0)).slice(0, 5)
  const totalMermaEur = conDatos.reduce((s, m) => s + (m.merma_eur ?? 0), 0)

  const thStyle: React.CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 11,
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    color: T.mut,
    padding: '8px 12px',
    textAlign: 'left',
    background: '#0a0a0a',
    borderBottom: `1px solid ${T.brd}`,
    whiteSpace: 'nowrap',
  }
  const tdStyle: React.CSSProperties = {
    padding: '8px 12px',
    fontSize: 13,
    color: T.pri,
    borderBottom: `0.5px solid ${T.brd}`,
    fontFamily: FONT.body,
    verticalAlign: 'middle',
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Calculando mermas...</div>
  }

  if (mermas.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>
        Sin conteos en este periodo. Crea conteos en la tab Conteos para ver mermas.
      </div>
    )
  }

  return (
    <div>
      {/* Alerta merma > 5% */}
      {conAlerta.length > 0 && (
        <div style={{
          background: '#2a1a1a',
          border: '1px solid #B01D23',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>⚠</span>
          <span style={{ color: '#e24b4a', fontFamily: FONT.body, fontSize: 13 }}>
            <strong>{conAlerta.length} ingrediente{conAlerta.length !== 1 ? 's' : ''}</strong> con merma superior al 5% en este periodo.
            {' '}{conAlerta.map(m => m.nombre).slice(0, 3).join(', ')}{conAlerta.length > 3 ? '...' : ''}
          </span>
        </div>
      )}

      {/* Cards resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 20 }}>
        <div style={{ ...cardStyle(T), padding: '16px 20px' }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 6 }}>
            Total merma €
          </div>
          <div style={{ fontFamily: FONT.heading, fontSize: '2rem', fontWeight: 700, color: totalMermaEur > 0 ? '#e24b4a' : '#4caf50' }}>
            {fmtEur(totalMermaEur)}
          </div>
        </div>
        <div style={{ ...cardStyle(T), padding: '16px 20px' }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 6 }}>
            Ingredientes analizados
          </div>
          <div style={{ fontFamily: FONT.heading, fontSize: '2rem', fontWeight: 700, color: T.pri }}>
            {conDatos.length}
          </div>
        </div>
        <div style={{ ...cardStyle(T), padding: '16px 20px' }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 6 }}>
            Alertas &gt;5%
          </div>
          <div style={{ fontFamily: FONT.heading, fontSize: '2rem', fontWeight: 700, color: conAlerta.length > 0 ? '#e24b4a' : '#4caf50' }}>
            {conAlerta.length}
          </div>
        </div>
      </div>

      {/* Top 5 */}
      {top5.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontFamily: FONT.heading, fontSize: 13, letterSpacing: '2px', textTransform: 'uppercase', color: T.sec, marginBottom: 10 }}>
            Top 5 mayor merma (€)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {top5.map((m, i) => (
              <div key={m.ingrediente_id} style={{ ...cardStyle(T), padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: FONT.heading, fontSize: 16, color: T.mut, minWidth: 20 }}>{i + 1}.</span>
                  <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri }}>{m.nombre}</span>
                  {m.merma_pct !== null && m.merma_pct > 5 && (
                    <span style={{ fontSize: 10, background: '#2a1a1a', color: '#e24b4a', padding: '1px 6px', borderRadius: 4, fontFamily: FONT.heading }}>
                      {m.merma_pct.toFixed(1)}%
                    </span>
                  )}
                </div>
                <span style={{ fontFamily: FONT.heading, fontSize: 14, color: (m.merma_eur ?? 0) > 0 ? '#e24b4a' : '#4caf50' }}>
                  {fmtEur(m.merma_eur ?? 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabla completa */}
      <div style={{ ...cardStyle(T), padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Ingrediente</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Consumo real</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Consumo teórico</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Merma (u)</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Merma %</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Merma €</th>
            </tr>
          </thead>
          <tbody>
            {mermas.map(m => (
              <tr key={m.ingrediente_id}>
                <td style={tdStyle}>
                  {m.nombre}
                  <span style={{ color: T.mut, fontSize: 11, marginLeft: 4 }}>({m.unidad})</span>
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtNum(m.consumo_real)}</td>
                <td style={{ ...tdStyle, textAlign: 'right', color: T.sec }}>
                  {m.sin_datos ? (
                    <span style={{ fontSize: 11, color: T.mut }}>Sin datos ventas — merma no calculable</span>
                  ) : fmtNum(m.consumo_teorico ?? 0)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  {m.merma !== null ? (
                    <span style={{ color: m.merma > 0 ? '#e24b4a' : m.merma < 0 ? '#e8f442' : T.sec }}>
                      {fmtNum(m.merma)}
                      {m.merma < 0 && <span title="Posible error de conteo" style={{ marginLeft: 4, fontSize: 10 }}>⚠</span>}
                    </span>
                  ) : '—'}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  {m.merma_pct !== null ? (
                    <span style={{
                      fontWeight: m.merma_pct > 5 ? 700 : 400,
                      color: m.merma_pct > 5 ? '#e24b4a' : m.merma_pct > 2 ? '#f5a623' : T.sec,
                    }}>
                      {m.merma_pct.toFixed(1)}%
                    </span>
                  ) : '—'}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  {m.merma_eur !== null ? (
                    <span style={{ color: m.merma_eur > 0 ? '#e24b4a' : '#4caf50' }}>
                      {fmtEur(m.merma_eur)}
                    </span>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
