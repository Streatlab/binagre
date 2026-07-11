/**
 * tablaNeo.ts — ESTILOS CANÓNICOS de tabla del ERP Binagre.
 *
 * ⚠️ El nombre se mantiene por compatibilidad (lo importan muchas tablas),
 * pero desde 12-jul-2026 implementa la LEY VISUAL SL v1:
 *   · Cabecera: MAYÚSCULAS 11px gris claro + borde inferior 2px LINE.
 *   · Filas alternas con ZEBRA naranja suave · hover cálido.
 *   · Importes a la derecha en JetBrains Mono con cifras tabulares.
 *   · Primera columna en peso 800 · dots REDONDOS (ya no cuadrados).
 *   · Fila TOTAL en soft ámbar, sin bordes duros.
 *
 * Tokens: src/styles/streatlab.ts (fuente de verdad) · neobrutal.ts (compat).
 */
import type { CSSProperties } from 'react'
import {
  INK, LINE, CREMA, ZEBRA, HOVER, OSW, MONO, GRIS,
  VERDE, ROJO, AMBAR_SOFT, SHADOW, RADIUS,
} from './neobrutal'

/* ── Contenedor ──────────────────────────────────── */
export const tablaNeo: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: CREMA,
  border: `1px solid ${LINE}`,
  borderRadius: RADIUS,
  overflow: 'hidden',
  boxShadow: SHADOW,
}

/* ── Cabecera ────────────────────────────────────── */
export const theadNeo: CSSProperties = { background: 'transparent' }

export const thNeo: CSSProperties = {
  fontFamily: OSW,
  fontWeight: 800,
  fontSize: 11,
  letterSpacing: '0.9px',
  textTransform: 'uppercase',
  color: GRIS,
  padding: '12px 12px 10px',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  borderBottom: `2px solid ${LINE}`,
}
export const thNeoR: CSSProperties = { ...thNeo, textAlign: 'right' }

/* ── Celdas ──────────────────────────────────────── */
export const tdNeo: CSSProperties = {
  fontFamily: OSW,
  fontWeight: 700,
  fontSize: 13,
  color: INK,
  padding: '12px',
  borderBottom: `1px solid ${LINE}`,
}
/** Celda numérica: JetBrains Mono, cifras tabulares, alineada a la derecha. */
export const tdNeoR: CSSProperties = {
  ...tdNeo,
  fontFamily: MONO,
  fontWeight: 700,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
}
/** Primera columna (nombre/entidad): peso 800. */
export const tdNeoKey: CSSProperties = { ...tdNeo, fontWeight: 800 }

/** Subtexto gris bajo la clave (nº factura, código…). */
export const tdSub: CSSProperties = {
  display: 'block',
  fontFamily: MONO,
  fontWeight: 500,
  fontSize: 11,
  color: GRIS,
  marginTop: 2,
}

/** Fondo alterno por índice de fila (zebra naranja suave). */
export const filaAlt = (i: number): CSSProperties => ({
  background: i % 2 === 0 ? CREMA : ZEBRA,
})

/** Fondo de hover (aplicar en onMouseEnter si la tabla usa estilos inline). */
export const filaHover: CSSProperties = { background: HOVER }

/* ── Fila TOTAL ──────────────────────────────────── */
export const totalRow: CSSProperties = { background: AMBAR_SOFT }
export const tdTotal: CSSProperties = {
  fontFamily: OSW,
  fontWeight: 900,
  fontSize: 13,
  color: INK,
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
  padding: '13px 12px',
  borderTop: `2px solid ${LINE}`,
}
export const tdTotalR: CSSProperties = {
  ...tdTotal,
  fontFamily: MONO,
  textAlign: 'right',
  textTransform: 'none',
  letterSpacing: 0,
  fontVariantNumeric: 'tabular-nums',
}

/* ── Dot semántico REDONDO (Ley Visual SL) ───────── */
export const dotNeo = (color: string): CSSProperties => ({
  display: 'inline-block',
  width: 6,
  height: 6,
  background: color,
  borderRadius: 999,
  marginRight: 7,
  verticalAlign: 'middle',
})

/* ── Estado vacío ────────────────────────────────── */
export const vacioNeo: CSSProperties = {
  padding: 40,
  textAlign: 'center',
  color: GRIS,
  fontFamily: OSW,
  fontWeight: 700,
  fontSize: 14,
  background: CREMA,
  border: `1px solid ${LINE}`,
  borderRadius: RADIUS,
}

/* Colores semánticos re-exportados para comodidad de las tablas. */
export const POS = VERDE
export const NEG = ROJO
