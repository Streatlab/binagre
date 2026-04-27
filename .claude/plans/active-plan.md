# Active Plan — Sesión 26-abr-2026 (PE Refactor — extensiones)

## Estado previo
T1-T5 cerrados. T-EXT1 a T-EXT4 cerrados. T-EXT5 (validación browser) FALLA con 2 bugs detectados por Rubén.

---

## Bloque T-FIX · Bugs detectados en T-EXT5 validación (PRIORIDAD 1, ARRANCAR YA)

### Bug 1 · Pedidos muestran decimales infinitos
En las 2 KpiCards grandes del Dashboard se ve "19,0000 pedidos/día · 93,0000 pedidos/sem · 403,0000 pedidos/mes". Tienen que ser ENTEROS sin decimales.

### Bug 2 · Ticket medio sospechoso (~24€/pedido)
Con bruto_dia_para_cubrir_fijos = 462€ y pedidos_dia = 19, el ticket medio implícito es 24€/pedido. Ticket típico delivery Streat Lab está en 14-18€. Probablemente `getTicketMedio3Meses` está calculando promedio de promedios mensuales en lugar de Σ bruto / Σ num_pedidos del periodo.

### T-FIX1 · Arreglar formato pedidos a entero en TabDashboard
**Archivo:** `src/pages/finanzas/PuntoEquilibrio.tsx`
**Acción:**
- En las 2 KpiCards grandes ("¿Somos rentables?" y "¿Desde qué día?") la línea de pedidos debe mostrar enteros.
- Si se está usando `fmtNum(valor)` con decimales por defecto, cambiar a `fmtNum(Math.round(valor), 0)` o equivalente que fuerce 0 decimales.
- Alternativa: aplicar `Math.round()` a los 3 valores antes de pasarlos a fmtNum.
- Confirmar visualmente que aparece "19 pedidos/día · 93 pedidos/sem · 403 pedidos/mes" sin coma ni decimales.

### T-FIX2 · Auditar `getTicketMedio3Meses` en peAggregates
**Archivo:** `api/_lib/peAggregates.ts`
**Acción:**
- Verificar que la fórmula es `Σ bruto_total_3m / Σ num_pedidos_3m` y NO `avg(ticket_mes_1, ticket_mes_2, ticket_mes_3)`.
- Si está mal: rehacer función para sumar primero brutos totales y pedidos totales del periodo de 3 meses, dividir al final UNA sola vez.
- Cotejar manualmente con dato real de Facturación. Pedir a la BD: `SELECT SUM(bruto), SUM(num_pedidos) FROM facturacion WHERE fecha BETWEEN '2026-01-01' AND '2026-03-31'` y comprobar que `ticket_medio_eur` del payload coincide con SUM(bruto)/SUM(num_pedidos).
- Si la fuente de num_pedidos no es la correcta (tabla de plataformas vs tabla agregada), elegir la que tenga el dato más fiable. Documentar elección en comentario de código.

### T-FIX3 · Smoke test endpoint
- `curl -s "http://localhost:5173/api/pe/dashboard" | jq '.ticket_medio_eur, .pedidos_mes_para_cubrir_fijos, .pedidos_dia_para_cubrir_fijos'`
- ticket_medio_eur debe estar entre 12 y 22 (rango razonable Streat Lab).
- pedidos_*_para_cubrir_fijos deben ser enteros (sin decimales) en el JSON.

### T-FIX4 · Re-validación browser
- Refrescar `localhost:5173/finanzas/punto-equilibrio` con cache limpia (Cmd+Shift+R / Ctrl+Shift+R).
- Confirmar enteros en las 2 KpiCards.
- Confirmar que ticket medio implícito (bruto_dia / pedidos_dia) está en rango 12-22.

---

## Bloque T-MARCA · Andamiaje PE por marca (PRIORIDAD 2, ESPERAR T-FIX)

(Mantener bloque tal cual estaba, arrancar solo cuando T-FIX esté validado por Rubén en browser.)

### T-MARCA1 · Selector de marca en TabDashboard
- Dropdown "Marca" arriba del Dashboard PE: "Streat Lab (global)" | "Binagre" | "Cocina Carmucha" | resto de marcas activas en tabla `marcas`.
- Default: "Streat Lab (global)".
- Estado en URL query param `?marca=<id|global>`.

### T-MARCA2 · Endpoint dashboard acepta `marca_id`
- `dashboardHandler` acepta query param `marca_id`.
- `marca_id = global` o ausente → comportamiento actual.
- `marca_id = <uuid>` → filtrar `getFijosPromedio3Meses(marca_id)`, `getRatiosPromedio3Meses(marca_id)`, `getTicketMedio3Meses(marca_id)`, bruto mes actual.
- Lectura de `pe_parametros` filtra por `marca_id` si existe registro, si no usa global (`marca_id IS NULL`).

### T-MARCA3 · Reparto de costes compartidos (placeholder)
- En `getFijosPromedio3Meses(marca_id)` con marca != global: sumar PROPORCIÓN de costes compartidos (alquiler, sueldos socios, SS, suministros, gestoría, software) según `bruto_marca / bruto_total` mismas 3 meses.
- Documentar fórmula en comentario.
- Constante en código: lista de categorías "compartidas".

### T-MARCA4 · Validación
- Selector dropdown cambia datos del dashboard.
- "Streat Lab (global)" sigue mostrando lo mismo que antes.
- Marca concreta muestra fijos = compartidos prorrateados + directos imputados (~0 hoy). Bandera "Datos parciales · pendiente propagación de marca_id en gastos".

---

## Bloque T-HIST · Snapshot histórico PE mes a mes (PRIORIDAD 3)

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
- `closeMonthSnapshot(year, month)` calcula valores reales del mes cerrado y guarda fila en `pe_snapshots`.
- Idempotente: si existe (marca_id, periodo_mes) hace UPDATE.
- Disparable manualmente desde admin (botón "Cerrar mes" en `/configuracion` sección "PE Parámetros") y/o cron supabase day-1.
- Genera 1 snapshot global + 1 snapshot por cada marca activa.

### T-HIST3 · Card "Histórico" en TabDashboard
- Debajo de tabla 3×3, card "Cobertura PE últimos 12 meses" con Recharts: barras verticales mes a mes con `cobertura_pct`. Verde >100, ámbar 80-100, rojo <80.
- Paleta CANALES de tokens.
- Filtra por marca si dropdown != global.

### T-HIST4 · Backfill histórico
- Ejecutar `closeMonthSnapshot` para últimos 12 meses cerrados disponibles.

---

## Bloque T-ALERT · Alertas predictivas (PRIORIDAD 4)

### T-ALERT1 · Regla "Por debajo de PE diario X días seguidos"
- `checkPeDiarioAlert()`: si últimos N=3 días bruto real <85% de `bruto_dia_para_cubrir_fijos`, generar alerta.
- Persistir en tabla `alertas` (crear si no existe): tipo, mensaje, fecha, leida, severity.

### T-ALERT2 · UI badge alertas en sidebar
- Badge rojo con número de alertas no leídas.
- Click → `/alertas` con lista.
- Tokens Binagre.

### T-ALERT3 · Notificación Slack (opcional, fase 2)
- Webhook Slack a canal Streat Lab.
- Mensaje: "PE diario: 3 días seguidos por debajo del umbral. Bruto medio últimos 3 días: X€ vs objetivo Y€."
- Configurable on/off desde 6ª sección "PE Parámetros" (campo `alerta_slack_webhook_url` añadido a `pe_parametros`).
- Sin Slack configurado → solo badge sidebar.

### T-ALERT4 · Cron diario
- Disparar `checkPeDiarioAlert()` cada día 23:00.
- Disparable manualmente desde admin.

---

## Orden de ejecución
1. **T-FIX1 a T-FIX4** ARRANCAR YA (corrige T-EXT5 fallido).
2. T-MARCA1 a T-MARCA4 cuando Rubén valide T-FIX en browser.
3. T-HIST1 a T-HIST4.
4. T-ALERT1 a T-ALERT4.

Si Code se queda sin contexto entre bloques, parar después de T-FIX4 y validar antes de seguir.

---

## NO hacer en esta iteración
- NO commit + push + vercel hasta cierre del día (deploy diario).
- NO tocar Conciliación / Bancos / Bloque B del otro chat.
- NO romper aditividad B4: campos viejos del payload siguen vivos.
- NO eliminar columnas viejas de `pe_parametros` (deuda histórica, fix posterior).

## Reglas inmutables
- Tokens Binagre desde `src/styles/tokens.ts`. Locale es_ES vía `fmtEur`/`fmtNum`.
- Aislamiento absoluto Binagre ↔ David.
- Trabajamos contra `localhost:5173`. Vercel solo al cierre del día.
