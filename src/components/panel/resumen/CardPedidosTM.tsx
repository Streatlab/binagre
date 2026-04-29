import { COLOR, OSWALD, LEXEND, cardBig, lbl, lblXs, kpiBig, fmtEntero, fmtEur0 } from './tokens'
import type { CanalStat } from './types'

interface Props {
  pedidos: number
  tmBruto: number
  tmNeto: number
  pedidosDeltaPct: number | null
  tmDeltaPct: number | null
  canales: CanalStat[]
}

const CANAL_VISUAL: Record<string, { label: string; color: string }> = {
  uber:  { label: 'Uber Eats', color: COLOR.uber    },
  glovo: { label: 'Glovo',     color: COLOR.glovo   },
  je:    { label: 'Just Eat',  color: COLOR.je      },
  web:   { label: 'Web',       color: COLOR.webSL   },
  dir:   { label: 'Directa',   color: COLOR.directa },
}

const ORDEN: Array<CanalStat['id']> = ['uber', 'glovo', 'je', 'web', 'dir']

export default function CardPedidosTM({
  pedidos, tmBruto, tmNeto, pedidosDeltaPct, tmDeltaPct, canales,
}: Props) {
  const pedSign = (pedidosDeltaPct ?? 0) >= 0 ? '▲' : '▼'
  const tmSign  = (tmDeltaPct ?? 0) >= 0 ? '▲' : '▼'
  const colorDelta = (pedidosDeltaPct ?? 0) >= 0 && (tmDeltaPct ?? 0) >= 0 ? COLOR.verde : COLOR.rojo

  const canalesMap = new Map(canales.map(c => [c.id, c]))

  return (
    <div style={cardBig}>
      <div style={lbl}>PEDIDOS · TM</div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 24, marginTop: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={kpiBig}>{fmtEntero(pedidos)}</div>
          <div style={lblXs}>PEDIDOS</div>
        </div>
        <div>
          <div style={{ fontFamily: OSWALD, fontSize: 26, fontWeight: 600, color: COLOR.textPri }}>
            {fmtEur0(tmBruto)}
          </div>
          <div style={lblXs}>TM BRUTO</div>
        </div>
        <div>
          <div style={{ fontFamily: OSWALD, fontSize: 26, fontWeight: 600, color: COLOR.verde }}>
            {fmtEur0(tmNeto)}
          </div>
          <div style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: '1.5px', color: COLOR.verde, textTransform: 'uppercase', fontWeight: 500 }}>
            TM NETO
          </div>
        </div>
      </div>

      {(pedidosDeltaPct !== null || tmDeltaPct !== null) && (
        <div style={{ fontSize: 12, color: colorDelta, margin: '8px 0 16px', fontFamily: LEXEND }}>
          {pedidosDeltaPct !== null && <>{pedSign} {Math.abs(pedidosDeltaPct).toFixed(1)}% pedidos</>}
          {pedidosDeltaPct !== null && tmDeltaPct !== null && ' · '}
          {tmDeltaPct !== null && <>{tmSign} {Math.abs(tmDeltaPct).toFixed(1)}% TM</>}
          {' '}vs anterior
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ORDEN.map(id => {
          const c = canalesMap.get(id)
          const visual = CANAL_VISUAL[id]
          const ped = c?.pedidos ?? 0
          const bruto = c?.bruto ?? 0
          const neto = c?.neto ?? 0
          const tieneDatos = ped > 0
          const pctBarra = pedidos > 0 ? (ped / pedidos) * 100 : 0
          const tBruto = ped > 0 ? bruto / ped : 0
          const tNeto = ped > 0 ? neto / ped : 0

          return (
            <div key={id}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                marginBottom: 3,
                fontFamily: LEXEND,
                color: tieneDatos ? COLOR.textPri : COLOR.textMut,
              }}>
                <span>● {visual.label}</span>
                <span style={{ color: tieneDatos ? COLOR.textSec : COLOR.textMut }}>
                  <b style={{ fontWeight: 500 }}>{tieneDatos ? fmtEntero(ped) : '0'}</b>
                  {' · '}
                  {tieneDatos ? fmtEur0(tBruto) : '—'}
                  {' / '}
                  <span style={{ color: COLOR.verde }}>{tieneDatos ? fmtEur0(tNeto) : '—'}</span>
                </span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: COLOR.bordeClaro, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${pctBarra}%`,
                  background: visual.color,
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
