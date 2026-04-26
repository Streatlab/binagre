# TASKS — Sesión 26-abr-2026

## Bloque A · PE Refactor (implementación)

### T1 · Exponer Running como fuente de fijos y ratios
**Archivos:** `src/lib/running/index.ts` o crear `src/lib/running/aggregates.ts`
**Acción:**
- `getFijosPromedio3Meses()` → `{ totalMes, porCategoria, mesesUsados }` agregando 3 últimos meses cerrados desde Conciliación filtrada por categorías fijas (taxonomía CATEGORIAS_ORDEN).
- `getRatiosPromedio3Meses()` → `{ foodCostPct, packagingPct, comisionPonderadaPct, mesesUsados }` calculado contra bruto ventas Facturación esos 3 meses.
- Si <3 meses cerrados, devolver lo disponible y reportar `mesesUsados`.

### T2 · Reescribir handler dashboard PE
**Archivos:** `src/lib/pe/_calc.ts`, `src/lib/pe/_handlers.ts`
**Acción:**
- Eliminar lectura de fijos desde `pe_parametros`. Reemplazar por `getFijosPromedio3Meses()`.
- Eliminar lectura de food_cost / packaging / comisiones desde `pe_parametros`. Reemplazar por `getRatiosPromedio3Meses()`.
- Mantener lectura de `pe_parametros` SOLO para: `tasa_fiscal_pct`, `objetivo_beneficio_mensual`, `caja_minima_verde`, `caja_minima_ambar`, `iva_pct`.
- Aplicar fórmulas canónicas de spec CA-5.
- Devolver al frontend: `{ esRentable, deltaProyectado, diasParaCubrir, brutoMesParaCubrirFijos, brutoSemanaParaCubrirFijos, brutoDiaParaCubrirFijos, brutoMesParaGanarObjetivo, brutoSemanaParaGanarObjetivo, brutoDiaParaGanarObjetivo, proyeccionMes, margenProyectado, mesesUsadosFijos, mesesUsadosRatios }`.
- Respetar IVAContext: si toggle Con IVA, devolver brutos `× (1 + iva_pct/100)`.

### T3 · Rehacer UI Dashboard PE
**Archivos:** `src/components/pe/Dashboard.tsx` (o equivalente)
**Acción:**
- Eliminar 2 KpiCards: "CUBRIR GASTOS" y "GANAR [objetivo] LIMPIO".
- Mantener/rehacer 2 KpiCards grandes arriba:
  - "¿SOMOS RENTABLES?" (SÍ/NO + delta €)
  - "¿DESDE QUÉ DÍA?" (Día X verde / "Día 36 · faltan Y€" rojo)
- Añadir sección "OBJETIVOS DE FACTURACIÓN" tabla 3×3 (Cubrir fijos / Ganar objetivo / Estado actual proyección × MES / SEMANA 5d / DÍA 5d/sem).
- Mantener: gráfico Ingresos acumulados vs PE, Mix canales, Acciones recomendadas.
- Mostrar fallback "Datos insuficientes · usando últimos N meses cerrados" si `mesesUsados < 3`.
- Tokens Binagre desde `src/styles/tokens.ts`. Recharts paleta CANALES. fmtEur.

### T4 · Eliminar tab Configuración del módulo PE
**Archivos:** `src/components/pe/Configuracion.tsx` (eliminar), tabs nav del módulo PE, rutas/handlers `/api/pe/configuracion` si existen.
**Acción:**
- Borrar componente Configuracion.tsx.
- Quitar entrada "Configuración" de tabs PE.
- Borrar endpoints/handlers expuestos solo para ese tab.
- NO borrar tabla `pe_parametros` en Supabase.

### T5 · Crear UI mínima global para 5 parámetros PE
**Archivos:** nueva ruta `src/pages/configuracion/pe-parametros/index.tsx` (o equivalente).
**Acción:**
- Página con 5 inputs: `tasa_fiscal_pct`, `objetivo_beneficio_mensual`, `caja_minima_verde`, `caja_minima_ambar`, `iva_pct`.
- Botón Guardar que escribe en `pe_parametros`.
- Enlazar desde Configuración global del ERP (sidebar o ruta padre).
- Tokens Binagre. NO replicar el formato del antiguo tab de 21 inputs.

### T6 · QA local
**Acción:**
- Validar `localhost:5173/finanzas/punto-equilibrio` según spec CA-7.
- Cotejar 1 fijo manual (alquiler) vs Running último mes.
- Verificar toggle Sin IVA / Con IVA.
- Verificar que tab Configuración NO existe en nav.
- NO desplegar a Vercel hasta cierre del día (deploy diario).

---

## Bloque B · Housekeeping Notion (mobile)

### T7 · Limpieza tareas mobile en Notion
**Acción (la ejecuto YO desde aquí, no Claude Code local):**
- Eliminar las 6 tareas mobile sub-divididas creadas por error.
- Mantener tarea paraguas única "Mobile friendly general".
- No toca código.

---

## Bloque C · Cierre del día (al final)

### T8 · Deploy Vercel + actualización docs
**Acción (cuando Rubén dé OK al cierre):**
```
git add . && git commit -m "PE: dashboard datos reales Running + elimina tab Configuracion + KPIs duplicados" && git push origin master && npx vercel --prod && git pull origin master
```
- Mover la nota de "deploy diario" desde `.claude/plans/spec.md` a `CLAUDE.md` como regla permanente.
- Actualizar Notion: PE-relacionadas a RESUELTO/EN_CURSO según resultado QA.
