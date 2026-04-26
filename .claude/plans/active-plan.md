# Active Plan — Sesión 26-abr-2026 (PE Refactor — extensiones)

## Estado previo
T1-T5 cerrados por Code: peAggregates, dashboardHandler aditivo, TabDashboard nuevo, eliminación TabConfig, 6ª sección PE Parámetros. AHORA toca extender con 4 bloques nuevos antes de validar.

---

## Bloque T-EXT · Mostrar nº pedidos en cards grandes (PRIORIDAD 1)

Las 2 cards grandes superiores del Dashboard deben mostrar, además del SÍ/NO y "Día X", **el número de pedidos** que hacen falta para cubrir fijos al MES, SEMANA (5d), DÍA (5d/sem). Cálculo: `pedidos = ceil(bruto / ticket_medio)`.

### T-EXT1 · Localizar fuente de ticket medio existente
- Buscar en `api/_lib/` o `src/lib/` función que calcule ticket medio (`Σ bruto / Σ num_pedidos`).
- Priorizar versión de ventana 3 meses cerrados (coincide con PE refactor).
- Si NO existe, crear `getTicketMedio3Meses()` en `api/_lib/peAggregates.ts` siguiendo patrón de `getFijosPromedio3Meses` y `getRatiosPromedio3Meses`. Calcular como `Σ bruto ventas 3 meses cerrados / Σ num_pedidos 3 meses cerrados`.

### T-EXT2 · Extender payload dashboardHandler (aditivo B4)
Añadir al payload sin tocar campos viejos:
- `ticket_medio_eur`
- `pedidos_mes_para_cubrir_fijos = ceil(bruto_mes_para_cubrir_fijos / ticket_medio_eur)`
- `pedidos_semana_para_cubrir_fijos = ceil(bruto_semana_para_cubrir_fijos / ticket_medio_eur)`
- `pedidos_dia_para_cubrir_fijos = ceil(bruto_dia_para_cubrir_fijos / ticket_medio_eur)`
- `pedidos_mes_para_ganar_objetivo`, `pedidos_semana_para_ganar_objetivo`, `pedidos_dia_para_ganar_objetivo` (mismas fórmulas con `bruto_*_para_ganar_objetivo`).

### T-EXT3 · Mostrar pedidos en TabDashboard
- Card "¿SOMOS RENTABLES?": debajo del SÍ/NO + delta €, añadir línea pequeña: "X pedidos/día · Y pedidos/sem · Z pedidos/mes para cubrir fijos".
- Card "¿DESDE QUÉ DÍA?": debajo del "Día X" o "Día 36 · faltan Y€", misma línea con pedidos.
- Tokens Binagre. fmtNum (sin €) para enteros. Etiqueta clara "pedidos".
- Si `ticket_medio_eur` es 0 o null, OCULTAR la línea de pedidos (no mostrar "Infinity" ni "NaN").

### T-EXT4 · Type check + smoke test
- `npx tsc --no-emit` → cero errores.
- `curl -s "http://localhost:5173/api/pe/dashboard" | jq '.ticket_medio_eur, .pedidos_mes_para_cubrir_fijos, .pedidos_dia_para_cubrir_fijos'` → 3 valores numéricos.

### T-EXT5 · Validación manual en localhost:5173/finanzas/punto-equilibrio
- 2 cards grandes con línea de pedidos visible.
- Tab Configuración no existe.
- Toggle Sin/Con IVA cambia importes y pedidos.
- `/configuracion` → 6ª sección "PE Parámetros" funciona.

---

## Bloque T-MARCA · Andamiaje PE por marca (PRIORIDAD 2)

**Decisión Rubén 26-abr 16:30:** la propagación de `marca_id` en facturas/conciliación llegará en próximas semanas. Montamos AHORA el andamiaje del PE por marca para que cuando llegue el dato funcione sin reescribir nada.

### T-MARCA1 · Selector de marca en TabDashboard
- Añadir dropdown "Marca" arriba del Dashboard PE con opciones: "Streat Lab (global)" | "Binagre" | "Cocina Carmucha" | (resto de marcas activas en tabla `marcas`).
- Default: "Streat Lab (global)" (= sin filtro, comportamiento actual).
- Estado del dropdown vive en URL query param `?marca=<id|global>` para que sea compartible.

### T-MARCA2 · Endpoint dashboard acepta `marca_id`
- `dashboardHandler` acepta query param `marca_id`.
- Si `marca_id = global` o ausente → comportamiento actual (todos los datos).
- Si `marca_id = <uuid>` → filtrar:
  - `getFijosPromedio3Meses(marca_id)` → fijos imputables a esa marca. Hoy devolverá 0 o muy poco porque conciliación no tiene `marca_id` propagado: ESTO ES ESPERADO. Mostrar fallback "Aún no hay costes imputados a esta marca" en el frontend.
  - `getRatiosPromedio3Meses(marca_id)` → ratios food/packaging/comisión sobre ventas de esa marca (facturación SÍ tiene `marca_id` por canal, así que esto sí debería funcionar parcialmente).
  - `getTicketMedio3Meses(marca_id)` → ticket medio de la marca.
  - Bruto mes actual filtrado por `marca_id`.
- Lectura de `pe_parametros` también filtra por `marca_id` si existe registro para esa marca, si no usa el global (`marca_id IS NULL`).

### T-MARCA3 · Reparto de costes compartidos (placeholder)
- En `getFijosPromedio3Meses(marca_id)`, si `marca_id != global`, además de los costes con `marca_id` propagado, sumar PROPORCIÓN de costes compartidos (alquiler, sueldos socios, SS, suministros) según peso de bruto de esa marca sobre bruto total mismas 3 meses.
- Documentar fórmula en comentario del código: `costes_compartidos × (bruto_marca / bruto_total)`.
- Esto da resultado coherente desde el primer día aunque no haya `marca_id` propagado en gastos directos.
- Constante en código: lista de categorías "compartidas" (alquiler, sueldos socios, SS, suministros, gestoría, software). El resto se considera directo (si tiene marca_id propagado) o ruido (si no).

### T-MARCA4 · Validación
- Selector dropdown cambia datos del dashboard al elegir marca.
- "Streat Lab (global)" sigue mostrando lo mismo que antes del cambio.
- Una marca concreta muestra fijos = compartidos prorrateados + directos imputados (hoy ~0). Mostrar bandera "Datos parciales · pendiente propagación de marca_id en gastos".

---

## Bloque T-HIST · Snapshot histórico PE mes a mes (PRIORIDAD 3)

Hoy PE solo enseña mes en curso. Sin histórico no puedes ver si mejoras o empeoras. Snapshot mensual day-1.

### T-HIST1 · Tabla `pe_snapshots` en Supabase
Crear migración con tabla nueva:
```
pe_snapshots(
  id uuid pk,
  marca_id uuid null,           -- null = global
  periodo_mes date,             -- primer día del mes que se cierra (ej. 2026-04-01)
  fijos_mes numeric,
  bruto_real_mes numeric,
  bruto_mes_para_cubrir_fijos numeric,
  margen_bruto_pct numeric,
  margen_neto_eur numeric,
  cobertura_pct numeric,        -- bruto_real / bruto_para_cubrir_fijos
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

### T-HIST2 · Cron / función de cierre mensual
- Función `closeMonthSnapshot(year, month)` que calcula valores reales del mes cerrado y los guarda como fila nueva en `pe_snapshots`.
- Idempotente: si ya existe fila para ese (marca_id, periodo_mes) hace UPDATE.
- Disparable manualmente desde admin (botón "Cerrar mes" en `/configuracion` sección "PE Parámetros") y/o cron supabase day-1 cada mes.
- Genera 1 snapshot global + 1 snapshot por cada marca activa (preparado para cuando T-MARCA dé datos por marca).

### T-HIST3 · Card "Histórico" en TabDashboard
- Debajo de tabla 3×3, añadir card "Cobertura PE últimos 12 meses" con gráfico Recharts: barras verticales mes a mes con `cobertura_pct`. Color verde >100, ámbar 80-100, rojo <80.
- Reutilizar paleta CANALES de tokens.
- Si la marca seleccionada en dropdown es != global, filtrar por esa marca.

### T-HIST4 · Backfill histórico
- Ejecutar `closeMonthSnapshot` para los últimos 12 meses cerrados disponibles en Conciliación + Facturación.
- Esto genera la curva inicial sin tener que esperar 12 meses.

---

## Bloque T-ALERT · Alertas predictivas (PRIORIDAD 4)

**Decisión Rubén 26-abr 16:30:** entra al ERP con frecuencia variable. Alertas SÍ cuando algo se desvía claramente.

### T-ALERT1 · Regla "Por debajo de PE diario X días seguidos"
- Función `checkPeDiarioAlert()`: si los últimos N=3 días consecutivos el bruto real ha estado <85% del `bruto_dia_para_cubrir_fijos`, generar alerta.
- Alerta se persiste en tabla `alertas` (crear si no existe) con: tipo, mensaje, fecha, leida, severity.

### T-ALERT2 · UI badge alertas en sidebar
- Sidebar global muestra badge rojo con número de alertas no leídas.
- Click → modal/página `/alertas` con lista.
- Tokens Binagre.

### T-ALERT3 · Notificación Slack (opcional, fase 2)
- Webhook Slack a canal Streat Lab.
- Mensaje: "PE diario: 3 días seguidos por debajo del umbral. Bruto medio últimos 3 días: X€ vs objetivo Y€."
- Configurable on/off desde 6ª sección "PE Parámetros" (campo `alerta_slack_webhook_url` añadido a `pe_parametros`).
- Sin Slack configurado → solo badge sidebar, no falla.

### T-ALERT4 · Cron diario
- Disparar `checkPeDiarioAlert()` cada día 23:00.
- Disparable manualmente desde admin para testeo.

---

## Orden de ejecución
1. **T-EXT1 a T-EXT5** primero (es el quick win visual sobre lo que Rubén ve hoy).
2. **T-MARCA1 a T-MARCA4** segundo (andamiaje, no bloquea uso actual).
3. **T-HIST1 a T-HIST4** tercero (necesita backfill de datos pasados, ejecución más larga).
4. **T-ALERT1 a T-ALERT4** cuarto (depende de T-HIST? no, pero es el más periférico).

Si Code se queda sin contexto entre bloques, parar después de T-EXT5 y validar antes de seguir con T-MARCA.

---

## NO hacer en esta iteración
- NO commit + push + vercel hasta cierre del día (deploy diario).
- NO tocar Conciliación / Bancos / Bloque B del otro chat.
- NO romper aditividad B4: todos los campos viejos del payload siguen vivos.
- NO eliminar columnas viejas de `pe_parametros` (deuda histórica, fix posterior).

## Reglas inmutables
- Tokens Binagre desde `src/styles/tokens.ts`. Locale es_ES vía `fmtEur`/`fmtNum`.
- Aislamiento absoluto Binagre ↔ David.
- Trabajamos contra `localhost:5173`. Vercel solo al cierre del día.
