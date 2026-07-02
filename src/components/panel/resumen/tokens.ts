/**
 * Tokens del Panel Global — mockups validados.
 *
 * ⚠️ THEME-AWARE (02-jul-2026): los colores ESTRUCTURALES (fondo, card, borde,
 * texto) apuntan a var(--sl-*) → se adaptan solos a modo claro/oscuro.
 * Los colores SEMÁNTICOS (semáforo), de CANAL y de DÍA siguen fijos: significan
 * lo mismo en ambos modos. NO improvisar hex nuevos: usar estas constantes.
 */

import type { CSSProperties } from 'react'

/* ── Familias ─────────────────────────────────────── */
export const OSWALD = "'Oswald', sans-serif"
export const LEXEND = "'Lexend', sans-serif"

/* ── COLORS ───────────────────────────────────────── */
export const COLORS = {
  // Backgrounds (theme-aware)
  bg: 'var(--sl-app)',
  group: 'var(--sl-thead)',
  card: 'var(--sl-card)',
  brd: 'var(--sl-border)',
  // Texto (theme-aware)
  pri: 'var(--sl-text-primary)',
  sec: 'var(--sl-text-secondary)',
  mut: 'var(--sl-text-muted)',
  // Marca
  redSL: '#B01D23',
  sidebar: '#1e2233',
  modal: '#484f66',
  // Acción
  accent: '#FF4757',
  // Semáforo
  ok: '#1D9E75',
  warn: '#f5a623',
  err: '#E24B4A',
  // Canales
  uber: '#06C167',
  uberDark: '#0F6E56',
  glovo: '#e8f442',
  glovoDark: '#5a5500',
  glovoText: '#3a3a00',
  je: '#f5a623',
  jeDark: '#854F0B',
  web: '#B01D23',
  webDark: '#791F1F',
  directa: '#66aaff',
  directaDark: '#185FA5',
  // Días semana
  lun: '#1E5BCC',
  mar: '#06C167',
  mie: '#f5a623',
  jue: '#B01D23',
  vie: '#66aaff',
  sab: '#F26B1F',
  dom: '#1D9E75',
  // Plan contable
  catPrd: '#7B4F2A',
  catEqp: '#4A5980',
  catLoc: '#5A8A6F',
  catCtr: '#A87C3D',
  catPlt: '#06C167',
  catIng: '#1D9E75',
  catInt: '#7a8090',
  // Titulares
  ruben: '#F26B1F',
  emilio: '#1E5BCC',
  // Alias
  glovoAccent: '#e8f442',
} as const

/* ── FONT ─────────────────────────────────────────── */
export const FONT = {
  body: 'Lexend, sans-serif',
  heading: 'Oswald, sans-serif',
} as const

/* ── SIZES ────────────────────────────────────────── */
export const SIZES = {
  pageTitle:    { font: 'Oswald', size: 22, weight: 600, letterSpacing: 3, transform: 'uppercase' },
  pageSubtitle: { font: 'Lexend', size: 13, color: 'mut' },
  cardLabel:    { font: 'Oswald', size: 12, weight: 500, letterSpacing: 2, transform: 'uppercase', color: 'mut' },
  cardLabelSm:  { font: 'Oswald', size: 11, weight: 500, letterSpacing: 1.5, transform: 'uppercase', color: 'mut' },
  cardLabelXs:  { font: 'Oswald', size: 10, weight: 500, letterSpacing: 1.5, transform: 'uppercase', color: 'mut' },
  kpiBig:       { font: 'Oswald', size: 38, weight: 600 },
  kpiMid:       { font: 'Oswald', size: 26, weight: 600 },
  kpiSm:        { font: 'Oswald', size: 22, weight: 600 },
  kpiXs:        { font: 'Oswald', size: 18, weight: 600 },
  body:         { font: 'Lexend', size: 14, weight: 400 },
  bodySm:       { font: 'Lexend', size: 13, weight: 400 },
  bodyXs:       { font: 'Lexend', size: 12, weight: 400 },
  bodyTiny:     { font: 'Lexend', size: 11, weight: 400 },
  tableHeader:  { font: 'Oswald', size: 11, weight: 500, letterSpacing: 1.5, transform: 'uppercase', color: 'mut' },
  tableCell:    { font: 'Lexend', size: 13, weight: 400 },
  badge:        { font: 'Oswald', size: 9, weight: 500, letterSpacing: 0.5, padding: '1px 6px', borderRadius: 3 },
  pill:         { font: 'Lexend', size: 10, weight: 500, padding: '2px 8px', borderRadius: 9 },
} as const

/* ── CARDS ────────────────────────────────────────── */
export const CARDS = {
  big: {
    background: 'var(--sl-card)',
    border: '0.5px solid var(--sl-border)',
    borderRadius: 16,
    padding: '24px 28px',
  } as CSSProperties,
  std: {
    background: 'var(--sl-card)',
    border: '0.5px solid var(--sl-border)',
    borderRadius: 14,
    padding: 18,
  } as CSSProperties,
  filter: {
    background: 'var(--sl-card)',
    border: '0.5px solid var(--sl-border)',
    borderRadius: 12,
    padding: '14px 16px',
    cursor: 'pointer',
    transition: 'all 150ms',
    flex: 1,
  } as CSSProperties,
  filterActive: {
    border: '1.5px solid #FF4757',
    boxShadow: '0 0 0 3px #FF475715',
  } as CSSProperties,
} as const

/* ── TABS PASTILLA ────────────────────────────────── */
export const TABS_PILL = {
  container: {
    background: 'var(--sl-card)',
    border: '0.5px solid var(--sl-border)',
    borderRadius: 10,
    padding: '4px 6px',
    marginBottom: 3,
    marginTop: 3,
    display: 'inline-flex',
    gap: 4,
  } as CSSProperties,
  active: {
    padding: '5px 12px',
    borderRadius: 5,
    border: 'none',
    background: '#FF4757',
    color: '#ffffff',
    fontFamily: 'Lexend',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 150ms',
  } as CSSProperties,
  inactive: {
    padding: '5px 12px',
    borderRadius: 5,
    border: '0.5px solid var(--sl-border)',
    background: 'transparent',
    color: 'var(--sl-text-secondary)',
    fontFamily: 'Lexend',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  } as CSSProperties,
} as const

/* ── SUBTABS ──────────────────────────────────────── */
/* modelo V2 verde — inverso neobrutal, activo verde con sombra dura */
export const SUBTABS = {
  active: {
    padding: '6px 13px',
    borderRadius: 0,
    border: '2px solid var(--neo-ink)',
    background: '#0FB86B',
    color: '#ffffff',
    fontFamily: "'Oswald', sans-serif",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    boxShadow: '3px 3px 0 var(--neo-shadow-color)',
    cursor: 'pointer',
  } as CSSProperties,
  inactive: {
    padding: '6px 13px',
    borderRadius: 0,
    border: '2px solid var(--neo-ink)',
    background: 'var(--sl-card)',
    color: 'var(--sl-text-muted)',
    fontFamily: "'Oswald', sans-serif",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    cursor: 'pointer',
  } as CSSProperties,
} as const

/* ── DROPDOWN_BTN ─────────────────────────────────── */
export const DROPDOWN_BTN: CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '0.5px solid var(--sl-border)',
  background: 'var(--sl-card)',
  fontSize: 13,
  fontFamily: 'Lexend',
  color: 'var(--sl-text-primary)',
  cursor: 'pointer',
}

/* ── BAR ──────────────────────────────────────────── */
export const BAR = {
  track: {
    height: 8,
    borderRadius: 4,
    background: 'var(--sl-thead)',
    overflow: 'hidden',
    display: 'flex',
  } as CSSProperties,
  trackSm: {
    height: 6,
    borderRadius: 3,
    background: 'var(--sl-thead)',
    overflow: 'hidden',
    display: 'flex',
  } as CSSProperties,
  trackXs: {
    height: 5,
    borderRadius: 3,
    background: 'var(--sl-thead)',
    overflow: 'hidden',
    display: 'flex',
  } as CSSProperties,
} as const

/* ── LAYOUT ───────────────────────────────────────── */
export const LAYOUT = {
  pagePadding: '24px 28px',
  maxWidth: 1400,
  gridGap: 14,
  gridGapSm: 12,
  gridGapXs: 10,
  sectionMargin: 18,
} as const

/* ── EDITABLE inline ──────────────────────────────── */
export const EDITABLE: CSSProperties = {
  borderBottom: '1px dashed var(--sl-border)',
  cursor: 'text',
  color: 'var(--sl-text-secondary)',
  padding: '0 2px',
}

/* ── TAG filtro activo ────────────────────────────── */
export const TAG: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 8px',
  borderRadius: 10,
  background: '#FF475715',
  color: '#FF4757',
  fontSize: 11,
  fontWeight: 500,
}

/* ── Grid 3 cols ──────────────────────────────────── */
export const row3: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 14,
}

/* ─────────────────────────────────────────────────── */
/* Aliases de compatibilidad con código existente      */
/* ─────────────────────────────────────────────────── */

export const COLOR = {
  textPri:     COLORS.pri,
  textSec:     COLORS.sec,
  textMut:     COLORS.mut,
  borde:       COLORS.brd,
  brd:         COLORS.brd,
  bordeClaro:  COLORS.group,
  bgPagina:    COLORS.bg,
  cardBg:      COLORS.card,
  verde:       COLORS.ok,
  verdeOscuro: COLORS.uberDark,
  ambar:       COLORS.warn,
  rojo:        COLORS.err,
  rojoSL:      COLORS.redSL,
  rojoAccent:  COLORS.accent,
  uber:        COLORS.uber,
  glovo:       COLORS.glovo,
  glovoTexto:  COLORS.glovoText,
  glovoDark:   COLORS.glovoDark,
  je:          COLORS.je,
  jeDark:      COLORS.jeDark,
  webSL:       COLORS.web,
  webDark:     COLORS.webDark,
  directa:     COLORS.directa,
  directaDark: COLORS.directaDark,
  diaLun:      COLORS.lun,
  diaMar:      COLORS.mar,
  diaMie:      COLORS.mie,
  diaJue:      COLORS.jue,
  diaVie:      COLORS.vie,
  diaSab:      COLORS.sab,
  diaDom:      COLORS.dom,
} as const

export const card: CSSProperties     = CARDS.std
export const cardBig: CSSProperties  = CARDS.big

export const lbl: CSSProperties = {
  fontFamily: OSWALD,
  fontSize: 12,
  letterSpacing: '2px',
  color: COLORS.mut,
  textTransform: 'uppercase',
  fontWeight: 500,
}

export const lblSm: CSSProperties = {
  fontFamily: OSWALD,
  fontSize: 11,
  letterSpacing: '1.5px',
  color: COLORS.mut,
  textTransform: 'uppercase',
  fontWeight: 500,
}

export const lblXs: CSSProperties = {
  fontFamily: OSWALD,
  fontSize: 10,
  letterSpacing: '1.5px',
  color: COLORS.mut,
  textTransform: 'uppercase',
  fontWeight: 500,
}

export const kpiBig: CSSProperties = {
  fontFamily: OSWALD,
  fontSize: 38,
  fontWeight: 600,
  color: COLORS.pri,
}

export const kpiMid: CSSProperties = {
  fontFamily: OSWALD,
  fontSize: 26,
  fontWeight: 600,
  color: COLORS.pri,
}

export const kpiSm: CSSProperties = {
  fontFamily: OSWALD,
  fontSize: 22,
  fontWeight: 600,
  color: COLORS.pri,
}

export const barTrack: CSSProperties = BAR.track

export const editable: CSSProperties = EDITABLE

/* ── Helpers cumplimiento/semáforo ───────────────── */
export function semaforoCumplGrupo(pct: number): string {
  if (pct <= 100) return COLORS.ok
  if (pct <= 105) return COLORS.warn
  return COLORS.err
}

export function semaforoBarra(pct: number): string {
  if (pct >= 80) return COLORS.ok
  if (pct >= 50) return COLORS.warn
  return COLORS.err
}

export function colorPrimeCost(pct: number): { color: string; estado: 'OK' | 'Alto' | 'Bajo' } {
  if (pct >= 55 && pct <= 65) return { color: COLORS.ok, estado: 'OK' }
  if ((pct >= 50 && pct < 55) || (pct > 65 && pct <= 70)) {
    return { color: COLORS.warn, estado: pct < 55 ? 'Bajo' : 'Alto' }
  }
  return { color: COLORS.err, estado: pct > 70 ? 'Alto' : 'Bajo' }
}

/* ── Format helpers ───────────────────────────────── */
export function fmtDec(v: number, decimals = 1): string {
  if (!isFinite(v)) return '—'
  return v.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true,
  })
}

export function fmtPp(pp: number): string {
  return `${pp >= 0 ? '+' : ''}${pp.toLocaleString('es-ES', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    useGrouping: true,
  })} pp`
}

/* ── Mini-tabs ────────────────────────────────────── */
export const miniTabActiva: CSSProperties  = TABS_PILL.active
export const miniTabInactiva: CSSProperties = TABS_PILL.inactive

/* ── Badges canal tabla Top Ventas ───────────────── */
export interface BadgeCanal {
  bg: string
  texto: string
  abrev: string
}

export const BADGE_CANAL: Record<string, BadgeCanal> = {
  uber:  { bg: COLORS.uber,    texto: '#fff',          abrev: 'UE'  },
  glovo: { bg: COLORS.glovo,   texto: COLORS.glovoText, abrev: 'GL'  },
  je:    { bg: COLORS.je,      texto: '#fff',          abrev: 'JE'  },
  web:   { bg: COLORS.web,     texto: '#fff',          abrev: 'WEB' },
  dir:   { bg: COLORS.directa, texto: '#fff',          abrev: 'DIR' },
}

/* ── Fecha corta es-ES (dd mmm) ───────────────────── */
export function fmtFechaCorta(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const dia = d.getDate()
  const mes = d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')
  return `${dia} ${mes}`
}
