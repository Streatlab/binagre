# Handoff · Reforma Escandallo/Cocina/Robots — Tandas 4-6 pendientes

Rama: `claude/escandallo-auto-ingesta-2tu34i` · PR #25 · Supabase `eryauogxcpbgdryeimdq`.
Retomar en sesión fresca leyendo este archivo primero. Modo silencio, gate verde
(`npm run build`) antes de cada commit, `[deploy]` solo en el último de cada grupo.

## Estado (hecho y verificado, en el PR #25, build verde)

- **Tanda 1 · BLOQUE H (robots):** H7 semáforo honesto (rojo >24h/fallo, columna `que_hace`) ·
  H3 justeat-portal jubilado (matriz + semáforo; lo cubre justeat-mail) · H2 verificado
  (glovo ya usa `/finance`) · H4 backoff de recogida de Uber hasta 45 min + dump de auditoría ·
  H6 cron `facturas_lineas_contable_tick` (drena el extractor contable ya existente, origen
  `ocr_anthropic`, nunca pre-crea ingredientes) · H5 bandeja ya drenada · lanzador con
  `workflow_dispatch` (disparo manual, ya existía). Detalle: `docs/BLOQUE_H_ROBOTS.md`.
  **Pendiente vivo (Rubén):** relanzar la tanda de robots desde Actions con credenciales.
- **Tanda 2 · BLOQUE A+B (cerrado):** A1 IDING obligatorio + propuestas por similitud
  (`fn_procesar_linea_factura`, `fn_aceptar/rechazar_propuesta`) · A6 backfill IDING (0 sin
  IDING) + dedup · A5 pestaña Equivalencias (CRUD + propuestas) · A2 un solo botón · A3 campos
  ámbar · A4 pre-creados compactos 20/pág · B1 dictado voz (MicDictado) · B2 usos sin N+1 ·
  B3 paginación · B4 alérgenos por diccionario local · B5 herencia de alérgenos
  ingrediente→EPS→receta · B6/B7/B8/B9/B10. Detalle: `docs/BLOQUE_A_B_TANDA2.md`.
- **Tanda 3 · BLOQUE D (waterfall):** waterfall VIVO extraído a `src/utils/waterfallReceta.ts`
  (sin cambiar fórmula) + `tests/waterfall.test.ts` (13 casos, corre en el build). Auditoría:
  `docs/BLOQUE_D_WATERFALL.md`. **Divergencias de pricing dejadas SIN tocar** (afectan al PVP
  de cara al cliente, RULES.md §8): merma fuera del coste, fees fijos ignorados, comisión base
  vs neto real por canal (`netoResolver`/LEY-NETO-01), snapshots sin recálculo. Necesitan
  decisión de Rubén antes de unificar.

## Orden restante: C → E → F → G

### Tanda 4 · C (configurables) — EMPEZAR AQUÍ

**DUDA BLOQUEANTE A RESOLVER PRIMERO (leyendo código, no preguntando a Rubén):**
la **fuente de verdad** de categorías y unidades. Existen a la vez:
- `configuracion` (key-value JSON, claves `categorias` y `unidades`) — probablemente lo que
  lee `src/hooks/useConfig.ts` y alimenta los desplegables de ModalIngrediente.
- Tablas dedicadas: `categorias_ingredientes`, `categorias_ingredientes_config`,
  `unidades_relacion`, `proveedores`, `proveedor_alias`.

**Acción:** leer `src/hooks/useConfig.ts` y ver de dónde saca `categorias`/`unidades`/
`estructura_pct` los desplegables reales. Construir el CRUD sobre **esa** fuente (la que la
app consume de verdad), NO sobre la otra, para no crear una UI desconectada (el spec prohíbe
duplicar fuentes). Si la app lee el JSON de `configuracion`, el CRUD escribe ahí; si lee las
tablas, sobre las tablas. Documentar la decisión.

Tareas C: C1 categorías CRUD · C2 unidades CRUD · C3 proveedores CRUD (respetando
`proveedor_alias`/`fn_prov_canon`) · C4 selector de formato de números que alimenta el helper
global (`configuracion` no tiene aún clave `formato_numeros` — habría que crearla y que
`src/utils/format.ts` la lea). Nueva sección "Cocina" dentro de Configuración.

### Tanda 5 · E (inventario por hoja + foto)
E1 hoja imprimible "Hoja de Inventario" con el Marco de Documentos (HojaDoc, área Cocina) ·
E2 botón "Subir foto" → OCR (mismo patrón de facturas) lee cantidades manuscritas · E3 valora
al precio vigente + coste neto del periodo (reutilizar `v_varianza_ingrediente_periodo`) ·
E4 eliminar el flujo antiguo "inventario por foto" y el botón "Empezar inventario de hoy" roto
(ambos en `TabAuto.tsx`, sección Fase C).

### Tanda 6 · F (integraciones)
F1 Recetario (EPS/recetas de escandallo aparecen solas) · F2 Menú Engineering consume coste
real del escandallo · F3 Pareto Ingredientes desde consumo real · F4 Carta enlaza plato→receta
(badge ámbar "sin escandallo") · F5 Lista de la Compra desde activos+stock+consumo · F6 Menú
Familia con costes del escandallo. Completar lo parcial, no duplicar fuentes de verdad. (Ojo:
F2/F3 ya tienen piezas en el "cuadro de mando" de TabAuto — `v_margen_plato`,
`v_escandallo_pareto_compras` — reutilizar.)

### Tanda 7 · G (reordenación + restyle)
G1 consolidar submódulos de Cocina en pestañas (patrón Producción), rutas antiguas con
redirect · G2 migrar TODO Cocina al kit Neobrutal Alegre v5-B respetando la FRONTERA: las
hojas imprimibles (Producción, Esquemas, Lista Compra hoja, Fichas EP/Receta, Hoja de
Inventario nueva) siguen con el Marco de Documentos · G3 limpiar CSS legacy de impresión.
LEY de estilo: v5-B para el chrome de la app; Marco (HojaDoc) solo para superficies-hoja;
jamás mezclar; jamás `#B01D23` dentro de una hoja.

## Ficheros clave (mapa rápido)
- Escandallo: `src/pages/Escandallo.tsx` (tabs), `src/components/escandallo/*`
  (TabIngredientes, TabAuto, TabEquivalencias, ModalIngrediente/EPS/Receta, estilosTabla.ts).
- Config: `src/hooks/useConfig.ts`, `src/pages/configuracion/*`, tabla `configuracion`.
- Waterfall/coste: `src/utils/waterfallReceta.ts` (vivo), `src/lib/panel/netoResolver.ts`
  (LEY-NETO-01), `docs/LEY_NETO.md`.
- Kit visual: `src/styles/neobrutal.ts` (fuente), `src/styles/kit.ts` (compat v5-B).
- Ordenación tablas: `src/hooks/useMultiSort.ts` + `src/components/ui/SortableHeader.tsx`.
- Ingesta (motor): `api/_puertas/escandallo-auto.ts`; extractor contable:
  `api/_puertas/facturas-index.ts` (`action=extraer-lineas`).
