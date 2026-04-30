# Spec · Conciliacion · FIX EXACTO CAP 1000 + COLS ORDENABLES

> Sonnet · NO Opus · Aislamiento Binagre absoluto
> Fixes EXACTOS, copiar y pegar. NO improvisar. NO investigar.

## DIAGNÓSTICO YA HECHO

Bug 1: en `src/pages/Conciliacion.tsx`, el query Supabase del useEffect (líneas ~149-176) NO tiene `.range(0, 999999)`. Supabase JS client aplica un default cap de 1000 filas. Por eso siempre llegan 1000 max.

Bug 2: en `src/components/conciliacion/TabMovimientos.tsx`, hay un `PAGE_SIZE = 25` y la tabla pagina, pero como el dataset llega capado a 1000 desde Supabase, el footer dice "Mostrando 25 de 1000".

Mejora 3: las columnas de la tabla deben ser ordenables ASC/DESC al hacer click.

---

## FIX 1 · Conciliacion.tsx

ARCHIVO: `src/pages/Conciliacion.tsx`

LOCALIZAR este bloque (alrededor de la línea 149-176):

```tsx
  useEffect(() => {
    const desdeStr = periodoDesde.toISOString().slice(0, 10)
    const hastaStr = periodoHasta.toISOString().slice(0, 10)
    let cancel = false
    supabase
      .from('conciliacion')
      .select('*, factura_data:facturas(pdf_drive_url, pdf_filename)')
      .gte('fecha', desdeStr)
      .lte('fecha', hastaStr)
      .order('fecha', { ascending: false })
      .then(({ data }) => {
```

REEMPLAZAR por (añade `.range(0, 999999)` justo después de `.order(...)`):

```tsx
  useEffect(() => {
    const desdeStr = periodoDesde.toISOString().slice(0, 10)
    const hastaStr = periodoHasta.toISOString().slice(0, 10)
    let cancel = false
    supabase
      .from('conciliacion')
      .select('*, factura_data:facturas(pdf_drive_url, pdf_filename)')
      .gte('fecha', desdeStr)
      .lte('fecha', hastaStr)
      .order('fecha', { ascending: false })
      .range(0, 999999)
      .then(({ data }) => {
```

ÚNICA diferencia: añadir `.range(0, 999999)` justo después de `.order('fecha', { ascending: false })` y antes del `.then(...)`.

---

## FIX 2 · useConciliacion.ts (también capado a 1000 por defecto)

ARCHIVO: `src/hooks/useConciliacion.ts`

LOCALIZAR la query a `.from('conciliacion')` que carga todos los movimientos (la que alimenta `movimientosBD`).

Añadir `.range(0, 999999)` después del `.order(...)` y antes del `.then(...)` o del `await`.

Si la query está en formato:
```tsx
const { data } = await supabase.from('conciliacion').select('*').order('fecha', { ascending: false })
```

REEMPLAZAR por:
```tsx
const { data } = await supabase.from('conciliacion').select('*').order('fecha', { ascending: false }).range(0, 999999)
```

Aplicar a TODAS las queries del hook que tocan tabla `conciliacion`.

---

## FIX 3 · Buscar otras queries capadas

Ejecutar grep en `src/`:

```bash
grep -rn "from('conciliacion')" src/
grep -rn "from('movimientos" src/
```

Para CADA query encontrada que no tenga `.range(0, 999999)`, añadirlo justo después del `.order(...)` o del `.eq(...)`/`.gte(...)`/`.lte(...)` final, antes del `.then(...)` o `await`.

---

## FIX 4 · Columnas ordenables en TabMovimientos.tsx

ARCHIVO: `src/components/conciliacion/TabMovimientos.tsx`

### 4.1 · Añadir state de ordenación

LOCALIZAR los useState al principio del componente (alrededor línea 41-49):

```tsx
  const [filtroCard, setFiltroCard] = useState<'ingresos' | 'gastos' | 'pendientes' | null>(null)
  const [filtroTitular, setFiltroTitular] = useState<'todos' | 'ruben' | 'emilio'>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [catFiltro, setCatFiltro] = useState('todas')
  const [page, setPage] = useState(1)
  const [modalMov, setModalMov] = useState<Movimiento | null>(null)
  const [categoriasPyg, setCategoriasPyg] = useState<CatPyg[]>([])
  const [titulares, setTitulares] = useState<Titular[]>([])
```

AÑADIR justo después:

```tsx
  // Ordenación de columnas
  type SortKey = 'fecha' | 'concepto' | 'contraparte' | 'importe' | 'categoria' | 'doc' | 'estado' | 'titular'
  type SortDir = 'asc' | 'desc'
  const [sortKey, setSortKey] = useState<SortKey>('fecha')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(1)
  }
```

### 4.2 · Aplicar el sort en el useMemo `filtrados`

LOCALIZAR el bloque (alrededor línea 70-95):

```tsx
  const filtrados = useMemo(() => {
    return movimientos
      .filter(m => {
        if (filtroCard === 'ingresos') return m.importe > 0
        if (filtroCard === 'gastos') return m.importe < 0
        if (filtroCard === 'pendientes') return calcularEstado(m) === 'pendiente'
        return true
      })
      .filter(m => {
        if (filtroTitular === 'todos') return true
        const titNombre = titulares.find(t => t.id === m.titular_id)?.nombre?.toLowerCase() ?? ''
        if (filtroTitular === 'ruben') return titNombre.includes('rubén') || titNombre.includes('ruben')
        if (filtroTitular === 'emilio') return titNombre.includes('emilio')
        return true
      })
      .filter(m => catFiltro === 'todas' || m.categoria_id === catFiltro)
      .filter(m => {
        if (!busqueda) return true
        const q = busqueda.toLowerCase()
        return (
          m.concepto.toLowerCase().includes(q) ||
          (m.contraparte && m.contraparte.toLowerCase().includes(q)) ||
          (m.factura_id && m.factura_id.toLowerCase().includes(q)) ||
          String(Math.abs(m.importe)).includes(q)
        )
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [movimientos, filtroCard, filtroTitular, catFiltro, busqueda, titulares])
```

REEMPLAZAR la línea final `.sort((a, b) => b.fecha.localeCompare(a.fecha))` por un sort dinámico:

```tsx
  const filtrados = useMemo(() => {
    return movimientos
      .filter(m => {
        if (filtroCard === 'ingresos') return m.importe > 0
        if (filtroCard === 'gastos') return m.importe < 0
        if (filtroCard === 'pendientes') return calcularEstado(m) === 'pendiente'
        return true
      })
      .filter(m => {
        if (filtroTitular === 'todos') return true
        const titNombre = titulares.find(t => t.id === m.titular_id)?.nombre?.toLowerCase() ?? ''
        if (filtroTitular === 'ruben') return titNombre.includes('rubén') || titNombre.includes('ruben')
        if (filtroTitular === 'emilio') return titNombre.includes('emilio')
        return true
      })
      .filter(m => catFiltro === 'todas' || m.categoria_id === catFiltro)
      .filter(m => {
        if (!busqueda) return true
        const q = busqueda.toLowerCase()
        return (
          m.concepto.toLowerCase().includes(q) ||
          (m.contraparte && m.contraparte.toLowerCase().includes(q)) ||
          (m.factura_id && m.factura_id.toLowerCase().includes(q)) ||
          String(Math.abs(m.importe)).includes(q)
        )
      })
      .sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1
        let cmp = 0
        switch (sortKey) {
          case 'fecha':
            cmp = a.fecha.localeCompare(b.fecha)
            break
          case 'concepto':
            cmp = a.concepto.localeCompare(b.concepto, 'es', { sensitivity: 'base' })
            break
          case 'contraparte':
            cmp = (a.contraparte ?? '').localeCompare(b.contraparte ?? '', 'es', { sensitivity: 'base' })
            break
          case 'importe':
            cmp = a.importe - b.importe
            break
          case 'categoria': {
            const ca = a.categoria_id ?? ''
            const cb = b.categoria_id ?? ''
            cmp = ca.localeCompare(cb, 'es')
            break
          }
          case 'doc':
            cmp = (a.doc_estado ?? 'falta').localeCompare(b.doc_estado ?? 'falta')
            break
          case 'estado': {
            const ea = calcularEstado(a)
            const eb = calcularEstado(b)
            cmp = ea.localeCompare(eb)
            break
          }
          case 'titular': {
            const ta = titulares.find(t => t.id === a.titular_id)?.nombre ?? ''
            const tb = titulares.find(t => t.id === b.titular_id)?.nombre ?? ''
            cmp = ta.localeCompare(tb, 'es', { sensitivity: 'base' })
            break
          }
        }
        return cmp * dir
      })
  }, [movimientos, filtroCard, filtroTitular, catFiltro, busqueda, titulares, sortKey, sortDir])
```

### 4.3 · Hacer los `<th>` clickeables con indicador visual

LOCALIZAR el `<thead>` (alrededor línea 222-244):

```tsx
              <thead>
                <tr>
                  {['Fecha', 'Concepto', 'Contraparte', 'Importe', 'Categoría', 'Doc', 'Estado', 'Titular'].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        fontFamily: 'Oswald, sans-serif',
                        fontSize: 10,
                        fontWeight: 500,
                        letterSpacing: '2px',
                        color: '#7a8090',
                        textTransform: 'uppercase',
                        textAlign: i === 3 ? 'right' : i === 5 ? 'center' : 'left',
                        padding: '10px 16px',
                        background: '#f5f3ef',
                        borderBottom: '0.5px solid #d0c8bc',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
```

REEMPLAZAR por (añade onClick + cursor pointer + flecha indicadora):

```tsx
              <thead>
                <tr>
                  {([
                    { label: 'Fecha', key: 'fecha' as const },
                    { label: 'Concepto', key: 'concepto' as const },
                    { label: 'Contraparte', key: 'contraparte' as const },
                    { label: 'Importe', key: 'importe' as const },
                    { label: 'Categoría', key: 'categoria' as const },
                    { label: 'Doc', key: 'doc' as const },
                    { label: 'Estado', key: 'estado' as const },
                    { label: 'Titular', key: 'titular' as const },
                  ]).map((col, i) => {
                    const isActive = sortKey === col.key
                    const arrow = isActive ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''
                    return (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        style={{
                          fontFamily: 'Oswald, sans-serif',
                          fontSize: 10,
                          fontWeight: 500,
                          letterSpacing: '2px',
                          color: isActive ? '#B01D23' : '#7a8090',
                          textTransform: 'uppercase',
                          textAlign: i === 3 ? 'right' : i === 5 ? 'center' : 'left',
                          padding: '10px 16px',
                          background: '#f5f3ef',
                          borderBottom: '0.5px solid #d0c8bc',
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#ebe8e2' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f5f3ef' }}
                      >
                        {col.label}{arrow}
                      </th>
                    )
                  })}
                </tr>
              </thead>
```

---

## VALIDACIÓN OBLIGATORIA POSTDEPLOY

Abrir binagre.vercel.app/conciliacion en INCÓGNITO. Tab Movimientos. Selector fecha personalizado: 01/01/2020 → 31/12/2026.

### Test 1 · Cap 1000 eliminado
- Card Ingresos: **+283.354,59 €**
- Card Gastos: **-234.415,64 €**
- Tabla footer: **"Mostrando 25 de 5203 movimientos"** (paginación normal de 25 con TOTAL real)
- Pendientes badge: alrededor de **4400**

### Test 2 · Columnas ordenables
- Click en header "Fecha" → ordena ascendente (▲), click otra vez → descendente (▼)
- Click en "Importe" → ordena por importe asc/desc
- Click en "Concepto" → ordena alfabéticamente A-Z / Z-A
- Las 8 columnas (Fecha, Concepto, Contraparte, Importe, Categoría, Doc, Estado, Titular) deben ser clickeables
- Header activo en color rojo `#B01D23` con flecha ▲ o ▼
- Headers inactivos en gris `#7a8090` sin flecha
- Hover en header cambia background a `#ebe8e2`

Si algún test falla, NO commitear, debug y retest.

---

## ENTREGABLES

1. 4 fixes aplicados literalmente
2. Build limpio (`npm run build`, exit 0)
3. Validación visual con datos reales antes de commitear
4. git add . && git commit -m "fix(conci): cap 1000 supabase + columnas ordenables az/za en tabla movimientos"
5. git push origin master
6. npx vercel --prod
7. Informe con URL deploy + datos del Test 1 y Test 2
