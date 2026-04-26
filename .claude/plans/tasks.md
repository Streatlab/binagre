# TASKS — PE Refactor

## T1 · Exponer Running como fuente de fijos y ratios (backend lib)
**Archivos:** `src/lib/running/index.ts` (o crear `src/lib/running/aggregates.ts`)
**Acción:**
- Crear función `getFijosPromedio3Meses()` que devuelve `{ totalMes: number, porCategoria: Record<categoria, number>, mesesUsados: number }` agregando los 3 últimos meses cerrados desde Conciliación filtrada por categorías fijas (taxonomía CATEGORIAS_ORDEN existente).
- Crear función `getRatiosPromedio3Meses()` que devuelve `{ foodCostPct, packagingPct, comisionPonderadaPct, mesesUsados }` calculando contra bruto ventas Facturación esos mismos 3 meses.
- Si <3 meses cerrados, devolver lo que haya y reportar `mesesUsados` para fallback UI.
**Out:** funciones puras, sin UI. Tests de signo no exigidos pero coherencia con datos abril 2026.

## T2 · Reescribir handler dashboard PE
**Archivos:** `src/lib/pe/_calc.ts`, `src/lib/pe/_handlers.ts`
**Acción:**
- Eliminar lectura de fijos desde `pe_parametros`. Reemplazar por `getFijosPromedio3Meses()`.
- Eliminar lectura de food_cost_pct/packaging_pct/comisiones desde `pe_parametros`. Reemplazar por `getRatiosPromedio3Meses()`.
- Mantener lectura de pe_parametros SOLO para: `tasa_fiscal_pct`, `objetivo_beneficio_mensual`, `caja_minima_verde`, `caja_minima_ambar`, `iva_pct`.
- Aplicar fórmulas canónicas de spec CA-5.
- Devolver al frontend: `{ esRentable, deltaProyectado, diasParaCubrir, brutoMesParaCubrirFijos, brutoSemanaParaCubrirFijos, brutoDiaParaCubrirFijos, brutoMesParaGanarObjetivo, brutoSemanaParaGanarObjetivo, brutoDiaParaGanarObjetivo, proyeccionMes, margenProyectado, mesesUsadosFijos, mesesUsadosRatios }`.
- Respetar IVAContext: si toggle Con IVA, devolver brutos con IVA aplicado (`× (1 + iva_pct/100)`).

## T3 · Rehacer UI Dashboard PE
**Archivos:** `src/components/pe/Dashboard.tsx` (o equivalente del módulo)
**Acción:**
- Eliminar 2 KpiCards: "CUBRIR GASTOS" y "GANAR [objetivo] LIMPIO".
- Mantener/rehacer 2 KpiCards grandes arriba: "¿SOMOS RENTABLES?" (SÍ/NO + delta €) + "¿DESDE QUÉ DÍA?" (Día X o "Día 36 · faltan Y€").
- Añadir nueva sección "OBJETIVOS DE FACTURACIÓN" con tabla 3 filas × 3 columnas (Cubrir fijos / Ganar objetivo / Estado actual proyección × MES / SEMANA 5d / DÍA 5d/sem).
- Mantener: gráfico Ingresos acumulados vs PE, Mix canales, Acciones recomendadas.
- Mostrar fallback "Datos insuficientes · usando últimos N meses cerrados" si `mesesUsados < 3`.
- Tokens Binagre obligatorios desde `src/styles/tokens.ts`. Recharts paleta CANALES. fmtEur para todo importe.

## T4 · Eliminar tab Configuración del módulo PE
**Archivos:** `src/components/pe/Configuracion.tsx` (eliminar), tabs nav del módulo PE, rutas/handlers `/api/pe/configuracion` (si existen).
**Acción:**
- Borrar componente Configuracion.tsx.
- Quitar entrada "Configuración" de la lista de tabs del módulo PE.
- Borrar endpoints/handlers expuestos solo para ese tab.
- NO borrar tabla `pe_parametros` en Supabase.

## T5 · Crear UI mínima global para 5 parámetros PE
**Archivos:** nueva ruta `src/pages/configuracion/pe-parametros/index.tsx` (o equivalente según estructura actual del ERP).
**Acción:**
- Página con 5 inputs: tasa_fiscal_pct, objetivo_beneficio_mensual, caja_minima_verde, caja_minima_ambar, iva_pct.
- Botón Guardar que escribe en `pe_parametros`.
- Enlazar desde la sección Configuración global del ERP (sidebar o ruta padre).
- Tokens Binagre. Sin reinventar el formato del antiguo tab de 21 inputs.

## T6 · QA + cierre
**Acción:**
- Validar página `/finanzas/punto-equilibrio` post-deploy según spec CA-7.
- Cotejar 1 fijo manual (alquiler) vs Running último mes.
- Verificar que toggle Sin IVA / Con IVA funciona.
- Verificar que tab Configuración NO existe en nav.
- Cadena git+vercel:
```
git add . && git commit -m "PE: dashboard responde 4 preguntas datos reales Running, elimina tab Configuracion y KPIs duplicados" && git push origin master && npx vercel --prod && git pull origin master
```
