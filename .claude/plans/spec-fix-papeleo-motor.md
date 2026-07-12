# SPEC · FIX MOTOR PAPELEO/OCR · 12-jul-2026 · para Claude Code (Opus)

Repo: Streatlab/binagre · rama `trabajo` · NO tocar producción.
Regla Code: no preguntar a Rubén; decidir, documentar y marcar ⚠️ lo arriesgado.
Gate obligatorio antes de dar por hecho: `vitest + tsc + build`. Verificación post-push: deployment READY + releer archivo en repo. Commits atómicos por tarea. Backups `_bk_20260712_*` antes de cualquier migración de datos.

## Contexto (auditoría 12-jul, verificada en BBDD y código)
Motor: `api/_lib/procesarArchivo.ts`, cascada reglas → Tesseract (`ocr-tesseract.ts`) → Mistral (`ocr-mistral.ts`) → Anthropic (`ocr-anthropic.ts`). Hallazgos: 1.416 facturas leídas con API de pago (Just Eat 420, Alcampo 75, Mercadona 26; 162 solo en julio), Tesseract 0 lecturas históricas, solo 22/451 fichas del diccionario con plantilla, `numero_factura` guarda basura ("courier" ×587, "Hora" ×151, "Total" ×45, "Motivo" ×34, fechas) que provoca duplicados falsos (193 marcadas duplicadas sin ningún fichero idéntico). Además, proveedores y gestoría van a enviar TODO por email al buzón: el cartero debe clasificarlo todo.

## Tareas, en este orden

### 1 · Candado de pago real (la API de pago se usa UNA vez por proveedor, solo para crear su plantilla)
- El chequeo `pagoYaUsado` depende de leer el NIF del texto gratuito (`extraerNifEmisorLibre`); en PDFs escaneados no hay texto → no hay candado → paga siempre. Fix: (a) antes de llamar a Mistral/Anthropic, si hay CUALQUIER pista de proveedor (NIF del texto, nombre por patrón de archivo vía `patrones_archivo`, o remitente si viene del cartero), resolver el NIF y comprobar el candado; (b) tras una lectura de pago, comprobar de nuevo: si ese NIF ya tenía `vision_usada=true`, registrar aviso `candado_saltado` en `avisos_papeleo`; (c) `marcarVisionUsada` hace UPDATE sobre `reglas_conciliacion` — si no existe fila para ese NIF debe crearla (upsert), y marcar TAMBIÉN el flag en `diccionario_nif_proveedor` (añadir columnas `vision_usada boolean default false`, `vision_fecha timestamptz` por migración si no existen).
- Cuando el candado bloquea y las reglas no leen → estado `pendiente_lectura_manual` con motivo "plantilla de {proveedor} no funciona, revisar plantilla" (no reintentar pago).

### 2 · Tesseract
Averiguar por qué nunca resuelve (flag `OCR_TESSERACT_ACTIVO` en `ocr-config.ts`, dependencia no instalada en Vercel, timeout, o el texto devuelto no pasa `extraerPorReglas`). Arreglarlo o, si es inviable en serverless, documentarlo en el código y compensar reforzando la tarea 3.

### 3 · Plantillas que aprenden de verdad
Tras cada lectura de pago exitosa, `derivarPlantilla` debe producir una plantilla VERIFICADA: re-ejecutar `extraerPorReglas` sobre el mismo texto con la plantilla recién creada y comprobar que reproduce total/fecha/número. Si no, marcar la ficha con `plantilla_verificada=false` (nueva columna) y aviso "plantilla de {proveedor} no se autovalida". Objetivo: la segunda factura del mismo proveedor NUNCA llega a la API de pago.

### 4 · Número de factura validado
Validación al extraer `numero_factura`: rechazar palabras de lista negra (courier, hora, total, motivo, fecha, importe, cantidad, unidades, iva, base…), rechazar valores que sean solo una fecha, exigir al menos un dígito o formato típico (letras+dígitos, guiones, barras). Si no pasa → `numero_factura = null` (el insert genera `SN-…` y la identidad de duplicado no se activa con basura). Migración de datos: poner a NULL los `numero_factura` existentes que sean lista negra o fecha pura, y re-evaluar las 193 `duplicada` + 247 `posible_duplicado` sin hash coincidente: las que ya no cumplan la identidad real (NIF + nº válido + importe) vuelven al flujo normal de matching (backup previo).

### 5 · Normalizador universal de importes/fechas
En `extractores.ts`: función única que acepte coma o punto decimal, separador de miles, 2-4 decimales, símbolo € delante/detrás/ausente, espacios raros (NBSP), y fechas dd/mm/aaaa, dd-mm-aa, aaaa-mm-dd, "5 de enero de 2026". Todos los extractores y parsers pasan por ella. Tests unitarios con al menos 20 variantes.

### 6 · Regla "nada es no identificable"
Cuando un PDF/CSV con texto digital (no escaneado) acaba en `pendiente_lectura_manual`, guardar en `avisos_papeleo` tipo `lectura_fallida` con los primeros 500 caracteres del texto. Documento digital ilegible = bug visible, nunca silencio.

### 7 · Cartero = clasificador universal (prioridad alta: gestoría y proveedores enviarán TODO al buzón)
En el handler del cartero (`api/_puertas/facturas-index.ts`), antes de mandar cada adjunto a `procesarArchivo`, clasificar por contenido reutilizando detectores existentes, en este orden: (a) `clasificarDocEquipo` → nóminas / resumen nóminas / Seg. Social / RNT → `subidaDocEquipo`; (b) extracto bancario (si `parserBBVA` lo parsea) → resolver titular por NIF/nombre en el texto vía `titular_por_nif`; si no se resuelve, aviso `titular_desconocido` en `avisos_papeleo` y NO procesar como factura; (c) detectores de ventas existentes → Ventas; (d) resto → motor de facturas. Activar `reglas_correo_ocr`: consultar regla por remitente/asunto antes de clasificar; crear/incrementar la regla cuando el clasificador acierte (la gestoría queda aprendida a la primera).

## Verificación final
Procesar en test los 7 proveedores hoy en `pendiente_lectura_manual` y demostrar que con plantilla creada la segunda pasada lee gratis. Simular un email con nómina + factura + CSV de ventas y demostrar que cada adjunto acaba en su módulo. Informe final con decisiones autónomas documentadas.
No tocar módulos fuera de api/_lib, api/_puertas, migraciones y tests.
