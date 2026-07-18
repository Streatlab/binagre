/**
 * KIT OFICIAL "NEOBRUTAL ALEGRE" (18-jul-2026) — capa de compatibilidad.
 * La fuente única de tokens es src/styles/neobrutal.ts (theme-aware).
 * PROHIBIDO introducir hex nuevos en pantallas: todo color entra por aquí.
 */
export {
  INK, CREMA, GRANATE, ROJO, AMA, VERDE, AZUL, ROSA, GRIS,
  VERDE_S, AMA_S, AZUL_S, ROSA_S,
  SHADOW, SHADOW_MINI, BORDER_CARD as BORDER, BORDER_FINO,
  OSW, LEX, cardWash, cardHead, pill, chip, ESTADO, eyebrow as eyebrowNeo,
} from '@/styles/neobrutal'
export { NAR as NARANJA } from '@/styles/neobrutal'
export const MORADO = '#7C3AED'
export const BLANCO = '#ffffff'

import type { CSSProperties } from 'react'
import { OSW as _OSW, BORDER_CARD as _B, SHADOW as _S } from '@/styles/neobrutal'
/** Etiqueta pequeña Oswald (eyebrow simple del kit). */
export const eyebrow: CSSProperties = { fontFamily: _OSW, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }
/** Número grande Oswald. */
export const bigNum: CSSProperties = { fontFamily: _OSW, fontSize: 30, fontWeight: 700, lineHeight: 1.1 }
/** Tarjeta base blanca. */
export const card: CSSProperties = { background: '#ffffff', border: _B, boxShadow: _S }
