import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fmtEur, fmtDate } from '@/utils/format'
import { supabase } from '@/lib/supabase'
import type { Movimiento } from '@/types/conciliacion'
import { getNewId } from '@/lib/categoryMapping'
import ModalDetalleMovimiento from './ModalDetalleMovimiento'

interface TabMovimientosProps {
  movimientos: Movimiento[]
  periodoLabel: string
  periodoDesde: Date
  periodoHasta: Date
}

interface CatPyg { id: string; nombre: string; nivel: number; parent_id: string | null }
interface Titular { id: string; nombre: string }

type SortColumn = 'fecha' | 'concepto' | 'contraparte' | 'importe' | 'categoria' | 'doc' | 'estado' | 'titular'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 100

function calcularEstado(m: Movimiento): 'conciliado' | 'pendiente' {
  const tieneCategoria = !!m.categoria_id
  const tieneDoc = m.doc_estado === 'tiene' || m.doc_estado === 'no_requiere'
  return tieneCategoria && tieneDoc ? 'conciliado' : 'pendiente'
}

function getBadgeCategoria(m: Movimiento, categoriasPyg: CatPyg[]) {
  const newId = getNewId(m.categoria_id)
  const catById = newId
    ? categoriasPyg.find(c => c.id === newId)
    : m.categoria_id
    ? categoriasPyg.find(c => c.id === m.categoria_id)
    : null
  if (catById) return { id: catById.id, nombre: catById.nombre }
  return null
}

export default function TabMovimientos({ movimientos, periodoDesde: _pd, periodoHasta: _ph, periodoLabel: _pl }: TabMovimientosProps) {
  const navigate = useNavigate()
  const [filtroCard, setFiltroCard] = useState<'ingresos' | 'gastos' | 'pendientes' | null>(null)
  const [filtroTitular, setFiltroTitular] = useState<'todos' | 'ruben' | 'emilio'>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [catFiltro, setCatFiltro] = useState('todas')
  const [page, setPage] = useState(1)
  const [modalMov, setModalMov] = useState<Movimiento | null>(null)
  const [categoriasPyg, setCategoriasPyg] = useState<CatPyg[]>([])
  const [titulares, setTitulares] = useState<Titular[]>([])
  const [sortColumn, setSortColumn] = useState<SortColumn | null>('fecha')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    Promise.all([
      supabase.from('categorias_pyg').select('id, nombre, nivel, parent_id').eq('activa', true).order('orden'),
      supabase.from('titulares').select('id, nombre').eq('activo', true).order('orden'),
    ]).then(([cats, tits]) => {
      if (!cats.error) setCategoriasPyg(cats.data ?? [])
      if (!tits.error) setTitulares(tits.data ?? [])
    })
  }, [])

  function handleSort(col: SortColumn) {
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

  const totales = useMemo(() => {
    const ingresos = movimientos.filter(m => m.importe > 0)
    const gastos = movimientos.filter(m => m.importe < 0)
    const pendientes = movimientos.filter(m => calcularEstado(m) === 'pendiente')
    return {
      ingresosImporte: ingresos.reduce((s, m) => s + m.importe, 0),
      gastosImporte: Math.abs(gastos.reduce((s, m) => s + m.importe, 0)),
      pendientesCount: pendientes.length,
      pendientesImporte: Math.abs(pendientes.reduce((s, m) => s + m.importe, 0)),
    }
  }, [movimientos])

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
          const order: Record<string, number> = { 'tiene': 0, 'no_requiere': 1, 'falta': 2 }
          return ((order[a.doc_estado as string] ?? 3) - (order[b.doc_estado as string] ?? 3)) * dir
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

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtrados.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function handleExportar() {
    const rows = filtrados.map(m => [
      m.fecha, m.concepto.replace(/,/g, ' '), m.contraparte.replace(/,/g, ' '), m.importe, m.categoria_id ?? '', calcularEstado(m)
    ])
    const csv = [
      ['Fecha', 'Concepto', 'Contraparte', 'Importe', 'Categoría', 'Estado'].join(','),
      ...rows.map(r => r.join(','))
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `movimientos_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

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
    { label: 'Fecha', col: 'fecha', align: 'left' },
    { label: 'Concepto', col: 'concepto', align: 'left' },
    { label: 'Contraparte', col: 'contraparte', align: 'left' },
    { label: 'Importe', col: 'importe', align: 'right' },
    { label: 'Categoría', col: 'categoria', align: 'left' },
    { label: 'Doc', col: 'doc', align: 'center' },
    { label: 'Estado', col: 'estado', align: 'left' },
    { label: 'Titular', col: 'titular', align: 'left' },
  ]

  return (
    <div>
      {/* 4 CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>

        {/* Card INGRESOS — solo label + cifra */}
        <div onClick={() => { setFiltroCard(prev => prev === 'ingresos' ? null : 'ingresos'); setPage(1) }} style={cardStyle('ingresos')}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }}>Ingresos</span>
          </div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 30, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', color: '#1D9E75' }}>
            +{fmtEur(totales.ingresosImporte)}
          </div>
        </div>

        {/* Card GASTOS — solo label + cifra */}
        <div onClick={() => { setFiltroCard(prev => prev === 'gastos' ? null : 'gastos'); setPage(1) }} style={cardStyle('gastos')}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }}>Gastos</span>
          </div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 30, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', color: '#E24B4A' }}>
            -{fmtEur(totales.gastosImporte)}
          </div>
        </div>

        {/* Card PENDIENTES — label + badge + cifra */}
        <div onClick={() => { setFiltroCard(prev => prev === 'pendientes' ? null : 'pendientes'); setPage(1) }} style={cardStyle('pendientes')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }}>Pendientes</span>
            <span style={{ background: '#F26B1F', color: '#fff', padding: '1px 8px', borderRadius: 9, fontSize: 10, fontWeight: 500, fontFamily: 'Lexend, sans-serif' }}>
              {totales.pendientesCount}
            </span>
          </div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 30, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', color: '#F26B1F' }}>
            {fmtEur(totales.pendientesImporte)}
          </div>
        </div>

        {/* Card TITULAR — label + nombre activo + toggle */}
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
              const bg = isActive ? (t === 'todos' ? '#3a4050' : t === 'ruben' ? '#F26B1F' : '#1E5BCC') : '#fff'
              const clr = isActive ? '#fff' : '#3a4050'
              const bd = isActive ? 'none' : '0.5px solid #d0c8bc'
              return (
                <button
                  key={t}
                  onClick={() => { setFiltroTitular(t); setPage(1) }}
                  style={{ flex: 1, padding: '5px 8px', borderRadius: 6, border: bd, background: bg, fontFamily: 'Lexend, sans-serif', fontSize: 12, color: clr, cursor: 'pointer', textAlign: 'center', fontWeight: 500 }}
                >
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
          onChange={e => { setBusqueda(e.target.value); setPage(1) }}
          placeholder="Buscar proveedor / nº factura / importe / concepto"
          style={{ flex: 1, minWidth: 240, padding: '10px 14px', borderRadius: 10, border: '0.5px solid #d0c8bc', background: '#fff', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#111', outline: 'none' }}
        />
        <select
          value={catFiltro}
          onChange={e => { setCatFiltro(e.target.value); setPage(1) }}
          style={{ padding: '10px 14px', borderRadius: 10, border: '0.5px solid #d0c8bc', background: '#fff', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#111', minWidth: 280, cursor: 'pointer' }}
        >
          <option value="todas">Categoría · Todas las categorías</option>
          {categoriasPyg.filter(c => c.nivel === 3).map(c => (
            <option key={c.id} value={c.id}>{c.id} · {c.nombre}</option>
          ))}
        </select>
        <button
          onClick={handleExportar}
          style={{ padding: '10px 18px', borderRadius: 10, border: '0.5px solid #d0c8bc', background: '#fff', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#3a4050', cursor: 'pointer', fontWeight: 500 }}
        >
          Exportar
        </button>
      </div>

      {/* EMPTY STATE cuando BD vacía */}
      {movimientos.length === 0 ? (
        <div style={{ background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 14, padding: '48px 28px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 16, color: '#7a8090', letterSpacing: 1, marginBottom: 8 }}>
            No hay movimientos en este periodo
          </div>
          <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#7a8090', marginBottom: 24 }}>
            Importa un extracto bancario desde el Importador
          </div>
          <button
            onClick={() => navigate('/importador')}
            style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#FF4757', color: '#fff', fontFamily: 'Lexend, sans-serif', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
          >
            Ir al Importador
          </button>
        </div>
      ) : (
        /* TABLA 8 COLUMNAS — table-layout fixed */
        <div style={{ background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 14, overflow: 'hidden' }}>
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
                          textAlign: h.align,
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
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '32px 16px', textAlign: 'center', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#7a8090' }}>
                      Sin movimientos con los filtros actuales
                    </td>
                  </tr>
                ) : paginated.map((m, idx) => {
                  const isLast = idx === paginated.length - 1
                  const tdBase: React.CSSProperties = { padding: '8px 16px', borderBottom: isLast ? 'none' : '0.5px solid #ebe8e2', verticalAlign: 'middle', lineHeight: 1.4 }
                  const catInfo = getBadgeCategoria(m, categoriasPyg)
                  const estado = calcularEstado(m)
                  const titularInfo = titulares.find(t => t.id === m.titular_id)
                  const titNombre = titularInfo?.nombre?.toLowerCase() ?? ''
                  const isRuben = titNombre.includes('rubén') || titNombre.includes('ruben')
                  const isEmilio = titNombre.includes('emilio')

                  return (
                    <tr
                      key={m.id}
                      onClick={() => setModalMov(m)}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f5f3ef60' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
                    >
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
                        {m.importe >= 0 ? '+' : ''}{fmtEur(m.importe)}
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
                        {m.doc_estado === 'tiene' || (m.factura_id && (m as any).factura_data?.pdf_drive_url) ? (
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
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F26B1F', flexShrink: 0 }}></span>
                            Rubén
                          </span>
                        ) : isEmilio ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, fontFamily: 'Lexend, sans-serif', fontSize: 12, fontWeight: 500, background: '#1E5BCC15', color: '#1E5BCC', whiteSpace: 'nowrap' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1E5BCC', flexShrink: 0 }}></span>
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

          {/* Footer paginación */}
          <div style={{ padding: '14px 16px', borderTop: '0.5px solid #d0c8bc', background: '#fafaf7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#7a8090' }}>
              Mostrando {paginated.length} de {filtrados.length} movimientos
            </span>
            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button disabled={currentPage === 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={{ padding: '6px 10px', borderRadius: 8, border: '0.5px solid #d0c8bc', background: '#fff', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: currentPage === 1 ? '#ccc' : '#111', cursor: currentPage === 1 ? 'default' : 'pointer' }}>‹</button>
                <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#7a8090', padding: '0 8px' }}>
                  Página {currentPage} de {totalPages}
                </span>
                <button disabled={currentPage === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={{ padding: '6px 10px', borderRadius: 8, border: '0.5px solid #d0c8bc', background: '#fff', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: currentPage === totalPages ? '#ccc' : '#111', cursor: currentPage === totalPages ? 'default' : 'pointer' }}>›</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL */}
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
