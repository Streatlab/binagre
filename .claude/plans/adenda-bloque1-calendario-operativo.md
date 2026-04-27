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

---

## Cierre PM-Spec adenda — 2026-04-27

Huecos cerrados autónomamente (RULES.md §8 y §9). Ninguno afecta lógica de negocio crítica ni borra datos.

### 1. Esquema exacto tabla `calendario_operativo`
```sql
CREATE TABLE calendario_operativo (
  id    uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha date    NOT NULL UNIQUE,
  tipo  text    NOT NULL DEFAULT 'operativo'
                CHECK (tipo IN ('operativo','solo_comida','solo_cena','cerrado','festivo','vacaciones')),
  nota  text
);
CREATE INDEX idx_calendario_fecha ON calendario_operativo (fecha);
```
Justificación: `date UNIQUE` garantiza exactamente una fila por día. El índice en `fecha` cubre todos los lookups por rango. No se usa enum PG para facilitar futuros cambios de valor sin migración de tipo.

### 2. Valores canónicos del campo `tipo`
| Valor en BD    | Label UI        | ¿Operativo? |
|----------------|-----------------|-------------|
| `operativo`    | Operativo       | Sí (completo) |
| `solo_comida`  | Solo comida     | Sí (cuenta 1) |
| `solo_cena`    | Solo cena       | Sí (cuenta 1) |
| `cerrado`      | Cerrado         | No |
| `festivo`      | Festivo         | No |
| `vacaciones`   | Vacaciones      | No |

Festivo y Vacaciones son semánticamente distintos (origen externo vs decisión interna) pero se tratan igual a efectos de cálculo: excluidos de días operativos.

### 3. Bulk operations — flujo UI
Botón "Marcar rango" (bg `#e8f442`, texto `#111111`) dentro del tab Calendario Operativo en Configuración. Al pulsar: modal (`backgroundColor:'#1a1a1a'`) con:
- Date picker "Desde" / "Hasta"
- Selector tipo (los 6 valores)
- Campo nota opcional
- Botón "Aplicar" (bg `#B01D23`) ejecuta upsert sobre todas las fechas del rango.

### 4. Días "Solo comida" / "Solo cena" — peso en cálculos
Cuentan como **1 día operativo completo**. Justificación: el negocio opera y factura; el PE y las medias no deben distorsionarse por servicios parciales. Solo `cerrado`, `festivo` y `vacaciones` se excluyen.

Query estándar para días operativos del mes:
```sql
SELECT COUNT(*) FROM calendario_operativo
WHERE fecha >= date_trunc('month', $1)
  AND fecha <  date_trunc('month', $1) + interval '1 month'
  AND tipo NOT IN ('cerrado','festivo','vacaciones');
```

### 5. Avisos automáticos — ubicación exacta
- **Objetivos (tabla semanal):** banner amarillo `#e8f442` / texto `#111111` encima de la tabla, visible solo si hay ≥1 día cerrado en la semana que se está mostrando. Texto: "Esta semana hay X día(s) cerrado(s), objetivo ajustado a Y€".
- **Card "Objetivo de hoy" (Panel Global / Facturación):** si `tipo IN ('cerrado','festivo','vacaciones')`, mostrar pill "CERRADO" en `#B01D23` y ocultar el importe objetivo. Si `tipo IN ('solo_comida','solo_cena')`, mostrar el objetivo normal con badge "ALM" o "CENA" según corresponda.

### 6. Migración inicial — rango y script
- Insertar filas para **01-01-2026 al 31-12-2027** (año en curso + siguiente), todas con `tipo = 'operativo'`.
- Script idempotente con `ON CONFLICT (fecha) DO NOTHING` — se puede ejecutar varias veces sin duplicar.
- Backup previo no aplica (tabla nueva, no hay datos que perder).

### 7. Fechas históricas sin fila en `calendario_operativo`
Si una fecha anterior no tiene fila (periodo antes del 01-01-2026), el sistema asume `'operativo'`. Todos los queries que consultan el calendario usan:
```sql
COALESCE(
  (SELECT tipo FROM calendario_operativo WHERE fecha = d),
  'operativo'
)
```
Esto garantiza que el histórico de facturación existente no se rompa por ausencia de datos en la tabla nueva.
