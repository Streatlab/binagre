# RONDA 9 — FIXES APLICADOS

Archivos reescritos en este commit:

1. **src/lib/format.ts** — añadido `useGrouping: true` explícito a fmtNum y fmtEur. Bug corregido: en algunos motores ES no aplica separador miles para 4 dígitos sin el flag explícito. Esto arregla AUTOMÁTICAMENTE el separador en TODOS los componentes (Facturación, Resultado, Días Pico, Cards canal, Cards pequeñas).

2. **src/components/panel/resumen/CardResultadoPeriodo.tsx**
   - Quitado asterisco "*" de "Ingresos netos"
   - "Producto" → "Producto · COGS"
   - Margen bruto = ingresos netos − producto siempre calculado (aunque producto=0)
   - "Personal" → "Equipo"
   - "Local + Controlables" → 2 líneas separadas: "Local" y "Controlables"
   - "Resultado limpio" → "Resultado neto", solo aparece si difiere de EBITDA en >0,01

3. **src/components/panel/resumen/ColFacturacionCanal.tsx**
   - Bruto en negro #111111 (igual que Card Facturación principal) en CardCanal y CardCanalMini
   - "Bruto" label en gris oscuro #3a4050

4. **src/components/panel/resumen/tokens.ts**
   - TABS_PILL marginTop:3 marginBottom:3 (1mm)
   - fmtDec y fmtPp con useGrouping:true

## Deploy
```
git pull origin master && npx tsc --noEmit && git add . && git commit -m "fix(panel): ronda 9" && git push origin master && npx vercel --prod && git pull origin master
```
