import type { CSSProperties } from 'react'
import { useTheme as useThemeContext } from '@/contexts/ThemeContext'

/* ═══════════════════════════════════════════════════════════
   FONTS
   ═══════════════════════════════════════════════════════════ */

export const FONT = {
  body: 'Lexend, sans-serif',
  heading: 'Oswald, sans-serif',
  title: 'Oswald, sans-serif',
  pageTitle: 'Oswald, sans-serif',
}

export const LAYOUT: Record<string, CSSProperties> = {
  pageTitle: { fontSize: 22, letterSpacing: '3px', margin: '0 0 18px', color: '#B01D23', fontWeight: 600, textTransform: 'uppercase', fontFamily: 'Oswald,sans-serif' } as CSSProperties,
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 20 } as CSSProperties,
}

/* ═══════════════════════════════════════════════════════════
   THEME TOKENS
   ═══════════════════════════════════════════════════════════ */

export interface TokenSet {
  bg: string
  group: string
  card: string
  brd: string
  pri: string
  sec: string
  mut: string
  inp: string
  emphasis: string
  accent: string
}

const darkT: TokenSet = {
  bg:       '#0d1120',
  group:    '#131928',
  card:     '#1a1f32',
  brd:      '#2a3050',
  pri:      '#f0f0ff',
  sec:      '#9ba8c0',
  mut:      '#5a6880',
  inp:      '#1a1f32',
  emphasis: '#FF4757',
  accent:   '#FF4757',
}

const lightT: TokenSet = {
  bg:       '#f5f3ef',
  group:    '#ebe8e2',
  card:     '#ffffff',
  brd:      '#d0c8bc',
  pri:      '#111111',
  sec:      '#3a4050',
  mut:      '#7a8090',
  inp:      '#ffffff',
  emphasis: '#FF4757',
  accent:   '#FF4757',
}

export function useTheme(): { T: TokenSet; isDark: boolean } {
  const { theme } = useThemeContext()
  const isDark = theme === 'dark'
  return { T: isDark ? darkT : lightT, isDark }
}

/* ═══════════════════════════════════════════════════════════
   STYLE HELPERS
   ═══════════════════════════════════════════════════════════ */

export const groupStyle = (T: TokenSet): CSSProperties => ({
  background: T.group,
  border: `0.5px solid ${T.brd}`,
  borderRadius: 16,
  padding: '24px 28px',
})

export const pageTitleStyle = (_T: TokenSet): CSSProperties => ({
  fontFamily: FONT.title,
  fontSize: 22,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  color: '#B01D23',
  fontWeight: 600,
  margin: '0 0 18px',
})

export const cardStyle = (T: TokenSet): CSSProperties => ({
  background: T.card,
  border: `0.5px solid ${T.brd}`,
  borderRadius: 10,
  padding: '14px 16px',
})

export const sectionLabelStyle = (T: TokenSet): CSSProperties => ({
  fontFamily: 'Oswald,sans-serif',
  fontSize: 12,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  color: T.mut,
})

export const kpiLabelStyle = (T: TokenSet): CSSProperties => ({
  fontFamily: 'Oswald,sans-serif',
  fontSize: 12,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  color: T.mut,
})

export const kpiValueStyle = (T: TokenSet): CSSProperties => ({
  fontFamily: 'Oswald,sans-serif',
  fontSize: '2.4rem',
  fontWeight: 600,
  color: T.pri,
  lineHeight: 1,
})

export const dividerStyle = (T: TokenSet): CSSProperties => ({
  height: 1,
  background: T.brd,
  margin: '12px 0',
})

export const progressBgStyle = (T: TokenSet): CSSProperties => ({
  height: 4,
  background: T.brd,
  borderRadius: 2,
})

export const progressFillStyle = (pct: number, color: string): CSSProperties => ({
  height: 4,
  width: `${Math.min(pct, 100)}%`,
  background: color,
  borderRadius: 2,
  transition: 'width 0.5s ease',
})

/* ═══════════════════════════════════════════════════════════
   SEMAFORO (verde / ámbar / rojo)
   ═══════════════════════════════════════════════════════════ */

export function semaforoColor(pct: number): string {
  return pct >= 80 ? '#1D9E75' : pct >= 50 ? '#f5a623' : '#E24B4A'
}

/* ═══════════════════════════════════════════════════════════
   CANALES
   ═══════════════════════════════════════════════════════════ */

export interface CanalConfig {
  id: string
  label: string
  color: string
  pedKey: string
  bruKey: string
  comisionPct: number
  comisionFijo: number
}

export const CANALES: CanalConfig[] = [
  { id:'uber',  label:'Uber Eats', color:'#06C167', pedKey:'uber_pedidos',    bruKey:'uber_bruto',    comisionPct:0.30, comisionFijo:0.82 },
  { id:'glovo', label:'Glovo',     color:'#e8f442', pedKey:'glovo_pedidos',   bruKey:'glovo_bruto',   comisionPct:0.25, comisionFijo:0.75 },
  { id:'je',    label:'Just Eat',  color:'#f5a623', pedKey:'je_pedidos',      bruKey:'je_bruto',      comisionPct:0.20, comisionFijo:0.75 },
  { id:'web',   label:'Web',       color:'#B01D23', pedKey:'web_pedidos',     bruKey:'web_bruto',     comisionPct:0.07, comisionFijo:0.50 },
  { id:'dir',   label:'Directa',   color:'#66aaff', pedKey:'directa_pedidos', bruKey:'directa_bruto', comisionPct:0.00, comisionFijo:0.00 },
]

export function calcNeto(bruto: number, pedidos: number, canal: Pick<CanalConfig, 'comisionPct' | 'comisionFijo'>): number {
  const comisionTotal = bruto * canal.comisionPct + pedidos * canal.comisionFijo
  const iva = comisionTotal * 0.21
  return Math.max(0, bruto - comisionTotal - iva)
}

/* ═══════════════════════════════════════════════════════════
   MARCAS (mock hasta integrar)
   ═══════════════════════════════════════════════════════════ */

export const MARCAS = ['Binagre','Ninja Ramen','Mister Katsu','Korean Chicken','Fish & Chips']

/* ═══════════════════════════════════════════════════════════
   BADGE (top ventas / tag canal)
   ═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   DROPDOWNS
   ═══════════════════════════════════════════════════════════ */

export const dropdownBtnStyle = (T: TokenSet): CSSProperties => ({
  padding: '6px 10px',
  borderRadius: 8,
  border: `0.5px solid ${T.brd}`,
  background: T.inp,
  color: T.pri,
  fontSize: 13,
  fontFamily: FONT.body,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  whiteSpace: 'nowrap',
})

export const dropdownMenuStyle = (T: TokenSet): CSSProperties => ({
  position: 'absolute',
  left: 0,
  top: '110%',
  background: T.card,
  border: `0.5px solid ${T.brd}`,
  borderRadius: 8,
  minWidth: 170,
  zIndex: 20,
  padding: '4px 0',
})

export const dropdownItemStyle = (T: TokenSet): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 12px',
  cursor: 'pointer',
  fontSize: 13,
  fontFamily: FONT.body,
  color: T.pri,
})

/* ═══════════════════════════════════════════════════════════
   TABS
   ═══════════════════════════════════════════════════════════ */

export const tabActiveStyle = (isDark: boolean): CSSProperties => ({
  padding: '6px 14px',
  borderRadius: 6,
  border: 'none',
  background: '#FF4757',
  color: '#ffffff',
  fontFamily: FONT.body,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'background 150ms',
})

export const tabInactiveStyle = (T: TokenSet): CSSProperties => ({
  padding: '6px 14px',
  borderRadius: 6,
  border: `0.5px solid ${T.brd}`,
  background: 'none',
  color: T.sec,
  fontFamily: FONT.body,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'background 150ms',
})

/* ═══════════════════════════════════════════════════════════
   CANAL HEADER (columna tabla con color corporativo)
   ═══════════════════════════════════════════════════════════ */

export const canalHeaderStyle = (canalId: string, isDark: boolean): CSSProperties => {
  const canal = CANALES.find(c => c.id === canalId)
  const color = canal?.color ?? '#888'
  const isGlovo = canalId === 'glovo'
  return {
    fontFamily: FONT.heading,
    fontSize: 11,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    color: isGlovo ? (isDark ? '#e8f442' : '#8a7800') : color,
    padding: '8px 10px',
    textAlign: 'center',
    whiteSpace: 'nowrap',
  }
}

/* ═══════════════════════════════════════════════════════════
   FORMATO FECHAS
   ═══════════════════════════════════════════════════════════ */

export const fmtFechaCorta = (dateStr: string): string => {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export const fmtFechaLarga = (dateStr: string): string => {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^\w/, c => c.toUpperCase())
}

/* ═══════════════════════════════════════════════════════════
   BADGE (top ventas / tag canal)
   ═══════════════════════════════════════════════════════════ */

export function badgeStyle(canalTag: string, isDark: boolean): CSSProperties {
  const isGlovo = canalTag === 'GL' || canalTag === 'glovo'
  if (isGlovo) return isDark
    ? { background:'#e8f442', color:'#1a1a00', fontSize:10, padding:'1px 6px', borderRadius:3, fontFamily:'Oswald,sans-serif', letterSpacing:'0.5px' }
    : { background:'#e8f442', color:'#5a4000', border:'1px solid #8a7800', fontSize:10, padding:'1px 6px', borderRadius:3, fontFamily:'Oswald,sans-serif', letterSpacing:'0.5px' }
  const colors: Record<string,string> = { UE:'#06C167', uber:'#06C167', JE:'#f5a623', je:'#f5a623', WEB:'#B01D23', web:'#B01D23', DIR:'#66aaff', dir:'#66aaff' }
  return { background: colors[canalTag] || '#888', color:'#ffffff', fontSize:10, padding:'1px 6px', borderRadius:3, fontFamily:'Oswald,sans-serif', letterSpacing:'0.5px' }
}
