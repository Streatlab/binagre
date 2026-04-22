import { useMemo, useState, type CSSProperties } from 'react'
import {
  Plus,
  Upload,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Paperclip,
  Pencil,
  Trash2,
  FileText,
  Filter,
  ChevronDown,
  UploadCloud,
} from 'lucide-react'
import { fmtEur } from '@/utils/format'

/* ═══════════════════════════════════════════════════════════
   PALETA LOCAL (Conciliación)
   ═══════════════════════════════════════════════════════════ */

const P = {
  app:       '#2e3347',
  card:      '#484f66',
  inp:       '#3a4058',
  inpRo:     '#333848',
  rowOdd:    '#484f66',
  rowEven:   '#404558',
  thead:     '#353a50',
  brd:       '#4a5270',
  focus:     '#e8f442',
  pri:       '#f0f0ff',
  sec:       '#c8d0e8',
  mut:       '#7080a8',
  accent:    '#e8f442',
  red:       '#B01D23',
  green:     '#06C167',
  amber:     '#f5a623',
  blue:      '#66aaff',
  pink:      '#ff6b70',
}

const FONT_BODY = 'Lexend, sans-serif'
const FONT_HEAD = 'Oswald, sans-serif'

/* ═══════════════════════════════════════════════════════════
   TIPOS
   ═══════════════════════════════════════════════════════════ */

type Categoria =
  | 'Ingresos plataformas'
  | 'Proveedores'
  | 'RRHH'
  | 'Alquiler'
  | 'Suministros'
  | 'Marketing'
  | 'Otros'

type Estado = 'CONCILIADO' | 'PENDIENTE' | 'SIN FACTURA'

interface Movimiento {
  id: number
  fecha: string
  concepto: string
  importe: number
  categoria: Categoria
  proveedor: string
  factura: boolean
  estado: Estado
}

/* ═══════════════════════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════════════════════ */

const MOCK_MOVIMIENTOS: Movimiento[] = [
  { id: 1,  fecha: '2026-04-21', concepto: 'Liquidación Uber Eats semana 16',  importe:  3284.55, categoria: 'Ingresos plataformas', proveedor: 'Uber Eats',      factura: true,  estado: 'CONCILIADO'  },
  { id: 2,  fecha: '2026-04-20', concepto: 'Liquidación Glovo semana 16',      importe:  2145.30, categoria: 'Ingresos plataformas', proveedor: 'Glovo',          factura: true,  estado: 'CONCILIADO'  },
  { id: 3,  fecha: '2026-04-19', concepto: 'Pedido Alcampo producto fresco',   importe:  -428.92, categoria: 'Proveedores',           proveedor: 'Alcampo',        factura: true,  estado: 'CONCILIADO'  },
  { id: 4,  fecha: '2026-04-18', concepto: 'Nómina cocinero jefe',             importe: -1850.00, categoria: 'RRHH',                  proveedor: 'Nóminas',        factura: true,  estado: 'CONCILIADO'  },
  { id: 5,  fecha: '2026-04-18', concepto: 'Alquiler local abril',             importe: -2400.00, categoria: 'Alquiler',              proveedor: 'Inmobiliaria SL',factura: true,  estado: 'CONCILIADO'  },
  { id: 6,  fecha: '2026-04-17', concepto: 'Luz Iberdrola marzo',              importe:  -612.40, categoria: 'Suministros',           proveedor: 'Iberdrola',      factura: true,  estado: 'CONCILIADO'  },
  { id: 7,  fecha: '2026-04-16', concepto: 'Pedido Mercadona stock semanal',   importe:  -284.15, categoria: 'Proveedores',           proveedor: 'Mercadona',      factura: false, estado: 'SIN FACTURA' },
  { id: 8,  fecha: '2026-04-15', concepto: 'Liquidación Just Eat semana 15',   importe:  1820.75, categoria: 'Ingresos plataformas', proveedor: 'Just Eat',       factura: true,  estado: 'CONCILIADO'  },
  { id: 9,  fecha: '2026-04-14', concepto: 'Pedido Jasa carnes',               importe:  -786.20, categoria: 'Proveedores',           proveedor: 'Jasa',           factura: true,  estado: 'PENDIENTE'   },
  { id: 10, fecha: '2026-04-14', concepto: 'Pedido Pampols pescado',           importe:  -542.80, categoria: 'Proveedores',           proveedor: 'Pampols',        factura: true,  estado: 'CONCILIADO'  },
  { id: 11, fecha: '2026-04-13', concepto: 'Envapro packaging abril',          importe:  -368.90, categoria: 'Proveedores',           proveedor: 'Envapro',        factura: false, estado: 'SIN FACTURA' },
  { id: 12, fecha: '2026-04-12', concepto: 'Liquidación Uber Eats semana 15',  importe:  2956.40, categoria: 'Ingresos plataformas', proveedor: 'Uber Eats',      factura: true,  estado: 'CONCILIADO'  },
  { id: 13, fecha: '2026-04-11', concepto: 'Pedido Pascual lácteos',           importe:  -192.45, categoria: 'Proveedores',           proveedor: 'Pascual',        factura: true,  estado: 'CONCILIADO'  },
  { id: 14, fecha: '2026-04-10', concepto: 'Campaña Instagram Ads',            importe:  -320.00, categoria: 'Marketing',             proveedor: 'Meta Ads',       factura: true,  estado: 'CONCILIADO'  },
  { id: 15, fecha: '2026-04-09', concepto: 'Pedido Lidl complementos',         importe:  -156.30, categoria: 'Proveedores',           proveedor: 'Lidl',           factura: false, estado: 'SIN FACTURA' },
  { id: 16, fecha: '2026-04-08', concepto: 'Liquidación Glovo semana 14',      importe:  1987.20, categoria: 'Ingresos plataformas', proveedor: 'Glovo',          factura: true,  estado: 'CONCILIADO'  },
  { id: 17, fecha: '2026-04-07', concepto: 'Nómina ayudante cocina',           importe: -1320.00, categoria: 'RRHH',                  proveedor: 'Nóminas',        factura: true,  estado: 'CONCILIADO'  },
  { id: 18, fecha: '2026-04-06', concepto: 'Agua Canal de Isabel II',          importe:   -78.50, categoria: 'Suministros',           proveedor: 'Canal II',       factura: true,  estado: 'PENDIENTE'   },
  { id: 19, fecha: '2026-04-05', concepto: 'Liquidación Just Eat semana 14',   importe:  1654.85, categoria: 'Ingresos plataformas', proveedor: 'Just Eat',       factura: true,  estado: 'CONCILIADO'  },
  { id: 20, fecha: '2026-04-04', concepto: 'Pedido Alcampo reposición',        importe:  -389.40, categoria: 'Proveedores',           proveedor: 'Alcampo',        factura: true,  estado: 'CONCILIADO'  },
  { id: 21, fecha: '2026-04-03', concepto: 'Gas Naturgy marzo',                importe:  -248.10, categoria: 'Suministros',           proveedor: 'Naturgy',        factura: true,  estado: 'CONCILIADO'  },
  { id: 22, fecha: '2026-04-02', concepto: 'Pedido Jasa pollo',                importe:  -524.70, categoria: 'Proveedores',           proveedor: 'Jasa',           factura: false, estado: 'SIN FACTURA' },
  { id: 23, fecha: '2026-04-01', concepto: 'Reparación horno cocina',          importe:  -185.00, categoria: 'Otros',                 proveedor: 'Técnico SAT',    factura: true,  estado: 'PENDIENTE'   },
  { id: 24, fecha: '2026-03-31', concepto: 'Liquidación Uber Eats semana 13',  importe:  3102.60, categoria: 'Ingresos plataformas', proveedor: 'Uber Eats',      factura: true,  estado: 'CONCILIADO'  },
  { id: 25, fecha: '2026-03-30', concepto: 'Google Ads marzo',                 importe:  -210.00, categoria: 'Marketing',             proveedor: 'Google Ads',     factura: true,  estado: 'CONCILIADO'  },
]

const CATEGORIAS: Categoria[] = ['Ingresos plataformas', 'Proveedores', 'RRHH', 'Alquiler', 'Suministros', 'Marketing', 'Otros']

const CAT_COLORS: Record<Categoria, string> = {
  'Ingresos plataformas': '#06C167',
  'Proveedores':           '#66aaff',
  'RRHH':                  '#f5a623',
  'Alquiler':              '#B01D23',
  'Suministros':           '#ff6b70',
  'Marketing':             '#e8f442',
  'Otros':                 '#9aa0c0',
}

const PROVEEDORES_UNICOS = Array.from(new Set(MOCK_MOVIMIENTOS.map(m => m.proveedor))).sort()

/* ═══════════════════════════════════════════════════════════
   ESTILOS
   ═══════════════════════════════════════════════════════════ */

const labelStyle: CSSProperties = {
  fontFamily: FONT_HEAD,
  fontSize: 11,
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
  color: P.sec,
  marginBottom: 6,
  display: 'block',
}

const inputStyle: CSSProperties = {
  width: '100%',
  backgroundColor: P.inp,
  color: P.pri,
  border: `1px solid ${P.brd}`,
  borderRadius: 6,
  padding: '9px 12px',
  fontSize: 13,
  fontFamily: FONT_BODY,
  outline: 'none',
  minHeight: 40,
}

const btnPrimary: CSSProperties = {
  backgroundColor: P.accent,
  color: '#1a1a1a',
  fontFamily: FONT_HEAD,
  letterSpacing: '1px',
  padding: '9px 16px',
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  minHeight: 40,
  fontSize: 12,
  textTransform: 'uppercase' as const,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
}

const btnOutline: CSSProperties = {
  background: 'none',
  color: P.sec,
  border: `1px solid ${P.brd}`,
  fontFamily: FONT_HEAD,
  letterSpacing: '1px',
  padding: '9px 16px',
  borderRadius: 6,
  cursor: 'pointer',
  minHeight: 40,
  fontSize: 12,
  textTransform: 'uppercase' as const,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
}

const btnSave: CSSProperties = {
  backgroundColor: P.red,
  color: '#ffffff',
  fontFamily: FONT_HEAD,
  letterSpacing: '1px',
  padding: '9px 24px',
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  minHeight: 40,
  fontSize: 12,
  textTransform: 'uppercase' as const,
}

const btnCancel: CSSProperties = {
  backgroundColor: '#555e7a',
  color: P.pri,
  fontFamily: FONT_HEAD,
  letterSpacing: '1px',
  padding: '9px 24px',
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  minHeight: 40,
  fontSize: 12,
  textTransform: 'uppercase' as const,
}

/* ═══════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function Conciliacion() {
  const [periodo, setPeriodo]     = useState('Este mes')
  const [categoria, setCategoria] = useState<'Todas' | Categoria>('Todas')
  const [estado, setEstado]       = useState<'Todos' | Estado>('Todos')
  const [proveedor, setProveedor] = useState<string>('Todos')
  const [busqueda, setBusqueda]   = useState('')

  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const [panelAbierto,    setPanelAbierto]    = useState(false)

  const [modalNuevo,    setModalNuevo]    = useState(false)
  const [modalImportar, setModalImportar] = useState(false)

  /* — filtrado — */
  const filtrados = useMemo(() => {
    return MOCK_MOVIMIENTOS.filter(m => {
      if (categoria !== 'Todas' && m.categoria !== categoria) return false
      if (estado    !== 'Todos' && m.estado    !== estado)    return false
      if (proveedor !== 'Todos' && m.proveedor !== proveedor) return false
      if (busqueda && !m.concepto.toLowerCase().includes(busqueda.toLowerCase())) return false
      return true
    })
  }, [categoria, estado, proveedor, busqueda])

  /* — KPIs — */
  const ingresos = filtrados.filter(m => m.importe > 0).reduce((a, m) => a + m.importe, 0)
  const gastos   = filtrados.filter(m => m.importe < 0).reduce((a, m) => a + m.importe, 0)
  const balance  = ingresos + gastos
  const pendientes = filtrados.filter(m => m.estado !== 'CONCILIADO').length

  /* — Mocks de variación — */
  const varIngresos = 12.4
  const varGastos   = -3.2

  /* — Resumen por categoría — */
  const resumenCategorias = useMemo(() => {
    const totales: Record<string, number> = {}
    filtrados.forEach(m => {
      if (m.importe < 0) totales[m.categoria] = (totales[m.categoria] ?? 0) + Math.abs(m.importe)
    })
    const totalGastos = Object.values(totales).reduce((a, b) => a + b, 0) || 1
    return Object.entries(totales)
      .map(([cat, total]) => ({ cat, total, pct: (total / totalGastos) * 100 }))
      .sort((a, b) => b.total - a.total)
  }, [filtrados])

  /* — Top proveedores — */
  const topProveedores = useMemo(() => {
    const totales: Record<string, number> = {}
    filtrados.forEach(m => {
      if (m.importe < 0) totales[m.proveedor] = (totales[m.proveedor] ?? 0) + Math.abs(m.importe)
    })
    return Object.entries(totales)
      .map(([prov, total]) => ({ prov, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [filtrados])

  const facturasPendientes = filtrados.filter(m => !m.factura).length

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */

  return (
    <div style={{ background: P.app, minHeight: '100%', margin: -24, padding: 24, color: P.pri, fontFamily: FONT_BODY }}>

      {/* ═══ HEADER ═══ */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: FONT_HEAD, fontSize: 24, letterSpacing: '3px', textTransform: 'uppercase', color: P.pri, fontWeight: 600, margin: 0 }}>
            Conciliación Bancaria
          </h1>
          <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: P.sec, marginTop: 4 }}>
            Movimientos, categorización y control de facturas
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button style={btnPrimary} onClick={() => setModalNuevo(true)}>
            <Plus size={16} strokeWidth={2.2} /> Nuevo movimiento
          </button>
          <button style={btnOutline} onClick={() => setModalImportar(true)}>
            <Upload size={16} strokeWidth={2} /> Importar extracto
          </button>
        </div>
      </div>

      {/* ═══ FILTROS (toggle móvil) ═══ */}
      <button
        onClick={() => setFiltrosAbiertos(v => !v)}
        style={{ ...btnOutline, marginBottom: 12, width: '100%', justifyContent: 'space-between' }}
        className="flex lg:!hidden"
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Filter size={14} /> Filtros
        </span>
        <ChevronDown size={14} style={{ transform: filtrosAbiertos ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
      </button>

      <div
        className={filtrosAbiertos ? 'grid' : 'hidden lg:grid'}
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 10,
          marginBottom: 20,
          background: P.card,
          border: `1px solid ${P.brd}`,
          borderRadius: 10,
          padding: 14,
        }}
      >
        <div>
          <label style={labelStyle}>Período</label>
          <select value={periodo} onChange={e => setPeriodo(e.target.value)} style={inputStyle}>
            <option>Este mes</option>
            <option>Mes anterior</option>
            <option>Trimestre</option>
            <option>Año</option>
            <option>Rango custom</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Categoría</label>
          <select value={categoria} onChange={e => setCategoria(e.target.value as any)} style={inputStyle}>
            <option>Todas</option>
            {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Estado</label>
          <select value={estado} onChange={e => setEstado(e.target.value as any)} style={inputStyle}>
            <option>Todos</option>
            <option>CONCILIADO</option>
            <option>PENDIENTE</option>
            <option>SIN FACTURA</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Proveedor</label>
          <select value={proveedor} onChange={e => setProveedor(e.target.value)} style={inputStyle}>
            <option>Todos</option>
            {PROVEEDORES_UNICOS.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={labelStyle}>Buscar concepto</label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: P.mut }} />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Ej: Uber, Alcampo..."
              style={{ ...inputStyle, paddingLeft: 32 }}
            />
          </div>
        </div>
      </div>

      {/* ═══ KPIs ═══ */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14,
          marginBottom: 20,
        }}
      >
        <KPICard label="Ingresos mes" value={fmtEur(ingresos)} color={P.green} variacion={varIngresos} />
        <KPICard label="Gastos mes"   value={fmtEur(Math.abs(gastos))} color={P.red} variacion={varGastos} />
        <KPICard label="Balance neto" value={fmtEur(balance)} color={balance >= 0 ? P.green : P.red} />
        <KPICard label="Pendientes conciliar" value={String(pendientes)} color={P.amber} subtitle="movimientos" />
      </div>

      {/* ═══ GRID PRINCIPAL: TABLA + PANEL LATERAL ═══ */}
      <div className="grid gap-5" style={{ gridTemplateColumns: '1fr', alignItems: 'flex-start' }}>
        <div className="lg:grid lg:gap-5" style={{ gridTemplateColumns: 'minmax(0, 1fr) 320px', display: 'grid', gap: 20 }}>

          {/* ─── TABLA ─── */}
          <div style={{ background: P.card, border: `1px solid ${P.brd}`, borderRadius: 10, overflow: 'hidden', minWidth: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr style={{ background: P.thead }}>
                    {['Fecha', 'Concepto', 'Importe', 'Categoría', 'Proveedor', 'Factura', 'Estado', 'Acciones'].map(h => (
                      <th
                        key={h}
                        style={{
                          fontFamily: FONT_HEAD,
                          fontSize: 11,
                          letterSpacing: '1.5px',
                          textTransform: 'uppercase',
                          color: P.sec,
                          padding: '12px 14px',
                          textAlign: h === 'Importe' ? 'right' : 'left',
                          whiteSpace: 'nowrap',
                          borderBottom: `1px solid ${P.brd}`,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((m, i) => (
                    <tr key={m.id} style={{ background: i % 2 === 0 ? P.rowOdd : P.rowEven }}>
                      <td style={tdStyle}>{formatFecha(m.fecha)}</td>
                      <td style={{ ...tdStyle, color: P.pri }}>{m.concepto}</td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: 'right',
                          color: m.importe >= 0 ? P.green : P.red,
                          fontFamily: FONT_HEAD,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {m.importe >= 0 ? '+' : ''}{fmtEur(m.importe)}
                      </td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: 4,
                            background: CAT_COLORS[m.categoria] + '22',
                            color: CAT_COLORS[m.categoria],
                            fontFamily: FONT_HEAD,
                            fontSize: 10,
                            letterSpacing: '1px',
                            textTransform: 'uppercase',
                            border: `1px solid ${CAT_COLORS[m.categoria]}55`,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {m.categoria}
                        </span>
                      </td>
                      <td style={tdStyle}>{m.proveedor}</td>
                      <td style={tdStyle}>
                        {m.factura ? (
                          <a href="#" onClick={e => e.preventDefault()} style={{ color: P.green, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                            <CheckCircle2 size={14} /> <span style={{ fontSize: 11 }}>Ver</span>
                          </a>
                        ) : (
                          <span style={{ color: P.amber, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <AlertTriangle size={14} /> <span style={{ fontSize: 11 }}>Falta</span>
                          </span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <EstadoBadge estado={m.estado} />
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <IconBtn title="Editar"><Pencil size={14} /></IconBtn>
                          <IconBtn title="Adjuntar factura"><Paperclip size={14} /></IconBtn>
                          <IconBtn title="Eliminar" danger><Trash2 size={14} /></IconBtn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: P.thead }}>
                    <td colSpan={2} style={{ ...tdStyle, fontFamily: FONT_HEAD, textTransform: 'uppercase', letterSpacing: '1px', color: P.sec, fontSize: 11 }}>
                      Totales filtrados ({filtrados.length} movimientos)
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ color: P.green, fontFamily: FONT_HEAD, fontWeight: 600 }}>+{fmtEur(ingresos)}</div>
                      <div style={{ color: P.red, fontFamily: FONT_HEAD, fontWeight: 600 }}>{fmtEur(gastos)}</div>
                      <div style={{ color: balance >= 0 ? P.green : P.red, fontFamily: FONT_HEAD, fontWeight: 700, borderTop: `1px solid ${P.brd}`, paddingTop: 4, marginTop: 4 }}>
                        = {fmtEur(balance)}
                      </div>
                    </td>
                    <td colSpan={5} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ─── PANEL LATERAL (acordeón en móvil) ─── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>

            <button
              onClick={() => setPanelAbierto(v => !v)}
              style={{ ...btnOutline, width: '100%', justifyContent: 'space-between' }}
              className="flex lg:!hidden"
            >
              <span>Resumen</span>
              <ChevronDown size={14} style={{ transform: panelAbierto ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
            </button>

            <div className={panelAbierto ? 'flex flex-col gap-4' : 'hidden lg:flex lg:flex-col lg:gap-4'}>

              {/* Resumen por categoría */}
              <div style={panelCardStyle}>
                <h3 style={panelTitleStyle}>Resumen por categoría</h3>
                {resumenCategorias.length === 0 && <div style={{ color: P.mut, fontSize: 12 }}>Sin datos</div>}
                {resumenCategorias.map(r => (
                  <div key={r.cat} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: P.sec, marginBottom: 4 }}>
                      <span>{r.cat}</span>
                      <span style={{ color: P.pri, fontFamily: FONT_HEAD }}>{r.pct.toFixed(0)}%</span>
                    </div>
                    <div style={{ height: 6, background: P.inpRo, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${r.pct}%`, background: CAT_COLORS[r.cat as Categoria], transition: 'width 0.4s' }} />
                    </div>
                    <div style={{ fontSize: 11, color: P.mut, marginTop: 3, textAlign: 'right' }}>{fmtEur(r.total)}</div>
                  </div>
                ))}
              </div>

              {/* Top proveedores */}
              <div style={panelCardStyle}>
                <h3 style={panelTitleStyle}>Top 5 proveedores</h3>
                {topProveedores.length === 0 && <div style={{ color: P.mut, fontSize: 12 }}>Sin datos</div>}
                {topProveedores.map((p, i) => (
                  <div key={p.prov} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < topProveedores.length - 1 ? `1px solid ${P.brd}` : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 4, background: P.inp, color: P.sec, fontSize: 11, fontFamily: FONT_HEAD, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {i + 1}
                      </div>
                      <span style={{ color: P.pri, fontSize: 13 }}>{p.prov}</span>
                    </div>
                    <span style={{ color: P.red, fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 13 }}>{fmtEur(p.total)}</span>
                  </div>
                ))}
              </div>

              {/* Facturas pendientes */}
              <div style={{ ...panelCardStyle, borderColor: P.red + '66' }}>
                <h3 style={panelTitleStyle}>Facturas pendientes</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      background: P.red,
                      color: '#ffffff',
                      fontFamily: FONT_HEAD,
                      fontSize: 18,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {facturasPendientes}
                  </div>
                  <div style={{ fontSize: 12, color: P.sec }}>
                    movimientos sin factura adjunta
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* ═══ MODAL NUEVO MOVIMIENTO ═══ */}
      {modalNuevo && (
        <ModalShell onClose={() => setModalNuevo(false)} title="Nuevo movimiento">
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <div>
              <label style={labelStyle}>Fecha</label>
              <input type="date" defaultValue="2026-04-22" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Importe</label>
              <input type="number" placeholder="0,00" style={inputStyle} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Concepto</label>
            <input placeholder="Ej: Pedido Alcampo" style={inputStyle} />
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginTop: 12 }}>
            <div>
              <label style={labelStyle}>Categoría</label>
              <select style={inputStyle}>{CATEGORIAS.map(c => <option key={c}>{c}</option>)}</select>
            </div>
            <div>
              <label style={labelStyle}>Proveedor</label>
              <select style={inputStyle}>{PROVEEDORES_UNICOS.map(p => <option key={p}>{p}</option>)}</select>
            </div>
            <div>
              <label style={labelStyle}>Estado</label>
              <select style={inputStyle}>
                <option>CONCILIADO</option>
                <option>PENDIENTE</option>
                <option>SIN FACTURA</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Notas</label>
            <textarea rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Observaciones opcionales..." />
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Adjuntar factura</label>
            <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <Paperclip size={14} color={P.mut} />
              <span style={{ color: P.mut, fontSize: 13 }}>Seleccionar archivo…</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button style={btnCancel} onClick={() => setModalNuevo(false)}>Cancelar</button>
            <button style={btnSave}   onClick={() => setModalNuevo(false)}>Guardar</button>
          </div>
        </ModalShell>
      )}

      {/* ═══ MODAL IMPORTAR EXTRACTO ═══ */}
      {modalImportar && (
        <ModalShell onClose={() => setModalImportar(false)} title="Importar extracto bancario">
          <div
            style={{
              border: `2px dashed ${P.brd}`,
              borderRadius: 10,
              padding: '40px 20px',
              textAlign: 'center',
              background: P.inpRo,
              cursor: 'pointer',
            }}
          >
            <UploadCloud size={56} color={P.sec} style={{ margin: '0 auto 14px' }} />
            <div style={{ color: P.pri, fontFamily: FONT_HEAD, letterSpacing: '1px', fontSize: 14, textTransform: 'uppercase', marginBottom: 8 }}>
              Arrastra tu extracto aquí
            </div>
            <div style={{ color: P.sec, fontSize: 13 }}>
              o haz click para seleccionar un archivo CSV / XLSX
            </div>
            <div style={{ marginTop: 18, display: 'inline-flex', alignItems: 'center', gap: 8, color: P.mut, fontSize: 12, background: P.card, padding: '6px 12px', borderRadius: 16, border: `1px solid ${P.brd}` }}>
              <FileText size={12} /> La lógica de parseo se activa en la tanda 3/3
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button style={btnCancel} onClick={() => setModalImportar(false)}>Cancelar</button>
            <button style={{ ...btnSave, opacity: 0.45, cursor: 'not-allowed' }} disabled>Continuar</button>
          </div>
        </ModalShell>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   SUBCOMPONENTES
   ═══════════════════════════════════════════════════════════ */

function KPICard({ label, value, color, variacion, subtitle }: { label: string; value: string; color: string; variacion?: number; subtitle?: string }) {
  return (
    <div style={{ background: P.card, border: `1px solid ${P.brd}`, borderRadius: 10, padding: '14px 18px', minHeight: 92 }}>
      <div style={{ fontFamily: FONT_HEAD, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: P.sec, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: FONT_HEAD, fontSize: 26, fontWeight: 600, color, lineHeight: 1 }}>
        {value}
      </div>
      {variacion !== undefined && (
        <div style={{ fontSize: 11, color: variacion >= 0 ? P.green : P.red, marginTop: 8, fontFamily: FONT_BODY }}>
          {variacion >= 0 ? '▲' : '▼'} {Math.abs(variacion).toFixed(1)}% vs mes ant.
        </div>
      )}
      {subtitle && (
        <div style={{ fontSize: 11, color: P.mut, marginTop: 8 }}>{subtitle}</div>
      )}
    </div>
  )
}

function EstadoBadge({ estado }: { estado: Estado }) {
  const cfg: Record<Estado, { bg: string; color: string; icon: React.ReactNode }> = {
    CONCILIADO:   { bg: P.green + '22', color: P.green, icon: <CheckCircle2 size={12} /> },
    PENDIENTE:    { bg: P.amber + '22', color: P.amber, icon: <AlertTriangle size={12} /> },
    'SIN FACTURA':{ bg: P.red + '22',   color: P.red,   icon: <XCircle size={12} /> },
  }
  const c = cfg[estado]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 9px',
        borderRadius: 4,
        background: c.bg,
        color: c.color,
        fontFamily: FONT_HEAD,
        fontSize: 10,
        letterSpacing: '1px',
        border: `1px solid ${c.color}55`,
        whiteSpace: 'nowrap',
      }}
    >
      {c.icon} {estado}
    </span>
  )
}

function IconBtn({ children, title, danger }: { children: React.ReactNode; title: string; danger?: boolean }) {
  return (
    <button
      title={title}
      style={{
        width: 30,
        height: 30,
        borderRadius: 5,
        background: P.inp,
        border: `1px solid ${P.brd}`,
        color: danger ? P.red : P.sec,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </button>
  )
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#484f66',
          border: `1px solid ${P.brd}`,
          borderRadius: 12,
          width: '100%',
          maxWidth: 560,
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontFamily: FONT_HEAD, fontSize: 18, letterSpacing: '2px', textTransform: 'uppercase', color: P.pri, fontWeight: 600, margin: 0 }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: P.mut, cursor: 'pointer', fontSize: 20, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   ESTILOS TABLA + PANEL
   ═══════════════════════════════════════════════════════════ */

const tdStyle: CSSProperties = {
  padding: '11px 14px',
  fontSize: 13,
  fontFamily: FONT_BODY,
  color: P.sec,
  borderBottom: `1px solid ${P.brd}55`,
  whiteSpace: 'nowrap',
}

const panelCardStyle: CSSProperties = {
  background: P.card,
  border: `1px solid ${P.brd}`,
  borderRadius: 10,
  padding: 16,
}

const panelTitleStyle: CSSProperties = {
  fontFamily: FONT_HEAD,
  fontSize: 12,
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
  color: P.sec,
  margin: '0 0 12px 0',
  fontWeight: 500,
}

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

function formatFecha(s: string): string {
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y.slice(2)}`
}
