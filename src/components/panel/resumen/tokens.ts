import { AMA, AMA_S, AZUL, AZUL_CL, BLANCO, CORP, GRANATE, GRIS, NAR, ROJO, ROSA, VERDE } from '@/styles/neobrutal'
import {
  PANEL_SIDEBAR_BG, PANEL_MODAL_BG, CANAL_UBER_DARK, CANAL_GLOVO_DARK, CANAL_JE_DARK,
  CANAL_WEB_DARK, CANAL_DIR_DARK, CAT_PRD, CAT_EQP, CAT_LOC, CAT_CTR,
} from '@/styles/palettes'
/**
 * Tokens del Panel Global — mockups validados.
 *
 * ⚠️ THEME-AWARE (02-jul-2026): los colores ESTRUCTURALES (fondo, card, borde,
 * texto) apuntan a var(--sl-*) → se adaptan solos a modo claro/oscuro.
 * Los colores SEMÁNTICOS (semáforo), de CANAL y de DÍA siguen fijos: significan
 * lo mismo en ambos modos. NO improvisar hex nuevos: usar estas constantes.
 *
 * 18-jul-2026 · KIT NEOBRUTAL ALEGRE: estructuras (cards, tabs, barras,
 * dropdowns, tags, editable) alineadas al kit oficial (src/styles/kit.ts):
 * bordes 3px + sombra dura 3px, radius 0, Oswald en tabs, canales CORP.
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
  redSL: GRANATE,
  sidebar: PANEL_SIDEBAR_BG,
  modal: PANEL_MODAL_BG,
  // Acción
  accent: ROSA,
  // Semáforo
  ok: VERDE,
  warn: NAR,
  err: ROJO,
  // Canales
  uber: VERDE,
  uberDark: CANAL_UBER_DARK,
  glovo: CORP.glovo,
  glovoDark: CANAL_GLOVO_DARK,
  glovoText: 'var(--neo-ink)',
  je: CORP.je,
  jeDark: CANAL_JE_DARK,
  web: GRANATE,
  webDark: CANAL_WEB_DARK,
  directa: AZUL_CL,
  directaDark: CANAL_DIR_DARK,
  // Días semana
  lun: AZUL,
  mar: VERDE,
  mie: NAR,
  jue: GRANATE,
  vie: AZUL_CL,
  sab: NAR,
  dom: VERDE,
  // Plan contable
  catPrd: CAT_PRD,
  catEqp: CAT_EQP,
  catLoc: CAT_LOC,
  catCtr: CAT_CTR,
  catPlt: VERDE,
  catIng: VERDE,
  catInt: GRIS,
  // Titulares
  ruben: NAR,
  emilio: AZUL,
  // Alias
  glovoAccent: CORP.glovo,
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
    border: '3px solid var(--neo-ink)',
    boxShadow: '3px 3px 0 var(--neo-shadow-color)',
    borderRadius: 0,
    padding: '24px 28px',
  } as CSSProperties,
  std: {
    background: 'var(--sl-card)',
    border: '3px solid var(--neo-ink)',
    boxShadow: '3px 3px 0 var(--neo-shadow-color)',
    borderRadius: 0,
    padding: 18,
  } as CSSProperties,
  filter: {
    background: 'var(--sl-card)',
    border: '2px solid var(--neo-ink)',
    borderRadius: 0,
    padding: '14px 16px',
    cursor: 'pointer',
    transition: 'all 150ms',
    flex: 1,
  } as CSSProperties,
  filterActive: {
    border: '3px solid var(--neo-ink)',
    boxShadow: '3px 3px 0 var(--neo-shadow-color)',
    background: AMA_S,
  } as CSSProperties,
} as const

/* ── TABS PASTILLA ────────────────────────────────── */
export const TABS_PILL = {
  container: {
    background: 'transparent',
    border: 'none',
    borderRadius: 0,
    padding: 0,
    marginBottom: 3,
    marginTop: 3,
    display: 'inline-flex',
    gap: 6,
  } as CSSProperties,
  active: {
    padding: '5px 13px',
    borderRadius: 0,
    border: '2px solid var(--neo-ink)',
    background: VERDE,
    color: BLANCO,
    fontFamily: "'Oswald', sans-serif",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    boxShadow: '3px 3px 0 var(--neo-shadow-color)',
    cursor: 'pointer',
  } as CSSProperties,
  inactive: {
    padding: '5px 13px',
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

/* ── SUBTABS ──────────────────────────────────────── */
/* modelo V2 verde — inverso neobrutal, activo verde con sombra dura */
export const SUBTABS = {
  active: {
    padding: '6px 13px',
    borderRadius: 0,
    border: '2px solid var(--neo-ink)',
    background: VERDE,
    color: BLANCO,
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
  borderRadius: 0,
  border: '2px solid var(--neo-ink)',
  background: 'var(--sl-card)',
  fontSize: 13,
  fontFamily: 'Lexend',
  color: 'var(--sl-text-primary)',
  cursor: 'pointer',
}

/* ── BAR ──────────────────────────────────────────── */
export const BAR = {
  track: {
    height: 10,
    borderRadius: 0,
    border: '2px solid var(--neo-ink)',
    background: 'var(--sl-thead)',
    overflow: 'hidden',
    display: 'flex',
  } as CSSProperties,
  trackSm: {
    height: 8,
    borderRadius: 0,
    border: '2px solid var(--neo-ink)',
    background: 'var(--sl-thead)',
    overflow: 'hidden',
    display: 'flex',
  } as CSSProperties,
  trackXs: {
    height: 7,
    borderRadius: 0,
    border: '2px solid var(--neo-ink)',
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
  borderBottom: `2px dashed ${AZUL}`,
  cursor: 'text',
  color: AZUL,
  padding: '0 2px',
}

/* ── TAG filtro activo ────────────────────────────── */
export const TAG: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 8px',
  borderRadius: 0,
  background: AMA_S,
  border: `2px solid ${AMA}`,
  color: 'var(--neo-ink)',
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
  uber:  { bg: COLORS.uber,    texto: BLANCO,          abrev: 'UE'  },
  glovo: { bg: COLORS.glovo,   texto: COLORS.glovoText, abrev: 'GL'  },
  je:    { bg: COLORS.je,      texto: BLANCO,          abrev: 'JE'  },
  web:   { bg: COLORS.web,     texto: BLANCO,          abrev: 'WEB' },
  dir:   { bg: COLORS.directa, texto: BLANCO,          abrev: 'DIR' },
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
