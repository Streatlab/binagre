/**
 * Tokens literales del spec Panel Global · Tab Resumen v2
 * NO improvisar. NO interpretar. Hex y medidas exactas del spec.
 */

import type { CSSProperties } from 'react'

/* ── Familias ─────────────────────────────────────── */
export const OSWALD = "'Oswald', sans-serif"
export const LEXEND = "'Lexend', sans-serif"

/* ── Paleta literal ───────────────────────────────── */
export const COLOR = {
  textPri: '#111',
  textSec: '#3a4050',
  textMut: '#7a8090',
  borde: '#d0c8bc',
  bordeClaro: '#ebe8e2',
  bgPagina: '#f5f3ef',
  cardBg: '#fff',
  verde: '#1D9E75',
  verdeOscuro: '#0F6E56',
  ambar: '#f5a623',
  rojo: '#E24B4A',
  rojoSL: '#B01D23',
  rojoAccent: '#FF4757',
  uber: '#06C167',
  glovo: '#e8f442',
  glovoTexto: '#3a3a00',
  glovoDark: '#5a5500',
  je: '#f5a623',
  jeDark: '#854F0B',
  webSL: '#B01D23',
  webDark: '#791F1F',
  directa: '#66aaff',
  directaDark: '#185FA5',
  diaLun: '#1E5BCC',
  diaMar: '#06C167',
  diaMie: '#f5a623',
  diaJue: '#B01D23',
  diaVie: '#66aaff',
  diaSab: '#F26B1F',
  diaDom: '#1D9E75',
} as const

/* ── Cards ────────────────────────────────────────── */
export const card: CSSProperties = {
  background: COLOR.cardBg,
  border: `0.5px solid ${COLOR.borde}`,
  borderRadius: 14,
  padding: 18,
}

export const cardBig: CSSProperties = {
  background: COLOR.cardBg,
  border: `0.5px solid ${COLOR.borde}`,
  borderRadius: 16,
  padding: '24px 28px',
}

/* ── Labels ───────────────────────────────────────── */
export const lbl: CSSProperties = {
  fontFamily: OSWALD,
  fontSize: 12,
  letterSpacing: '2px',
  color: COLOR.textMut,
  textTransform: 'uppercase',
  fontWeight: 500,
}

export const lblSm: CSSProperties = {
  fontFamily: OSWALD,
  fontSize: 11,
  letterSpacing: '1.5px',
  color: COLOR.textMut,
  textTransform: 'uppercase',
  fontWeight: 500,
}

export const lblXs: CSSProperties = {
  fontFamily: OSWALD,
  fontSize: 10,
  letterSpacing: '1.5px',
  color: COLOR.textMut,
  textTransform: 'uppercase',
  fontWeight: 500,
}

/* ── KPIs ─────────────────────────────────────────── */
export const kpiBig: CSSProperties = {
  fontFamily: OSWALD,
  fontSize: 38,
  fontWeight: 600,
  color: COLOR.textPri,
}

export const kpiMid: CSSProperties = {
  fontFamily: OSWALD,
  fontSize: 24,
  fontWeight: 600,
  color: COLOR.textPri,
}

export const kpiSm: CSSProperties = {
  fontFamily: OSWALD,
  fontSize: 22,
  fontWeight: 600,
  color: COLOR.textPri,
}

/* ── Barras ───────────────────────────────────────── */
export const barTrack: CSSProperties = {
  height: 8,
  borderRadius: 4,
  background: COLOR.bordeClaro,
  overflow: 'hidden',
  display: 'flex',
}

/* ── Editable inline ──────────────────────────────── */
export const editable: CSSProperties = {
  borderBottom: `1px dashed ${COLOR.borde}`,
  color: COLOR.textSec,
  cursor: 'text',
  padding: '0 2px',
}

/* ── Grid 3 cols ──────────────────────────────────── */
export const row3: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 14,
}

/* ── Helpers cumplimiento/semáforo ───────────────── */
export function semaforoCumplGrupo(pct: number): string {
  if (pct <= 100) return COLOR.verde
  if (pct <= 105) return COLOR.ambar
  return COLOR.rojo
}

export function semaforoBarra(pct: number): string {
  if (pct >= 80) return COLOR.verde
  if (pct >= 50) return COLOR.ambar
  return COLOR.rojo
}

export function colorPrimeCost(pct: number): { color: string; estado: 'OK' | 'Alto' | 'Bajo' } {
  if (pct >= 55 && pct <= 65) return { color: COLOR.verde, estado: 'OK' }
  if ((pct >= 50 && pct < 55) || (pct > 65 && pct <= 70)) {
    return { color: COLOR.ambar, estado: pct < 55 ? 'Bajo' : 'Alto' }
  }
  return { color: COLOR.rojo, estado: pct > 70 ? 'Alto' : 'Bajo' }
}

/* ── Format ───────────────────────────────────────── */
export function fmtEntero(v: number): string {
  if (!isFinite(v)) return '0'
  return Math.round(v).toLocaleString('es-ES')
}

export function fmtEur0(v: number): string {
  if (!isFinite(v)) return '0 €'
  return `${Math.round(v).toLocaleString('es-ES')} €`
}

export function fmtPp(pp: number): string {
  return `${pp >= 0 ? '+' : ''}${pp.toFixed(1)} pp`
}

/* ── Mini-tabs (Top Ventas) ──────────────────────── */
export const miniTabActiva: CSSProperties = {
  padding: '4px 10px',
  borderRadius: 5,
  border: 'none',
  background: COLOR.rojoAccent,
  color: '#fff',
  fontSize: 11,
  fontFamily: LEXEND,
  fontWeight: 500,
  cursor: 'pointer',
}

export const miniTabInactiva: CSSProperties = {
  padding: '4px 10px',
  borderRadius: 5,
  border: `0.5px solid ${COLOR.borde}`,
  background: 'transparent',
  color: COLOR.textSec,
  fontSize: 11,
  fontFamily: LEXEND,
  fontWeight: 500,
  cursor: 'pointer',
}

/* ── Badges canal en tabla Top Ventas ────────────── */
export interface BadgeCanal {
  bg: string
  texto: string
  abrev: string
}

export const BADGE_CANAL: Record<string, BadgeCanal> = {
  uber:  { bg: COLOR.uber,    texto: '#fff',           abrev: 'UE'  },
  glovo: { bg: COLOR.glovo,   texto: COLOR.glovoTexto, abrev: 'GL'  },
  je:    { bg: COLOR.je,      texto: '#fff',           abrev: 'JE'  },
  web:   { bg: COLOR.webSL,   texto: '#fff',           abrev: 'WEB' },
  dir:   { bg: COLOR.directa, texto: '#fff',           abrev: 'DIR' },
}
