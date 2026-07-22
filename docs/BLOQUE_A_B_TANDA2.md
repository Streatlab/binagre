# Tanda 2 · Bloque A (equivalencias/antiduplicado) + Bloque B (tabla) — estado

## Entregado y verificado

- **A1 · IDING obligatorio.** El motor pre-crea SIEMPRE con IDING vía `fn_siguiente_iding()`
  (ING### atómico con advisory lock). `fn_procesar_linea_factura` actualizado.
- **A6 · Backfill + dedup.** Asignado IDING a los 591 ingredientes que no tenían (ahora 0
  sin IDING, hasta ING940). Fusionados los 12 grupos de borradores con nombre normalizado
  idéntico (0 grupos duplicados restantes) vía `fn_fusionar_borrador`.
- **Infra antiduplicado.** `fn_norm_ingrediente(text)` (minúsculas, sin acentos, sin dobles
  espacios) — base de las propuestas de fusión y del índice único futuro.
- **A5 · Pestaña Equivalencias.** Nueva pestaña en Escandallo: ver/buscar/crear/editar/borrar
  los mapeos `producto_ingrediente_map` (texto+proveedor → ingrediente), con buscador,
  contador y estilo Neobrutal. `src/components/escandallo/TabEquivalencias.tsx`.
- **A2 · Un solo botón.** Eliminado "Procesar 1 factura"; queda solo "Procesar todo
  (en 2º plano)".
- **B9 · Aspa ✕ en el buscador.** Añadida a `CabeceraEscandallo` (compartida por todas las
  pestañas del Escandallo) y al buscador de Equivalencias.

## Pendiente en Tanda 2 (siguiente iteración — no entregado aún)

Bloque A+B es muy grande; lo que falta, itemizado para no dar por hecho lo que no está:

- **A1 (propuestas por similitud).** Falta que, sin match exacto, la ingesta cree una
  PROPUESTA de equivalencia (candidato claro por similitud) en vez de pre-crear, y solo
  pre-cree si no hay nada parecido. Requiere columna `estado` en `producto_ingrediente_map`
  y aceptar/rechazar en la pestaña Equivalencias. (La base — `fn_norm_ingrediente` + la
  pestaña — ya está.)
- **A3 · Campos en ámbar.** Pintar en ámbar los campos vacíos/dudosos (categoría, unidad,
  alérgenos, formato) en la tabla de ingredientes y en pre-creados.
- **A4 · Pre-creados compactos.** Rediseñar la lista de borradores como tabla densa paginada
  (20/pág) con chips ámbar de lo que falta.
- **Bloque B restante:** B1 (dictado Web Speech + ocultar si no soporta), B2 (contador de
  usos agregado), B3 (paginación server-side de Ingredientes <1s), B4 (sugerir alérgenos por
  diccionario local, sin IA externa), B5 (herencia de alérgenos a EPS/recetas), B6/B7 (scroll
  horizontal + tooltips + columnas), B8 (ordenación por columnas reutilizando `SortableHeader`
  de Papeleo), B10 (separadores de miles — ya se usa `fmtEur`/`fmtNum` en el módulo).
