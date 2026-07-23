# Implementation summary · Bloque 4 — Fuente única Escandallo → fichas_tecnicas

Rama `trabajo`. Supabase `eryauogxcpbgdryeimdq`. Migración aplicada vía `apply_migration` MCP,
registrada también en repo en `supabase/migrations/20260722180000_plato_maestro_bloque4_triggers_fichas.sql`.

## Archivos tocados
- `supabase/migrations/20260722180000_plato_maestro_bloque4_triggers_fichas.sql` (nuevo, registro de la migración)
- `.claude/plans/implementation-summary-bloque4.md` (este archivo)
- **Cero cambios en `src/`.** Confirmado (T4.6): `TabFichas.tsx` y `ModalEditarFicha.tsx` solo hacen
  `SELECT` y `UPDATE` puntual sobre `fichas_tecnicas` (gama, alérgenos, y el payload completo del
  modal de edición manual). **Ningún archivo del front hace `INSERT`** en `fichas_tecnicas` — el
  Libro de Recetas ya no crea fichas por su cuenta, se verificó con grep, no se asumió.

## Objetos BD creados
- `fn_split_pasos(txt text) → jsonb`: parte por saltos de línea, quita numeración/bullets
  (`1.`, `2)`, `-`, `•`), descarta líneas vacías, determinista, devuelve `[]` si NULL/vacío.
- Índices únicos parciales `idx_fichas_receta_id`, `idx_fichas_eps_id` (soportan el upsert).
- `fn_ficha_desde_receta()` / `fn_ficha_desde_ep()`: upsert en `fichas_tecnicas` por
  `receta_id`/`eps_id`. Escriben `codigo, nombre, raciones, alergenos, pasos`. **Nunca tocan**
  `foto_url`, `conservacion`, `gama`, `estado`, `edicion` (columnas fuera del `DO UPDATE SET`).
- Triggers `trg_ficha_desde_receta` (AFTER INSERT OR UPDATE OF `nombre, raciones, alergenos,
  elaboracion, codigo` ON `recetas`) y `trg_ficha_desde_ep` (análogo en `eps` sobre `preparacion`).
- Sin backfill masivo (por diseño, se hace en Bloque 5 para no chocar con las 80 fichas huérfanas).

## Decisiones autónomas
1. **`UPDATE OF <columnas>` en vez de `UPDATE` genérico.** El ADR decía "AFTER INSERT OR UPDATE"
   sin matizar. Se restringió a las columnas que realmente alimentan la ficha (`nombre, raciones,
   alergenos, elaboracion/preparacion, codigo`). Motivo: se detectó que `ModalEditarFicha.tsx`
   también permite editar a mano `pasos`, `nombre`, `raciones` y `alergenos` de una ficha
   vinculada; disparar el trigger en cada UPDATE de `recetas`/`eps` (incluidos cambios de coste/PVP,
   muy frecuentes) habría re-derivado esos campos en cada guardado ajeno, pisando ediciones
   manuales sin necesidad. Restringir a `UPDATE OF` cumple igual el requisito explícito ("editar
   elaboracion/preparacion se refleja solo") con mucho menor radio de impacto. Riesgo bajo, no pedía
   confirmación (RULES.md #8).
2. **`alergenos` se trata como heredado (no protegido), según el ADR/tasks cerrados** (T4.3/T4.4
   listan `alergenos` junto a `nombre/raciones/pasos` como campos que el trigger sí reescribe).
   El objetivo del prompt menciona "alérgenos manuales si los hay" entre lo protegido — se resolvió
   la ambigüedad a favor de la decisión ya cerrada y más específica del ADR (única fuente con
   detalle columna a columna). Queda anotado aquí para que quede explícito: si en el futuro se
   permiten alérgenos manuales distintos de los de la receta/EP en una ficha vinculada, este trigger
   los pisaría — no ocurre hoy (los 3 fichas vinculadas actuales tienen `alergenos: []` en ambos
   lados).
3. **`codigo` de la ficha = `codigo` de la receta/EP tal cual** (no se generó formato `REC-xxx` con
   guion). Se verificó que los códigos reales ya vienen con el prefijo (`REC030`, `EPS125`) desde
   `recetas.codigo`/`eps.codigo`, coincidiendo con lo que ya usan las 3 fichas vinculadas existentes.
   No se inventó un generador nuevo.

## Prueba real (sin pérdida de datos)
Se usó el EP real **"Patatas panaderas" (EPS125)**, vinculado a una ficha con `conservacion`
poblada (`Tapper · 5 días`) y `gama = 'Guarniciones'` — caso más exigente que uno vacío.

1. `UPDATE eps SET preparacion = preparacion || '\nPASO DE PRUEBA...'` → el trigger disparó solo
   y la ficha ganó el paso nuevo en `pasos[]` automáticamente, sin tocar el resto.
2. Verificado en la misma consulta: `conservacion` y `gama` **quedaron intactos** (anti-pisado
   confirmado con datos reales, no simulados).
3. Se restauró `eps.preparacion` a su texto original y se restauró `fichas_tecnicas.pasos` al
   array curado original (edición directa, ya que el split determinista de un párrafo sin saltos de
   línea no reproduce exactamente pasos re-redactados a mano). Estado final verificado idéntico al
   inicial: `preparacion`, `pasos`, `conservacion`, `gama`, `foto_url` todos coinciden con el
   snapshot previo al test.
4. Cifras de `fichas_tecnicas` antes/después del test: **83 total / 1 con receta / 2 con EP / 80
   huérfanas** — sin cambios, sin filas nuevas ni duplicadas.

## Edge cases manejados
- `elaboracion`/`preparacion` NULL o vacío → `fn_split_pasos` devuelve `[]`, no falla.
- Texto sin numeración (un solo párrafo) → 1 solo paso (no se fuerza split por frase).
- Texto con numeración mixta (`1.`, `2)`, guiones) → prefijo eliminado de forma determinista.
- Líneas en blanco / dobles saltos de línea → descartadas, no generan pasos vacíos.
- `recetas.alergenos` es `ARRAY` (no jsonb) → convertido con `to_jsonb()` antes de escribir en
  `fichas_tecnicas.alergenos` (jsonb). `eps.alergenos` ya es jsonb, se copia con `COALESCE(...,
  '[]'::jsonb)` por si viniera NULL.
- Colisión con backfill de Bloque 5: **no se dispara backfill aquí**, tal como exige T4.5, para no
  generar fichas nuevas que luego choquen con las 80 huérfanas al fusionarlas.

## Build / tests
- `npx tsc --noEmit`: limpio, sin salida.
- `npx vitest run`: **234/234 tests verdes** (8 archivos). Sin cambios en `src/`, no se añadieron
  tests unitarios nuevos — la validación es 100% contra BD real (arriba).

## Aislamiento verificado
Cero referencias a David/Cade/Marino+Fuego/`idclhnxttdbwayxeowrm`. Todo en Supabase Binagre
`eryauogxcpbgdryeimdq`, rama `trabajo`, sin tocar `master`.
