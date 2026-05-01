# Reglas Binagre — Design Tokens

## Tokens canónicos (únicos permitidos)
- **Rojo principal**: `#B01D23`
- **Negro**: `#0a0a0a`
- **Sidebar**: `#1e2233`
- **Panel global**: `#e8f442`
- **Modal**: `#484f66`

## Master files
- `src/styles/tokens.ts`
- `src/styles/design-tokens.css`

## Prohibido
- Hex hardcodeados en componentes.
- Tokens del repo erp-david: `#16355C`, `#F26B1F`, Marino+Fuego, arena cálida.
- Mezclar paletas.

## Cómo usar
Importar siempre desde `src/styles/tokens.ts`. Si un token no existe, añadirlo allí primero.
