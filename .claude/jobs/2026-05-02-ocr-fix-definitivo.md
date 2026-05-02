# Job: Fix definitivo overflow Semanas X + carga facturas /ocr

## Contexto crítico
Llevamos 3 intentos. Esta vez el fix está IDENTIFICADO en el código real, NO especular.

---

## FIX 1 — Selector Semanas X desbordamiento

**Archivo:** `src/components/ui/SelectorFechaUniversal.tsx`

**Causa raíz:** El bloque `{semanaOpen && (...)}` se renderiza dentro de un `<div style={{ position: 'relative' }}>` SEPARADO (línea ~340), HERMANO del wrapper que contiene el trigger principal. Como el wrapper no es padre del botón trigger, el panel se posiciona respecto al contenedor flex padre y se va hacia el borde derecho de la pantalla.

**Fix:** Mover el bloque `{semanaOpen && (...)}` DENTRO del primer `<div style={{ position: 'relative' }}>` que envuelve el botón trigger principal, justo después del bloque `{open && (...)}`.

Estructura actual (mal):
```tsx
<div ref={containerRef} style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
  <div style={{ position: 'relative' }}>
    <button ...>trigger</button>
    {open && <div style={menuStyle}>opciones</div>}
  </div>
  
  {/* MAL: este div hermano hace que el panel se posicione fuera */}
  {semanaOpen && (
    <div style={{ position: 'relative' }}>
      <div style={{...menuStyle, left: 0, top: 0, ...}}>
        {semanas.map(...)}
      </div>
    </div>
  )}
</div>
```

Estructura correcta:
```tsx
<div ref={containerRef} style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
  <div style={{ position: 'relative' }}>
    <button ...>trigger</button>
    {open && <div style={menuStyle}>opciones</div>}
    {semanaOpen && (
      <div style={menuStyle /* mismo position absolute, top:100%, right:0 */}>
        {semanas.map(s => (
          <button key={`${s.year}-${s.semanaISO}`} style={itemStyle} onClick={() => selectSemana(s)}>
            {s.label}
          </button>
        ))}
      </div>
    )}
  </div>
  
  {/* Personalizado inline inputs van aquí, fuera del wrapper */}
  {opcion === 'personalizado' && (...)}
</div>
```

El panel `semanaOpen` debe usar el mismo `menuStyle` que `open` (con `right: 0`, `top: '100%'`), pero con `maxHeight: 260, overflowY: 'auto'` para limitar altura. Eliminar el wrapper hermano completo.

---

## FIX 2 — Error cargando facturas en /ocr

**Archivo:** `src/pages/Ocr.tsx`

**Causa raíz:** La query consulta columnas que NO existen en la tabla `facturas`. El componente fue copiado de `TabMovimientos.tsx` (que consulta `conciliacion`) sin adaptar al schema de `facturas`.

Schema real `facturas`:
- `fecha_factura` (NO `fecha`)
- `total` (NO `importe`)
- `proveedor_nombre` (NO `concepto` ni `contraparte`)
- `categoria_factura` (NO `categoria_id`)
- `pdf_drive_url` (existe ✓)
- `tipo` (proveedor/plataforma/otro)
- `nif_emisor`, `titular_id`, `numero_factura`, `estado`
- NO existe `conciliado` — el estado se deriva de la relación `facturas_gastos`

Tabla N:N: `facturas_gastos` (factura_id, conciliacion_id, confirmado, importe_asociado).

**Fix completo del archivo `src/pages/Ocr.tsx`:**

### Interface Factura — actualizar:
```tsx
interface Factura {
  id: string
  fecha_factura: string
  proveedor_nombre: string
  total: number
  tipo: string
  categoria_factura: string | null
  nif_emisor: string | null
  titular_id: string | null
  pdf_drive_url: string | null
  pdf_filename: string | null
  numero_factura: string | null
  estado: string
  facturas_gastos: { id: string; confirmado: boolean; conciliacion_id: string }[]
}
```

### Función calcularEstado:
```tsx
function calcularEstado(f: Factura): 'conciliado' | 'pendiente' | 'falta_drive' {
  if (!f.pdf_drive_url) return 'falta_drive'
  const tieneAsoc = f.facturas_gastos && f.facturas_gastos.length > 0 && f.facturas_gastos.some(fg => fg.confirmado)
  if (tieneAsoc) return 'conciliado'
  return 'pendiente'
}
```

### Query cargarPagina — reescribir:
```tsx
const sortMap: Record<string, string | null> = {
  fecha: 'fecha_factura',
  concepto: 'proveedor_nombre',
  contraparte: 'proveedor_nombre',
  importe: 'total',
  categoria: 'categoria_factura',
  doc: 'pdf_drive_url',
  titular: 'titular_id',
  estado: null,
}
const sortField = sortMap[sortColumn] ?? 'fecha_factura'

let q: any = supabase
  .from('facturas')
  .select(`
    id, fecha_factura, proveedor_nombre, total, tipo, categoria_factura,
    nif_emisor, titular_id, pdf_drive_url, pdf_filename, numero_factura, estado,
    facturas_gastos(id, confirmado, conciliacion_id)
  `, { count: 'exact' })
  .gte('fecha_factura', periodoDesdeStr)
  .lte('fecha_factura', periodoHastaStr)

// Filtro por tab
if (tab === 'facturas') q = q.in('tipo', ['proveedor', 'plataforma'])
else if (tab === 'extractos') q = q.eq('tipo', 'otro').eq('categoria_factura', 'extracto_bancario')
else if (tab === 'otros') q = q.eq('tipo', 'otro').neq('categoria_factura', 'extracto_bancario')

// Filtros de card — NO aplicar como columna directa, post-filtrar tras cargar
// Para falta_drive: server-side
if (filtroCard === 'falta_drive') q = q.is('pdf_drive_url', null)
// Para conciliadas y sin_conciliar: necesitan join data → filtrar client-side tras cargar

if (catFiltro !== 'todas') q = q.eq('categoria_factura', catFiltro)

if (busquedaDebounced) {
  const safe = busquedaDebounced.replace(/[%_,()]/g, ' ').trim()
  if (safe) q = q.or(`proveedor_nombre.ilike.%${safe}%,nif_emisor.ilike.%${safe}%,numero_factura.ilike.%${safe}%`)
}

if (sortField) {
  q = q.order(sortField, { ascending: sortDir === 'asc' }).range(from, to)
} else {
  q = q.order('fecha_factura', { ascending: false }).range(from, to)
}

const { data, error, count } = await q
```

### Mapeo de filas:
```tsx
const mapped = (data ?? []).map((m: any): Factura => ({
  id: m.id,
  fecha_factura: m.fecha_factura,
  proveedor_nombre: m.proveedor_nombre ?? '',
  total: Number(m.total) || 0,
  tipo: m.tipo ?? 'proveedor',
  categoria_factura: m.categoria_factura ?? null,
  nif_emisor: m.nif_emisor ?? null,
  titular_id: m.titular_id ?? null,
  pdf_drive_url: m.pdf_drive_url ?? null,
  pdf_filename: m.pdf_filename ?? null,
  numero_factura: m.numero_factura ?? null,
  estado: m.estado ?? '',
  facturas_gastos: m.facturas_gastos ?? [],
}))
```

### Filtros cliente para conciliadas / sin_conciliar:
```tsx
let filtradas = mapped
if (filtroCard === 'conciliadas') {
  filtradas = mapped.filter(f => calcularEstado(f) === 'conciliado')
}
if (filtroCard === 'sin_conciliar') {
  filtradas = mapped.filter(f => calcularEstado(f) === 'pendiente')
}
setFilas(filtradas)
setTotal(count ?? 0)
```

### Render columnas — mapear a campos correctos:
- Fecha: `fmtDate(f.fecha_factura)`
- Concepto: `f.proveedor_nombre`
- Contraparte: `f.nif_emisor || '—'`
- Importe: `fmtEur(f.total)`
- Categoría: buscar por `f.categoria_factura` en `categoriasPyg` (id es string código)
- Doc: `f.pdf_drive_url`
- Estado: `calcularEstado(f)`
- Titular: por `f.titular_id`

### cargarAgregados — reescribir:
```tsx
const { data, error } = await supabase
  .from('facturas')
  .select('id, total, pdf_drive_url, facturas_gastos(confirmado)')
  .gte('fecha_factura', periodoDesdeStr)
  .lte('fecha_factura', periodoHastaStr)

let totalCount = 0, totalImporte = 0
let conciliadasCount = 0, conciliadasImporte = 0
let faltaDriveCount = 0, sinConciliarCount = 0

for (const r of data ?? []) {
  totalCount += 1
  const imp = Number(r.total) || 0
  totalImporte += imp
  
  const tieneAsoc = r.facturas_gastos && r.facturas_gastos.length > 0 && r.facturas_gastos.some((fg: any) => fg.confirmado)
  
  if (!r.pdf_drive_url) {
    faltaDriveCount += 1
  } else if (tieneAsoc) {
    conciliadasCount += 1
    conciliadasImporte += imp
  } else {
    sinConciliarCount += 1
  }
}
```

### handleExportar — actualizar:
```tsx
const rows = (data ?? []).map((m: any) => [
  m.fecha_factura,
  (m.proveedor_nombre ?? '').replace(/,/g, ' '),
  (m.nif_emisor ?? '').replace(/,/g, ' '),
  m.total,
  m.categoria_factura ?? '',
  m.pdf_drive_url ? 'Sí' : 'No',
])
```

---

## VERIFICACIÓN OBLIGATORIA antes de pushear

1. `npm run build` → debe pasar sin errores TS
2. Verificar `Ocr.tsx` no usa `m.fecha`, `m.importe`, `m.concepto`, `m.contraparte`, `m.categoria_id`, `m.conciliado` en NINGÚN sitio
3. Verificar todas las queries a `facturas` usan `fecha_factura` y `total`

## Cierre

Commit:
```
fix(ocr): definitivo — overflow Semanas X dentro del wrapper relative + query con schema real facturas (fecha_factura, total, proveedor_nombre, facturas_gastos)
```
