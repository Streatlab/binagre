# Documento macro de trabajo — OCR / Conciliación Binagre

Documento vivo. Cada punto: **Estado → Propuesta → Resolución → Refix**.
Estados: 🔴 ACTIVO · 🟡 EN CURSO · 🟢 RESUELTO · ⚪ PARADO.

Regla absoluta del sistema: **coste OCR = 0 € siempre**. Cero API de pago. Lectura solo por reglas/plantillas + Tesseract local. Lo que no se pueda leer gratis va a lectura manual con el PDF en Drive.

---

## RESUELTO HOY (02/06/2026)

### E-01 · Fuente única de verdad del estado "conciliada" 🟢
- **Estado**: existían 5 banderas distintas para "conciliada"; cada pantalla daba una cifra diferente y el % salía inflado.
- **Propuesta**: una sola definición de estado real, derivada del vínculo real factura↔movimiento.
- **Resolución**: creada vista `v_estado_factura` + función de agregados `ocr_agregados_facturas`. Las cards de OCR ahora leen de ahí. Dato real destapado: 7.161 facturas, solo 18 conciliadas de verdad, 1,53 M€ pendientes.
- **Refix**: ninguno. Build verde.

### F-01 · Bandeja de posibles duplicados de facturas 🟢
- **Estado**: el sistema solo deduplica por archivo idéntico (mismo PDF). Riesgo de doble gasto si la misma factura entra como dos PDFs distintos.
- **Propuesta**: detectar duplicado lógico (mismo nº + NIF + importe) sin borrar nunca; marcar para revisar.
- **Resolución**: control automático en base de datos (trigger). Aplicado a las 7.161 actuales: 56 marcadas como posible duplicado. Nunca borra. Quinta card "Duplicados" en OCR con botón "Revisar bandeja". Resolución: botón "Borrar" (si sobra) o "No es duplicado" (si las dos son legítimas → aprende y no vuelve a avisar, vía RPC marcar_no_duplicado + columna duplicado_revisado).
- **Refix**: ninguno.

### CARTERO · Lectura del buzón por correo 🟢
- **Estado**: el cartero entraba por el conector OAuth de Drive, que no tiene permiso de Gmail → "insufficient scopes", solo cogía 7 de 24, con límite de 25.
- **Propuesta**: leer por IMAP con la contraseña de aplicación de facturasstreat@gmail.com, independiente del conector; sin límite; no releer; mover lo procesado a carpeta "Procesadas".
- **Resolución**: cartero reescrito a IMAP. Sin límite (barre todo). Mueve cada correo procesado a "Procesadas" del propio Gmail. Marca cada factura como origen-correo (para la card y su filtro). Actualiza estado del buzón. Probado en vivo: leyó 3 correos / 5 adjuntos, los movió, detectó duplicados correctamente.
- **Refix**: la card "por correo" leía de una tabla vieja (`ocr_sessions`, grupo g_correo) y mostraba 24 fijo sin filtrar → reescrita para contar y filtrar desde origen-correo real.

### CARTERO · Entrada al instante + automático 🟢
- **Estado**: las facturas del correo solo entraban al disparar el barrido a mano.
- **Propuesta**: botón "Recoger ahora" + barrido automático diario.
- **Resolución**: botón "Recoger correo ahora" en la card de OCR (barrido al instante). Cron de Vercel a las 07:00 hora de Madrid (05:00 UTC) cada día.
- **Refix**: pendiente confirmar primer disparo automático del cron mañana 07:00.

### DIAGNÓSTICO · Las 17.732 subidas 🟢
- **Estado**: el modal contó 17.732 archivos y solo entraron 7.161; sospecha de pérdida masiva.
- **Resolución**: verificado con el registro real (ocr_auditoria, 32.963 eventos). Del lote: 7.158 archivos distintos por contenido = las 7.161 facturas actuales. El resto (~10.268) eran el MISMO archivo repetido (mismo contenido byte a byte). 0 hashes duplicados internos. **No hay facturas perdidas.** Los 443 "error" = 274 que la IA de pago vieja no leyó (recuperables gratis) + 169 duplicados de hash.
- **Refix**: ninguno. Conclusión: el dedup de facturas es por archivo idéntico (seguro), no por contenido.

---

## PENDIENTE

### MULTI-FACTURA · Varias facturas / varias páginas en un mismo PDF 🔴 (PRIORIDAD 1)
- **Estado**: HALLAZGO CLAVE de Rubén (02/06). Muchos PDF contienen VARIAS facturas dentro, y muchos tienen varias páginas. Hoy el motor lee 1 PDF = 1 factura (procesarArchivo + extraerPorReglas), así que coge solo un importe y pierde el resto → causa principal de las ~1.964 facturas sin importe y de descuadres. Son "de todo": (a) varias facturas con su "Factura nº" dentro del mismo PDF, (b) una factura por página, (c) recapitulativas (muchas líneas, un único total = UNA factura).
- **Riesgo**: el dedup actual es por hash de archivo (1 PDF = 1 hash = 1 factura). Partir un PDF en N facturas rompe esa regla: hay que crear N filas desde el mismo archivo con un identificador por sub-factura (p. ej. hash_archivo + índice/nº interno), manteniendo intacto el antiduplicado. Hacerlo mal duplica o pierde datos contables. NO desplegar a ciegas: requiere un PDF real de muestra y prueba.
- **Propuesta**: detección automática de los 3 casos. Sobre el texto del PDF (capa de texto o Tesseract): contar ocurrencias de "Factura nº/Nº factura/Albarán"; si hay varias con totales propios → partir en bloques y procesar cada bloque como factura (mismo NIF emisor); si hay una sola con muchas líneas y un total → recapitulativa (1 factura). pdf_hash de sub-factura = sha256(archivo)+sufijo nº interno para no colisionar.
- **Resolución**: — (pendiente de un PDF de ejemplo de Rubén para fijar el patrón de corte).
- **Refix**: —

### REPROC · Reproceso gratis de las facturas sin leer 🔴
- **Estado**: ~1.964 facturas con importe 0/null (todas con PDF en Drive), de cuando la IA de pago se quedó sin créditos. Job de reproceso `solo_sin_leer` creado (relee solo esas con Tesseract, no toca las conciliadas, tope anti-bucle por total_objetivo). Endpoint y job listos.
- **BLOQUEADO POR**: MULTI-FACTURA. Muchas de esas sin-leer son justo los PDF con varias facturas dentro; conviene releerlas con el motor que las parte bien, NO antes. No lanzar el reproceso hasta resolver multi-factura.
- **Resolución**: — (job creado, en pausa).
- **Refix**: —

### B-01 · Dedup del banco (conciliación) 🔴
- **Estado**: el extracto bancario deduplica por contenido (titular+fecha+importe+concepto) y puede colapsar movimientos legítimos iguales (repartidores, importes pequeños repetidos).
- **Propuesta**: no colapsar movimientos legítimos; lo dudoso a bandeja revisable, nunca borrar.
- **Resolución**: —
- **Refix**: —

### D · Matching único factura↔movimiento 🔴
- **Estado**: dos motores de matching distintos que no casan entre sí (lado factura vs lado ingreso plataforma).
- **Propuesta**: un único motor de matching coherente.
- **Resolución**: —
- **Refix**: —

### C · Categorización coherente 🔴
- **Estado**: el tipo (ingreso/gasto) se deriva del signo, no de la categoría real.
- **Propuesta**: categorización por regla/categoría, no por signo.
- **Resolución**: —
- **Refix**: —

### ROBUSTEZ · Periodos, Drive, deploy 🔴
- **Estado**: desfase horario en el cálculo de periodos (UTC vs Madrid); token de Drive que caduca sin aviso claro; sin guard de deploy.
- **Propuesta**: fijar zona horaria Madrid en periodos; validar/renovar token Drive con aviso; guard de deploy.
- **Resolución**: —
- **Refix**: —

### SEGURIDAD · RLS desactivado 🔴
- **Estado**: aviso crítico de Supabase: las tablas `reproc_control` y `reproc_informe` tienen Row Level Security desactivado (expuestas con la clave anon).
- **Propuesta**: activar RLS con políticas adecuadas (no auto-aplicar sin definir políticas, o bloquea el acceso).
- **Resolución**: —
- **Refix**: —
