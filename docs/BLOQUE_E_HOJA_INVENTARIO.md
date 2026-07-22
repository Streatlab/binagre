# Bloque E · Inventario por hoja + foto — cierre

## Hallazgo previo (importante)

El plan asumía que el flujo viejo de `TabAuto.tsx` (Fase C, "inventario quincenal por
foto") estaba roto porque las tablas `inventarios`/`inventario_lineas` no existían.
**Falso**: existen en Supabase, con esquema completo (`confianza`, `texto_leido`,
`confirmado`, `foto_urls`...) y son la base de `v_inventario_valorado`,
`v_coste_real_periodo` y `v_varianza_ingrediente_periodo` — exactamente las vistas que E3
pide reutilizar. Lo que sí es cierto: **`inventarios` tiene 0 filas en toda la vida del
ERP** — el flujo nunca se ha usado, probablemente porque no había ninguna hoja física de
referencia (solo un botón + subir foto a ciegas, sin saber qué ingredientes contar).

Decisión: no tocar el esquema ni el backend (`leer-conteo`/`confirmar-conteo` en
`api/_puertas/escandallo-auto.ts`, con matching por nombre y confianza) — es correcto,
solo le faltaba una hoja imprimible que lo hiciera usable. Todo el trabajo es de
UI: nueva hoja (E1) + reutilizar el backend existente (E2) + valorar en pantalla (E3) +
retirar el widget viejo de donde vivía, sin backing real (E4).

## Qué se ha hecho

1. **E1 · Hoja imprimible.** Nueva pestaña "Hoja de Inventario" en Cocina → Inventario
   (`src/pages/cocina/TabHojaInventario.tsx`), con el Marco de Documentos (`HojaDoc`, área
   `cocina`) listando los ingredientes activos agrupados por categoría (fuente:
   `categorias_ingredientes`, la corregida en Tanda C), con línea en blanco por ingrediente
   para anotar la cantidad. PDF real con el mismo motor que "Inventario Permanente"
   (`src/lib/marcoDoc.ts`, misma espina/cabecera/paleta/paginado) — botones Imprimir y
   Descargar PDF.
2. **E2 · Subir foto → OCR.** Reutiliza tal cual `action=leer-conteo` de
   `escandallo-auto.ts` (visión Claude, matching por nombre contra `ingredientes`,
   confianza 1/0.7/0). Cero cambios de backend.
3. **E3 · Valoración.** Cada línea leída se valora en pantalla a `coste_neto_std ?? eur_std`
   del ingrediente vinculado (precio vigente); total valorado visible en el botón de
   confirmar. Al confirmar (`action=confirmar-conteo`, tampoco tocado), `estado='confirmado'`
   y las vistas `v_inventario_valorado`/`v_coste_real_periodo`/`v_varianza_ingrediente_periodo`
   quedan alimentadas para el cierre del periodo — visibles en Escandallo → Auto (Fase D),
   que se deja intacta.
4. **E4 · Retirada del flujo viejo.** Borrado de `src/components/escandallo/TabAuto.tsx`:
   bloque JSX "Inventario quincenal por foto", interfaces `Inventario`/`InvLinea`, estado
   `inventario`/`invLineas`, funciones `crearInventario`/`subirFoto`/`borrarLinea`/
   `confirmarInventario`, y las dos queries de `cargar()` que los alimentaban. Fase D
   (coste real + varianza) se queda intacta en el mismo sitio — sigue siendo un dashboard de
   admin, no algo para imprimir.

## DECISIÓN AUTÓNOMA

- **Tabla objetivo**: se mantiene `inventarios`/`inventario_lineas` (no `conteos_inventario`,
  que es un sistema de conteo día a día por teclado ya usado por la pestaña "Conteo físico"
  de la misma página — sistema distinto, no relacionado). Usar la tabla equivocada habría
  dejado `v_varianza_ingrediente_periodo` sin datos para siempre.
- **Ubicación de la nueva pestaña**: dentro de `CocinaInventario.tsx` (área Cocina,
  `/cocina/inventario`), junto a "Conteo físico", no dentro del Escandallo — coincide con
  "área Cocina" del propio enunciado y es donde el personal de cocina ya mira para temas de
  inventario.

## Verificación

`npx tsc -b` y `npm run build` limpios. Sin backfill de datos (tablas objetivo ya
existían, vacías — el primer uso real las llenará).

## Ficheros tocados

- Nuevo: `src/pages/cocina/TabHojaInventario.tsx`.
- Editados: `src/pages/cocina/CocinaInventario.tsx` (4ª pestaña),
  `src/components/escandallo/TabAuto.tsx` (retirada Fase C).

## Orden restante

F (integraciones: Recetario, Menú Engineering, Pareto, Carta, Lista de la Compra, Menú
Familia) → G (reordenación + restyle — nota: sigue pendiente confirmar cuánto de esto ya
cubrió la sesión paralela D1-D16 antes de empezar, para no duplicar).
