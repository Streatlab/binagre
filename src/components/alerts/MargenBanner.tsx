/**
 * T-F4-10 — MargenBanner
 * Banner amarillo #e8f442 encima de tabla recetas cuando hay recetas fuera de margen.
 * Cierre con X. No persiste. Decisión autónoma F4-H6.
 */
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { FONT } from '@/styles/tokens'
import type { AlertaFoodCost } from '@/lib/escandallo/onPrecioInsertado'

interface Props {
  alertas: AlertaFoodCost[]
  onDismiss?: () => void
}

export function MargenBanner({ alertas, onDismiss }: Props) {
  const [visible, setVisible] = useState(true)

  if (!visible || !alertas.length) return null

  const bannerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    background: '#e8f442',
    color: '#111111',
    borderRadius: 8,
    padding: '10px 14px',
    marginBottom: 12,
    fontFamily: FONT.body,
    fontSize: 13,
  }

  const handleDismiss = () => {
    setVisible(false)
    onDismiss?.()
  }

  return (
    <div style={bannerStyle}>
      <div>
        <strong style={{ fontFamily: FONT.heading, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase' }}>
          {alertas.length} receta{alertas.length > 1 ? 's' : ''} fuera de margen objetivo
        </strong>
        <ul style={{ margin: '6px 0 0', padding: '0 0 0 16px', fontSize: 12 }}>
          {alertas.slice(0, 5).map(a => (
            <li key={a.receta_id}>
              {a.receta_nombre} — food cost {a.food_cost_pct}% (umbral {a.umbral}%)
            </li>
          ))}
          {alertas.length > 5 && <li>...y {alertas.length - 5} más</li>}
        </ul>
      </div>
      <button
        onClick={handleDismiss}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontSize: 18, color: '#333333', lineHeight: 1, padding: '0 4px',
          fontFamily: FONT.body, flexShrink: 0,
        }}
        aria-label="Cerrar"
      >
        ×
      </button>
    </div>
  )
}
