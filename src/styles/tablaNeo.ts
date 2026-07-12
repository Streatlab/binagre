/**
 * tablaNeo.ts — ESTILOS CANÓNICOS de tabla NEOBRUTAL (Food-Pop) para todo el ERP.
 *
 * Fuente de verdad única del look de tablas: header INK con texto crema,
 * filas alternas crema/tostado, números Oswald a la derecha, bordes 2px INK,
 * dots CUADRADOS (nunca redondos), fila TOTAL destacada en amarillo.
 *
 * Importar estos objetos en cada tabla del ERP en vez de improvisar estilos.
 * Tokens base: src/styles/neobrutal.ts
 */
import type { CSSProperties } from 'react'
import { INK, CREMA, CLARO, OSW, LEX, AMA, VERDE, ROJO, GRIS, BORDER, SHADOW } from './neobrutal'

/* ── Contenedor ──────────────────────────────────── */
export const tablaNeo: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  border: BORDER,
  boxShadow: SHADOW,
  background: CREMA,
}

/* ── Cabecera ────────────────────────────────────── */
export const theadNeo: CSSProperties = { background: INK }

export const thNeo: CSSProperties = {
  fontFamily: OSW,
  fontWeight: 600,
  fontSize: 12,
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
  color: CREMA,
  padding: '11px 12px',
  textAlign: 'left',
  whiteSpace: 'nowrap',
}
export const thNeoR: CSSProperties = { ...thNeo, textAlign: 'right' }

/* ── Celdas ──────────────────────────────────────── */
export const tdNeo: CSSProperties = {
  fontFamily: LEX,
  fontSize: 13,
  color: INK,
  padding: '9px 12px',
  borderBottom: `2px solid ${INK}`,
}
/** Celda numérica: Oswald, peso 600, alineada a la derecha. */
export const tdNeoR: CSSProperties = {
  ...tdNeo,
  fontFamily: OSW,
  fontWeight: 600,
  textAlign: 'right',
}

/** Fondo alterno por índice de fila (par crema, impar tostado). */
export const filaAlt = (i: number): CSSProperties => ({
  background: i % 2 === 0 ? CREMA : CLARO,
})

/* ── Fila TOTAL ──────────────────────────────────── */
export const totalRow: CSSProperties = { background: AMA }
export const tdTotal: CSSProperties = {
  fontFamily: OSW,
  fontWeight: 700,
  fontSize: 14,
  color: INK,
  textTransform: 'uppercase',
  padding: '12px',
  borderTop: `4px solid ${INK}`,
}
export const tdTotalR: CSSProperties = { ...tdTotal, textAlign: 'right' }

/* ── Dot semántico CUADRADO (nunca redondo) ──────── */
export const dotNeo = (color: string): CSSProperties => ({
  display: 'inline-block',
  width: 11,
  height: 11,
  background: color,
  border: `2px solid ${INK}`,
  marginRight: 8,
  verticalAlign: 'middle',
})

/* ── Estado vacío ────────────────────────────────── */
export const vacioNeo: CSSProperties = {
  padding: 40,
  textAlign: 'center',
  color: GRIS,
  fontFamily: LEX,
  fontSize: 14,
  border: BORDER,
  background: CREMA,
}

/* Colores semánticos re-exportados para comodidad de las tablas. */
export const POS = VERDE
export const NEG = ROJO
