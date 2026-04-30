import React, { useMemo, useState, useEffect } from 'react'
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

const PAGE_SIZE = 25

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
  const [filtroCard, setFiltroCard] = useState<'ingresos' | 'gastos' | 'pendientes' | null>(null)
  const [filtroTitular, setFiltroTitular] = useState<'todos' | 'ruben' | 'emilio'>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [catFiltro, setCatFiltro] = useState('todas')
  const [page, setPage] = useState(1)
  const [modalMov, setModalMov] = useState<Movimiento | null>(null)
  const [categoriasPyg, setCategoriasPyg] = useState<CatPyg[]>([])
  const [titulares, setTitulares] = useState<Titular[]>([])

  useEffect(() => {
    Promise.all([
      supabase.from('categorias_pyg').select('id, nombre, nivel, parent_id').eq('activa', true).order('orden'),
      supabase.from('titulares').select('id, nombre').eq('activo', true).order('orden'),
    ]).then(([cats, tits]) => {
      if (!cats.error) setCategoriasPyg(cats.data ?? [])
      if (!tits.error) setTitulares(tits.data ?? [])
    })
  }, [])

  const totales = useMemo(() => {
    const ingresos = movimientos.filter(m => m.importe > 0)
    const gastos = movimientos.filter(m => m.importe < 0)
    const pendientes = movimientos.filter(m => calcularEstado(m) === 'pendiente')
    return {
      ingresosCount: ingresos.length,
      ingresosImporte: ingresos.reduce((s, m) => s + m.importe, 0),
      gastosCount: gastos.length,
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
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [movimientos, filtroCard, filtroTitular, catFiltro, busqueda, titulares])

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

  return (
    <div>
      {/* 4 CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>

        {/* Card INGRESOS */}
        <div
          onClick={() => { setFiltroCard(prev => prev === 'ingresos' ? null : 'ingresos'); setPage(1) }}
          style={{
            background: '#fff',
            border: filtroCard === 'ingresos' ? '1px solid #FF4757' : '0.5px solid #d0c8bc',
            borderRadius: 14,
            padding: '18px 20px',
            cursor: 'pointer',
            boxShadow: filtroCard === 'ingresos' ? '0 0 0 3px #FF475715' : 'none',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }}>Ingresos</span>
            <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090' }}>{totales.ingresosCount} movs</span>
          </div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 30, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', margin: '6px 0 4px', color: '#1D9E75' }}>
            +{fmtEur(totales.ingresosImporte)}
          </div>
          <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090', marginTop: 10 }}>
            Bruto del periodo · click para filtrar
          </div>
        </div>

        {/* Card GASTOS */}
        <div
          onClick={() => { setFiltroCard(prev => prev === 'gastos' ? null : 'gastos'); setPage(1) }}
          style={{
            background: '#fff',
            border: filtroCard === 'gastos' ? '1px solid #FF4757' : '0.5px solid #d0c8bc',
            borderRadius: 14,
            padding: '18px 20px',
            cursor: 'pointer',
            boxShadow: filtroCard === 'gastos' ? '0 0 0 3px #FF475715' : 'none',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }}>Gastos</span>
            <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090' }}>{totales.gastosCount} movs</span>
          </div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 30, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', margin: '6px 0 4px', color: '#E24B4A' }}>
            -{fmtEur(totales.gastosImporte)}
          </div>
          <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090', marginTop: 10 }}>
            Total gasto · click para filtrar
          </div>
        </div>

        {/* Card PENDIENTES */}
        <div
          onClick={() => { setFiltroCard(prev => prev === 'pendientes' ? null : 'pendientes'); setPage(1) }}
          style={{
            background: '#fff',
            border: filtroCard === 'pendientes' ? '1px solid #FF4757' : '0.5px solid #d0c8bc',
            borderRadius: 14,
            padding: '18px 20px',
            cursor: 'pointer',
            boxShadow: filtroCard === 'pendientes' ? '0 0 0 3px #FF475715' : 'none',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }}>Pendientes</span>
            <span style={{ background: '#F26B1F', color: '#fff', padding: '1px 8px', borderRadius: 9, fontSize: 10, fontWeight: 500, fontFamily: 'Lexend, sans-serif' }}>
              {totales.pendientesCount}
            </span>
          </div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 30, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', margin: '6px 0 4px', color: '#F26B1F' }}>
            {fmtEur(totales.pendientesImporte)}
          </div>
          <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090', marginTop: 10 }}>
            Sin asociar · click para filtrar
          </div>
        </div>

        {/* Card TITULAR */}
        <div style={{ background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }}>Titular</span>
            <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090' }}>filtro activo</span>
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

      {/* TABLA 8 COLUMNAS */}
      <div style={{ background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 900, fontFamily: 'Lexend, sans-serif', fontSize: 13 }}>
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
                      padding: '14px 16px',
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
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '32px 16px', textAlign: 'center', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#7a8090' }}>
                    Sin movimientos en este rango
                  </td>
                </tr>
              ) : paginated.map((m, idx) => {
                const isLast = idx === paginated.length - 1
                const tdBase: React.CSSProperties = { padding: '14px 16px', borderBottom: isLast ? 'none' : '0.5px solid #ebe8e2', verticalAlign: 'middle' }
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
                    <td style={{ ...tdBase, color: '#111', maxWidth: 200 }}>
                      {m.concepto.length > 40 ? m.concepto.slice(0, 40) + '…' : m.concepto}
                    </td>
                    <td style={{ ...tdBase, color: m.contraparte ? '#111' : '#7a8090' }}>
                      {m.contraparte || 'Sin identificar'}
                    </td>
                    <td style={{ ...tdBase, textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: 14, fontWeight: 500, letterSpacing: '0.5px', color: m.importe >= 0 ? '#1D9E75' : '#E24B4A' }}>
                      {m.importe >= 0 ? '+' : ''}{fmtEur(m.importe)}
                    </td>
                    <td style={tdBase}>
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
                      {m.doc_estado === 'tiene' || (m.factura_id && m.factura_data?.pdf_drive_url) ? (
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
            <div style={{ display: 'flex', gap: 6 }}>
              <button disabled={currentPage === 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={{ padding: '6px 10px', borderRadius: 8, border: '0.5px solid #d0c8bc', background: '#fff', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#111', cursor: 'pointer' }}>‹</button>
              <button disabled={currentPage === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={{ padding: '6px 10px', borderRadius: 8, border: '0.5px solid #d0c8bc', background: '#fff', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#111', cursor: 'pointer' }}>›</button>
            </div>
          )}
        </div>
      </div>

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
