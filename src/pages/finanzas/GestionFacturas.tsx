/**
 * GestionFacturas — Vista listado tipo Drive con filtros por titular,
 * categoría y búsqueda. Estructura copiada de PanelGlobal/Conciliación.
 *
 * Spec: árbol Titular → Año → Trimestre → Mes a la izquierda,
 * tabla de facturas a la derecha, una sola fila de filtros encima.
 */

import { useState, useMemo, useCallback, type CSSProperties } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  COLORS,
  FONT,
  TABS_PILL,
  SUBTABS,
  DROPDOWN_BTN,
  fmtDec,
} from '@/components/panel/resumen/tokens'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'
import TabsPastilla from '@/components/ui/TabsPastilla'
import SubTabsInverso from '@/components/ui/SubTabsInverso'

/* ── Tipos ─────────────────────────────────────────── */
type TabId = 'resumen' | 'facturas' | 'drive' | 'exportar'
type TitularId = 'todos' | 'ruben' | 'emilio'

interface FacturaMock {
  id: string
  fecha: string          // ISO
  proveedor: string
  importe: number
  categoria: string
  titular: 'ruben' | 'emilio'
  doc: 'pdf' | 'falta'
  estado: 'conciliada' | 'pendiente' | 'sin_doc'
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'resumen',  label: 'Resumen' },
  { id: 'facturas', label: 'Facturas' },
  { id: 'drive',    label: 'Drive' },
  { id: 'exportar', label: 'Exportar' },
]

const TITULARES: Array<{ id: TitularId; label: string }> = [
  { id: 'todos',  label: 'Todos' },
  { id: 'ruben',  label: 'Rubén' },
  { id: 'emilio', label: 'Emilio' },
]

/* Mock provisional — reemplazar por hook de Supabase en siguiente iteración */
const FACTURAS_MOCK: FacturaMock[] = [
  { id: '1', fecha: '2026-05-02', proveedor: 'Makro Iberia',     importe: 487.32,  categoria: '2.1 Materia prima',   titular: 'ruben',  doc: 'pdf',   estado: 'conciliada' },
  { id: '2', fecha: '2026-05-04', proveedor: 'Mahou San Miguel', importe: 312.80,  categoria: '2.2 Bebidas',         titular: 'emilio', doc: 'pdf',   estado: 'conciliada' },
  { id: '3', fecha: '2026-05-07', proveedor: 'Endesa',           importe: 894.15,  categoria: '3.1 Luz',             titular: 'ruben',  doc: 'pdf',   estado: 'pendiente'  },
  { id: '4', fecha: '2026-05-09', proveedor: 'Frutas Hnos. Ruiz',importe: 156.40,  categoria: '2.1 Materia prima',   titular: 'ruben',  doc: 'pdf',   estado: 'conciliada' },
  { id: '5', fecha: '2026-05-12', proveedor: 'Disbesa',          importe: 1240.00, categoria: '2.1 Materia prima',   titular: 'emilio', doc: 'pdf',   estado: 'conciliada' },
  { id: '6', fecha: '2026-05-15', proveedor: 'Rushour Holding',  importe: 2180.90, categoria: '4.1 Comisiones',      titular: 'ruben',  doc: 'falta', estado: 'sin_doc'    },
  { id: '7', fecha: '2026-05-18', proveedor: 'Mercadona',        importe: 88.47,   categoria: '2.11.1 Mercadona',    titular: 'ruben',  doc: 'pdf',   estado: 'conciliada' },
]

const CATEGORIAS = [
  'Todas las categorías',
  '1. Ingresos',
  '   1.1 Ventas',
  '      1.1.1 Uber Eats',
  '      1.1.2 Glovo',
  '      1.1.3 Just Eat',
  '      1.1.4 Tienda online',
  '2. Materia prima y bebidas',
  '   2.1 Materia prima',
  '   2.2 Bebidas',
  '   2.11 Compras minoristas',
  '      2.11.1 Mercadona',
  '      2.11.2 Alcampo',
  '      2.11.5 Lidl',
  '3. Suministros',
  '   3.1 Luz',
  '   3.2 Agua',
  '   3.3 Gas',
  '4. Plataformas y comisiones',
  '   4.1 Comisiones plataformas',
  '5. Personal',
  '6. Alquiler',
]

/* ── Helpers ───────────────────────────────────────── */
function fmtFechaCorta(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

function colorTitular(t: 'ruben' | 'emilio'): string {
  return t === 'ruben' ? COLORS.ruben : COLORS.emilio
}

function labelTitular(t: 'ruben' | 'emilio'): string {
  return t === 'ruben' ? 'Rubén' : 'Emilio'
}

/* ── Estado pill ───────────────────────────────────── */
function PillEstado({ estado }: { estado: FacturaMock['estado'] }) {
  const cfg = {
    conciliada: { bg: '#e8f5ec', col: COLORS.ok,    txt: 'CONCILIADA' },
    pendiente:  { bg: '#fcf0dc', col: COLORS.warn,  txt: 'PENDIENTE'  },
    sin_doc:    { bg: '#fce8e8', col: COLORS.redSL, txt: 'SIN DOC'    },
  }[estado]
  return (
    <span style={{
      background: cfg.bg,
      color: cfg.col,
      fontFamily: FONT.heading,
      fontSize: 9,
      letterSpacing: '0.5px',
      padding: '2px 8px',
      borderRadius: 9,
      fontWeight: 500,
    }}>
      {cfg.txt}
    </span>
  )
}

/* ── Componente principal ──────────────────────────── */
export default function GestionFacturas() {
  const [activeTab, setActiveTab]   = useState<TabId>('facturas')
  const [titular, setTitular]       = useState<TitularId>('todos')
  const [busqueda, setBusqueda]     = useState('')
  const [categoria, setCategoria]   = useState('Todas las categorías')
  const [periodoLabel, setPeriodoLabel] = useState('Mes en curso')
  const [, setFechaDesde]           = useState<Date>(() => new Date(2026, 4, 1))
  const [, setFechaHasta]           = useState<Date>(() => new Date(2026, 4, 31))

  const handleFecha = useCallback((desde: Date, hasta: Date, label: string) => {
    setFechaDesde(desde)
    setFechaHasta(hasta)
    setPeriodoLabel(label)
  }, [])

  /* Filtrado */
  const facturasFiltradas = useMemo(() => {
    return FACTURAS_MOCK
      .filter(f => titular === 'todos' || f.titular === titular)
      .filter(f => {
        if (categoria === 'Todas las categorías') return true
        return f.categoria.includes(categoria.trim())
      })
      .filter(f => {
        if (!busqueda) return true
        const q = busqueda.toLowerCase()
        return (
          f.proveedor.toLowerCase().includes(q) ||
          f.categoria.toLowerCase().includes(q) ||
          String(f.importe).includes(q)
        )
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [titular, busqueda, categoria])

  const totalImporte = facturasFiltradas.reduce((s, f) => s + f.importe, 0)

  /* ── Estilos tabla (copiados de Conciliación) ── */
  const thStyle: CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 10,
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: COLORS.mut,
    padding: '10px 12px',
    textAlign: 'left',
    background: COLORS.group,
    borderBottom: `0.5px solid ${COLORS.brd}`,
    fontWeight: 400,
    whiteSpace: 'nowrap',
  }

  const tdStyle: CSSProperties = {
    padding: '10px 12px',
    fontSize: 13,
    fontFamily: FONT.body,
    color: COLORS.pri,
    borderBottom: `0.5px solid ${COLORS.brd}`,
    whiteSpace: 'nowrap',
  }

  return (
    <div style={{ background: COLORS.bg, padding: '24px 28px', minHeight: '100%' }}>

      {/* HEADER */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 18,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div>
          <h2 style={{
            color: COLORS.redSL,
            fontFamily: FONT.heading,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '3px',
            margin: 0,
            textTransform: 'uppercase',
          }}>
            GESTIÓN DE FACTURAS
          </h2>
          <span style={{
            fontFamily: FONT.body,
            fontSize: 13,
            color: COLORS.mut,
            display: 'block',
            marginTop: 4,
          }}>
            {periodoLabel}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <SelectorFechaUniversal
            nombreModulo="gestion_facturas"
            defaultOpcion="mes_en_curso"
            onChange={handleFecha}
          />
        </div>
      </div>

      {/* TABS PRINCIPALES */}
      <TabsPastilla
        tabs={TABS}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as TabId)}
      />

      {/* Sólo pintamos el contenido de la tab Facturas (las demás son placeholders) */}
      {activeTab === 'facturas' && (
        <>
          {/* FILA ÚNICA: titular + buscador + dropdown categorías + exportar */}
          <div style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            marginTop: 14,
            marginBottom: 14,
            flexWrap: 'wrap',
          }}>
            {/* Toggle titular — usa SubTabsInverso (gris oscuro = el invertido) */}
            <SubTabsInverso
              tabs={TITULARES}
              activeId={titular}
              onChange={(id) => setTitular(id as TitularId)}
              prefijoLbl="Titular"
            />

            {/* Buscador */}
            <input
              type="text"
              placeholder="Buscar proveedor, NIF, importe…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{
                flex: 1,
                minWidth: 220,
                height: 32,
                padding: '0 12px',
                borderRadius: 8,
                border: `0.5px solid ${COLORS.brd}`,
                background: COLORS.card,
                fontSize: 13,
                fontFamily: FONT.body,
                color: COLORS.pri,
                outline: 'none',
              }}
            />

            {/* Dropdown categorías */}
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              style={{
                ...DROPDOWN_BTN,
                minWidth: 220,
                height: 32,
                paddingRight: 28,
                cursor: 'pointer',
              }}
            >
              {CATEGORIAS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Botón exportar — cambia a tab Exportar */}
            <button
              onClick={() => setActiveTab('exportar')}
              style={{
                height: 32,
                padding: '0 16px',
                borderRadius: 8,
                border: 'none',
                background: COLORS.redSL,
                color: '#fff',
                fontSize: 13,
                fontFamily: FONT.body,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              Exportar →
            </button>
          </div>

          {/* LAYOUT: Drive izquierda + tabla derecha */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '240px 1fr',
            gap: 14,
          }}>

            {/* Drive simulado */}
            <div style={{
              background: COLORS.card,
              border: `0.5px solid ${COLORS.brd}`,
              borderRadius: 14,
              padding: 16,
              fontSize: 13,
              fontFamily: FONT.body,
              alignSelf: 'start',
            }}>
              <div style={{
                fontFamily: FONT.heading,
                fontSize: 11,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                color: COLORS.mut,
                fontWeight: 500,
                marginBottom: 12,
              }}>
                Drive
              </div>

              <NodoArbol nombre="Rubén" count={324} expandido level={0} />
              <div style={{ marginLeft: 12 }}>
                <NodoArbol nombre="2026" count={211} expandido level={1} />
                <div style={{ marginLeft: 12 }}>
                  <NodoArbol nombre="T1" count={87}  expandido={false} level={2} />
                  <NodoArbol nombre="T2" count={124} expandido level={2} activo />
                  <div style={{ marginLeft: 14 }}>
                    <NodoArbol nombre="Abril" count={42} level={3} />
                    <NodoArbol nombre="Mayo"  count={58} level={3} seleccionado />
                    <NodoArbol nombre="Junio" count={24} level={3} />
                  </div>
                  <NodoArbol nombre="T3" count={0} level={2} muted />
                  <NodoArbol nombre="T4" count={0} level={2} muted />
                </div>
                <NodoArbol nombre="2025" count={113} level={1} muted />
              </div>

              <div style={{
                borderTop: `0.5px solid ${COLORS.group}`,
                marginTop: 8,
                paddingTop: 8,
              }}>
                <NodoArbol nombre="Emilio" count={523} level={0} />
              </div>
            </div>

            {/* Tabla */}
            <div style={{
              background: COLORS.card,
              border: `0.5px solid ${COLORS.brd}`,
              borderRadius: 14,
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '14px 18px',
                borderBottom: `0.5px solid ${COLORS.group}`,
              }}>
                <div style={{
                  fontFamily: FONT.heading,
                  fontSize: 10,
                  letterSpacing: '1.5px',
                  color: COLORS.mut,
                  textTransform: 'uppercase',
                }}>
                  {titular === 'todos' ? 'Todos los titulares' : labelTitular(titular as 'ruben' | 'emilio')} · {periodoLabel}
                </div>
                <div style={{
                  fontFamily: FONT.body,
                  fontSize: 14,
                  fontWeight: 500,
                  color: COLORS.pri,
                  marginTop: 2,
                }}>
                  {facturasFiltradas.length} facturas · {fmtDec(totalImporte, 2)} €
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Fecha</th>
                      <th style={thStyle}>Proveedor</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Importe</th>
                      <th style={thStyle}>Categoría</th>
                      <th style={thStyle}>Titular</th>
                      <th style={thStyle}>Doc</th>
                      <th style={thStyle}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturasFiltradas.map(f => (
                      <tr key={f.id}>
                        <td style={tdStyle}>{fmtFechaCorta(f.fecha)}</td>
                        <td style={tdStyle}>{f.proveedor}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 500 }}>
                          {fmtDec(f.importe, 2)}
                        </td>
                        <td style={tdStyle}>
                          <span style={{
                            background: COLORS.bg,
                            fontSize: 11,
                            padding: '3px 9px',
                            borderRadius: 4,
                            border: `0.5px solid ${COLORS.brd}`,
                            fontFamily: FONT.body,
                            color: COLORS.sec,
                          }}>
                            {f.categoria}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, fontSize: 12 }}>
                          <span style={{ color: colorTitular(f.titular) }}>
                            ● {labelTitular(f.titular)}
                          </span>
                        </td>
                        <td style={{
                          ...tdStyle,
                          color: f.doc === 'pdf' ? COLORS.ok : COLORS.err,
                          fontWeight: 500,
                          fontSize: 12,
                        }}>
                          {f.doc === 'pdf' ? 'PDF' : '—'}
                        </td>
                        <td style={tdStyle}>
                          <PillEstado estado={f.estado} />
                        </td>
                      </tr>
                    ))}
                    {facturasFiltradas.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{
                          ...tdStyle,
                          textAlign: 'center',
                          color: COLORS.mut,
                          padding: '40px 12px',
                        }}>
                          Sin facturas para los filtros seleccionados
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{
                padding: '12px 18px',
                borderTop: `0.5px solid ${COLORS.group}`,
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                fontFamily: FONT.body,
                color: COLORS.mut,
              }}>
                <span>Mostrando {facturasFiltradas.length} de {facturasFiltradas.length}</span>
                <span>‹ 1 ›</span>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab !== 'facturas' && (
        <div style={{
          marginTop: 24,
          padding: 60,
          textAlign: 'center',
          background: COLORS.card,
          border: `0.5px solid ${COLORS.brd}`,
          borderRadius: 14,
          color: COLORS.mut,
          fontFamily: FONT.body,
          fontSize: 14,
        }}>
          {TABS.find(t => t.id === activeTab)?.label} · Próximamente
        </div>
      )}

    </div>
  )
}

/* ── Nodo árbol Drive ──────────────────────────────── */
interface NodoArbolProps {
  nombre: string
  count: number
  level: number
  expandido?: boolean
  activo?: boolean
  seleccionado?: boolean
  muted?: boolean
}

function NodoArbol({ nombre, count, expandido, activo, seleccionado, muted }: NodoArbolProps) {
  const flecha = expandido === undefined ? '' : (expandido ? '▾ ' : '▸ ')

  const style: CSSProperties = {
    padding: '4px 6px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontFamily: FONT.body,
    fontSize: 13,
    color: muted ? '#aaa' : (activo || seleccionado ? COLORS.redSL : COLORS.pri),
    fontWeight: activo || seleccionado ? 500 : 400,
    background: activo ? '#FF475715' : 'transparent',
    borderLeft: activo ? `3px solid ${COLORS.redSL}` : '3px solid transparent',
    borderRadius: activo ? '0 4px 4px 0' : 0,
    marginLeft: activo ? -3 : 0,
    cursor: 'pointer',
  }

  return (
    <div style={style}>
      <span>
        {seleccionado ? '● ' : flecha}{nombre}
      </span>
      <span style={{ color: COLORS.mut, fontSize: 11 }}>
        {count > 0 ? count : '—'}
      </span>
    </div>
  )
}
