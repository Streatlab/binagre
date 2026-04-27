import { useMemo, useState } from 'react'
import { useTheme, FONT } from '@/styles/tokens'
import { fmtEur } from '@/utils/format'
import { useSueldos } from '@/hooks/useSueldos'

const ROJO = '#B01D23'

function mesActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function Socios() {
  const { T } = useTheme()
  const [mes, setMes] = useState<string>(mesActual)

  const { desde, hasta } = useMemo(() => {
    const [year, month] = mes.split('-').map(Number)
    const desde = new Date(year, month - 1, 1)
    const hasta = new Date(year, month, 0)
    return { desde, hasta }
  }, [mes])

  const { loading, error, emilio, ruben } = useSueldos(desde, hasta)

  // % sobre total negocio
  const totalResultado = ruben.resultado + emilio.total
  const pctRuben  = totalResultado !== 0 ? (ruben.resultado  / totalResultado) * 100 : null
  const pctEmilio = totalResultado !== 0 ? (emilio.total / totalResultado) * 100 : null

  const wrapPage: React.CSSProperties = {
    background: T.group,
    border: `0.5px solid ${T.brd}`,
    borderRadius: 16,
    padding: '24px 28px',
  }

  const cardStyle: React.CSSProperties = {
    background: T.card,
    border: `0.5px solid ${T.brd}`,
    borderRadius: 10,
    padding: '18px 20px',
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 11,
    letterSpacing: '1.5px',
    textTransform: 'uppercase' as const,
    color: T.mut,
    marginBottom: 4,
  }

  const valueStyle: React.CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 22,
    fontWeight: 600,
    color: T.pri,
    marginBottom: 0,
  }

  const kpiCard = (label: string, value: string, color?: string) => (
    <div style={{ ...cardStyle, marginBottom: 10 }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ ...valueStyle, color: color ?? T.pri }}>{value}</div>
    </div>
  )

  return (
    <div style={wrapPage}>
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{
          color: ROJO, fontFamily: FONT.heading, fontSize: 22, fontWeight: 500,
          letterSpacing: 1, margin: 0, textTransform: 'uppercase',
        }}>
          Vista Socios
        </h2>
        <input
          type="month"
          value={mes}
          onChange={e => setMes(e.target.value)}
          style={{
            padding: '8px 14px',
            border: `1px solid ${T.brd}`,
            borderRadius: 8,
            backgroundColor: T.card,
            color: T.pri,
            fontFamily: FONT.body,
            fontSize: 13,
            cursor: 'pointer',
            outline: 'none',
          }}
        />
      </div>

      {error && (
        <div style={{ background: '#FCEBEB', border: '1px solid #B01D23', color: '#A32D2D', padding: 16, borderRadius: 8, fontFamily: FONT.body, fontSize: 13, marginBottom: 16 }}>
          Error: {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 32, color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>
          Cargando datos…
        </div>
      )}

      {/* DOS COLUMNAS: Rubén | Emilio */}
      {!loading && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 20,
            marginBottom: 24,
          }}
            className="socios-cols"
          >
            {/* COLUMNA RUBÉN */}
            <div>
              <div style={{
                fontFamily: FONT.heading, fontSize: 13, color: ROJO, fontWeight: 500,
                letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 12,
              }}>
                Rubén
              </div>
              {kpiCard('Ingresos del mes', fmtEur(ruben.ingresosNetos), '#10B981')}
              {kpiCard('Gastos del mes', fmtEur(ruben.gastosNetos), '#F4C542')}
              {kpiCard(
                'Resultado neto',
                (ruben.resultado >= 0 ? '+' : '') + fmtEur(ruben.resultado),
                ruben.resultado >= 0 ? '#10B981' : '#C4372C',
              )}
              {kpiCard(
                '% sobre total negocio',
                pctRuben !== null ? `${pctRuben.toFixed(1)}%` : '—',
              )}
            </div>

            {/* COLUMNA EMILIO */}
            <div>
              <div style={{
                fontFamily: FONT.heading, fontSize: 13, color: ROJO, fontWeight: 500,
                letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 12,
              }}>
                Emilio
              </div>
              {/* Para Emilio usamos emilio.total = plataformas + complementoSL */}
              {kpiCard('Ingresos del mes (plataformas)', fmtEur(emilio.plataformas), '#10B981')}
              {kpiCard('Complemento SL (a/c Rubén)', fmtEur(emilio.complementoSL), '#F4C542')}
              {kpiCard(
                'Total percibido',
                fmtEur(emilio.total),
                '#10B981',
              )}
              {kpiCard(
                '% sobre total negocio',
                pctEmilio !== null ? `${pctEmilio.toFixed(1)}%` : '—',
              )}
            </div>
          </div>

          {/* CARD FULL WIDTH: Reparto resultado neto */}
          <div style={{
            background: T.card,
            border: `0.5px solid ${T.brd}`,
            borderRadius: 10,
            padding: '18px 20px',
          }}>
            <div style={{
              fontFamily: FONT.heading, fontSize: 13, color: ROJO, fontWeight: 500,
              letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 10,
            }}>
              Reparto del resultado neto · decision humana
            </div>
            <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec, lineHeight: 1.6 }}>
              Resultado neto del negocio: <strong style={{ color: T.pri }}>{fmtEur(totalResultado)}</strong>.
              {' '}Decidir reparto manualmente (no se calcula automaticamente).
            </div>
            <div style={{ marginTop: 10, fontFamily: FONT.body, fontSize: 12, color: T.mut }}>
              Nota: El calculo de Emilio incluye ingresos de plataformas (ING-*) mas complemento SL abonado desde cuenta Ruben (RRH-NOM-EMI).
              Las transferencias internas (INT-TRF*) estan excluidas del calculo de Ruben.
            </div>
          </div>
        </>
      )}

      <style>{`
        @media (max-width: 768px) {
          .socios-cols { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
