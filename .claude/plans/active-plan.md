# Active Plan — Sesión 26-abr-2026

## Bloque A · PE Refactor (PRINCIPAL)
**PE Refactor · Dashboard responde 4 preguntas con datos reales Running** — eliminar dependencia de pe_parametros como fuente de fijos/variables, eliminar tab Configuración (21 inputs manuales), eliminar 2 KPIs duplicados, sustituir por tabla 3×3 (MES/SEMANA-5d/DÍA-5d/sem) y 2 KPIs principales (¿Somos rentables? · ¿Desde qué día?). Añadir 6ª sección "PE Parámetros" dentro del monolito `src/pages/Configuracion.tsx` para los 5 valores que sí siguen siendo manuales.

## Decisiones de bloqueos (cerradas con Rubén 26-abr-2026 12:00)
- **B1 = subdividir taxonomía PRODUCTO** → separar `food_cost_pct` y `packaging_pct` reales (distinguir PRD-ALI de PRD-PKG en `src/lib/running.ts`).
- **B2 = ya aplicado** → migración pe_parametros (5 campos) verificada en Supabase. Los 5 campos existen y tienen defaults: tasa_fiscal_pct=25, objetivo_beneficio_mensual=3000, caja_minima_verde=3000, caja_minima_ambar=500, iva_pct=10. **NO hay que aplicar nada más.**
- **B3 = añadir 6ª sección "PE Parámetros" dentro de `src/pages/Configuracion.tsx`** (monolito existente con `<Section>` switcheado). NO crear ruta nueva ni router nuevo.
- **B4 = aditivo** → mantener todos los campos viejos del payload de `dashboardHandler` + sumar los nuevos. NO romper TabPresupuestos/TabSimulador/TabDow. Limpieza de campos viejos en fix posterior.

## Decisiones de negocio (cerradas 26-abr-2026)
1. Cierre 2 días variados/semana → 5 días operativos/sem, ~22 días operativos/mes
2. Fuente fijos: Running, promedio 3 últimos meses cerrados
3. Fuente variables (food cost / packaging / comisiones): Presupuestos + reales 3 últimos meses cerrados
4. Tab Configuración del módulo PE → ELIMINAR
5. 5 parámetros que sí siguen manuales → 6ª sección dentro de Configuracion.tsx (B3)
6. Mobile friendly se queda como UNA tarea paraguas global
7. Deploy a Vercel UNA vez al día al cierre. Durante la sesión se trabaja contra `localhost:5173`.

## Estado pipeline
1. ✅ `pm-spec` → `.claude/plans/spec.md`
2. ✅ tasks → `.claude/plans/tasks.md`
3. ✅ B1-B4 cerrados (decisiones arriba)
4. ✅ B2 verificado en Supabase, no requiere migración
5. ✅ Notion: 6 sub-tareas mobile fusionadas a paraguas
6. ⏳ **`implementer` (en local Rubén) → ARRANCAR T1 + T2 + T3 + T4 + T5 con las decisiones B1-B4**
7. ⏳ `qa-reviewer` (en local) → T6 contra `localhost:5173`
8. ⏳ cierre del día → T8 (deploy Vercel + docs + Notion update)

## Notas implementer (ajustes finos a las tasks de tasks.md según B1-B4)

### T1 (ajustar por B1)
- `getRatiosPromedio3Meses()` debe devolver `foodCostPct` y `packagingPct` SEPARADOS, calculando contra subcategoría/etiqueta que distinga PRD-ALI de PRD-PKG.
- Si la conciliación actual no distingue PRD-ALI/PRD-PKG dentro de la categoría agrupada PRODUCTO, el implementer debe primero subdividir la taxonomía en `src/lib/running.ts` (añadir las dos categorías hijas o un campo `subcategoria`) y propagar el cambio donde sea necesario.
- `comisionPonderadaPct` se mantiene calculado igual (ya hay categorías separadas por plataforma).

### T2 (ajustar por B4)
- El payload de `dashboardHandler` debe ser ADITIVO: mantener todos los campos viejos (`fijos_mes`, `pe_mensual`, `pe_diario`, `pe_semanal`, `margen_pct`, `mix`, `presupuestos`, `acumulado_vs_pe`, `por_dia_semana`, etc.) Y sumar los nuevos (`esRentable`, `deltaProyectado`, `diasParaCubrir`, `brutoMesParaCubrirFijos`, `brutoSemanaParaCubrirFijos`, `brutoDiaParaCubrirFijos`, `brutoMesParaGanarObjetivo`, `brutoSemanaParaGanarObjetivo`, `brutoDiaParaGanarObjetivo`, `proyeccionMes`, `margenProyectado`, `mesesUsadosFijos`, `mesesUsadosRatios`).
- Internamente, los campos nuevos se calculan desde Running + getRatiosPromedio3Meses (no desde pe_parametros para los fijos/ratios). Los campos viejos pueden seguir leyendo de pe_parametros (no se rompe nada).

### T5 (ajustar por B3)
- NO crear `src/pages/configuracion/pe-parametros/index.tsx`.
- En su lugar: añadir 6ª sección "PE Parámetros" en `src/pages/Configuracion.tsx`, alineada con las 5 secciones existentes (`plataformas`/`costes`/`proveedores`/`categorias`/`unidades`).
- 5 inputs: `tasa_fiscal_pct`, `objetivo_beneficio_mensual`, `caja_minima_verde`, `caja_minima_ambar`, `iva_pct`. Botón Guardar escribe en pe_parametros.
- Tokens Binagre. Mismo patrón visual que las 5 secciones existentes.

## Bloque B · Mobile housekeeping (ya hecho)
- 6 sub-tareas Notion → RESUELTO con nota de fusión.
- Solo queda la paraguas "Mobile friendly general" ACTIVO MEDIA.

## Bloque C · Deploy diario
- Durante el día: localhost:5173.
- Al cierre: T8 (push master + vercel --prod + git pull).

## Siguiente fix tras este
PE · Aplicar IVAContext (con/sin IVA) — comprobar si el toggle del nuevo Dashboard ya cubre la tarea o queda residual tras T3.
