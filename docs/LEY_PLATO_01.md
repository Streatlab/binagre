# LEY-PLATO-01 · Un solo diccionario de platos

`platos_maestros` (+ `platos_alias`) es la ÚNICA fuente de identidad del plato.
Lógica pura: `src/lib/cocina/platoHub.ts`. Vínculo: RPC `vincular_plato_maestro`
(cliente en `src/lib/cocina/vincularCliente.ts`). Tests: `tests/platoHub.test.ts`.

## Identidad y referencias

- `mapeo_plato_receta.plato_maestro_id` y `carta_platos.plato_maestro_id`
  (columnas nuevas, nullable) apuntan al maestro. Ninguna de las dos tablas tiene
  ya identidad propia: su plato es el maestro al que referencian.
- `platos_alias.alias_norm` (= `norm_plato`, normalización canónica de Postgres,
  réplica JS en `src/utils/normPlato.ts`) es la clave de casación exacta. Es única,
  así que un nombre casa con **como mucho un** maestro: nunca hay ambigüedad por alias.

## Migración (100 % aditiva, autorizada 22-jul)

Salvaguardas cumplidas: nada se borró, nada se sobreescribió, ningún valor
existente cambió. Solo se añadieron columnas, filas y vínculos.

Reglas:
1. Casar por `alias_norm` exacto. Candidato único → se casa; 0 → se crea maestro
   (crear no es riesgo); >1 distintos → NADA se casa y va a `platos_revision`
   (cola de revisión, frase en cristiano). Sin fuzzy.
2. Plato vendido sin identidad → se crea maestro (clave = `plato_norm`, alias =
   nombre original). `tipo_linea` distinto de `plato` (bebida/extra/promo, "Agua"…)
   → `es_extra = true`: jamás pide receta ni cuenta como "sin vincular".

Recuentos de control de la migración real:

| Métrica                     | Antes | Después |
|-----------------------------|------:|--------:|
| platos_maestros             |  371  |  874    |
| platos_alias                |  402  |  906    |
| mapeo con plato_maestro_id  |    0  |  679/679|
| carta con plato_maestro_id  |    0  |   17/17 |
| cola de revisión (ambiguos) |   —   |    0    |

Cola = 0 porque `alias_norm` es único: no existe ambigüedad posible por nombre
normalizado. La cola queda operativa para futuros casos.

## Vincular una vez, se refleja en todo

`vincular_plato_maestro(maestro, receta)` escribe a la vez en `platos_maestros`,
`mapeo_plato_receta` (⇒ Análisis / Menú Engineering / Pareto / Coste por plato) y
`carta_platos` (⇒ Carta). El vinculador vive en UN sitio: la ficha de Plato
Maestro y la pestaña Hoy. Coste por plato y Carta **redirigen** su acción a esta
misma RPC (ya no escriben el vínculo por su cuenta).

## Auto-propuestas (nunca autovincula)

Un plato sin receta cuyo nombre normalizado casa exacto (o con similitud alta,
`similitudPlato`) con una receta existente genera una **propuesta pendiente**
(`platos_propuestas_vinculo`) que se confirma con 1 clic en el hub / en Hoy.
`sugerirReceta` calcula la sugerencia; jamás se confirma sola.

## Bebida / extra / promo

`requiereReceta(maestro)` es `false` si `es_extra` o si `tipo_linea` ∈
{bebida, extra, promo, agua}. Esos platos nunca piden receta ni entran en los KPIs
de "sin vincular".
