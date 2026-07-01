/**
 * estilosTabla.ts — Estilo compartido de las tablas del Escandallo.
 *
 * Objetivo: que Índice, Ingredientes, Mermas, EPS y Recetas se vean idénticas.
 * Reglas de diseño (rev. jun-2026):
 *  - Texto a lo ancho: padding lateral corto (menos aire) manteniendo alto de fila.
 *  - Tipografía uniforme: código, nombre, categoría y números en la misma banda (~15px).
 *  - Fondo de celdas SIN crema tostado ("carne"): blanco + zebra gris neutro.
 *  - Franja lateral de estado (semáforo) en la primera celda de cada fila.
 *  - Cabecera INK, separadores negros 3px entre filas.
 */
import type { CSSProperties } from 'react'
import { INK, CREMA, OSW, LEX, VERDE, NAR, ROJO, GRIS } from '@/styles/neobrutal'

/* ── Fondos de fila (zebra neutra, nada de crema/carne) ── */
export const ZEBRA_A = '#ffffff'
export const ZEBRA_B = '#EFF0EC'
export const zebra = (i: number): string => (i % 2 ? ZEBRA_B : ZEBRA_A)

/* ── Subtítulo (código · categoría) ── */
export const SUBT = '#5a4f3a'

/* ── Franja lateral de estado ── */
export const BAND = 12 // px
/** Semáforo por nº de usos: 0 = rojo, 1-4 = naranja, 5+ = verde. */
export const bandUsos = (usos: number): string => (usos <= 0 ? ROJO : usos <= 4 ? NAR : VERDE)
/** Semáforo binario en-uso / sin-uso (neutro cuando no se usa). */
export const bandEnUso = (enUso: boolean): string => (enUso ? VERDE : GRIS)

/* ── Cabecera de tabla (thead) ── */
export const th: CSSProperties = {
  fontFamily: OSW, fontSize: 12, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase',
  color: CREMA, background: INK, padding: '9px 8px', textAlign: 'left', whiteSpace: 'nowrap',
  position: 'sticky', top: 0, borderRight: '1px solid #4a3f2c',
}
export const thR: CSSProperties = { ...th, textAlign: 'right' }
export const thC: CSSProperties = { ...th, textAlign: 'center' }

/* ── Celdas (tbody) ── */
export const td: CSSProperties = {
  fontFamily: LEX, fontSize: 15, fontWeight: 600, color: INK, padding: '5px 8px',
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
