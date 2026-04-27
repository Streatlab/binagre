# Active Plan — Sesión 26-abr-2026 (PE Refactor — extensiones)

## Estado previo
T1-T5 cerrados. T-EXT1-4 cerrados. T-FIX1 (decimales) OK. T-FIX2 cerrado: NO ERA BUG.

---

## T-FIX cerrado · ticket medio NO es bug

### Datos reales verificados en Supabase (facturacion_diario, ene-mar 2026):
- Total: 1.463 pedidos, 36.929€ bruto, ticket medio 25,24€ (con IVA) / 22,95€ (sin IVA)
- Uber: 28,20€ con IVA · 25,64€ sin IVA
- Glovo: 27,56€ con IVA · 25,05€ sin IVA
- Just Eat: 38,00€ con IVA · 34,55€ sin IVA

**Conclusión:** el cálculo `Σ bruto / Σ num_pedidos` que devuelve `getTicketMedio3Meses()` es CORRECTO. La suposición previa de "14-18€" estaba mal y se descarta. T-FIX2A NO se ejecuta.

**T-FIX2 → CERRADO sin cambios de código.**

### T-FIX1 → ya implementado (decimales fijados a entero en TabDashboard).

### Siguiente paso para Rubén
- Refrescar `localhost:5173/finanzas/punto-equilibrio` con Ctrl+Shift+R.
- Confirmar visualmente: pedidos como enteros (sin decimales) en las 2 KpiCards.
- Si OK → arrancar T-MARCA1.

---

## Bloque T-MARCA · Andamiaje PE por marca (ARRANCAR cuando T-FIX1 validado en browser)

### T-MARCA1 · Selector de marca en TabDashboard
- Dropdown "Marca" arriba del Dashboard PE: "Streat Lab (global)" | "Binagre" | "Cocina Carmucha" | resto de marcas activas en tabla `marcas`.
- Default: "Streat Lab (global)" (= sin filtro, comportamiento actual).
- Estado en URL query param `?marca=<id|global>` para que sea compartible.

### T-MARCA2 · Endpoint dashboard acepta `marca_id`
- `dashboardHandler` acepta query param `marca_id`.
- `marca_id = global` o ausente → comportamiento actual.
- `marca_id = <uuid>` → filtrar:
  - `getFijosPromedio3Meses(marca_id)` → fijos imputables a esa marca.
  - `getRatiosPromedio3Meses(marca_id)` → ratios food/packaging/comisión sobre ventas de esa marca.
  - `getTicketMedio3Meses(marca_id)` → ticket medio de la marca.
  - Bruto mes actual filtrado por `marca_id` en `facturacion_diario`.
- Lectura de `pe_parametros` filtra por `marca_id` si existe registro, si no usa global (`marca_id IS NULL`).

### T-MARCA3 · Reparto de costes compartidos (placeholder)
- En `getFijosPromedio3Meses(marca_id)` con marca != global: además de costes con `marca_id` propagado, sumar PROPORCIÓN de costes compartidos (alquiler, sueldos socios, SS, suministros, gestoría, software) según `bruto_marca / bruto_total` mismas 3 meses.
- Documentar fórmula en comentario: `costes_compartidos × (bruto_marca / bruto_total)`.
- Constante en código con la lista de categorías "compartidas".
- Esto da resultado coherente desde día 1 aunque no haya `marca_id` propagado en gastos directos.

### T-MARCA4 · Validación
- Selector dropdown cambia datos del dashboard al elegir marca.
- "Streat Lab (global)" sigue mostrando lo mismo que antes del cambio.
- Una marca concreta muestra fijos = compartidos prorrateados + directos imputados (hoy ~0). Bandera "Datos parciales · pendiente propagación de marca_id en gastos".

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
- `closeMonthSnapshot(year, month)` calcula valores reales del mes cerrado y guarda fila en `pe_snapshots`.
- Idempotente: UPDATE si existe (marca_id, periodo_mes).
- Disparable manualmente desde admin (botón "Cerrar mes" en `/configuracion` sección "PE Parámetros") y/o cron supabase day-1.
- Genera 1 snapshot global + 1 snapshot por cada marca activa.

### T-HIST3 · Card "Histórico" en TabDashboard
- Debajo de tabla 3×3, card "Cobertura PE últimos 12 meses" con Recharts: barras verticales mes a mes con `cobertura_pct`. Verde >100, ámbar 80-100, rojo <80.
- Paleta CANALES de tokens.
- Filtra por marca si dropdown != global.

### T-HIST4 · Backfill histórico
- Ejecutar `closeMonthSnapshot` para últimos 12 meses cerrados disponibles en Conciliación + Facturación.

---

## Bloque T-ALERT · Alertas predictivas

### T-ALERT1 · Regla "Por debajo de PE diario X días seguidos"
- `checkPeDiarioAlert()`: si últimos N=3 días bruto real <85% de `bruto_dia_para_cubrir_fijos`, generar alerta.
- Persistir en tabla `alertas` (crear si no existe): tipo, mensaje, fecha, leida, severity.

### T-ALERT2 · UI badge alertas en sidebar
- Badge rojo con número de alertas no leídas.
- Click → `/alertas` con lista.
- Tokens Binagre.

### T-ALERT3 · Notificación Slack (fase 2)
- Webhook Slack a canal Streat Lab.
- Configurable on/off desde 6ª sección "PE Parámetros" (campo `alerta_slack_webhook_url` añadido a `pe_parametros`).
- Sin Slack configurado → solo badge sidebar.

### T-ALERT4 · Cron diario
- Disparar `checkPeDiarioAlert()` cada día 23:00.
- Disparable manualmente desde admin.

---

## Orden de ejecución
1. ✅ T-FIX1 (decimales) — implementado.
2. ✅ T-FIX2 (ticket medio) — cerrado, NO era bug.
3. ⏳ T-FIX4 (validación browser Rubén con hard refresh).
4. ⏳ T-MARCA1 a T-MARCA4 (cuando Rubén valide T-FIX4).
5. ⏳ T-HIST1 a T-HIST4.
6. ⏳ T-ALERT1 a T-ALERT4.

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
- **Antes de proponer fórmulas o validaciones que dependan de cifras de negocio, consultar dato real en Supabase. NO usar suposiciones.**
