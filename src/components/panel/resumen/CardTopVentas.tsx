import { COLOR, OSWALD, card, lblSm, miniTabActiva, miniTabInactiva, BADGE_CANAL, fmtEur0, fmtEntero } from './tokens'
import type { TopVentaItem } from './types'

interface Props {
  tab: 'productos' | 'modificadores'
  onTab: (t: 'productos' | 'modificadores') => void
  items: TopVentaItem[]
  datosDemo?: boolean
}

export default function CardTopVentas({ tab, onTab, items, datosDemo }: Props) {
  return (
    <div style={{ ...card, position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <div style={lblSm}>TOP VENTAS</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onTab('productos')} style={tab === 'productos' ? miniTabActiva : miniTabInactiva}>
            Productos
          </button>
          <button onClick={() => onTab('modificadores')} style={tab === 'modificadores' ? miniTabActiva : miniTabInactiva}>
            Modif.
          </button>
        </div>
      </div>

      {datosDemo && items.length === 0 && (
        <div style={{
          position: 'absolute', top: 8, right: 10,
          background: '#f5a62320', color: '#854F0B',
          fontSize: 10, padding: '2px 8px', borderRadius: 4,
          fontFamily: 'Lexend, sans-serif', fontWeight: 500,
        }}>
          datos demo
        </div>
      )}
      <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ padding: '12px 0', color: COLOR.textMut, textAlign: 'center', fontFamily: 'Lexend, sans-serif' }}>
                Sin datos POS
              </td>
            </tr>
          ) : items.slice(0, 5).map((it) => {
            const badge = BADGE_CANAL[it.canal]
            return (
              <tr key={`${it.ranking}-${it.producto}`}>
                <td style={{ color: COLOR.textMut, width: 18, padding: '6px 0' }}>{it.ranking}</td>
                <td style={{ padding: '6px 0', color: COLOR.textPri, fontFamily: 'Lexend, sans-serif' }}>{it.producto}</td>
                <td style={{ textAlign: 'right', padding: '6px 0' }}>
                  <span style={{
                    background: badge.bg,
                    color: badge.texto,
                    fontFamily: OSWALD,
                    fontSize: 9,
                    letterSpacing: '0.5px',
                    padding: '1px 5px',
                    borderRadius: 3,
                    fontWeight: 500,
                  }}>
                    {badge.abrev}
                  </span>
                </td>
                <td style={{ textAlign: 'right', padding: '6px 0', color: COLOR.textSec, fontFamily: 'Lexend, sans-serif' }}>
                  {fmtEntero(it.pedidos)}
                </td>
                <td style={{ textAlign: 'right', padding: '6px 0', fontFamily: OSWALD, fontWeight: 500, color: COLOR.textPri }}>
                  {fmtEur0(it.importe)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
