# AUDITORÍA 2 — OCR Binagre: de factura recibida a conciliada

**Track:** BINAGRE-ERP
**Fecha:** 02/06/2026
**Autor:** Claude (auditor)
**Regla de oro innegociable:** coste de OCR = **0 €, siempre**. CERO API de pago (ni Anthropic ni ninguna otra). Lectura solo por plantillas + OCR gratis (Tesseract). El lector IA de pago queda descartado para siempre y no se enciende.

Leyenda de estado: ✅ funciona · ⚠️ funciona pero frágil / mejora pendiente · ❌ roto o no existe · 🟢 RESUELTO en esta pasada.

---

## 1. Alcance y método

Esta auditoría es genuina y se ha hecho sobre evidencia, no sobre la auditoría anterior. Fuentes cruzadas:

1. Lógica viva del ERP (código real del sistema, fuente de verdad).
2. Permisos reales de la conexión con Google.
3. Memoria de trabajo y reglas de Streat Lab.
4. Notion "99 Claude" (pendientes y handoffs del track).
5. Conversaciones anteriores relacionadas con OCR y conciliación.

---

## 2. Verificaciones realizadas (qué he comprobado y con qué resultado)

1. **Vías de entrada de factura.** Confirmado que solo una de las tres está realmente viva: el botón de subir. El correo solo funciona si se sube el archivo a mano. El cartero automático de Gmail no estaba conectado. — *Resultado: confirmado.*
2. **Permiso de Google.** Comprobado que la conexión con Google solo daba acceso a Drive (guardar archivos), no a Gmail. Por eso el cartero no podía entrar a ningún correo. — *Resultado: confirmado; era la causa raíz del fallo nº 1.*
3. **Lectura de facturas con texto.** Las facturas en PDF con texto y con su plantilla de proveedor se leen perfectas y gratis. — *Resultado: funciona.*
4. **Lectura de escaneos y fotos.** Confirmado que un PDF escaneado o una foto no se leían: se quedaban paradas en 0 €. No había ningún lector de imagen gratis cableado. — *Resultado: confirmado; era el mayor cuello de botella.*
5. **Lector de pago.** Verificado que existía un lector de pago en el sistema pero estaba **apagado**. No llegué a encenderlo en ningún momento. Queda descartado para siempre por tu norma. — *Resultado: confirmado apagado; cero gasto.*
6. **Reparto de titular.** Comprobado que, si no detectaba a quién pertenecía la factura, la colgaba a Rubén por defecto. Riesgo de archivar facturas de Emilio en la carpeta equivocada. — *Resultado: confirmado.*
7. **Archivado en Drive.** Funciona; si la conexión se cae, la factura queda marcada y avisa, pero hay que reconectar a mano. — *Resultado: funciona con punto débil.*
8. **Conciliación contra banco.** Casa el cargo cuando existe. Lo que aún no ha llegado al banco (ciclos de plataformas) se mezcla con los fallos reales. — *Resultado: funciona con ruido.*
9. **Fuga de almacenamiento (bucket temporal).** Revisado: ya estaba cerrada el 30/05. No se repite. — *Resultado: cerrado.*
10. **Compatibilidad del motor gratis con el sistema.** Verificado que las piezas del OCR gratis se pueden añadir sin romper el resto y con degradación segura (si una factura no se puede leer, cae a manual sin tumbar nada). — *Resultado: confirmado.*

---

## 3. Flujo completo, paso a paso (estado tras la solución)

### Paso 0 — Entrada de la factura (3 vías)
1. Botón "subir factura" — ✅ siempre operativo.
2. Email reenviado y subido como archivo — ✅ lee cuerpo y adjuntos (manual).
3. Cartero de Gmail (lee el buzón solo) — 🟢 cableado. Pendiente de que reconectes Google para dar el permiso.

### Paso 1 — Captura y tipo de archivo
1. Detecta el tipo (PDF, imagen, Word, Excel, email) — ✅.
2. Huella anti-duplicado por archivo — ✅.
3. Filtra lo que no es factura (resúmenes de gestoría) — ✅.

### Paso 2 — Lectura de datos (proveedor, total, fecha, nº)
1. PDF con texto + plantilla del proveedor — ✅ gratis y perfecto.
2. PDF con texto sin plantilla — ⚠️ lector genérico; formatos raros pueden fallar.
3. PDF escaneado o foto sin texto — 🟢 ahora lo lee el OCR gratis (Tesseract). Antes quedaba en 0 €.
4. Lector IA de pago — ❌ descartado para siempre; no se usa.

### Paso 3 — ¿De quién es? (titular Rubén / Emilio)
1. Detecta titular por NIF o nombre — ✅.
2. Si no lo detecta — 🟢 ya no se cuelga a Rubén; va a SIN_TITULAR y queda marcada para revisar.
3. Crea proveedor nuevo solo — ✅.

### Paso 4 — Archivado en Drive
1. Renombra y guarda en la carpeta del titular — ✅.
2. Si Drive se cae — ⚠️ queda "Drive pendiente"; hay que reconectar a mano (mejora menor pendiente).

### Paso 5 — Alta en el sistema
1. Crea la factura con bases, IVA, total, tipo — ✅.
2. Plataformas: desglose por marca — ✅.
3. Duplicado lógico (misma factura en otro PDF) — ⚠️ no se detecta; riesgo de doble gasto (mejora menor pendiente).

### Paso 6 — Conciliación contra el banco
1. Casa el cargo si existe — ✅.
2. Si el cargo aún no llegó (ciclos de plataformas) — ⚠️ se mezcla con los fallos reales (mejora menor pendiente).
3. Sin regla del proveedor — no casa hasta crearla.

### Paso 7 — Estado final y trazabilidad
1. Registro 1-a-1 de cada archivo — ✅.
2. Barrido para reintentar pendientes — ✅ (existe; falta pantalla clara).

---

## 4. Qué se ha desplegado en esta pasada (una sola, 0 €)

1. **OCR gratis (Tesseract).** Cuando las plantillas no leen una factura (escaneo, foto, formato raro), se saca el texto con OCR gratis y se reintenta la lectura. Si aun así no se puede, la factura va a lectura manual y el PDF se guarda en Drive (nunca se pierde). Cero coste, siempre.
2. **Cartero de Gmail.** Recoge los adjuntos de factura del buzón de la cuenta conectada y los procesa por el mismo motor que el botón de subir. No repite (marca los ya hechos). Si falta el permiso, no rompe nada y te avisa de que hay que reconectar.
3. **Permiso de Gmail** añadido al inicio de sesión de Google.
4. **Reparto de titular corregido:** sin titular detectado → SIN_TITULAR, no Rubén a ciegas.

---

## 5. Propuestas y mejoras restantes (menores, para una siguiente)

1. **Aviso proactivo de Drive desconectado:** que el ERP avise en cuanto se cae, en lugar de descubrir facturas sin subir.
2. **Anti doble-gasto:** avisar cuando entra una factura muy parecida (mismo proveedor + nº + importe) y dejarte confirmar antes de contarla.
3. **Pantalla de pendientes accionable:** separar "falta plantilla / no se pudo leer" (acción tuya) de "esperando al banco" (no tocar), con botón de crear plantilla y reprocesar.
4. **Conciliación con ciclos de pago:** que lo que aún no ha llegado al banco (plataformas) no aparezca como problema.
5. **Cartero programado:** una vez validado, dejar que el cartero barra el buzón solo cada cierto tiempo, sin pulsar nada.

---

## 6. Pendiente de Rubén (solo para activar el cartero de Gmail)

1. Reconectar Google: Configuración → Integraciones → Drive → Conectar. Saldrá un aviso de "app no verificada" → continuar. Sin esto, el cartero no entra al correo.
2. Confirmar qué cuenta Gmail es el buzón de facturas (la habitual o una dedicada nueva).
3. Activar "Gmail API" en Google Cloud (es técnico; te guío con clics exactos en cuanto me digas que vas).

Nota: no hace falta subir documentación. El atasco actual de facturas paradas se vuelve a leer solo con el OCR nuevo (botón Reprocesar). Lo único que falta capturar son facturas que nunca entraron, y eso lo absorbe el cartero al conectarlo.

---

## 7. Pendiente de Claude (verificaciones que faltan)

1. Confirmar que el sistema ha publicado correctamente el cambio (build en verde).
2. Probar una factura escaneada real (lectura por OCR gratis) y un barrido del cartero.
3. Vigilar el tamaño del proceso de lectura (Tesseract + lector de PDF); si la plataforma se queja por tamaño, hay alternativa preparada.

---

## 8. Estado por fallo de la auditoría inicial

1. Cartero Gmail no conectado → 🟢 resuelto en sistema, pendiente de tu permiso.
2. PDF escaneado / foto ilegible → 🟢 resuelto (OCR gratis).
3. Proveedor nuevo sin plantilla → 🟢 mitigado (el OCR lo intenta).
4. Titular por defecto Rubén → 🟢 resuelto.
5. Drive caído sin aviso → ⚠️ mejora menor pendiente.
6. Pendientes reales mezclados con "esperando banco" → ⚠️ mejora menor pendiente.
7. Doble entrada de la misma factura → ⚠️ mejora menor pendiente.
8. Fuga de almacenamiento → ✅ cerrado 30/05.
