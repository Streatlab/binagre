# /fix-fmtEur — Skill

Patron canonico para formato de euros en Binagre.

## Regla absoluta
NUNCA formatear euros manualmente. Siempre usar fmtEur() desde src/lib/format.ts.

## Casos
- Numero positivo: 1234.5 -> "1.234,50 €"
- Cero: 0 -> "0,00 €"
- Negativo: -50 -> "-50,00 €"
- Null/undefined: usar fmtEur(0) o "—"

## Locale
es_ES. Coma decimal. Punto miles. 2 decimales siempre.

## Errores comunes (ver Notion BINAGRE-ERRORES)
- Mezclar Intl.NumberFormat directo en componentes -> usar fmtEur.
- Hardcodear " €" al final -> ya viene en fmtEur.

## Pipeline reducido
implementer + qa-reviewer (check fmtEur). Sin pm-spec ni ADR.
