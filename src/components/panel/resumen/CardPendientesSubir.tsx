import { COLOR, LEXEND, card, lblSm } from './tokens'
import type { TareaPendienteItem } from './types'

interface Props {
  items: TareaPendienteItem[]
  onIrImportador: () => void
}

function colorPunto(diasOffset: number): string {
  if (diasOffset < 0) return COLOR.rojo
  if (diasOffset === 0) return COLOR.ambar
  return COLOR.textMut
}

function statusTexto(diasOffset: number): string {
  if (diasOffset < 0) return `atrasado ${Math.abs(diasOffset)}d`
  if (diasOffset === 0) return 'hoy'
  return `en ${diasOffset}d`
}

export default function CardPendientesSubir({ items, onIrImportador }: Props) {
  return (
    <div style={{ ...card, borderLeft: `3px solid ${COLOR.rojo}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={lblSm}>PENDIENTES DE SUBIR</div>
        <span style={{
          background: COLOR.rojo,
          color: '#fff',
          fontSize: 11,
          padding: '1px 7px',
          borderRadius: 9,
          fontWeight: 500,
          fontFamily: LEXEND,
        }}>
          {items.length}
        </span>
      </div>

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, fontFamily: LEXEND }}>
        {items.length === 0 ? (
          <div style={{ color: COLOR.textMut, textAlign: 'center', padding: '8px 0' }}>
            Sin pendientes
          </div>
        ) : items.map(it => (
          <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: COLOR.textPri }}>
              <span style={{ color: colorPunto(it.diasOffset) }}>●</span>{' '}
              {it.concepto}
            </span>
            <span style={{ fontSize: 11, color: COLOR.textMut }}>{statusTexto(it.diasOffset)}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onIrImportador}
        style={{
          marginTop: 14,
          width: '100%',
          padding: 8,
          background: COLOR.rojoAccent,
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontFamily: LEXEND,
          fontSize: 12,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        Ir al Importador →
      </button>
    </div>
  )
}
