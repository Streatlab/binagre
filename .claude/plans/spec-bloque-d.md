# SPEC — Bloque D · Drop facturas masivo con OCR + auto-conciliación + Drive

## Contexto
Hoy hay módulo "Importar Facturas" pero subes facturas de una en una, y la asociación a movimientos bancarios es manual. Necesitamos:

1. Subir PDFs masivos (drag&drop 50 facturas).
2. OCR procesa cada PDF en background.
3. Auto-conciliación factura ↔ movimiento bancario por (importe + fecha ±3 días + proveedor).
4. PDF renombrado automáticamente y subido a Drive en su carpeta correcta.
5. Movimiento bancario muestra icono 📎 → click → abre PDF en Drive.

## Constantes cerradas (NO preguntar)
```ts
// NIFs titulares para detectar quién es el cliente en la factura
const NIF_RUBEN = '21669051S'
const NIF_EMILIO = '53484832B'
const RUBEN_ID = '6ce69d55-60d0-423c-b68b-eb795a0f32fe'
const EMILIO_ID = 'c5358d43-a9cc-4f4c-b0b3-99895bdf4354'

// Drive Folder IDs (ya existentes)
const DRIVE_OPERACIONES_ID = '1dB6REknvNl8JxGGuv8MXloUCJ3_evd7H'
// Subcarpeta target: 05 OPERACIONES → 05 FACTURAS RECIBIDAS → [EMILIO|RUBÉN] → [Año] → [1T-4T] → [Mes] → [PLATAFORMAS|PROVEEDORES]

// OAuth conectado
const GOOGLE_USER = 'rubenrodriguezvinagre@gmail.com'

// Lista cerrada de proveedores que cuentan como PLATAFORMA (resto = PROVEEDOR)
const PLATAFORMAS = [
  'uber eats', 'uber bv', 'portier eats',
  'glovo', 'glovoapp',
  'just eat', 'takeaway',
  'rushour',
]
```

## Criterios DADO/CUANDO/ENTONCES

### CA-1 · Drag&drop masivo
- DADO 50 PDFs arrastrados a la zona drop del módulo Importar Facturas
- CUANDO se sueltan
- ENTONCES se suben todos al storage temporal y aparecen en lista con estado "Procesando OCR" + barra progreso global.

### CA-2 · OCR + extracción automática
- DADO un PDF en estado "Procesando OCR"
- CUANDO el OCR (proveedor existente) termina
- ENTONCES extrae: fecha factura, nº factura, NIF cliente, NIF emisor, nombre emisor, base imponible, IVA, total. Guarda en tabla `facturas`.

### CA-3 · Detección titular automática
- DADO una factura con NIF cliente extraído
- CUANDO se compara contra las constantes
- ENTONCES:
  1. Si NIF cliente = '21669051S' → titular_id = RUBEN_ID
  2. Si NIF cliente = '53484832B' → titular_id = EMILIO_ID
  3. Si NIF cliente NO matchea ni es vacío → estado = "pendiente_titular_manual" (selector aparece en UI)

### CA-4 · Detección plataforma vs proveedor
- DADO el nombre del emisor extraído
- CUANDO se compara contra la lista PLATAFORMAS (case-insensitive, includes)
- ENTONCES:
  1. Match → carpeta destino "PLATAFORMAS"
  2. No match → carpeta destino "PROVEEDORES"

### CA-5 · Auto-conciliación con movimiento
- DADO una factura con titular + total + fecha extraídos
- CUANDO se busca movimiento candidato en `conciliacion`
- ENTONCES:
  1. Filtro: `titular_id = factura.titular AND ABS(importe) = factura.total AND fecha BETWEEN factura.fecha - 3d AND factura.fecha + 15d`
  2. Score adicional: si `proveedor` del mov coincide con emisor factura → +50 puntos
  3. Si UN candidato → asociación automática (estado = "asociada")
  4. Si VARIOS candidatos → estado = "pendiente_match_manual" + lista candidatos en UI
  5. Si NINGUNO → estado = "sin_match" + opción crear movimiento manual

### CA-6 · Renombrado y subida a Drive
- DADO una factura procesada con datos completos
- CUANDO se confirma asociación (auto o manual)
- ENTONCES:
  1. Renombra PDF a `DD-MM-YYYY_Emisor_NumFactura_Total€.pdf` (sanitizar caracteres ilegales)
  2. Crea cadena de subcarpetas si no existen: `[TITULAR]/[YYYY]/[1T-4T]/[01 ENERO..12 DICIEMBRE]/[PLATAFORMAS|PROVEEDORES]/`
  3. Sube PDF renombrado a esa subcarpeta
  4. Guarda en BD: `facturas.pdf_drive_id` (ID Drive) + `facturas.pdf_drive_url` (link viewable) + `facturas.pdf_filename` (nombre nuevo)
  5. Actualiza `conciliacion.factura_id` del movimiento asociado

### CA-7 · Icono 📎 en Conciliación
- DADO un movimiento conciliado con factura
- CUANDO se muestra en `/finanzas/conciliacion`
- ENTONCES aparece icono 📎 al final de la fila → click → abre `pdf_drive_url` en pestaña nueva.

### CA-8 · Reglas de fallback (DECISIONES AUTÓNOMAS)
1. Si OCR falla totalmente → estado "ocr_fallido" + botón "reintentar OCR" en UI.
2. Si Drive API falla al subir → mantener PDF en storage temporal + estado "drive_pendiente" + reintento automático cada 10 min hasta 3 intentos.
3. Si trimestre no detectable de la fecha → calcular: `1T = ene-mar, 2T = abr-jun, 3T = jul-sep, 4T = oct-dic`.
4. Si mes en español: usar mapping `[01 ENERO, 02 FEBRERO, ..., 12 DICIEMBRE]`.

## Diseño técnico

### BD (lib/supabase migrations)
1. Verificar columnas en `facturas`: `pdf_drive_id`, `pdf_drive_url`, `pdf_filename`, `nif_cliente`, `nif_emisor`, `titular_id`, `categoria_factura` (enum: 'plataforma' | 'proveedor'), `estado` (extender con: 'pendiente_titular_manual', 'pendiente_match_manual', 'sin_match', 'ocr_fallido', 'drive_pendiente', 'asociada').
2. Si faltan, generar migración. Si están todas, no hacer nada.

### Cliente Google Drive `src/lib/drive.ts` (NUEVO o ampliar existente)
1. `findOrCreateFolder(parentId, name)` — busca subcarpeta por nombre, la crea si no existe.
2. `uploadPdf(localFile, targetFolderId, newName)` — sube PDF.
3. `getViewUrl(fileId)` — devuelve URL pública viewable.

### Pipeline `src/lib/facturas/procesar.ts` (NUEVO)
1. Pipeline async por factura:
   - OCR → extraer campos
   - Detectar titular (NIF) → titular_id
   - Detectar categoría (plataforma vs proveedor)
   - Buscar candidato movimiento
   - Renombrar archivo
   - Subir a Drive
   - Actualizar BD con todos los IDs

### UI `src/pages/finanzas/Facturas.tsx` (modificar existente)
1. Drag&drop multi-archivo.
2. Lista con estado por factura + barra progreso global.
3. Vista filtrada por titular (chips Todos/Rubén/Emilio existentes — mantener).
4. Selectores manuales cuando estado = pendiente_*.
5. Click factura → modal detalle con preview PDF + datos extraídos + botón "abrir en Drive".

### UI `src/pages/finanzas/Conciliacion.tsx` (modificar)
1. Columna nueva con icono 📎 si `factura_id IS NOT NULL`.
2. Click icono → abre `pdf_drive_url` en _blank.

## No-objetivos
- NO renombrar facturas YA subidas a Drive (solo nuevas).
- NO procesar facturas existentes en BD retroactivamente (los 5 movs actuales se quedan como están).
- NO crear sistema de aprobación/firma de facturas (out of scope).
- NO descargar facturas desde Drive (solo subida).

## Validaciones
1. `npm run build` 0 errores.
2. Subir 5 PDFs reales drag&drop → ver lista con barra progreso → al terminar, 5 estados finales correctos.
3. Una factura con NIF cliente '53484832B' aparece en Drive en `EMILIO/2026/2T/04 ABRIL/PROVEEDORES/`.
4. Una factura Uber Eats con NIF Rubén aparece en `RUBÉN/2026/2T/04 ABRIL/PLATAFORMAS/`.
5. Movimiento bancario asociado tiene icono 📎 → click → abre PDF en Drive.

## Cierre
git+pull. NO Vercel.
