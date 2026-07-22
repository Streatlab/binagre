# Bloque F · Integraciones — cierre

Rama `escandallo-tanda-f`, PR nuevo (separado del #28, según instrucción de Rubén).

## F1 · Recetario — verificado, sin cambios

`Recetario.tsx` → `TabFichas.tsx` ya lee `fichas_tecnicas` (vigentes) y cruza coste real
de Escandallo por código (`eps`/`recetas`, `coste_tanda`/`coste_rac`) y líneas reales
(`eps_lineas`/`recetas_lineas`). No hay catálogo manual paralelo — las EPS/recetas ya
aparecen solas. **DECISIÓN AUTÓNOMA**: no se toca el botón "Añadir ingrediente" de
`ModalEditarFicha.tsx` (entrada de texto libre en la ficha imprimible) — es un detalle de
formato de la ficha impresa, no el catálogo de recetas/EPS que pedía F1, y tocarlo arriesga
romper un documento imprimible ya establecido sin que se haya pedido explícitamente.

## F2 · Menú Engineering — verificado, food cost ya real

`cocina/MenuEngineering.tsx` ya usa `recetas.coste_rac` (real, no manual/hardcodeado) y
`ventas_plato` real para popularidad. Implementa 6 metodologías académicas (Boston, Pavesic,
LeBruto, Omnes, Atkinson, Taylor) — más sofisticado que el "menu engineering lite"
(`fn_escandallo_menu_engineering`/`v_margen_plato`) que ya se ve en Escandallo → Auto.

**DECISIÓN AUTÓNOMA**: no se fuerza a que esta página use la RPC más simple del cuadro de
mando — degradaría una página ya construida con 6 métodos reales sobre datos reales, a
cambio de "unificar" con una clasificación más básica (4 cuadrantes) pensada para una card
de resumen, no para un análisis completo. El margen por canal se recalcula en cliente con
`calcNetoPorCanal` (real, `config_canales`) en vez de vía `v_margen_plato` — es una
duplicación de FÓRMULA, no de FUENTE (ambas parten de datos reales), y unificarla es
un cambio de arquitectura mayor que excede "conectar coste real", que ya estaba conectado.

## F3 · Pareto Ingredientes — cerrado

Nueva vista "Consumo real (compras)" (por defecto al abrir la pantalla), sobre
`v_escandallo_pareto_compras` — la MISMA vista que ya usa el cuadro de mando de Escandallo
→ Auto ("Dónde se va el dinero"). Las vistas teóricas existentes (En recetas / Catálogo /
Categorías) se mantienen como pestañas adicionales, con la nota de cada una aclarando que
son coste teórico, no gasto real — nada se ha borrado, solo se ha completado lo que pedía
la tarea (consumo real) sin tocar lo demás.

## F4 · Carta — cerrado

`carta_platos.receta_id` y el cálculo de food cost/margen ya eran reales (correcto de
antes). Solo faltaba el indicador visual: badge ámbar "Sin escandallo" en la columna
Receta para platos sin `receta_id` (antes solo había un `—` neutro + un contador KPI
agregado).

## F5 · Lista de la Compra (Cocina) — cerrado

Nuevo filtro "Bajo mínimo (N)" sobre `v_stock_real` — la MISMA vista que ya usa
Compras → Inventario (`TabStockReal.tsx`/`TabListasCompra.tsx`). Se reutiliza como filtro
para acotar el catálogo comprable a lo que hace falta reponer, sin reconstruir el cálculo
de necesidad (`stock_minimo − stock_actual`) que ya vive en `TabListasCompra.tsx` — evita
la fuente de verdad paralela que advertía la regla general de la tanda.

## F6 · Menú Familia — cerrado

- Migración: `menu_familia_platos.receta_id uuid references recetas(id)` (backfill por
  nombre exacto sin acentos — 0 coincidencias en los 11 platos existentes, no había
  solapamiento de nombres; queda para enlazar a mano o al crear un plato nuevo con nombre
  igual al de una receta).
- Al crear un plato nuevo, si su nombre coincide exacto con una receta, se enlaza solo.
- Badge de coste (`€/rac.` en verde) en el catálogo y en cada celda de la semana cuando el
  plato tiene receta vinculada; "Sin escandallo" en ámbar cuando no.

## Verificación

`npx tsc -b` y `npm run build` limpios.

## Ficheros tocados

- Editados: `src/pages/Carta.tsx`, `src/pages/cocina/ParetoIngredientes.tsx`,
  `src/pages/cocina/ListaCompra.tsx`, `src/pages/cocina/MenuFamilia.tsx`.
- Supabase: `menu_familia_platos.receta_id` (+ backfill, 0 filas enlazadas).

## Orden restante

G (reordenación + restyle) — antes de tocar nada, revisar `docs/BLOQUE_C_CONFIG_COCINA.md`
y este documento: G1 (consolidar Cocina en pestañas) y buena parte de G2 (kit único) ya
los cubrió la sesión paralela D1-D16/C19-31. Solo quedaría auditar G3 (CSS legacy de
impresión) y confirmar que las hojas imprimibles (Marco de Documentos) siguen intactas.
