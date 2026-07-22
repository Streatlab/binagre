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

**Fix quirúrgico (corrección sobre el primer intento)**: la popularidad se resuelve
PRIMERO vía `mapeo_plato_receta` (agregando `ventas_plato.unidades` por `receta_id` del
mapeo — mismo criterio y misma tabla que ya usa la vista canónica `v_margen_plato`).
`normPlato` (réplica en JS de `norm_plato()` de Postgres) queda solo como último recurso
para ventas cuyo plato no tenga fila enlazada en el mapeo. Recuperado de `fa8f5fae`
(rama descartada `claude/tabingredientes-equivalencias-4v40mj`) vía cherry-pick, fusionado
con el fallback de nombre.

Verificado en Supabase: de 33 recetas con coste (`coste_rac > 0`), **24 cruzan ahora con
ventas reales** vía mapeo (antes de este fix, con `===` exacto, solo 5). Cumple el
objetivo ("mayoría de 34, no 5").

**Enlace asistido en la propia pantalla**: los platos de `mapeo_plato_receta` sin
`receta_id` se listan directamente en Menú Engineering (ordenados por facturación,
top 8 + enlace a la lista completa en Coste por plato), cada uno con sugerencia por
similitud de nombre (`similitudPlato`, umbral 0,5) y botón "Vincular" de un clic, o un
`<select>` manual si no hay sugerencia por encima del umbral. Escribe directamente en
`mapeo_plato_receta` (mismo mecanismo que `CostePlato.tsx`).

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

## 4 · Nombre madre siempre (Pareto + Coste por plato)

Regla general aplicada a toda pantalla de análisis: el nombre que se muestra siempre es
el de la receta madre (`recetas.nombre`, resuelto vía `mapeo_plato_receta` igual que en
el punto 1); el nombre crudo de plataforma que recoge el robot pasa a detalle secundario.

- **Pareto de ventas** (`analytics/ParetoVentas.tsx`, dimensión "Producto"): las ventas de
  variantes ("…+ bebida", tamaños, nombres comerciales) se agregan bajo su receta madre en
  vez de aparecer como productos distintos; si una madre agrupa más de un nombre crudo se
  indica "· N variantes de plataforma". Lo sin vincular se agrupa aparte como fila
  **"Sin vincular"** con acceso directo ("Vincular →") a Coste por plato. Dimensiones
  Marca/Canal no llevan nombre de plato — sin cambios.
- **Coste por plato** (`cocina/CostePlato.tsx`): en filas ya enlazadas se muestra el
  nombre de la receta como principal y el nombre crudo de plataforma como detalle
  pequeño debajo. En filas sin enlazar no hay nombre madre todavía — el nombre crudo
  sigue siendo el dato principal, porque es justo lo que hay que identificar para
  vincular (no se puede aplicar la regla donde el enlace todavía no existe).
- **Margen por canal** (`analytics/MargenCanal.tsx`): auditado — no muestra nombres de
  plato, solo agregados por canal desde `resumenes_plataforma_marca_mensual`. La regla no
  aplica; sin cambios.

## Verificación

`npx tsc -b` y `npm run build` limpios.

## Ficheros tocados

- Nuevo: `src/utils/normPlato.ts`.
- Editados: `src/pages/cocina/MenuEngineering.tsx` (fix cruce popularidad + enlace
  asistido en pantalla), `src/pages/Carta.tsx` (enlace asistido),
  `src/pages/analytics/ParetoVentas.tsx` (nombre madre + agrupación "Sin vincular"),
  `src/pages/cocina/CostePlato.tsx` (nombre madre como principal en filas enlazadas).
