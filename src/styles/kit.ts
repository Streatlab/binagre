/**
 * KIT OFICIAL "NEOBRUTAL ALEGRE" — aprobado por Rubén 18-jul-2026.
 * Única fuente de estilo del ERP. Prohibido introducir hex nuevos en pantallas:
 * todo color entra por este fichero.
 */
export const INK = '#0a0a0a'
export const CREMA = '#FCEFD6'
export const BLANCO = '#ffffff'
export const GRANATE = '#B01D23'
export const ROJO = '#E8352E'
export const AMA = '#FFC400'
export const VERDE = '#0FB86B'
export const NARANJA = '#FF6A1A'
export const AZUL = '#2D5BFF'
export const ROSA = '#FF2E63'
export const MORADO = '#7C3AED'
export const GRIS = '#484f66'

// Lavados suaves (fondos de tarjetas KPI y píldoras de estado)
export const VERDE_S = '#E2F7EC'
export const AMA_S = '#FFF4CC'
export const AZUL_S = '#E4EAFF'
export const ROSA_S = '#FFE4EC'

// Sombra dura corta (3px, no 5) y bordes
export const SHADOW = `3px 3px 0 ${INK}`
export const SHADOW_MINI = `2px 2px 0 ${INK}`
export const BORDER = `3px solid ${INK}`
export const BORDER_FINO = `2px solid ${INK}`

export const OSW = "'Oswald', sans-serif"
export const LEX = "'Lexend', sans-serif"

import type { CSSProperties } from 'react'

/** Tarjeta base blanca */
export const card: CSSProperties = { background: BLANCO, border: BORDER, boxShadow: SHADOW }
/** Tarjeta KPI con lavado de color */
export const cardWash = (bg: string): CSSProperties => ({ background: bg, border: BORDER, boxShadow: SHADOW, padding: '12px 14px' })
/** Cabecera de tarjeta con color (nunca negro) */
export const cardHead = (bg: string): CSSProperties => ({ fontFamily: OSW, fontSize: 13, letterSpacing: '0.08em', background: bg, color: '#fff', padding: '7px 13px', borderBottom: BORDER, textTransform: 'uppercase', fontWeight: 600 })
/** Etiqueta pequeña Oswald (eyebrow) */
export const eyebrow: CSSProperties = { fontFamily: OSW, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }
/** Número grande Oswald */
export const bigNum: CSSProperties = { fontFamily: OSW, fontSize: 30, fontWeight: 700, lineHeight: 1.1 }
/** Píldora de estado suave: fondo lavado + borde del color pleno */
export const pill = (wash: string, borde: string): CSSProperties => ({ background: wash, border: `2px solid ${borde}`, padding: '1px 8px', fontSize: 11.5, fontWeight: 700, display: 'inline-block' })
/** Chip sólido (deltas) */
export const chip = (bg: string, color = '#fff'): CSSProperties => ({ background: bg, color, border: BORDER_FINO, padding: '1px 8px', fontSize: 12, fontWeight: 700, display: 'inline-block' })
/** Semántica de estados */
export const ESTADO = {
  ok:        { wash: VERDE_S, borde: VERDE },
  revisar:   { wash: AMA_S,   borde: AMA },
  pendiente: { wash: ROSA_S,  borde: GRANATE },
} as const
