# Job: OCR funcional completo — fix overflow + sidebar + carga + procesamiento real

## Contexto
La página `/ocr` carga visualmente bien pero tiene 4 problemas:
1. El selector "Mes en curso" se desborda hacia la derecha cuando se abre.
2. El sidebar sigue diciendo "Importador" en lugar de "OCR".
3. La query de carga falla con "Error cargando facturas".
4. Falta la lógica de procesamiento real al subir archivos.

## Aislamiento
Solo repo `Streatlab/binagre`. Supabase Binagre `eryauogxcpbgdryeimdq`. NO tocar `erp-david`.

---

## Schema real existente (lo que YA hay en Supabase)

Tabla `facturas`:
- id, proveedor_id, proveedor_nombre, numero_factura, fecha_factura
- es_recapitulativa, periodo_inicio, periodo_fin
- tipo (proveedor/plataforma/otro), plataforma (uber/glovo/just_eat)
- base_4, iva_4, base_10, iva_10, base_21, iva_21, total_base, total_iva, total
- pdf_original_name, pdf_drive_id, pdf_drive_url, pdf_hash, pdf_filename
- estado (procesando/pendiente_revision/asociada/historica/error/duplicada/sin_match/pendiente_titular_manual/drive_pendiente/cola_pendiente/cola_fallida)
- ocr_confianza, ocr_raw, mensaje_matching, error_mensaje, notas_error
- titular_id, nif_cliente, nif_emisor, categoria_factura
- created_at, updated_at

Tabla `facturas_gastos` (relación N:N factura ↔ movimiento conciliacion):
- id, factura_id, conciliacion_id, importe_asociado, confirmado, confianza_match, cruza_cuentas, created_at

Tabla `conciliacion`:
- id, fecha, concepto, importe, tipo, categoria (codigo categorias_pyg), proveedor
- titular_id, factura_id (legacy 1:1, ahora usa facturas_gastos), doc_estado (tiene/falta/no_requiere)
- ordenante, beneficiario, base_imponible, iva_soportado, etc.

Tabla `categorias_pyg` (112 filas):
- id (codigo), nivel (1/2/3), parent_id, nombre, bloque, requiere_factura, activa

Tabla `proveedor_alias` (55 filas):
- proveedor_canonico, alias

Tabla `titulares` (2 filas):
- Rubén NIF 21669051S id 6ce69d55-60d0-423c-b68b-eb795a0f32fe
- Emilio NIF 53484832B id c5358d43-a9cc-4f4c-b0b3-99895bdf4354

Tabla `imports_log`:
- archivo_nombre, archivo_url, tipo_detectado, estado, destino_modulo, destino_id, user_id, detalle, fecha_subida

---

## CAMBIOS A APLICAR

### 1. Sidebar — renombrar Importador → OCR
Buscar en `src/components/Layout.tsx` (o dondequiera que esté el sidebar) el texto "Importador" y cambiarlo a "OCR". También cambiar la ruta del enlace de `/importador` a `/ocr` y el icono si aplica.

### 2. Fix overflow del SelectorFechaUniversal
Mirar `src/components/ui/SelectorFechaUniversal.tsx`. El dropdown que se abre con las opciones (Mes en curso, Mes anterior, Trimestre, Semana, etc.) debe tener:
- `position: absolute`
- `right: 0` (alineado al lado derecho del trigger button)
- `top: 100%`
- `z-index: 50`
- `max-height: 80vh`
- `overflow-y: auto`

Si ya tiene `position: absolute`, comprobar que NO esté con `left: 0` que provoca el desbordamiento. Calcado de cómo lo hace en Conciliación, donde funciona bien.

### 3. Fix query carga facturas en `src/pages/Ocr.tsx`
La query actual probablemente intenta filtrar por columnas que no existen. Reescribir la query para que cargue desde `facturas` con join a `facturas_gastos` y a `conciliacion` para calcular el estado:

```ts
const { data, error, count } = await supabase
  .from('facturas')
  .select(`
    id, fecha_factura, proveedor_nombre, total, tipo, estado,
    pdf_drive_url, pdf_filename, titular_id, categoria_factura,
    nif_emisor, ocr_confianza,
    facturas_gastos(
      id, conciliacion_id, importe_asociado, confirmado,
      conciliacion(id, concepto, fecha, categoria)
    )
  `, { count: 'exact' })
  .gte('fecha_factura', periodoDesdeStr)
  .lte('fecha_factura', periodoHastaStr)
  .order(sortField, { ascending: sortDir === 'asc' })
  .range(from, to)
```

Para tab "Facturas" filtrar `tipo IN ('proveedor', 'plataforma')`.
Para tab "Extractos" filtrar `tipo = 'otro' AND categoria_factura = 'extracto_bancario'`.
Para tab "Otros docs" filtrar `tipo = 'otro' AND categoria_factura != 'extracto_bancario'`.

**Cálculo de estado de cada fila:**
```ts
function calcularEstadoFactura(f) {
  if (!f.pdf_drive_url) return 'falta_drive'
  const tieneAsociacion = f.facturas_gastos && f.facturas_gastos.length > 0 && f.facturas_gastos.some(fg => fg.confirmado)
  if (tieneAsociacion) return 'conciliado'
  return 'pendiente'
}
```

Estados posibles en columna Estado:
- `Conciliado` (verde) — tiene Drive Y al menos 1 facturas_gastos confirmado
- `Pendiente` (naranja) — tiene Drive pero sin asociar a movimiento
- `Falta Drive` (rojo) — no tiene pdf_drive_url

### 4. Crear tabla `reglas_ocr`
Migración SQL nueva (`supabase/migrations/2026_05_02_reglas_ocr.sql`):

```sql
create table if not exists public.reglas_ocr (
  id uuid primary key default gen_random_uuid(),
  patron_nif text,
  patron_nombre text,
  categoria_codigo text references categorias_pyg(id),
  titular_id uuid references titulares(id),
  proveedor_canonico text,
  activa boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.reglas_ocr enable row level security;
create policy "reglas_ocr select" on public.reglas_ocr for select using (true);
create policy "reglas_ocr modify" on public.reglas_ocr for all using (true);
```

Aplicar la migración con `Supabase:apply_migration` para que se cree YA en la base de datos `eryauogxcpbgdryeimdq`. NO hace falta esperar push manual.

### 5. Configuración > Bancos y Cuentas — añadir tab "Reglas OCR"
En `src/pages/configuracion/bancos/BancosYCuentasPage.tsx`:
- Renombrar tab "Reglas" → "Reglas bancarias"
- Añadir nueva tab "Reglas OCR" con ruta `/configuracion/bancos-y-cuentas/reglas-ocr`
- Crear nuevo componente `src/pages/configuracion/bancos/ReglasOcrPanel.tsx` con CRUD de tabla `reglas_ocr`. Mismo estilo visual que `ReglasPanel.tsx` actual (calcado).

### 6. Edge Function — procesamiento OCR de facturas
Crear edge function `supabase/functions/ocr-procesar-factura/index.ts` que:

```ts
// 1. Recibe { archivo_base64, archivo_nombre, mime_type, user_id }
// 2. Calcula MD5 del contenido binario
// 3. Comprueba si ya existe en facturas con ese pdf_hash → retorna { duplicada: true, factura_existente_id }
// 4. Llama a Claude API (modelo claude-sonnet-4-5) con el archivo + prompt:
//    "Extrae de esta factura: tipo (proveedor/plataforma/otro/extracto/ticket),
//     nif_emisor, nif_cliente, proveedor_nombre, fecha (YYYY-MM-DD),
//     numero_factura, base_imponible, iva_total, total,
//     plataforma (uber/glovo/just_eat o null), categoria_sugerida,
//     concepto_corto. Responde JSON estricto."
// 5. Determina titular_id: si nif_cliente == 21669051S → Rubén; si == 53484832B → Emilio
// 6. Aplica reglas_ocr si hay match por nif_emisor o patron_nombre
// 7. Sube archivo a Drive en estructura:
//    /00 SISTEMA STREAT LAB/05 OPERACIONES/05 FACTURAS RECIBIDAS/{RUBÉN|EMILIO}/{Año}/{1T-4T}/{Mes}/{PLATAFORMAS|PROVEEDORES}/
//    Renombrar: {proveedor}-{nif}-{YYYYMMDD}-{importe}.{ext}
// 8. Inserta en facturas con todos los datos + pdf_drive_url + pdf_hash + estado='pendiente_revision' o 'asociada' según matching
// 9. Busca match en conciliacion por (titular_id + abs(importe-total) < 0.05 + abs(fecha_factura - fecha) <= 3 días)
//    Si match único → insert en facturas_gastos con confirmado=true, update conciliacion.doc_estado='tiene', estado='asociada'
//    Si no → estado='sin_match'
// 10. Retorna { ok, factura_id, estado, drive_url, conciliacion_match_id }
```

Subir y deployar la edge function con `Supabase:deploy_edge_function`.

### 7. Frontend — botón Subir conectado al edge function
En `src/pages/Ocr.tsx`, el botón "Subir facturas" ahora abre `<input type="file" multiple>`. Por cada archivo:

```ts
async function subirArchivos(files: FileList) {
  const archivos = Array.from(files)
  const total = archivos.length
  let ok = 0, pend = 0, dup = 0
  
  // Toast flotante con contadores en tiempo real
  setToastVisible({ total, enviados: 0, ok, pend, dup })
  
  // Procesar en lotes de 3
  for (let i = 0; i < archivos.length; i += 3) {
    const lote = archivos.slice(i, i + 3)
    const resultados = await Promise.all(lote.map(procesarUnArchivo))
    for (const r of resultados) {
      if (r.duplicada) dup++
      else if (r.estado === 'asociada') ok++
      else pend++
    }
    setToastVisible({ total, enviados: i + lote.length, ok, pend, dup })
  }
  
  // Refrescar tabla
  await cargarFacturas()
  
  // Auto-ocultar toast tras 5s
  setTimeout(() => setToastVisible(null), 5000)
}

async function procesarUnArchivo(file: File): Promise<any> {
  const base64 = await fileToBase64(file)
  const { data, error } = await supabase.functions.invoke('ocr-procesar-factura', {
    body: {
      archivo_base64: base64,
      archivo_nombre: file.name,
      mime_type: file.type,
      user_id: usuario.id
    }
  })
  if (error) return { error: true }
  if (data.duplicada) return { duplicada: true }
  return data
}
```

Toast flotante esquina inferior derecha:
- Background `#1e2233`, border-radius 12px, padding 16px 20px
- Box-shadow `0 8px 24px rgba(0,0,0,0.18)`
- Min-width 360px, position fixed bottom-24 right-24
- Pills con contadores: `{enviados}/{total} enviados`, `{ok} conciliadas`, `{pend} pendientes`, `{dup} duplicadas (eliminadas)`
- Barra progreso 4px alta, fill `#1D9E75`

### 8. Modal multi-doc en columna DOC
Cuando una fila tiene varias facturas asociadas (vía facturas_gastos múltiples del mismo movimiento), mostrar 📎 con superíndice del número. Al click abrir modal:
- Lista de PDFs con nombre + fecha + importe
- Cada uno clickable → `window.open(pdf_drive_url, '_blank')`
- Botón "Abrir todos en Drive"

### 9. Verificación post-cambios
Antes de pushear:
1. `npm run build` debe pasar sin errores TS.
2. Verificar `/ocr` carga sin "Error cargando facturas".
3. Verificar sidebar dice "OCR".
4. Verificar selector fechas no se desborda.
5. Verificar que la tab "Reglas OCR" aparece en Configuración.

## Cierre
Commit con mensaje:
```
feat(ocr): funcional completo — fix overflow, sidebar, carga, edge function procesamiento, reglas OCR
```
