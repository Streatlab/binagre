# SPEC — Bloque B Conciliación + Facturas

## Contexto
Tras cerrar el fix de matching automático de proveedor, quedan 4 fixes encadenados que tocan flujos de inserción/import de datos. Se agrupan en un solo pipeline porque comparten archivos de hooks y dependencias.

Estado verificado en BD (26 abr):
1. Facturas con `pdf_drive_id` NULL: 4 (Mercadona 240,94€ · Glovo 50,81€ · Glovo 126,46€ · Portier Eats 139,01€)
2. Facturas en estado "pendiente_revision" sin OCR completado: candidatas a "zombie" si no hay timeout
3. Movs Emilio cuenta BBVA pendientes de importar: 51 (excel local del usuario)
4. Matching cross-cuenta Mercadona Emilio 240,94€: factura ya en BD pero sin link a movimiento bancario

## Fixes

### B1 · OCR robusto, sin facturas zombie
- **DADO** una factura subida vía drag&drop o input file
- **CUANDO** el OCR tarda más de 60s o falla
- **ENTONCES** la factura nunca queda en estado intermedio "Procesando" indefinido. Se marca como `error` con `error_mensaje` claro, y aparece un botón "Reintentar OCR" en la UI.
- Implementar timeout de 60s en la llamada a OCR + cron/trigger que cada 5 min marque como `error` cualquier factura en `pendiente_revision` sin `ocr_raw` rellenado y `created_at > 60s atrás`.

### B2 · Re-subir Drive 4 facturas con pdf_drive_id NULL
- **DADO** las 4 facturas identificadas en BD (IDs en sección Datos abajo)
- **CUANDO** se ejecute la función de reparación
- **ENTONCES** se re-suben los PDFs originales a Google Drive (carpeta `Facturas Streat Lab`), se rellenan `pdf_drive_id` y `pdf_drive_url`, y se cambia estado a `pendiente_revision` si no estaba `asociada`.
- Crear botón en UI Facturas: "Reparar facturas sin Drive" que ejecuta esto.

### B3 · Importar excel BBVA Emilio (51 movs)
- **DADO** un excel con movimientos cuenta BBVA Emilio
- **CUANDO** el usuario arrastra el archivo en `/finanzas/conciliacion` con cuenta seleccionada = "BBVA Emilio"
- **ENTONCES** se parsea, se aplica matchProveedor (ya implementado en B1 anterior), y se inserta marcando `cuenta_origen = 'BBVA_EMILIO'` para distinguir de otras cuentas Streat Lab.
- Validar que ImportDropzone soporta selector de cuenta antes de subir el CSV/Excel.

### B4 · Validar matching cross-cuenta Mercadona Emilio 240,94€
- **DADO** una factura recibida por Streat Lab pero pagada desde cuenta de Emilio (caso típico: Emilio paga por adelantado)
- **CUANDO** existe un movimiento bancario en cuenta Emilio con importe = factura.total ± 0,01€ y fecha ± 7 días
- **ENTONCES** el matcher las asocia automáticamente y deja un flag `pagado_por_emilio = true` en la factura.
- Caso concreto a validar: factura Mercadona 240,94€ del 31/03/2026 debe matchear con mov BBVA Emilio del mismo importe.

## Datos relevantes BD
- 4 facturas sin Drive (IDs disponibles para el implementer en query SQL).
- Tabla `cuentas_bancarias` necesita campo `titular` si no lo tiene ya, para distinguir Streat Lab de Emilio.
- Tabla `proveedor_alias` ya tiene 55 alias activos (no tocar).

## No-objetivos
- No tocar el matching de proveedor canónico (B1 anterior, ya cerrado).
- No re-OCRizar las 4 facturas — solo re-subir el PDF a Drive con los datos ya extraídos.
- No abordar carga masiva Q1 2026 (es tarea aparte, viene después).

## Validaciones
1. `npm run build` sin errores.
2. Levantar localhost. NO desplegar Vercel (regla 3 RULES.md).
3. Verificar visualmente:
   - Subir factura de prueba → si OCR tarda >60s ver estado `error` con botón retry.
   - Click "Reparar facturas sin Drive" → 4 facturas pasan a tener pdf_drive_url.
   - Importar excel BBVA Emilio → 51 movs en BD con cuenta_origen correcta.
   - La factura Mercadona 240,94€ aparece como "pagada por Emilio".

## Cierre
Cadena git+pull obligatoria. **NO push a Vercel.** Rubén autorizará deploy explícitamente cuando se vaya a casa.
