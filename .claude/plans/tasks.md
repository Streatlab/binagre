# Tasks: Conciliación — paginación server-side con URL params

Ejecución secuencial T1 → T18. Cada tarea es atómica y verificable. Modo localhost (sin `npx vercel --prod`).

---

## T1 — Inspección previa (no edita código)

**Archivo**: `src/components/conciliacion/TabMovimientos.tsx` (read-only)
**Acción**: leer el archivo completo y anotar:
- Firma actual de props (interface/type)
- Estados existentes (`busqueda`, `catFiltro`, `filtroCard`, `filtroTitular`, `sortColumn`, `sortDir`, `paginaActual` o equivalente)
- Imports actuales de `react-router-dom`
- Cómo se construye `movimientosFiltrados` y `movimientosPaginados`
- Cómo se renderizan las cards KPI (`ingresosImporte`, `gastosImporte`, `pendientesCount`, `pendientesImporte`)
- Cómo funciona `handleExportar` actual

**Criterio de aceptación**: producir un comentario interno (mental, no archivo) con la lista exacta de cambios que harán T2–T16. No se edita nada todavía.

---

## T2 — Constantes y tipos de paginación

**Archivo**: `src/components/conciliacion/TabMovimientos.tsx`
**Acción**: añadir al inicio del archivo (después de imports, fuera del componente):
```ts
const PAGE_SIZES = [25, 50, 100, 200] as const
type PageSize = typeof PAGE_SIZES[number]
const DEFAULT_PAGE_SIZE: PageSize = 50

function parsePageSize(raw: string | null): PageSize {
  const n = Number(raw)
  return (PAGE_SIZES as readonly number[]).includes(n) ? (n as PageSize) : DEFAULT_PAGE_SIZE
}
function parsePage(raw: string | null): number {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 ? n : 1
}
```

**Criterio de aceptación**: `npx tsc --no-emit` pasa. Las constantes son referenciables desde el componente.

---

## T3 — Cambiar firma de props de `TabMovimientos`

**Archivo**: `src/components/conciliacion/TabMovimientos.tsx`
**Acción**: en la `interface` o `type` de props:
- Eliminar `movimientos: Movimiento[]` (o el nombre que tenga)
- Mantener: `periodoDesde: string`, `periodoHasta: string`, `periodoLabel: string`
- Mantener: `titulares` (si ya existe como prop) — si no existe, dejar para T7
- Mantener: cualquier callback existente (`onMatching`, `onCategorizar`, etc.) sin tocar

**Criterio de aceptación**: TypeScript marca error en `Conciliacion.tsx` por prop inexistente; ese error se resolverá en T16.

---

## T4 — Hook `useSearchParams` + helper `updateUrl`

**Archivo**: `src/components/conciliacion/TabMovimientos.tsx`
**Acción**: dentro del componente, justo después del primer `useState`:
```ts
import { useSearchParams } from 'react-router-dom' // añadir si no está
// ...
const [searchParams, setSearchParams] = useSearchParams()
const page     = parsePage(searchParams.get('page'))
const pageSize = parsePageSize(searchParams.get('size'))
```

Y un helper estable (con `useCallback`):
```ts
const updateUrl = useCallback((next: { page?: number; size?: PageSize }) => {
  const params = new URLSearchParams(searchParams)
  if (next.page  !== undefined) params.set('page', String(next.page))
  if (next.size  !== undefined) params.set('size', String(next.size))
  setSearchParams(params, { replace: true })
}, [searchParams, setSearchParams])
```

**Criterio de aceptación**: `npx tsc --no-emit` pasa. `page` y `pageSize` son números válidos siempre.

---

## T5 — Estado interno de datos paginados

**Archivo**: `src/components/conciliacion/TabMovimientos.tsx`
**Acción**: eliminar (si existe) el cálculo client-side de `movimientosPaginados` con `useMemo`. Añadir estados:
```ts
const [filas, setFilas]               = useState<Movimiento[]>([])
const [total, setTotal]               = useState<number>(0)
const [cargando, setCargando]         = useState<boolean>(true)
const [errorCarga, setErrorCarga]     = useState<string | null>(null)
const fetchIdRef                      = useRef<number>(0)
```

Importar `useRef` de React si no estaba.

**Criterio de aceptación**: `npx tsc --no-emit` pasa. Los estados están visibles en el componente.

---

## T6 — Estado de agregados KPI

**Archivo**: `src/components/conciliacion/TabMovimientos.tsx`
**Acción**: añadir:
```ts
type Agregados = {
  ingresosImporte: number
  gastosImporte: number
  pendientesCount: number
  pendientesImporte: number
}
const [agregados, setAgregados] = useState<Agregados | null>(null)
```

Eliminar (si existen) los `useMemo` que calculaban estos 4 valores desde la prop `movimientos`. Reemplazar las referencias en JSX por `agregados?.ingresosImporte ?? null` (mostrar `—` si null).

**Criterio de aceptación**: las 4 cards leen de `agregados`; si `agregados === null` muestran `—`. `npx tsc --no-emit` pasa.

---

## T7 — Función `cargarPagina` (query principal)

**Archivo**: `src/components/conciliacion/TabMovimientos.tsx`
**Acción**: añadir dentro del componente:
```ts
const cargarPagina = useCallback(async () => {
  const myFetchId = ++fetchIdRef.current
  setCargando(true)
  setErrorCarga(null)

  const from = (page - 1) * pageSize
  const to   = from + pageSize - 1

  const sortMap: Record<string, string | null> = {
    fecha: 'fecha',
    concepto: 'concepto',
    contraparte: 'proveedor',
    importe: 'importe',
    categoria: 'categoria',
    doc: 'doc_estado',
    titular: 'titular_id',
    estado: null, // client-side
  }
  const sortField = sortMap[sortColumn] ?? 'fecha'

  let q = supabase
    .from('conciliacion')
    .select('*, factura_data:facturas(pdf_drive_url, pdf_filename)', { count: 'exact' })
    .gte('fecha', periodoDesde)
    .lte('fecha', periodoHasta)

  if (filtroCard === 'ingresos') q = q.gt('importe', 0)
  if (filtroCard === 'gastos')   q = q.lt('importe', 0)
  if (catFiltro !== 'todas')     q = q.eq('categoria', catFiltro)
  if (filtroTitular !== 'todos' && titulares.length > 0) {
    const t = titulares.find(x => x.nombre === filtroTitular)
    if (t) q = q.eq('titular_id', t.id)
  }

  q = q.order(sortField, { ascending: sortDir === 'asc' }).range(from, to)

  const { data, error, count } = await q

  if (myFetchId !== fetchIdRef.current) return // respuesta obsoleta

  if (error) {
    setErrorCarga('Error cargando movimientos. Intenta de nuevo.')
    setFilas([])
    setTotal(0)
  } else {
    setFilas((data ?? []) as Movimiento[])
    setTotal(count ?? 0)
  }
  setCargando(false)
}, [page, pageSize, sortColumn, sortDir, filtroCard, catFiltro, filtroTitular, titulares, periodoDesde, periodoHasta])
```

Verificar que `Movimiento` (o el tipo equivalente) esté importado.

**Criterio de aceptación**: `npx tsc --no-emit` pasa. La función no se llama todavía; solo está definida.

---

## T8 — Función `cargarAgregados` (query paralela KPIs)

**Archivo**: `src/components/conciliacion/TabMovimientos.tsx`
**Acción**: añadir:
```ts
const cargarAgregados = useCallback(async () => {
  const { data, error } = await supabase
    .from('conciliacion')
    .select('importe, categoria, doc_estado, titular_id')
    .gte('fecha', periodoDesde)
    .lte('fecha', periodoHasta)

  if (error || !data) {
    setAgregados(null)
    return
  }

  let ingresosImporte = 0, gastosImporte = 0
  let pendientesCount = 0, pendientesImporte = 0

  for (const r of data) {
    const imp = Number(r.importe) || 0
    if (imp > 0) ingresosImporte += imp
    if (imp < 0) gastosImporte   += imp
    if (!r.categoria || r.categoria === 'pendiente') {
      pendientesCount += 1
      pendientesImporte += imp
    }
  }
  setAgregados({ ingresosImporte, gastosImporte, pendientesCount, pendientesImporte })
}, [periodoDesde, periodoHasta])
```

NOTA: la lógica de "qué es pendiente" debe alinearse con la lógica que tenía el componente antes (revisar en T1). Si era distinta (p.ej. `doc_estado === 'pendiente'`), ajustar el `if`.

**Criterio de aceptación**: `npx tsc --no-emit` pasa. La lógica de `pendiente` coincide con la lógica eliminada en T6.

---

## T9 — `useEffect`s de disparo

**Archivo**: `src/components/conciliacion/TabMovimientos.tsx`
**Acción**: añadir dos efectos:
```ts
// 1) Query paginada: en cada cambio de page/size/orden/filtros/período
useEffect(() => { cargarPagina() }, [cargarPagina])

// 2) Query agregados: solo en cambio de período
useEffect(() => { cargarAgregados() }, [cargarAgregados])
```

**Criterio de aceptación**: al montar, se lanzan ambas queries. Cambiar página relanza solo la paginada (verificar con `console.log` temporal en cada función, eliminarlos antes de T17).

---

## T10 — Reset de página al cambiar filtros / orden / período

**Archivo**: `src/components/conciliacion/TabMovimientos.tsx`
**Acción**: en CADA setter que ya existía (`setBusqueda`, `setCatFiltro`, `setFiltroCard`, `setFiltroTitular`, `setSortColumn`, `setSortDir`) y en cualquier handler que cambie `periodoDesde`/`periodoHasta` (si aplica), llamar inmediatamente después:
```ts
if (page !== 1) updateUrl({ page: 1 })
```

Patrón recomendado: envolver cada setter en un handler local:
```ts
const onCambiarCatFiltro = (v: string) => {
  setCatFiltro(v)
  if (page !== 1) updateUrl({ page: 1 })
}
```

Y usar `onCambiarCatFiltro` en el JSX en lugar del `setCatFiltro` directo.

**Criterio de aceptación**: cambiar un filtro estando en página 5 lleva a página 1 y URL `?page=1&size=...`.

---

## T11 — Auto-corrección de `page` y `size` fuera de rango

**Archivo**: `src/components/conciliacion/TabMovimientos.tsx`
**Acción**: añadir un `useEffect` que, tras cargar, corrija la URL si `page > totalPages`:
```ts
useEffect(() => {
  if (cargando) return
  if (total === 0) return
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (page > totalPages) updateUrl({ page: totalPages })
}, [cargando, total, pageSize, page, updateUrl])
```

También añadir corrección de `size` inválido en montaje (una sola vez):
```ts
useEffect(() => {
  const raw = searchParams.get('size')
  if (raw !== null && !PAGE_SIZES.includes(Number(raw) as PageSize)) {
    updateUrl({ size: DEFAULT_PAGE_SIZE })
  }
}, []) // eslint-disable-line react-hooks/exhaustive-deps
```

**Criterio de aceptación**: pegar `?page=99&size=50` en URL con 3 páginas → carga página 3 y URL queda `?page=3&size=50`. Pegar `?size=999` → URL queda `?size=50`.

---

## T12 — Controles de pie de tabla

**Archivo**: `src/components/conciliacion/TabMovimientos.tsx`
**Acción**: justo debajo de `</table>` (o donde acaba la tabla), añadir bloque condicional:
```tsx
{total > 0 && (() => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (totalPages === 1) return null
  const desde = (page - 1) * pageSize + 1
  const hasta = Math.min(page * pageSize, total)
  const isFirst = page === 1
  const isLast  = page === totalPages

  const btnBase: React.CSSProperties = {
    background: '#fff',
    border: '0.5px solid #d0c8bc',
    borderRadius: 8,
    padding: '6px 12px',
    fontFamily: 'Lexend, sans-serif',
    fontSize: 13,
    color: '#111',
    cursor: 'pointer',
  }
  const btnDisabled: React.CSSProperties = { ...btnBase, opacity: 0.35, cursor: 'default' }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '14px 16px',
      background: '#fafaf7',
      borderTop: '0.5px solid #d0c8bc',
    }}>
      <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#7a8090' }}>
        {`Mostrando ${desde.toLocaleString('es-ES')}–${hasta.toLocaleString('es-ES')} de ${total.toLocaleString('es-ES')} movimientos`}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <label style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, color: '#7a8090', textTransform: 'uppercase' }}>
          Filas:
        </label>
        <select
          value={pageSize}
          onChange={(e) => updateUrl({ page: 1, size: Number(e.target.value) as PageSize })}
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            border: '0.5px solid #d0c8bc',
            background: '#fff',
            fontFamily: 'Lexend, sans-serif',
            fontSize: 13,
          }}
        >
          {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <button style={isFirst ? btnDisabled : btnBase} disabled={isFirst}
                onClick={() => !isFirst && updateUrl({ page: 1 })}>
          Primera
        </button>
        <button style={isFirst ? btnDisabled : btnBase} disabled={isFirst}
                onClick={() => !isFirst && updateUrl({ page: page - 1 })}>
          ‹ Anterior
        </button>
        <span style={{ ...btnBase, cursor: 'default' }}>
          {`Página ${page} de ${totalPages}`}
        </span>
        <button style={isLast ? btnDisabled : btnBase} disabled={isLast}
                onClick={() => !isLast && updateUrl({ page: page + 1 })}>
          Siguiente ›
        </button>
        <button style={isLast ? btnDisabled : btnBase} disabled={isLast}
                onClick={() => !isLast && updateUrl({ page: totalPages })}>
          Última
        </button>
      </div>
    </div>
  )
})()}
```

**Criterio de aceptación**: pie aparece con texto + selector + 5 botones. En página 1, "Primera"/"Anterior" tienen `opacity 0.35` y no responden a click. En última página idem con "Siguiente"/"Última". Selector cambia tamaño y resetea a página 1.

---

## T13 — Banner de error + reintentar

**Archivo**: `src/components/conciliacion/TabMovimientos.tsx`
**Acción**: justo encima de la tabla (dentro del contenedor principal del tab), añadir:
```tsx
{errorCarga && (
  <div style={{
    background: '#fff5f5',
    border: '0.5px solid #B01D23',
    borderRadius: 8,
    padding: '10px 14px',
    margin: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontFamily: 'Lexend, sans-serif',
    fontSize: 13,
    color: '#B01D23',
  }}>
    <span>{errorCarga}</span>
    <button
      onClick={() => { cargarPagina(); cargarAgregados() }}
      style={{
        background: '#B01D23',
        color: '#fff',
        border: 'none',
        borderRadius: 6,
        padding: '6px 14px',
        fontFamily: 'Oswald, sans-serif',
        fontSize: 11,
        textTransform: 'uppercase',
        cursor: 'pointer',
      }}
    >
      Reintentar
    </button>
  </div>
)}
```

**Criterio de aceptación**: simular error (apagar wifi, recargar) → banner visible con botón funcional. Click "Reintentar" relanza ambas queries.

---

## T14 — Búsqueda y sort `estado` client-side sobre `filas`

**Archivo**: `src/components/conciliacion/TabMovimientos.tsx`
**Acción**: la variable que se mapea en `<tbody>` ya no es `movimientosPaginados` sino una derivada de `filas`:
```ts
const filasVisibles = useMemo(() => {
  let out = filas
  if (busqueda.trim()) {
    const q = busqueda.trim().toLowerCase()
    out = out.filter(m =>
      (m.concepto ?? '').toLowerCase().includes(q) ||
      (m.proveedor ?? '').toLowerCase().includes(q) ||
      (m.categoria ?? '').toLowerCase().includes(q)
    )
  }
  if (sortColumn === 'estado') {
    out = [...out].sort((a, b) => {
      const ea = (a as any).estado_calc ?? ''
      const eb = (b as any).estado_calc ?? ''
      return sortDir === 'asc' ? ea.localeCompare(eb) : eb.localeCompare(ea)
    })
  }
  return out
}, [filas, busqueda, sortColumn, sortDir])
```

Reemplazar el `.map()` de `<tbody>` para iterar sobre `filasVisibles`.

Actualizar el placeholder del input de búsqueda a "Buscar en página actual".

**Criterio de aceptación**: la búsqueda filtra solo dentro de la página visible. Click en th "Estado" ordena client-side. `npx tsc --no-emit` pasa.

---

## T15 — Adaptar `handleExportar` a query sin range

**Archivo**: `src/components/conciliacion/TabMovimientos.tsx`
**Acción**: añadir estado `exportando` y reemplazar el cuerpo de `handleExportar`:
```ts
const [exportando, setExportando] = useState(false)

const handleExportar = async () => {
  setExportando(true)
  try {
    let q = supabase
      .from('conciliacion')
      .select('*')
      .gte('fecha', periodoDesde)
      .lte('fecha', periodoHasta)
    if (filtroCard === 'ingresos') q = q.gt('importe', 0)
    if (filtroCard === 'gastos')   q = q.lt('importe', 0)
    if (catFiltro !== 'todas')     q = q.eq('categoria', catFiltro)
    if (filtroTitular !== 'todos' && titulares.length > 0) {
      const t = titulares.find(x => x.nombre === filtroTitular)
      if (t) q = q.eq('titular_id', t.id)
    }
    const { data, error } = await q.order('fecha', { ascending: false })
    if (error || !data) return
    // Mantener la lógica de generación de CSV existente, alimentándola con `data`
  } finally {
    setExportando(false)
  }
}
```

En el botón de exportar: `disabled={exportando}` + texto `{exportando ? 'Exportando...' : 'Exportar'}`.

**Criterio de aceptación**: click "Exportar" descarga CSV con TODOS los registros del período + filtros activos (no solo la página). Botón muestra "Exportando..." durante la descarga.

---

## T16 — Limpiar `Conciliacion.tsx`

**Archivo**: `src/pages/Conciliacion.tsx`
**Acción**:
1. Eliminar el `useEffect` de líneas 163–192 que carga `movimientosPeriodo`
2. Eliminar el `useState` de `movimientosPeriodo` (y su setter)
3. Eliminar la prop `movimientos={movimientosPeriodo}` del JSX `<TabMovimientos ... />`
4. Verificar que `periodoDesde`, `periodoHasta`, `periodoLabel`, `titulares` (si aplica) siguen pasándose

**Criterio de aceptación**: `npx tsc --no-emit` pasa. No hay imports muertos. El JSX `<TabMovimientos>` solo recibe las props nuevas definidas en T3.

---

## T17 — Validación localhost

**Archivo**: ninguno (validación)
**Acción**: ejecutar:
```bash
npx tsc --no-emit
npm run build
```
Luego `npm run dev` y verificar manualmente la lista de validación del ADR (puntos 1–13).

**Criterio de aceptación**:
- TS: 0 errores
- Build: 0 errores
- Los 13 puntos de validación del ADR pasan en localhost

---

## T18 — Cadena git (sin Vercel)

**Archivo**: ninguno (terminal)
**Acción**: ejecutar la cadena obligatoria en MODO LOCALHOST (sin `npx vercel --prod`):
```bash
git add src/pages/Conciliacion.tsx src/components/conciliacion/TabMovimientos.tsx .claude/plans/adr.md .claude/plans/tasks.md
git commit -m "feat(conciliacion): paginación server-side con URL params + KPIs paralelos"
git push origin master
git pull origin master
```

**Criterio de aceptación**: commit en master, push OK, pull OK. NO ejecutar `npx vercel --prod` (RULES.md sección 3, modo localhost).
