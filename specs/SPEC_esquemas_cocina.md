# SPEC · Módulo "Esquemas de Cocina"

## Objetivo
Pantalla en el sidebar de Cocina donde el equipo ve los esquemas de montaje de cada plato, agrupados por gama. Permite dictar platos por voz, guardarlos en Supabase, e imprimir/exportar a PDF y compartir por WhatsApp. Sustituye el Excel manual `12_05_2026.xlsx`.

## Ubicación
- Sidebar Cocina → nueva entrada "Esquemas" (icono layout-grid), debajo de Recetas/Escandallo.
- Ruta: `/cocina/esquemas`
- Archivo página: `src/pages/cocina/Esquemas.tsx`

## Diseño (tokens Streat Lab obligatorios)
Consultar `src/components/panel/resumen/tokens.ts` y `src/pages/PanelGlobal.tsx` ANTES de maquetar. Style guide Notion antes de tocar UI.
- Tabs de gama estilo Facturación (pill, activo fondo #B01D23).
- Tarjeta por plato: cabecera #1e2233 con nombre del plato en blanco centrado; cuerpo card blanco, borde 0.5px #d0c8bc, radius 10px.
- Ingredientes centrados en orden de montaje (arriba→abajo). Cantidad en negrita, ingrediente normal.
- Pasos de acción (MICRO/FREIDORA/SARTÉN/PLANCHA + tiempo) renderizados como píldora oscura, distintos del ingrediente.
- Layout grid responsive 12 col; en móvil colapsa a 1-2 columnas.

## Datos (Supabase — proyecto Binagre `eryauogxcpbgdryeimdq`)
Crear tabla `esquemas_cocina`:
- `id` uuid pk default gen_random_uuid()
- `gama` text  (Asiática, Casera, Green, Italiana, Mexicana, Burgers, Woks, Risottos, Pokes, Entrantes...)
- `nombre` text (nombre del plato)
- `orden_gama` int (orden del plato dentro de la gama)
- `lineas` jsonb  (array ordenado: `[{ "tipo": "ing"|"accion", "texto": "..." }]` — el orden del array ES el orden de montaje)
- `activo` boolean default true
- `created_at` / `updated_at` timestamptz
Sin datos inventados: seed inicial = importar los esquemas reales ya confirmados (Ramen 14, Casera 23, Green 16). Pasar los arrays del script `genall.py` (se adjuntará) a filas reales.

## Dictado por voz
- Botón "Dictar plato" abre modal con `MediaRecorder` (Web Speech API `SpeechRecognition` es-ES como primera opción; fallback subir audio).
- El texto dictado se manda a un parser que:
  1. Detecta nombre del plato (primera frase / "se llama X").
  2. Trocea ingredientes por pausas/comas.
  3. Marca como `accion` toda línea con MICRO/FREIDORA/SARTÉN/PLANCHA/HORNO + tiempo, normalizando formato (ej. "tres minutos microondas" → "MICRO 3 MIN").
  4. Normaliza cantidades a notación corta (c.c., c.s., cup., gr., Uds.).
  5. Mantiene nombres canónicos consistentes (Miso Butter, Sour Cream, Pesto, Guacamole, Furikake...). Usar tabla `ingredientes_canonicos` (text) para autocorrección.
- Resultado editable en el modal antes de guardar (drag para reordenar líneas, toggle ing/acción por línea).

## Exportar
- Botón "PDF": genera el PDF de la gama activa, formato pared — A4 **vertical**, auto-ajuste a 1 página (bajar tamaño de fuente por pasos hasta caber). Blanco y negro, fuente Inter, tarjetas con borde, cantidad en negrita, acciones en píldora. Dos modos: "holgada" (v1) y "compacta" (v2, ingredientes afines en misma línea con ·).
- Botón "Imprimir": `window.print()` con `@media print` replicando el PDF.
- Botón "WhatsApp": genera PDF, súbelo a storage y abre `https://wa.me/?text=<url>` o usa share API.

## Reglas
- base_imponible / IVA no aplica aquí (no hay importes).
- Cualquier número que se muestre, redondeado.
- Persistencia: nunca sobrescribir un esquema sin guardar versión previa (campo `updated_at` + histórico opcional).
- Aislamiento absoluto: solo repo Binagre, solo Supabase Binagre. Nunca David.

## Criterio de éxito
1. Entras en /cocina/esquemas, ves tabs de gama y las tarjetas reales (Ramen/Casera/Green ya seedeadas).
2. Dictas un plato nuevo, lo editas, lo guardas → aparece en su gama desde Supabase.
3. Exportas PDF vertical 1 página, imprimes, y compartes link por WhatsApp.
