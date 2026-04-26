# Active Plan

## Fix actual
**PE Refactor · Dashboard responde 4 preguntas con datos reales Running** — eliminar dependencia de pe_parametros como fuente de fijos/variables, eliminar tab Configuración (21 inputs manuales), eliminar 2 KPIs duplicados, sustituir por tabla 3×3 (MES/SEMANA-5d/DÍA-5d/sem) y 2 KPIs principales (¿Somos rentables? · ¿Desde qué día?).

## Decisión de negocio (cerrada con Rubén 26-abr-2026)
1. Cierre 2 días variados/semana → 5 días operativos/sem, ~22 días operativos/mes
2. Fuente fijos: Running, promedio 3 últimos meses cerrados
3. Fuente variables (food cost / packaging / comisiones): Presupuestos + reales 3 últimos meses cerrados
4. Tab Configuración del módulo PE → ELIMINAR
5. 5 parámetros que sí siguen siendo manuales (tasa fiscal, objetivo neto, caja verde/ámbar, iva ventas) → mover a página global `/configuracion/pe-parametros`

## Estado pipeline
1. ✅ `pm-spec` → `.claude/plans/spec.md` (CA-1 a CA-7)
2. ✅ tasks → `.claude/plans/tasks.md` (T1-T6)
3. ⏳ `implementer` → ejecutar T1 + T2 + T3 + T4 + T5
4. ⏳ `qa-reviewer` → T6
5. ⏳ cierre git+vercel → T6

## Siguiente fix tras este
PE · Aplicar IVAContext (con/sin IVA) — ya existe como tarea EN_CURSO en Notion. Tras refactor, comprobar si el toggle del nuevo Dashboard ya cubre la tarea o queda residual.

## Fixes Notion afectados
- PE · UI Configuración FISCAL Y UMBRALES → quedará RESUELTO (sustituido por T5: página global pe-parametros).
- PE · Migración SQL pe_parametros (5 campos) → sigue ALTA, necesario para que T5 funcione.
- PE · Parametrizar tasa fiscal /0.75, objetivo beneficio, umbrales caja → cubiertos por T5 una vez la migración SQL esté aplicada.
- PE · Caja real desde CashflowRealCard → independiente, no afectado.
- PE · Proyección mes ajustada por DOW → consumido por T2 al calcular `proyeccionMes`.
- PE · Aplicar kit visual Binagre completo → cubierto por T3.
- PE · Añadir gráficos Recharts → mantenidos en Dashboard tras T3.
- PE · Unificar taxonomía con Running → cubierto por T1 (consume CATEGORIAS_ORDEN).
