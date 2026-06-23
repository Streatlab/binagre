/**
 * Test Visual — Pieles (skins) para los mockups.
 * 3 estados conmutables: ACTUAL (look real de hoy), FOODPOP (rediseño claro pop),
 * DARK (rediseño oscuro operativo). Solo visual, sin datos reales.
 */

export type SkinId = 'actual' | 'foodpop' | 'dark'

export interface Skin {
  id: SkinId
  label: string
  // superficies
  pageBg: string
  panelBg: string
  cardBg: string
  cardBrd: string
  cardBrdW: string
  cardRadius: number
  cardShadow: string
  // texto
  textPri: string
  textSec: string
  textMut: string
  title: string
  // acento
  accent: string
  accentSoft: string
  kpiColor: string
  // tipografía
  fontTitle: string
  fontBody: string
  titleSpacing: string
  // tabs
  tabActiveBg: string
  tabActiveColor: string
  tabInactiveBg: string
  tabInactiveColor: string
  tabInactiveBrd: string
  tabContainerBg: string
  tabContainerBrd: string
  // barras y semáforo
  barTrack: string
  ok: string
  warn: string
  err: string
  // canales
  uber: string
  glovo: string
  glovoText: string
  je: string
  web: string
}

const OSWALD = "'Oswald', sans-serif"
const LEXEND = "'Lexend', sans-serif"

export const SKIN_ACTUAL: Skin = {
  id: 'actual', label: 'Actual',
  pageBg: '#f5f3ef', panelBg: '#ebe8e2', cardBg: '#ffffff',
  cardBrd: '#d0c8bc', cardBrdW: '0.5px', cardRadius: 14, cardShadow: 'none',
  textPri: '#111111', textSec: '#3a4050', textMut: '#7a8090', title: '#B01D23',
  accent: '#FF4757', accentSoft: '#FF475715', kpiColor: '#111111',
  fontTitle: OSWALD, fontBody: LEXEND, titleSpacing: '3px',
  tabActiveBg: '#FF4757', tabActiveColor: '#ffffff',
  tabInactiveBg: 'transparent', tabInactiveColor: '#3a4050', tabInactiveBrd: '#d0c8bc',
  tabContainerBg: '#ffffff', tabContainerBrd: '#d0c8bc',
  barTrack: '#ebe8e2', ok: '#1D9E75', warn: '#f5a623', err: '#E24B4A',
  uber: '#06C167', glovo: '#e8f442', glovoText: '#3a3a00', je: '#f5a623', web: '#B01D23',
}

export const SKIN_FOODPOP: Skin = {
  id: 'foodpop', label: 'Food Pop',
  pageBg: '#15BDB8', panelBg: '#0fa8a3', cardBg: '#fffdf6',
  cardBrd: '#06302d', cardBrdW: '2.5px', cardRadius: 20, cardShadow: '6px 6px 0 #06302d',
  textPri: '#06302d', textSec: '#0b4a47', textMut: '#3f6f6c', title: '#06302d',
  accent: '#FF2E88', accentSoft: '#FF2E8820', kpiColor: '#06302d',
  fontTitle: OSWALD, fontBody: LEXEND, titleSpacing: '1px',
  tabActiveBg: '#FF2E88', tabActiveColor: '#ffffff',
  tabInactiveBg: '#fffdf6', tabInactiveColor: '#06302d', tabInactiveBrd: '#06302d',
  tabContainerBg: 'transparent', tabContainerBrd: 'transparent',
  barTrack: '#bdeeec', ok: '#13a05c', warn: '#f59e0b', err: '#ef4444',
  uber: '#06C167', glovo: '#e8d100', glovoText: '#3a3a00', je: '#f5a623', web: '#FF2E88',
}

export const SKIN_DARK: Skin = {
  id: 'dark', label: 'Dark Operativo',
  pageBg: '#0c0e14', panelBg: '#11131a', cardBg: '#141823',
  cardBrd: '#232838', cardBrdW: '1px', cardRadius: 12, cardShadow: '0 8px 24px rgba(0,0,0,0.45)',
  textPri: '#e7eaf2', textSec: '#aeb6c6', textMut: '#6b7385', title: '#7b61ff',
  accent: '#7b61ff', accentSoft: '#7b61ff22', kpiColor: '#e7eaf2',
  fontTitle: OSWALD, fontBody: LEXEND, titleSpacing: '3px',
  tabActiveBg: '#7b61ff', tabActiveColor: '#ffffff',
  tabInactiveBg: 'transparent', tabInactiveColor: '#aeb6c6', tabInactiveBrd: '#232838',
  tabContainerBg: '#141823', tabContainerBrd: '#232838',
  barTrack: '#1c2130', ok: '#3ecf8e', warn: '#f5a623', err: '#ff5470',
  uber: '#06C167', glovo: '#e8f442', glovoText: '#1a1a00', je: '#f5a623', web: '#ff5470',
}

export const SKINS: Record<SkinId, Skin> = {
  actual: SKIN_ACTUAL,
  foodpop: SKIN_FOODPOP,
  dark: SKIN_DARK,
}

// Helpers de estilo comunes parametrizados por skin
export const cardStyle = (s: Skin, radius?: number): React.CSSProperties => ({
  background: s.cardBg,
  border: `${s.cardBrdW} solid ${s.cardBrd}`,
  borderRadius: radius ?? s.cardRadius,
  boxShadow: s.cardShadow,
  padding: '18px 20px',
})

export const lbl = (s: Skin, size = 12): React.CSSProperties => ({
  fontFamily: s.fontTitle,
  fontSize: size,
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
  color: s.textMut,
  fontWeight: 500,
})

export const kpi = (s: Skin, size = 38): React.CSSProperties => ({
  fontFamily: s.fontTitle,
  fontSize: size,
  fontWeight: 600,
  color: s.kpiColor,
  lineHeight: 1,
})
