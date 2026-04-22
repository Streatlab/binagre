import { useMemo, useState, type CSSProperties } from 'react'
import { Upload, Search, Pencil, Zap } from 'lucide-react'
import { fmtEur } from '@/utils/format'
import { useTheme, FONT, LAYOUT } from '@/styles/tokens'
import { KpiCard } from '@/components/KpiCard'
import { ResumenDashboard } from '@/components/conciliacion/ResumenDashboard'
import type { Movimiento, Categoria, Regla } from '@/types/conciliacion'

/* ═══════════════════════════════════════════════════════════
   CATEGORÍAS
   ═══════════════════════════════════════════════════════════ */

const CATEGORIAS: Categoria[] = [
  { id: 'ing-plat', nombre: 'Ingresos plataformas', tipo: 'ingreso', color: '#06C167' },
  { id: 'prov',     nombre: 'Proveedores',          tipo: 'gasto',   color: '#66aaff' },
  { id: 'rrhh',     nombre: 'RRHH',                 tipo: 'gasto',   color: '#f5a623' },
  { id: 'alq',      nombre: 'Alquiler',             tipo: 'gasto',   color: '#B01D23' },
  { id: 'sum',      nombre: 'Suministros',          tipo: 'gasto',   color: '#ff6b70' },
  { id: 'mkt',      nombre: 'Marketing',            tipo: 'gasto',   color: '#FF4757' },
  { id: 'otros',    nombre: 'Otros',                tipo: 'mixto',   color: '#9aa0c0' },
]

const CAT_BY_ID: Record<string, Categoria> = Object.fromEntries(CATEGORIAS.map(c => [c.id, c]))

/* ═══════════════════════════════════════════════════════════
   MOCK MOVIMIENTOS (60 en 90 días)
   ═══════════════════════════════════════════════════════════ */

function daysAgo(n: number): string {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - n)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const MOCK: Movimiento[] = [
  /* Uber Eats — patrón "uber" repetido; primeros sin cat para demo regla */
  { id: '1',  fecha: daysAgo(1),  concepto: 'Liquidación Uber Eats semana 16', importe: 3284.55, categoria_id: null,       contraparte: 'Uber Eats' },
  { id: '2',  fecha: daysAgo(8),  concepto: 'Liquidación Uber Eats semana 15', importe: 2956.40, categoria_id: null,       contraparte: 'Uber Eats' },
  { id: '3',  fecha: daysAgo(15), concepto: 'Liquidación Uber Eats semana 14', importe: 3102.60, categoria_id: null,       contraparte: 'Uber Eats' },
  { id: '4',  fecha: daysAgo(22), concepto: 'Liquidación Uber Eats semana 13', importe: 2845.80, categoria_id: null,       contraparte: 'Uber Eats' },
  { id: '5',  fecha: daysAgo(29), concepto: 'Liquidación Uber Eats semana 12', importe: 3125.10, categoria_id: 'ing-plat', contraparte: 'Uber Eats' },
  { id: '52', fecha: daysAgo(38), concepto: 'Liquidación Uber Eats semana 11', importe: 2768.40, categoria_id: 'ing-plat', contraparte: 'Uber Eats' },
  { id: '53', fecha: daysAgo(45), concepto: 'Liquidación Uber Eats semana 10', importe: 2890.20, categoria_id: 'ing-plat', contraparte: 'Uber Eats' },

  /* Glovo */
  { id: '6',  fecha: daysAgo(2),  concepto: 'Liquidación Glovo semana 16', importe: 2145.30, categoria_id: 'ing-plat', contraparte: 'Glovo' },
  { id: '7',  fecha: daysAgo(9),  concepto: 'Liquidación Glovo semana 15', importe: 1987.20, categoria_id: 'ing-plat', contraparte: 'Glovo' },
  { id: '8',  fecha: daysAgo(16), concepto: 'Liquidación Glovo semana 14', importe: 2254.75, categoria_id: 'ing-plat', contraparte: 'Glovo' },
  { id: '9',  fecha: daysAgo(23), concepto: 'Liquidación Glovo semana 13', importe: 2012.90, categoria_id: 'ing-plat', contraparte: 'Glovo' },
  { id: '54', fecha: daysAgo(40), concepto: 'Liquidación Glovo semana 12', importe: 2098.60, categoria_id: 'ing-plat', contraparte: 'Glovo' },
  { id: '55', fecha: daysAgo(47), concepto: 'Liquidación Glovo semana 11', importe: 1956.80, categoria_id: 'ing-plat', contraparte: 'Glovo' },

  /* Just Eat */
  { id: '10', fecha: daysAgo(6),  concepto: 'Liquidación Just Eat semana 16', importe: 1820.75, categoria_id: 'ing-plat', contraparte: 'Just Eat' },
  { id: '11', fecha: daysAgo(13), concepto: 'Liquidación Just Eat semana 15', importe: 1654.85, categoria_id: 'ing-plat', contraparte: 'Just Eat' },
  { id: '12', fecha: daysAgo(20), concepto: 'Liquidación Just Eat semana 14', importe: 1745.30, categoria_id: 'ing-plat', contraparte: 'Just Eat' },

  /* Pedido Alcampo — patrón "alcampo" repetido */
  { id: '13', fecha: daysAgo(3),  concepto: 'Pedido Alcampo producto fresco', importe: -428.92, categoria_id: null,   contraparte: 'Alcampo' },
  { id: '14', fecha: daysAgo(10), concepto: 'Pedido Alcampo producto fresco', importe: -389.40, categoria_id: null,   contraparte: 'Alcampo' },
  { id: '15', fecha: daysAgo(17), concepto: 'Pedido Alcampo reposición',      importe: -512.70, categoria_id: 'prov', contraparte: 'Alcampo' },
  { id: '16', fecha: daysAgo(24), concepto: 'Pedido Alcampo producto fresco', importe: -402.15, categoria_id: null,   contraparte: 'Alcampo' },
  { id: '56', fecha: daysAgo(37), concepto: 'Pedido Alcampo producto fresco', importe: -415.60, categoria_id: null,   contraparte: 'Alcampo' },

  /* Jasa */
  { id: '17', fecha: daysAgo(4),  concepto: 'Pedido Jasa carnes', importe: -786.20, categoria_id: 'prov', contraparte: 'Jasa' },
  { id: '18', fecha: daysAgo(11), concepto: 'Pedido Jasa pollo',  importe: -524.70, categoria_id: 'prov', contraparte: 'Jasa' },
  { id: '19', fecha: daysAgo(25), concepto: 'Pedido Jasa cerdo',  importe: -687.35, categoria_id: 'prov', contraparte: 'Jasa' },
  { id: '57', fecha: daysAgo(44), concepto: 'Pedido Jasa carnes', importe: -720.45, categoria_id: 'prov', contraparte: 'Jasa' },

  /* Mercadona */
  { id: '20', fecha: daysAgo(5),  concepto: 'Pedido Mercadona stock semanal', importe: -284.15, categoria_id: 'prov', contraparte: 'Mercadona' },
  { id: '21', fecha: daysAgo(12), concepto: 'Pedido Mercadona complementos',  importe: -198.50, categoria_id: null,   contraparte: 'Mercadona' },
  { id: '22', fecha: daysAgo(26), concepto: 'Pedido Mercadona stock semanal', importe: -305.80, categoria_id: 'prov', contraparte: 'Mercadona' },

  /* Pampols */
  { id: '23', fecha: daysAgo(7),  concepto: 'Pedido Pampols pescado', importe: -542.80, categoria_id: 'prov', contraparte: 'Pampols' },
  { id: '24', fecha: daysAgo(14), concepto: 'Pedido Pampols marisco', importe: -385.20, categoria_id: 'prov', contraparte: 'Pampols' },
  { id: '25', fecha: daysAgo(28), concepto: 'Pedido Pampols pescado', importe: -498.90, categoria_id: 'prov', contraparte: 'Pampols' },

  /* Envapro */
  { id: '26', fecha: daysAgo(9),  concepto: 'Envapro packaging abril', importe: -368.90, categoria_id: 'prov', contraparte: 'Envapro' },
  { id: '27', fecha: daysAgo(30), concepto: 'Envapro packaging marzo', importe: -345.70, categoria_id: 'prov', contraparte: 'Envapro' },

  /* Pascual */
  { id: '28', fecha: daysAgo(13), concepto: 'Pedido Pascual lácteos', importe: -192.45, categoria_id: 'prov', contraparte: 'Pascual' },
  { id: '29', fecha: daysAgo(27), concepto: 'Pedido Pascual lácteos', importe: -178.30, categoria_id: 'prov', contraparte: 'Pascual' },

  /* Lidl */
  { id: '30', fecha: daysAgo(16), concepto: 'Pedido Lidl complementos', importe: -156.30, categoria_id: null, contraparte: 'Lidl' },

  /* RRHH */
  { id: '31', fecha: daysAgo(4),  concepto: 'Nómina cocinero jefe',       importe: -1850.00, categoria_id: 'rrhh', contraparte: 'Nóminas' },
  { id: '32', fecha: daysAgo(4),  concepto: 'Nómina ayudante cocina',     importe: -1320.00, categoria_id: 'rrhh', contraparte: 'Nóminas' },
  { id: '33', fecha: daysAgo(4),  concepto: 'Nómina encargado sala',      importe: -1680.00, categoria_id: 'rrhh', contraparte: 'Nóminas' },
  { id: '34', fecha: daysAgo(35), concepto: 'Nómina cocinero jefe marzo', importe: -1850.00, categoria_id: 'rrhh', contraparte: 'Nóminas' },
  { id: '35', fecha: daysAgo(35), concepto: 'Nómina ayudante cocina mar', importe: -1320.00, categoria_id: 'rrhh', contraparte: 'Nóminas' },

  /* Alquiler */
  { id: '36', fecha: daysAgo(4),  concepto: 'Alquiler local abril',   importe: -2400.00, categoria_id: 'alq', contraparte: 'Inmobiliaria SL' },
  { id: '37', fecha: daysAgo(34), concepto: 'Alquiler local marzo',   importe: -2400.00, categoria_id: 'alq', contraparte: 'Inmobiliaria SL' },
  { id: '38', fecha: daysAgo(64), concepto: 'Alquiler local febrero', importe: -2400.00, categoria_id: 'alq', contraparte: 'Inmobiliaria SL' },

  /* Suministros */
  { id: '39', fecha: daysAgo(5),  concepto: 'Luz Iberdrola marzo',         importe: -612.40, categoria_id: 'sum', contraparte: 'Iberdrola' },
  { id: '40', fecha: daysAgo(35), concepto: 'Luz Iberdrola febrero',       importe: -589.20, categoria_id: 'sum', contraparte: 'Iberdrola' },
  { id: '41', fecha: daysAgo(18), concepto: 'Agua Canal de Isabel II',     importe: -78.50,  categoria_id: 'sum', contraparte: 'Canal II' },
  { id: '42', fecha: daysAgo(48), concepto: 'Agua Canal de Isabel II feb', importe: -82.30,  categoria_id: 'sum', contraparte: 'Canal II' },
  { id: '43', fecha: daysAgo(21), concepto: 'Gas Naturgy marzo',           importe: -248.10, categoria_id: 'sum', contraparte: 'Naturgy' },
  { id: '44', fecha: daysAgo(51), concepto: 'Gas Naturgy febrero',         importe: -271.50, categoria_id: 'sum', contraparte: 'Naturgy' },
  { id: '45', fecha: daysAgo(19), concepto: 'Teléfono Movistar abril',     importe: -89.90,  categoria_id: 'sum', contraparte: 'Movistar' },

  /* Marketing */
  { id: '46', fecha: daysAgo(14), concepto: 'Campaña Instagram Ads',       importe: -320.00, categoria_id: 'mkt', contraparte: 'Meta Ads' },
  { id: '47', fecha: daysAgo(25), concepto: 'Google Ads marzo',            importe: -210.00, categoria_id: 'mkt', contraparte: 'Google Ads' },
  { id: '48', fecha: daysAgo(42), concepto: 'Campaña Instagram Ads marzo', importe: -280.00, categoria_id: 'mkt', contraparte: 'Meta Ads' },

  /* Otros */
  { id: '49', fecha: daysAgo(22), concepto: 'Reparación horno cocina',      importe: -185.00, categoria_id: 'otros', contraparte: 'Técnico SAT' },
  { id: '50', fecha: daysAgo(45), concepto: 'Mantenimiento freidora',       importe: -120.00, categoria_id: null,    contraparte: 'Técnico SAT' },
  { id: '51', fecha: daysAgo(52), concepto: 'Cambio cerradura',             importe: -75.00,  categoria_id: 'otros', contraparte: 'Cerrajero' },
  { id: '58', fecha: daysAgo(60), concepto: 'Seguro responsabilidad civil', importe: -280.00, categoria_id: 'otros', contraparte: 'Mapfre' },
  { id: '59', fecha: daysAgo(72), concepto: 'Asesoría fiscal febrero',      importe: -250.00, categoria_id: 'otros', contraparte: 'Asesoría XYZ' },
  { id: '60', fecha: daysAgo(85), concepto: 'Devolución depósito fianza',   importe: 800.00,  categoria_id: 'otros', contraparte: 'Banco' },
]

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

const STOP_WORDS = new Set(['liquidacion','pedido','nomina','del','de','la','el','por','para','con','sin','abril','marzo','febrero','enero','semana'])

function extraerPatron(concepto: string): string {
  const w = concepto.toLowerCase().split(/\s+/).find(x => x.length > 3 && !STOP_WORDS.has(x))
  return w ?? concepto.slice(0, 10).toLowerCase()
}

function fmtFecha(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

/* ═══════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════ */

type Tab = 'listado' | 'resumen'
type EstadoFiltro = 'Todos' | 'Categorizado' | 'Sin categorizar'
type PeriodoFiltro = 'Este mes' | 'Mes anterior' | 'Trimestre' | 'Año' | 'Personalizado'

export default function Conciliacion() {
  const { T } = useTheme()

  const [tab, setTab]           = useState<Tab>('listado')
  const [periodo, setPeriodo]   = useState<PeriodoFiltro>('Este mes')
  const [catFiltro, setCatFiltro] = useState<string>('Todas')
  const [estado, setEstado]     = useState<EstadoFiltro>('Todos')
  const [busqueda, setBusqueda] = useState('')
  const [pageOffset, setPageOffset] = useState(0)

  const [movimientos, setMovimientos] = useState<Movimiento[]>(MOCK)
  const [reglas, setReglas] = useState<Regla[]>([])
  void reglas

  /* — Categorización inline + regla automática — */
  const handleCategorizar = (movId: string, catId: string, concepto: string) => {
    const normalizedCat = catId === '' ? null : catId
    setMovimientos(prev => {
      const base = prev.map(m => m.id === movId ? { ...m, categoria_id: normalizedCat, auto_categorizado: false } : m)
      if (!normalizedCat) return base
      const patron = extraerPatron(concepto)
      return base.map(m => {
        if (m.id === movId) return m
        if (!m.categoria_id && m.concepto.toLowerCase().includes(patron)) {
          return { ...m, categoria_id: normalizedCat, auto_categorizado: true }
        }
        return m
      })
    })
    if (normalizedCat) {
      const patron = extraerPatron(concepto)
      setReglas(prev => [...prev, { patron, categoria_id: normalizedCat }])
    }
  }

  /* — Filtros globales (aplican a ambas pestañas) — */
  const filtrados = useMemo(() => {
    return movimientos.filter(m => {
      if (catFiltro !== 'Todas' && m.categoria_id !== catFiltro) return false
      if (estado === 'Categorizado' && m.categoria_id === null) return false
      if (estado === 'Sin categorizar' && m.categoria_id !== null) return false
      if (busqueda && !m.concepto.toLowerCase().includes(busqueda.toLowerCase())) return false
      return true
    })
  }, [movimientos, catFiltro, estado, busqueda])

  /* — Paginación 31 días (solo listado) — */
  const { listadoPagina, rangoTexto } = useMemo(() => {
    const hoy = new Date()
    hoy.setHours(12, 0, 0, 0)
    const fin = new Date(hoy); fin.setDate(hoy.getDate() - 31 * pageOffset)
    const ini = new Date(fin); ini.setDate(fin.getDate() - 30)
    const isoIni = ini.toISOString().slice(0, 10)
    const isoFin = fin.toISOString().slice(0, 10)
    const lista = filtrados.filter(m => m.fecha >= isoIni && m.fecha <= isoFin)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
    return { listadoPagina: lista, rangoTexto: `${fmtFecha(isoIni)} – ${fmtFecha(isoFin)}` }
  }, [filtrados, pageOffset])

  /* — KPIs — */
  const ingresos    = filtrados.filter(m => m.importe > 0).reduce((a, m) => a + m.importe, 0)
  const gastos      = filtrados.filter(m => m.importe < 0).reduce((a, m) => a + m.importe, 0)
  const balance     = ingresos + gastos
  const pendientes  = filtrados.filter(m => m.categoria_id === null).length

  /* — Resumen por categoría (panel lateral) — */
  const resumenCategorias = useMemo(() => {
    const totales: Record<string, number> = {}
    for (const m of filtrados) {
      if (m.importe < 0 && m.categoria_id) {
        totales[m.categoria_id] = (totales[m.categoria_id] ?? 0) + Math.abs(m.importe)
      }
    }
    const totalGastos = Object.values(totales).reduce((a, b) => a + b, 0) || 1
    return Object.entries(totales)
      .map(([catId, total]) => ({
        catId,
        nombre: CAT_BY_ID[catId]?.nombre ?? catId,
        color: CAT_BY_ID[catId]?.color ?? T.mut,
        total,
        pct: (total / totalGastos) * 100,
      }))
      .sort((a, b) => b.total - a.total)
  }, [filtrados, T.mut])

  /* ═══════════════════════════════════════════════════════════
     STYLES INLINE
     ═══════════════════════════════════════════════════════════ */

  const labelStyle: CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 11,
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    color: T.mut,
    marginBottom: 6,
    display: 'block',
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    backgroundColor: T.inp,
    color: T.pri,
    border: `1px solid ${T.brd}`,
    borderRadius: 8,
    padding: '9px 12px',
    fontSize: 13,
    fontFamily: FONT.body,
    outline: 'none',
    minHeight: 40,
  }

  const panelCardStyle: CSSProperties = {
    background: T.card,
    border: `0.5px solid ${T.brd}`,
    borderRadius: 10,
    padding: 16,
  }

  const panelTitleStyle: CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 12,
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    color: T.mut,
    margin: '0 0 14px 0',
    fontWeight: 500,
  }

  const thStyle: CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 10,
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: T.mut,
    padding: '10px 12px',
    textAlign: 'left',
    background: T.group,
    borderBottom: `0.5px solid ${T.brd}`,
    fontWeight: 400,
    whiteSpace: 'nowrap',
  }

  const tdStyle: CSSProperties = {
    padding: '10px 12px',
    fontSize: 13,
    fontFamily: FONT.body,
    color: T.pri,
    borderBottom: `0.5px solid ${T.brd}`,
    whiteSpace: 'nowrap',
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */

  return (
    <div style={{ background: T.group, border: `0.5px solid ${T.brd}`, borderRadius: 16, padding: '24px 28px' }}>

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
        <h2 style={{ fontFamily: FONT.heading, ...LAYOUT.pageTitle }}>Conciliación bancaria</h2>
        <button
          style={{
            backgroundColor: '#FF4757',
            color: '#ffffff',
            fontFamily: FONT.heading,
            letterSpacing: '1.5px',
            padding: '9px 16px',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            textTransform: 'uppercase',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Upload size={15} strokeWidth={2} /> Importar extracto
        </button>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${T.brd}`, marginBottom: 18 }}>
        {(['listado', 'resumen'] as Tab[]).map(k => {
          const active = tab === k
          return (
            <button
              key={k}
              onClick={() => setTab(k)}
              style={{
                padding: '8px 18px',
                background: 'none',
                border: 'none',
                borderBottom: active ? `2px solid ${T.accent}` : '2px solid transparent',
                marginBottom: -1,
                color: active ? T.accent : T.mut,
                fontFamily: FONT.heading,
                fontSize: 12,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'color 150ms, border-color 150ms',
              }}
            >
              {k === 'listado' ? 'Movimientos' : 'Resumen'}
            </button>
          )
        })}
      </div>

      {/* FILTROS GLOBALES */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 10,
          background: T.card,
          border: `0.5px solid ${T.brd}`,
          borderRadius: 10,
          padding: 14,
          marginBottom: 18,
        }}
      >
        <div>
          <label style={labelStyle}>Período</label>
          <select value={periodo} onChange={e => setPeriodo(e.target.value as PeriodoFiltro)} style={inputStyle}>
            <option>Este mes</option>
            <option>Mes anterior</option>
            <option>Trimestre</option>
            <option>Año</option>
            <option>Personalizado</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Categoría</label>
          <select value={catFiltro} onChange={e => setCatFiltro(e.target.value)} style={inputStyle}>
            <option value="Todas">Todas</option>
            {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Estado</label>
          <select value={estado} onChange={e => setEstado(e.target.value as EstadoFiltro)} style={inputStyle}>
            <option>Todos</option>
            <option>Categorizado</option>
            <option>Sin categorizar</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Buscar concepto</label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.mut }} />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Ej: Uber, Alcampo..."
              style={{ ...inputStyle, paddingLeft: 32 }}
            />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
        <KpiCard
          label="Ingresos mes"
          value={fmtEur(ingresos)}
          delta={{ value: '+12.4% vs mes anterior', trend: 'up' }}
          accent="success"
        />
        <KpiCard
          label="Gastos mes"
          value={fmtEur(Math.abs(gastos))}
          delta={{ value: '-5.2% vs mes anterior', trend: 'down' }}
          accent="danger"
        />
        <KpiCard
          label="Balance neto"
          value={fmtEur(balance)}
          accent={balance >= 0 ? 'success' : 'danger'}
        />
        <KpiCard
          label="Pendientes categorizar"
          value={pendientes === 0 ? 'Todo al día ✓' : String(pendientes)}
          subtitle={pendientes === 0 ? undefined : 'movimientos'}
          accent="warning"
          highlighted
        />
      </div>

      {tab === 'listado' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 20, alignItems: 'flex-start' }}>

          {/* TABLA */}
          <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 10, overflow: 'hidden', minWidth: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Fecha</th>
                    <th style={thStyle}>Concepto</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Importe</th>
                    <th style={thStyle}>Categoría</th>
                    <th style={thStyle}>Contraparte</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {listadoPagina.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: T.mut, padding: '28px 12px' }}>
                        Sin movimientos en este rango
                      </td>
                    </tr>
                  ) : listadoPagina.map(m => (
                    <tr key={m.id}>
                      <td style={{ ...tdStyle, color: T.sec }}>{fmtFecha(m.fecha)}</td>
                      <td style={{ ...tdStyle, color: T.pri, whiteSpace: 'normal' }}>{m.concepto}</td>
                      <td style={{
                        ...tdStyle,
                        textAlign: 'right',
                        color: m.importe >= 0 ? '#1D9E75' : '#E24B4A',
                        fontFamily: FONT.heading,
                        fontWeight: 600,
                      }}>
                        {m.importe >= 0 ? '+' : ''}{fmtEur(m.importe)}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <select
                            value={m.categoria_id ?? ''}
                            onChange={e => handleCategorizar(m.id, e.target.value, m.concepto)}
                            style={{
                              backgroundColor: T.inp,
                              color: m.categoria_id ? T.pri : T.mut,
                              border: `1px solid ${m.categoria_id ? T.brd : '#f5a623'}`,
                              borderRadius: 6,
                              padding: '4px 8px',
                              fontFamily: FONT.heading,
                              fontSize: 11,
                              letterSpacing: '1px',
                              textTransform: 'uppercase',
                              cursor: 'pointer',
                              outline: 'none',
                            }}
                          >
                            <option value="">— Categorizar —</option>
                            {CATEGORIAS.map(c => (
                              <option key={c.id} value={c.id}>{c.nombre}</option>
                            ))}
                          </select>
                          {m.auto_categorizado && (
                            <Zap size={12} color="#f5a623" aria-label="Auto: regla aplicada" />
                          )}
                        </div>
                      </td>
                      <td style={{ ...tdStyle, color: T.sec }}>{m.contraparte}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <button
                          title="Editar"
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            background: T.inp,
                            border: `1px solid ${T.brd}`,
                            color: T.sec,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Pencil size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PAGINACIÓN */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              padding: '12px 16px',
              borderTop: `1px solid ${T.brd}`,
            }}>
              <span style={{ color: T.mut, fontSize: 12, fontFamily: FONT.body }}>
                Mostrando {rangoTexto} · {listadoPagina.length} movimientos
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setPageOffset(o => o + 1)}
                  style={{
                    padding: '6px 12px',
                    background: T.inp,
                    color: T.pri,
                    borderRadius: 6,
                    border: `1px solid ${T.brd}`,
                    fontFamily: FONT.heading,
                    fontSize: 11,
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => setPageOffset(o => Math.max(0, o - 1))}
                  disabled={pageOffset === 0}
                  style={{
                    padding: '6px 12px',
                    background: T.inp,
                    color: T.pri,
                    borderRadius: 6,
                    border: `1px solid ${T.brd}`,
                    fontFamily: FONT.heading,
                    fontSize: 11,
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    cursor: pageOffset === 0 ? 'not-allowed' : 'pointer',
                    opacity: pageOffset === 0 ? 0.4 : 1,
                  }}
                >
                  Siguiente →
                </button>
              </div>
            </div>
          </div>

          {/* PANEL LATERAL: RESUMEN CATEGORÍA */}
          <aside style={{ minWidth: 0 }}>
            <div style={panelCardStyle}>
              <h3 style={panelTitleStyle}>Resumen por categoría</h3>
              {resumenCategorias.length === 0 && (
                <div style={{ color: T.mut, fontSize: 12 }}>Sin datos</div>
              )}
              {resumenCategorias.map(r => (
                <div key={r.catId} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: T.sec, marginBottom: 4 }}>
                    <span>{r.nombre}</span>
                    <span style={{ color: T.pri, fontFamily: FONT.heading }}>{r.pct.toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 6, background: T.inp, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${r.pct}%`, background: r.color, transition: 'width 0.4s' }} />
                  </div>
                  <div style={{ fontSize: 11, color: T.mut, marginTop: 3, textAlign: 'right' }}>{fmtEur(r.total)}</div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      ) : (
        <ResumenDashboard movimientos={filtrados} categorias={CATEGORIAS} />
      )}
    </div>
  )
}
