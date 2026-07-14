// autoCategorizar.ts — VACIADO el 12-jul-2026.
//
// Este fichero tenia 36 reglas de autoclasificacion escritas a mano, y 24 de ellas
// apuntaban a categorias que ya NO EXISTEN tras la unificacion de 65 -> 33
// (Alcampo 2.11.2, Carrefour 2.11.3, Lidl 2.11.5, Coca-Cola 2.11.6, Workana 2.23.1,
// Sinqro 2.43.3, Flynt 2.43.5, Anthropic 2.43.6, Ben Menjat 3.6, luz/gas/agua/telefono
// 2.44.1/3/4...). Era una bomba: el dia que alguien lo importara, empezaria a asignar
// categorias invalidas y la base de datos las rechazaria.
//
// Los 38 proveedores que vivian aqui (Alcampo, Carrefour, Lidl, Dia, Pascual, Lactalis,
// Fritravich, Prodesco, TGT, Jasa, China Cayente, Pampols, Bolsemack, Envapro, Punto Q,
// Workana, Rushour, Sinqro, Flynt, Think Paladar, Savour...) se han movido a la tabla
// `reglas_conciliacion` de Supabase, que es donde deben estar.
//
// LEY: las categorias NO se escriben en el codigo. Viven en la base de datos:
//   - categorias_pyg            -> las 33 categorias
//   - reglas_conciliacion       -> patron sobre el concepto del banco -> categoria
//   - diccionario_nif_proveedor -> NIF -> proveedor + categoria
//   - patrones_archivo          -> nombre del fichero -> proveedor + categoria
//
// El motor real de categorizacion es `api/_lib/matching.ts` (que lee de la BD) y los
// triggers `fn_categorizar_cascada` y `fn_aplicar_reglas_conciliacion`. Ninguno usa
// este fichero. No lo vuelvas a llenar de categorias.

export {}
