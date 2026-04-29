import React, { useMemo, useState } from 'react'
import { fmtEur } from '@/utils/format'
import CardFiltro from './CardFiltro'
import TagFiltroActivo from './TagFiltroActivo'
import ModalDetalleMovimiento from './ModalDetalleMovimiento'
import type { Movimiento } from '@/types/conciliacion'

interface TabMovimientosProps {
  movimientos: Movimiento[]
  periodoLabel: string
}

type FiltroTipo = 'ingresos' | 'gastos' | 'pendientes' | null

const DROPDOWN_BTN: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '0.5px solid #d0c8bc',
  background: '#ffffff',
  fontSize: 13,
  fontFamily: 'Lexend, sans-serif',
  color: '#111111',
  cursor: 'pointer',
}

const TH: React.CSSProperties = {
  fontFamily: 'Oswald, sans-serif',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
  color: '#7a8090',
  padding: '12px 16px',
  textAlign: 'left',
  background: '#ebe8e2',
  whiteSpace: 'nowrap',
}

function getBadgeStyle(codigo: string | null): React.CSSProperties {
  if (!codigo) return {}
  const prefix = codigo.split('-')[0]
  const colors: Record<string, string> = {
    PRD: '#7B4F2A',
    EQP: '#4A5980',
    LOC: '#5A8A6F',
    CTR: '#A87C3D',
    PLT: '#06C167',
    ING: '#1D9E75',
    INT: '#7a8090',
  }
  const bg = colors[prefix] ?? '#7a8090'
  return {
    display: 'inline-block',
    padding: '1px 6px',
    borderRadius: 3,
    background: bg,
    color: '#ffffff',
    fontFamily: 'Oswald, sans-serif',
    fontSize: 9,
    fontWeight: 500,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  }
}

function fmtFecha(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

const PAGE_SIZE = 25

export default function TabMovimientos({ movimientos, periodoLabel }: TabMovimientosProps) {
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>(() => {
    const pendientes = movimientos.filter(m => !m.categoria_id).length
    return pendientes > 0 ? 'pendientes' : null
  })
  const [busqueda, setBusqueda] = useState('')
  const [catFiltro, setCatFiltro] = useState('todas')
  const [page, setPage] = useState(1)
  const [modalMov, setModalMov] = useState<Movimiento | null>(null)

  // Contadores por tipo
  const totales = useMemo(() => {
    const ingresos = movimientos.filter(m => m.importe > 0)
    const gastos = movimientos.filter(m => m.importe < 0)
    const pendientes = movimientos.filter(m => !m.categoria_id)
    return {
      ingresosCount: ingresos.length,
      ingresosImporte: ingresos.reduce((s, m) => s + m.importe, 0),
      gastosCount: gastos.length,
      gastosImporte: Math.abs(gastos.reduce((s, m) => s + m.importe, 0)),
      pendientesCount: pendientes.length,
      pendientesImporte: Math.abs(pendientes.reduce((s, m) => s + m.importe, 0)),
    }
  }, [movimientos])

  // Filtrado
  const filtrados = useMemo(() => {
    return movimientos
      .filter(m => {
        if (filtroTipo === 'ingresos') return m.importe > 0
        if (filtroTipo === 'gastos') return m.importe < 0
        if (filtroTipo === 'pendientes') return !m.categoria_id
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
  }, [movimientos, filtroTipo, catFiltro, busqueda])

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtrados.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function handleFiltroClick(tipo: FiltroTipo) {
    setFiltroTipo(prev => prev === tipo ? null : tipo)
    setPage(1)
  }

  const filtroLabel = filtroTipo === 'ingresos' ? 'Ingresos'
    : filtroTipo === 'gastos' ? 'Gastos'
    : filtroTipo === 'pendientes' ? 'Pendientes'
    : ''

  return (
    <div>
      {/* Tag filtro activo */}
      {filtroTipo && (
        <TagFiltroActivo
          label={filtroLabel}
          count={filtrados.length}
          onRemove={() => { setFiltroTipo(null); setPage(1) }}
        />
      )}

      {/* 3 Cards filtro */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
        <CardFiltro
          tipo="ingresos"
          count={totales.ingresosCount}
          importe={totales.ingresosImporte}
          active={filtroTipo === 'ingresos'}
          onClick={() => handleFiltroClick('ingresos')}
        />
        <CardFiltro
          tipo="gastos"
          count={totales.gastosCount}
          importe={totales.gastosImporte}
          active={filtroTipo === 'gastos'}
          onClick={() => handleFiltroClick('gastos')}
        />
        <CardFiltro
          tipo="pendientes"
          count={totales.pendientesCount}
          importe={totales.pendientesImporte}
          active={filtroTipo === 'pendientes'}
          onClick={() => handleFiltroClick('pendientes')}
        />
      </div>

      {/* Buscador */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
        <input
          value={busqueda}
          onChange={e => { setBusqueda(e.target.value); setPage(1) }}
          placeholder="Buscar proveedor / nº factura / importe / concepto"
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '0.5px solid #d0c8bc',
            borderRadius: 8,
            fontFamily: 'Lexend, sans-serif',
            fontSize: 13,
            background: '#ffffff',
            color: '#3a4050',
            outline: 'none',
          }}
        />
        <select
          value={catFiltro}
          onChange={e => { setCatFiltro(e.target.value); setPage(1) }}
          style={DROPDOWN_BTN}
        >
          <option value="todas">Categoría ▾</option>
          {Array.from(new Set(movimientos.map(m => m.categoria_id).filter(Boolean))).map(c => (
            <option key={c!} value={c!}>{c}</option>
          ))}
        </select>
        <select style={DROPDOWN_BTN}>
          <option>Exportar ▾</option>
          <option value="csv">CSV</option>
          <option value="excel">Excel</option>
          <option value="pdf">PDF</option>
        </select>
      </div>

      {/* Tabla */}
      <div style={{
        background: '#ffffff',
        border: '0.5px solid #d0c8bc',
        borderRadius: 16,
        padding: 0,
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr>
                <th style={TH}>Fecha</th>
                <th style={TH}>Concepto</th>
                <th style={TH}>Contraparte</th>
                <th style={{ ...TH, textAlign: 'right' }}>Importe</th>
                <th style={TH}>Categoría</th>
                <th style={{ ...TH, textAlign: 'center' }}>Doc</th>
                <th style={{ ...TH, textAlign: 'center' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{
                    padding: '32px 16px',
                    textAlign: 'center',
                    fontFamily: 'Lexend, sans-serif',
                    fontSize: 13,
                    color: '#7a8090',
                  }}>
                    Sin movimientos en este rango
                  </td>
                </tr>
              ) : paginated.map((m, idx) => {
                const esUltima = idx === paginated.length - 1
                const tdStyle: React.CSSProperties = {
                  padding: '12px 16px',
                  fontFamily: 'Lexend, sans-serif',
                  fontSize: 13,
                  borderBottom: esUltima ? 'none' : '0.5px solid #ebe8e2',
                  color: '#111111',
                }
                const cuadrado = !!m.categoria_id && (!!m.factura_id || m.importe > 0)
                const tieneDoc = !!(m.factura_id && m.factura_data?.pdf_drive_url)
                const faltaDoc = !!m.categoria_id && !m.factura_id && m.importe < 0

                return (
                  <tr
                    key={m.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setModalMov(m)}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#fafaf7' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}
                  >
                    <td style={{ ...tdStyle, color: '#3a4050' }}>{fmtFecha(m.fecha)}</td>
                    <td style={{ ...tdStyle, whiteSpace: 'normal', maxWidth: 260 }}>{m.concepto}</td>
                    <td style={{ ...tdStyle, color: '#7a8090' }}>
                      {m.contraparte || 'Sin identificar'}
                    </td>
                    <td style={{
                      ...tdStyle,
                      textAlign: 'right',
                      color: m.importe >= 0 ? '#1D9E75' : '#E24B4A',
                      fontWeight: 500,
                    }}>
                      {m.importe >= 0 ? '+' : ''}{fmtEur(m.importe)}
                    </td>
                    <td style={tdStyle}>
                      {m.categoria_id ? (
                        <span style={getBadgeStyle(m.categoria_id)}>{m.categoria_id}</span>
                      ) : (
                        <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, fontStyle: 'italic', color: '#7a8090' }}>
                          Sin categoría
                        </span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {tieneDoc ? (
                        <span
                          title="Ver factura en Drive"
                          onClick={e => { e.stopPropagation(); window.open(m.factura_data!.pdf_drive_url!, '_blank') }}
                          style={{ fontSize: 16, cursor: 'pointer', color: '#1D9E75' }}
                        >📄</span>
                      ) : faltaDoc ? (
                        <span style={{ fontSize: 15, color: '#E24B4A' }}>📎❌</span>
                      ) : (
                        <span style={{ color: '#cfcfcf', fontSize: 13 }}>—</span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {cuadrado ? (
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 9,
                          background: '#1D9E7515',
                          color: '#1D9E75',
                          fontFamily: 'Lexend, sans-serif',
                          fontSize: 10,
                          fontWeight: 500,
                        }}>CUADRADO</span>
                      ) : (
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 9,
                          background: '#FF4757',
                          color: '#ffffff',
                          fontFamily: 'Lexend, sans-serif',
                          fontSize: 10,
                          fontWeight: 500,
                        }}>PENDIENTE</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer paginación */}
        <div style={{
          padding: '14px 16px',
          borderTop: '0.5px solid #d0c8bc',
          background: '#fafaf7',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#7a8090' }}>
            Mostrando {paginated.length} de {filtrados.length} movimientos
          </span>
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                style={DROPDOWN_BTN}
                disabled={currentPage === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >‹ Anterior</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  style={p === currentPage ? {
                    ...DROPDOWN_BTN,
                    background: '#FF4757',
                    color: '#ffffff',
                    border: 'none',
                  } : DROPDOWN_BTN}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
              <button
                style={DROPDOWN_BTN}
                disabled={currentPage === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >Siguiente ›</button>
            </div>
          )}
        </div>
      </div>

      {/* Modal detalle */}
      <ModalDetalleMovimiento
        movimiento={modalMov}
        onClose={() => setModalMov(null)}
      />
    </div>
  )
}
