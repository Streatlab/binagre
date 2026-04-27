# Active Plan — Sesión 26-abr-2026 (PE Refactor — extensiones)

## Estado previo
T1-T5 cerrados. T-EXT1-4 cerrados. T-FIX1 (decimales) OK. T-FIX2 cerrado sin cambios. Pedidos enteros validados en browser.

---

## Bloque T-HORIZONTE · Selector de horizonte temporal en Dashboard (PRIORIDAD 1, ARRANCAR YA)

### Contexto / Decisión Rubén 26-abr 17:30
Las 2 KpiCards "¿Somos rentables?" y "¿Desde qué día?" hoy solo responden para el mes en curso. Hace falta un selector que permita elegir el horizonte temporal y ver si somos rentables / cuándo cubrimos en distintas ventanas.

### Opciones del selector
- Mes actual (default, comportamiento actual)
- Mes anterior (cerrado, ya conocido al 100%)
- Próximo mes (proyección a futuro)
- Próximos 3 meses (proyección agregada)
- Próximos 6 meses
- Próximo año (12 meses)

### T-HOR1 · Selector UI en TabDashboard
**Archivo:** `src/pages/finanzas/PuntoEquilibrio.tsx`
**Acción:**
- Añadir dropdown "Horizonte" justo encima de las 2 KpiCards grandes (alineado a la derecha del título de la sección "¿Somos rentables?" / "¿Desde qué día?", o en una barra propia tipo segmented control).
- Opciones con etiqueta clara: "Mes actual" | "Mes anterior" | "Próximo mes" | "Próximos 3 meses" | "Próximos 6 meses" | "Próximo año".
- Estado en URL query param `?horizonte=<actual|anterior|proximo|3m|6m|12m>` para compartibilidad.
- Default: "actual" (= comportamiento actual sin filtro).
- Tokens Binagre. Estilo coherente con toggle Sin/Con IVA que ya existe.

### T-HOR2 · Endpoint dashboardHandler acepta `horizonte`
**Archivo:** `api/pe/_handlers.ts` y `api/_lib/peAggregates.ts`
**Acción:**
- `dashboardHandler` acepta query param `horizonte`.
- Lógica de cálculo según valor:
  - **`actual`** → comportamiento actual: bruto acumulado mes en curso + proyección DOW resto del mes; fijos del mes actual.
  - **`anterior`** → mes pasado cerrado: bruto real total del mes anterior (sin proyección); fijos reales de ese mes (no promedio 3m, sino el dato del propio mes). `esRentable` = bruto×margen − fijos > 0.
  - **`proximo`** → mes que viene: proyección basada en tendencia últimos 3 meses cerrados (media o regresión simple, decisión libre del implementer documentada en comentario). Fijos = promedio 3m (mismos que comportamiento actual).
  - **`3m` / `6m` / `12m`** → suma de N proyecciones mensuales adelante. `esRentable_acumulado` = (Σ bruto_proyectado × margen − Σ fijos_proyectados) > 0. `bruto_para_cubrir_fijos` se calcula sobre el agregado del periodo.
- `diasParaCubrir` se reinterpreta según horizonte: para `actual`/`anterior` es día del mes; para `proximo+` es nº de días desde inicio del horizonte hasta cubrir fijos acumulados.
- Mantener aditividad B4: cuando no se pasa `horizonte`, devolver lo mismo que ahora.

### T-HOR3 · Etiquetas dinámicas en KpiCards
- "¿Somos rentables ESTE MES?" → "¿Somos rentables [horizonte_label]?" donde `horizonte_label` cambia según selector: "este mes", "el mes pasado", "el mes que viene", "en los próximos 3 meses", etc.
- "¿Desde qué día cubrimos gastos?" → para horizontes >1 mes cambia a "¿Cuántos días para cubrir gastos?" mostrando el número total de días desde inicio del horizonte.
- Pedidos por día/sem/mes deben recalcular sobre el horizonte seleccionado para que sean coherentes.

### T-HOR4 · Validación browser
- Refrescar localhost con Ctrl+Shift+R.
- Probar los 6 valores del selector y confirmar que las cards cambian.
- "Mes anterior" debe coincidir con el dato real cerrado del mes pasado (cotejar manualmente con Conciliación / Facturación).
- "Próximos 3 meses" debe dar un número 3× el mensual aproximado.

---

## Bloque T-MARCA · Andamiaje PE por marca (DESPUÉS de T-HORIZONTE)

### T-MARCA1 · Selector de marca
- Dropdown "Marca" arriba del Dashboard PE: "Streat Lab (global)" | "Binagre" | "Cocina Carmucha" | resto de marcas activas.
- Default: "Streat Lab (global)".
- Estado en URL query param `?marca=<id|global>`.
- T-MARCA y T-HORIZONTE deben coexistir en la misma URL: `?horizonte=3m&marca=binagre`.

### T-MARCA2 · Endpoint acepta `marca_id`
- `dashboardHandler` acepta `marca_id` además de `horizonte`.
- `marca_id = global` o ausente → comportamiento actual (todos los datos).
- `marca_id = <uuid>` → filtrar `getFijosPromedio3Meses(marca_id)`, `getRatiosPromedio3Meses(marca_id)`, `getTicketMedio3Meses(marca_id)`, bruto en `facturacion_diario`.
- `pe_parametros` filtra por `marca_id` si existe registro, si no usa global.

### T-MARCA3 · Reparto de costes compartidos (placeholder)
- Si `marca_id != global`: además de costes con `marca_id` propagado, sumar PROPORCIÓN de costes compartidos (alquiler, sueldos socios, SS, suministros, gestoría, software) según `bruto_marca / bruto_total` mismas 3 meses.
- Constante en código con lista de categorías "compartidas".
- Comentario en código: `costes_compartidos × (bruto_marca / bruto_total)`.

### T-MARCA4 · Validación
- Selector cambia datos del dashboard.
- "Streat Lab (global)" muestra lo mismo que antes.
- Marca concreta muestra fijos = compartidos prorrateados + directos imputados (~0). Bandera "Datos parciales · pendiente propagación de marca_id en gastos".

---

## Bloque T-HIST · Snapshot histórico PE mes a mes

### T-HIST1 · Tabla `pe_snapshots` en Supabase
```
pe_snapshots(
  id uuid pk,
  marca_id uuid null,
  periodo_mes date,
  fijos_mes numeric,
  bruto_real_mes numeric,
  bruto_mes_para_cubrir_fijos numeric,
  margen_bruto_pct numeric,
  margen_neto_eur numeric,
  cobertura_pct numeric,
  dia_cubre_fijos integer null,
  ticket_medio_eur numeric,
  num_pedidos integer,
  food_cost_pct numeric,
  packaging_pct numeric,
  comision_ponderada_pct numeric,
  created_at timestamptz default now(),
  unique(marca_id, periodo_mes)
)
```

### T-HIST2 · Función de cierre mensual
- `closeMonthSnapshot(year, month)` calcula valores reales del mes cerrado y guarda fila.
- Idempotente: UPDATE si existe (marca_id, periodo_mes).
- Disparable manualmente desde admin (botón "Cerrar mes" en sección "PE Parámetros") y/o cron day-1.
- Genera 1 snapshot global + 1 snapshot por cada marca activa.

### T-HIST3 · Card "Histórico" en TabDashboard
- Debajo de tabla 3×3, card "Cobertura PE últimos 12 meses": barras verticales mes a mes con `cobertura_pct`. Verde >100, ámbar 80-100, rojo <80.
- Paleta CANALES.
- Filtra por marca si dropdown != global.

### T-HIST4 · Backfill histórico
- Ejecutar `closeMonthSnapshot` para últimos 12 meses cerrados.

---

## Bloque T-ALERT · Alertas predictivas

### T-ALERT1 · Regla
- `checkPeDiarioAlert()`: si últimos N=3 días bruto real <85% de `bruto_dia_para_cubrir_fijos`, generar alerta.
- Persistir en tabla `alertas` (crear): tipo, mensaje, fecha, leida, severity.

### T-ALERT2 · Badge sidebar
- Badge rojo con nº alertas no leídas. Click → `/alertas`.

### T-ALERT3 · Slack (fase 2)
- Webhook configurable on/off desde sección "PE Parámetros".

### T-ALERT4 · Cron diario
- Disparar `checkPeDiarioAlert()` cada día 23:00.

---

## Orden de ejecución
1. ✅ T-FIX1, T-FIX2.
2. ⏳ **T-HOR1 a T-HOR4** ARRANCAR YA.
3. ⏳ T-MARCA1 a T-MARCA4 (después de validar T-HOR).
4. ⏳ T-HIST1 a T-HIST4.
5. ⏳ T-ALERT1 a T-ALERT4.

---

## NO hacer
- NO commit + push + vercel hasta cierre del día.
- NO tocar Conciliación / Bancos / Bloque B del otro chat.
- NO romper aditividad B4.
- NO eliminar columnas viejas de `pe_parametros`.

## Reglas
- Tokens Binagre desde `src/styles/tokens.ts`. Locale es_ES vía `fmtEur`/`fmtNum`.
- Aislamiento absoluto Binagre ↔ David.
- Trabajamos contra `localhost:5173`. Vercel solo al cierre del día.
- Antes de proponer fórmulas o validaciones que dependan de cifras de negocio, consultar dato real en Supabase. NO usar suposiciones.
