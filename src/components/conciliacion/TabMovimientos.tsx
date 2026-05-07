import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fmtEur, fmtDate } from '@/utils/format'
import { supabase } from '@/lib/supabase'
import { fetchAllPaginated } from '@/lib/supabasePaginated'
import ModalDetalleMovimiento from './ModalDetalleMovimiento'
import { useMultiSort } from '@/hooks/useMultiSort'
import type { Movimiento } from '@/types/conciliacion'

const PAGE_SIZES = [50, 100, 200] as const
type PageSize = typeof PAGE_SIZES[number]
const DEFAULT_PAGE_SIZE: PageSize = 50

const STORAGE_KEY = 'conciliacion:filtros'

interface FiltrosPersistidos {
  page?: number
  size?: PageSize
  filtroCard?: FiltroCard
  filtroTitular?: 'todos' | 'ruben' | 'emilio'
  ocultarConciliados?: boolean
  busqueda?: string
  catFiltro?: string
  sortColumn?: SortColumn
  sortDir?: SortDir
}

function loadFiltros(): FiltrosPersistidos {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as FiltrosPersistidos
  } catch {
    return {}
  }
}

function saveFiltros(f: FiltrosPersistidos) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(f))
  } catch {
    // swallow
  }
}

function parsePageSize(raw: string | null | undefined): PageSize {
  const n = Number(raw)
  return (PAGE_SIZES as readonly number[]).includes(n) ? (n as PageSize) : DEFAULT_PAGE_SIZE
}
function parsePage(raw: string | null | undefined): number {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

interface TabMovimientosProps {
  periodoLabel: string
  periodoDesde: Date
  periodoHasta: Date
}

interface CatPyg { id: string; nombre: string; nivel: number; parent_id: string | null }
interface Titular { id: string; nombre: string }

type FiltroCard = 'ingresos' | 'gastos' | 'pend_total' | 'pend_sin_cat' | 'pend_sin_doc' | null

type Agregados = {
  ingresosImporte: number
  gastosImporte: number
  pendTotalCount: number
  pendTotalNeto: number
  pendSinCatCount: number
  pendSinCatNeto: number
  pendSinDocCount: number
  pendSinDocNeto: number
}

type SortColumn = 'fecha' | 'concepto' | 'contraparte' | 'importe' | 'categoria' | 'doc' | 'estado' | 'titular'
type SortDir = 'asc' | 'desc'

function calcularEstado(m: Movimiento): 'conciliado' | 'pendiente' {
  if (!m.categoria_id) return 'pendiente'
  if (m.doc_estado === 'no_requiere') return 'conciliado'
  if (m.doc_estado === 'tiene') return 'conciliado'
  return 'pendiente'
}

function getBadgeCategoria(m: Movimiento, categoriasPyg: CatPyg[]) {
  if (!m.categoria_id) return null
  const cat = categoriasPyg.find(c => c.id === m.categoria_id)
  if (cat) return { id: cat.id, nombre: cat.nombre }
  return null
}

export default function TabMovimientos({ periodoDesde, periodoHasta }: TabMovimientosProps) {
  const navigate = useNavigate()

  const [searchParams, setSearchParams] = useSearchParams()
  const persistidos = useRef<FiltrosPersistidos>(loadFiltros()).current

  const page     = parsePage(searchParams.get('page') ?? String(persistidos.page ?? 1))
  const pageSize = parsePageSize(searchParams.get('size') ?? String(persistidos.size ?? DEFAULT_PAGE_SIZE))

  const updateUrl = useCallback((next: { page?: number; size?: PageSize }) => {
    const params = new URLSearchParams(searchParams)
    if (next.page !== undefined) params.set('page', String(next.page))
    if (next.size !== undefined) params.set('size', String(next.size))
    setSearchParams(params, { replace: true })
  }, [searchParams, setSearchParams])

  const [filtroCard, setFiltroCard] = useState<FiltroCard>(persistidos.filtroCard ?? null)
  const [filtroTitular, setFiltroTitular] = useState<'todos' | 'ruben' | 'emilio'>(persistidos.filtroTitular ?? 'todos')
  const [ocultarConciliados, setOcultarConciliados] = useState<boolean>(persistidos.ocultarConciliados ?? true)
  const [busqueda, setBusqueda] = useState(persistidos.busqueda ?? '')
  const [busquedaDebounced, setBusquedaDebounced] = useState(persistidos.busqueda ?? '')
  const [catFiltro, setCatFiltro] = useState(persistidos.catFiltro ?? 'todas')
  const [sortColumn, setSortColumn] = useState<SortColumn>(persistidos.sortColumn ?? 'fecha')
  const [sortDir, setSortDir] = useState<SortDir>(persistidos.sortDir ?? 'desc')

  // Multi-sort: criterio primario al servidor, secundario en cliente
  const { handleSort: multiHandleSort, sortIndicator, applySorts } = useMultiSort<Movimiento, SortColumn>({
    getValue: (row, col) => {
      switch (col) {
        case 'fecha':        return row.fecha
        case 'concepto':     return row.concepto ?? ''
        case 'contraparte':  return row.contraparte ?? ''
        case 'importe':      return row.importe
        case 'categoria':    return row.categoria_id ?? ''
        case 'doc':          return row.doc_estado ?? ''
        case 'estado':       return calcularEstado(row)
        case 'titular':      return row.titular_id ?? ''
        default:             return ''
      }
    }
  })

  const [filas, setFilas]           = useState<Movimiento[]>([])
  const [total, setTotal]           = useState<number>(0)
  const [cargando, setCargando]     = useState<boolean>(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const fetchIdRef                  = useRef<number>(0)

  const [agregados, setAgregados] = useState<Agregados | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  const [modalMov, setModalMov]           = useState<Movimiento | null>(null)
  const [categoriasPyg, setCategoriasPyg] = useState<CatPyg[]>([])
  const [titulares, setTitulares]         = useState<Titular[]>([])

  const [exportando, setExportando] = useState(false)

  useEffect(() => {
    saveFiltros({
      page, size: pageSize, filtroCard, filtroTitular, ocultarConciliados,
      busqueda, catFiltro, sortColumn, sortDir,
    })
  }, [page, pageSize, filtroCard, filtroTitular, ocultarConciliados, busqueda, catFiltro, sortColumn, sortDir])

  useEffect(() => {
    const t = setTimeout(() => setBusquedaDebounced(busqueda.trim()), 400)
    return () => clearTimeout(t)
  }, [busqueda])

  useEffect(() => {
    const raw = searchParams.get('size')
    if (raw !== null && !(PAGE_SIZES as readonly number[]).includes(Number(raw))) {
      updateUrl({ size: DEFAULT_PAGE_SIZE })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    Promise.all([
      supabase.from('categorias_pyg').select('id, nombre, nivel, parent_id').eq('activa', true).order('orden'),
      supabase.from('titulares').select('id, nombre').eq('activo', true).order('orden'),
    ]).then(([cats, tits]) => {
      if (!cats.error) setCategoriasPyg(cats.data ?? [])
      if (!tits.error) setTitulares(tits.data ?? [])
    })
  }, [])

  const periodoDesdeStr = periodoDesde.toISOString().slice(0, 10)
  const periodoHastaStr = periodoHasta.toISOString().slice(0, 10)

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null
    const trigger = () => {
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => setRefreshTick(t => t + 1), 1500)
    }

    const channel = supabase
      .channel('conciliacion-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conciliacion' }, trigger)
      .subscribe()

    return () => {
      if (debounce) clearTimeout(debounce)
      supabase.removeChannel(channel)
    }
  }, [])

  const cargarPagina = useCallback(async () => {
    const myFetchId = ++fetchIdRef.current
    setCargando(true)
    setErrorCarga(null)

    const from = (page - 1) * pageSize
    const to   = from + pageSize - 1

    const sortMap: Record<string, string | null> = {
      fecha:       'fecha',
      concepto:    'concepto',
      contraparte: 'proveedor',
      importe:     'importe',
      categoria:   'categoria',
      doc:         'doc_estado',
      titular:     'titular_id',
      estado:      null,
    }
    const sortField = sortMap[sortColumn] ?? 'fecha'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase
      .from('conciliacion')
      .select('*, factura_data:facturas(pdf_drive_url, pdf_filename)', { count: 'exact' })
      .gte('fecha', periodoDesdeStr)
      .lte('fecha', periodoHastaStr)

    if (filtroCard === 'ingresos') q = q.gt('importe', 0)
    if (filtroCard === 'gastos')   q = q.lt('importe', 0)
    if (filtroCard === 'pend_sin_cat') q = q.is('categoria', null)
    if (filtroCard === 'pend_sin_doc') q = q.not('categoria', 'is', null).eq('doc_estado', 'falta')
    if (filtroCard === 'pend_total')   q = q.or('categoria.is.null,doc_estado.eq.falta')

    if (ocultarConciliados && !filtroCard) {
      q = q.or('categoria.is.null,doc_estado.eq.falta')
    }

    if (catFiltro !== 'todas') q = q.eq('categoria', catFiltro)

    if (busquedaDebounced) {
      const safe = busquedaDebounced.replace(/[%_,()]/g, ' ').trim()
      if (safe) q = q.or(`concepto.ilike.%${safe}%,notas.ilike.%${safe}%,proveedor.ilike.%${safe}%`)
    }

    if (filtroTitular !== 'todos' && titulares.length > 0) {
      const matchIds = titulares
        .filter(t => {
          const n = t.nombre.toLowerCase()
          if (filtroTitular === 'ruben')  return n.includes('rubén') || n.includes('ruben')
          if (filtroTitular === 'emilio') return n.includes('emilio')
          return false
        })
        .map(t => t.id)
      if (matchIds.length === 1) q = q.eq('titular_id', matchIds[0])
      else if (matchIds.length > 1) q = q.in('titular_id', matchIds)
    }

    if (sortField) {
      q = q.order(sortField, { ascending: sortDir === 'asc' }).range(from, to)
    } else {
      q = q.order('fecha', { ascending: false }).range(from, to)
    }

    const { data, error, count } = await q

    if (myFetchId !== fetchIdRef.current) return

    if (error) {
      setErrorCarga('Error cargando movimientos. Intenta de nuevo.')
      setFilas([])
      setTotal(0)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = (data ?? []).map((m: any): Movimiento => ({
        id:          m.id,
        fecha:       m.fecha,
        concepto:    m.concepto,
        importe:     Number(m.importe),
        categoria_id: m.categoria ?? null,
        contraparte: m.proveedor ?? '',
        gasto_id:    m.gasto_id ?? null,
        factura_id:  m.factura_id ?? null,
        factura_data: m.factura_data ?? null,
        titular_id:  m.titular_id ?? null,
        doc_estado:  (m.doc_estado ?? 'falta') as 'tiene' | 'falta' | 'no_requiere',
      }))
      setFilas(mapped)
      setTotal(count ?? 0)
    }
    setCargando(false)
  }, [page, pageSize, sortColumn, sortDir, filtroCard, catFiltro, filtroTitular, titulares, periodoDesdeStr, periodoHastaStr, refreshTick, busquedaDebounced, ocultarConciliados])

  const cargarAgregados = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await fetchAllPaginated<any>(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q: any = supabase
          .from('conciliacion')
          .select('id, importe, categoria, doc_estado, titular_id')
          .gte('fecha', periodoDesdeStr)
          .lte('fecha', periodoHastaStr)

        if (filtroTitular !== 'todos' && titulares.length > 0) {
          const matchIds = titulares
            .filter(t => {
              const n = t.nombre.toLowerCase()
              if (filtroTitular === 'ruben')  return n.includes('rubén') || n.includes('ruben')
              if (filtroTitular === 'emilio') return n.includes('emilio')
              return false
            })
            .map(t => t.id)
          if (matchIds.length === 1)      q = q.eq('titular_id', matchIds[0])
          else if (matchIds.length > 1)   q = q.in('titular_id', matchIds)
        }
        return q
      })

      let ingresosImporte = 0, gastosImporte = 0
      let pendSinCatCount = 0, pendSinCatNeto = 0
      let pendSinDocCount = 0, pendSinDocNeto = 0

      const seen = new Set<string>()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const r of data as any[]) {
        if (seen.has(r.id)) continue
        seen.add(r.id)

        const imp = Number(r.importe) || 0
        if (imp > 0) ingresosImporte += imp
        if (imp < 0) gastosImporte   += imp

        if (!r.categoria) {
          pendSinCatCount += 1
          pendSinCatNeto  += imp
        } else if (r.doc_estado === 'falta') {
          pendSinDocCount += 1
          pendSinDocNeto  += imp
        }
      }

      setAgregados({
        ingresosImporte, gastosImporte,
        pendTotalCount: pendSinCatCount + pendSinDocCount,
        pendTotalNeto: pendSinCatNeto + pendSinDocNeto,
        pendSinCatCount, pendSinCatNeto,
        pendSinDocCount, pendSinDocNeto,
      })
    } catch {
      setAgregados(null)
    }
  }, [periodoDesdeStr, periodoHastaStr, filtroTitular, titulares, refreshTick])

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

  const onCambiarFiltroTitular = (v: 'todos' | 'ruben' | 'emilio') => {
    setFiltroTitular(v)
    if (page !== 1) updateUrl({ page: 1 })
  }

  const onCambiarOcultarConciliados = (v: boolean) => {
    setOcultarConciliados(v)
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

  function handleSort(col: SortColumn, e?: React.MouseEvent) {
    const shift = e?.shiftKey ?? false
    if (!shift) {
      // Primario → va al servidor
      if (sortColumn === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
      else { setSortColumn(col); setSortDir('asc') }
      if (page !== 1) updateUrl({ page: 1 })
    }
    // Siempre sincronizar el hook (indicadores + orden secundario cliente)
    multiHandleSort(col, shift)
  }

  const filasVisibles = useMemo(() => applySorts(filas), [filas, applySorts])

  const handleExportar = async () => {
    setExportando(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await fetchAllPaginated<any>(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q: any = supabase
          .from('conciliacion')
          .select('*')
          .gte('fecha', periodoDesdeStr)
          .lte('fecha', periodoHastaStr)

        if (filtroCard === 'ingresos') q = q.gt('importe', 0)
        if (filtroCard === 'gastos')   q = q.lt('importe', 0)
        if (filtroCard === 'pend_sin_cat') q = q.is('categoria', null)
        if (filtroCard === 'pend_sin_doc') q = q.not('categoria', 'is', null).eq('doc_estado', 'falta')
        if (filtroCard === 'pend_total')   q = q.or('categoria.is.null,doc_estado.eq.falta')
        if (catFiltro !== 'todas')     q = q.eq('categoria', catFiltro)
        if (busquedaDebounced) {
          const safe = busquedaDebounced.replace(/[%_,()]/g, ' ').trim()
          if (safe) q = q.or(`concepto.ilike.%${safe}%,notas.ilike.%${safe}%,proveedor.ilike.%${safe}%`)
        }
        if (filtroTitular !== 'todos' && titulares.length > 0) {
          const matchIds = titulares
            .filter(t => {
              const n = t.nombre.toLowerCase()
              if (filtroTitular === 'ruben')  return n.includes('rubén') || n.includes('ruben')
              if (filtroTitular === 'emilio') return n.includes('emilio')
              return false
            })
            .map(t => t.id)
          if (matchIds.length === 1)    q = q.eq('titular_id', matchIds[0])
          else if (matchIds.length > 1) q = q.in('titular_id', matchIds)
        }
        return q
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = data.map((m: any) => [
        m.fecha,
        (m.concepto ?? '').replace(/,/g, ' '),
        (m.proveedor ?? '').replace(/,/g, ' '),
        m.importe,
        m.categoria ?? '',
        (m.doc_estado ?? 'falta'),
      ])
      const csv = [
        ['Fecha', 'Concepto', 'Contraparte', 'Importe', 'Categoría', 'Doc Estado'].join(','),
        ...rows.map(r => r.join(',')),
      ].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `movimientos_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
    } catch {
      // swallow
    } finally {
      setExportando(false)
    }
  }

  const cardStyle = (filtro: FiltroCard, isActive: boolean): React.CSSProperties => ({
    background: '#fff',
    border: isActive ? '1px solid #FF4757' : '0.5px solid #d0c8bc',
    borderRadius: 14,
    padding: '18px 20px',
    cursor: 'pointer',
    boxShadow: isActive ? '0 0 0 3px #FF475715' : 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  })

  const HEADERS: { label: string; col: SortColumn; align: 'left' | 'right' | 'center' }[] = [
    { label: 'Fecha',       col: 'fecha',       align: 'left' },
    { label: 'Concepto',    col: 'concepto',    align: 'left' },
    { label: 'Contraparte', col: 'contraparte', align: 'left' },
    { label: 'Importe',     col: 'importe',     align: 'right' },
    { label: 'Categoría',   col: 'categoria',   align: 'left' },
    { label: 'Doc',         col: 'doc',         align: 'center' },
    { label: 'Estado',      col: 'estado',      align: 'left' },
    { label: 'Titular',     col: 'titular',     align: 'left' },
  ]

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>

        <div onClick={() => onCambiarFiltroCard('ingresos')} style={cardStyle('ingresos', filtroCard === 'ingresos')}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }}>Ingresos</span>
          </div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', color: '#1D9E75' }}>
            {agregados !== null ? fmtEur(agregados.ingresosImporte) : '—'}
          </div>
        </div>

        <div onClick={() => onCambiarFiltroCard('gastos')} style={cardStyle('gastos', filtroCard === 'gastos')}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }}>Gastos</span>
          </div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', color: '#E24B4A' }}>
            {agregados !== null ? fmtEur(Math.abs(agregados.gastosImporte)) : '—'}
          </div>
        </div>

        <div style={{ ...cardStyle('pend_total', filtroCard === 'pend_total' || filtroCard === 'pend_sin_cat' || filtroCard === 'pend_sin_doc'), padding: '14px 16px', cursor: 'default' }}>
          <div onClick={() => onCambiarFiltroCard('pend_total')} style={{ cursor: 'pointer', marginBottom: 8 }}>
            <div style={{ marginBottom: 4 }}>
              <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }}>Pendientes</span>
            </div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 22, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', color: agregados !== null && agregados.pendTotalNeto < 0 ? '#E24B4A' : '#1D9E75' }}>
              {agregados !== null ? fmtEur(agregados.pendTotalNeto) : '—'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, fontSize: 10, fontFamily: 'Lexend, sans-serif' }}>
            <button
              onClick={() => onCambiarFiltroCard('pend_sin_cat')}
              style={{
                flex: 1, padding: '5px 6px', borderRadius: 5,
                border: filtroCard === 'pend_sin_cat' ? '1px solid #E24B4A' : '0.5px solid #d0c8bc',
                background: filtroCard === 'pend_sin_cat' ? '#E24B4A10' : '#fff',
                cursor: 'pointer', textAlign: 'center',
              }}>
              <div style={{ color: '#7a8090', fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 2 }}>Sin categoría</div>
              <div style={{ color: '#E24B4A', fontFamily: 'Oswald, sans-serif', fontSize: 13, fontWeight: 600 }}>
                {agregados !== null ? agregados.pendSinCatCount : '—'}
              </div>
            </button>
            <button
              onClick={() => onCambiarFiltroCard('pend_sin_doc')}
              style={{
                flex: 1, padding: '5px 6px', borderRadius: 5,
                border: filtroCard === 'pend_sin_doc' ? '1px solid #F26B1F' : '0.5px solid #d0c8bc',
                background: filtroCard === 'pend_sin_doc' ? '#F26B1F10' : '#fff',
                cursor: 'pointer', textAlign: 'center',
              }}>
              <div style={{ color: '#7a8090', fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 2 }}>Sin doc</div>
              <div style={{ color: '#F26B1F', fontFamily: 'Oswald, sans-serif', fontSize: 13, fontWeight: 600 }}>
                {agregados !== null ? agregados.pendSinDocCount : '—'}
              </div>
            </button>
          </div>
        </div>

        <div style={{ background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ marginBottom: 6 }}>
            <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }}>Titular</span>
          </div>
          <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
            {(['todos', 'ruben', 'emilio'] as const).map(t => {
              const isActive = filtroTitular === t
              const bg  = isActive ? (t === 'todos' ? '#3a4050' : t === 'ruben' ? '#F26B1F' : '#1E5BCC') : '#fff'
              const clr = isActive ? '#fff' : '#3a4050'
              const bd  = isActive ? 'none' : '0.5px solid #d0c8bc'
              return (
                <button key={t} onClick={() => onCambiarFiltroTitular(t)}
                  style={{ flex: 1, padding: '7px 6px', borderRadius: 6, border: bd, background: bg, fontFamily: 'Lexend, sans-serif', fontSize: 12, color: clr, cursor: 'pointer', textAlign: 'center', fontWeight: 500 }}>
                  {t === 'todos' ? 'Todos' : t === 'ruben' ? 'Rubén' : 'Emilio'}
                </button>
              )
            })}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#3a4050', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={ocultarConciliados}
              onChange={e => onCambiarOcultarConciliados(e.target.checked)}
              style={{ width: 14, height: 14, accentColor: '#FF4757', margin: 0, cursor: 'pointer' }}
            />
            <span>Ocultar conciliados</span>
          </label>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
          <input
            type="text"
            value={busqueda}
            onChange={e => onCambiarBusqueda(e.target.value)}
            placeholder="Buscar concepto, notas o proveedor en toda la BBDD"
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
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 16, color: '#7a8090', letterSpacing: 1, marginBottom: 8 }}>No hay movimientos</div>
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
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontFamily: 'Lexend, sans-serif', fontSize: 13 }}>
                <thead>
                  <tr>
                    {HEADERS.map(h => {
                      const isActive = sortColumn === h.col
                      const arrow = sortIndicator(h.col)
                      return (
                        <th key={h.col} onClick={(e) => handleSort(h.col, e)}
                          style={{
                            fontFamily: 'Oswald, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '2px',
                            color: isActive ? '#FF4757' : '#7a8090', textTransform: 'uppercase', textAlign: h.align,
                            padding: '10px 12px', background: '#f5f3ef', borderBottom: '0.5px solid #d0c8bc',
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
                        Sin movimientos con los filtros actuales
                      </td>
                    </tr>
                  ) : filasVisibles.map((m, idx) => {
                    const isLast = idx === filasVisibles.length - 1
                    const tdBase: React.CSSProperties = { padding: '8px 12px', borderBottom: isLast ? 'none' : '0.5px solid #ebe8e2', verticalAlign: 'middle', lineHeight: 1.4 }
                    const catInfo = getBadgeCategoria(m, categoriasPyg)
                    const estado = calcularEstado(m)
                    const titNombre = titulares.find(t => t.id === m.titular_id)?.nombre?.toLowerCase() ?? ''
                    const isRuben = titNombre.includes('rubén') || titNombre.includes('ruben')
                    const isEmilio = titNombre.includes('emilio')

                    const facturaUrl = (m as unknown as { factura_data?: { pdf_drive_url?: string | null } }).factura_data?.pdf_drive_url ?? null
                    const tieneDoc = m.doc_estado === 'tiene' || (m.factura_id && facturaUrl)

                    const tdDocBase: React.CSSProperties = {
                      padding: 0,
                      borderBottom: isLast ? 'none' : '0.5px solid #ebe8e2',
                      verticalAlign: 'middle',
                      textAlign: 'center',
                    }

                    return (
                      <tr key={m.id} onClick={() => setModalMov(m)} style={{ cursor: 'pointer' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f5f3ef60' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}>
                        <td style={{ ...tdBase, color: '#7a8090', fontSize: 12, whiteSpace: 'nowrap' }}>
                          {fmtDate(m.fecha)}
                        </td>
                        <td title={m.concepto} style={{ ...tdBase, color: '#111', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.concepto}
                        </td>
                        <td title={m.contraparte || ''} style={{ ...tdBase, color: m.contraparte ? '#111' : '#7a8090', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.contraparte || 'Sin identificar'}
                        </td>
                        <td style={{ ...tdBase, textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: 14, fontWeight: 500, letterSpacing: '0.5px', color: m.importe >= 0 ? '#1D9E75' : '#E24B4A', whiteSpace: 'nowrap' }}>
                          {fmtEur(m.importe)}
                        </td>
                        <td style={{ ...tdBase, whiteSpace: 'nowrap' }}>
                          {catInfo ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px', borderRadius: 6, background: '#f5f3ef', border: '0.5px solid #d0c8bc', fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#3a4050', whiteSpace: 'nowrap' }}>
                              <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1px', color: '#7a8090', fontWeight: 500 }}>{catInfo.id}</span>
                              {catInfo.nombre}
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, background: '#E24B4A10', border: '0.5px dashed #E24B4A50', fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#E24B4A', fontStyle: 'italic' }}>
                              sin categoría
                            </span>
                          )}
                        </td>
                        {tieneDoc && facturaUrl ? (
                          <td
                            style={tdDocBase}
                            onClick={e => { e.stopPropagation(); window.open(facturaUrl, '_blank', 'noopener,noreferrer') }}
                            title="Ver factura"
                          >
                            <div style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '100%', height: '100%', minHeight: 38,
                              fontSize: 22, lineHeight: 1, color: '#0F6E56',
                              cursor: 'pointer', userSelect: 'none',
                            }}>
                              📎
                            </div>
                          </td>
                        ) : tieneDoc ? (
                          <td style={tdDocBase} onClick={e => e.stopPropagation()} title="Sin URL del PDF">
                            <div style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '100%', height: '100%', minHeight: 38,
                              fontSize: 22, lineHeight: 1, color: '#0F6E56',
                            }}>📎</div>
                          </td>
                        ) : m.doc_estado === 'no_requiere' ? (
                          <td style={{ ...tdDocBase, padding: '8px 16px' }}>
                            <span style={{ color: '#1D9E75', fontSize: 11, fontFamily: 'Lexend, sans-serif' }}>—</span>
                          </td>
                        ) : (
                          <td style={tdDocBase}>
                            <div style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '100%', height: '100%', minHeight: 38,
                              fontSize: 18, lineHeight: 1, color: '#F26B1F', fontWeight: 600,
                            }}>✕</div>
                          </td>
                        )}
                        <td style={tdBase}>
                          {estado === 'conciliado' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 6, fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1px', fontWeight: 500, textTransform: 'uppercase', background: '#1D9E7515', color: '#0F6E56' }}>
                              Conciliado
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 6, fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1px', fontWeight: 500, textTransform: 'uppercase', background: '#E24B4A15', color: '#E24B4A' }}>
                              Pendiente
                            </span>
                          )}
                        </td>
                        <td style={tdBase}>
                          {isRuben ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 6, fontFamily: 'Lexend, sans-serif', fontSize: 11, fontWeight: 500, background: '#F26B1F15', color: '#F26B1F', whiteSpace: 'nowrap' }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F26B1F', flexShrink: 0 }} />
                              Rubén
                            </span>
                          ) : isEmilio ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 6, fontFamily: 'Lexend, sans-serif', fontSize: 11, fontWeight: 500, background: '#1E5BCC15', color: '#1E5BCC', whiteSpace: 'nowrap' }}>
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

                    <button
                      style={isFirst ? btnDisabled : btnBase}
                      disabled={isFirst}
                      onClick={() => !isFirst && updateUrl({ page: 1 })}
                    >
                      Primera
                    </button>
                    <button
                      style={isFirst ? btnDisabled : btnBase}
                      disabled={isFirst}
                      onClick={() => !isFirst && updateUrl({ page: page - 1 })}
                    >
                      ‹ Anterior
                    </button>
                    <span style={{ ...btnBase, cursor: 'default' }}>
                      {`Página ${page} de ${totalPages}`}
                    </span>
                    <button
                      style={isLast ? btnDisabled : btnBase}
                      disabled={isLast}
                      onClick={() => !isLast && updateUrl({ page: page + 1 })}
                    >
                      Siguiente ›
                    </button>
                    <button
                      style={isLast ? btnDisabled : btnBase}
                      disabled={isLast}
                      onClick={() => !isLast && updateUrl({ page: totalPages })}
                    >
                      Última
                    </button>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {modalMov && (
        <ModalDetalleMovimiento
          movimiento={modalMov}
          categoriasPyg={categoriasPyg}
          titulares={titulares}
          onClose={() => setModalMov(null)}
          onSaved={() => {
            setModalMov(null)
            setRefreshTick(t => t + 1)
          }}
        />
      )}
    </div>
  )
}
