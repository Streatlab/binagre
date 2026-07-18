# FASE 2 · Estilo único — registro de tandas

## Tanda D · 18-jul-2026
- `src/components/panel/resumen/tokens.ts` migrado al kit Neobrutal Alegre (commit 3056029): cards 3px + sombra dura 3px + radius 0, TABS_PILL = patrón SUBTABS (Oswald, verde activo), dropdowns y barras con borde 2px negro, TAG/filterActive con lavado AMA_S, editable azul #2D5BFF, accent → ROSA kit #FF2E63, canales → paleta CORP (glovo #FFC244, JE #FF8000). **Efecto: las 39 pantallas que importan estos tokens adoptan la estructura del kit por alias.**
- `src/pages/marketing/PanelMkt.tsx` sombras 5px/6px → 3px (commit 57850e0, pendiente del handoff).
- Gate verde: tsc 0 errores · vite build OK · vitest 216/216.

## Pendiente siguiente tanda
- Facturacion.tsx (migración completa; incluir hex locales de canal: `CANAL_COLORS_M` glovo #e8f442/#8a7800 → #FFC244/#8a5b00; sección Just Eat #f5a623 → #FF8000).
- Documentacion.tsx, PagosCobros.tsx, PanelGlobal.tsx (revisión interior post-alias: quitar estilos locales que dupliquen tokens).
- Resto según orden del handoff (mixtas → hex puro → alias neobrutal financieras → retirar interruptor NEO/SL).
