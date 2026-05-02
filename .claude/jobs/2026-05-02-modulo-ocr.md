# Job: Crear módulo OCR (renombrar Importador)

## Objetivo
Convertir el módulo actual `Importador` en un nuevo módulo llamado **OCR** que copie EXACTAMENTE la estructura visual de Conciliación > Movimientos (`src/components/conciliacion/TabMovimientos.tsx`) y permita subir/procesar facturas, extractos y otros documentos vinculándolos a `conciliacion` y a Drive.

## Aislamiento
Este job es SOLO para repo `Streatlab/binagre`. NO tocar nada del repo `erp-david`. NO mezclar tokens Marino+Fuego. Tokens canónicos a usar: `#B01D23`, `#1e2233`, `#FF4757`, `#1D9E75`, `#E24B4A`, `#F26B1F`, `#1E5BCC`, `#7a8090`, `#d0c8bc`, `#f5f3ef`.

## Cambios en routing y nombre
1. Renombrar ruta `/importador` a `/ocr` en `src/App.tsx`.
2. Renombrar componente principal `src/pages/Importador.tsx` a `src/pages/Ocr.tsx`.
3. Actualizar todas las referencias en sidebar / rutas / breadcrumbs / títulos de "Importador" a "OCR".
4. Mantener compatibilidad: redirigir `/importador` → `/ocr` por si hay enlaces antiguos.

## Estructura visual del módulo OCR

### Header
- Título `OCR` en `#B01D23`, fuente Oswald 22px peso 600, letter-spacing 3px, uppercase.
- Subtítulo con rango de fechas seleccionado (`fmtFechaCorta`).
- A la derecha: `SelectorFechaUniversal` con `nombreModulo="ocr"` y `defaultOpcion="mes_en_curso"` — IDÉNTICO al usado en Conciliación.

### Tabs principales (pastilla, calcado de Conciliación)
Usar componente `TabsPastilla` con tabs:
1. `facturas` — Facturas
2. `extractos` — Extractos bancarios
3. `otros` — Otros documentos

Estilo activo: fondo `#FF4757`, color blanco. Inactivo: fondo blanco, borde `#d0c8bc`.

### Fila de 4 cards KPI (calcado del cardStyle de TabMovimientos.tsx)
Cada card: `background: #fff`, `border: 0.5px solid #d0c8bc`, `border-radius: 14px`, `padding: 18px 20px`.

**Card 1 — Total facturas del periodo**
- Label Oswald 11px uppercase letter-spacing 2px color `#7a8090`: "Total facturas"
- Número Oswald 26px peso 600 color `#111`
- Sub Lexend 11px color `#7a8090` con importe total documentado

**Card 2 — Conciliadas**
- Label: "Conciliadas"
- Número Oswald 26px color `#1D9E75`
- Sub: "X% del periodo · Y €"

**Card 3 — Pendientes con sub-cards**
- Label: "Pendientes"
- Número Oswald 22px color `#E24B4A`
- 2 sub-cards horizontales (cada una `flex:1`, padding 5px 6px, border 0.5px `#d0c8bc`):
  - "Falta Drive" (count `#E24B4A`)
  - "Sin conciliar" (count `#F26B1F`)
- Cada sub-card es clickable y filtra la tabla.

**Card 4 — Botón Subir facturas**
- Fondo `#B01D23`, sin borde, border-radius 14px.
- Icono SVG flecha hacia arriba 28x28 blanco.
- Texto "Subir facturas" Oswald 14px peso 600 letter-spacing 2px uppercase blanco.
- Subtexto Lexend 10px color blanco 70% opacity: "PDF · Imagen · CSV · DOC".
- Al click: abre `<input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.xls,.doc,.docx" />` del SO.
- El botón cambia su texto/icono según la tab activa: en `extractos` dice "Subir extractos", en `otros` dice "Subir documentos".

### Barra de filtros (calcado TabMovimientos)
1. Input búsqueda flex 1 placeholder "Buscar concepto, contraparte o NIF…" — debounce 400ms.
2. Select categorías min-width 280px — pobla con `categorias_pyg` filtrado `nivel === 3`.
3. Botón "Exportar" CSV.

### Tabla principal (calcado TabMovimientos)
Columnas exactas con colgroup:
1. Fecha (90px) — sortable
2. Concepto (auto) — sortable
3. Contraparte (16%) — sortable
4. Importe (110px right) — sortable
5. Categoría (200px) — sortable
6. Doc (80px center) — sortable
7. Estado (130px) — sortable
8. Titular (100px) — sortable

Headers Oswald 10px peso 500 letter-spacing 2px uppercase. Activo color `#FF4757`, inactivo `#7a8090`. Fondo `#f5f3ef`. Border-bottom 0.5px `#d0c8bc`.

Filas: padding `8px 16px`, border-bottom `0.5px solid #ebe8e2`, line-height 1.4. Hover background `#f5f3ef60`. Cursor pointer.

**Renderizado de cada columna:**

- **Fecha** color `#7a8090` font-size 12px (usar `fmtDate`)
- **Concepto** color `#111` truncado a 40 chars + "…"
- **Contraparte** color `#111` si existe, `#7a8090` "Sin identificar" si no
- **Importe** Oswald 14px peso 500 alineado derecha, color `#1D9E75` si positivo, `#E24B4A` si negativo (usar `fmtEur`)
- **Categoría** chip: padding 3px 10px, border-radius 6px, background `#f5f3ef`, border 0.5px `#d0c8bc`, dentro código Oswald 10px `#7a8090` + nombre Lexend 12px `#3a4050`. Si no hay categoría: chip dashed `#E24B4A50` con texto "sin categoría" italic `#E24B4A`.
- **Doc** centrado: 📎 verde `#1D9E75` 14px si tiene factura. Si multi-doc añadir superíndice con número (📎³). Si no tiene: ✕ naranja `#F26B1F` 14px. Click sobre 📎 abre la URL `pdf_drive_url` de la tabla `facturas` en nueva pestaña; si multi-doc abre modal con lista de archivos.
- **Estado** badge:
  - `Conciliado` background `#1D9E7515`, color `#0F6E56` — cuando está en Drive Y conciliado en `conciliacion` (categoria_id IS NOT NULL Y doc_estado='tiene' o 'no_requiere')
  - `Pendiente` background `#E24B4A15`, color `#E24B4A` — cuando está en Drive pero falta categorizar/conciliar
  - `Falta Drive` background `#E24B4A15`, color `#E24B4A` — cuando NO está en Drive (doc_estado='falta' Y existe en facturas pero sin pdf_drive_url)
- **Titular** badge:
  - Rubén: background `#F26B1F15`, color `#F26B1F`, dot 6x6 `#F26B1F`
  - Emilio: background `#1E5BCC15`, color `#1E5BCC`, dot 6x6 `#1E5BCC`

### Paginador (calcado exacto)
Footer background `#fafaf7`, border-top 0.5px `#d0c8bc`, padding 14px 16px. 
- Izquierda: "Mostrando X–Y de Z facturas" Lexend 12px `#7a8090`
- Derecha: select Filas (50/100/200), botones Primera / ‹ Anterior / Página X de Y / Siguiente › / Última. Estilo idéntico a TabMovimientos.

Persistir page y size en URL searchParams (igual que TabMovimientos).

## Lógica de procesamiento OCR

### Flujo al pulsar Subir
1. Usuario selecciona N archivos.
2. Aparece toast flotante en esquina inferior derecha: background `#1e2233`, border-radius 12px, box-shadow `0 8px 24px rgba(0,0,0,0.18)`, min-width 360px.
3. Toast muestra: título "Procesando lote · N archivos" Oswald 12px letter-spacing 1.5px blanco uppercase.
4. Pills con contadores:
   - `N enviados` (con dot pulsante)
   - `X conciliadas` verde
   - `Y pendientes` naranja
   - `Z duplicadas (eliminadas)` rojo
5. Barra de progreso 4px de alto, fondo `rgba(255,255,255,0.15)`, fill `#1D9E75`.
6. Cada archivo se procesa en lotes de 3 en paralelo.

### Para cada archivo
1. Calcular hash MD5 del contenido. Comprobar contra tabla `facturas.file_hash` (añadir columna si no existe).
2. Si hash ya existe → marcar como `duplicada`, ELIMINAR el archivo de la cola y registrar en `imports_log` con estado `duplicada_eliminada`.
3. Si no es duplicada → enviar a Claude API (Anthropic) para extraer:
   - Tipo (factura proveedor / factura plataforma / extracto bancario / ticket / otros)
   - NIF emisor → determina titular destino (Rubén `21669051S`, Emilio `53484832B`)
   - Proveedor canónico (cruzar con tabla `proveedor_alias`)
   - Fecha, importe total, base imponible, IVA, concepto
4. Aplicar reglas OCR existentes (tabla `reglas_ocr` — crear si no existe con columnas: id, patron_nif, patron_nombre, categoria_id, titular_id, activa).
5. Insertar en tabla `facturas`. Subir archivo a Drive en estructura `00 SISTEMA STREAT LAB/05 OPERACIONES/05 FACTURAS RECIBIDAS/{RUBÉN|EMILIO}/{Año}/{1T-4T}/{Mes}/{PLATAFORMAS|PROVEEDORES}/`. Renombrar archivo: `{proveedor}-{nif}-{YYYYMMDD}-{importe}.{ext}`.
6. Buscar matching en `conciliacion`: mismo titular + mismo importe absoluto + fecha ±3 días.
   - Si match único → enlazar `conciliacion.factura_id = facturas.id`, marcar `doc_estado='tiene'`, asignar categoria si la regla lo dice. Estado final = `conciliado`.
   - Si match múltiple o ninguno → estado = `pendiente`.
7. Multi-archivo: una factura puede asociarse a 1 movimiento, y un movimiento puede tener N facturas (ya soportado por `conciliacion.factura_id` + tabla relacional `conciliacion_facturas` — crear si no existe con columnas movimiento_id, factura_id).

### Toast resumen final
Cuando termina el lote, toast cambia a estado completado durante 5s mostrando totales finales y botón "Ver resultados" que filtra la tabla a esa última tanda.

### Reprocesar
Cada fila de la tabla tiene en hover un botón sutil "↻" (color `#7a8090`, hover `#B01D23`). Al click, re-envía a Claude API con prompt manual editable en modal.

## Tabla `reglas_ocr` (nueva)
```sql
create table if not exists public.reglas_ocr (
  id uuid primary key default gen_random_uuid(),
  patron_nif text,
  patron_nombre text,
  categoria_id text references categorias_pyg(id),
  titular_id uuid references titulares(id),
  activa boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

Crear migración correspondiente.

## Configuración > Reglas OCR (nueva subtab)
En `src/pages/configuracion/bancos/BancosYCuentasPage.tsx`:
1. Renombrar tab existente "Reglas" a "Reglas bancarias".
2. Añadir nueva tab "Reglas OCR" justo después.
3. Crear componente `src/pages/configuracion/bancos/ReglasOcrPanel.tsx` con tabla CRUD de `reglas_ocr`. Mismo estilo que `ReglasPanel.tsx` actual.

## Modal multi-doc
Cuando una fila tiene multi-doc (📎N), al click abrir modal:
- Background `rgba(0,0,0,0.45)`
- Box white border-radius 14px padding 24px 28px max-width 540px
- Título Oswald 16px letter-spacing 2px `#B01D23` uppercase
- Subtítulo Lexend 12px `#7a8090` con concepto + importe del movimiento
- Lista de documentos asociados, cada uno clickable abre Drive en nueva pestaña
- Botones: "Abrir todos en Drive" (primario `#B01D23`) y "Añadir otro doc" (secundario)

## Validaciones obligatorias post-implementación
1. Verificar que la página `/ocr` carga sin errores.
2. Verificar que el botón Subir abre el explorador.
3. Verificar que la tabla pagina correctamente con `conciliacion` joineado a `facturas` filtrado por tipo.
4. Verificar que clicar 📎 abre la URL de Drive correcta.
5. Verificar que los estados se calculan correctamente (Conciliado / Pendiente / Falta Drive).
6. Verificar que NO se rompe Conciliación existente.
7. Verificar TypeScript sin errores y build de Vite limpio.
8. Verificar aislamiento absoluto: ningún import desde repo erp-david, ningún token Marino+Fuego.

## Cierre
Al terminar, hacer commit final con mensaje:
```
feat(ocr): nuevo módulo OCR con drop multi-tipo, auto-conciliación y Drive integrado
```

Push a master. Vercel desplegará automáticamente.
