# Active Plan — Sesión 26-abr-2026

## Bloque A · PE Refactor (PRINCIPAL)
**PE Refactor · Dashboard responde 4 preguntas con datos reales Running** — eliminar dependencia de pe_parametros como fuente de fijos/variables, eliminar tab Configuración (21 inputs manuales), eliminar 2 KPIs duplicados, sustituir por tabla 3×3 (MES/SEMANA-5d/DÍA-5d/sem) y 2 KPIs principales (¿Somos rentables? · ¿Desde qué día?). Crear página global `/configuracion/pe-parametros` para los 5 valores que sí siguen siendo manuales.

## Decisiones de negocio (cerradas con Rubén 26-abr-2026)
1. Cierre 2 días variados/semana → 5 días operativos/sem, ~22 días operativos/mes
2. Fuente fijos: Running, promedio 3 últimos meses cerrados
3. Fuente variables (food cost / packaging / comisiones): Presupuestos + reales 3 últimos meses cerrados
4. Tab Configuración del módulo PE → ELIMINAR
5. 5 parámetros que sí siguen manuales (tasa fiscal, objetivo neto, caja verde/ámbar, iva ventas) → mover a página global `/configuracion/pe-parametros`
6. Mobile friendly se queda como UNA tarea paraguas global, no por módulo
7. Deploy a Vercel UNA vez al día al cierre. Durante la sesión se trabaja contra `localhost:5173`.

## Estado pipeline
1. ✅ `pm-spec` → `.claude/plans/spec.md` (CA-1 a CA-7 + bloques B/C)
2. ✅ tasks → `.claude/plans/tasks.md` (T1-T8)
3. ⏳ `implementer` (en local Rubén) → ejecutar T1 + T2 + T3 + T4 + T5
4. ⏳ `qa-reviewer` (en local) → T6 contra `localhost:5173`
5. ⏳ housekeeping Notion (lo hago yo desde aquí) → T7
6. ⏳ cierre del día → T8 (deploy Vercel + docs + Notion update)

## Bloque B · Mobile housekeeping
**Acción inmediata (yo, ahora):** eliminar las 6 sub-tareas mobile en Notion, dejar solo la paraguas "Mobile friendly general".

## Bloque C · Deploy diario
- Durante el día: localhost:5173.
- Al cierre: T8 (push master + vercel --prod + git pull).

## Fixes Notion afectados (a actualizar al cierre tras QA)
- PE · UI Configuración FISCAL Y UMBRALES → RESUELTO (sustituido por T5 página global)
- PE · Migración SQL pe_parametros (5 campos) → ALTA, prerrequisito de T5
- PE · Parametrizar tasa fiscal /0.75, objetivo beneficio, umbrales caja → cubiertos por T5 una vez SQL aplicada
- PE · Caja real desde CashflowRealCard → independiente
- PE · Proyección mes ajustada por DOW → consumido por T2 (`proyeccionMes`)
- PE · Aplicar kit visual Binagre completo → cubierto por T3
- PE · Añadir gráficos Recharts → mantenidos en Dashboard tras T3
- PE · Unificar taxonomía con Running → cubierto por T1 (consume CATEGORIAS_ORDEN)
- Mobile friendly · 6 sub-tareas → eliminar/fusionar (T7)

## Siguiente fix tras este
PE · Aplicar IVAContext (con/sin IVA) — comprobar si el toggle del nuevo Dashboard ya cubre la tarea o queda residual tras T3.
