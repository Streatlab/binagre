import { COLOR, LEXEND, card, lblSm, kpiMid, fmtEur0 } from './tokens'
import type { PagoProximoItem } from './types'

interface Props {
  totalAGuardar: number
  provIVA: number
  provIRPF: number
  proximosPagos: PagoProximoItem[]
}

export default function CardProvisiones({ totalAGuardar, provIVA, provIRPF, proximosPagos }: Props) {
  return (
    <div style={card}>
      <div style={lblSm}>PROVISIONES Y PRÓXIMOS PAGOS</div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
        <div>
          <div style={kpiMid}>{fmtEur0(totalAGuardar)}</div>
          <div style={{ fontSize: 11, color: COLOR.textMut, fontFamily: LEXEND }}>a guardar este mes</div>
        </div>
        <div style={{ fontSize: 11, color: COLOR.verde, fontWeight: 500, fontFamily: LEXEND }}>
          {fmtEur0(provIVA)} + {fmtEur0(provIRPF)}
        </div>
      </div>

      <div style={{ marginTop: 14, fontSize: 12, color: COLOR.textSec, display: 'flex', flexDirection: 'column', gap: 6, fontFamily: LEXEND }}>
        {proximosPagos.length === 0 ? (
          <div style={{ color: COLOR.textMut, textAlign: 'center', padding: '8px 0' }}>
            Sin pagos próximos en 30 días
          </div>
        ) : proximosPagos.slice(0, 6).map((p, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: COLOR.textMut }}>{p.concepto} ({p.fecha})</span>
            <span style={{ color: COLOR.textPri }}>{fmtEur0(p.importe)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
