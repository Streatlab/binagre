import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fmtEur, fmtDate } from '@/utils/format'
import { supabase } from '@/lib/supabase'
import { fetchAllPaginated } from '@/lib/supabasePaginated'
import type { Movimiento } from '@/types/conciliacion'
import ModalDetalleMovimiento from './ModalDetalleMovimiento'

/* ─── Paginación ─── */
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

/* ─── Interfaces ─── */
interface TabMovimientosProps {
  periodoLabel: string
  periodoDesde: Date
  periodoHasta: Date
}

interface CatPyg { id: string; nombre: string; nivel: number; parent_id: string | null }
interface Titular { id: string; nombre: string }

type Agregados = {
  ingresosImporte: number
  gastosImporte: number
  pendientesCount: number
  pendientesImporte: number
}

type SortColumn = 'fecha' | 'concepto' | 'contraparte' | 'importe' | 'categoria' | 'doc' | 'estado' | 'titular'
type SortDir = 'asc' | 'desc'

/* ─── Helpers ─── */
function calcularEstado(m: Movimiento): 'conciliado' | 'pendiente' {
  const tieneCategoria = !!m.categoria_id
  const tieneDoc = m.doc_estado === 'tiene' || m.doc_estado === 'no_requiere'
  return tieneCategoria && tieneDoc ? 'conciliado' : 'pendiente'
}

function getBadgeCategoria(m: Movimiento, categoriasPyg: CatPyg[]) {
  if (!m.categoria_id) return null
  const cat = categoriasPyg.find(c => c.id === m.categoria_id)
  if (cat) return { id: cat.id, nombre: cat.nombre }
  return null
}

/* ─── Componente ─── */
export default function TabMovimientos({ periodoDesde, periodoHasta }: TabMovimientosProps) {
  const navigate = useNavigate()

  /* — URL params — */
  const [searchParams, setSearchParams] = useSearchParams()
  const page     = parsePage(searchParams.get('page'))
  const pageSize = parsePageSize(searchParams.get('size'))

  const updateUrl = useCallback((next: { page?: number; size?: PageSize }) => {
    const params = new URLSearchParams(searchParams)
    if (next.page !== undefined) params.set('page', String(next.page))
    if (next.size !== undefined) params.set('size', String(next.size))
    setSearchParams(params, { replace: true })
  }, [searchParams, setSearchParams])

  /* — Filtros UI — */
  const [filtroCard, setFiltroCard] = useState<'ingresos' | 'gastos' | 'pendientes' | null>(null)
  const [filtroTitular, setFiltroTitular] = useState<'todos' | 'ruben' | 'emilio'>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [catFiltro, setCatFiltro] = useState('todas')
  const [sortColumn, setSortColumn] = useState<SortColumn>('fecha')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  /* — Estado datos — */
  const [filas, setFilas]           = useState<Movimiento[]>([])
  const [total, setTotal]           = useState<number>(0)
  const [cargando, setCargando]     = useState<boolean>(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const fetchIdRef                  = useRef<number>(0)

  /* — Agregados KPI — */
  const [agregados, setAgregados] = useState<Agregados | null>(null)

  /* — Lookup data — */
  const [modalMov, setModalMov]           = useState<Movimiento | null>(null)
  const [categoriasPyg, setCategoriasPyg] = useState<CatPyg[]>([])
  const [titulares, setTitulares]         = useState<Titular[]>([])

  /* — Exportar — */
  const [exportando, setExportando] = useState(false)

  /* ── Corregir size inválido en montaje ── */
  useEffect(() => {
    const raw = searchParams.get('size')
    if (raw !== null && !(PAGE_SIZES as readonly number[]).includes(Number(raw))) {
      updateUrl({ size: DEFAULT_PAGE_SIZE })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Cargar lookup tables ── */
  useEffect(() => {
    Promise.all([
      supabase.from('categorias_pyg').select('id, nombre, nivel, parent_id').eq('activa', true).order('orden'),
      supabase.from('titulares').select('id, nombre').eq('activo', true).order('orden'),
    ]).then(([cats, tits]) => {
      if (!cats.error) setCategoriasPyg(cats.data ?? [])
      if (!tits.error) setTitulares(tits.data ?? [])
    })
  }, [])

  /* ── Calcular string de período ── */
  const periodoDesdeStr = periodoDesde.toISOString().slice(0, 10)
  const periodoHastaStr = periodoHasta.toISOString().slice(0, 10)

  /* ── Query paginada principal ── */
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
      estado:      null, // client-side
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
    // pendientes es client-side

    if (catFiltro !== 'todas') q = q.eq('categoria', catFiltro)

    if (filtroTitular !== 'todos' && titulares.length > 0) {
      const matchIds = titulares
        .filter(t => {
          const n = t.nombre.toLowerCase()
          if (filtroTitular === 'ruben')  return n.includes('rubén') || n.includes('ruben')
          if (filtroTitular === 'emilio') return n.includes('emilio')
          return false
        })
        .map(t => t.id)
      if (matchIds.length === 1) {
        q = q.eq('titular_id', matchIds[0])
      } else if (matchIds.length > 1) {
        q = q.in('titular_id', matchIds)
      }
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
  }, [page, pageSize, sortColumn, sortDir, filtroCard, catFiltro, filtroTitular, titulares, periodoDesdeStr, periodoHastaStr])

  /* ── Query de agregados KPI ── */
  const cargarAgregados = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await fetchAllPaginated<any>(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q: any = supabase
          .from('conciliacion')
          .select('importe, categoria, doc_estado, titular_id')
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
      let pendientesCount = 0, pendientesImporte = 0

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const r of data as any[]) {
        const imp = Number(r.importe) || 0
        if (imp > 0) ingresosImporte += imp
        if (imp < 0) gastosImporte   += imp
        const tieneCategoria = !!r.categoria
        const tieneDoc = r.doc_estado === 'tiene' || r.doc_estado === 'no_requiere'
        if (!(tieneCategoria && tieneDoc)) {
          pendientesCount   += 1
          pendientesImporte += Math.abs(imp)
        }
      }
      setAgregados({ ingresosImporte, gastosImporte, pendientesCount, pendientesImporte })
    } catch {
      setAgregados(null)
    }
  }, [periodoDesdeStr, periodoHastaStr, filtroTitular, titulares])

  /* ── Efectos de disparo ── */
  useEffect(() => { cargarPagina() }, [cargarPagina])
  useEffect(() => { cargarAgregados() }, [cargarAgregados])

  /* ── Auto-corrección de page > totalPages ── */
  useEffect(() => {
    if (cargando) return
    if (total === 0) return
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    if (page > totalPages) updateUrl({ page: totalPages })
  }, [cargando, total, pageSize, page, updateUrl])

  /* ── Handlers ── */
  const onCambiarFiltroCard = (v: 'ingresos' | 'gastos' | 'pendientes') => {
    setFiltroCard(prev => prev === v ? null : v)
    if (page !== 1) updateUrl({ page: 1 })
  }

  const onCambiarFiltroTitular = (v: 'todos' | 'ruben' | 'emilio') => {
    setFiltroTitular(v)
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

  /* ── filasVisibles ── */
  const filasVisibles = useMemo(() => {
    let out = filas

    if (filtroCard === 'pendientes') {
      out = out.filter(m => calcularEstado(m) === 'pendiente')
    }

    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase()
      out = out.filter(m =>
        (m.concepto ?? '').toLowerCase().includes(q) ||
        (m.contraparte ?? '').toLowerCase().includes(q) ||
        (m.categoria_id ?? '').toLowerCase().includes(q)
      )
    }

    if (sortColumn === 'estado') {
      out = [...out].sort((a, b) => {
        const ea = calcularEstado(a)
        const eb = calcularEstado(b)
        return sortDir === 'asc' ? ea.localeCompare(eb) : eb.localeCompare(ea)
      })
    }

    return out
  }, [filas, busqueda, sortColumn, sortDir, filtroCard])

  /* ── Exportar CSV ── */
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
        if (catFiltro !== 'todas')     q = q.eq('categoria', catFiltro)
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
        return q.order('fecha', { ascending: false })
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

  /* ── Estilos ── */
  const cardStyle = (filtro: 'ingresos' | 'gastos' | 'pendientes'): React.CSSProperties => ({
    background: '#fff',
    border: filtroCard === filtro ? '1px solid #FF4757' : '0.5px solid #d0c8bc',
    borderRadius: 14,
    padding: '18px 20px',
    cursor: 'pointer',
    boxShadow: filtroCard === filtro ? '0 0 0 3px #FF475715' : 'none',
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

  /* ── Render ── */
  return (
    <div>
      {/* 4 CARDS KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>

        <div onClick={() => onCambiarFiltroCard('ingresos')} style={cardStyle('ingresos')}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }}>Ingresos</span>
          </div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 30, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', color: '#1D9E75' }}>
            {agregados !== null ? fmtEur(agregados.ingresosImporte) : '—'}
          </div>
        </div>

        <div onClick={() => onCambiarFiltroCard('gastos')} style={cardStyle('gastos')}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }}>Gastos</span>
          </div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 30, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', color: '#E24B4A' }}>
            {agregados !== null ? fmtEur(Math.abs(agregados.gastosImporte)) : '—'}
          </div>
        </div>

        <div onClick={() => onCambiarFiltroCard('pendientes')} style={cardStyle('pendientes')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }}>Pendientes</span>
            <span style={{ background: '#F26B1F', color: '#fff', padding: '1px 8px', borderRadius: 9, fontSize: 10, fontWeight: 500, fontFamily: 'Lexend, sans-serif' }}>
              {agregados !== null ? agregados.pendientesCount : '—'}
            </span>
          </div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 30, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', color: '#F26B1F' }}>
            {agregados !== null ? fmtEur(agregados.pendientesImporte) : '—'}
          </div>
        </div>

        <div style={{ background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }}>Titular</span>
          </div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 18, fontWeight: 600, color: '#111', margin: '6px 0 8px' }}>
            {filtroTitular === 'todos' ? 'Todos' : filtroTitular === 'ruben' ? 'Rubén' : 'Emilio'}
          </div>
          <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
            {(['todos', 'ruben', 'emilio'] as const).map(t => {
              const isActive = filtroTitular === t
              const bg  = isActive ? (t === 'todos' ? '#3a4050' : t === 'ruben' ? '#F26B1F' : '#1E5BCC') : '#fff'
              const clr = isActive ? '#fff' : '#3a4050'
              const bd  = isActive ? 'none' : '0.5px solid #d0c8bc'
              return (
                <button key={t} onClick={() => onCambiarFiltroTitular(t)}
                  style={{ flex: 1, padding: '5px 8px', borderRadius: 6, border: bd, background: bg, fontFamily: 'Lexend, sans-serif', fontSize: 12, color: clr, cursor: 'pointer', textAlign: 'center', fontWeight: 500 }}>
                  {t === 'todos' ? 'Todos' : t === 'ruben' ? 'Rubén' : 'Emilio'}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* BARRA FILTROS */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          type="text"
          value={busqueda}
          onChange={e => onCambiarBusqueda(e.target.value)}
          placeholder="Buscar en página actual"
          style={{ flex: 1, minWidth: 240, padding: '10px 14px', borderRadius: 10, border: '0.5px solid #d0c8bc', background: '#fff', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#111', outline: 'none' }}
        />
        <select
          value={catFiltro}
          onChange={e => onCambiarCatFiltro(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 10, border: '0.5px solid #d0c8bc', background: '#fff', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#111', minWidth: 280, cursor: 'pointer' }}
        >
          <option value="todas">Categoría · Todas las categorías</option>
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

      {/* BANNER ERROR */}
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

      {/* EMPTY STATE o TABLA */}
      {!cargando && total === 0 && !errorCarga ? (
        <div style={{ background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 14, padding: '48px 28px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 16, color: '#7a8090', letterSpacing: 1, marginBottom: 8 }}>No hay movimientos en este periodo</div>
          <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#7a8090', marginBottom: 24 }}>Importa un extracto bancario desde el Importador</div>
          <button
            onClick={() => navigate('/importador')}
            style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#FF4757', color: '#fff', fontFamily: 'Lexend, sans-serif', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
          >
            Ir al Importador
          </button>
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
                  <col style={{ width: 110 }} />
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
                        Sin movimientos con los filtros actuales
                      </td>
                    </tr>
                  ) : filasVisibles.map((m, idx) => {
                    const isLast = idx === filasVisibles.length - 1
                    const tdBase: React.CSSProperties = { padding: '8px 16px', borderBottom: isLast ? 'none' : '0.5px solid #ebe8e2', verticalAlign: 'middle', lineHeight: 1.4 }
                    const catInfo = getBadgeCategoria(m, categoriasPyg)
                    const estado = calcularEstado(m)
                    const titNombre = titulares.find(t => t.id === m.titular_id)?.nombre?.toLowerCase() ?? ''
                    const isRuben = titNombre.includes('rubén') || titNombre.includes('ruben')
                    const isEmilio = titNombre.includes('emilio')

                    return (
                      <tr key={m.id} onClick={() => setModalMov(m)} style={{ cursor: 'pointer' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f5f3ef60' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}>
                        <td style={{ ...tdBase, color: '#7a8090', fontSize: 12, whiteSpace: 'nowrap' }}>
                          {fmtDate(m.fecha)}
                        </td>
                        <td style={{ ...tdBase, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.concepto.length > 40 ? m.concepto.slice(0, 40) + '…' : m.concepto}
                        </td>
                        <td style={{ ...tdBase, color: m.contraparte ? '#111' : '#7a8090', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.contraparte || 'Sin identificar'}
                        </td>
                        <td style={{ ...tdBase, textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: 14, fontWeight: 500, letterSpacing: '0.5px', color: m.importe >= 0 ? '#1D9E75' : '#E24B4A', whiteSpace: 'nowrap' }}>
                          {fmtEur(m.importe)}
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
                        <td style={{ ...tdBase, textAlign: 'center' }}>
                          {m.doc_estado === 'tiene' || (m.factura_id && (m as unknown as { factura_data?: { pdf_drive_url?: string | null } }).factura_data?.pdf_drive_url) ? (
                            <span style={{ color: '#7a8090', fontSize: 14 }}>📎</span>
                          ) : m.doc_estado === 'no_requiere' ? (
                            <span style={{ color: '#1D9E75', fontSize: 11, fontFamily: 'Lexend, sans-serif' }}>no requiere</span>
                          ) : (
                            <span style={{ color: '#E24B4A', fontSize: 14 }}>✕</span>
                          )}
                        </td>
                        <td style={tdBase}>
                          {estado === 'conciliado' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1.5px', fontWeight: 500, textTransform: 'uppercase', background: '#1D9E7515', color: '#0F6E56' }}>
                              Conciliado
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1.5px', fontWeight: 500, textTransform: 'uppercase', background: '#E24B4A15', color: '#E24B4A' }}>
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

          {/* PIE DE TABLA — paginación */}
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
          onSaved={() => setModalMov(null)}
        />
      )}
    </div>
  )
}
