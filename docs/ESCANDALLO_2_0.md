# ESCANDALLO 2.0 — Fases A · C · D (17-jul-2026)

Rama: `trabajo` · Sin merge a master. Tarea Notion: BINAGRE-ERP "Escandallo 2.0".

## Fase A — Facturas → ingredientes/precios automáticos
- BBDD: `fn_procesar_linea_factura` + trigger en `facturas_lineas` (origen ocr/ocr_reproceso).
  - Match SOLO por diccionario aprendido `producto_ingrediente_map` (texto+proveedor exactos). LEY-ANTIFALSOS: sin fuzzy para cargar precios.
  - Con match: rota precio1→2→3, `precio_activo` según `selector_precio` (ultimo/media), recálculo en cadena POR FACTOR (ingredientes → eps_lineas → eps → recetas_lineas → recetas), alerta en `alertas_precio` si |var| ≥ `configuracion.alerta_precio_pct` (8%).
  - Sin match: pre-crea ingrediente `borrador=true, origen='factura_ocr', activo=false` + entrada en el mapa + tarea en `tareas_erp` (columna 'pendiente', etiqueta ESCANDALLO).
  - Guard de categoría: solo facturas con `categoria_factura` en prefijos `configuracion.estructura_excluir_prefijos` (2.11 alimentación / 2.12 envases).
- API: `api/_puertas/escandallo-auto.ts` (puerta papeleo, ruta `/api/papeleo/escandallo-auto/<action>`).
  - `extraer-lineas`: PDF desde Drive → visión Anthropic → validación suma±0,05€ contra total (si no cuadra, NO inserta: `lineas_estado='sin_detalle_lineas'`).
  - Lotes pequeños (máx 10) bajo demanda: el coste lo dispara siempre Rubén.
- Bugs heredados corregidos: FK `precios_ingredientes.factura_id`→conciliacion (eliminada), check `tareas_erp.columna` en minúsculas.

## Fase C — Inventario quincenal por foto
- `inventarios` (+tipo/foto_urls/origen/confirmado_at) e `inventario_lineas` (+ingrediente_id/confianza/confirmado/texto_leido).
- `leer-conteo`: foto → visión → líneas con match (exacto=1, parcial único=0.7, resto sin vincular=0) → confirmación humana.
- `confirmar-conteo`: inventario `estado='confirmado'`; líneas sin vincular quedan fuera de valoración.
- `fn_pmp_ingrediente` (PMP por entradas de compra) · `v_inventario_valorado` · `v_coste_real_periodo` (Ini + Compras − Fin entre inventarios confirmados).

## Fase D — Varianza y estructura real
- `v_varianza_ingrediente_periodo`: consumo teórico (ventas_plato × recetas) vs real (inventarios) en unidades y en € (a PMP).
- `v_estructura_real_pct`: gastos de estructura (excluye prefijos 2.11/2.12) ÷ ingresos, últimos 3 meses CON ingresos; NULL fuera de 0-80% (LEY-ANTIFALSOS). Frontend cae a manual si NULL.
- `useConfig`: `estructura_fuente` ('running'|'manual', clave en `configuracion`).
- TabRecetas: margen por 5 canales con claves canónicas de `calcNetoPorCanal` (uber/glovo/je/web/dir) en modo 'plato'.

## UI
- Pestaña **Auto** en Escandallo: KPIs, procesar lote, alertas de precio, borradores (abren ModalIngrediente), inventario por foto, cierre de periodo y varianza.

## Pendiente
- Fase B: links de cartas por marca → pre-crear recetas con PVPs (esperando links de Rubén).
- Prueba real: 1 lote de facturas + 1 inventario completo.
