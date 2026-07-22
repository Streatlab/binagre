# Implementation summary · Bloque 5 — Fusión de fichas_tecnicas huérfanas

Rama `trabajo`. Supabase `eryauogxcpbgdryeimdq`. Depende de B2 (`fn_plato_canon`, `norm_plato`) y
B4 (triggers `fn_ficha_desde_receta`/`fn_ficha_desde_ep`), ambos verificados ya aplicados.

## Estado de partida (verificado, no asumido)
- `fichas_tecnicas`: 83 filas, 80 huérfanas (`eps_id IS NULL AND receta_id IS NULL`), 3 ya
  enlazadas (1 receta / 2 eps).
- `recetas`: 34 filas, 33 sin ficha. `eps`: 57 filas, 55 sin ficha.
- Triggers B4 activos: `trg_ficha_desde_receta` / `trg_ficha_desde_ep`, disparan en
  `AFTER INSERT OR UPDATE OF nombre, raciones, alergenos, elaboracion/preparacion, codigo`.

## Archivos tocados
- `supabase/migrations/20260722200000_plato_maestro_bloque5_fusion_huerfanas.sql` — registro en
  repo de lo aplicado vía Supabase MCP (`apply_migration`/`execute_sql`): función
  `fn_fusionar_fichas_huerfanas()` + backfill.
- Sin cambios en `src/` (Bloque 5 es 100% BD; la UI de la cola de revisión la construye Bloque 6
  leyendo `fichas_tecnicas WHERE eps_id IS NULL AND receta_id IS NULL`, según ADR D5/D6).

## Recuento en solo lectura (antes de aplicar nada)
Sobre las 80 huérfanas, candidatos por `similarity(norm_plato(ficha.nombre), norm_plato(cand.nombre))`
sobre `recetas ∪ eps` sin ficha todavía, con el mismo umbral que `fn_sugerir_receta_platos`
(`sim1 >= 0.55 AND sim1-sim2 >= 0.08`):
- **75 candidatos claros**
- **5 sin fusión posible**: 1 sin candidato real (`sim1 < 0.55`) + 4 ambiguos (2 pares de fichas
  con nombre duplicado — "Arroz caldero murciano" y "Puré de patatas Guarnición" — que empatan
  `sim1=sim2=1.000` contra dos recetas homónimas; gap 0 < 0.08).
- 0 colisiones de candidato (ningún candidato quedó reclamado por dos huérfanas a la vez).

## DECISIÓN AUTÓNOMA 1 — orden de operaciones (enlazar antes de mergear contenido)
El primer intento de ejecución (merge de contenido antes de enlazar) rompió con
`duplicate key value violates unique constraint "idx_fichas_eps_id"`. Causa: el `UPDATE` de
`alergenos`/`elaboracion` sobre una receta/EP todavía sin ficha dispara el trigger B4
(columna vigilada), que hace `INSERT ... ON CONFLICT (receta_id/eps_id)` — al no existir aún
ninguna ficha para esa receta/EP, inserta una fila **nueva**, y esa fila nueva choca con el
`UPDATE` posterior que intenta enlazar la ficha huérfana al mismo `receta_id`/`eps_id`.
Solución: **enlazar primero** (`UPDATE fichas_tecnicas` con `receta_id`/`eps_id`), **mergear
contenido después** — así el trigger encuentra la fila ya enlazada vía `ON CONFLICT` y la
actualiza in situ, sin fila duplicada. Documentado como comentario en la migración.

## DECISIÓN AUTÓNOMA 2 — alcance del merge no destructivo
`recetas` no tiene columna `conservacion`; `eps` no tiene `foto_url` ni `conservacion`. El merge
solo aplica a los campos que existen en ambos lados:
- `recetas.foto_url` ← `ficha.foto_url` (nunca tocado por el trigger, sin riesgo de round-trip).
- `recetas.alergenos` / `eps.alergenos` ← `ficha.alergenos` (convertido a `text[]` en recetas).
- `recetas.elaboracion` / `eps.preparacion` ← `ficha.pasos` (unidos con `\n`; el trigger los
  vuelve a partir con `fn_split_pasos`, round-trip verificado sin pérdida de contenido).
- `conservacion` de la ficha **nunca se mueve** (no hay columna destino); se queda intacta en
  `fichas_tecnicas`, que es donde ya vivía y de donde la sigue leyendo `ModalEditarFicha`.
- En todos los casos: solo se rellena si el destino está vacío; si la receta/EP ya tenía dato
  propio, no se toca (la ficha nunca pisa un dato existente).

## Resultado real tras aplicar (verificado con query, no asumido)
- **75 fusionadas automáticamente** (`receta_id`/`eps_id` enlazado).
- **5 en cola de revisión manual** (siguen con ambos NULL; las consumirá la UI de Bloque 6):
  - `Salsa Marinara` — sin candidato claro (mejor match 0.231, por debajo del umbral 0.55).
  - `Arroz caldero murciano` × 2 — ambiguo: hay 2 recetas homónimas ya sin ficha.
  - `Puré de patatas Guarnición` × 2 — ambiguo: 2 recetas homónimas ya sin ficha.
- **13 fichas nuevas por backfill** (T5.3) para las recetas/EPs que, tras la fusión, seguían sin
  ficha propia (no tenían huérfana equivalente que fusionar).
- `fichas_tecnicas`: 83 → 96 filas. `recetas_sin_ficha` y `eps_sin_ficha`: 0 (34/34 y 57/57).

## Verificación de no pérdida de datos
- Antes de fusionar: de las 80 huérfanas, 0 con `foto_url`, 7 con `pasos`, 0 con `alergenos`, 51
  con `conservacion` no vacía.
- Después: totales sobre las 83 fichas originales (ahora repartidas entre enlazadas y en
  revisión) — `con_foto=0`, `con_pasos=10`, `con_alergenos=0`, `con_conservacion=52` — todos
  iguales o superiores al baseline (nunca inferiores), consistente con que no se pierde nada y
  con que el trigger regenera `pasos` a partir del contenido recién mergeado (no lo vacía).
- Muestra puntual verificada: ficha "Cacahuete tostado roto" (fusionada con su EP homónimo)
  conserva su `conservacion` (`Tapper / 5 días`) intacta tras el enlace.
- Muestra de merge de contenido verificada: receta "Albóndigas de cerdo en salsa española"
  recibió `elaboracion` desde su ficha huérfana; el trigger regeneró `pasos` (7 líneas) desde ese
  texto y el contenido coincide línea a línea con el original de la ficha.

## Build / tests
- `npx tsc --noEmit`: limpio (sin cambios en `src/`, Bloque 5 es solo BD).
- `npx vitest run`: 234/234 verdes (sin tests nuevos — Bloque 5 no toca TypeScript; la
  verificación de "no pérdida de campos" se hizo con queries reales antes/después, documentadas
  arriba, siguiendo el mismo patrón que B3/B4).

## Pendiente (fuera de alcance de B5)
- Bloque 6: UI en Cocina que muestre la cola de 5 fichas en revisión
  (`fichas_tecnicas WHERE eps_id IS NULL AND receta_id IS NULL`) para resolución manual.
