# PROMPT PARA CLAUDE CODE — DEPLOY CONCILIACIÓN
> Fecha: 01/05/2026 | Repo: Streatlab/binagre | URL: binagre.vercel.app

## QUÉ HA PASADO

Claude chat ha subido directamente al repo 4 archivos completos con todos los fixes de Conciliación.
TU ÚNICA TAREA es hacer `git pull + npm run build + vercel --prod`.
NO toques código. NO modifiques nada. Solo build y deploy.

## SPEC ACTIVA EN ESTE DEPLOY

Hay 2 specs en `.claude/plans/`. Esta tarea corresponde a:
- `.claude/plans/spec-fix-cap-y-fechas.md` — fix cap 1000 + fechas español
- `.claude/plans/spec-orden-y-fechas.md` — columnas ordenables

## ARCHIVOS YA MODIFICADOS EN EL REPO (commits hechos por Claude chat)

| Archivo | Commit | Qué hace |
|---|---|---|
| `src/styles/tokens.ts` | 32c4376 | fmtFechaCorta → dd/mm/yy (antes "1 ene") |
| `src/hooks/useConciliacion.ts` | 5f8dca4 | .range(0, 999999) para superar cap 1000 Supabase |
| `src/pages/Conciliacion.tsx` | 4e6d1f0 | .range(0, 999999) en query periodo + header con fmtFechaCorta |
| `src/components/conciliacion/TabMovimientos.tsx` | 6f3f451 | 8 columnas ordenables az/za + paginación 100 + badge categoría por ID directo |
| `src/components/ui/SelectorFechaUniversal.tsx` | 95fdfec | label personalizado en dd/mm/yy + lang="es-ES" en inputs |

## RESULTADO ESPERADO EN PRODUCCIÓN

Abrir binagre.vercel.app/conciliacion en incógnito con filtro personalizado 01/01/2020 → 31/12/2026:
- Cards: **+283.354,59 €** ingresos / **-234.415,64 €** gastos
- Tabla footer: "Mostrando 100 de 5203 movimientos" (NO "de 1000")
- Selector fecha muestra: **"01/01/20 → 31/12/26"** (NO "2020-01-01 → 2026-12-31")
- Click en encabezado Fecha → ordena ↑/↓

## TU TAREA (EXACTA, EN ORDEN)

```bash
cd C:\streatlab-erp
git pull origin master
npm run build
```

Si build OK:
```bash
git add . && git commit -m "deploy: cap 1000 + columnas ordenables + fechas español" --allow-empty && git push origin master && npx vercel --prod && git pull origin master
```

Si build falla por errores TypeScript:
- Resuélvelos tú sola sin preguntar (regla maestra 30 abril 2026)
- Documenta los fixes en informe final
- Deploy igualmente

## INFORME FINAL OBLIGATORIO

1. URL deploy Vercel
2. ¿Build pasó limpio o hubo errores resueltos? (listar si los hubo)
3. Test manual en binagre.vercel.app/incógnito:
   - Card ingresos filtro 01/01/20→31/12/26: ¿muestra +283.354€?
   - Footer tabla: ¿dice "de 5203" o sigue "de 1000"?
   - Selector personalizado: ¿muestra dd/mm/yy?
   - Click columna Fecha: ¿ordena?
4. Estado: RESUELTO o PENDIENTE con motivo
