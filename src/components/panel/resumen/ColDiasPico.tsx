import { fmtEur } from '@/lib/format'
import { COLOR, OSWALD, LEXEND, cardBig, lbl, lblSm } from './tokens'

export interface DiaPico {
  /** 0=Lun ... 6=Dom */
  idx: number
  nombre: string
  valor: number
  color: string
}

interface Props {
  dias: DiaPico[]
  media: number
  nombreMes?: string
  onClickDia?: (idxDow: number) => void
}

const NOMBRES_LARGOS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const POS_X_TEXTO = [35, 100, 165, 230, 295, 360, 425]
const POS_X_BARRA = [15, 80, 145, 210, 275, 340, 405]
const ETIQUETAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// Altura de la línea media en el SVG (base 190, altura max 125)
const SVG_BASE = 190
const SVG_MAX_H = 125

export default function ColDiasPico({ dias, media, nombreMes, onClickDia }: Props) {
  const max = Math.max(...dias.map(d => d.valor), 1)
  const validos = dias.filter(d => d.valor > 0)
  const conMax = [...validos].sort((a, b) => b.valor - a.valor)[0]
  const conMin = [...validos].sort((a, b) => a.valor - b.valor)[0]
  const sinDatos = validos.length === 0

  function altura(val: number): number {
    if (val <= 0) return 0
    const h = (val / max) * SVG_MAX_H
    return Math.max(30, h)
  }

  // Posición Y de la línea media en el SVG
  const mediaH = media > 0 && max > 0 ? Math.min((media / max) * SVG_MAX_H, SVG_MAX_H) : 0
  const mediaY = SVG_BASE - mediaH

  const titulo = nombreMes
    ? `DÍAS PICO — ${nombreMes.toUpperCase()} — FACTURACIÓN BRUTA`
    : 'DÍAS PICO — MES ACTUAL — FACTURACIÓN BRUTA'

  return (
    <div>
      <div style={{ ...lbl, marginBottom: 10 }}>{titulo}</div>
      <div style={{ ...cardBig, padding: 18 }}>
        {sinDatos ? (
          <div style={{ textAlign: 'center', color: COLOR.textMut, fontSize: 12, fontFamily: LEXEND, padding: '40px 0' }}>
            Datos insuficientes
          </div>
        ) : (
          <svg viewBox="0 0 480 230" style={{ width: '100%', height: 'auto' }} xmlns="http://www.w3.org/2000/svg" fontFamily="Lexend, sans-serif">
            {/* Valores encima de barras */}
            {dias.map((d, i) => {
              const isMax = conMax && d.idx === conMax.idx
              const fill = isMax ? COLOR.textSec : COLOR.textMut
              const weight = isMax ? 500 : 400
              return (
                <text key={`v${i}`} x={POS_X_TEXTO[i]} y="20" fontSize="11" fill={fill} textAnchor="middle" fontWeight={weight}>
                  {d.valor > 0 ? fmtEur(d.valor, { showEuro: false, decimals: 0 }) : ''}
                </text>
              )
            })}

            {/* Barras */}
            {dias.map((d, i) => {
              const h = altura(d.valor)
              return (
                <rect
                  key={`b${i}`}
                  x={POS_X_BARRA[i]}
                  y={SVG_BASE - h}
                  width="40"
                  height={h}
                  fill={d.valor > 0 ? d.color : COLOR.bordeClaro}
                  rx="2"
                  style={{ cursor: onClickDia ? 'pointer' : 'default' }}
                  onClick={() => onClickDia?.(d.idx)}
                />
              )
            })}

            {/* Línea media horizontal */}
            {media > 0 && (
              <>
                <line
                  x1="0" y1={mediaY} x2="480" y2={mediaY}
                  stroke="#7a8090"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text x="478" y={mediaY - 3} fontSize="10" fill="#7a8090" textAnchor="end">
                  {`Media: ${fmtEur(media, { showEuro: false, decimals: 0 })}`}
                </text>
              </>
            )}

            {/* Etiquetas días */}
            {dias.map((_d, i) => (
              <text key={`l${i}`} x={POS_X_TEXTO[i]} y="210" fontSize="12" fill={COLOR.textMut} textAnchor="middle">
                {ETIQUETAS[i]}
              </text>
            ))}
          </svg>
        )}

        <div style={{ borderTop: `0.5px solid ${COLOR.borde}`, marginTop: 14, paddingTop: 12 }}>
          <Linea
            label="Día más fuerte"
            valor={conMax ? `${NOMBRES_LARGOS[conMax.idx]} · ${fmtEur(conMax.valor, { showEuro: false, decimals: 0 })}` : '—'}
            fuerte
          />
          <Linea
            label="Día más flojo"
            valor={conMin ? `${NOMBRES_LARGOS[conMin.idx]} · ${fmtEur(conMin.valor, { showEuro: false, decimals: 0 })}` : '—'}
          />
          <Linea label="Media diaria" valor={fmtEur(media, { showEuro: false, decimals: 0 })} />
        </div>
      </div>
    </div>
  )
}

function Linea({ label, valor, fuerte }: { label: string; valor: string; fuerte?: boolean }) {
  return (
    <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontFamily: LEXEND }}>
      <span style={{ color: COLOR.textMut }}>{label}</span>
      <span style={{ color: COLOR.textSec, fontWeight: fuerte ? 500 : 400, fontFamily: fuerte ? OSWALD : LEXEND }}>
        {valor}
      </span>
    </div>
  )
}
