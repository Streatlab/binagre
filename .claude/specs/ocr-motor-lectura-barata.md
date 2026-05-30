# SPEC · OCR motor de lectura barato (lectura directa + modelo solo de red)

Objetivo de negocio: que procesar facturas por OCR cueste céntimos, no decenas de euros.
Hoy cada PDF se manda entero al modelo de IA (caro). Queremos leer el texto del PDF gratis,
sacar los datos con reglas, y usar el modelo SOLO cuando las reglas no puedan.

## Orden de lectura objetivo (de barato a caro)
1. **Texto del PDF (gratis).** Si el PDF tiene capa de texto, extraerla sin IA.
2. **Extractor por reglas (gratis).** Del texto, sacar: nif_emisor, fecha_factura, total, numero_factura,
   tipo (proveedor/plataforma), plataforma. Reglas universales:
   - NIF/CIF español: regex `[A-Z]?\d{7,8}[A-Z0-9]` validando formato CIF/NIF.
   - Total: buscar "TOTAL", "Total factura", "Importe total", "A pagar" + número con , o . decimal.
   - Fecha: varios formatos (dd/mm/yyyy, yyyy-mm-dd, dd-mm-yy), normalizar a YYYY-MM-DD.
   - Plataforma: si nif_emisor o nombre coincide con Uber/Portier (B88515200), Glovo (B67282871,
     B66598764), Just Eat (B86008539) → tipo=plataforma + plataforma correcta.
   - Diccionario NIF→nombre canónico: si el NIF ya existe en tabla `proveedores`, usar ese nombre
     (evita "GLOVO" / "GLOVOAPP23 S.L." / "GLOVOAPP SPAIN" como 3 proveedores distintos).
3. **Modelo IA (Haiku, de pago) SOLO si:** las reglas no devuelven los 3 mínimos
   (nif_emisor/proveedor + total + fecha). Mandar el TEXTO (no el PDF entero) para abaratar.
4. **Modelo IA con imagen (vision) SOLO si:** el PDF no tiene texto (escaneado).

## Tope de gasto duro (anti-sangría)
- Variable de entorno `OCR_MAX_LLAMADAS_MODELO_POR_LOTE` (default 200). Si un lote supera ese
  nº de llamadas al modelo, cortar el lote y devolver aviso "tope de gasto alcanzado".
- Si una sesión acumula >50 errores seguidos del modelo, abortar la sesión automáticamente.
- Nunca reintentar la misma factura en bucle: 1 intento de reglas + máx 1 intento de modelo.

## Anti-factura-zombie
- NO crear la fila en `facturas` con estado 'procesando' antes de tener los datos.
  Extraer datos primero (reglas o modelo); solo insertar cuando haya proveedor + total + fecha.
- Si todo falla → devolver estado 'error' SIN crear fila (o crear fila estado 'error' con
  motivo claro, pero nunca dejar 'procesando' colgado).

## Limpieza de sesiones (anti-leak Supabase)
- Al terminar/cancelar un lote: vaciar `archivos_pendientes` de la sesión y marcar estado final.
- Job/limpieza: borrar `ocr_sessions` con estado final y antigüedad > 24h.

## Archivos a tocar (leer el real antes de editar)
- `package.json` → añadir dependencia de lectura de texto PDF (pdf-parse o pdfjs-dist, la que
  compile limpio en Vercel Node). Instalar.
- `api/_lib/extractores.ts` → nueva `extraerTextoPDF(buffer)` + `extraerPorReglas(texto, supabase)`.
- `api/_lib/procesarArchivo.ts` → caso 'pdf': intentar texto → reglas → modelo (en ese orden).
  Reordenar para no crear factura zombie. Mantener toda la lógica de titulares/Drive/matching ya
  existente intacta.
- `api/_lib/ocr.ts` → ya fuerza Haiku (no tocar el modelo). Respetar.

## Criterio de éxito (verificar al final)
1. `npm run build` y `tsc` en verde, 0 errores.
2. Procesar 1 PDF de texto de Uber/Glovo/Lactalis → 0 llamadas al modelo (resuelto por reglas).
3. Procesar 1 PDF escaneado → 1 llamada vision al modelo, factura creada OK.
4. Forzar fallo total → NO queda fila 'procesando' en `facturas`.
5. Confirmar deploy READY en Vercel con el SHA del commit.

## Tope de intentos
Máx 3 iteraciones para dejar el build en verde. Si tras 3 sigue roto, parar y reportar el error
exacto sin seguir tocando.
