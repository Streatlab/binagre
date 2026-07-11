/**
 * neobrutal.ts — ⚠️ DEPRECADO como estilo. Se mantiene SOLO como CAPA DE
 * COMPATIBILIDAD: decenas de módulos importan estas constantes.
 *
 * Desde 12-jul-2026 sus valores están REMAPEADOS a la LEY VISUAL SL v1
 * (Notion > CEREBRO-SL > "LEY VISUAL SL — Sistema de diseño Binagre ERP v1").
 * Al repintar aquí, todo el ERP adopta el estilo nuevo sin tocar cada módulo.
 *
 * Resultado del remapeo:
 *  - Fuera Oswald/Lexend → Nunito (UI) y JetBrains Mono (números).
 *  - Fuera sombra dura 4px desplazada → sombra suave cálida.
 *  - Fuera bordes 3–4px negros → borde 1px LINE.
 *  - Fuera fondos crema/tostado saturados → crema #FAF6F1 + card blanco.
 *  - Rojo SL es el ÚNICO color de acción; el resto solo semántica de dato.
 *
 * ➡️ Para módulos NUEVOS: importar SIEMPRE de `src/styles/streatlab.ts`.
 */
import type { CSSProperties } from 'react'
import { fmtEur, fmtPct, fmtNum } from '@/lib/format'

/* ── Familias tipográficas (Ley Visual SL) ───────── */
export const OSW = "'Nunito', sans-serif"              // titulares y etiquetas
export const LEX = "'Nunito', sans-serif"              // texto corrido
export const MONO = "'JetBrains Mono', monospace"      // números (tabular-nums)

/* ── Paleta ESTRUCTURAL (theme-aware · var(--neo-*)) ── */
export const INK         = 'var(--neo-ink)'          // texto principal
export const LINE        = 'var(--neo-line)'         // borde canónico
export const OSC         = 'var(--neo-osc)'          // fondo oscuro puntual
export const CREMA       = 'var(--neo-bg)'           // fondo de tarjeta
export const CLARO       = 'var(--neo-bg-2)'         // panel secundario / zebra
export const ROSA_CL     = 'var(--neo-card-ratio)'
export const LAV         = 'var(--neo-card-pe)'
export const TEAL        = 'var(--neo-card-result)'
export const TRACK       = 'var(--neo-track)'
export const TRACK_CANAL = 'var(--neo-track-canal)'
export const D1          = 'var(--neo-on-dark)'
export const ZEBRA       = 'var(--neo-zebra)'
export const HOVER       = 'var(--neo-hover)'

/* ── Paleta de MARCA y SEMÁNTICA (Ley Visual SL) ── */
export const GRANATE     = 'var(--sl-red)'      // ROJO SL · único color de acción
export const ROSA        = 'var(--sl-red)'      // acento → rojo SL (ya no hay rosa)
export const NAR         = 'var(--sl-naranja)'  // calidez secundaria (hero, barras)
export const AMA         = 'var(--sl-amarillo)' // destacar / barras de datos
export const VERDE       = 'var(--sl-verde)'    // positivo / conciliado
export const ROJO        = 'var(--sl-rojo-sem)' // negativo / pendiente / alerta
export const AMBAR       = 'var(--sl-ambar)'    // atención / revisar
export const AZUL        = 'var(--sl-blu)'      // informativo
export const GRIS        = 'var(--sl-text-muted)'

/* ── Fondos soft de semántica (píldoras) ── */
export const VERDE_SOFT  = 'var(--sl-verde-soft)'
export const ROJO_SOFT   = 'var(--sl-rojo-soft)'
export const AMBAR_SOFT  = 'var(--sl-ambar-soft)'
export const AZUL_SOFT   = 'var(--sl-blu-soft)'

/** Paleta agrupada (acceso por objeto). */
export const NEO = {
  INK, LINE, OSC, CREMA, CLARO, ROSA_CL, LAV, TEAL, TRACK, TRACK_CANAL,
  ROSA, ROJO, AMA, VERDE, NAR, AZUL, GRANATE, GRIS, AMBAR,
} as const

/* ── Estructura (Ley Visual SL: sin sombras duras) ── */
export const SHADOW      = 'var(--neo-shadow)'
export const PAD         = '32px'
export const BORDER      = `1px solid ${LINE}`
export const BORDER_CARD = `1px solid ${LINE}`
export const RADIUS      = 18
export const RADIUS_ICON = 11
export const RADIUS_PILL = 999

/* ── Canales de plataforma (MARCA · fijos) ───────── */
export const CORP: Record<string, string> = {
  uber: '#06C167', glovo: '#F7B54B', je: '#EE8A4E', web: '#B01D23', dir: '#4A63C8',
}
/** true = fondo claro → texto INK · false = fondo oscuro → texto #fff */
export const CLARA: Record<string, boolean> = {
  uber: true, glovo: true, je: true, web: false, dir: false,
}
/** Objetivo de margen de referencia por canal (estimado). */
export const OBJ_MARGEN: Record<string, number> = {
  uber: 55, glovo: 55, je: 55, web: 88, dir: 92,
}

/* ── Sidebar (Ley Visual SL: card + activa en rojo SL) ── */
export const SIDEBAR = {
  INK: 'var(--sl-text-primary)',
  CREMA: 'var(--sl-sidebar)',
  BLANCO: 'var(--sl-card)',
  GRANATE, AMA,
  widthOpen: 248, widthCollapsed: 56,
  border: `1px solid ${LINE}`, sep: `1px solid ${LINE}`,
} as const

/** Cabecera de sección del sidebar: eyebrow gris, sin bloques de color. */
const SEC = { bg: 'transparent', color: 'var(--sl-text-muted)' }
export const SIDEBAR_SECTION_BG: Record<string, { bg: string; color: string }> = {
  finanzas: SEC, cocina: SEC, operaciones: SEC, stock: SEC,
  informes: SEC, equipo: SEC, mkt: SEC, configuracion: SEC,
}

/* ── Wrapper del ERP ─────────────────────────────── */
export const CREMA_WRAP = 'var(--sl-app)'  // fondo de toda la app (crema cálido)

/* ── Helpers de estilo ───────────────────────────── */
/** Número/título destacado: Nunito 800, cifras tabulares, sin uppercase forzado. */
export const d = (size: string, color: string = INK): CSSProperties => ({
  fontFamily: OSW, fontWeight: 800, fontSize: size, lineHeight: 1.05,
  letterSpacing: '-0.4px', color, fontVariantNumeric: 'tabular-nums',
})

/** Cifra monoespaciada (KPIs, importes, porcentajes). */
export const n = (size: string, color: string = INK): CSSProperties => ({
  fontFamily: MONO, fontWeight: 700, fontSize: size, lineHeight: 1.05,
  color, fontVariantNumeric: 'tabular-nums',
})

/** Etiqueta tipo píldora (eyebrow) — ahora redonda y sin borde duro. */
export const eyebrow = (bg: string, color: string = INK): CSSProperties => ({
  display: 'inline-block', background: bg, color, border: `1px solid ${LINE}`,
  fontFamily: OSW, fontWeight: 800, fontSize: 11, letterSpacing: '1.2px',
  textTransform: 'uppercase', padding: '4px 11px', borderRadius: RADIUS_PILL,
})

/** Píldora semántica soft (Conciliada / Pendiente / Revisar…). */
export const pill = (color: string, bg: string): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, background: bg, color,
  fontFamily: OSW, fontWeight: 800, fontSize: 11, padding: '4px 9px',
  borderRadius: RADIUS_PILL,
})

/* ── Formato de cifras ───────────────────────────── */
/** Importe hero CON €: "1.234 €" */
export const EUR = (v: number) => fmtEur(v, { decimals: 0 })
/** Importe SIN € (contexto ya monetario): "1.234" */
export const E = (v: number) => fmtEur(v, { showEuro: false, decimals: 0 })
/** Importe SIN €, 2 decimales: "1.234,56" */
export const E2 = (v: number) => fmtEur(v, { showEuro: false, decimals: 2 })
/** Importe CON signo y €: "+1.234,56 €" */
export const ES = (v: number) => fmtEur(v, { signed: true, decimals: 2 })
/** Conteo entero con miles: "1.234" */
export const N = (v: number) => fmtNum(v, 0)
/** Porcentaje entero: "12%" */
export const P0 = (v: number) => fmtPct(v, 0)
/** Porcentaje 2 decimales: "12,34%" */
export const P2 = (v: number) => fmtPct(v, 2)
/** Variación con signo: null→"—", si no "+5,4%" / "−3,2%" */
export const DELTA = (v: number | null) =>
  v == null ? '—' : fmtEur(v, { signed: true, showEuro: false, decimals: 1 }) + '%'
