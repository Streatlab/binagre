import { COLOR, OSWALD, LEXEND, cardBig, lbl, lblSm, fmtEntero, fmtEur0 } from './tokens'

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
  onClickDia?: (idxDow: number) => void
}

const NOMBRES_LARGOS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const POS_X_TEXTO = [35, 100, 165, 230, 295, 360, 425]
const POS_X_BARRA = [15, 80, 145, 210, 275, 340, 405]
const ETIQUETAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export default function ColDiasPico({ dias, media, onClickDia }: Props) {
  const max = Math.max(...dias.map(d => d.valor), 1)
  const validos = dias.filter(d => d.valor > 0)
  const conMax = [...validos].sort((a, b) => b.valor - a.valor)[0]
  const conMin = [...validos].sort((a, b) => a.valor - b.valor)[0]

  function altura(val: number): number {
    if (val <= 0) return 0
    const h = (val / max) * 125
    return Math.max(30, h)
  }

  return (
    <div>
      <div style={{ ...lbl, marginBottom: 10 }}>DÍAS PICO — MES ACTUAL</div>
      <div style={{ ...cardBig, padding: 18 }}>
        <svg viewBox="0 0 480 230" style={{ width: '100%', height: 'auto' }} xmlns="http://www.w3.org/2000/svg" fontFamily="Lexend, sans-serif">
          {dias.map((d, i) => {
            const isMax = conMax && d.idx === conMax.idx
            const fill = isMax ? COLOR.textSec : COLOR.textMut
            const weight = isMax ? 500 : 400
            return (
              <text key={`v${i}`} x={POS_X_TEXTO[i]} y="20" fontSize="11" fill={fill} textAnchor="middle" fontWeight={weight}>
                {d.valor > 0 ? fmtEntero(d.valor) : ''}
              </text>
            )
          })}

          {dias.map((d, i) => {
            const h = altura(d.valor)
            return (
              <rect
                key={`b${i}`}
                x={POS_X_BARRA[i]}
                y={190 - h}
                width="40"
                height={h}
                fill={d.valor > 0 ? d.color : COLOR.bordeClaro}
                rx="2"
                style={{ cursor: onClickDia ? 'pointer' : 'default' }}
                onClick={() => onClickDia?.(d.idx)}
              />
            )
          })}

          {dias.map((_d, i) => (
            <text key={`l${i}`} x={POS_X_TEXTO[i]} y="210" fontSize="12" fill={COLOR.textMut} textAnchor="middle">
              {ETIQUETAS[i]}
            </text>
          ))}
        </svg>

        <div style={{ borderTop: `0.5px solid ${COLOR.borde}`, marginTop: 14, paddingTop: 12 }}>
          <div style={{ ...lblSm, marginBottom: 8 }}>RESUMEN</div>
          <Linea label="Día más fuerte" valor={conMax ? `${NOMBRES_LARGOS[conMax.idx]} · ${fmtEur0(conMax.valor)}` : '—'} fuerte />
          <Linea label="Día más débil"  valor={conMin ? `${NOMBRES_LARGOS[conMin.idx]} · ${fmtEur0(conMin.valor)}` : '—'} />
          <Linea label="Media diaria"   valor={fmtEur0(media)} />
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
