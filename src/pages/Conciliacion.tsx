import { useMemo, useState, type CSSProperties } from 'react'
import { Search, Zap } from 'lucide-react'
import { fmtEur } from '@/utils/format'
import { useTheme, FONT, tabActiveStyle, tabInactiveStyle } from '@/styles/tokens'
import { KpiCard } from '@/components/KpiCard'
import { ResumenDashboard } from '@/components/conciliacion/ResumenDashboard'
import ImportDropzone, { type ParsedRow } from '@/components/conciliacion/ImportDropzone'
import type { Movimiento, Categoria, Regla } from '@/types/conciliacion'

/* ═══════════════════════════════════════════════════════════
   CATEGORÍAS
   ═══════════════════════════════════════════════════════════ */

const CATEGORIAS: Categoria[] = [
  { id: 'ing-plat', nombre: 'Ingresos plataformas', tipo: 'ingreso', color: '#06C167' },
  { id: 'ing-web',  nombre: 'Ingresos web directa', tipo: 'ingreso', color: '#1D9E75' },
  { id: 'prov',     nombre: 'Proveedores',          tipo: 'gasto',   color: '#66aaff' },
  { id: 'rrhh',     nombre: 'RRHH',                 tipo: 'gasto',   color: '#f5a623' },
  { id: 'alq',      nombre: 'Alquiler',             tipo: 'gasto',   color: '#B01D23' },
  { id: 'sum',      nombre: 'Suministros',          tipo: 'gasto',   color: '#ff6b70' },
  { id: 'mkt',      nombre: 'Marketing',            tipo: 'gasto',   color: '#FF4757' },
  { id: 'otros',    nombre: 'Otros',                tipo: 'gasto',   color: '#9aa0c0' },
]

/* ═══════════════════════════════════════════════════════════
   MOCK (últimos 31 días)
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
  /* Uber Eats — 4 semanas, primeros 3 sin cat para demo regla */
  { id: '1',  fecha: daysAgo(1),  concepto: 'Liquidación Uber Eats semana 16', importe: 3284.55, categoria_id: null,       contraparte: 'Uber Eats' },
  { id: '2',  fecha: daysAgo(8),  concepto: 'Liquidación Uber Eats semana 15', importe: 2956.40, categoria_id: null,       contraparte: 'Uber Eats' },
  { id: '3',  fecha: daysAgo(15), concepto: 'Liquidación Uber Eats semana 14', importe: 3102.60, categoria_id: null,       contraparte: 'Uber Eats' },
  { id: '4',  fecha: daysAgo(22), concepto: 'Liquidación Uber Eats semana 13', importe: 2845.80, categoria_id: 'ing-plat', contraparte: 'Uber Eats' },
  { id: '5',  fecha: daysAgo(29), concepto: 'Liquidación Uber Eats semana 12', importe: 3125.10, categoria_id: 'ing-plat', contraparte: 'Uber Eats' },

  /* Glovo */
  { id: '6',  fecha: daysAgo(2),  concepto: 'Liquidación Glovo semana 16', importe: 2145.30, categoria_id: 'ing-plat', contraparte: 'Glovo' },
  { id: '7',  fecha: daysAgo(9),  concepto: 'Liquidación Glovo semana 15', importe: 1987.20, categoria_id: 'ing-plat', contraparte: 'Glovo' },
  { id: '8',  fecha: daysAgo(16), concepto: 'Liquidación Glovo semana 14', importe: 2254.75, categoria_id: 'ing-plat', contraparte: 'Glovo' },
  { id: '9',  fecha: daysAgo(23), concepto: 'Liquidación Glovo semana 13', importe: 2012.90, categoria_id: 'ing-plat', contraparte: 'Glovo' },

  /* Just Eat */
  { id: '10', fecha: daysAgo(6),  concepto: 'Liquidación Just Eat semana 16', importe: 1820.75, categoria_id: 'ing-plat', contraparte: 'Just Eat' },
  { id: '11', fecha: daysAgo(13), concepto: 'Liquidación Just Eat semana 15', importe: 1654.85, categoria_id: 'ing-plat', contraparte: 'Just Eat' },
  { id: '12', fecha: daysAgo(20), concepto: 'Liquidación Just Eat semana 14', importe: 1745.30, categoria_id: 'ing-plat', contraparte: 'Just Eat' },
  { id: '13', fecha: daysAgo(27), concepto: 'Liquidación Just Eat semana 13', importe: 1598.40, categoria_id: 'ing-plat', contraparte: 'Just Eat' },

  /* Alcampo — patrón repetido */
  { id: '14', fecha: daysAgo(3),  concepto: 'Pedido Alcampo producto fresco', importe: -428.92, categoria_id: null,   contraparte: 'Alcampo' },
  { id: '15', fecha: daysAgo(10), concepto: 'Pedido Alcampo producto fresco', importe: -389.40, categoria_id: null,   contraparte: 'Alcampo' },
  { id: '16', fecha: daysAgo(24), concepto: 'Pedido Alcampo producto fresco', importe: -402.15, categoria_id: null,   contraparte: 'Alcampo' },

  /* Jasa */
  { id: '17', fecha: daysAgo(4),  concepto: 'Pedido Jasa carnes', importe: -786.20, categoria_id: 'prov', contraparte: 'Jasa' },
  { id: '18', fecha: daysAgo(11), concepto: 'Pedido Jasa pollo',  importe: -524.70, categoria_id: 'prov', contraparte: 'Jasa' },
  { id: '19', fecha: daysAgo(25), concepto: 'Pedido Jasa cerdo',  importe: -687.35, categoria_id: 'prov', contraparte: 'Jasa' },

  /* Mercadona */
  { id: '20', fecha: daysAgo(5),  concepto: 'Pedido Mercadona stock semanal', importe: -284.15, categoria_id: 'prov', contraparte: 'Mercadona' },
  { id: '21', fecha: daysAgo(12), concepto: 'Pedido Mercadona complementos',  importe: -198.50, categoria_id: null,   contraparte: 'Mercadona' },

  /* Pampols */
  { id: '22', fecha: daysAgo(7),  concepto: 'Pedido Pampols pescado', importe: -542.80, categoria_id: 'prov', contraparte: 'Pampols' },
  { id: '23', fecha: daysAgo(14), concepto: 'Pedido Pampols marisco', importe: -385.20, categoria_id: 'prov', contraparte: 'Pampols' },
  { id: '24', fecha: daysAgo(28), concepto: 'Pedido Pampols pescado', importe: -498.90, categoria_id: 'prov', contraparte: 'Pampols' },

  /* Envapro */
  { id: '25', fecha: daysAgo(9),  concepto: 'Envapro packaging abril', importe: -368.90, categoria_id: 'prov', contraparte: 'Envapro' },

  /* Pascual */
  { id: '26', fecha: daysAgo(13), concepto: 'Pedido Pascual lácteos', importe: -192.45, categoria_id: 'prov', contraparte: 'Pascual' },
  { id: '27', fecha: daysAgo(27), concepto: 'Pedido Pascual lácteos', importe: -178.30, categoria_id: 'prov', contraparte: 'Pascual' },

  /* Lidl */
  { id: '28', fecha: daysAgo(16), concepto: 'Pedido Lidl complementos', importe: -156.30, categoria_id: null, contraparte: 'Lidl' },

  /* RRHH */
  { id: '29', fecha: daysAgo(4),  concepto: 'Nómina cocinero jefe',   importe: -1850.00, categoria_id: 'rrhh', contraparte: 'Nóminas' },
  { id: '30', fecha: daysAgo(4),  concepto: 'Nómina ayudante cocina', importe: -1320.00, categoria_id: 'rrhh', contraparte: 'Nóminas' },
  { id: '31', fecha: daysAgo(4),  concepto: 'Nómina encargado sala',  importe: -1680.00, categoria_id: 'rrhh', contraparte: 'Nóminas' },

  /* Alquiler */
  { id: '32', fecha: daysAgo(4),  concepto: 'Alquiler local abril', importe: -2400.00, categoria_id: 'alq', contraparte: 'Inmobiliaria SL' },

  /* Suministros */
  { id: '33', fecha: daysAgo(5),  concepto: 'Luz Iberdrola marzo',     importe: -612.40, categoria_id: 'sum', contraparte: 'Iberdrola' },
  { id: '34', fecha: daysAgo(18), concepto: 'Agua Canal de Isabel II', importe: -78.50,  categoria_id: 'sum', contraparte: 'Canal II' },
  { id: '35', fecha: daysAgo(21), concepto: 'Gas Naturgy marzo',       importe: -248.10, categoria_id: 'sum', contraparte: 'Naturgy' },
  { id: '36', fecha: daysAgo(19), concepto: 'Teléfono Movistar abril', importe: -89.90,  categoria_id: 'sum', contraparte: 'Movistar' },

  /* Marketing */
  { id: '37', fecha: daysAgo(14), concepto: 'Campaña Instagram Ads', importe: -320.00, categoria_id: 'mkt', contraparte: 'Meta Ads' },
  { id: '38', fecha: daysAgo(25), concepto: 'Google Ads marzo',      importe: -210.00, categoria_id: 'mkt', contraparte: 'Google Ads' },

  /* Otros */
  { id: '39', fecha: daysAgo(22), concepto: 'Reparación horno cocina', importe: -185.00, categoria_id: 'otros', contraparte: 'Técnico SAT' },

  /* Web directa */
  { id: '40', fecha: daysAgo(17), concepto: 'Venta web directa',      importe: 425.60, categoria_id: 'ing-web', contraparte: 'Web' },
  { id: '41', fecha: daysAgo(26), concepto: 'Venta web directa',      importe: 312.80, categoria_id: 'ing-web', contraparte: 'Web' },

  /* ═════════════ PERÍODO ANTERIOR (días 32-58) para comparativas ═════════════ */
  /* Uber Eats */
  { id: '50', fecha: daysAgo(36), concepto: 'Liquidación Uber Eats semana 11', importe: 2980.40, categoria_id: 'ing-plat', contraparte: 'Uber Eats' },
  { id: '51', fecha: daysAgo(43), concepto: 'Liquidación Uber Eats semana 10', importe: 2765.20, categoria_id: 'ing-plat', contraparte: 'Uber Eats' },
  { id: '52', fecha: daysAgo(50), concepto: 'Liquidación Uber Eats semana 09', importe: 2842.90, categoria_id: 'ing-plat', contraparte: 'Uber Eats' },
  { id: '53', fecha: daysAgo(57), concepto: 'Liquidación Uber Eats semana 08', importe: 2594.15, categoria_id: 'ing-plat', contraparte: 'Uber Eats' },

  /* Glovo */
  { id: '54', fecha: daysAgo(37), concepto: 'Liquidación Glovo semana 11', importe: 1890.70, categoria_id: 'ing-plat', contraparte: 'Glovo' },
  { id: '55', fecha: daysAgo(44), concepto: 'Liquidación Glovo semana 10', importe: 1745.30, categoria_id: 'ing-plat', contraparte: 'Glovo' },
  { id: '56', fecha: daysAgo(51), concepto: 'Liquidación Glovo semana 09', importe: 2010.50, categoria_id: 'ing-plat', contraparte: 'Glovo' },

  /* Just Eat */
  { id: '57', fecha: daysAgo(41), concepto: 'Liquidación Just Eat semana 11', importe: 1485.20, categoria_id: 'ing-plat', contraparte: 'Just Eat' },
  { id: '58', fecha: daysAgo(48), concepto: 'Liquidación Just Eat semana 10', importe: 1398.75, categoria_id: 'ing-plat', contraparte: 'Just Eat' },

  /* Web directa */
  { id: '59', fecha: daysAgo(45), concepto: 'Venta web directa', importe: 384.20, categoria_id: 'ing-web', contraparte: 'Web' },
  { id: '60', fecha: daysAgo(54), concepto: 'Venta web directa', importe: 295.60, categoria_id: 'ing-web', contraparte: 'Web' },

  /* Alcampo */
  { id: '61', fecha: daysAgo(33), concepto: 'Pedido Alcampo producto fresco', importe: -445.80, categoria_id: 'prov', contraparte: 'Alcampo' },
  { id: '62', fecha: daysAgo(40), concepto: 'Pedido Alcampo producto fresco', importe: -412.30, categoria_id: 'prov', contraparte: 'Alcampo' },
  { id: '63', fecha: daysAgo(54), concepto: 'Pedido Alcampo producto fresco', importe: -398.50, categoria_id: 'prov', contraparte: 'Alcampo' },

  /* Jasa */
  { id: '64', fecha: daysAgo(38), concepto: 'Pedido Jasa pollo',  importe: -612.40, categoria_id: 'prov', contraparte: 'Jasa' },
  { id: '65', fecha: daysAgo(52), concepto: 'Pedido Jasa cerdo',  importe: -548.90, categoria_id: 'prov', contraparte: 'Jasa' },

  /* Pampols */
  { id: '66', fecha: daysAgo(42), concepto: 'Pedido Pampols pescado', importe: -472.30, categoria_id: 'prov', contraparte: 'Pampols' },

  /* RRHH */
  { id: '67', fecha: daysAgo(34), concepto: 'Nómina cocinero jefe',   importe: -1850.00, categoria_id: 'rrhh', contraparte: 'Nóminas' },
  { id: '68', fecha: daysAgo(34), concepto: 'Nómina ayudante cocina', importe: -1320.00, categoria_id: 'rrhh', contraparte: 'Nóminas' },
  { id: '69', fecha: daysAgo(34), concepto: 'Nómina encargado sala',  importe: -1680.00, categoria_id: 'rrhh', contraparte: 'Nóminas' },

  /* Alquiler */
  { id: '70', fecha: daysAgo(34), concepto: 'Alquiler local marzo', importe: -2400.00, categoria_id: 'alq', contraparte: 'Inmobiliaria SL' },

  /* Suministros */
  { id: '71', fecha: daysAgo(35), concepto: 'Luz Iberdrola febrero',   importe: -578.90, categoria_id: 'sum', contraparte: 'Iberdrola' },
  { id: '72', fecha: daysAgo(47), concepto: 'Agua Canal de Isabel II', importe: -72.40,  categoria_id: 'sum', contraparte: 'Canal II' },
  { id: '73', fecha: daysAgo(48), concepto: 'Gas Naturgy febrero',     importe: -235.70, categoria_id: 'sum', contraparte: 'Naturgy' },
  { id: '74', fecha: daysAgo(46), concepto: 'Teléfono Movistar marzo', importe: -89.90,  categoria_id: 'sum', contraparte: 'Movistar' },

  /* Marketing */
  { id: '75', fecha: daysAgo(42), concepto: 'Google Ads febrero',      importe: -180.00, categoria_id: 'mkt', contraparte: 'Google Ads' },
  { id: '76', fecha: daysAgo(55), concepto: 'Campaña Instagram Ads',   importe: -295.00, categoria_id: 'mkt', contraparte: 'Meta Ads' },

  /* Otros */
  { id: '77', fecha: daysAgo(50), concepto: 'Reparación campana extractora', importe: -240.00, categoria_id: 'otros', contraparte: 'Técnico SAT' },
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

function colorContraparte(nombre: string): string | null {
  const n = nombre.toLowerCase().trim()
  if (n.includes('uber')) return '#06C167'
  if (n.includes('glovo')) return '#e8f442'
  if (n.includes('just eat') || n === 'just eat' || n.includes('justeat')) return '#f5a623'
  if (n.includes('rushour') || n.includes('web') || n.includes('tienda')) return '#B01D23'
  return null
}

function calcularLabelPeriodo(periodo: string): string {
  const now = new Date()
  const mes = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  if (periodo === 'mes') return mes.toUpperCase()
  if (periodo === 'mes_anterior') {
    const ma = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return ma.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()
  }
  if (periodo === 'trimestre') return 'ÚLTIMOS 3 MESES'
  if (periodo === 'anio') return String(now.getFullYear())
  return 'ÚLTIMOS 31 DÍAS'
}

/* ═══════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════ */

type Tab = 'resumen' | 'movimientos'
type PeriodoFiltro = 'mes' | 'mes_anterior' | '30d' | 'trimestre' | 'anio' | 'personalizado'

export default function Conciliacion() {
  const { T, isDark } = useTheme()

  const [tab, setTab]           = useState<Tab>('resumen')
  const [periodo, setPeriodo]   = useState<PeriodoFiltro>('mes')
  const [catFiltro, setCatFiltro] = useState<string>('todas')
  const [busqueda, setBusqueda] = useState('')

  const [movimientos, setMovimientos] = useState<Movimiento[]>(MOCK)
  const [reglas, setReglas] = useState<Regla[]>([])

  /* — Aplicar reglas existentes a movimientos recién importados — */
  function aplicarReglasExistentes(nuevos: Movimiento[]) {
    void nuevos
    if (reglas.length === 0) return
    setMovimientos(prev => prev.map(m => {
      if (m.categoria_id) return m
      for (const r of reglas) {
        if (m.concepto.toLowerCase().includes(r.patron.toLowerCase())) {
          return { ...m, categoria_id: r.categoria_id, auto_categorizado: true }
        }
      }
      return m
    }))
  }

  /* — Categorización inline con aprendizaje — */
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

  /* — Cálculo rango actual / anterior según período — */
  const { rangoActual, rangoAnterior, rangoFechasLegible } = useMemo(() => {
    const hoy = new Date()
    hoy.setHours(23, 59, 59, 999)
    let inicio: Date
    let fin: Date = new Date(hoy)

    if (periodo === 'mes') {
      inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    } else if (periodo === 'mes_anterior') {
      inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
      fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59)
    } else if (periodo === 'trimestre') {
      inicio = new Date(hoy)
      inicio.setDate(inicio.getDate() - 89)
    } else if (periodo === 'anio') {
      inicio = new Date(hoy.getFullYear(), 0, 1)
    } else {
      // '30d' | 'personalizado'
      inicio = new Date(hoy)
      inicio.setDate(inicio.getDate() - 30)
    }
    inicio.setHours(0, 0, 0, 0)

    const duracionMs = fin.getTime() - inicio.getTime()
    const finAnt = new Date(inicio.getTime() - 24 * 60 * 60 * 1000)
    finAnt.setHours(23, 59, 59, 999)
    const inicioAnt = new Date(finAnt.getTime() - duracionMs)
    inicioAnt.setHours(0, 0, 0, 0)

    const fmt = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    const legible = `${fmt(inicio)} — ${fmt(fin)} ${fin.getFullYear()}`

    return {
      rangoActual: { inicio, fin },
      rangoAnterior: { inicio: inicioAnt, fin: finAnt },
      rangoFechasLegible: legible,
    }
  }, [periodo])

  /* — Filtrado principal — */
  const movimientosFiltrados = useMemo(() => {
    return movimientos
      .filter(m => {
        const f = new Date(m.fecha + 'T12:00:00')
        return f >= rangoActual.inicio && f <= rangoActual.fin
      })
      .filter(m => catFiltro === 'todas' || m.categoria_id === catFiltro)
      .filter(m => !busqueda || m.concepto.toLowerCase().includes(busqueda.toLowerCase()))
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [movimientos, catFiltro, busqueda, rangoActual])

  /* — Movimientos del período anterior (comparativas) — */
  const movimientosAnterior = useMemo(() => {
    return movimientos.filter(m => {
      const f = new Date(m.fecha + 'T12:00:00')
      return f >= rangoAnterior.inicio && f <= rangoAnterior.fin
    })
  }, [movimientos, rangoAnterior])

  /* — Derivados reactivos (KPIs Movimientos) — */
  const datos = useMemo(() => {
    const ingresos = movimientosFiltrados.filter(m => m.importe > 0)
    const gastos = movimientosFiltrados.filter(m => m.importe < 0)
    const sumIng = ingresos.reduce((s, m) => s + m.importe, 0)
    const sumGst = Math.abs(gastos.reduce((s, m) => s + m.importe, 0))
    const balance = sumIng - sumGst
    const pendientes = movimientosFiltrados.filter(m => !m.categoria_id).length
    return { ingresos, gastos, sumIng, sumGst, balance, pendientes }
  }, [movimientosFiltrados])

  const periodoLabel = calcularLabelPeriodo(periodo)

  /* — Mes/año/días restantes (presupuestos) — */
  const hoyDate = new Date()
  const mesNombreRaw = hoyDate.toLocaleDateString('es-ES', { month: 'long' })
  const mesNombre = mesNombreRaw.charAt(0).toUpperCase() + mesNombreRaw.slice(1)
  const anioActual = hoyDate.getFullYear()
  const ultimoDiaMes = new Date(anioActual, hoyDate.getMonth() + 1, 0).getDate()
  const diasRestantes = Math.max(0, ultimoDiaMes - hoyDate.getDate())

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

      {/* HEADER — título + rango fechas + selector período (común a ambas pestañas) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{
          color: '#B01D23',
          fontFamily: FONT.heading,
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: '1px',
          margin: 0,
          textTransform: 'uppercase',
        }}>
          Resumen · Conciliación
        </h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: T.mut, fontFamily: FONT.body }}>{rangoFechasLegible}</span>
          <select
            value={periodo}
            onChange={e => setPeriodo(e.target.value as PeriodoFiltro)}
            style={{
              padding: '8px 14px',
              border: `1px solid ${T.brd}`,
              borderRadius: 8,
              backgroundColor: T.card,
              fontSize: 13,
              color: T.pri,
              fontFamily: FONT.body,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="mes">Este mes</option>
            <option value="mes_anterior">Mes anterior</option>
            <option value="30d">Últimos 30 días</option>
            <option value="trimestre">Trimestre</option>
            <option value="anio">Año</option>
            <option value="personalizado">Personalizado</option>
          </select>
        </div>
      </div>

      {/* TABS: Resumen → Movimientos */}
      <div style={{ display: 'flex', gap: 4, background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 10, padding: 4, width: 'fit-content', marginBottom: 18 }}>
        {(['resumen', 'movimientos'] as Tab[]).map(k => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={tab === k ? tabActiveStyle(isDark) : tabInactiveStyle(T)}
          >
            {k === 'resumen' ? 'Resumen' : 'Movimientos'}
          </button>
        ))}
      </div>

      {/* Pestaña Resumen */}
      {tab === 'resumen' && (
        <ResumenDashboard
          movimientos={movimientosFiltrados}
          movimientosAnterior={movimientosAnterior}
          categorias={CATEGORIAS}
          periodoLabel={periodoLabel}
          mesNombre={mesNombre}
          anio={anioActual}
          diasRestantes={diasRestantes}
        />
      )}

      {/* Pestaña Movimientos */}
      {tab === 'movimientos' && (
        <>
          {/* Sub-header: Dropzone + Filtros Categoría/Buscar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 18 }}>
            <ImportDropzone onFileLoaded={(rows: ParsedRow[]) => {
              const nuevos: Movimiento[] = rows.map(r => ({
                id: crypto.randomUUID(),
                fecha: r.fecha,
                concepto: r.concepto,
                importe: r.importe,
                categoria_id: null,
                contraparte: r.contraparte ?? '',
                auto_categorizado: false,
              }))
              setMovimientos(prev => [...nuevos, ...prev])
              aplicarReglasExistentes(nuevos)
            }} />
            <div>
              <label style={labelStyle}>Categoría</label>
              <select value={catFiltro} onChange={e => setCatFiltro(e.target.value)} style={inputStyle}>
                <option value="todas">Todas</option>
                {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
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

          {/* KPIs Movimientos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
            <KpiCard
              label="Ingresos"
              period={periodoLabel}
              value={fmtEur(datos.sumIng)}
              delta={{ value: '+12.4% vs anterior', trend: 'up' }}
              accent="success"
            />
            <KpiCard
              label="Gastos"
              period={periodoLabel}
              value={fmtEur(datos.sumGst)}
              delta={{ value: '-5.2% vs anterior', trend: 'down' }}
              accent="danger"
            />
            <KpiCard
              label="Balance neto"
              period={periodoLabel}
              value={fmtEur(datos.balance)}
              accent={datos.balance >= 0 ? 'default' : 'danger'}
            />
            <KpiCard
              label="Pendientes categorizar"
              period={periodoLabel}
              value={datos.pendientes > 0 ? String(datos.pendientes) : 'Todo al día ✓'}
              accent="warning"
              highlighted
            />
          </div>

          {/* TABLA */}
          <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Fecha</th>
                    <th style={thStyle}>Concepto</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Importe</th>
                    <th style={thStyle}>Categoría</th>
                    <th style={thStyle}>Contraparte</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: T.mut, padding: '28px 12px' }}>
                        Sin movimientos en este rango
                      </td>
                    </tr>
                  ) : movimientosFiltrados.map(m => {
                    const colorCp = colorContraparte(m.contraparte)
                    return (
                      <tr key={m.id}>
                        <td style={{ ...tdStyle, color: T.sec }}>{fmtFecha(m.fecha)}</td>
                        <td style={{ ...tdStyle, color: T.pri, whiteSpace: 'normal' }}>{m.concepto}</td>
                        <td style={{
                          ...tdStyle,
                          textAlign: 'right',
                          color: m.importe >= 0 ? '#06C167' : '#B01D23',
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
                        <td style={tdStyle}>
                          {colorCp ? (
                            <span style={{
                              display: 'inline-block',
                              padding: '3px 10px',
                              borderRadius: 6,
                              backgroundColor: colorCp,
                              color: colorCp === '#e8f442' ? '#1a1a1a' : '#ffffff',
                              fontFamily: FONT.heading,
                              fontSize: 11,
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: 0.4,
                            }}>
                              {m.contraparte}
                            </span>
                          ) : (
                            <span style={{ color: T.pri }}>{m.contraparte}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer tabla */}
            <div style={{
              padding: '12px 16px',
              borderTop: `1px solid ${T.brd}`,
              color: T.mut,
              fontFamily: FONT.body,
              fontSize: 12,
              textAlign: 'center',
            }}>
              {periodoLabel} · {movimientosFiltrados.length} movimientos
            </div>
          </div>
        </>
      )}
    </div>
  )
}
