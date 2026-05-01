# RONDA 8 — FIXES APLICADOS

## Cambios ya subidos en este commit:
- `CardVentas.tsx` (R8-01) — objetivos editables con handler real, borrar restaura último valor
- `ColFacturacionCanal.tsx` (R8-02 R8-03) — Web/Directa muestran 0,00 + Glovo border sutil
- `CardResultadoPeriodo.tsx` (R8-04 R8-05) — % s/netos visible + Prime Cost barra invertida

## Pendiente verificar tras Vercel:
- Dropdown Marcas se muestra más ancho (patch ronda 7 PATCH 4)
- Tabs pegados a zona blanca (patch ronda 7 PATCH 2)

## Deploy
```
git pull origin master && npx tsc --noEmit && git add . && git commit -m "fix(panel): ronda 8" && git push origin master && npx vercel --prod && git pull origin master
```
