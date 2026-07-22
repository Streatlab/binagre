/**
 * estilosTabla.ts — Estilo compartido de las tablas del Escandallo.
 *
 * Objetivo: que Índice, Ingredientes, Mermas, EPS y Recetas se vean idénticas y
 * claramente neobrutales (papel crema, tinta plana, franja de estado, cifras Oswald).
 * Reglas:
 *  - Texto a lo ancho: padding lateral corto, alto de fila contenido.
 *  - Tipografía uniforme (~15px) para código, nombre, categoría y números.
 *  - Zebra CÁLIDA (papel), nunca gris frío: blanco + crema tostada suave.
 *  - Franja lateral de estado (semáforo) 14px en la primera celda de cada fila.
 *  - Cabecera INK alta, separadores negros 3px entre filas.
 */
import type { CSSProperties } from 'react'
import { INK, CREMA, OSW, LEX, VERDE, NAR, ROJO, GRIS, BLANCO } from '@/styles/neobrutal'
import { ESCANDALLO_ZEBRA_B, ESCANDALLO_SUBT, ESCANDALLO_TH_BORDE } from '@/styles/palettes'

/* ── Fondos de fila (zebra cálida on-brand) ── */
export const ZEBRA_A = BLANCO
export const ZEBRA_B = ESCANDALLO_ZEBRA_B
export const zebra = (i: number): string => (i % 2 ? ZEBRA_B : ZEBRA_A)

/* ── Subtítulo (código · categoría) ── */
export const SUBT = ESCANDALLO_SUBT

/* ── Franja lateral de estado ── */
export const BAND = 14 // px
/** Semáforo por nº de usos: 0 = rojo, 1-4 = naranja, 5+ = verde. */
export const bandUsos = (usos: number): string => (usos <= 0 ? ROJO : usos <= 4 ? NAR : VERDE)
/** Semáforo binario en-uso / sin-uso (neutro cuando no se usa). */
export const bandEnUso = (enUso: boolean): string => (enUso ? VERDE : GRIS)

/* ── Cabecera de tabla (thead) ── */
export const th: CSSProperties = {
  fontFamily: OSW, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase',
  color: CREMA, background: INK, padding: '11px 10px', textAlign: 'left', whiteSpace: 'nowrap',
  position: 'sticky', top: 0, borderRight: `1px solid ${ESCANDALLO_TH_BORDE}`,
}
export const thR: CSSProperties = { ...th, textAlign: 'right' }
export const thC: CSSProperties = { ...th, textAlign: 'center' }

/* ── Celdas (tbody) ── */
export const td: CSSProperties = {
  fontFamily: LEX, fontSize: 15, fontWeight: 600, color: INK, padding: '6px 10px',
  borderTop: `3px solid ${INK}`, borderRight: '2px solid rgba(20,15,8,.12)', whiteSpace: 'nowrap',
  overflow: 'hidden', textOverflow: 'ellipsis',
}
/** Números: Oswald, alineados a la derecha, mismo cuerpo que el texto. */
export const tdNum: CSSProperties = { ...td, fontFamily: OSW, fontWeight: 700, fontSize: 15.5, textAlign: 'right' }
/** Código (IDING / CÓDIGO): Oswald, mismo cuerpo. */
export const tdCod: CSSProperties = { ...td, fontFamily: OSW, fontWeight: 700, fontSize: 15 }
/** Subtítulo tipo etiqueta (categoría, ud). */
export const tdSub: CSSProperties = {
  ...td, fontFamily: OSW, fontWeight: 600, fontSize: 14, letterSpacing: '.3px',
  textTransform: 'uppercase', color: SUBT,
}
