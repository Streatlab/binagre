# BLOQUE H · Robots de ingesta — diagnóstico y Tanda 1

Reforma de robots (22-jul-2026). La tanda diaria murió el 19-jul entre 13:53 y 14:01 UTC
(todos a la vez → causa común en el lanzador, no seis averías).

## Causa raíz del apagón del 19-jul

El lanzador `.github/workflows/robots-plataformas.yml` corre una **matriz**
(uber/glovo/justeat/sinqro) desde un único cron, todas con `checkout ref: trabajo` +
`npm install` + Playwright compartidos. La ventana de muerte (15:53-16:01 Madrid) coincide
con una ráfaga de commits a `trabajo` justo antes del merge del PR #21. El candidato más
probable es un fallo común aguas arriba (checkout/`npm install`/tsx roto en `trabajo`) que
tumbó varias celdas a la vez; `fail-fast:false` evita que una celda cancele a las otras
pero no protege de la causa común. **No es reproducible ni arreglable a posteriori desde
aquí**; requiere revisar los logs de esos runs en Actions. Lo que sí se ha endurecido:

- **Disparo manual con un clic ya existe** (`workflow_dispatch` con inputs plataforma/modo/
  mes/simulacro; el job `plan` ya hace bypass del candado horario cuando el evento es
  `workflow_dispatch`, L56-60). Rubén puede relanzar la tanda entera desde la pestaña
  Actions cuando quiera, sin esperar al cron.
- **`justeat` fuera de la matriz** (ver H3) → una celda menos que fallaba siempre.

## Cambios de esta tanda (Tanda 1)

- **H2 · Glovo /finance.** Verificado: `scripts/robot-ingesta/glovo.ts:324` ya navega a
  `https://portal.glovoapp.com/finance` para facturas+liquidaciones. **No había bug**; la
  URL de pagos es correcta. Si Glovo falla es en el login/PerimeterX previo, no en la URL.
- **H3 · Just Eat portal jubilado.** El portal bloquea a las IPs de GitHub Actions
  (WAF 403/Turnstile, `justeat.ts:142-155`): login imposible en CI, y emitía latidos "ok"
  sin entregar, ensuciando el semáforo. Quitado de la matriz del lanzador y de las opciones
  de `workflow_dispatch`, y **filtrado de `v_robot_salud`** (`where fuente <> 'justeat'`).
  La factura de Just Eat la sigue cubriendo **justeat-mail** (correo → PDF a bandeja).
- **H7 · Semáforo honesto.** `v_robot_salud`: rojo si >24h sin ejecutar **o** si la última
  ejecución falló de verdad (`estado <> 'ok'`); banda ámbar 20-24h; nueva columna
  **`que_hace`** con una frase por robot para humanos. (Los robots salen rojos ahora porque
  llevan caídos desde el 19-jul, no por falso positivo.)
- **H4 · Uber, recogida con backoff.** `uber.ts` ya pedía→esperaba→recogía, pero solo 6 min.
  Ahora backoff creciente (45s→5min) hasta `UBER_RECOGIDA_MAX_MIN` (por defecto **45 min**,
  seguro bajo el timeout del runner, subido a 75 min) y, si no llega, se deja pedido para la
  pasada siguiente / el reintento del martes — cubriendo de facto la ventana de 2h a lo
  largo de varias corridas (2h en un solo runner es inviable: timeout 55→75 min). En **cada
  intento** vuelca la lista a `robot_debug` (`uber_recogida_intento_N`) para **auditar** si
  se pincha la fila/botón correctos. Se verificará en la próxima corrida real.
- **H5 · Bandeja "red".** Diagnóstico: los 123 en "red" del 20-jul fueron respuestas
  transitorias del ERP (5xx/429/JSON nulo por rate-limit) durante esa pasada, no filas
  atascadas de forma permanente. `imports_log` **ahora tiene 0 pendientes** (131 procesado,
  0 en error/red): el reintento del propio cartero (hasta 5 intentos) + pasadas posteriores
  ya las drenó. **Nada que drenar por SQL.**
- **H6 · Extractor de líneas contable no-MP + backfill.** La pieza ya existía y es segura:
  `GET /api/facturas?action=extraer-lineas` (handler `extraerLineasBatch`) procesa cualquier
  factura de proveedor con `lineas_estado IS NULL` y `total>0`, extrae por texto y las
  inserta con **`origen:'ocr_anthropic'`**, que **NO** dispara la pre-creación de
  ingredientes del escandallo (el trigger solo reacciona a 'ocr'/'ocr_reproceso'); además
  LEY-ESCANDALLO-01 bloquea igualmente lo no-alimentación. Faltaba **quién lo invocara**:
  nuevo pg_cron **`facturas_lineas_contable_tick`** (cada 2h, solo si hay pendientes) que
  drena el backlog (164 de las 198 son procesables; 34 tienen total=0 y se excluyen bien) y
  mantiene al día las nuevas. Como el handler ya está en producción, empieza a drenar de
  inmediato, en 2º plano.

## Pendiente de una corrida real / acceso vivo (no verificable desde aquí)

- Relanzar la tanda de robots y confirmar que Glovo/Sinqro/justeat-mail/sold_products/
  rushour vuelven a traer datos (necesita credenciales vivas + runner de Actions). Rubén
  puede dispararla con `workflow_dispatch` en Actions → "Robots de plataforma".
- Verificar la recogida de Uber con el nuevo backoff en la próxima ejecución (y revisar los
  volcados `uber_recogida_intento_N` en `robot_debug` si sigue sin recoger).
