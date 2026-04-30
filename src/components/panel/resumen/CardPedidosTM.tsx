/**
 * CardPedidosTM — Fixes 18-29
 * FIX 18: Pedidos fontSize 38 color #1E5BCC
 * FIX 19: TM Bruto fontSize 38 color #F26B1F
 * FIX 20: TM Neto fontSize 38 color #1D9E75
 * FIX 21: fmtEur(tmBruto, { showEuro: true, decimals: 2 })
 * FIX 22: fmtEur(tmNeto, { showEuro: true, decimals: 2 })
 * FIX 23: pedidos canal color #1E5BCC
 * FIX 24: TM Bruto canal color #F26B1F
 * FIX 25: TM Neto canal color #1D9E75
 * FIX 26: barra mini color del canal
 * FIX 27: 0 pedidos → "0" no "—"
 * FIX 28: fmtNum(pedidos, 0)
 * FIX 29: PROHIBIDO "Ticket Medio"
 */
import { fmtNum, fmtEur } from '@/lib/format'
import { COLOR, OSWALD, LEXEND, cardBig, lbl, lblXs, fmtDec } from './tokens'
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
  uber:  { label: 'Uber Eats', color: '#06C167'  },
  glovo: { label: 'Glovo',     color: '#e8f442'  },
  je:    { label: 'Just Eat',  color: '#f5a623'  },
  web:   { label: 'Web',       color: '#B01D23'  },
  dir:   { label: 'Directa',   color: '#66aaff'  },
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
      {/* FIX 29: PEDIDOS · TM no "Ticket Medio" */}
      <div style={lbl}>PEDIDOS · TM</div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 24, marginTop: 8, flexWrap: 'wrap' }}>
        <div>
          {/* FIX 18: fontSize 38 fontWeight 600 color #1E5BCC */}
          <div style={{ fontFamily: OSWALD, fontSize: 38, fontWeight: 600, color: '#1E5BCC' }}>
            {fmtNum(pedidos, 0)}
          </div>
          <div style={{ ...lblXs, color: '#1E5BCC' }}>PEDIDOS</div>
        </div>
        <div>
          {/* FIX 19: fontSize 38 fontWeight 600 color #F26B1F */}
          {/* FIX 21: fmtEur con showEuro:true decimals:2 */}
          <div style={{ fontFamily: OSWALD, fontSize: 38, fontWeight: 600, color: '#F26B1F' }}>
            {fmtEur(tmBruto, { showEuro: true, decimals: 2 })}
          </div>
          <div style={{ ...lblXs, color: '#F26B1F' }}>TM BRUTO</div>
        </div>
        <div>
          {/* FIX 20: fontSize 38 fontWeight 600 color #1D9E75 */}
          {/* FIX 22: fmtEur con showEuro:true decimals:2 */}
          <div style={{ fontFamily: OSWALD, fontSize: 38, fontWeight: 600, color: COLOR.verde }}>
            {fmtEur(tmNeto, { showEuro: true, decimals: 2 })}
          </div>
          <div style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: '1.5px', color: COLOR.verde, textTransform: 'uppercase', fontWeight: 500 }}>
            TM NETO
          </div>
        </div>
      </div>

      {(pedidosDeltaPct !== null || tmDeltaPct !== null) && (
        <div style={{ fontSize: 12, color: colorDelta, margin: '8px 0 16px', fontFamily: LEXEND }}>
          {pedidosDeltaPct !== null && <>{pedSign} {fmtDec(Math.abs(pedidosDeltaPct), 1)}% pedidos</>}
          {pedidosDeltaPct !== null && tmDeltaPct !== null && ' · '}
          {tmDeltaPct !== null && <>{tmSign} {fmtDec(Math.abs(tmDeltaPct), 1)}% TM</>}
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
                color: COLOR.textPri,
              }}>
                <span>● {visual.label}</span>
                <span>
                  {/* FIX 23: pedidos azul #1E5BCC, FIX 27: mostrar 0 si 0 */}
                  {/* FIX 28: fmtNum(ped, 0) */}
                  <b style={{ color: '#1E5BCC', fontWeight: 500 }}>{fmtNum(ped, 0)}</b>
                  {' · '}
                  {/* FIX 24+32: TM Bruto naranja #F26B1F, con € */}
                  <span style={{ color: '#F26B1F' }}>{fmtEur(tBruto, { showEuro: true, decimals: 2 })}</span>
                  {' / '}
                  {/* FIX 25+32: TM Neto verde #1D9E75, con € */}
                  <span style={{ color: COLOR.verde }}>{fmtEur(tNeto, { showEuro: true, decimals: 2 })}</span>
                </span>
              </div>
              {/* FIX 26: barra mini con color del canal */}
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
