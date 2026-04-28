/**
 * T-F4-10 — FoodCostBadge
 * Badge rojo en card receta/plato si food_cost > umbral.
 * Umbral leído de configuracion.config_food_cost_umbral (default 32).
 */
import type { CSSProperties } from 'react'
import { FONT } from '@/styles/tokens'

interface Props {
  foodCostPct: number
  umbral?: number  // si no se pasa, se usa 32 como default
  size?: 'sm' | 'md'
}

export function FoodCostBadge({ foodCostPct, umbral = 32, size = 'sm' }: Props) {
  if (foodCostPct <= umbral) return null

  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    background: '#B01D23',
    color: '#ffffff',
    fontFamily: FONT.heading,
    fontSize: size === 'sm' ? 10 : 12,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    padding: size === 'sm' ? '2px 6px' : '4px 10px',
    borderRadius: 4,
    whiteSpace: 'nowrap',
  }

  return (
    <span style={style}>
      FC {foodCostPct.toFixed(1)}% &gt; {umbral}%
    </span>
  )
}
