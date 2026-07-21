# ESCANDALLO · Motor superpersistente (procesado de facturas en servidor)

Antes, "Procesar todas" corría en un bucle del navegador: si Rubén cerraba la
pestaña o hacía F5, el trabajo paraba. Ahora es como el OCR: **un botón "Procesar
todo (en 2º plano)" y el servidor lo termina solo**, aunque se cierre el navegador.

## Cómo funciona (patrón OCR copiado)

1. **Estado persistente** — tabla `escandallo_motor` (fila única `id=1`):
   `activo`, `procesadas`, `total_al_iniciar`, `ultimo_latido`, `ultimo_mensaje`,
   `iniciado_at`, `parado_at`.
2. **Cron empujador** — pg_cron `escandallo_motor_tick`, cada minuto, mismo estilo
   que `ocr-worker-trigger`: solo dispara `net.http_get` al endpoint si
   `exists(select 1 from escandallo_motor where activo is true)` — no gasta nada si
   no hay trabajo.
3. **El endpoint procesa** — `GET/POST /api/papeleo/escandallo-auto?action=motor-tick&llave=…`
   reclama el turno, drena facturas dentro de un presupuesto de tiempo (~260 s bajo
   `maxDuration=300`), refresca el latido tras cada factura, y al vaciarse la cola
   apaga el motor con mensaje "completado".

## Acciones (puerta papeleo, `escandallo-auto.ts`)

- `motor-arrancar` (POST): `activo=true`, `total_al_iniciar` = nº de facturas de
  materia prima pendientes (mismo criterio que la bandeja), `procesadas=0`. Si no
  hay pendientes, se apaga solo.
- `motor-parar` (POST): `activo=false`. El tick en curso termina su factura y no
  coge más.
- `motor-estado` (GET): devuelve la fila + `pendientes`. Siempre disponible, **sin
  Drive** — es lo que la UI consulta para pintar.
- `motor-tick` (GET/POST, protegido por llave): el que llama el cron.

## Un solo worker a la vez (sin doble procesado)

`fn_escandallo_motor_claim()` hace un `UPDATE … RETURNING` atómico: solo concede el
turno si el motor está activo y el latido es nulo o más viejo que **3 minutos**
(margen > timeout de visión de 2 min, para no reclamar mientras un worker sano
procesa una factura lenta). Si otro tick ya está vivo, el nuevo sale sin tocar
nada. `fn_escandallo_motor_avanzar()` incrementa `procesadas` y refresca latido de
forma atómica.

**Autosanación:** si un worker se cae con `activo=true`, el cron sigue disparando
cada minuto (condición solo `activo=true`) y, pasado el margen de 3 min, el
siguiente tick reclama el turno y continúa donde se quedó.

## UI (TabAuto)

- Botón **"Procesar todo (en 2º plano)"** → `motor-arrancar`. Con el motor activo:
  barra de progreso `procesadas / total_al_iniciar`, último mensaje, botón **Parar**,
  y el aviso "Puedes cerrar esta pestaña, el proceso sigue solo."
- La UI hace **polling a `motor-estado` cada 5 s solo para pintar**; el trabajo no
  depende de la pestaña. Sobrevive a F5, cambio de módulo y cierre.
- Se mantiene **"Procesar 1 factura"** para pruebas puntuales.

## Crons

- **`escandallo_motor_tick`** (`* * * * *`, condicionado a `activo=true`) — el empujador.
- **`escandallo_motor_arranque_diario`** (`30 3 * * *` = 05:30 Madrid verano) — enciende
  el motor cada día SOLO si no está ya en marcha (`where not exists (… activo is true)`),
  así vuelve a ser automático y desatendido sin resetear un motor en curso. `motor-arrancar`
  se apaga solo si no hay pendientes.
- **Eliminados:** `escandallo_procesar_lote_diario` y
  `escandallo_completar_borradores_semanal` (Rubén no quiere el semanal).
  `completar-borradores` se lanza a mano desde su botón.

## Mejoras posteriores (segunda iteración)

1. **Auto-arranque diario** — cron `escandallo_motor_arranque_diario` (ver arriba): la
   ingesta vuelve a ser desatendida; el motor se enciende solo cada mañana y drena la cola.
2. **Formato honesto (LEY-ANTIFALSOS)** — `completar-borradores` (Mercadona y Alcampo)
   deja `formato = null` cuando el envase no aparece escrito en el nombre del súper, en vez
   de inventar `'Unidad'`. El filtro de "necesita completar" pasa de `formato IS NULL` a
   `uds IS NULL` (el contenido normalizado es el verdadero sentinel), para no reprocesar en
   bucle un borrador con contenido pero sin formato conocido.
3. **Autoapagado si Drive cae** — columna `escandallo_motor.fallos_drive`: `motor-tick`
   cuenta ticks seguidos con Drive caído y, tras 5, apaga el motor con un mensaje claro en
   vez de reintentar cada minuto para siempre. Se resetea a 0 en cuanto un tick lee Drive
   bien y al arrancar el motor.

## Llave del cron

`motor-tick` (y `procesar-lote`, `completar-borradores`) aceptan por GET la llave
literal `escandallo-motor-2026` (misma convención del proyecto: `sl-vivo-2026`,
`enchufe-sl-19jul`), hardcodeada para que **coincida siempre** con el pg_cron sin
depender de env vars. El POST desde la propia app no necesita llave. Opcionalmente
se acepta además el secreto `ESCANDALLO_CRON_SECRET` si se configura en Vercel.

## Verificación en BD (transacción de prueba, sin tocar datos reales)

- `claim1_concede` ✓ · `claim2_bloquea_worker_vivo` ✓ · `avanzar_procesadas` ✓ ·
  `claim3_reclama_tras_caida` ✓ · `claim4_bloquea_si_parado` ✓.
- Build, `check-api-limit` (5/10) y tests: OK. TSX validado con esbuild.

Pendiente de que la rama llegue a producción: prueba end-to-end real (arrancar,
cerrar navegador, ver `escandallo_motor.procesadas` subir por SQL) contra
Drive/Anthropic.
