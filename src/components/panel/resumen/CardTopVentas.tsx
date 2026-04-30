import { fmtEur } from '@/lib/format'
import { COLOR, OSWALD, card, lblSm, miniTabActiva, miniTabInactiva, BADGE_CANAL } from './tokens'
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

      {/* FIX 27: badge "datos demo" eliminado */}
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
                  {fmtEur(it.pedidos, { showEuro: false, decimals: 0 })}
                </td>
                <td style={{ textAlign: 'right', padding: '6px 0', fontFamily: OSWALD, fontWeight: 500, color: COLOR.textPri }}>
                  {fmtEur(it.importe, { decimals: 0 })}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
