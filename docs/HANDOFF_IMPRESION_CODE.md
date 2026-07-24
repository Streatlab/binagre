# HANDOFF · SISTEMA DE IMPRESIÓN ERP BINAGRE
**Para: Claude Code · Fecha: 24-jul-2026 · Repo: `Streatlab/binagre` · Rama de trabajo: `trabajo`**

---

## 0. REGLAS QUE NO SE SALTAN

1. **Todo el código va a la rama `trabajo`.** PROHIBIDO tocar `master` sin orden expresa de Rubén.
2. **PROTOCOLO AUTOLOOP v1**: no parar, no pedir permiso, decidir y apuntar la decisión. Commits locales durante el trabajo y **UN SOLO push al final** a `trabajo` (cada push quema un build de Vercel).
3. **Checklist-memoria obligatoria** en `docs/IMPRESION_PROGRESO.md`, actualizada tras cada bloque, para poder reanudar si se pierde el contexto. Una casilla solo se marca `[x]` con evidencia objetiva (grep / build en verde), nunca "por sensación".
4. **MARCO DOCUMENTOS**: todo documento imprimible usa el marco único de `src/lib/marcoDoc.ts` + `docs/MARCO_DOCUMENTOS.md`. La vista en pantalla del documento debe verse igual que el PDF. No inventar estilos nuevos por documento.
5. **CANTERA ALEGRE** es el sistema visual vigente del ERP (ley en CEREBRO-SL > LEY-ESTILO-01, progreso en `docs/CANTERA_PROGRESO.md`). El botón y el modal nuevos se pintan con Cantera, no con estilos sueltos.
6. **PWA móvil**: `docs/LEY_PWA_MOVIL.md`. `navModel` es la fuente única de navegación y `AppMovil` la piel móvil. Todo lo nuevo tiene que funcionar también en móvil.

---

## 1. QUÉ HAY QUE CONSTRUIR

Un sistema de impresión único para todo el ERP, con **dos salidas**:

- **Salida A — "Imprimir aquí"**: genera el PDF en el navegador y abre el diálogo de impresión del sistema (o lo descarga). Sirve para cuando Rubén está en casa o quiere solo el PDF.
- **Salida B — "Enviar al local"**: el mismo PDF se manda por correo a la impresora Epson de la cocina. Sirve para que los cocineros tengan el papel en la mano sin que nadie toque nada.

Ambas salen del **mismo botón** y del **mismo modal**, en cada módulo que tenga un documento imprimible (~35 documentos, inventario en la sección 4).

---

## 2. MOTOR DE ENVÍO — YA FUNCIONA, NO REINVENTAR

El envío a la impresora está **resuelto y verificado el 23-jul-2026**. Reutilizarlo tal cual.

| Elemento | Valor |
|---|---|
| Servicio | **Brevo** (API transaccional) |
| Endpoint | `POST https://api.brevo.com/v3/smtp/email` |
| Remitente | `direccion@streatlab.com` — **obligatorio**, no vale otro |
| Destino | `ellosson@print.epsonconnect.com` |
| API key | Supabase Vault (proyecto Binagre `eryauogxcpbgdryeimdq`) |
| Respuesta OK | `201` + `messageId` |

### LEY-IMPRESION-EMAIL (bloqueante)

1. **Epson SOLO imprime si el correo lleva el PDF adjunto.** Asunto + cuerpo sin adjunto = error devuelto. Verificado.
2. El remitente **debe** ser `direccion@streatlab.com`. `facturasstreat@gmail.com` está verificado en Brevo pero NO autorizado en Epson.
3. Brevo bloquea por IP. Ya está desbloqueado (acceso ilimitado activo). Si aparece `401 unrecognised IP`, se revisa en el panel de seguridad de Brevo.
4. **Resend está descartado para siempre**: el dominio streatlab.com usa nameservers `aliasdns.net` (WNPower) y no admite los registros DNS necesarios. NO reintentarlo.
5. Gmail MCP solo crea borradores. No sirve.

---

## 3. ARQUITECTURA DECIDIDA (no volver a discutirla)

### 3.1 Generación del PDF
El PDF se genera **en el cliente** con jsPDF usando los helpers de `src/lib/marcoDoc.ts`. No se regenera en servidor. Para la salida B, ese mismo PDF se serializa a base64 y se envía al backend.

### 3.2 Endpoint
**Restricción dura**: Vercel Hobby permite máximo 12 funciones. El repo usa el patrón **"4 puertas"** (handlers en `api/_puertas/`, enrutados por catch-all como `api/papeleo/[...ruta].ts`). El envío a impresora **se cuelga de una puerta existente como una acción más** — está PROHIBIDO crear un archivo de función nuevo en `api/`. Si la ruta tiene 2+ segmentos, añadir el rewrite correspondiente en `vercel.json`.

El handler recibe: `{ documento, pdfBase64, nombreArchivo, copias }` → llama a Brevo con el adjunto → devuelve `{ ok, messageId }` o `{ ok:false, error }` → registra el intento en `impresion_envios`.

### 3.3 Base de datos (Supabase Binagre `eryauogxcpbgdryeimdq`)

**`impresion_preferencias`** — una fila por documento:
`id`, `documento_id` (texto, clave estable tipo `cocina.lista_produccion`), `nombre`, `area` (`cocina` | `finanzas` | `equipo` | `operaciones`), `tinta` (`bn` | `color`), `orientacion` (`vertical` | `apaisado`), `copias` (int, def. 1), `activo`.
Sembrar con el inventario de la sección 4. Si un documento no tiene fila: BN, vertical, 1 copia.

**`impresion_envios`** — trazabilidad:
`id`, `documento_id`, `destino` (`local` | `aqui`), `estado` (`enviado` | `error`), `message_id`, `error`, `usuario`, `creado_en`.

### 3.4 Componentes de front

- `src/components/BotonImprimir.tsx` — botón único reutilizable. Props: `documentoId`, `generarPdf: () => jsPDF`, `titulo`. Estilo Cantera, con la sombra dura de lo pulsable.
- `src/components/ModalImprimir.tsx` — modal con las dos salidas, muestra las preferencias del documento (tinta / orientación / copias) y permite cambiarlas **solo para esta impresión**. Confirmación visible del resultado (enviado / error), nunca un envío silencioso.
- `src/lib/impresionEnvio.ts` — cliente que llama al endpoint y escribe en `impresion_envios`.
- **Pantalla de ajustes**: `Ajustes → Impresión`, tabla editable de `impresion_preferencias` (cambiar tinta / orientación / copias de un clic). Entrada dada de alta en `navModel` para que aparezca también en móvil.

### 3.5 Móvil
El modal tiene que ser usable en la PWA: pantalla completa en móvil, botones grandes, sin depender del hover.

---

## 4. INVENTARIO DE DOCUMENTOS (semilla de `impresion_preferencias`)

Valores por defecto ya decididos. Rubén los ajusta luego desde la pantalla de ajustes: **no bloquear el autoloop preguntando por ellos.**

### Cocina — prioridad 1
| Documento | Módulo | Tinta | Orient. | PDF |
|---|---|---|---|---|
| Lista de Producción | Producción | BN | Apaisado | ya existe |
| Hoja de ordenación de Cámara | Producción | BN | Vertical | ya existe |
| Hoja de Inventario permanente | Inventario cocina | BN | Vertical | ya existe |
| Esquemas por gama | Esquemas | BN | Apaisado | ya existe |
| Lista de Compra semanal | Lista de Compra | BN | Vertical | ya existe |
| Ficha técnica de Receta | Recetario / Platos Maestros | BN | Vertical | ya existe |
| Ficha técnica de EP | Recetario / Escandallo | BN | Vertical | ya existe |
| Menú Familia | Menú Familia | COLOR | Vertical | por hacer |
| Informe Menu Engineering | Menu Engineering | COLOR | Apaisado | por hacer |
| Coste por plato | Coste Plato | BN | Vertical | por hacer |

### Equipo — prioridad 2
| Documento | Módulo | Tinta | Orient. |
|---|---|---|---|
| Cuadrante de horarios semanal | Horarios | BN | Apaisado |
| Parte mensual de fichajes | Control Presencia | BN | Apaisado |
| Calendario laboral | Calendario Laboral | BN | Vertical |
| Hoja de incentivos por empleado | Incentivos | BN | Vertical |
| Recibo / resumen de nómina | Nóminas | BN | Vertical |
| Documentos de empleado | Documentos | BN | Vertical |
| Organigrama | Organigrama | COLOR | Vertical |
| Hoja de permisos / vacaciones | Permisos | BN | Vertical |

### Operaciones / APPCC — prioridad 3
| Documento | Módulo | Tinta | Orient. |
|---|---|---|---|
| Checklist apertura / cierre | Checklists | BN | Vertical |
| Registro de temperaturas | Control Temperaturas | BN | Vertical |
| Registro BPM / calidad | BPM Calidad | BN | Vertical |
| Manual de operaciones | Manuales | BN | Vertical |
| Libro de equipos / mantenimiento | Libro Equipos | BN | Vertical |
| Acta de reunión de equipo | Reuniones | BN | Vertical |
| Hoja de pedido de menaje | Pedidos Menaje | BN | Vertical |
| Parte de daños de menaje | Daños Menaje | BN | Vertical |

### Finanzas e Informes — prioridad 4
| Documento | Módulo | Tinta | Orient. |
|---|---|---|---|
| P&G mensual (Running) | Running | BN | Apaisado |
| Estados financieros | Estados Financieros | BN | Apaisado |
| Tesorería 13 semanas | Tesorería | BN | Apaisado |
| Calendario de pagos y cobros | Pagos y Cobros | BN | Apaisado |
| Paquete trimestral gestoría | Gestoría | BN | Vertical |
| Factura individual / listado | Gestión Facturas | BN | Vertical |
| Punto de equilibrio | Punto Equilibrio | COLOR | Vertical |
| Objetivos por categoría | Objetivos | COLOR | Apaisado |
| Informe periódico (cierre diario/semanal) | Panel Informes | COLOR | Vertical |

Marcas / Marketing / Clientes: sin documentos imprimibles operativos. Fuera de alcance.

---

## 5. FASES

- **Fase 1 — Motor + Cocina.** Tablas, endpoint dentro de puerta existente, `BotonImprimir`, `ModalImprimir`, pantalla de ajustes, y los **7 documentos de cocina que ya tienen PDF**. Al terminar la fase 1 el sistema tiene que estar vivo de punta a punta.
- **Fase 2 — Equipo.** Horarios y fichajes primero (son los que más se imprimen).
- **Fase 3 — Operaciones / APPCC.**
- **Fase 4 — Finanzas e Informes.**

Los documentos marcados "por hacer" necesitan además que se les construya el PDF con el marco antes de enchufarles el botón.

---

## 6. CRITERIOS OBJETIVOS DE "HECHO"

Ninguna casilla se marca sin que se cumpla su criterio, comprobable con grep o con el build:

1. `src/components/BotonImprimir.tsx` y `src/components/ModalImprimir.tsx` existen y se exportan.
2. `BotonImprimir` está importado en **todas** las pantallas de la fase correspondiente (contar imports y compararlos con la lista de la fase; el número tiene que cuadrar).
3. `src/lib/impresionEnvio.ts` existe y es el **único** sitio del repo que llama al endpoint de envío (no hay llamadas a Brevo sueltas por los módulos).
4. Migración aplicada: `impresion_preferencias` con una fila por cada documento del inventario, e `impresion_envios` creada.
5. La ruta de ajustes de impresión existe y está dada de alta en `navModel`.
6. Si se añadió ruta de 2+ segmentos, `vercel.json` tiene su rewrite.
7. `npx tsc -b` sin errores y `npm run build` en verde. **Este es el gate duro**: nada se da por terminado con el build roto.
8. Recuento de funciones en `api/` ≤ 12.
9. `docs/IMPRESION_PROGRESO.md` actualizado con lo hecho, lo decidido y lo que falta.
10. Prueba real de extremo a extremo: un envío registrado en `impresion_envios` con estado `enviado` y `message_id`.

---

## 7. AVISOS DE ERRORES YA COMETIDOS (no repetir)

1. **No hacer ráfagas de commits con push.** El 23-jul una ráfaga dejó todos los builds en CANCELED. Commits locales, un solo push al final.
2. **El gate verde no basta.** El criterio final de éxito del apartado visual es que Rubén lo valide a ojo. Si algo compila pero se ve raro, se arregla, no se marca hecho.
3. **No duplicar navegación.** `navModel` es la fuente única; ya se borraron mapas de navegación duplicados y no se vuelven a crear.
4. **No crear funciones nuevas en `api/`.** Se rompe el límite de Vercel y deja de desplegar todo el proyecto.
5. **No hardcodear estilos de documento.** Todo pasa por el marco.

---

## 8. ESTADO DEL DESPLIEGUE (contexto, no es tarea de Code)

El merge del trabajo del 23-jul (Cantera + PWA) a `master` está hecho, pero Vercel dejó de crear builds y producción sigue con la versión antigua. Lo está resolviendo Rubén desde el panel de Vercel. **No afecta al autoloop**: se sigue trabajando en `trabajo` con normalidad.
