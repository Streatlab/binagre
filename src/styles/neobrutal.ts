/**
 * neobrutal.ts — TOKENS CANÓNICOS del estilo NEOBRUTALISTA del Panel Global Binagre.
 *
 * Fuente de verdad ÚNICA del look "Food Pop" (sombra dura 4px, bordes negros,
 * fondo crema, Oswald/Lexend, color con significado semántico).
 * Extraído de ResumenLanding.tsx / Sidebar.tsx / Layout.tsx — auditoría 25-jun-2026.
 *
 * El antiguo src/components/panel/resumen/tokens.ts queda SOLO como legacy
 * (bordes redondeados, fondo grisáceo). NO usarlo para el estilo de hoy.
 *
 * NO improvisar hex ni medidas: usar estas constantes tal cual.
 */
import type { CSSProperties } from 'react'
import { fmtEur, fmtPct, fmtNum } from '@/lib/format'

/* ── Familias tipográficas ───────────────────────── */
export const OSW = "'Oswald', sans-serif"   // titulares, etiquetas y números (uppercase)
export const LEX = "'Lexend', sans-serif"   // texto corrido

/* ── Paleta (pestaña Resumen) ────────────────────── */
export const INK         = '#140f08'  // bordes, texto principal, sombra, tinta
export const OSC         = '#2b2117'  // fondo oscuro: alertas y footer
export const CREMA       = '#FCEFD6'  // fondo general
export const CLARO       = '#F3D9A8'  // crema tostado: paneles secundarios
export const ROSA_CL     = '#ffe0ea'  // fondo card "Ratio"
export const LAV         = '#d8e3ff'  // fondo card "Punto de equilibrio"
export const TEAL        = '#0F3D35'  // fondo "Resultado del periodo"
export const TRACK       = '#ecdcb8'  // pista de barras
export const TRACK_CANAL = '#e2dac9'  // pista de barras de canal
export const ROSA        = '#FF2E63'  // acento (NO "malo"); relleno barras objetivos
export const ROJO        = '#FF1E27'  // negativo semántico (caídas, "no llegas")
export const AMA         = '#FFC400'  // hero, objetivos, días pico
export const VERDE       = '#0FB86B'  // positivo: neto, TM neto, canal propio, "llegas"
export const NAR         = '#FF6A1A'  // pedidos, aviso intermedio, plataformas, coste
export const AZUL        = '#2D5BFF'  // TM bruto, "Te deben", valores editables
export const GRANATE     = '#B01D23'  // corporativo Binagre
export const GRIS        = '#9a8f78'  // sin dato / desactivado / estimado apagado
export const D1          = CREMA       // texto sobre fondo oscuro

/** Paleta agrupada (acceso por objeto). */
export const NEO = {
  INK, OSC, CREMA, CLARO, ROSA_CL, LAV, TEAL, TRACK, TRACK_CANAL,
  ROSA, ROJO, AMA, VERDE, NAR, AZUL, GRANATE, GRIS,
} as const

/* ── Estructura ──────────────────────────────────── */
export const SHADOW      = `4px 4px 0 ${INK}`  // sombra ÚNICA de todo el ERP
export const PAD         = '40px'              // padding lateral de sección
export const BORDER      = `4px solid ${INK}`  // contenedores y secciones
export const BORDER_CARD = `3px solid ${INK}`  // cards y barras

/* ── Canales de plataforma ───────────────────────── */
export const CORP: Record<string, string> = {
  uber: '#06C167', glovo: '#FFC244', je: '#FF8000', web: '#B01D23', dir: '#1e2233',
}
/** true = fondo claro → texto INK · false = fondo oscuro → texto #fff */
export const CLARA: Record<string, boolean> = {
  uber: true, glovo: true, je: false, web: false, dir: false,
}
/** Objetivo de margen de referencia por canal (estimado). */
export const OBJ_MARGEN: Record<string, number> = {
  uber: 55, glovo: 55, je: 55, web: 88, dir: 92,
}

/* ── Sidebar (OJO: su INK es #0a0a0a, distinto del de Resumen) ── */
export const SIDEBAR = {
  INK: '#0a0a0a', CREMA, BLANCO: '#ffffff', GRANATE, AMA,
  widthOpen: 248, widthCollapsed: 56,
  border: '4px solid #0a0a0a', sep: '3px solid #0a0a0a',
} as const

/** Color sólido de cabecera por sección del sidebar. */
export const SIDEBAR_SECTION_BG: Record<string, { bg: string; color: string }> = {
  finanzas:      { bg: '#0FB86B', color: '#ffffff' },
  cocina:        { bg: '#FFC400', color: '#0a0a0a' },
  operaciones:   { bg: '#FF6A1A', color: '#ffffff' },
  stock:         { bg: '#2D5BFF', color: '#ffffff' },
  informes:      { bg: '#B01D23', color: '#ffffff' },
  equipo:        { bg: '#FF2E63', color: '#ffffff' },
  mkt:           { bg: '#1e2233', color: '#ffffff' },
  configuracion: { bg: '#484f66', color: '#ffffff' },
}

/* ── Wrapper del ERP ─────────────────────────────── */
export const CREMA_WRAP = '#FCEFD6'  // fondo de toda la app en modo claro

/* ── Helpers de estilo ───────────────────────────── */
/** Número/título neobrutal: Oswald 700, uppercase, interlineado apretado. */
export const d = (size: string, color: string = INK): CSSProperties => ({
  fontFamily: OSW, fontWeight: 700, fontSize: size, lineHeight: 0.95,
  letterSpacing: '-0.5px', textTransform: 'uppercase', color,
})

/** Etiqueta tipo pastilla con borde 2px (la "eyebrow" de cada sección). */
export const eyebrow = (bg: string, color: string = INK): CSSProperties => ({
  display: 'inline-block', background: bg, color, border: `2px solid ${INK}`,
  fontFamily: OSW, fontWeight: 600, fontSize: 13, letterSpacing: '2px',
  textTransform: 'uppercase', padding: '4px 12px',
})

/* ── Formato de cifras (idéntico a la pestaña Resumen) ── */
/** Importe hero CON €: "1.234 €" */
export const EUR = (n: number) => fmtEur(n, { decimals: 0 })
/** Importe SIN € (contexto ya monetario): "1.234" */
export const E = (n: number) => fmtEur(n, { showEuro: false, decimals: 0 })
/** Importe SIN €, 2 decimales: "1.234,56" */
export const E2 = (n: number) => fmtEur(n, { showEuro: false, decimals: 2 })
/** Importe CON signo y €: "+1.234,56 €" */
export const ES = (n: number) => fmtEur(n, { signed: true, decimals: 2 })
/** Conteo entero con miles: "1.234" */
export const N = (n: number) => fmtNum(n, 0)
/** Porcentaje entero: "12%" */
export const P0 = (n: number) => fmtPct(n, 0)
/** Porcentaje 2 decimales: "12,34%" */
export const P2 = (n: number) => fmtPct(n, 2)
/** Variación con signo: null→"—", si no "+5,4%" / "−3,2%" */
export const DELTA = (v: number | null) =>
  v == null ? '—' : fmtEur(v, { signed: true, showEuro: false, decimals: 1 }) + '%'
