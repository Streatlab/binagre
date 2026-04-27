import { useEffect, useState, useMemo, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import {
  useTheme,
  groupStyle,
  cardStyle,
  sectionLabelStyle,
  kpiLabelStyle,
  kpiValueStyle,
  dividerStyle,
  progressBgStyle,
  progressFillStyle,
  semaforoColor,
  CANALES,
  type CanalConfig,
  badgeStyle,
  calcNeto,
  MARCAS,
  tabActiveStyle,
  tabInactiveStyle,
  tabsContainerStyle,
} from '@/styles/tokens'
import { useCalendario } from '@/contexts/CalendarioContext'

/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */

interface Row {
  fecha: string
  servicio: string
  uber_pedidos: number; uber_bruto: number
  glovo_pedidos: number; glovo_bruto: number
  je_pedidos: number; je_bruto: number
  web_pedidos: number; web_bruto: number
  directa_pedidos: number; directa_bruto: number
  total_pedidos: number; total_bruto: number
}

interface CanalStat {
  id: string
  label: string
  color: string
  bruto: number
  neto: number
  pct: number
  pedidos: number
  ticket: number
  margen: number
}

interface Objetivos {
  diario: number
  semanal: number
  mensual: number
  anual: number
}

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════ */

const SELECT = 'fecha,servicio,uber_pedidos,uber_bruto,glovo_pedidos,glovo_bruto,je_pedidos,je_bruto,web_pedidos,web_bruto,directa_pedidos,directa_bruto,total_pedidos,total_bruto'

const TOP_PRODUCTOS_MOCK = [
  { n:'Ramen Warriors',   canal:'UE',  uds:42, total:796 },
  { n:'Cocido Madrileño', canal:'UE',  uds:29, total:782 },
  { n:'KFC Gochujang',    canal:'GL',  uds:38, total:570 },
  { n:'Katsu Curry',      canal:'JE',  uds:26, total:481 },
  { n:'Fish & Chips',     canal:'WEB', uds:22, total:328 },
]

const TOP_MODIFICADORES_MOCK = [
  { n:'Patatas Fritas',   canal:'UE',  uds:87, total:348 },
  { n:'Alioli',           canal:'GL',  uds:64, total:64  },
  { n:'Arroz Blanco',     canal:'JE',  uds:51, total:204 },
  { n:'Salsa Cheddar',    canal:'UE',  uds:43, total:43  },
  { n:'Puré Parmentier',  canal:'WEB', uds:38, total:152 },
]

const NETO_GREEN = '#1D9E75'

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function startOfWeekStr(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  return toLocalDateStr(monday)
}

function todayStr(): string {
  return toLocalDateStr(new Date())
}

function isoWeek(dateStr: string): { year: number; week: number } {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay() || 7
  d.setDate(d.getDate() + 4 - day)
  const y = d.getFullYear()
  const jan1 = new Date(y, 0, 1)
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + 1) / 7)
  return { year: y, week }
}

function rangoFecha(periodo: string, weekStart: string, weekEnd: string): { desde: string; hasta: string } {
  const hoy = todayStr()
  const sub = (n: number) => { const x = new Date(); x.setDate(x.getDate() - n); return toLocalDateStr(x) }
  const mesActual = hoy.slice(0, 7)
  const prevWeekStart = (() => { const d = parseLocalDate(weekStart); d.setDate(d.getDate() - 7); return toLocalDateStr(d) })()
  const prevWeekEnd   = (() => { const d = parseLocalDate(weekStart); d.setDate(d.getDate() - 1); return toLocalDateStr(d) })()
  const mesAnteriorStr = (() => { const x = new Date(); x.setMonth(x.getMonth() - 1); return toLocalDateStr(x).slice(0, 7) })()

  switch (periodo) {
    case 'semana_actual':   return { desde: weekStart, hasta: weekEnd }
    case 'semana_anterior': return { desde: prevWeekStart, hasta: prevWeekEnd }
    case 'mes_actual':      return { desde: mesActual + '-01', hasta: hoy }
    case 'un_mes':          return { desde: sub(30), hasta: hoy }
    case 'mes_anterior':    return { desde: mesAnteriorStr + '-01', hasta: mesAnteriorStr + '-31' }
    case '60d':             return { desde: sub(60), hasta: hoy }
    default:                return { desde: weekStart, hasta: weekEnd }
  }
}

function labelPeriodo(periodo: string, nSemana: number): string {
  const map: Record<string,string> = {
    semana_actual:   `Semana actual — S${nSemana}`,
    semana_anterior: `Semana anterior — S${nSemana-1}`,
    mes_actual:      'Mes actual',
    un_mes:          'Último mes',
    mes_anterior:    'Mes anterior',
    '60d':           'Últimos 60 días',
    rango:           'Rango personalizado',
  }
  return map[periodo] ?? periodo
}

function fechasPeriodo(periodo: string, weekStart: string, weekEnd: string, rangoDesde: string, rangoHasta: string): string {
  const hoy = new Date()
  const fmt = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  const weekStartD = parseLocalDate(weekStart)
  const weekEndD   = parseLocalDate(weekEnd)
  const prevWeekStart = new Date(weekStartD); prevWeekStart.setDate(weekStartD.getDate() - 7)
  const prevWeekEnd   = new Date(weekStartD); prevWeekEnd.setDate(weekStartD.getDate() - 1)
  const primerMes     = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const hace30        = new Date(hoy); hace30.setDate(hoy.getDate() - 30)
  const hace60        = new Date(hoy); hace60.setDate(hoy.getDate() - 60)
  const primerMesAnt  = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
  const ultimoMesAnt  = new Date(hoy.getFullYear(), hoy.getMonth(), 0)

  switch (periodo) {
    case 'semana_actual':   return `${fmt(weekStartD)} – ${fmt(weekEndD)} ${hoy.getFullYear()}`
    case 'semana_anterior': return `${fmt(prevWeekStart)} – ${fmt(prevWeekEnd)} ${hoy.getFullYear()}`
    case 'mes_actual':      return `${fmt(primerMes)} – ${fmt(hoy)} ${hoy.getFullYear()}`
    case 'un_mes':          return `${fmt(hace30)} – ${fmt(hoy)} ${hoy.getFullYear()}`
    case 'mes_anterior':    return `${fmt(primerMesAnt)} – ${fmt(ultimoMesAnt)} ${hoy.getFullYear()}`
    case '60d':             return `${fmt(hace60)} – ${fmt(hoy)} ${hoy.getFullYear()}`
    case 'rango': {
      if (!rangoDesde || !rangoHasta) return ''
      const dA = parseLocalDate(rangoDesde)
      const dB = parseLocalDate(rangoHasta)
      return `${fmt(dA)} – ${fmt(dB)} ${dB.getFullYear()}`
    }
    default: return ''
  }
}

function rangoPrevio(desde: string, hasta: string): { desde: string; hasta: string } {
  const dA = parseLocalDate(desde)
  const dB = parseLocalDate(hasta)
  const days = Math.round((dB.getTime() - dA.getTime()) / 86400000) + 1
  const prevHasta = new Date(dA); prevHasta.setDate(dA.getDate() - 1)
  const prevDesde = new Date(prevHasta); prevDesde.setDate(prevHasta.getDate() - (days - 1))
  return { desde: toLocalDateStr(prevDesde), hasta: toLocalDateStr(prevHasta) }
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function Dashboard() {
  const { T, isDark } = useTheme()
  const { diasOperativosEnRango, esDiaOperativo } = useCalendario()

  const [data, setData] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [periodo, setPeriodo] = useState('semana_actual')
  const [rangoDesde, setRangoDesde] = useState('')
  const [rangoHasta, setRangoHasta] = useState('')
  const [marcasFiltro, setMarcasFiltro] = useState<string[]>([])
  const [canalesFiltro, setCanalesFiltro] = useState<string[]>([])
  const [topTab, setTopTab] = useState<'prod'|'mod'>('prod')
  const [mainTab, setMainTab] = useState<'general'|'operaciones'|'finanzas'|'cashflow'|'marcas'>('general')
  const [dropMarcaOpen, setDropMarcaOpen] = useState(false)
  const [dropCanalOpen, setDropCanalOpen] = useState(false)
  const [objetivos, setObjetivos] = useState<Objetivos>({ diario:700, semanal:5000, mensual:20000, anual:240000 })
  const [editandoObjetivo, setEditandoObjetivo] = useState<'semanal'|'mensual'|'anual'|null>(null)
  const [valorEditObjetivo, setValorEditObjetivo] = useState('')
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < 768
  )

  /* ── efectos ───────────────────────────────────────────── */

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: rows, error: e } = await supabase
          .from('facturacion_diario')
          .select(SELECT)
          .order('fecha', { ascending: false })
        if (e) throw e
        if (!cancelled) setData((rows as Row[]) ?? [])
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    supabase.from('objetivos').select('tipo,importe').then(({ data: rows }) => {
      if (!rows) return
      const obj: Objetivos = { diario:700, semanal:5000, mensual:20000, anual:240000 }
      for (const r of rows as { tipo: string; importe: number | string }[]) {
        if (r.tipo === 'diario' || r.tipo === 'semanal' || r.tipo === 'mensual' || r.tipo === 'anual') {
          obj[r.tipo] = Number(r.importe)
        }
      }
      setObjetivos(obj)
    })
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest('[data-drop]')) {
        setDropMarcaOpen(false)
        setDropCanalOpen(false)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  async function guardarObjetivo(tipo: 'semanal'|'mensual'|'anual', valor: string) {
    const num = parseFloat(valor.replace(',', '.'))
    if (!num || num <= 0) {
      // Si 0 o vacío, restaurar valor original
      setEditandoObjetivo(null)
      return
    }
    setObjetivos(prev => ({ ...prev, [tipo]: num }))
    setEditandoObjetivo(null)
    try {
      await supabase.from('objetivos').upsert({ tipo, importe: num }, { onConflict: 'tipo' })
    } catch (e) {
      console.error('Error guardando objetivo:', e)
    }
  }

  /* ── derived data ──────────────────────────────────────── */

  const hoy = todayStr()
  const weekStart = useMemo(() => startOfWeekStr(), [])
  const weekEnd = useMemo(() => {
    const monday = parseLocalDate(weekStart)
    monday.setDate(monday.getDate() + 6)
    return toLocalDateStr(monday)
  }, [weekStart])

  const nSemana = isoWeek(hoy).week
  const currentMonth = hoy.slice(0, 7)
  const currentYear = hoy.slice(0, 4)

  const { desde, hasta } = useMemo(() => {
    if (periodo === 'rango') return { desde: rangoDesde || weekStart, hasta: rangoHasta || hoy }
    return rangoFecha(periodo, weekStart, weekEnd)
  }, [periodo, rangoDesde, rangoHasta, weekStart, weekEnd, hoy])

  const rowsPeriodo = useMemo(() =>
    data.filter(r => r.fecha >= desde && r.fecha <= hasta),
    [data, desde, hasta]
  )

  const ventasPeriodo  = useMemo(() => rowsPeriodo.reduce((a,r) => a + (r.total_bruto || 0), 0), [rowsPeriodo])
  const pedidosPeriodo = useMemo(() => rowsPeriodo.reduce((a,r) => a + (r.total_pedidos || 0), 0), [rowsPeriodo])
  const ticketMedio    = pedidosPeriodo > 0 ? ventasPeriodo / pedidosPeriodo : 0

  const variacionPct = useMemo(() => {
    const { desde: pDesde, hasta: pHasta } = rangoPrevio(desde, hasta)
    const prevVentas = data.filter(r => r.fecha >= pDesde && r.fecha <= pHasta).reduce((a,r) => a + (r.total_bruto || 0), 0)
    if (prevVentas <= 0) return null
    return ((ventasPeriodo - prevVentas) / prevVentas) * 100
  }, [data, desde, hasta, ventasPeriodo])

  const canalStats = useMemo((): CanalStat[] => {
    const canalesActivos: CanalConfig[] = canalesFiltro.length > 0
      ? CANALES.filter(c => canalesFiltro.includes(c.id))
      : CANALES
    return canalesActivos.map(c => {
      const bruto = rowsPeriodo.reduce((a,r) => a + ((r[c.bruKey as keyof Row] as number) || 0), 0)
      const pedidos = rowsPeriodo.reduce((a,r) => a + ((r[c.pedKey as keyof Row] as number) || 0), 0)
      const neto = calcNeto(bruto, pedidos, c)
      const pct = ventasPeriodo > 0 ? (bruto / ventasPeriodo) * 100 : 0
      const ticket = pedidos > 0 ? bruto / pedidos : 0
      const margen = bruto > 0 ? (neto / bruto) * 100 : 0
      return { id:c.id, label:c.label, color:c.color, bruto, neto, pct, pedidos, ticket, margen }
    })
  }, [rowsPeriodo, canalesFiltro, ventasPeriodo])

  const rowsSemana   = useMemo(() => data.filter(r => r.fecha >= weekStart && r.fecha <= weekEnd), [data, weekStart, weekEnd])
  const ventasSemana = useMemo(() => rowsSemana.reduce((a,r) => a + (r.total_bruto || 0), 0), [rowsSemana])
  const ventasMes    = useMemo(() => data.filter(r => r.fecha.startsWith(currentMonth)).reduce((a,r) => a + (r.total_bruto || 0), 0), [data, currentMonth])
  const ventasAno    = useMemo(() => data.filter(r => r.fecha.startsWith(currentYear)).reduce((a,r) => a + (r.total_bruto || 0), 0), [data, currentYear])

  const diasPico = useMemo(() => {
    const nombres = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']
    const vals = [0,0,0,0,0,0,0]
    for (const r of rowsPeriodo) {
      // Excluir días cerrados/festivo/vacaciones del análisis de pico
      if (!esDiaOperativo(r.fecha)) continue
      const d = parseLocalDate(r.fecha)
      const idx = (d.getDay() + 6) % 7
      vals[idx] += r.total_bruto || 0
    }
    return nombres.map((nombre,i) => ({ nombre, valor: vals[i] }))
  }, [rowsPeriodo, esDiaOperativo])

  // Días operativos restantes en el mes actual (desde mañana hasta fin de mes)
  const diasRestantesMesOp = useMemo(() => {
    const hoyD = new Date()
    const finMes = new Date(hoyD.getFullYear(), hoyD.getMonth() + 1, 0)
    const mañana = new Date(hoyD)
    mañana.setDate(hoyD.getDate() + 1)
    if (mañana > finMes) return 0
    return diasOperativosEnRango(mañana, finMes)
  }, [diasOperativosEnRango])

  const objetivosVisibles = useMemo((): ('semanal'|'mensual'|'anual')[] => {
    if (['semana_actual','semana_anterior','rango'].includes(periodo)) return ['semanal','mensual','anual']
    return ['mensual','anual']
  }, [periodo])

  /* ── estilos locales específicos ──────────────────────── */

  const glovoStyle = {
    bg:     isDark ? '#1a1800' : '#fffbe0',
    brd:    isDark ? '#e8f442' : '#8a7800',
    tag:    isDark ? '#e8f442' : '#5a4000',
    dot:    '#e8f442',
    dotBrd: isDark ? undefined : '1px solid #8a7800',
  }

  const tabStyle = (active: boolean): CSSProperties => active
    ? { background: T.pri, color: T.bg, border:'none', padding:'4px 10px', borderRadius:6, fontSize:11, cursor:'pointer', fontFamily:'Oswald,sans-serif', letterSpacing:'0.5px' }
    : { background:'none', color: T.sec, border:`0.5px solid ${T.brd}`, padding:'4px 10px', borderRadius:6, fontSize:11, cursor:'pointer', fontFamily:'Oswald,sans-serif', letterSpacing:'0.5px' }

  const dotStyle = (canalId: string, color: string): CSSProperties => {
    const isGlovo = canalId === 'glovo'
    return {
      width: 8, height: 8, borderRadius: '50%',
      background: isGlovo ? glovoStyle.dot : color,
      border: isGlovo ? glovoStyle.dotBrd : undefined,
      display: 'inline-block',
      flexShrink: 0,
    }
  }

  /* ── loading / error ───────────────────────────────────── */

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:80 }}>
      <div className="h-6 w-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div style={{ ...cardStyle(T), textAlign:'center', padding:40 }}>
      <p style={{ color:'#E24B4A', fontSize:13 }}>{error}</p>
    </div>
  )

  const topItems = topTab === 'prod' ? TOP_PRODUCTOS_MOCK : TOP_MODIFICADORES_MOCK
  const grid3 = isMobile ? '1fr' : 'repeat(3,minmax(0,1fr))'
  const grid5 = isMobile ? '1fr' : 'repeat(auto-fit,minmax(170px,1fr))'

  /* ── render ────────────────────────────────────────────── */

  return (
    <div style={{ fontFamily: 'Lexend, sans-serif' }}>

      {/* Rango personalizado */}
      {periodo === 'rango' && (
        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:12, flexWrap:'wrap' }}>
          <input type="date" value={rangoDesde} onChange={e => setRangoDesde(e.target.value)}
            style={{ padding:'3px 8px', borderRadius:6, border:`0.5px solid ${T.brd}`, background:T.inp, color:T.pri, fontSize:11 }} />
          <span style={{ fontSize:11, color:T.sec }}>hasta</span>
          <input type="date" value={rangoHasta} onChange={e => setRangoHasta(e.target.value)}
            style={{ padding:'3px 8px', borderRadius:6, border:`0.5px solid ${T.brd}`, background:T.inp, color:T.pri, fontSize:11 }} />
        </div>
      )}

      <div style={groupStyle(T)}>

        {/* HEADER */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20, flexWrap:'wrap' }}>
          <span style={{
            fontFamily:'Oswald,sans-serif',
            fontSize:15,
            letterSpacing:'3px',
            textTransform:'uppercase',
            color:T.emphasis,
            fontWeight:600,
            whiteSpace:'nowrap',
            flexShrink:0,
          }}>
            {labelPeriodo(periodo, nSemana)}
          </span>

          <span style={{
            fontFamily:'Lexend,sans-serif',
            fontSize:12,
            color:T.sec,
            whiteSpace:'nowrap',
            flexShrink:0,
          }}>
            {fechasPeriodo(periodo, weekStart, weekEnd, rangoDesde, rangoHasta)}
          </span>

          <select
            value={periodo}
            onChange={e => setPeriodo(e.target.value)}
            style={{
              padding:'3px 7px',
              borderRadius:6,
              border:`0.5px solid ${T.brd}`,
              background:T.inp,
              color:T.pri,
              fontSize:11,
              cursor:'pointer',
              flexShrink:0,
            }}
          >
            <option value="semana_actual">Semana actual</option>
            <option value="semana_anterior">Semana anterior</option>
            <option value="mes_actual">Mes actual</option>
            <option value="un_mes">Un mes hasta ahora</option>
            <option value="mes_anterior">Mes anterior</option>
            <option value="60d">Últimos 60 días</option>
            <option value="rango">Rango personalizado</option>
          </select>

          <div style={{ position:'relative', flexShrink:0 }} data-drop="marca">
            <button
              onClick={() => { setDropMarcaOpen(p => !p); setDropCanalOpen(false) }}
              style={{ padding:'3px 9px', borderRadius:6, border:`0.5px solid ${T.brd}`, background:T.inp, color:T.pri, fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', gap:4, whiteSpace:'nowrap' }}
            >
              {marcasFiltro.length === 0 ? 'Todas las marcas' : marcasFiltro.length === 1 ? marcasFiltro[0] : `${marcasFiltro.length} marcas`} ▾
            </button>
            {dropMarcaOpen && (
              <div style={{ position:'absolute', left:0, top:'110%', background:T.card, border:`0.5px solid ${T.brd}`, borderRadius:8, minWidth:170, zIndex:20, padding:'4px 0', boxShadow: isDark ? '0 6px 20px rgba(0,0,0,0.4)' : '0 6px 20px rgba(0,0,0,0.08)' }}>
                {MARCAS.map(m => (
                  <label key={m} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', cursor:'pointer', fontSize:12, color:T.pri }}>
                    <input type="checkbox" checked={marcasFiltro.includes(m)}
                      onChange={() => setMarcasFiltro(p => p.includes(m) ? p.filter(x => x !== m) : [...p, m])}
                      style={{ width:13, height:13 }} />
                    {m}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div style={{ position:'relative', flexShrink:0 }} data-drop="canal">
            <button
              onClick={() => { setDropCanalOpen(p => !p); setDropMarcaOpen(false) }}
              style={{ padding:'3px 9px', borderRadius:6, border:`0.5px solid ${T.brd}`, background:T.inp, color:T.pri, fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', gap:4, whiteSpace:'nowrap' }}
            >
              {canalesFiltro.length === 0 ? 'Todos los canales' : canalesFiltro.length === 1 ? CANALES.find(c => c.id === canalesFiltro[0])?.label : `${canalesFiltro.length} canales`} ▾
            </button>
            {dropCanalOpen && (
              <div style={{ position:'absolute', left:0, top:'110%', background:T.card, border:`0.5px solid ${T.brd}`, borderRadius:8, minWidth:170, zIndex:20, padding:'4px 0', boxShadow: isDark ? '0 6px 20px rgba(0,0,0,0.4)' : '0 6px 20px rgba(0,0,0,0.08)' }}>
                {CANALES.map(c => (
                  <label key={c.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', cursor:'pointer', fontSize:12, color:T.pri }}>
                    <input type="checkbox" checked={canalesFiltro.includes(c.id)}
                      onChange={() => setCanalesFiltro(p => p.includes(c.id) ? p.filter(x => x !== c.id) : [...p, c.id])}
                      style={{ width:13, height:13 }} />
                    <span style={dotStyle(c.id, c.color)} />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* TABS PRINCIPALES */}
        <div style={tabsContainerStyle()}>
          {([
            { key: 'general', label: 'General' },
            { key: 'operaciones', label: 'Operaciones' },
            { key: 'finanzas', label: 'Finanzas' },
            { key: 'cashflow', label: 'Cashflow' },
            { key: 'marcas', label: 'Marcas' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setMainTab(tab.key)}
              style={mainTab === tab.key ? tabActiveStyle(isDark) : tabInactiveStyle(T)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB: MARCAS */}
        {mainTab === 'marcas' && (
          <div style={{ padding: '24px 0' }}>
            <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 16 }}>Top marcas · {labelPeriodo(periodo, nSemana)}</div>
            {/* Tabla pivote marcas × canales */}
            <div style={{ overflowX: 'auto', marginBottom: 20 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Lexend,sans-serif', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontFamily: 'Oswald,sans-serif', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, borderBottom: `1px solid ${T.brd}` }}>Marca</th>
                    {CANALES.map(c => (
                      <th key={c.id} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Oswald,sans-serif', fontSize: 10, letterSpacing: '1px', color: c.id === 'glovo' ? '#e8f442' : c.color, borderBottom: `1px solid ${T.brd}` }}>{c.label}</th>
                    ))}
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'Oswald,sans-serif', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, borderBottom: `1px solid ${T.brd}` }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {MARCAS.map((marca, idx) => {
                    // mock: distribute ventasPeriodo evenly across marcas for visual
                    const factor = [0.35, 0.25, 0.20, 0.12, 0.08][idx] ?? 0.05
                    const marcaBruto = ventasPeriodo * factor
                    return (
                      <tr key={marca}>
                        <td style={{ padding: '10px 12px', color: T.pri, borderBottom: `0.5px solid ${T.brd}` }}>{marca}</td>
                        {CANALES.map(c => {
                          const canBruto = marcaBruto * (c.comisionPct < 0.1 ? 0.08 : c.comisionPct < 0.15 ? 0.12 : 0.25)
                          const intensity = ventasPeriodo > 0 ? canBruto / ventasPeriodo : 0
                          return (
                            <td key={c.id} style={{
                              padding: '10px 10px', textAlign: 'right', borderBottom: `0.5px solid ${T.brd}`,
                              background: canBruto > 0 ? `${c.color}${Math.round(intensity * 200).toString(16).padStart(2,'0')}` : 'transparent',
                              color: T.sec,
                            }}>{canBruto > 0 ? fmtEur(canBruto) : '—'}</td>
                          )
                        })}
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Oswald,sans-serif', fontWeight: 600, color: T.pri, borderBottom: `0.5px solid ${T.brd}` }}>{fmtEur(marcaBruto)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ fontFamily: 'Lexend,sans-serif', fontSize: 11, color: T.mut }}>
              Datos por marca disponibles en FASE 2 — desglose real requiere campo marca en facturacion_diario.
            </div>
          </div>
        )}

        {/* TAB: OPERACIONES */}
        {mainTab === 'operaciones' && (
          <div style={{ padding: '24px 0' }}>
            <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 16 }}>KPIs operativos</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
              {((): { label: string; value: string; sub?: string }[] => {
                const totalPed = canalStats.reduce((a, c) => a + c.pedidos, 0)
                const totalBruto = canalStats.reduce((a, c) => a + c.bruto, 0)
                const tm = totalPed > 0 ? totalBruto / totalPed : 0
                const { desde: pDesde, hasta: pHasta } = rangoPrevio(desde, hasta)
                const prevRows = data.filter(r => r.fecha >= pDesde && r.fecha <= pHasta)
                const prevPed = prevRows.reduce((a, r) => a + (r.total_pedidos || 0), 0)
                const prevBruto = prevRows.reduce((a, r) => a + (r.total_bruto || 0), 0)
                const prevTm = prevPed > 0 ? prevBruto / prevPed : 0
                const pedDelta = prevPed > 0 ? ((totalPed - prevPed) / prevPed * 100) : null
                const tmDelta = prevTm > 0 ? ((tm - prevTm) / prevTm * 100) : null
                const topCanal = [...canalStats].sort((a, b) => b.bruto - a.bruto)[0]
                return [
                  { label: 'Pedidos totales', value: Math.round(totalPed).toLocaleString('es-ES'), sub: pedDelta !== null ? `${pedDelta >= 0 ? '▲' : '▼'} ${Math.abs(pedDelta).toFixed(1)}% vs anterior` : undefined },
                  { label: 'Ticket medio', value: fmtEur(tm), sub: tmDelta !== null ? `${tmDelta >= 0 ? '▲' : '▼'} ${Math.abs(tmDelta).toFixed(1)}% vs anterior` : undefined },
                  { label: 'Canal top', value: topCanal?.label ?? '—', sub: topCanal ? fmtEur(topCanal.bruto) : undefined },
                  { label: 'Facturación bruta', value: fmtEur(ventasPeriodo) },
                ]
              })().map(kpi => (
                <div key={kpi.label} style={cardStyle(T)}>
                  <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, marginBottom: 6 }}>{kpi.label}</div>
                  <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 22, fontWeight: 600, color: T.pri }}>{kpi.value}</div>
                  {kpi.sub && <div style={{ fontSize: 11, color: T.sec, marginTop: 4 }}>{kpi.sub}</div>}
                </div>
              ))}
            </div>
            {/* Mix canales barras horizontales */}
            <div style={cardStyle(T)}>
              <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, marginBottom: 12 }}>Mix canales</div>
              {canalStats.filter(c => c.bruto > 0).sort((a, b) => b.bruto - a.bruto).map(c => (
                <div key={c.id} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontFamily: 'Lexend,sans-serif', fontSize: 12, color: T.sec }}>{c.label}</span>
                    <span style={{ fontFamily: 'Oswald,sans-serif', fontSize: 13, fontWeight: 600, color: c.color }}>{c.pct.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 4, background: T.brd, borderRadius: 2 }}>
                    <div style={{ height: 4, width: `${Math.min(c.pct, 100)}%`, background: c.color, borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: FINANZAS */}
        {mainTab === 'finanzas' && (
          <div style={{ padding: '24px 0' }}>
            <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 16 }}>Vista financiera</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
              {(() => {
                const comEstimadas = canalStats.reduce((a, c) => a + (c.bruto - c.neto), 0)
                const netoTotal = canalStats.reduce((a, c) => a + c.neto, 0)
                const ratioGastos = netoTotal > 0 ? (comEstimadas / netoTotal) * 100 : 0
                return [
                  { label: 'Ingresos brutos', value: fmtEur(ventasPeriodo), color: '#1D9E75' },
                  { label: 'Comisiones plataformas', value: fmtEur(comEstimadas), color: '#f5a623' },
                  { label: 'Ingresos netos est.', value: fmtEur(netoTotal), color: '#e8f442' },
                  { label: 'Ratio gastos/netos', value: `${ratioGastos.toFixed(1)}%`, color: semaforoColor(100 - ratioGastos) },
                ]
              })().map(item => (
                <div key={item.label} style={cardStyle(T)}>
                  <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, marginBottom: 6 }}>{item.label}</div>
                  <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 22, fontWeight: 600, color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>
            {/* Sparklines por canal (SVG 60×20) */}
            <div style={cardStyle(T)}>
              <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, marginBottom: 12 }}>Distribución neto por canal</div>
              {canalStats.filter(c => c.neto > 0).sort((a, b) => b.neto - a.neto).map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                  <span style={{ fontFamily: 'Lexend,sans-serif', fontSize: 12, color: T.sec, minWidth: 80 }}>{c.label}</span>
                  <div style={{ height: 4, flex: 1, background: T.brd, borderRadius: 2 }}>
                    <div style={{ height: 4, width: `${Math.min(c.pct, 100)}%`, background: c.color, borderRadius: 2 }} />
                  </div>
                  <span style={{ fontFamily: 'Oswald,sans-serif', fontSize: 13, fontWeight: 600, color: c.color, minWidth: 70, textAlign: 'right' }}>{fmtEur(c.neto)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: CASHFLOW */}
        {mainTab === 'cashflow' && (
          <div style={{ padding: '24px 0' }}>
            <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 16 }}>Cashflow proyectado</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
              {[
                { label: 'Cobros pendientes', value: fmtEur(canalStats.reduce((a, c) => a + c.neto, 0) * 0.3), sub: 'Liquidaciones plataformas ~7-14 días', color: '#1D9E75' },
                { label: 'Pagos pendientes', value: fmtEur(ventasPeriodo * 0.05), sub: 'Gastos fijos estimados', color: '#f5a623' },
                { label: 'Provisión IVA est.', value: fmtEur(ventasPeriodo * 0.1 * 0.21), sub: '21% s/ ventas netas', color: '#66aaff' },
                { label: 'Provisión IRPF', value: fmtEur(ventasPeriodo * 0.02), sub: 'Retenciones alquiler', color: '#9ba8c0' },
              ].map(item => (
                <div key={item.label} style={cardStyle(T)}>
                  <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, marginBottom: 6 }}>{item.label}</div>
                  <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 22, fontWeight: 600, color: item.color }}>{item.value}</div>
                  <div style={{ fontFamily: 'Lexend,sans-serif', fontSize: 11, color: T.mut, marginTop: 4 }}>{item.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ ...cardStyle(T), color: T.mut, fontSize: 12, fontFamily: 'Lexend,sans-serif' }}>
              Proyección detallada disponible en <strong style={{ color: T.pri }}>PE → Tesorería futura</strong>.
            </div>
          </div>
        )}

        {/* TAB: GENERAL — contenido principal existente */}
        {mainTab === 'general' && (<>

        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns: grid3, gap:14, marginBottom:22 }}>

          {/* VENTAS */}
          <div style={cardStyle(T)}>
            <div style={{ ...kpiLabelStyle(T), marginBottom:8 }}>Ventas</div>
            <div style={{ ...kpiValueStyle(T), marginBottom:4 }}>
              {fmtEur(ventasPeriodo)}
            </div>
            {variacionPct !== null && (
              <div style={{ fontFamily:'Lexend,sans-serif', fontSize:12, color: variacionPct >= 0 ? NETO_GREEN : '#E24B4A', marginBottom:10 }}>
                {variacionPct >= 0 ? '▲' : '▼'} {Math.abs(variacionPct).toFixed(1)}% vs anterior
              </div>
            )}

            <div style={dividerStyle(T)} />

            {objetivosVisibles.map(tipo => {
              const valor = tipo === 'semanal' ? ventasSemana : tipo === 'mensual' ? ventasMes : ventasAno
              const meta  = tipo === 'semanal' ? objetivos.semanal : tipo === 'mensual' ? objetivos.mensual : objetivos.anual
              const pct   = meta > 0 ? Math.min(100, Math.round((valor / meta) * 100)) : 0
              const col   = semaforoColor(pct)
              const falta = Math.max(0, meta - valor)
              const label = tipo === 'semanal' ? 'Semanal' : tipo === 'mensual' ? 'Mensual' : 'Anual'
              const sub   = tipo === 'semanal' ? `S${nSemana}` : tipo === 'mensual' ? new Date().toLocaleDateString('es-ES',{month:'long'}) : currentYear
              const isEditing = editandoObjetivo === tipo
              return (
                <div key={tipo} style={{ marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontFamily:'Oswald,sans-serif', fontSize:13, letterSpacing:'1px', textTransform:'uppercase', color:T.pri }}>{label}</span>
                      <span style={{ fontSize:12, color:T.mut }}>— {sub}</span>
                    </div>
                    <span style={{ fontFamily:'Oswald,sans-serif', fontSize:14, fontWeight:600, color:col }}>{pct}%</span>
                  </div>
                  <div style={{ fontSize:13, color:T.sec, marginBottom:5, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                    Faltan <span style={{ color:col, fontWeight:500 }}>{fmtEur(falta)}</span>{tipo === 'mensual' && diasRestantesMesOp > 0 && <span style={{ fontSize:11, color:T.mut }}>({diasRestantesMesOp} días op.)</span>} de{' '}
                    {isEditing ? (
                      <input
                        autoFocus
                        type="number"
                        value={valorEditObjetivo}
                        onChange={e => setValorEditObjetivo(e.target.value)}
                        onBlur={() => guardarObjetivo(tipo, valorEditObjetivo)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') guardarObjetivo(tipo, valorEditObjetivo)
                          if (e.key === 'Escape') setEditandoObjetivo(null)
                        }}
                        style={{
                          width: 90, padding: '2px 6px', borderRadius: 4,
                          border: `1px solid #e8f442`, background: T.inp, color: T.pri,
                          fontFamily: 'Oswald,sans-serif', fontSize: 13, outline: 'none',
                        }}
                      />
                    ) : (
                      <span
                        title="Click para editar objetivo"
                        onClick={() => { setEditandoObjetivo(tipo); setValorEditObjetivo(String(meta)) }}
                        style={{ color:T.pri, fontWeight:500, cursor:'pointer', textDecoration:'underline dotted', textUnderlineOffset:2 }}
                      >
                        {fmtEur(meta)}
                      </span>
                    )}
                  </div>
                  <div style={progressBgStyle(T)}>
                    <div style={progressFillStyle(pct, col)} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* PEDIDOS */}
          <div style={cardStyle(T)}>
            <div style={{ ...kpiLabelStyle(T), marginBottom:8 }}>Pedidos</div>
            <div style={{ ...kpiValueStyle(T), marginBottom:10 }}>
              {Math.round(pedidosPeriodo).toLocaleString('es-ES')}
            </div>
            <div style={dividerStyle(T)} />
            {canalStats.map((c, idx) => {
              const pct = Math.round(c.pct)
              return (
                <div key={c.id} style={{
                  display:'grid',
                  gridTemplateColumns:'16px 1fr auto auto',
                  alignItems:'center',
                  gap:'0 8px',
                  padding:'7px 0',
                  borderBottom: idx < canalStats.length - 1 ? `0.5px solid ${T.brd}` : 'none',
                }}>
                  <span style={dotStyle(c.id, c.color)} />
                  <span style={{ fontFamily:'Lexend,sans-serif', fontSize:14, color:T.sec, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.label}</span>
                  <span style={{ fontFamily:'Lexend,sans-serif', fontSize:15, fontWeight:600, color:T.pri, textAlign:'right' }}>{Math.round(c.pedidos).toLocaleString('es-ES')}</span>
                  <span style={{ fontFamily:'Lexend,sans-serif', fontSize:12, color:T.mut, textAlign:'right', minWidth:32 }}>{pct}%</span>
                </div>
              )
            })}
          </div>

          {/* TICKET MEDIO */}
          <div style={cardStyle(T)}>
            <div style={{ ...kpiLabelStyle(T), marginBottom:8 }}>TM</div>
            <div style={{ ...kpiValueStyle(T), marginBottom:10 }}>
              {fmtEur(ticketMedio)}
            </div>
            <div style={dividerStyle(T)} />
            {canalStats.map((c, idx) => (
              <div key={c.id} style={{
                display:'grid',
                gridTemplateColumns:'16px 1fr auto',
                alignItems:'center',
                gap:'0 8px',
                padding:'7px 0',
                borderBottom: idx < canalStats.length - 1 ? `0.5px solid ${T.brd}` : 'none',
              }}>
                <span style={dotStyle(c.id, c.color)} />
                <span style={{ fontFamily:'Lexend,sans-serif', fontSize:14, color:T.sec, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.label}</span>
                <span style={{ fontFamily:'Lexend,sans-serif', fontSize:15, fontWeight:600, color:T.pri, textAlign:'right' }}>
                  {c.ticket > 0 ? fmtEur(c.ticket) : '—'}
                </span>
              </div>
            ))}
          </div>

        </div>

        {/* Facturación por canal */}
        <div style={{ ...sectionLabelStyle(T), marginBottom:12 }}>Facturación por canal</div>
        <div style={{ display:'grid', gridTemplateColumns: grid5, gap:12, marginBottom:22 }}>
          {canalStats.map(c => {
            const isGlovo = c.id === 'glovo'
            const hasData = c.bruto > 0
            const cardBg  = isGlovo ? glovoStyle.bg  : (isDark ? `${c.color}18` : `${c.color}22`)
            const cardBrd = isGlovo ? glovoStyle.brd : c.color
            const tagCol  = isGlovo ? glovoStyle.tag : c.color
            return (
              <div key={c.id} style={{ background:cardBg, border:`1px solid ${cardBrd}`, borderRadius:10, padding:'12px 14px' }}>
                <div style={{ fontFamily:'Oswald,sans-serif', fontSize:11, letterSpacing:'1.5px', textTransform:'uppercase', color:tagCol, marginBottom:8 }}>{c.label}</div>

                <div style={{ display:'flex', alignItems:'baseline', gap:5, marginBottom:3 }}>
                  {hasData ? (
                    <>
                      <span style={{ fontFamily:'Oswald,sans-serif', fontSize:18, fontWeight:600, color:T.pri, lineHeight:1 }}>{fmtEur(c.bruto)}</span>
                      <span style={{ fontSize:11, color:T.mut }}>bruto</span>
                    </>
                  ) : (
                    <span style={{ fontFamily:'Oswald,sans-serif', fontSize:18, color:T.mut, lineHeight:1 }}>—</span>
                  )}
                </div>

                <div style={{ display:'flex', alignItems:'baseline', gap:5, marginBottom:10 }}>
                  {hasData ? (
                    <>
                      <span style={{ fontFamily:'Oswald,sans-serif', fontSize:18, fontWeight:500, color:NETO_GREEN, lineHeight:1 }}>{fmtEur(c.neto)}</span>
                      <span style={{ fontSize:11, color:T.mut }}>neto</span>
                    </>
                  ) : (
                    <span style={{ fontFamily:'Oswald,sans-serif', fontSize:18, color:T.mut, lineHeight:1 }}>—</span>
                  )}
                </div>

                <div style={{ height:3, background:T.brd, borderRadius:2, marginBottom:8 }}>
                  <div style={{ height:3, width:`${hasData ? Math.min(c.pct,100) : 0}%`, background:c.color, borderRadius:2 }} />
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12 }}>
                  {hasData ? (
                    <>
                      <span style={{ color:T.sec }}>Margen</span>
                      <span style={{ fontFamily:'Oswald,sans-serif', fontWeight:600, color: semaforoColor(c.margen) }}>{c.margen.toFixed(0)}%</span>
                    </>
                  ) : (
                    <span style={{ color:T.mut }}>Sin datos</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Días pico + Top ventas */}
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.4fr', gap:14, width: isMobile ? '100%' : '66%' }}>

          <div style={cardStyle(T)}>
            <div style={{ ...sectionLabelStyle(T), marginBottom:14 }}>Días pico — {labelPeriodo(periodo, nSemana)}</div>
            {(() => {
              const ALTURA_MAX = 100
              const maxVal = Math.max(...diasPico.map(d => d.valor), 1)
              const topVal = Math.max(...diasPico.map(d => d.valor))
              return (
                <div style={{ position:'relative', paddingBottom:8 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6, alignItems:'flex-end' }}>
                    {diasPico.map(({ nombre, valor }) => {
                      const hasData = valor > 0
                      const h = hasData ? Math.max(Math.round((valor / maxVal) * ALTURA_MAX), 10) : Math.round(ALTURA_MAX * 0.15)
                      const isTop = hasData && valor === topVal
                      const barColor = isTop ? T.emphasis : hasData ? '#378ADD' : T.brd
                      return (
                        <div key={nombre} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                          <div style={{ fontFamily:'Lexend,sans-serif', fontSize:11, color: isTop ? T.emphasis : T.sec, fontWeight: isTop ? 600 : 400, minHeight:15, textAlign:'center' }}>
                            {hasData ? fmtEur(valor).replace(' €','') : ''}
                          </div>
                          <div style={{ height:ALTURA_MAX, display:'flex', alignItems:'flex-end', justifyContent:'center', width:'100%' }}>
                            <div style={{
                              width:'70%',
                              height:h,
                              background:barColor,
                              borderRadius:'3px 3px 0 0',
                              opacity: hasData ? 1 : 0.3,
                              border: hasData ? 'none' : `1px dashed ${T.brd}`,
                            }} />
                          </div>
                          <div style={{ fontFamily:'Lexend,sans-serif', fontSize:12, color:T.mut, textAlign:'center', marginTop:2 }}>{nombre}</div>
                          {!hasData && <div style={{ fontSize:10, color:T.mut }}>—</div>}
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ height:1, background:T.brd, marginTop:-18, pointerEvents:'none' }} />
                </div>
              )
            })()}
          </div>

          <div style={cardStyle(T)}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 }}>
              <span style={sectionLabelStyle(T)}>Top ventas</span>
              <div style={{ display:'flex', gap:4 }}>
                <button onClick={() => setTopTab('prod')} style={tabStyle(topTab === 'prod')}>Productos</button>
                <button onClick={() => setTopTab('mod')}  style={tabStyle(topTab === 'mod')}>Modif.</button>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column' }}>
              {topItems.map((p, idx) => (
                <div key={`${topTab}-${idx}`} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 0', borderBottom: idx < topItems.length-1 ? `0.5px solid ${T.brd}` : 'none' }}>
                  <span style={{ fontFamily:'Lexend,sans-serif', fontSize:13, color:T.mut, width:18, textAlign:'right' }}>{idx+1}</span>
                  <span style={{ fontFamily:'Lexend,sans-serif', fontSize:15, color:T.pri, flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.n}</span>
                  <span style={badgeStyle(p.canal, isDark)}>{p.canal}</span>
                  <span style={{ fontFamily:'Lexend,sans-serif', fontSize:13, color:T.sec, width:36, textAlign:'right' }}>{p.uds}</span>
                  <span style={{ fontFamily:'Oswald,sans-serif', fontSize:15, fontWeight:600, color:T.pri, width:64, textAlign:'right' }}>{fmtEur(p.total)}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize:11, color:T.mut, marginTop:12 }}>* Datos reales disponibles al integrar POS</div>
          </div>

        </div>

        </>)}

      </div>
    </div>
  )
}
