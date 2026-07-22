# Tanda 8 · Enlace asistido plato-receta + fix popularidad Menú Engineering — cierre

Rama `tanda8-menu-eng-fix`, partida limpia de `master` (no de `trabajo`/PR #29). No incluye
Bloque E (Hoja de Inventario) ni el hub `/configuracion/cocina` (Bloque C/"G1") — ya están
en producción vía PR #28 y no se tocan aquí.

## 1 · Fix popularidad Menú Engineering

**Bug real encontrado**: `cocina/MenuEngineering.tsx` cruzaba `ventas_plato.plato` con
`recetas.nombre` por `===` exacto. Cualquier diferencia de mayúsculas, acento o espacio
(muy común: los nombres de `ventas_plato` vienen de exports de plataforma/POS, no del
Escandallo) dejaba esa receta con **0 unidades** aunque sí tuviera ventas reales —
falseaba popularidad, mix % y los 6 métodos que dependen de ella (Boston, Pavesic,
LeBruto, Omnes, Atkinson, Taylor).

Verificado en Supabase antes de tocar código: con `===` exacto solo 2 recetas cruzaban con
`ventas_plato`; con la normalización correcta, 5 (2,5×).

**Fix**: nuevo `src/utils/normPlato.ts` (`normPlato`, `similitudPlato`), réplica en JS de
la función canónica `norm_plato()` de Postgres (la misma que ya usa `v_margen_plato`/
`mapeo_plato_receta` — minúsculas, sin acentos, ñ conservada, símbolos fuera, espacios
colapsados). `MenuEngineering.tsx` cruza ahora por nombre normalizado en vez de exacto.

## 2 · Enlace asistido plato → receta (Carta)

Para platos sin `receta_id`: en vez de un `—` neutro, se calcula la mejor receta candidata
por similitud de nombre (`similitudPlato`, umbral 0,5) y se ofrece un botón
"¿&lt;receta&gt;? · Vincular" que enlaza con un clic tras confirmación visual (nunca
autovincula solo). Si no hay ninguna candidata por encima del umbral, se mantiene el badge
"Sin escandallo" (ámbar) de antes. El selector manual del formulario de plato sigue
disponible como alternativa.

## 3 · Auditoría G3 (sobre `master`, solo lectura)

Pregunta: ¿la migración de tokens (C19-31, codemod hex→tokens + retirada del interruptor
NEO/SL) rompió las hojas imprimibles (Marco de Documentos)?

- `src/lib/marcoDoc.ts` y `src/components/marco/HojaDoc.tsx`: **un solo commit en toda su
  historia** (su creación, 0853b394) — ninguno de los commits del codemod (`bfc8a439` y
  relacionados) los toca.
- Grep de `var(--` dentro de las llamadas `setTextColor`/`setFillColor`/`setDrawColor` de
  los 4 ficheros que generan PDFs reales (`Produccion.tsx`, `Esquemas.tsx`,
  `ListaCompra.tsx`, `TabFichas.tsx`): **cero coincidencias** — el codemod no metió
  variables CSS dentro de llamadas jsPDF (que exigen números RGB, no strings; si lo
  hubiera hecho, los PDFs romperían en tiempo de ejecución o saldrían con color erróneo).

**Conclusión G3: las hojas imprimibles no se rompieron.** No hace falta ninguna acción de
reparación — la frontera Marco de Documentos / kit de la app se ha respetado.

## Verificación

`npx tsc -b` y `npm run build` limpios.

## Ficheros tocados

- Nuevo: `src/utils/normPlato.ts`.
- Editados: `src/pages/cocina/MenuEngineering.tsx` (fix cruce popularidad),
  `src/pages/Carta.tsx` (enlace asistido).
