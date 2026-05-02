import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FONT } from '@/styles/tokens'
import { fmtEur, fmtDate } from '@/utils/format'
import { supabase } from '@/lib/supabase'
import TabsPastilla from '@/components/ui/TabsPastilla'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'

type TabId = 'facturas' | 'extractos' | 'otros'
type SortColumn = 'fecha' | 'concepto' | 'contraparte' | 'importe' | 'categoria' | 'doc' | 'estado' | 'titular'
type SortDir = 'asc' | 'desc'
type FiltroCard = 'conciliadas' | 'falta_drive' | 'sin_conciliar' | null

const PAGE_SIZES = [50, 100, 200] as const
type PageSize = typeof PAGE_SIZES[number]
const DEFAULT_PAGE_SIZE: PageSize = 100

function parsePageSize(raw: string | null): PageSize {
  const n = Number(raw)
  return (PAGE_SIZES as readonly number[]).includes(n) ? (n as PageSize) : DEFAULT_PAGE_SIZE
}
function parsePage(raw: string | null): number {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

interface CatPyg { id: string; nombre: string; nivel: number; parent_id: string | null }
interface Titular { id: string; nombre: string }
interface FgItem { id: string; confirmado: boolean; conciliacion_id: string }
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
  facturas_gastos: FgItem[]
}

interface Agregados {
  totalCount: number
  totalImporte: number
  conciliadasCount: number
  conciliadasPct: number
  conciliadasImporte: number
  faltaDriveCount: number
  sinConciliarCount: number
}

function calcularEstado(f: Factura): 'conciliado' | 'pendiente' | 'falta_drive' {
  if (!f.pdf_drive_url) return 'falta_drive'
  const tieneAsoc = Array.isArray(f.facturas_gastos) && f.facturas_gastos.some(fg => fg.confirmado)
  if (tieneAsoc) return 'conciliado'
  return 'pendiente'
}

export default function Ocr() {
  const [fechaDesde, setFechaDesde] = useState(new Date())
  const [fechaHasta, setFechaHasta] = useState(new Date())
  const [periodoLabel, setPeriodoLabel] = useState('')

  const [tab, setTab] = useState<TabId>('facturas')
  const [filtroCard, setFiltroCard] = useState<FiltroCard>(null)
  const [busqueda, setBusqueda] = useState('')
  const [busquedaDebounced, setBusquedaDebounced] = useState('')
  const [catFiltro, setCatFiltro] = useState('todas')
  const [sortColumn, setSortColumn] = useState<SortColumn>('fecha')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePage(searchParams.get('page'))
  const pageSize = parsePageSize(searchParams.get('size'))

  const updateUrl = useCallback((next: { page?: number; size?: PageSize }) => {
    const params = new URLSearchParams(searchParams)
    if (next.page !== undefined) params.set('page', String(next.page))
    if (next.size !== undefined) params.set('size', String(next.size))
    setSearchParams(params, { replace: true })
  }, [searchParams, setSearchParams])

  const [filas, setFilas] = useState<Factura[]>([])
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const fetchIdRef = useRef(0)

  const [agregados, setAgregados] = useState<Agregados | null>(null)
  const [refreshTick] = useState(0)

  const [categoriasPyg, setCategoriasPyg] = useState<CatPyg[]>([])
  const [titulares, setTitulares] = useState<Titular[]>([])

  const [exportando, setExportando] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setBusquedaDebounced(busqueda.trim()), 400)
    return () => clearTimeout(t)
  }, [busqueda])

  useEffect(() => {
    Promise.all([
      supabase.from('categorias_pyg').select('id, nombre, nivel, parent_id').eq('activa', true).order('orden'),
      supabase.from('titulares').select('id, nombre').eq('activo', true).order('orden'),
    ]).then(([cats, tits]) => {
      if (!cats.error) setCategoriasPyg(cats.data ?? [])
      if (!tits.error) setTitulares(tits.data ?? [])
    })
  }, [])

  const periodoDesdeStr = fechaDesde.toISOString().slice(0, 10)
  const periodoHastaStr = fechaHasta.toISOString().slice(0, 10)

  const cargarPagina = useCallback(async () => {
    const myFetchId = ++fetchIdRef.current
    setCargando(true)
    setErrorCarga(null)

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

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
      .select(
        'id, fecha_factura, proveedor_nombre, total, tipo, categoria_factura, nif_emisor, titular_id, pdf_drive_url, pdf_filename, numero_factura, estado, facturas_gastos(id, confirmado, conciliacion_id)',
        { count: 'exact' }
      )
      .gte('fecha_factura', periodoDesdeStr)
      .lte('fecha_factura', periodoHastaStr)

    if (tab === 'facturas') q = q.in('tipo', ['proveedor', 'plataforma'])
    else if (tab === 'extractos') q = q.eq('tipo', 'otro').eq('categoria_factura', 'extracto_bancario')
    else if (tab === 'otros') q = q.eq('tipo', 'otro').neq('categoria_factura', 'extracto_bancario')

    if (filtroCard === 'falta_drive') q = q.is('pdf_drive_url', null)

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

    if (myFetchId !== fetchIdRef.current) return

    if (error) {
      setErrorCarga('Error cargando facturas. Intenta de nuevo.')
      setFilas([])
      setTotal(0)
    } else {
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

      let filtradas = mapped
      if (filtroCard === 'conciliadas') {
        filtradas = mapped.filter(f => calcularEstado(f) === 'conciliado')
      } else if (filtroCard === 'sin_conciliar') {
        filtradas = mapped.filter(f => calcularEstado(f) === 'pendiente')
      }

      setFilas(filtradas)
      setTotal(count ?? 0)
    }
    setCargando(false)
  }, [page, pageSize, sortColumn, sortDir, filtroCard, catFiltro, periodoDesdeStr, periodoHastaStr, refreshTick, busquedaDebounced, tab])

  const cargarAgregados = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('facturas')
        .select('id, total, pdf_drive_url, facturas_gastos(confirmado)')
        .gte('fecha_factura', periodoDesdeStr)
        .lte('fecha_factura', periodoHastaStr)

      if (error) throw error

      let totalCount = 0
      let totalImporte = 0
      let conciliadasCount = 0
      let conciliadasImporte = 0
      let faltaDriveCount = 0
      let sinConciliarCount = 0

      for (const r of data ?? []) {
        totalCount += 1
        const imp = Number(r.total) || 0
        totalImporte += imp

        const tieneAsoc = Array.isArray(r.facturas_gastos) && r.facturas_gastos.some((fg: any) => fg.confirmado)

        if (!r.pdf_drive_url) {
          faltaDriveCount += 1
        } else if (tieneAsoc) {
          conciliadasCount += 1
          conciliadasImporte += imp
        } else {
          sinConciliarCount += 1
        }
      }

      const conciliadasPct = totalCount > 0 ? Math.round((conciliadasCount / totalCount) * 100) : 0

      setAgregados({
        totalCount,
        totalImporte,
        conciliadasCount,
        conciliadasPct,
        conciliadasImporte,
        faltaDriveCount,
        sinConciliarCount,
      })
    } catch {
      setAgregados(null)
    }
  }, [periodoDesdeStr, periodoHastaStr, refreshTick])

  useEffect(() => { cargarPagina() }, [cargarPagina])
  useEffect(() => { cargarAgregados() }, [cargarAgregados])

  useEffect(() => {
    if (cargando) return
    if (total === 0) return
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    if (page > totalPages) updateUrl({ page: totalPages })
  }, [cargando, total, pageSize, page, updateUrl])

  const onCambiarFiltroCard = (v: FiltroCard) => {
    setFiltroCard(prev => prev === v ? null : v)
    if (page !== 1) updateUrl({ page: 1 })
  }

  const onCambiarBusqueda = (v: string) => {
    setBusqueda(v)
    if (page !== 1) updateUrl({ page: 1 })
  }

  const onCambiarCatFiltro = (v: string) => {
    setCatFiltro(v)
    if (page !== 1) updateUrl({ page: 1 })
  }

  function handleSort(col: SortColumn) {
    if (sortColumn === col) {
      if (sortDir === 'asc') setSortDir('desc')
      else setSortDir('asc')
    } else {
      setSortColumn(col)
      setSortDir('asc')
    }
    if (page !== 1) updateUrl({ page: 1 })
  }

  const filasVisibles = useMemo(() => {
    let out = filas
    if (sortColumn === 'estado') {
      out = [...out].sort((a, b) => {
        const ea = calcularEstado(a)
        const eb = calcularEstado(b)
        return sortDir === 'asc' ? ea.localeCompare(eb) : eb.localeCompare(ea)
      })
    }
    return out
  }, [filas, sortColumn, sortDir])

  function getBadgeCategoria(f: Factura) {
    if (!f.categoria_factura) return null
    const cat = categoriasPyg.find(c => c.id === f.categoria_factura)
    if (cat) return { id: cat.id, nombre: cat.nombre }
    return { id: f.categoria_factura, nombre: f.categoria_factura }
  }

  const handleExportar = async () => {
    setExportando(true)
    try {
      const { data } = await supabase
        .from('facturas')
        .select('fecha_factura, proveedor_nombre, nif_emisor, total, categoria_factura, pdf_drive_url')
        .gte('fecha_factura', periodoDesdeStr)
        .lte('fecha_factura', periodoHastaStr)

      const rows = (data ?? []).map((m: any) => [
        m.fecha_factura,
        (m.proveedor_nombre ?? '').replace(/,/g, ' '),
        (m.nif_emisor ?? '').replace(/,/g, ' '),
        m.total,
        m.categoria_factura ?? '',
        m.pdf_drive_url ? 'Sí' : 'No',
      ])
      const csv = [
        ['Fecha', 'Proveedor', 'NIF', 'Total', 'Categoría', 'Doc'].join(','),
        ...rows.map(r => r.join(',')),
      ].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `facturas_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
    } catch {
    } finally {
      setExportando(false)
    }
  }

  const handleSubir = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = '.pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.xls,.doc,.docx'
    input.onchange = async (e: any) => {
      const files = Array.from(e.target.files || []) as File[]
      if (files.length === 0) return
      console.log('Subir archivos:', files)
    }
    input.click()
  }

  const cardStyle = (_filtro: FiltroCard, isActive: boolean): React.CSSProperties => ({
    background: '#fff',
    border: isActive ? '1px solid #FF4757' : '0.5px solid #d0c8bc',
    borderRadius: 14,
    padding: '18px 20px',
    cursor: 'pointer',
    boxShadow: isActive ? '0 0 0 3px #FF475715' : 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  })

  const HEADERS: { label: string; col: SortColumn; align: 'left' | 'right' | 'center' }[] = [
    { label: 'Fecha', col: 'fecha', align: 'left' },
    { label: 'Concepto', col: 'concepto', align: 'left' },
    { label: 'NIF/Contraparte', col: 'contraparte', align: 'left' },
    { label: 'Importe', col: 'importe', align: 'right' },
    { label: 'Categoría', col: 'categoria', align: 'left' },
    { label: 'Doc', col: 'doc', align: 'center' },
    { label: 'Estado', col: 'estado', align: 'left' },
    { label: 'Titular', col: 'titular', align: 'left' },
  ]

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const TABS = [
    { id: 'facturas', label: 'Facturas' },
    { id: 'extractos', label: 'Extractos bancarios' },
    { id: 'otros', label: 'Otros documentos' },
  ]

  const tituloBotonSubir = tab === 'facturas' ? 'Subir facturas' : tab === 'extractos' ? 'Subir extractos' : 'Subir documentos'

  return (
    <div style={{ background: '#f5f3ef', padding: '24px 28px', minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 style={{
            fontFamily: FONT.heading,
            fontSize: 22,
            fontWeight: 600,
            color: '#B01D23',
            textTransform: 'uppercase',
            letterSpacing: '3px',
            margin: 0,
          }}>
            OCR
          </h1>
          <p style={{ fontFamily: FONT.body, fontSize: 13, color: '#7a8090', marginTop: 4, marginBottom: 0 }}>
            {periodoLabel}
          </p>
        </div>
        <div>
          <SelectorFechaUniversal
            nombreModulo="ocr"
            defaultOpcion="mes_en_curso"
            onChange={(desde, hasta, label) => {
              setFechaDesde(desde)
              setFechaHasta(hasta)
              setPeriodoLabel(label)
            }}
          />
        </div>
      </div>

      <TabsPastilla
        tabs={TABS}
        activeId={tab}
        onChange={(id) => setTab(id as TabId)}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14, marginTop: 14 }}>
        <div onClick={() => onCambiarFiltroCard(null)} style={cardStyle(null, filtroCard === null)}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }}>Total facturas</span>
          </div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', color: '#111' }}>
            {agregados !== null ? agregados.totalCount : '—'}
          </div>
          <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090', marginTop: 4 }}>
            {agregados !== null ? fmtEur(agregados.totalImporte) : '—'}
          </div>
        </div>

        <div onClick={() => onCambiarFiltroCard('conciliadas')} style={cardStyle('conciliadas', filtroCard === 'conciliadas')}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }}>Conciliadas</span>
          </div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', color: '#1D9E75' }}>
            {agregados !== null ? agregados.conciliadasCount : '—'}
          </div>
          <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090', marginTop: 4 }}>
            {agregados !== null ? `${agregados.conciliadasPct}% del periodo · ${fmtEur(agregados.conciliadasImporte)}` : '—'}
          </div>
        </div>

        <div style={{ ...cardStyle('falta_drive', filtroCard === 'falta_drive' || filtroCard === 'sin_conciliar'), padding: '14px 16px', cursor: 'default' }}>
          <div onClick={() => onCambiarFiltroCard(null)} style={{ cursor: 'pointer', marginBottom: 8 }}>
            <div style={{ marginBottom: 4 }}>
              <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }}>Pendientes</span>
            </div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 22, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', color: '#E24B4A' }}>
              {agregados !== null ? (agregados.faltaDriveCount + agregados.sinConciliarCount) : '—'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, fontSize: 10, fontFamily: 'Lexend, sans-serif' }}>
            <button
              onClick={() => onCambiarFiltroCard('falta_drive')}
              style={{
                flex: 1, padding: '5px 6px', borderRadius: 5,
                border: filtroCard === 'falta_drive' ? '1px solid #E24B4A' : '0.5px solid #d0c8bc',
                background: filtroCard === 'falta_drive' ? '#E24B4A10' : '#fff',
                cursor: 'pointer', textAlign: 'center',
              }}>
              <div style={{ color: '#7a8090', fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 2 }}>Falta Drive</div>
              <div style={{ color: '#E24B4A', fontFamily: 'Oswald, sans-serif', fontSize: 13, fontWeight: 600 }}>
                {agregados !== null ? agregados.faltaDriveCount : '—'}
              </div>
            </button>
            <button
              onClick={() => onCambiarFiltroCard('sin_conciliar')}
              style={{
                flex: 1, padding: '5px 6px', borderRadius: 5,
                border: filtroCard === 'sin_conciliar' ? '1px solid #F26B1F' : '0.5px solid #d0c8bc',
                background: filtroCard === 'sin_conciliar' ? '#F26B1F10' : '#fff',
                cursor: 'pointer', textAlign: 'center',
              }}>
              <div style={{ color: '#7a8090', fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 2 }}>Sin conciliar</div>
              <div style={{ color: '#F26B1F', fontFamily: 'Oswald, sans-serif', fontSize: 13, fontWeight: 600 }}>
                {agregados !== null ? agregados.sinConciliarCount : '—'}
              </div>
            </button>
          </div>
        </div>

        <div
          onClick={handleSubir}
          style={{
            background: '#B01D23',
            borderRadius: 14,
            padding: '18px 20px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            border: 'none',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7"/>
          </svg>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', color: '#fff', textAlign: 'center' }}>
            {tituloBotonSubir}
          </div>
          <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 10, color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
            PDF · Imagen · CSV · DOC
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
          <input
            type="text"
            value={busqueda}
            onChange={e => onCambiarBusqueda(e.target.value)}
            placeholder="Buscar proveedor, NIF o número de factura…"
            style={{ width: '100%', padding: '10px 36px 10px 14px', borderRadius: 10, border: '0.5px solid #d0c8bc', background: '#fff', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#111', outline: 'none', boxSizing: 'border-box' }}
          />
          {busqueda && (
            <button
              onClick={() => onCambiarBusqueda('')}
              aria-label="Limpiar búsqueda"
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: '#f5f3ef', border: 'none', borderRadius: '50%', width: 22, height: 22,
                cursor: 'pointer', fontSize: 14, color: '#7a8090', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              }}>
              ×
            </button>
          )}
        </div>
        <select
          value={catFiltro}
          onChange={e => onCambiarCatFiltro(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 10, border: '0.5px solid #d0c8bc', background: '#fff', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#111', minWidth: 280, cursor: 'pointer' }}
        >
          <option value="todas">Categorías</option>
          {categoriasPyg.filter(c => c.nivel === 3).map(c => (
            <option key={c.id} value={c.id}>{c.id} · {c.nombre}</option>
          ))}
        </select>
        <button
          onClick={handleExportar}
          disabled={exportando}
          style={{ padding: '10px 18px', borderRadius: 10, border: '0.5px solid #d0c8bc', background: '#fff', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#3a4050', cursor: exportando ? 'default' : 'pointer', fontWeight: 500, opacity: exportando ? 0.6 : 1 }}
        >
          {exportando ? 'Exportando...' : 'Exportar'}
        </button>
      </div>

      {errorCarga && (
        <div style={{
          background: '#fff5f5',
          border: '0.5px solid #B01D23',
          borderRadius: 8,
          padding: '10px 14px',
          margin: '0 0 12px 0',
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

      {!cargando && total === 0 && !errorCarga ? (
        <div style={{ background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 14, padding: '48px 28px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 16, color: '#7a8090', letterSpacing: 1, marginBottom: 8 }}>No hay facturas</div>
          <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#7a8090', marginBottom: 24 }}>Prueba a cambiar la búsqueda o el periodo</div>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 14, overflow: 'hidden' }}>
          {cargando && (
            <div style={{ padding: '24px 16px', textAlign: 'center', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#7a8090' }}>
              Cargando…
            </div>
          )}
          {!cargando && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', minWidth: 900, fontFamily: 'Lexend, sans-serif', fontSize: 13 }}>
                <colgroup>
                  <col style={{ width: 90 }} />
                  <col />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 200 }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 130 }} />
                  <col style={{ width: 100 }} />
                </colgroup>
                <thead>
                  <tr>
                    {HEADERS.map(h => {
                      const isActive = sortColumn === h.col
                      const arrow = isActive ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''
                      return (
                        <th key={h.col} onClick={() => handleSort(h.col)}
                          style={{
                            fontFamily: 'Oswald, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '2px',
                            color: isActive ? '#FF4757' : '#7a8090', textTransform: 'uppercase', textAlign: h.align,
                            padding: '10px 16px', background: '#f5f3ef', borderBottom: '0.5px solid #d0c8bc',
                            whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
                          }}>
                          {h.label}{arrow}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filasVisibles.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '32px 16px', textAlign: 'center', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#7a8090' }}>
                        Sin facturas con los filtros actuales
                      </td>
                    </tr>
                  ) : filasVisibles.map((f, idx) => {
                    const isLast = idx === filasVisibles.length - 1
                    const tdBase: React.CSSProperties = { padding: '8px 16px', borderBottom: isLast ? 'none' : '0.5px solid #ebe8e2', verticalAlign: 'middle', lineHeight: 1.4 }
                    const catInfo = getBadgeCategoria(f)
                    const estado = calcularEstado(f)
                    const titNombre = titulares.find(t => t.id === f.titular_id)?.nombre?.toLowerCase() ?? ''
                    const isRuben = titNombre.includes('rubén') || titNombre.includes('ruben')
                    const isEmilio = titNombre.includes('emilio')
                    const concepto = f.proveedor_nombre || '—'

                    return (
                      <tr key={f.id} style={{ cursor: 'pointer' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f5f3ef60' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}>
                        <td style={{ ...tdBase, color: '#7a8090', fontSize: 12, whiteSpace: 'nowrap' }}>
                          {fmtDate(f.fecha_factura)}
                        </td>
                        <td style={{ ...tdBase, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {concepto.length > 40 ? concepto.slice(0, 40) + '…' : concepto}
                        </td>
                        <td style={{ ...tdBase, color: f.nif_emisor ? '#111' : '#7a8090', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.nif_emisor || 'Sin identificar'}
                        </td>
                        <td style={{ ...tdBase, textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: 14, fontWeight: 500, letterSpacing: '0.5px', color: f.total >= 0 ? '#1D9E75' : '#E24B4A', whiteSpace: 'nowrap' }}>
                          {fmtEur(f.total)}
                        </td>
                        <td style={{ ...tdBase, overflow: 'hidden' }}>
                          {catInfo ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 6, background: '#f5f3ef', border: '0.5px solid #d0c8bc', fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#3a4050', whiteSpace: 'nowrap' }}>
                              <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1px', color: '#7a8090', fontWeight: 500 }}>{catInfo.id}</span>
                              {catInfo.nombre}
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, background: '#E24B4A10', border: '0.5px dashed #E24B4A50', fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#E24B4A', fontStyle: 'italic' }}>
                              sin categoría
                            </span>
                          )}
                        </td>
                        <td style={{ ...tdBase, textAlign: 'center' }} onClick={(e) => {
                          e.stopPropagation()
                          if (f.pdf_drive_url) window.open(f.pdf_drive_url, '_blank')
                        }}>
                          {f.pdf_drive_url ? (
                            <span style={{ color: '#1D9E75', fontSize: 14, cursor: 'pointer' }}>📎</span>
                          ) : (
                            <span style={{ color: '#F26B1F', fontSize: 14 }}>✕</span>
                          )}
                        </td>
                        <td style={tdBase}>
                          {estado === 'conciliado' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1.5px', fontWeight: 500, textTransform: 'uppercase', background: '#1D9E7515', color: '#0F6E56' }}>
                              Conciliado
                            </span>
                          ) : estado === 'falta_drive' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1.5px', fontWeight: 500, textTransform: 'uppercase', background: '#E24B4A15', color: '#E24B4A' }}>
                              Falta Drive
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1.5px', fontWeight: 500, textTransform: 'uppercase', background: '#F26B1F15', color: '#F26B1F' }}>
                              Pendiente
                            </span>
                          )}
                        </td>
                        <td style={tdBase}>
                          {isRuben ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, fontFamily: 'Lexend, sans-serif', fontSize: 12, fontWeight: 500, background: '#F26B1F15', color: '#F26B1F', whiteSpace: 'nowrap' }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F26B1F', flexShrink: 0 }} />
                              Rubén
                            </span>
                          ) : isEmilio ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, fontFamily: 'Lexend, sans-serif', fontSize: 12, fontWeight: 500, background: '#1E5BCC15', color: '#1E5BCC', whiteSpace: 'nowrap' }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1E5BCC', flexShrink: 0 }} />
                              Emilio
                            </span>
                          ) : (
                            <span style={{ color: '#7a8090', fontFamily: 'Lexend, sans-serif', fontSize: 12 }}>—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {total > 0 && (() => {
            const desde = (page - 1) * pageSize + 1
            const hasta = Math.min(page * pageSize, total)
            const isFirst = page === 1
            const isLast = page === totalPages

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
                  {`Mostrando ${desde.toLocaleString('es-ES')}–${hasta.toLocaleString('es-ES')} de ${total.toLocaleString('es-ES')} facturas`}
                </span>

                {totalPages > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <label style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, color: '#7a8090', textTransform: 'uppercase' }}>
                      Filas:
                    </label>
                    <select
                      value={pageSize}
                      onChange={e => updateUrl({ page: 1, size: Number(e.target.value) as PageSize })}
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

                    <button style={isFirst ? btnDisabled : btnBase} disabled={isFirst} onClick={() => !isFirst && updateUrl({ page: 1 })}>Primera</button>
                    <button style={isFirst ? btnDisabled : btnBase} disabled={isFirst} onClick={() => !isFirst && updateUrl({ page: page - 1 })}>‹ Anterior</button>
                    <span style={{ ...btnBase, cursor: 'default' }}>{`Página ${page} de ${totalPages}`}</span>
                    <button style={isLast ? btnDisabled : btnBase} disabled={isLast} onClick={() => !isLast && updateUrl({ page: page + 1 })}>Siguiente ›</button>
                    <button style={isLast ? btnDisabled : btnBase} disabled={isLast} onClick={() => !isLast && updateUrl({ page: totalPages })}>Última</button>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
