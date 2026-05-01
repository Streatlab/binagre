/**
 * CardPedidosTM — Ronda 7
 * R7-04: formato canales "1097 / 26,76 / 17,05" sin €, sin punto medio
 * R7-04b: barras Web (#8B5CF6 violeta) y Directa (#06B6D4 cyan) visibles
 * R7-04c: si pedidos === 0 → "0 / 0,00 / 0,00" (no "—")
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
  web:   { label: 'Web',       color: '#8B5CF6'  },
  dir:   { label: 'Directa',   color: '#06B6D4'  },
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
          <div style={{ fontFamily: OSWALD, fontSize: 38, fontWeight: 600, color: '#1E5BCC' }}>
            {fmtNum(pedidos, 0)}
          </div>
          <div style={{ ...lblXs, color: '#1E5BCC' }}>PEDIDOS</div>
        </div>
        <div>
          <div style={{ fontFamily: OSWALD, fontSize: 38, fontWeight: 600, color: '#F26B1F' }}>
            {fmtEur(tmBruto, { showEuro: true, decimals: 2 })}
          </div>
          <div style={{ ...lblXs, color: '#F26B1F' }}>TM BRUTO</div>
        </div>
        <div>
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
                  {/* R7-04: pedidos / TM bruto / TM neto sin €, separador / con espacios */}
                  <b style={{ color: '#1E5BCC', fontWeight: 500 }}>{fmtNum(ped, 0)}</b>
                  {' / '}
                  <span style={{ color: '#F26B1F' }}>{fmtNum(tBruto, 2)}</span>
                  {' / '}
                  <span style={{ color: COLOR.verde }}>{fmtNum(tNeto, 2)}</span>
                </span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: COLOR.bordeClaro, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.max(pctBarra, ped > 0 ? 2 : 0)}%`,
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
