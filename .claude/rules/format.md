# Reglas Binagre — Format y locale

## Locale
- es_ES en toda la aplicación.
- Separador decimal: coma.
- Separador de miles: punto.
- Formato fechas: DD/MM/YYYY.

## Funciones canónicas
- `fmtEur(n)` desde `src/lib/format.ts` para formatear euros.
- Nunca formatear euros manualmente.

## IF en SQL/Supabase
Separador `;` (Excel español), no `,`.

## Ejemplos
- `1234.5` → `1.234,50 €`
- `0` → `0,00 €`
