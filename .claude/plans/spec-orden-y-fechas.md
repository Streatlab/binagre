# Spec · TabMovimientos · Columnas ordenables + fechas español

> Sonnet · NO Opus · Aislamiento Binagre absoluto
> Código LITERAL listo. Copiar y pegar.

## OBJETIVOS

1. **Todas las columnas de la tabla ordenables** (clic en encabezado → asc, segundo clic → desc, tercer clic → sin orden)
2. **Todas las fechas en formato español dd/mm/yyyy** (incluyendo desplegables del SelectorFechaUniversal personalizado)

---

## FIX 1 · TabMovimientos.tsx · Columnas ordenables

ARCHIVO: `src/components/conciliacion/TabMovimientos.tsx`

### 1.A · Añadir estado de ordenación al inicio del componente

LOCALIZAR (alrededor línea 41-47):
```tsx
  const navigate = useNavigate()
  const [filtroCard, setFiltroCard] = useState<'ingresos' | 'gastos' | 'pendientes' | null>(null)
  const [filtroTitular, setFiltroTitular] = useState<'todos' | 'ruben' | 'emilio'>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [catFiltro, setCatFiltro] = useState('todas')
  const [page, setPage] = useState(1)
  const [modalMov, setModalMov] = useState<Movimiento | null>(null)
```

REEMPLAZAR por (añadir 2 líneas de sortColumn y sortDir):
```tsx
  const navigate = useNavigate()
  const [filtroCard, setFiltroCard] = useState<'ingresos' | 'gastos' | 'pendientes' | null>(null)
  const [filtroTitular, setFiltroTitular] = useState<'todos' | 'ruben' | 'emilio'>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [catFiltro, setCatFiltro] = useState('todas')
  const [page, setPage] = useState(1)
  const [modalMov, setModalMov] = useState<Movimiento | null>(null)
  const [sortColumn, setSortColumn] = useState<'fecha' | 'concepto' | 'contraparte' | 'importe' | 'categoria' | 'doc' | 'estado' | 'titular' | null>('fecha')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
```

### 1.B · Añadir función toggle sort y el sort en filtrados

LOCALIZAR (alrededor línea 91, justo antes del `useMemo` de filtrados):
```tsx
  const filtrados = useMemo(() => {
    return movimientos
```

INSERTAR ANTES (la función handleSort):
```tsx
  function handleSort(col: 'fecha' | 'concepto' | 'contraparte' | 'importe' | 'categoria' | 'doc' | 'estado' | 'titular') {
    if (sortColumn === col) {
      if (sortDir === 'asc') setSortDir('desc')
      else if (sortDir === 'desc') { setSortColumn(null); setSortDir('asc') }
      else setSortDir('asc')
    } else {
      setSortColumn(col)
      setSortDir('asc')
    }
    setPage(1)
  }

```

LOCALIZAR el `.sort((a, b) => b.fecha.localeCompare(a.fecha))` al final del useMemo filtrados:
```tsx
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [movimientos, filtroCard, filtroTitular, catFiltro, busqueda, titulares])
```

REEMPLAZAR por:
```tsx
      .sort((a, b) => {
        if (!sortColumn) return b.fecha.localeCompare(a.fecha)
        const dir = sortDir === 'asc' ? 1 : -1
        if (sortColumn === 'fecha') return a.fecha.localeCompare(b.fecha) * dir
        if (sortColumn === 'concepto') return a.concepto.localeCompare(b.concepto) * dir
        if (sortColumn === 'contraparte') return (a.contraparte || '').localeCompare(b.contraparte || '') * dir
        if (sortColumn === 'importe') return (a.importe - b.importe) * dir
        if (sortColumn === 'categoria') {
          const aCat = a.categoria_id || 'zzz'
          const bCat = b.categoria_id || 'zzz'
          return aCat.localeCompare(bCat) * dir
        }
        if (sortColumn === 'doc') {
          const order = { 'tiene': 0, 'no_requiere': 1, 'falta': 2 }
          return ((order[a.doc_estado as keyof typeof order] ?? 3) - (order[b.doc_estado as keyof typeof order] ?? 3)) * dir
        }
        if (sortColumn === 'estado') {
          const aEst = calcularEstado(a)
          const bEst = calcularEstado(b)
          return aEst.localeCompare(bEst) * dir
        }
        if (sortColumn === 'titular') {
          const aT = titulares.find(t => t.id === a.titular_id)?.nombre ?? ''
          const bT = titulares.find(t => t.id === b.titular_id)?.nombre ?? ''
          return aT.localeCompare(bT) * dir
        }
        return 0
      })
  }, [movimientos, filtroCard, filtroTitular, catFiltro, busqueda, titulares, sortColumn, sortDir])
```

### 1.C · Encabezados clicables con icono de orden

LOCALIZAR (alrededor línea 244-262):
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

REEMPLAZAR por:
```tsx
              <thead>
                <tr>
                  {([
                    { label: 'Fecha', col: 'fecha' as const },
                    { label: 'Concepto', col: 'concepto' as const },
                    { label: 'Contraparte', col: 'contraparte' as const },
                    { label: 'Importe', col: 'importe' as const },
                    { label: 'Categoría', col: 'categoria' as const },
                    { label: 'Doc', col: 'doc' as const },
                    { label: 'Estado', col: 'estado' as const },
                    { label: 'Titular', col: 'titular' as const },
                  ]).map((h, i) => {
                    const isActive = sortColumn === h.col
                    const arrow = isActive ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''
                    return (
                      <th
                        key={h.col}
                        onClick={() => handleSort(h.col)}
                        style={{
                          fontFamily: 'Oswald, sans-serif',
                          fontSize: 10,
                          fontWeight: 500,
                          letterSpacing: '2px',
                          color: isActive ? '#FF4757' : '#7a8090',
                          textTransform: 'uppercase',
                          textAlign: i === 3 ? 'right' : i === 5 ? 'center' : 'left',
                          padding: '10px 16px',
                          background: '#f5f3ef',
                          borderBottom: '0.5px solid #d0c8bc',
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                      >
                        {h.label}{arrow}
                      </th>
                    )
                  })}
                </tr>
              </thead>
```

---

## FIX 2 · SelectorFechaUniversal.tsx · Fechas formato español

ARCHIVO: `src/components/ui/SelectorFechaUniversal.tsx`

### 2.A · Aplicar fmtFechaCorta en applyPersonalizado

LOCALIZAR (alrededor línea 224):
```tsx
  function applyPersonalizado() {
    if (!desdeStr || !hastaStr) return
    const d = new Date(desdeStr + 'T00:00:00')
    const h = new Date(hastaStr + 'T23:59:59')
    const label = `${desdeStr} → ${hastaStr}`
    setSelectedLabel(label)
    persist({ opcion: 'personalizado', desde: desdeStr, hasta: hastaStr })
    onChange(d, h, label)
  }
```

REEMPLAZAR por:
```tsx
  function applyPersonalizado() {
    if (!desdeStr || !hastaStr) return
    const d = new Date(desdeStr + 'T00:00:00')
    const h = new Date(hastaStr + 'T23:59:59')
    const label = `${fmtFechaCorta(desdeStr)} → ${fmtFechaCorta(hastaStr)}`
    setSelectedLabel(label)
    persist({ opcion: 'personalizado', desde: desdeStr, hasta: hastaStr })
    onChange(d, h, label)
  }
```

### 2.B · Aplicar fmtFechaCorta al restaurar desde sessionStorage

LOCALIZAR (alrededor línea 178-186):
```tsx
        if (op === 'personalizado' && saved.desde && saved.hasta) {
          const d = new Date(saved.desde)
          const h = new Date(saved.hasta)
          setOpcion(op)
          setDesdeStr(saved.desde)
          setHastaStr(saved.hasta)
          setSelectedLabel(`${saved.desde} → ${saved.hasta}`)
          onChange(d, h, `${saved.desde} → ${saved.hasta}`)
          return
        }
```

REEMPLAZAR por:
```tsx
        if (op === 'personalizado' && saved.desde && saved.hasta) {
          const d = new Date(saved.desde)
          const h = new Date(saved.hasta)
          const labelPers = `${fmtFechaCorta(saved.desde)} → ${fmtFechaCorta(saved.hasta)}`
          setOpcion(op)
          setDesdeStr(saved.desde)
          setHastaStr(saved.hasta)
          setSelectedLabel(labelPers)
          onChange(d, h, labelPers)
          return
        }
```

### 2.C · Inputs `<input type="date">` mostrar formato español

Los `<input type="date">` nativos del navegador respetan el locale del SO. Para forzar formato dd/mm/yyyy hay que añadir lang="es-ES" en el `<input>`.

LOCALIZAR (alrededor línea 350):
```tsx
      {/* Personalizado inline inputs */}
      {opcion === 'personalizado' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="date"
            value={desdeStr}
            onChange={e => setDesdeStr(e.target.value)}
            style={{ ...btnStyle, cursor: 'default' }}
          />
          <span style={{ fontSize: 13, color: '#777', fontFamily: 'Lexend, sans-serif' }}>→</span>
          <input
            type="date"
            value={hastaStr}
            onChange={e => setHastaStr(e.target.value)}
            style={{ ...btnStyle, cursor: 'default' }}
          />
```

REEMPLAZAR por:
```tsx
      {/* Personalizado inline inputs */}
      {opcion === 'personalizado' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="date"
            lang="es-ES"
            value={desdeStr}
            onChange={e => setDesdeStr(e.target.value)}
            style={{ ...btnStyle, cursor: 'default' }}
          />
          <span style={{ fontSize: 13, color: '#777', fontFamily: 'Lexend, sans-serif' }}>→</span>
          <input
            type="date"
            lang="es-ES"
            value={hastaStr}
            onChange={e => setHastaStr(e.target.value)}
            style={{ ...btnStyle, cursor: 'default' }}
          />
```

ÚNICA diferencia: añadir `lang="es-ES"` a ambos inputs.

---

## FIX 3 · Verificar todos los lugares donde se renderiza fecha

Ejecutar:
```bash
grep -rn "fecha" src/components/conciliacion/
grep -rn "fmtDate\|fmtFechaCorta" src/components/conciliacion/
```

Para CADA lugar donde se renderice una fecha proveniente de movimientos, asegurar que se usa `fmtDate(m.fecha)` o `fmtFechaCorta(m.fecha)` (formato español).

Si encuentras renders directos como `{m.fecha}` o `{new Date(...).toISOString()...}`, reemplazar por `{fmtDate(m.fecha)}`.

---

## VALIDACIÓN OBLIGATORIA POSTDEPLOY

binagre.vercel.app/conciliacion en INCÓGNITO. Tab Movimientos.

### Test A · Columnas ordenables
1. Click en encabezado "Fecha" → orden ascendente (más antiguo arriba), aparece flecha ↑
2. Click otra vez → desc, flecha ↓
3. Click otra vez → sin orden (orden por defecto)
4. Repetir con TODAS las columnas: Concepto, Contraparte, Importe, Categoría, Doc, Estado, Titular

### Test B · Fechas formato español
1. Selector → Personalizado → seleccionar fechas
2. Inputs deben mostrar dd/mm/yyyy
3. Tras click "Aplicar", el selector debe mostrar "01/01/20 → 31/12/26" (formato corto español, NO ISO)
4. La columna Fecha de la tabla debe mostrar dd/mm/yy

Si CUALQUIER test falla, NO commitear.

## ENTREGABLES

1. 3 fixes aplicados literalmente
2. Build limpio
3. Validación visual antes de commitear
4. git add . && git commit -m "feat(conci): columnas ordenables + fechas formato español"
5. git push origin master
6. npx vercel --prod
7. Informe con URL deploy + tests A y B validados
