# Active Plan — Sesión 26-abr-2026 (PE Refactor)

## Fix actual
**PE Refactor — bloque visual final tras T1-T5 ya implementados.**

Code acaba de cerrar T1-T5 (peAggregates, dashboardHandler aditivo, TabDashboard nuevo, eliminación TabConfig, 6ª sección PE Parámetros). Falta UNA mejora visual sobre el TabDashboard antes de validar:

### Decisión nueva (cerrada con Rubén 26-abr 16:00)
Las 2 cards grandes superiores deben mostrar, además del SÍ/NO y "Día X", **el número de pedidos** (no solo el bruto €) que hacen falta para:
- Cubrir fijos al MES
- Cubrir fijos por SEMANA (5 días operativos)
- Cubrir fijos por DÍA (5 días operativos / sem)
- Y lo mismo para "ganar objetivo limpio" si encaja en la card.

El cálculo de pedidos = bruto / ticket_medio. El ticket medio ya está calculado en algún sitio del backend (probablemente en running, dashboard o algún agregado de facturación). El implementer debe localizarlo y reutilizarlo. NO recalcularlo desde cero.

### Tareas
**T-EXT1 · Localizar fuente de ticket medio existente**
- Buscar en `api/_lib/` o `src/lib/` la función / agregado que ya calcula ticket medio (avg(bruto / num_pedidos) últimos N días o mes).
- Si existe varias variantes (mes, 30d, 90d), priorizar la que coincida con la ventana del refactor PE (3 meses cerrados).
- Si NO existe, crear `getTicketMedio3Meses()` en `api/_lib/peAggregates.ts` siguiendo el patrón de las otras funciones del archivo. Calcular como `Σ bruto ventas 3 meses cerrados / Σ num_pedidos 3 meses cerrados`.

**T-EXT2 · Extender payload `dashboardHandler`**
- Añadir al payload (manteniendo aditividad B4):
  - `ticket_medio_eur`
  - `pedidos_mes_para_cubrir_fijos` = `Math.ceil(bruto_mes_para_cubrir_fijos / ticket_medio_eur)`
  - `pedidos_semana_para_cubrir_fijos` = `Math.ceil(bruto_semana_para_cubrir_fijos / ticket_medio_eur)`
  - `pedidos_dia_para_cubrir_fijos` = `Math.ceil(bruto_dia_para_cubrir_fijos / ticket_medio_eur)`
  - Y los 3 equivalentes para `ganar_objetivo`.

**T-EXT3 · Mostrar pedidos en TabDashboard**
- En la card grande "¿SOMOS RENTABLES?" (verde si SÍ, rojo si NO): debajo del SÍ/NO + delta €, añadir línea pequeña con: "X pedidos/día · Y pedidos/sem · Z pedidos/mes para cubrir fijos".
- En la card grande "¿DESDE QUÉ DÍA?": debajo del "Día X" o "Día 36 · faltan Y€", añadir misma línea con pedidos.
- Tokens Binagre. fmtNum (sin €) para enteros de pedidos. Etiqueta clara "pedidos".
- Si `ticket_medio_eur` es 0 o null (ej. <3 meses cerrados), ocultar la línea de pedidos en lugar de mostrar "Infinity" o "NaN".

**T-EXT4 · Type check + smoke test endpoint**
- `npx tsc --no-emit` → cero errores.
- `curl -s "http://localhost:5173/api/pe/dashboard" | jq '.ticket_medio_eur, .pedidos_mes_para_cubrir_fijos, .pedidos_dia_para_cubrir_fijos'` → 3 valores numéricos.

**T-EXT5 · Validación manual en `localhost:5173/finanzas/punto-equilibrio`**
- Ver las 2 cards grandes con la línea de pedidos visible.
- Tab Configuración no existe.
- Toggle Sin/Con IVA cambia importes (y por tanto pedidos calculados).
- `localhost:5173/configuracion` → 6ª sección "PE Parámetros" funciona.

## NO hacer en esta iteración
- NO commit + push + vercel hasta cierre del día (regla deploy diario).
- NO tocar Conciliación / Bancos / Bloque B del otro chat. Otro chat trabaja ahí en paralelo.
- NO romper aditividad B4: campos viejos siguen vivos.

## Estado pipeline
1. ✅ T1-T5 completados por Code
2. ⏳ T-EXT1 a T-EXT5 (este bloque)
3. ⏳ Validación manual Rubén
4. ⏳ Cierre del día (otro plan): commit + vercel --prod

## Reglas inmutables
- Tokens Binagre desde `src/styles/tokens.ts`. Locale es_ES.
- Aislamiento absoluto Binagre ↔ David.
- Trabajamos contra `localhost:5173`. Vercel solo al cierre del día.
