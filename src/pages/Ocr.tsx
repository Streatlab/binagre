import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FONT } from '@/styles/tokens'
import { fmtEur, fmtDate } from '@/utils/format'
import { supabase } from '@/lib/supabase'
import TabsPastilla from '@/components/ui/TabsPastilla'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'
import OcrEditModal from '@/components/ocr/OcrEditModal'
import { useOcrUpload } from '@/lib/ocrUploadStore'

type TabId = 'facturas' | 'extractos' | 'otros'
type SortColumn = 'fecha' | 'contraparte' | 'nif' | 'importe' | 'categoria' | 'doc' | 'estado' | 'titular'
type SortDir = 'asc' | 'desc'
type FiltroCard = 'conciliadas' | 'pendientes' | null

const PAGE_SIZES = [50, 100, 200] as const
type PageSize = typeof PAGE_SIZES[number]
const DEFAULT_PAGE_SIZE: PageSize = 100

const RUBEN_ID = '6ce69d55-60d0-423c-b68b-eb795a0f32fe'
const EMILIO_ID = 'c5358d43-a9cc-4f4c-b0b3-99895bdf4354'

// Formatos aceptados por tab
const ACCEPT_FACTURAS = '.pdf,.png,.jpg,.jpeg,.webp'
const ACCEPT_EXTRACTOS = '.csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg,.webp'
const ACCEPT_OTROS = '.pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.xls'

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
  pdf_drive_id: string | null
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
  pendientesCount: number
  pendientesImporte: number
}

interface AgregadosExtractos {
  totalExtractos: number
  totalMovimientos: number
  rubenCount: number
  emilioCount: number
}

function esConciliada(f: Factura): boolean {
  if (!f.pdf_drive_url) return false
  if (!f.categoria_factura) return false
  if (!f.titular_id) return false
  const tieneAsoc = Array.isArray(f.facturas_gastos) && f.facturas_gastos.some(fg => fg.confirmado)
  return tieneAsoc
}

// --- Dropzone extractos ---
interface DropzoneExtractosProps {
  onArchivos: (files: File[]) => void
  dragOver: boolean
  setDragOver: (v: boolean) => void
}

function DropzoneExtractos({ onArchivos, dragOver, setDragOver }: DropzoneExtractosProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter(f =>
      /\.(csv|xlsx|xls|pdf|png|jpg|jpeg|webp)$/i.test(f.name)
    )
    if (files.length > 0) onArchivos(files)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[]
    if (files.length > 0) onArchivos(files)
    // reset input
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        border: dragOver ? '2px dashed #B01D23' : '2px dashed #d0c8bc',
        borderRadius: 16,
        background: dragOver ? '#B01D2308' : '#fff',
        padding: '40px 32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
        marginBottom: 20,
        minHeight: 180,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_EXTRACTOS}
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={dragOver ? '#B01D23' : '#7a8090'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 15, fontWeight: 600, letterSpacing: '1px', color: dragOver ? '#B01D23' : '#3a4050', textTransform: 'uppercase' }}>
        {dragOver ? 'Suelta aquí' : 'Arrastra o haz clic para subir'}
      </div>
      <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#7a8090', textAlign: 'center', lineHeight: 1.6 }}>
        CSV · Excel · PDF · Imagen<br />
        <span style={{ fontSize: 11, color: '#b0aaa3' }}>Exporta el extracto de BBVA/Sabadell como CSV y súbelo aquí</span>
      </div>
    </div>
  )
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
  const [dragOver, setDragOver] = useState(false)

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
  const [agregadosExtractos, setAgregadosExtractos] = useState<AgregadosExtractos | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  const [categoriasPyg, setCategoriasPyg] = useState<CatPyg[]>([])
  const [titulares, setTitulares] = useState<Titular[]>([])

  const [exportando, setExportando] = useState(false)

  const [modalTitular, setModalTitular] = useState<{ archivos: File[]; visible: boolean }>({ archivos: [], visible: false })
  const [facturaEditando, setFacturaEditando] = useState<Factura | null>(null)

  const ocrUpload = useOcrUpload()

  useEffect(() => {
    if (ocrUpload.state && !ocrUpload.state.procesando && ocrUpload.state.enviados > 0) {
      setRefreshTick(x => x + 1)
    }
  }, [ocrUpload.state?.procesando])

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
    if (tab === 'extractos') { setCargando(false); return }
    const myFetchId = ++fetchIdRef.current
    setCargando(true)
    setErrorCarga(null)

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const sortMap: Record<string, string | null> = {
      fecha: 'fecha_factura', contraparte: 'proveedor_nombre', nif: 'nif_emisor',
      importe: 'total', categoria: 'categoria_factura', doc: 'pdf_drive_url',
      titular: 'titular_id', estado: null,
    }
    const sortField = sortMap[sortColumn] ?? 'fecha_factura'

    let q: any = supabase
      .from('facturas')
      .select('id, fecha_factura, proveedor_nombre, total, tipo, categoria_factura, nif_emisor, titular_id, pdf_drive_url, pdf_drive_id, pdf_filename, numero_factura, estado, facturas_gastos(id, confirmado, conciliacion_id)', { count: 'exact' })
      .gte('fecha_factura', periodoDesdeStr)
      .lte('fecha_factura', periodoHastaStr)

    if (tab === 'facturas') q = q.in('tipo', ['proveedor', 'plataforma'])
    else if (tab === 'otros') q = q.eq('tipo', 'otro').neq('categoria_factura', 'extracto_bancario')

    if (catFiltro !== 'todas') q = q.eq('categoria_factura', catFiltro)
    if (busquedaDebounced) {
      const safe = busquedaDebounced.replace(/[%_,()]/g, ' ').trim()
      if (safe) q = q.or(`proveedor_nombre.ilike.%${safe}%,nif_emisor.ilike.%${safe}%,numero_factura.ilike.%${safe}%`)
    }
    if (sortField) q = q.order(sortField, { ascending: sortDir === 'asc' }).range(from, to)
    else q = q.order('fecha_factura', { ascending: false }).range(from, to)

    const { data, error, count } = await q
    if (myFetchId !== fetchIdRef.current) return
    if (error) { setErrorCarga('Error cargando. Intenta de nuevo.'); setFilas([]); setTotal(0) }
    else {
      const mapped: Factura[] = (data ?? []).map((m: any) => ({
        id: m.id, fecha_factura: m.fecha_factura, proveedor_nombre: m.proveedor_nombre ?? '',
        total: Number(m.total) || 0, tipo: m.tipo ?? 'proveedor', categoria_factura: m.categoria_factura ?? null,
        nif_emisor: m.nif_emisor ?? null, titular_id: m.titular_id ?? null, pdf_drive_url: m.pdf_drive_url ?? null,
        pdf_drive_id: m.pdf_drive_id ?? null, pdf_filename: m.pdf_filename ?? null,
        numero_factura: m.numero_factura ?? null, estado: m.estado ?? '', facturas_gastos: m.facturas_gastos ?? [],
      }))
      let filtradas = mapped
      if (filtroCard === 'conciliadas') filtradas = mapped.filter(esConciliada)
      else if (filtroCard === 'pendientes') filtradas = mapped.filter(f => !esConciliada(f))
      setFilas(filtradas)
      setTotal(count ?? 0)
    }
    setCargando(false)
  }, [page, pageSize, sortColumn, sortDir, filtroCard, catFiltro, periodoDesdeStr, periodoHastaStr, refreshTick, busquedaDebounced, tab])

  const cargarAgregados = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('facturas').select('id, total, pdf_drive_url, categoria_factura, titular_id, tipo, facturas_gastos(confirmado)')
        .gte('fecha_factura', periodoDesdeStr).lte('fecha_factura', periodoHastaStr)
      if (error) throw error

      let totalCount = 0, totalImporte = 0, conciliadasCount = 0, conciliadasImporte = 0
      let pendientesCount = 0, pendientesImporte = 0
      let totalExtractos = 0, rubenCount = 0, emilioCount = 0

      for (const r of data ?? []) {
        if (r.tipo === 'otro' && r.categoria_factura === 'extracto_bancario') {
          totalExtractos++
          if (r.titular_id === RUBEN_ID) rubenCount++
          else if (r.titular_id === EMILIO_ID) emilioCount++
          continue
        }
        totalCount++
        const imp = Number(r.total) || 0
        totalImporte += imp
        const tieneAsoc = Array.isArray(r.facturas_gastos) && r.facturas_gastos.some((fg: any) => fg.confirmado)
        const completa = !!r.pdf_drive_url && !!r.categoria_factura && !!r.titular_id && tieneAsoc
        if (completa) { conciliadasCount++; conciliadasImporte += imp }
        else { pendientesCount++; pendientesImporte += imp }
      }

      // contar movimientos totales de extractos
      const { count: movCount } = await supabase.from('conciliacion').select('id', { count: 'exact', head: true })
      const conciliadasPct = totalCount > 0 ? Math.round((conciliadasCount / totalCount) * 100) : 0

      setAgregados({ totalCount, totalImporte, conciliadasCount, conciliadasPct, conciliadasImporte, pendientesCount, pendientesImporte })
      setAgregadosExtractos({ totalExtractos, totalMovimientos: movCount ?? 0, rubenCount, emilioCount })
    } catch { setAgregados(null) }
  }, [periodoDesdeStr, periodoHastaStr, refreshTick])

  useEffect(() => { cargarPagina() }, [cargarPagina])
  useEffect(() => { cargarAgregados() }, [cargarAgregados])

  useEffect(() => {
    if (cargando || total === 0) return
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    if (page > totalPages) updateUrl({ page: totalPages })
  }, [cargando, total, pageSize, page, updateUrl])

  const onCambiarFiltroCard = (v: FiltroCard) => { setFiltroCard(prev => prev === v ? null : v); if (page !== 1) updateUrl({ page: 1 }) }
  const onCambiarBusqueda = (v: string) => { setBusqueda(v); if (page !== 1) updateUrl({ page: 1 }) }
  const onCambiarCatFiltro = (v: string) => { setCatFiltro(v); if (page !== 1) updateUrl({ page: 1 }) }

  function handleSort(col: SortColumn) {
    if (sortColumn === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortColumn(col); setSortDir('asc') }
    if (page !== 1) updateUrl({ page: 1 })
  }

  const filasVisibles = useMemo(() => {
    if (sortColumn !== 'estado') return filas
    return [...filas].sort((a, b) => {
      const ea = esConciliada(a) ? 'conciliada' : 'pendiente'
      const eb = esConciliada(b) ? 'conciliada' : 'pendiente'
      return sortDir === 'asc' ? ea.localeCompare(eb) : eb.localeCompare(ea)
    })
  }, [filas, sortColumn, sortDir])

  function getBadgeCategoria(f: Factura) {
    if (!f.categoria_factura) return null
    const cat = categoriasPyg.find(c => c.id === f.categoria_factura)
    return cat ? { id: cat.id, nombre: cat.nombre } : { id: f.categoria_factura, nombre: f.categoria_factura }
  }

  const handleExportar = async () => {
    setExportando(true)
    try {
      const { data } = await supabase.from('facturas').select('fecha_factura, proveedor_nombre, nif_emisor, total, categoria_factura, pdf_drive_url').gte('fecha_factura', periodoDesdeStr).lte('fecha_factura', periodoHastaStr)
      const rows = (data ?? []).map((m: any) => [m.fecha_factura, (m.proveedor_nombre ?? '').replace(/,/g, ' '), (m.nif_emisor ?? '').replace(/,/g, ' '), m.total, m.categoria_factura ?? '', m.pdf_drive_url ? 'Sí' : 'No'])
      const csv = [['Fecha', 'Contraparte', 'NIF', 'Total', 'Categoría', 'Doc'].join(','), ...rows.map(r => r.join(','))].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `facturas_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    } catch {} finally { setExportando(false) }
  }

  // Lanzar selector de archivos para facturas/otros
  const handleSubirFacturas = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'; input.multiple = true
    input.accept = tab === 'facturas' ? ACCEPT_FACTURAS : ACCEPT_OTROS
    input.onchange = (e: any) => {
      const files = Array.from(e.target.files || []) as File[]
      if (files.length > 0) ocrUpload.procesar(files, 'ocr-procesar-factura', null)
    }
    input.click()
  }, [tab, ocrUpload])

  // Archivos de extracto → modal titular
  const handleArchivosExtracto = useCallback((files: File[]) => {
    setModalTitular({ archivos: files, visible: true })
  }, [])

  const cardStyle = (_filtro: FiltroCard, isActive: boolean): React.CSSProperties => ({
    background: '#fff', border: isActive ? '1px solid #FF4757' : '0.5px solid #d0c8bc',
    borderRadius: 14, padding: '18px 20px', cursor: 'pointer',
    boxShadow: isActive ? '0 0 0 3px #FF475715' : 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
  })

  const HEADERS: { label: string; col: SortColumn; align: 'left' | 'right' | 'center' }[] = [
    { label: 'Fecha', col: 'fecha', align: 'left' }, { label: 'Contraparte', col: 'contraparte', align: 'left' },
    { label: 'NIF', col: 'nif', align: 'left' }, { label: 'Importe', col: 'importe', align: 'right' },
    { label: 'Categoría', col: 'categoria', align: 'left' }, { label: 'Doc', col: 'doc', align: 'center' },
    { label: 'Estado', col: 'estado', align: 'left' }, { label: 'Titular', col: 'titular', align: 'left' },
  ]

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const TABS = [{ id: 'facturas', label: 'Facturas' }, { id: 'extractos', label: 'Extractos bancarios' }, { id: 'otros', label: 'Otros documentos' }]

  return (
    <div style={{ background: '#f5f3ef', padding: '24px 28px', minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 600, color: '#B01D23', textTransform: 'uppercase', letterSpacing: '3px', margin: 0 }}>OCR</h1>
          <p style={{ fontFamily: FONT.body, fontSize: 13, color: '#7a8090', marginTop: 4, marginBottom: 0 }}>{periodoLabel}</p>
        </div>
        <SelectorFechaUniversal nombreModulo="ocr" defaultOpcion="mes_en_curso" onChange={(desde, hasta, label) => { setFechaDesde(desde); setFechaHasta(hasta); setPeriodoLabel(label) }} />
      </div>

      <TabsPastilla tabs={TABS} activeId={tab} onChange={(id) => setTab(id as TabId)} />

      {/* ───── TAB EXTRACTOS ───── */}
      {tab === 'extractos' && (
        <div style={{ marginTop: 16 }}>
          {/* Cards propias de extractos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            <div style={{ background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase', marginBottom: 8 }}>Extractos subidos</div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, fontWeight: 600, lineHeight: 1, color: '#111' }}>{agregadosExtractos?.totalExtractos ?? '—'}</div>
              <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090', marginTop: 4 }}>
                Rubén {agregadosExtractos?.rubenCount ?? 0} · Emilio {agregadosExtractos?.emilioCount ?? 0}
              </div>
            </div>
            <div style={{ background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase', marginBottom: 8 }}>Movimientos en BD</div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, fontWeight: 600, lineHeight: 1, color: '#1D9E75' }}>{agregadosExtractos?.totalMovimientos?.toLocaleString('es-ES') ?? '—'}</div>
              <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090', marginTop: 4 }}>Total acumulado Conciliación</div>
            </div>
            <div style={{ background: '#f5f3ef', border: '0.5px dashed #d0c8bc', borderRadius: 14, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase', marginBottom: 4 }}>Formatos aceptados</div>
                <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#3a4050', lineHeight: 1.7 }}>
                  CSV · Excel (.xlsx)<br />PDF · Imagen
                </div>
              </div>
            </div>
          </div>

          {/* Dropzone */}
          <DropzoneExtractos onArchivos={handleArchivosExtracto} dragOver={dragOver} setDragOver={setDragOver} />

          {/* Tabla extractos subidos */}
          <div style={{ background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 14, overflow: 'hidden' }}>
            <ExtractosTabla periodoDesdeStr={periodoDesdeStr} periodoHastaStr={periodoHastaStr} refreshTick={refreshTick} titulares={titulares} />
          </div>
        </div>
      )}

      {/* ───── TAB FACTURAS / OTROS ───── */}
      {tab !== 'extractos' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14, marginTop: 14 }}>
            <div onClick={() => onCambiarFiltroCard(null)} style={cardStyle(null, filtroCard === null)}>
              <div style={{ marginBottom: 8 }}><span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }}>Total facturas</span></div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', color: '#111' }}>{agregados !== null ? agregados.totalCount : '—'}</div>
              <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090', marginTop: 4 }}>{agregados !== null ? fmtEur(agregados.totalImporte) : '—'}</div>
            </div>
            <div onClick={() => onCambiarFiltroCard('conciliadas')} style={cardStyle('conciliadas', filtroCard === 'conciliadas')}>
              <div style={{ marginBottom: 8 }}><span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }}>Conciliadas</span></div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', color: '#1D9E75' }}>{agregados !== null ? agregados.conciliadasCount : '—'}</div>
              <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090', marginTop: 4 }}>{agregados !== null ? `${agregados.conciliadasPct}% · ${fmtEur(agregados.conciliadasImporte)}` : '—'}</div>
            </div>
            <div onClick={() => onCambiarFiltroCard('pendientes')} style={cardStyle('pendientes', filtroCard === 'pendientes')}>
              <div style={{ marginBottom: 8 }}><span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }}>Pendientes</span></div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', color: '#F26B1F' }}>{agregados !== null ? agregados.pendientesCount : '—'}</div>
              <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090', marginTop: 4 }}>{agregados !== null ? `Faltan datos · ${fmtEur(agregados.pendientesImporte)}` : '—'}</div>
            </div>
            <div onClick={handleSubirFacturas} style={{ background: '#B01D23', borderRadius: 14, padding: '18px 20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', color: '#fff', textAlign: 'center' }}>{tab === 'facturas' ? 'Subir facturas' : 'Subir documentos'}</div>
              <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 10, color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>PDF · Imagen</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
              <input type="text" value={busqueda} onChange={e => onCambiarBusqueda(e.target.value)} placeholder="Buscar contraparte, NIF o número de factura…" style={{ width: '100%', padding: '10px 36px 10px 14px', borderRadius: 10, border: '0.5px solid #d0c8bc', background: '#fff', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#111', outline: 'none', boxSizing: 'border-box' }} />
              {busqueda && <button onClick={() => onCambiarBusqueda('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: '#f5f3ef', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: 14, color: '#7a8090', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>}
            </div>
            <select value={catFiltro} onChange={e => onCambiarCatFiltro(e.target.value)} style={{ padding: '10px 14px', borderRadius: 10, border: '0.5px solid #d0c8bc', background: '#fff', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#111', minWidth: 280, cursor: 'pointer' }}>
              <option value="todas">Categorías</option>
              {categoriasPyg.filter(c => c.nivel === 3).map(c => <option key={c.id} value={c.id}>{c.id} · {c.nombre}</option>)}
            </select>
            <button onClick={handleExportar} disabled={exportando} style={{ padding: '10px 18px', borderRadius: 10, border: '0.5px solid #d0c8bc', background: '#fff', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#3a4050', cursor: exportando ? 'default' : 'pointer', fontWeight: 500, opacity: exportando ? 0.6 : 1 }}>
              {exportando ? 'Exportando...' : 'Exportar'}
            </button>
          </div>

          {errorCarga && (
            <div style={{ background: '#fff5f5', border: '0.5px solid #B01D23', borderRadius: 8, padding: '10px 14px', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#B01D23' }}>
              <span>{errorCarga}</span>
              <button onClick={() => { cargarPagina(); cargarAgregados() }} style={{ background: '#B01D23', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontFamily: 'Oswald, sans-serif', fontSize: 11, textTransform: 'uppercase', cursor: 'pointer' }}>Reintentar</button>
            </div>
          )}

          {!cargando && total === 0 && !errorCarga ? (
            <div style={{ background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 14, padding: '48px 28px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 16, color: '#7a8090', letterSpacing: 1, marginBottom: 8 }}>No hay facturas</div>
              <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#7a8090', marginBottom: 24 }}>Prueba a cambiar el periodo o sube tus primeras facturas</div>
            </div>
          ) : (
            <div style={{ background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 14, overflow: 'hidden' }}>
              {cargando ? <div style={{ padding: '24px 16px', textAlign: 'center', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#7a8090' }}>Cargando…</div> : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', minWidth: 900, fontFamily: 'Lexend, sans-serif', fontSize: 13 }}>
                    <colgroup><col style={{ width: 90 }} /><col /><col style={{ width: '14%' }} /><col style={{ width: 110 }} /><col style={{ width: 200 }} /><col style={{ width: 80 }} /><col style={{ width: 130 }} /><col style={{ width: 100 }} /></colgroup>
                    <thead>
                      <tr>
                        {HEADERS.map(h => {
                          const isActive = sortColumn === h.col
                          return <th key={h.col} onClick={() => handleSort(h.col)} style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '2px', color: isActive ? '#FF4757' : '#7a8090', textTransform: 'uppercase', textAlign: h.align, padding: '10px 16px', background: '#f5f3ef', borderBottom: '0.5px solid #d0c8bc', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>{h.label}{isActive ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</th>
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {filasVisibles.length === 0 ? (
                        <tr><td colSpan={8} style={{ padding: '32px 16px', textAlign: 'center', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#7a8090' }}>Sin resultados</td></tr>
                      ) : filasVisibles.map((f, idx) => {
                        const isLast = idx === filasVisibles.length - 1
                        const tdBase: React.CSSProperties = { padding: '8px 16px', borderBottom: isLast ? 'none' : '0.5px solid #ebe8e2', verticalAlign: 'middle', lineHeight: 1.4 }
                        const tdDocBase: React.CSSProperties = { padding: 0, borderBottom: isLast ? 'none' : '0.5px solid #ebe8e2', verticalAlign: 'middle', textAlign: 'center' }
                        const catInfo = getBadgeCategoria(f)
                        const conciliada = esConciliada(f)
                        const titNombre = titulares.find(t => t.id === f.titular_id)?.nombre?.toLowerCase() ?? ''
                        const isRuben = titNombre.includes('rubén') || titNombre.includes('ruben')
                        const isEmilio = titNombre.includes('emilio')
                        const contraparte = f.proveedor_nombre || '—'
                        return (
                          <tr key={f.id} style={{ cursor: 'pointer' }} onClick={() => setFacturaEditando(f)} onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f5f3ef60'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                            <td style={{ ...tdBase, color: '#7a8090', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(f.fecha_factura)}</td>
                            <td style={{ ...tdBase, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contraparte.length > 40 ? contraparte.slice(0, 40) + '…' : contraparte}</td>
                            <td style={{ ...tdBase, color: f.nif_emisor ? '#111' : '#7a8090', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.nif_emisor || 'Sin identificar'}</td>
                            <td style={{ ...tdBase, textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: 14, fontWeight: 500, letterSpacing: '0.5px', color: f.total >= 0 ? '#1D9E75' : '#E24B4A', whiteSpace: 'nowrap' }}>{fmtEur(f.total)}</td>
                            <td style={{ ...tdBase, overflow: 'hidden' }}>
                              {catInfo ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 6, background: '#f5f3ef', border: '0.5px solid #d0c8bc', fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#3a4050', whiteSpace: 'nowrap' }}><span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1px', color: '#7a8090', fontWeight: 500 }}>{catInfo.id}</span>{catInfo.nombre}</span>
                              : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, background: '#E24B4A10', border: '0.5px dashed #E24B4A50', fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#E24B4A', fontStyle: 'italic' }}>sin categoría</span>}
                            </td>
                            {f.pdf_drive_url ? (
                              <td style={tdDocBase} onClick={e => { e.stopPropagation(); window.open(f.pdf_drive_url!, '_blank', 'noopener,noreferrer') }} title="Ver factura"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', minHeight: 38, fontSize: 22, lineHeight: 1, color: '#0F6E56', cursor: 'pointer', userSelect: 'none' }}>📎</div></td>
                            ) : <td style={tdDocBase} onClick={e => e.stopPropagation()}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', minHeight: 38, fontSize: 18, lineHeight: 1, color: '#F26B1F', fontWeight: 600 }}>✕</div></td>}
                            <td style={tdBase}>
                              {conciliada ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1.5px', fontWeight: 500, textTransform: 'uppercase', background: '#1D9E7515', color: '#0F6E56' }}>Conciliada</span>
                              : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1.5px', fontWeight: 500, textTransform: 'uppercase', background: '#F26B1F15', color: '#F26B1F' }}>Pendiente</span>}
                            </td>
                            <td style={tdBase}>
                              {isRuben ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, fontFamily: 'Lexend, sans-serif', fontSize: 12, fontWeight: 500, background: '#F26B1F15', color: '#F26B1F', whiteSpace: 'nowrap' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F26B1F', flexShrink: 0 }} />Rubén</span>
                              : isEmilio ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, fontFamily: 'Lexend, sans-serif', fontSize: 12, fontWeight: 500, background: '#1E5BCC15', color: '#1E5BCC', whiteSpace: 'nowrap' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1E5BCC', flexShrink: 0 }} />Emilio</span>
                              : <span style={{ color: '#7a8090', fontFamily: 'Lexend, sans-serif', fontSize: 12 }}>—</span>}
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
                const isFirst = page === 1, isLast2 = page === totalPages
                const btnBase: React.CSSProperties = { background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 8, padding: '6px 12px', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#111', cursor: 'pointer' }
                const btnDis: React.CSSProperties = { ...btnBase, opacity: 0.35, cursor: 'default' }
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: '#fafaf7', borderTop: '0.5px solid #d0c8bc' }}>
                    <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#7a8090' }}>{`Mostrando ${desde.toLocaleString('es-ES')}–${hasta.toLocaleString('es-ES')} de ${total.toLocaleString('es-ES')} facturas`}</span>
                    {totalPages > 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <label style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, color: '#7a8090', textTransform: 'uppercase' }}>Filas:</label>
                        <select value={pageSize} onChange={e => updateUrl({ page: 1, size: Number(e.target.value) as PageSize })} style={{ padding: '6px 10px', borderRadius: 8, border: '0.5px solid #d0c8bc', background: '#fff', fontFamily: 'Lexend, sans-serif', fontSize: 13 }}>{PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}</select>
                        <button style={isFirst ? btnDis : btnBase} disabled={isFirst} onClick={() => !isFirst && updateUrl({ page: 1 })}>Primera</button>
                        <button style={isFirst ? btnDis : btnBase} disabled={isFirst} onClick={() => !isFirst && updateUrl({ page: page - 1 })}>‹ Anterior</button>
                        <span style={{ ...btnBase, cursor: 'default' }}>{`Página ${page} de ${totalPages}`}</span>
                        <button style={isLast2 ? btnDis : btnBase} disabled={isLast2} onClick={() => !isLast2 && updateUrl({ page: page + 1 })}>Siguiente ›</button>
                        <button style={isLast2 ? btnDis : btnBase} disabled={isLast2} onClick={() => !isLast2 && updateUrl({ page: totalPages })}>Última</button>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}
        </>
      )}

      {/* Modal titular extracto */}
      {modalTitular.visible && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', padding: 28, borderRadius: 14, minWidth: 340, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, letterSpacing: '2px', textTransform: 'uppercase', color: '#B01D23', marginBottom: 8 }}>Extracto bancario</div>
            <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 14, color: '#111', marginBottom: 6 }}>¿De quién es este extracto?</div>
            <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#7a8090', marginBottom: 18 }}>{modalTitular.archivos.length} archivo{modalTitular.archivos.length !== 1 ? 's' : ''} seleccionado{modalTitular.archivos.length !== 1 ? 's' : ''}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { const a = modalTitular.archivos; setModalTitular({ archivos: [], visible: false }); ocrUpload.procesar(a, 'ocr-procesar-extracto', RUBEN_ID) }} style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '0.5px solid #F26B1F', background: '#F26B1F', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer' }}>Rubén</button>
              <button onClick={() => { const a = modalTitular.archivos; setModalTitular({ archivos: [], visible: false }); ocrUpload.procesar(a, 'ocr-procesar-extracto', EMILIO_ID) }} style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '0.5px solid #1E5BCC', background: '#1E5BCC', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer' }}>Emilio</button>
            </div>
            <button onClick={() => setModalTitular({ archivos: [], visible: false })} style={{ marginTop: 14, width: '100%', padding: '8px', background: 'none', border: 'none', color: '#7a8090', fontFamily: 'Lexend, sans-serif', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

      {facturaEditando && (
        <OcrEditModal factura={facturaEditando} categoriasPyg={categoriasPyg} onClose={() => setFacturaEditando(null)}
          onSaved={() => { setFacturaEditando(null); setRefreshTick(x => x + 1) }}
          onDeleted={() => { setFacturaEditando(null); setRefreshTick(x => x + 1) }} />
      )}
    </div>
  )
}

// --- Subcomponente: tabla de extractos subidos ---
function ExtractosTabla({ periodoDesdeStr, periodoHastaStr, refreshTick, titulares }: { periodoDesdeStr: string; periodoHastaStr: string; refreshTick: number; titulares: { id: string; nombre: string }[] }) {
  const [extractos, setExtractos] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    setCargando(true)
    supabase.from('facturas').select('id, fecha_factura, pdf_filename, pdf_drive_url, titular_id, created_at')
      .eq('tipo', 'otro').eq('categoria_factura', 'extracto_bancario')
      .gte('fecha_factura', periodoDesdeStr).lte('fecha_factura', periodoHastaStr)
      .order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => { setExtractos(data ?? []); setCargando(false) })
  }, [periodoDesdeStr, periodoHastaStr, refreshTick])

  if (cargando) return <div style={{ padding: '24px 16px', textAlign: 'center', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#7a8090' }}>Cargando…</div>
  if (extractos.length === 0) return <div style={{ padding: '32px 28px', textAlign: 'center', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#7a8090' }}>No hay extractos subidos en este periodo</div>

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Lexend, sans-serif', fontSize: 13 }}>
      <thead>
        <tr>
          {['Fecha subida', 'Archivo', 'Titular', 'Drive'].map(h => (
            <th key={h} style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase', textAlign: 'left', padding: '10px 16px', background: '#f5f3ef', borderBottom: '0.5px solid #d0c8bc' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {extractos.map((e, idx) => {
          const isLast = idx === extractos.length - 1
          const tdBase: React.CSSProperties = { padding: '8px 16px', borderBottom: isLast ? 'none' : '0.5px solid #ebe8e2', verticalAlign: 'middle' }
          const titNombre = titulares.find(t => t.id === e.titular_id)?.nombre?.toLowerCase() ?? ''
          const isRuben = titNombre.includes('rubén') || titNombre.includes('ruben')
          const isEmilio = titNombre.includes('emilio')
          return (
            <tr key={e.id}>
              <td style={{ ...tdBase, color: '#7a8090', fontSize: 12, whiteSpace: 'nowrap' }}>{e.created_at ? fmtDate(e.created_at.slice(0, 10)) : '—'}</td>
              <td style={{ ...tdBase, color: '#111', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.pdf_filename || '—'}</td>
              <td style={tdBase}>
                {isRuben ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, fontFamily: 'Lexend, sans-serif', fontSize: 12, fontWeight: 500, background: '#F26B1F15', color: '#F26B1F', whiteSpace: 'nowrap' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F26B1F', flexShrink: 0 }} />Rubén</span>
                : isEmilio ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, fontFamily: 'Lexend, sans-serif', fontSize: 12, fontWeight: 500, background: '#1E5BCC15', color: '#1E5BCC', whiteSpace: 'nowrap' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1E5BCC', flexShrink: 0 }} />Emilio</span>
                : <span style={{ color: '#7a8090', fontSize: 12 }}>—</span>}
              </td>
              <td style={{ ...tdBase, textAlign: 'center' }}>
                {e.pdf_drive_url ? <a href={e.pdf_drive_url} target="_blank" rel="noreferrer" onClick={ev => ev.stopPropagation()} style={{ fontSize: 20 }}>📎</a> : <span style={{ color: '#d0c8bc' }}>—</span>}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
