# ADENDA Bloque 1 — Calendario operativo

## Contexto
Streat Lab no opera 7 días/semana fijos. Algunas semanas cierra 2 días, otras 1, otras ninguno. Los cálculos hardcoded a "5 días operativos/22 al mes" están mal y deben sustituirse por un calendario operativo configurable.

## Cambios al Bloque 1

### Configuración · nuevo tab "Calendario operativo"
1. Vista calendario mensual navegable (mes anterior, actual, futuro hasta fin de año + año siguiente)
2. Click en día para asignar tipo
3. Tipos de día:
   - **Operativo** (default): comida + cena
   - **Solo comida** (cierra noche)
   - **Solo cena** (cierra mediodía)
   - **Cerrado total**
   - **Festivo** (cerrado por festivo nacional/local)
   - **Vacaciones** (cerrado por descanso)
4. Bulk operations: marcar rango (ej: "del 5 al 12 agosto vacaciones")
5. Persistir en BD tabla `calendario_operativo (fecha, tipo, nota)`

### Impacto en módulos

**PE · todos los KPIs**
- "Días operativos del mes" lee de calendario, no asume 22
- "Pedidos/día necesarios para cubrir fijos" = fijos / (ingresos_objetivo / días_operativos_reales_mes)
- "¿Qué día cubrimos fijos?" salta días cerrados al acumular
- Card "Día semana" excluye días cerrados de la media

**Facturación · Objetivos por día**
- Día cerrado → mostrar "CERRADO" en vez de €
- Recalcular objetivo semanal proporcional (si la semana tiene 2 cerrados, objetivo semanal = objetivo_mensual / días_operativos_mes × 5)

**Running · medias**
- Media diaria = total / días_operativos_reales (no días naturales)
- Comparativa vs año anterior: ajustar por días operativos comparables

**Panel Global · Cards**
- "Faltan X€ de Y€" debe considerar solo días operativos restantes
- Card "Días pico" excluye días cerrados

**Objetivos · histórico cumplimiento**
- % real / objetivo se ajusta según días operativos reales del periodo

### Avisos automáticos
- Si calendario futuro tiene N días cerrados (vacaciones), recalcular objetivos semanales/mensuales y avisar en Objetivos: "Esta semana hay X días cerrados, objetivo ajustado a Y€"
- Si día actual es CERRADO, ocultar/grisar el "Objetivo de hoy" en cards

## Migración
1. Crear tabla `calendario_operativo` con todos los días del año actual marcados como Operativo por defecto
2. Después Rubén configura manualmente los días cerrados pasados (para corregir cálculos históricos) y futuros (vacaciones planificadas)
