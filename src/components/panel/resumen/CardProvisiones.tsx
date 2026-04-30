/**
 * CardProvisiones
 * L.1: Sublabel "PROVISIONES Y PRÓXIMOS PAGOS" (ya estaba, confirmar)
 * L.2: Valor superior Oswald 24px "Total" (no "a guardar este mes"). ELIMINAR badge "187€ + 178€"
 * L.3: Lista pagos desde gastos_fijos (no existe → "Datos insuficientes")
 * L.4: fmtEntero (sin euro literal en cada cifra) en líneas — usamos fmtEntero + " €" explícito
 */
import { COLOR, LEXEND, OSWALD, card, lblSm, fmtEntero } from './tokens'
import type { PagoProximoItem } from './types'

interface Props {
  totalAGuardar: number
  provIVA: number
  provIRPF: number
  proximosPagos: PagoProximoItem[]
}

export default function CardProvisiones({ totalAGuardar, proximosPagos }: Props) {
  return (
    <div style={card}>
      {/* L.1 */}
      <div style={lblSm}>PROVISIONES Y PRÓXIMOS PAGOS</div>

      {/* L.2: Valor superior Oswald 24px "Total". Sin badge IVA+IRPF */}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontFamily: OSWALD, fontSize: 24, fontWeight: 600, color: '#111111' }}>
          {fmtEntero(totalAGuardar)} €
        </div>
        <div style={{ fontSize: 11, color: COLOR.textMut, fontFamily: LEXEND }}>Total provisiones</div>
      </div>

      {/* L.3: Lista pagos */}
      <div style={{ marginTop: 14, fontSize: 12, color: COLOR.textSec, display: 'flex', flexDirection: 'column', gap: 6, fontFamily: LEXEND }}>
        {proximosPagos.length === 0 ? (
          <div style={{ color: COLOR.textMut, textAlign: 'center', padding: '8px 0', fontStyle: 'italic' }}>
            Datos insuficientes — tabla gastos_fijos pendiente
          </div>
        ) : proximosPagos.slice(0, 6).map((p, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: COLOR.textMut }}>{p.concepto} ({p.fecha})</span>
            {/* L.4: sin símbolo € pegado, fmtEntero */}
            <span style={{ color: COLOR.textPri }}>{fmtEntero(p.importe)} €</span>
          </div>
        ))}
      </div>
    </div>
  )
}
