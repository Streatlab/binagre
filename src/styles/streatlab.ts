// LEY VISUAL SL v1 — fuente única de verdad visual del ERP Binagre
// Manual: Notion > CEREBRO-SL > "LEY VISUAL SL — Sistema de diseño Binagre ERP v1"
// Sustituye a neobrutal.ts (deprecado). Todo color de UI debe salir de aquí.

export type SLToken = { light: string; dark: string };

export const SL: Record<string, SLToken> = {
  // ── Marca (manual corporativo Streat Lab) ──
  ROJO_SL:       { light: '#B01D23', dark: '#E04A50' }, // color primario de acción
  ROJO_DEEP:     { light: '#951218', dark: '#B01D23' }, // inicio degradado hero
  NARANJA_SL:    { light: '#EE8A4E', dark: '#EE8A4E' }, // fin degradado hero / calidez
  AMARILLO_SL:   { light: '#F7B54B', dark: '#F7B54B' }, // destacar / barras de datos
  INK:           { light: '#292828', dark: '#F2EFEC' }, // texto principal

  // ── Neutros ──
  CANVAS:        { light: '#FAF6F1', dark: '#171412' }, // fondo app (cálido, nunca azulado)
  CARD:          { light: '#FFFFFF', dark: '#211D1A' },
  LINE:          { light: '#F0E7DC', dark: '#332D28' },
  GRIS:          { light: '#6E6B68', dark: '#ABA7A2' },
  GRIS_CL:       { light: '#9C9894', dark: '#847F7A' },
  ZEBRA:         { light: '#FCF3EB', dark: '#282320' }, // filas alternas de tabla
  HOVER:         { light: '#F9EADD', dark: '#2F2925' },

  // ── Semánticos (solo significado de dato, nunca decoración) ──
  VERDE:         { light: '#0B8A4B', dark: '#3DD68C' },
  VERDE_SOFT:    { light: '#E3F5EC', dark: '#173226' },
  ROJO_SEM:      { light: '#D3261B', dark: '#FF7B6E' },
  ROJO_SEM_SOFT: { light: '#FCE9E7', dark: '#3B1F1C' },
  AMBAR:         { light: '#B36A00', dark: '#FFC24D' },
  AMBAR_SOFT:    { light: '#FCF2DE', dark: '#382C14' },
  BLU:           { light: '#4A63C8', dark: '#7B90E8' },
};

export const RADIUS = { card: 18, icon: 11, pill: 999 } as const;

export const SHADOW = '0 2px 10px rgba(120,60,20,.08)';
export const SHADOW_DARK = '0 2px 12px rgba(0,0,0,.35)';

export const FONT_UI = "'Nunito', sans-serif"; // pesos 600–900
export const FONT_NUM = "'JetBrains Mono', monospace"; // números SIEMPRE con tabular-nums

// Helper: valor según modo actual ('light' | 'dark')
export const sl = (token: keyof typeof SL, mode: 'light' | 'dark' = 'light') =>
  SL[token][mode];

// Estilo base para celdas/valores numéricos
export const numStyle = {
  fontFamily: FONT_NUM,
  fontVariantNumeric: 'tabular-nums' as const,
};
