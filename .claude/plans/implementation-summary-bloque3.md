# Implementation summary — Bloque 3 (limpieza de ruido de plataforma)

Repo `Streatlab/binagre`, rama `trabajo`. Supabase `eryauogxcpbgdryeimdq`.

## Archivos tocados
- `supabase/migrations/20260722190000_plato_maestro_bloque3_ruido.sql` (nuevo, registro en repo de
  la migración aplicada vía `apply_migration` MCP): añade columna `tipo_linea text NOT NULL DEFAULT
  'plato'` + CHECK `IN ('plato','ruido')` + índice, ejecuta el `UPDATE` de marcado (nunca `DELETE`)
  y recrea `v_mapeo_resuelto` añadiendo `mpr.tipo_linea` al final del SELECT (Postgres exige orden
  estable de columnas en `CREATE OR REPLACE VIEW`, de ahí que quedara última).
- `src/pages/cocina/CostePlato.tsx` — query de `v_mapeo_resuelto` añade `tipo_linea` al `select` y
  `.neq('tipo_linea', 'ruido')`. Como `filas` alimenta tanto la cola como todos los KPIs
  (`sinReceta`, `para80`, etc.), un único filtro en la carga cubre cola + KPIs. Cambio mínimo, sin
  tocar estilos ni tokens.

## Esquema real verificado (no asumido)
- Columna de texto del plato: `plato_muestra` (display) / `plato_norm` (normalizado, ya pasa por
  `norm_plato()`). No existía `tipo_linea` previamente.
- `mapeo_plato_receta` es consultada por el front vía la vista `v_mapeo_resuelto` (Bloque 2), no
  directamente — de ahí que la vista también necesitara exponer la columna.

## Reglas de marcado aplicadas (ADR-D3 / T3.2, literal, sin extender)
`UPDATE ... SET tipo_linea='ruido' WHERE receta_id IS NULL AND (`
- solo dígitos/decimales (`^\s*[0-9]+([.,][0-9]+)?\s*$`)
- `Descuento%`
- `Gastos de envío%`
- modificadores en mayúsculas al inicio: `^(SIN |CON |PREFIERO |TAMAÑO )`
- `%media ración%` / `%ración entera%`
- `euros = 0` (salsas sueltas / extras a coste 0)
`)`

**Decisión autónoma 1:** se añadió `receta_id IS NULL` como guarda global (no solo para el caso
euros=0). Motivo: se detectó 1 fila (`CROQUETAS DEL MESÓN (3 Uds.)`, euros=0, `origen='manual'`)
ya enlazada a receta por un humano — coincidía con la regla "euros=0" y habría quedado marcada
ruido, contradiciendo el enlace manual. Con la guarda, esa fila y los 43 enlaces existentes quedan
protegidos sin excepción, cero riesgo de esconder un plato ya confirmado.

**Decisión autónoma 2:** el patrón de modificadores (`SIN/CON/PREFIERO/TAMAÑO`) se implementó
**anclado al inicio y en mayúsculas exactas** (`~`, no `~*`), no como substring case-insensitive.
Un primer intento con `~*` (case-insensitive, sin anclar) capturaba falsos positivos masivos:
nombres de platos reales que contienen la preposición "con" en minúscula (p.ej. "Los Mejillones
naturales al VAPOR, **con** salsa a elegir"). Verificado contra datos reales: los modificadores de
plataforma vienen siempre en MAYÚSCULAS como línea completa ("SIN CARNE", "TAMAÑO GRANDE",
"PREFIERO PECHUGA DE POLLO."), a diferencia de los nombres de plato en Title Case. Con el patrón
anclado no hay falsos positivos (verificado por inspección de las 13 filas capturadas).

## Cifras reales (verificadas con query, no asumidas)
- `mapeo_plato_receta` total: 679 filas (sin cambio, `UPDATE`, cero `DELETE`).
- `tipo_linea='ruido'`: **311** filas.
- `tipo_linea='plato'`: **368** filas.
- Verificado: 0 filas con `receta_id IS NOT NULL` quedaron marcadas `ruido` (los 43 enlaces
  manuales/sugeridos intactos).

**Discrepancia vs. el ~198 estimado por Tanda 8/architect-review:** el resultado real (368) es
sensiblemente mayor. Inspeccionado el resto de filas no marcadas ruido: hay una cola larga de
extras/guarniciones/bebidas/salsas con precio bajo pero **no cero** (p.ej. "MAYONESA PICANTE"
0,95€, "CREMA AGRIA" 1,95€, "AGUA" 2,50€, "AÑADID 1 HUEVO FRITO CON PUNTILLA" 2,00€) que
conceptualmente también son ruido de plataforma pero **no encajan en ninguna regla cerrada del
ADR** (no son euros=0, no son solo dígitos, no llevan los prefijos de modificador). Añadir un
umbral de precio para capturarlas sería una regla de negocio nueva, no autorizada por el ADR/tasks
(riesgo de esconder platos reales baratos) — **no se ha añadido**, se deja documentado como
posible ampliación futura de las reglas de B3, a decidir por Rubén/architect-review, no por el
implementer.

## Reversibilidad
100% reversible: es una columna (`tipo_linea`) con `UPDATE`, ningún `DELETE`. Revertir todo:
`UPDATE mapeo_plato_receta SET tipo_linea='plato' WHERE tipo_linea='ruido';`

## Edge cases manejados
- Filas ya enlazadas a receta (`receta_id NOT NULL`) nunca se marcan ruido, aunque coincidan con
  un patrón (protege el caso euros=0 + enlace manual encontrado).
- `CREATE OR REPLACE VIEW` de Postgres no permite reordenar/renombrar columnas existentes; se
  añadió `tipo_linea` al final del SELECT en vez de en su posición "lógica".
- Aislamiento Binagre↔David: cero credenciales/tokens/lógica de David tocados; todo en Supabase
  `eryauogxcpbgdryeimdq` y repo `Streatlab/binagre`.

## Build / tests
- `npx tsc --noEmit`: limpio.
- `npx vitest run`: 234/234 tests verdes (8 archivos).

## Toggle "ver ruido" (mencionado en ADR como mitigación)
No implementado en este cambio (fuera del alcance mínimo pedido: "cambio mínimo, sin tocar
estilos"). El filtro es reversible vía SQL y la columna queda disponible para un futuro toggle en
UI si se decide añadirlo.
