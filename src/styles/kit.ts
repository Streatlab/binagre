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

/* ═══════════════════════════════════════════════════════════════════════
 * PATRÓN RESUMEN v5-B (definitivo, 18-jul-2026) — reglas de oro del kit
 * ═══════════════════════════════════════════════════════════════════════
 *
 * FORMATO NUMÉRICO (es-ES, obligatorio en todo el ERP):
 *   · Decimales con coma, miles con punto (fmtEur/format.ts ya lo hacen).
 *   · Porcentajes: 2 decimales, PERO si terminan en ,00 se muestran enteros.
 *     Usar fmtPct() de abajo SIEMPRE.  48 (no 48,00) · 47,17 · −5,50.
 *   · Símbolo € SOLO en titulares (hero) y facturación pura. NUNCA en
 *     desgloses por canal, neto, ni pies de tarjeta.
 *   · TICKET MEDIO = "TM", SIEMPRE SIN €.  TM bruto en AZUL (#2D5BFF),
 *     TM neto en VERDE (#0FB86B).
 *
 * ETIQUETAS DE CANAL (canónicas, pastilla, mismo tamaño, uso global):
 *   Uber(verde) · Glovo(amarillo,texto tinta) · Just Eat(naranja) ·
 *   Web(granate) · Directa(morado).  Usar CANAL_TAG[clave].
 *
 * TARJETAS: relleno con flex column; nunca dejar hueco al pie (el último
 *   bloque va con marginTop:auto). Tarjeta de neto sobre AZUL (no verde).
 *
 * FRASE HERO: sale de la tabla `frases_insight` (regla campo/op/umbral →
 *   lead+mark+tail+sub con placeholders :eur/:pct/:x), 1 de ~20 según los
 *   datos del periodo del selector. Nunca inventar texto en pantalla.
 *
 * PESTAÑAS: barra de menú ARRIBA (Resumen/Operaciones/Finanzas/…), no en medio.
 * ═══════════════════════════════════════════════════════════════════════ */

/** Formatea % es-ES: 2 decimales, pero enteros si terminan en ,00. */
export function fmtPct(v: number | null | undefined, signo = false): string {
  if (v == null || !isFinite(v)) return '—'
  const abs = Math.abs(v)
  const dec = Number.isInteger(abs * 100) && abs * 100 % 100 === 0
  const s = abs.toLocaleString('es-ES', {
    minimumFractionDigits: dec ? 0 : 2,
    maximumFractionDigits: dec ? 0 : 2,
  })
  const sg = signo ? (v > 0 ? '▲ +' : v < 0 ? '▼ −' : '') : (v < 0 ? '−' : '')
  return `${sg}${s} %`
}

/** Colores de ticket medio (nunca con €). */
export const TM_BRUTO = '#2D5BFF'
export const TM_NETO  = '#0FB86B'

/** Etiquetas canónicas de canal (pastilla). Base común + color por canal. */
export const CANAL_TAG_BASE: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  minWidth: 62, height: 19, padding: '0 8px',
  fontFamily: _OSW, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
  textTransform: 'uppercase', border: '2px solid #0a0a0a', color: '#fff', lineHeight: 1,
}
export const CANAL_TAG: Record<'uber' | 'glovo' | 'je' | 'web' | 'directa', CSSProperties> = {
  uber:    { ...CANAL_TAG_BASE, background: '#06C167' },
  glovo:   { ...CANAL_TAG_BASE, background: '#FFC244', color: '#0a0a0a' },
  je:      { ...CANAL_TAG_BASE, background: '#FF8000' },
  web:     { ...CANAL_TAG_BASE, background: '#B01D23' },
  directa: { ...CANAL_TAG_BASE, background: '#7C3AED' },
}
export const CANAL_LABEL: Record<'uber' | 'glovo' | 'je' | 'web' | 'directa', string> = {
  uber: 'Uber', glovo: 'Glovo', je: 'Just Eat', web: 'Web', directa: 'Directa',
}
