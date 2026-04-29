import { useEffect, useState, useMemo, useCallback, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { formatearFechaCorta } from '@/lib/format'
import {
  useTheme,
  groupStyle,
  cardStyle,
  sectionLabelStyle,
  progressBgStyle,
  progressFillStyle,
  semaforoColor,
  CANALES,
  type CanalConfig,
  tituloPaginaStyle,
} from '@/styles/tokens'
import { useCalendario } from '@/contexts/CalendarioContext'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'
import { calcNetoPorCanal } from '@/lib/panel/calcNetoPlataforma'
import TabResumen from '@/components/panel/resumen/TabResumen'

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

type MainTab = 'resumen' | 'operaciones' | 'finanzas' | 'cashflow' | 'marcas'

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════ */

const SELECT = 'fecha,servicio,uber_pedidos,uber_bruto,glovo_pedidos,glovo_bruto,je_pedidos,je_bruto,web_pedidos,web_bruto,directa_pedidos,directa_bruto,total_pedidos,total_bruto'

const NETO_GREEN = '#1D9E75'

const MAIN_TABS = [
  { id: 'resumen',     label: 'Resumen' },
  { id: 'operaciones', label: 'Operaciones' },
  { id: 'finanzas',    label: 'Finanzas' },
  { id: 'cashflow',    label: 'Cashflow' },
  { id: 'marcas',      label: 'Marcas' },
] as const

const DIAS_NOMBRES = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']
const DIAS_COLORES = ['#1E5BCC','#06C167','#f5a623','#B01D23','#66aaff','#F26B1F','#1D9E75']

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

function rangoPrevio(desde: string, hasta: string): { desde: string; hasta: string } {
  const dA = parseLocalDate(desde)
  const dB = parseLocalDate(hasta)
  const days = Math.round((dB.getTime() - dA.getTime()) / 86400000) + 1
  const prevHasta = new Date(dA); prevHasta.setDate(dA.getDate() - 1)
  const prevDesde = new Date(prevHasta); prevDesde.setDate(prevHasta.getDate() - (days - 1))
  return { desde: toLocalDateStr(prevDesde), hasta: toLocalDateStr(prevHasta) }
}

/* ═══════════════════════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════════════════════ */

interface ToastMsg { id: number; msg: string; type: 'success' | 'warning' }

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function Dashboard() {
  const { T, isDark } = useTheme()
  const { diasOperativosEnRango, esDiaOperativo } = useCalendario()
  const navigate = useNavigate()

  const [data, setData] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fecha seleccionada por SelectorFechaUniversal
  const [fechaDesde, setFechaDesde] = useState<Date>(() => {
    const now = new Date(); const dow = now.getDay() || 7
    const monday = new Date(now); monday.setDate(now.getDate() - dow + 1); return monday
  })
  const [fechaHasta, setFechaHasta] = useState<Date>(new Date())
  const [fechaLabel, setFechaLabel] = useState('Semana actual')

  const [marcasBD, setMarcasBD] = useState<string[]>([])
  const [marcasFiltro, setMarcasFiltro] = useState<string[]>([])
  const [canalesFiltro, setCanalesFiltro] = useState<string[]>([])
  const [topTab, setTopTab] = useState<'prod'|'mod'>('prod') // eslint-disable-line @typescript-eslint/no-unused-vars
  const [mainTab, setMainTab] = useState<MainTab>('resumen')
  const [diaSemanaFiltro, setDiaSemanaFiltro] = useState<number | null>(null)
  const [dropMarcaOpen, setDropMarcaOpen] = useState(false)
  const [dropCanalOpen, setDropCanalOpen] = useState(false)
  const [objetivos, setObjetivos] = useState<Objetivos>({ diario:700, semanal:5000, mensual:20000, anual:240000 })
  const [editandoObjetivo, setEditandoObjetivo] = useState<'semanal'|'mensual'|'anual'|null>(null)
  const [valorEditObjetivo, setValorEditObjetivo] = useState('')
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < 768
  )

  const [ventasPlataforma, setVentasPlataforma] = useState<{
    marca: string; plataforma: string; bruto: number; neto: number; pedidos: number
    fecha_inicio_periodo: string
  }[]>([])

  /* ── banner tareas atrasadas ───────────────────────── */
  const [tareasAtrasadas, setTareasAtrasadas] = useState<string[]>([])
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const hoy = new Date().toISOString().slice(0, 10)
    return localStorage.getItem(`banner_tareas_dismissed_${hoy}`) === '1'
  })

  /* ── toast helper ─────────────────────────────────── */
  const showToast = useCallback((msg: string, type: 'success' | 'warning') => {
    const id = Date.now()
    setToasts(p => [...p, { id, msg, type }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000)
  }, [])

  /* ── efectos ───────────────────────────────────────── */

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
    supabase
      .from('marcas')
      .select('nombre')
      .eq('activa', true)
      .order('nombre')
      .then(({ data: rows }) => {
        if (rows) setMarcasBD((rows as { nombre: string }[]).map(r => r.nombre))
      })
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
    const hace90 = new Date()
    hace90.setDate(hace90.getDate() - 90)
    const desde90 = hace90.toISOString().slice(0, 10)
    supabase
      .from('ventas_plataforma')
      .select('marca, plataforma, bruto, neto, pedidos, fecha_inicio_periodo')
      .gte('fecha_inicio_periodo', desde90)
      .neq('marca', 'SIN_MARCA')
      .then(({ data: rows }) => {
        if (rows) setVentasPlataforma(rows as typeof ventasPlataforma)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const hoy = new Date().toISOString().slice(0, 10)
    if (bannerDismissed) return
    supabase
      .from('tareas_pendientes')
      .select('id, estado, tareas_periodicas(nombre)')
      .eq('estado', 'atrasada')
      .then(({ data: rows }) => {
        if (!rows) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nombres = (rows as any[]).map((r) => {
          const tp = Array.isArray(r.tareas_periodicas) ? r.tareas_periodicas[0] : r.tareas_periodicas
          return tp?.nombre ?? ''
        }).filter(Boolean) as string[]
        setTareasAtrasadas(nombres)
      })
  }, [bannerDismissed]) // eslint-disable-line react-hooks/exhaustive-deps

  function dismissBanner() {
    const hoy = new Date().toISOString().slice(0, 10)
    localStorage.setItem(`banner_tareas_dismissed_${hoy}`, '1')
    setBannerDismissed(true)
  }

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

  /* ── handlers selector fecha ───────────────────────── */

  const handleFechaChange = useCallback((desde: Date, hasta: Date, label: string) => {
    setFechaDesde(desde)
    setFechaHasta(hasta)
    setFechaLabel(label)
  }, [])

  /* ── guardar objetivo ──────────────────────────────── */

  async function guardarObjetivo(tipo: 'semanal'|'mensual'|'anual', valor: string) {
    const num = parseFloat(valor.replace(',', '.'))
    if (!valor.trim() || isNaN(num) || num <= 0) {
      // Restaurar valor desde BD
      const { data: rows } = await supabase.from('objetivos').select('tipo,importe').eq('tipo', tipo)
      if (rows && rows.length > 0) {
        setObjetivos(prev => ({ ...prev, [tipo]: Number((rows[0] as { tipo: string; importe: number }).importe) }))
        showToast('Objetivo restaurado', 'warning')
      }
      setEditandoObjetivo(null)
      return
    }
    const prevVal = objetivos[tipo]
    setObjetivos(prev => ({ ...prev, [tipo]: num }))
    setEditandoObjetivo(null)
    try {
      await supabase.from('objetivos').upsert({ tipo, importe: num }, { onConflict: 'tipo' })
      showToast('Objetivo actualizado', 'success')
    } catch {
      setObjetivos(prev => ({ ...prev, [tipo]: prevVal }))
      showToast('Error guardando objetivo', 'warning')
    }
  }

  /* ── derived data ──────────────────────────────────── */

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

  const desde = toLocalDateStr(fechaDesde)
  const hasta = toLocalDateStr(fechaHasta)

  const rowsPeriodo = useMemo(() =>
    data.filter(r => r.fecha >= desde && r.fecha <= hasta),
    [data, desde, hasta]
  )

  const ventasPeriodo  = useMemo(() => rowsPeriodo.reduce((a,r) => a + (r.total_bruto || 0), 0), [rowsPeriodo])
  const pedidosPeriodo = useMemo(() => rowsPeriodo.reduce((a,r) => a + (r.total_pedidos || 0), 0), [rowsPeriodo])
  const ticketMedioBruto = pedidosPeriodo > 0 ? ventasPeriodo / pedidosPeriodo : 0

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
      const { neto, margenPct: margen } = calcNetoPorCanal(c.id, bruto, pedidos)
      const pct = ventasPeriodo > 0 ? (bruto / ventasPeriodo) * 100 : 0
      const ticket = pedidos > 0 ? bruto / pedidos : 0
      return { id:c.id, label:c.label, color:c.color, bruto, neto, pct, pedidos, ticket, margen }
    })
  }, [rowsPeriodo, canalesFiltro, ventasPeriodo])

  const netoTotal = useMemo(() => canalStats.reduce((a, c) => a + c.neto, 0), [canalStats])
  const ticketMedioNeto = pedidosPeriodo > 0 ? netoTotal / pedidosPeriodo : 0

  const rowsSemana   = useMemo(() => data.filter(r => r.fecha >= weekStart && r.fecha <= weekEnd), [data, weekStart, weekEnd])
  const ventasSemana = useMemo(() => rowsSemana.reduce((a,r) => a + (r.total_bruto || 0), 0), [rowsSemana])
  const ventasMes    = useMemo(() => data.filter(r => r.fecha.startsWith(currentMonth)).reduce((a,r) => a + (r.total_bruto || 0), 0), [data, currentMonth])
  const ventasAno    = useMemo(() => data.filter(r => r.fecha.startsWith(currentYear)).reduce((a,r) => a + (r.total_bruto || 0), 0), [data, currentYear])

  const diasPico = useMemo(() => {
    const vals = [0,0,0,0,0,0,0]
    for (const r of rowsPeriodo) {
      if (!esDiaOperativo(r.fecha)) continue
      const d = parseLocalDate(r.fecha)
      const idx = (d.getDay() + 6) % 7
      vals[idx] += r.total_bruto || 0
    }
    return DIAS_NOMBRES.map((nombre,i) => ({ nombre, valor: vals[i], color: DIAS_COLORES[i] }))
  }, [rowsPeriodo, esDiaOperativo])

  const diasRestantesMesOp = useMemo(() => {
    const hoyD = new Date()
    const finMes = new Date(hoyD.getFullYear(), hoyD.getMonth() + 1, 0)
    const manana = new Date(hoyD)
    manana.setDate(hoyD.getDate() + 1)
    if (manana > finMes) return 0
    return diasOperativosEnRango(manana, finMes)
  }, [diasOperativosEnRango])

  /* ── estilos locales ───────────────────────────────── */

  const glovoStyle = {
    bg:     isDark ? '#1a1800' : '#fffbe0',
    brd:    isDark ? '#e8f442' : '#8a7800',
    tag:    isDark ? '#e8f442' : '#5a4000',
    dot:    '#e8f442',
    dotBrd: isDark ? undefined : '1px solid #8a7800',
  }

  const tabBtnStyle = (active: boolean): CSSProperties => active
    ? { background: T.pri, color: T.bg, border:'none', padding:'4px 10px', borderRadius:6, fontSize:11, cursor:'pointer', fontFamily:'Oswald,sans-serif', letterSpacing:'0.5px' }
    : { background:'none', color: T.sec, border:`0.5px solid ${T.brd}`, padding:'4px 10px', borderRadius:6, fontSize:11, cursor:'pointer', fontFamily:'Oswald,sans-serif', letterSpacing:'0.5px' }

  const dotStyle = (canalId: string, color: string): CSSProperties => {
    const isGlovo = canalId === 'glovo'
    return {
      width: 8, height: 8, borderRadius: '50%',
      background: isGlovo ? glovoStyle.dot : color,
      border: isGlovo ? glovoStyle.dotBrd : undefined,
      display: 'inline-block', flexShrink: 0,
    }
  }

  /* ── unused imports suppression ───────────────────── */
  void progressBgStyle
  void progressFillStyle

  /* ── loading / error ───────────────────────────────── */

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

  void topTab // top ventas sin mock — sin datos POS

  /* ── render ────────────────────────────────────────── */

  return (
    <div style={{ fontFamily: 'Lexend, sans-serif', position: 'relative' }}>

      {/* TOASTS */}
      <div style={{ position:'fixed', top:16, right:16, zIndex:9999, display:'flex', flexDirection:'column', gap:8, pointerEvents:'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: t.type === 'success' ? NETO_GREEN : '#f5a623',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontFamily: 'Lexend,sans-serif',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}>
            {t.msg}
          </div>
        ))}
      </div>

      {/* BANNER TAREAS ATRASADAS */}
      {!bannerDismissed && tareasAtrasadas.length > 0 && (
        <div style={{
          background: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontFamily: 'Lexend, sans-serif',
          fontSize: 13,
          color: '#111111',
          position: 'relative',
        }}>
          <span style={{ flexShrink: 0 }}>⚠️</span>
          <span style={{ flex: 1 }}>
            Tienes pendiente subir: <strong>{tareasAtrasadas.join(', ')}</strong>.
          </span>
          <button
            onClick={() => navigate('/importador')}
            style={{ background: '#B01D23', color: '#ffffff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontFamily: 'Oswald, sans-serif', fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}
          >Ir al Importador</button>
          <button
            onClick={dismissBanner}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontSize: 18, padding: '0 4px', flexShrink: 0, lineHeight: 1 }}
            title="Cerrar"
          >×</button>
        </div>
      )}

      <div style={groupStyle(T)}>

        {/* ═══════════════════════════════════════════════
            HEADER (T-M5-02)
            ═══════════════════════════════════════════════ */}
        <div style={{
          display:'flex',
          alignItems: isMobile ? 'flex-start' : 'center',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 10 : 16,
          marginBottom:20,
          flexWrap:'wrap',
        }}>
          {/* Título + subtítulo */}
          <div style={{ display:'flex', flexDirection:'column', gap:2, flexShrink:0 }}>
            <span style={{ ...tituloPaginaStyle(T), margin:0, fontSize:22, letterSpacing:'3px' }}>
              PANEL GLOBAL
            </span>
            <span style={{ fontFamily:'Lexend,sans-serif', fontSize:13, color:T.mut, lineHeight:1.3 }}>
              {fechaLabel} · {formatearFechaCorta(fechaDesde)} — {formatearFechaCorta(fechaHasta)}
            </span>
          </div>

          <div style={{ flex:1 }} />

          {/* SelectorFechaUniversal */}
          <div style={{ flexShrink:0 }}>
            <SelectorFechaUniversal
              nombreModulo="panel-global"
              defaultOpcion="mes_en_curso"
              onChange={handleFechaChange}
            />
          </div>

          {/* Dropdown Marcas */}
          <div style={{ position:'relative', flexShrink:0 }} data-drop="marca">
            <button
              onClick={() => { setDropMarcaOpen(p => !p); setDropCanalOpen(false) }}
              style={{ padding:'6px 10px', borderRadius:8, border:'0.5px solid #d0c8bc', background:'#fff', color:'#111', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:4, whiteSpace:'nowrap', fontFamily:'Lexend,sans-serif' }}
            >
              {marcasFiltro.length === 0 ? 'Todas las marcas' : marcasFiltro.length === 1 ? marcasFiltro[0] : `${marcasFiltro.length} marcas`} <span style={{ fontSize:10 }}>▾</span>
            </button>
            {dropMarcaOpen && (
              <div style={{ position:'absolute', right:0, top:38, background:'#fff', border:'0.5px solid #d0c8bc', borderRadius:8, width:200, zIndex:10, boxShadow:'0 4px 12px rgba(0,0,0,0.06)', overflow:'hidden' }}>
                {(marcasBD.length > 0 ? marcasBD : ['Streat Lab']).map(m => (
                  <label key={m} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', cursor:'pointer', fontSize:13, color: marcasFiltro.includes(m) ? '#FF4757' : '#7a8090', fontFamily:'Lexend,sans-serif', background: marcasFiltro.includes(m) ? '#FF475715' : 'transparent', fontWeight: marcasFiltro.includes(m) ? 500 : 400 }}>
                    <input type="checkbox" checked={marcasFiltro.includes(m)}
                      onChange={() => setMarcasFiltro(p => p.includes(m) ? p.filter(x => x !== m) : [...p, m])}
                      style={{ width:13, height:13 }} />
                    {m}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Dropdown Canales */}
          <div style={{ position:'relative', flexShrink:0 }} data-drop="canal">
            <button
              onClick={() => { setDropCanalOpen(p => !p); setDropMarcaOpen(false) }}
              style={{ padding:'6px 10px', borderRadius:8, border:'0.5px solid #d0c8bc', background:'#fff', color:'#111', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:4, whiteSpace:'nowrap', fontFamily:'Lexend,sans-serif' }}
            >
              {canalesFiltro.length === 0 ? 'Canales' : canalesFiltro.length === 1 ? CANALES.find(c => c.id === canalesFiltro[0])?.label ?? 'Canales' : `${canalesFiltro.length} canales`} <span style={{ fontSize:10 }}>▾</span>
            </button>
            {dropCanalOpen && (
              <div style={{ position:'absolute', right:0, top:38, background:'#fff', border:'0.5px solid #d0c8bc', borderRadius:8, width:200, zIndex:10, boxShadow:'0 4px 12px rgba(0,0,0,0.06)', overflow:'hidden' }}>
                {CANALES.map(c => (
                  <label key={c.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', cursor:'pointer', fontSize:13, color: canalesFiltro.includes(c.id) ? '#FF4757' : '#7a8090', fontFamily:'Lexend,sans-serif', background: canalesFiltro.includes(c.id) ? '#FF475715' : 'transparent', fontWeight: canalesFiltro.includes(c.id) ? 500 : 400 }}>
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

        {/* ═══════════════════════════════════════════════
            TABS (T-M5-03) — light theme literal per spec
            ═══════════════════════════════════════════════ */}
        <div style={{
          background: '#fff',
          border: '0.5px solid #d0c8bc',
          borderRadius: 14,
          padding: '14px 18px',
          marginBottom: 18,
          display: 'inline-flex',
          gap: 8,
        }}>
          {MAIN_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setMainTab(tab.id as MainTab)}
              style={mainTab === tab.id ? {
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                background: '#FF4757',
                color: '#fff',
                fontFamily: 'Lexend, sans-serif',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              } : {
                padding: '6px 14px',
                borderRadius: 6,
                border: '0.5px solid #d0c8bc',
                background: 'transparent',
                color: '#3a4050',
                fontFamily: 'Lexend, sans-serif',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════
            TAB: RESUMEN v2 (spec-panel-resumen-v2.md)
            ═══════════════════════════════════════════════ */}
        {mainTab === 'resumen' && (
          <TabResumen
            rowsPeriodo={diaSemanaFiltro != null
              ? rowsPeriodo.filter(r => ((parseLocalDate(r.fecha).getDay() + 6) % 7) === diaSemanaFiltro)
              : rowsPeriodo}
            rowsAll={data}
            fechaDesde={fechaDesde}
            fechaHasta={fechaHasta}
            canalesFiltro={canalesFiltro}
            onFiltrarDiaSemana={(idx) => setDiaSemanaFiltro(prev => prev === idx ? null : idx)}
          />
        )}


        {/* ═══════════════════════════════════════════════
            TAB: OPERACIONES (T-M5-07)
            ═══════════════════════════════════════════════ */}
        {mainTab === 'operaciones' && (
          <div style={{ padding:'20px 0' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3.5" style={{ marginBottom:20 }}>
              {(() => {
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
                  { label:'Pedidos totales', value:Math.round(totalPed).toLocaleString('es-ES'), sub: pedDelta !== null ? `${pedDelta >= 0 ? '▲' : '▼'} ${Math.abs(pedDelta).toFixed(1)}% vs anterior` : undefined },
                  { label:'Ticket medio', value:fmtEur(tm), sub: tmDelta !== null ? `${tmDelta >= 0 ? '▲' : '▼'} ${Math.abs(tmDelta).toFixed(1)}% vs anterior` : undefined },
                  { label:'Canal top', value:topCanal?.label ?? '—', sub: topCanal ? fmtEur(topCanal.bruto) : undefined },
                ].map(kpi => (
                  <div key={kpi.label} style={cardStyle(T)}>
                    <div style={{ fontFamily:'Oswald,sans-serif', fontSize:10, letterSpacing:'1.5px', textTransform:'uppercase', color:T.mut, marginBottom:6 }}>{kpi.label}</div>
                    <div style={{ fontFamily:'Oswald,sans-serif', fontSize:22, fontWeight:600, color:T.pri }}>{kpi.value}</div>
                    {kpi.sub && <div style={{ fontSize:11, color:T.sec, marginTop:4 }}>{kpi.sub}</div>}
                  </div>
                ))
              })()}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5" style={{ marginBottom:20 }}>

              {/* Heatmap franjas horarias — stub */}
              <div style={cardStyle(T)}>
                <div style={{ ...sectionLabelStyle(T), marginBottom:12 }}>Pedidos por franja horaria</div>
                <div style={{ fontSize:12, color:T.mut, marginBottom:12, fontFamily:'Lexend,sans-serif' }}>
                  Pendiente: requiere integración POS o columna hora en facturacion_diario.
                </div>
                {[
                  { label:'Mañana',   sub:'8-12h',   color:'#66aaff' },
                  { label:'Mediodía', sub:'12-16h',  color:'#f5a623' },
                  { label:'Tarde',    sub:'16-19h',  color:'#B01D23' },
                  { label:'Noche',    sub:'19-24h',  color:'#1E5BCC' },
                ].map(franja => (
                  <div key={franja.label} style={{ marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                      <span style={{ fontFamily:'Lexend,sans-serif', fontSize:13, color:T.sec }}>{franja.label} <span style={{ color:T.mut, fontSize:11 }}>{franja.sub}</span></span>
                      <span style={{ fontFamily:'Oswald,sans-serif', fontSize:12, color:franja.color }}>—</span>
                    </div>
                    <div style={{ height:6, background:T.brd, borderRadius:3 }} />
                  </div>
                ))}
              </div>

              {/* Donut ALM vs CENA — stub */}
              <div style={cardStyle(T)}>
                <div style={{ ...sectionLabelStyle(T), marginBottom:12 }}>Ratio Almuerzo vs Cena</div>
                <div style={{ fontSize:12, color:T.mut, fontFamily:'Lexend,sans-serif', marginBottom:12 }}>
                  Pendiente: columna servicio/hora en facturacion_diario.
                </div>
                <div style={{ display:'flex', gap:16 }}>
                  {[
                    { label:'Almuerzo', color:'#f5a623' },
                    { label:'Cena',     color:'#1E5BCC' },
                  ].map(s => (
                    <div key={s.label} style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ width:10, height:10, borderRadius:'50%', background:s.color }} />
                      <span style={{ fontFamily:'Lexend,sans-serif', fontSize:13, color:T.sec }}>{s.label}</span>
                      <span style={{ fontFamily:'Oswald,sans-serif', fontSize:14, fontWeight:600, color:T.pri }}>—</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mix canales */}
              <div style={cardStyle(T)}>
                <div style={{ ...sectionLabelStyle(T), marginBottom:12 }}>Mix canales</div>
                {canalStats.filter(c => c.bruto > 0).sort((a, b) => b.bruto - a.bruto).map(c => (
                  <div key={c.id} style={{ marginBottom:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                      <span style={{ fontFamily:'Lexend,sans-serif', fontSize:12, color:T.sec }}>{c.label}</span>
                      <span style={{ fontFamily:'Oswald,sans-serif', fontSize:13, fontWeight:600, color:c.color }}>{c.pct.toFixed(1)}%</span>
                    </div>
                    <div style={{ height:4, background:T.brd, borderRadius:2 }}>
                      <div style={{ height:4, width:`${Math.min(c.pct, 100)}%`, background:c.color, borderRadius:2 }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* KPI repetición */}
              <div style={cardStyle(T)}>
                <div style={{ ...sectionLabelStyle(T), marginBottom:12 }}>Repetición de clientes</div>
                <div style={{ fontFamily:'Lexend,sans-serif', fontSize:13, color:T.mut }}>
                  Pendiente integración POS (Sinqro) para datos de cliente_id y repetición.
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            TAB: FINANZAS (T-M5-08)
            ═══════════════════════════════════════════════ */}
        {mainTab === 'finanzas' && (
          <div style={{ padding:'20px 0' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3.5" style={{ marginBottom:20 }}>
              {(() => {
                const comisionesTotal = canalStats.reduce((a, c) => a + (c.bruto - c.neto), 0)
                const ratioGastos = netoTotal > 0 ? (comisionesTotal / netoTotal) * 100 : 0
                const semColor = ratioGastos <= 65 ? NETO_GREEN : ratioGastos <= 75 ? '#f5a623' : '#E24B4A'
                const margenReal = ventasPeriodo > 0 ? (netoTotal / ventasPeriodo) * 100 : 0
                return [
                  { label:'Ingresos brutos',     value:fmtEur(ventasPeriodo),        color:NETO_GREEN,  sub:undefined },
                  { label:'Comisiones plataformas', value:fmtEur(comisionesTotal),   color:'#f5a623',   sub:undefined },
                  { label:'Ingresos netos',       value:fmtEur(netoTotal),           color:'#e8f442',   sub:undefined },
                  { label:'Ratio gastos/netos',   value:`${ratioGastos.toFixed(1)}%`, color:semColor,   sub: ratioGastos <= 65 ? 'OK' : ratioGastos <= 75 ? 'Atención' : 'Crítico' },
                  { label:'Margen real validado', value:`${margenReal.toFixed(1)}%`, color:NETO_GREEN,  sub:'Banca: sin validar' },
                ].map(item => (
                  <div key={item.label} style={cardStyle(T)}>
                    <div style={{ fontFamily:'Oswald,sans-serif', fontSize:10, letterSpacing:'1.5px', textTransform:'uppercase', color:T.mut, marginBottom:6 }}>{item.label}</div>
                    <div style={{ fontFamily:'Oswald,sans-serif', fontSize:22, fontWeight:600, color:item.color }}>{item.value}</div>
                    {item.sub && <div style={{ fontSize:11, color:T.mut, marginTop:4 }}>{item.sub}</div>}
                  </div>
                ))
              })()}
            </div>

            {/* Comisiones desglose */}
            <div style={{ ...cardStyle(T), marginBottom:14 }}>
              <div style={{ ...sectionLabelStyle(T), marginBottom:12 }}>Comisiones por plataforma</div>
              {canalStats.filter(c => c.bruto > 0).map(c => {
                const com = c.bruto - c.neto
                return (
                  <div key={c.id} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
                    <span style={dotStyle(c.id, c.color)} />
                    <span style={{ fontFamily:'Lexend,sans-serif', fontSize:12, color:T.sec, minWidth:80 }}>{c.label}</span>
                    <div style={{ height:4, flex:1, background:T.brd, borderRadius:2 }}>
                      <div style={{ height:4, width:`${c.pct > 0 ? Math.min(c.pct,100) : 0}%`, background:c.color, borderRadius:2 }} />
                    </div>
                    <span style={{ fontFamily:'Oswald,sans-serif', fontSize:13, fontWeight:600, color:'#f5a623', minWidth:70, textAlign:'right' }}>{fmtEur(com)}</span>
                    <span style={{ fontFamily:'Lexend,sans-serif', fontSize:11, color:T.mut, minWidth:50, textAlign:'right' }}>
                      {c.bruto > 0 ? ((com/c.bruto)*100).toFixed(1) : 0}%
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Distribución neto */}
            <div style={{ ...cardStyle(T), marginBottom:14 }}>
              <div style={{ ...sectionLabelStyle(T), marginBottom:12 }}>Distribución neto por canal</div>
              {canalStats.filter(c => c.neto > 0).sort((a, b) => b.neto - a.neto).map(c => (
                <div key={c.id} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
                  <span style={{ fontFamily:'Lexend,sans-serif', fontSize:12, color:T.sec, minWidth:80 }}>{c.label}</span>
                  <div style={{ height:4, flex:1, background:T.brd, borderRadius:2 }}>
                    <div style={{ height:4, width:`${Math.min(c.pct, 100)}%`, background:c.color, borderRadius:2 }} />
                  </div>
                  <span style={{ fontFamily:'Oswald,sans-serif', fontSize:13, fontWeight:600, color:c.color, minWidth:70, textAlign:'right' }}>{fmtEur(c.neto)}</span>
                </div>
              ))}
            </div>

            {/* Comparativa vs objetivos */}
            <div style={{ ...cardStyle(T), marginBottom:14 }}>
              <div style={{ ...sectionLabelStyle(T), marginBottom:12 }}>Comparativa vs Objetivos</div>
              {([['Mensual', ventasMes, objetivos.mensual], ['Anual', ventasAno, objetivos.anual]] as [string, number, number][]).map(([label, real, obj]) => {
                const pct = obj > 0 ? Math.min(100, (real/obj)*100) : 0
                return (
                  <div key={label} style={{ marginBottom:12 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontFamily:'Oswald,sans-serif', fontSize:12, color:T.sec, letterSpacing:'1px', textTransform:'uppercase' }}>{label}</span>
                      <div style={{ display:'flex', gap:12 }}>
                        <span style={{ fontFamily:'Oswald,sans-serif', fontSize:13, color:NETO_GREEN }}>Real: {fmtEur(real)}</span>
                        <span style={{ fontFamily:'Oswald,sans-serif', fontSize:13, color:T.mut }}>Obj: {fmtEur(obj)}</span>
                      </div>
                    </div>
                    <div style={{ height:8, background:T.brd, borderRadius:4 }}>
                      <div style={{ height:8, width:`${pct}%`, background: semaforoColor(pct), borderRadius:4 }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ADS tabla */}
            <div style={cardStyle(T)}>
              <div style={{ ...sectionLabelStyle(T), marginBottom:8 }}>ADS por marca/canal (informativo)</div>
              <div style={{ fontSize:11, color:T.mut, fontFamily:'Lexend,sans-serif', marginBottom:12 }}>
                Gasto en publicidad pagada (Uber Ads, Glovo Promo, etc.). Informativo. NO afecta margen real.
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'Lexend,sans-serif', fontSize:12 }}>
                  <thead>
                    <tr>
                      {['Marca','Canal','ADS mes','ADS últ 3 meses'].map(h => (
                        <th key={h} style={{ padding:'6px 10px', textAlign:'left', fontFamily:'Oswald,sans-serif', fontSize:10, letterSpacing:'1px', textTransform:'uppercase', color:T.mut, borderBottom:`1px solid ${T.brd}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={4} style={{ padding:'16px 10px', color:T.mut, textAlign:'center', fontFamily:'Lexend,sans-serif', fontSize:12 }}>
                        Pendiente subir resúmenes mensuales de plataformas (FASE 7 Importador).
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            TAB: CASHFLOW (T-M5-09)
            ═══════════════════════════════════════════════ */}
        {mainTab === 'cashflow' && (
          <div style={{ padding:'20px 0' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5" style={{ marginBottom:20 }}>

              {/* Cobros pendientes */}
              <div style={cardStyle(T)}>
                <div style={{ ...sectionLabelStyle(T), marginBottom:12 }}>Cobros pendientes</div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'Lexend,sans-serif', fontSize:12 }}>
                    <thead>
                      <tr>
                        {['Plataforma','Periodo','Bruto','Neto est.','Fecha pago'].map(h => (
                          <th key={h} style={{ padding:'5px 8px', textAlign:'left', fontFamily:'Oswald,sans-serif', fontSize:9, letterSpacing:'1px', textTransform:'uppercase', color:T.mut, borderBottom:`1px solid ${T.brd}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {canalStats.filter(c => c.bruto > 0 && c.id !== 'dir').map(c => {
                        const diasLiq = c.id === 'uber' ? 14 : c.id === 'glovo' ? 14 : c.id === 'je' ? 28 : 7
                        return (
                          <tr key={c.id}>
                            <td style={{ padding:'6px 8px', color:c.color, fontFamily:'Oswald,sans-serif', borderBottom:`0.5px solid ${T.brd}` }}>{c.label}</td>
                            <td style={{ padding:'6px 8px', color:T.sec, borderBottom:`0.5px solid ${T.brd}` }}>{fechaLabel}</td>
                            <td style={{ padding:'6px 8px', color:T.pri, textAlign:'right', borderBottom:`0.5px solid ${T.brd}` }}>{fmtEur(c.bruto)}</td>
                            <td style={{ padding:'6px 8px', color:NETO_GREEN, textAlign:'right', fontFamily:'Oswald,sans-serif', borderBottom:`0.5px solid ${T.brd}` }}>{fmtEur(c.neto)}</td>
                            <td style={{ padding:'6px 8px', color:T.mut, borderBottom:`0.5px solid ${T.brd}` }}>~{diasLiq}d</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagos pendientes */}
              <div style={cardStyle(T)}>
                <div style={{ ...sectionLabelStyle(T), marginBottom:12 }}>Pagos pendientes</div>
                <div style={{ fontSize:12, color:T.mut, fontFamily:'Lexend,sans-serif', marginBottom:8 }}>
                  Pendiente: integrar tabla gastos_fijos y facturas con pagada=false + fecha_vencimiento.
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'Lexend,sans-serif', fontSize:12 }}>
                    <thead>
                      <tr>
                        {['Proveedor','Concepto','Importe','Vencimiento','Tipo'].map(h => (
                          <th key={h} style={{ padding:'5px 8px', textAlign:'left', fontFamily:'Oswald,sans-serif', fontSize:9, letterSpacing:'1px', textTransform:'uppercase', color:T.mut, borderBottom:`1px solid ${T.brd}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td colSpan={5} style={{ padding:'16px 8px', color:T.mut, textAlign:'center' }}>
                          Sin datos. Conectar gastos_fijos.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Provisiones IVA / IRPF */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5" style={{ marginBottom:20 }}>
              <div style={cardStyle(T)}>
                <div style={{ fontFamily:'Oswald,sans-serif', fontSize:10, letterSpacing:'1.5px', textTransform:'uppercase', color:T.mut, marginBottom:6 }}>Provisión IVA</div>
                <div style={{ fontFamily:'Oswald,sans-serif', fontSize:22, fontWeight:600, color:'#66aaff' }}>{fmtEur(netoTotal * 0.21)}</div>
                <div style={{ fontFamily:'Lexend,sans-serif', fontSize:11, color:T.mut, marginTop:4 }}>21% × ingresos netos periodo (estimado)</div>
              </div>
              <div style={cardStyle(T)}>
                <div style={{ fontFamily:'Oswald,sans-serif', fontSize:10, letterSpacing:'1.5px', textTransform:'uppercase', color:T.mut, marginBottom:6 }}>Provisión IRPF</div>
                <div style={{ fontFamily:'Oswald,sans-serif', fontSize:22, fontWeight:600, color:'#9ba8c0' }}>{fmtEur(ventasPeriodo * 0.02)}</div>
                <div style={{ fontFamily:'Lexend,sans-serif', fontSize:11, color:T.mut, marginTop:4 }}>19% retención alquiler (estimado)</div>
              </div>
            </div>

            {/* Saldo proyectado 5 puntos */}
            <div style={{ ...cardStyle(T), marginBottom:14 }}>
              <div style={{ ...sectionLabelStyle(T), marginBottom:16 }}>Saldo proyectado</div>
              {(() => {
                const cobros = netoTotal
                const puntos = [
                  { label:'Hoy',  saldo:0 },
                  { label:'+7d', saldo:cobros * 0.3 },
                  { label:'+30d', saldo:cobros * 0.9 },
                  { label:'+3m', saldo:cobros * 0.7 },
                  { label:'+6m', saldo:cobros * 0.5 },
                ]
                const maxSaldo = Math.max(...puntos.map(p => p.saldo), 1)
                return (
                  <div style={{ display:'flex', alignItems:'flex-end', height:80, paddingBottom:24, position:'relative' }}>
                    {puntos.map((p, idx) => {
                      const h = Math.max(Math.round((p.saldo / maxSaldo) * 60), 4)
                      return (
                        <div key={p.label} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                          <span style={{ fontFamily:'Oswald,sans-serif', fontSize:10, color:T.mut }}>{p.saldo > 0 ? fmtEur(p.saldo).replace(' €','') : '—'}</span>
                          <div style={{ height:60, display:'flex', alignItems:'flex-end', width:'100%', justifyContent:'center' }}>
                            <div style={{ width:'60%', height:h, background: idx === 0 ? T.brd : NETO_GREEN, borderRadius:'3px 3px 0 0', opacity: p.saldo > 0 ? 0.8 : 0.3 }} />
                          </div>
                          <span style={{ fontFamily:'Lexend,sans-serif', fontSize:10, color:T.mut }}>{p.label}</span>
                        </div>
                      )
                    })}
                    <div style={{ position:'absolute', bottom:24, left:0, right:0, height:1, background:T.brd, pointerEvents:'none' }} />
                  </div>
                )
              })()}
              <div style={{ fontSize:11, color:T.mut, marginTop:8, fontFamily:'Lexend,sans-serif' }}>
                Proyección basada en cobros pendientes estimados. Conectar gastos_fijos para mayor precisión.
              </div>
            </div>

            {/* Calendario pagos críticos 90d */}
            <div style={cardStyle(T)}>
              <div style={{ ...sectionLabelStyle(T), marginBottom:12 }}>Pagos críticos próximos 90 días</div>
              <div style={{ fontSize:12, color:T.mut, fontFamily:'Lexend,sans-serif' }}>
                Pendiente: integrar gastos_fijos con fecha_vencimiento para listar pagos &gt;500€.
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            TAB: MARCAS (T-M5-10)
            ═══════════════════════════════════════════════ */}
        {mainTab === 'marcas' && (() => {
          const agrupado: Record<string, Record<string, { bruto: number; neto: number; pedidos: number }>> = {}
          let totalGlobal = 0
          for (const v of ventasPlataforma) {
            if (!agrupado[v.marca]) agrupado[v.marca] = {}
            if (!agrupado[v.marca][v.plataforma]) agrupado[v.marca][v.plataforma] = { bruto:0, neto:0, pedidos:0 }
            agrupado[v.marca][v.plataforma].bruto   += v.bruto ?? 0
            agrupado[v.marca][v.plataforma].neto    += v.neto ?? 0
            agrupado[v.marca][v.plataforma].pedidos += v.pedidos ?? 0
            totalGlobal += v.bruto ?? 0
          }

          const marcasOrdenadas = Object.entries(agrupado)
            .map(([marca, canales]) => ({
              marca,
              totalBruto: Object.values(canales).reduce((a, c) => a + c.bruto, 0),
              totalNeto:  Object.values(canales).reduce((a, c) => a + c.neto, 0),
              canales,
            }))
            .sort((a, b) => b.totalBruto - a.totalBruto)
            .slice(0, 10)

          if (marcasOrdenadas.length === 0) {
            return (
              <div style={{ padding:'32px 0', textAlign:'center' }}>
                <div style={{ fontFamily:'Lexend,sans-serif', fontSize:14, color:T.mut, marginBottom:12 }}>
                  Pendiente subir resúmenes Uber/Glovo/Just Eat por marca. Ir al Importador →
                </div>
                <div style={{ fontSize:12, color:T.mut, fontFamily:'Lexend,sans-serif' }}>
                  Esta tab mostrará matriz Marca×Canal, top 5, márgenes y evolución mensual cuando FASE 7 esté activa.
                </div>
              </div>
            )
          }

          const PLATAFORMAS_COLS = [
            { id:'uber',     label:'Uber Eats', color:'#06C167' },
            { id:'glovo',    label:'Glovo',     color:'#e8f442' },
            { id:'just_eat', label:'Just Eat',  color:'#f5a623' },
            { id:'rushour',  label:'RushHour',  color:'#7F77DD' },
          ]

          const thStyle: CSSProperties = {
            padding:'8px 10px', textAlign:'right' as const,
            fontFamily:'Oswald,sans-serif', fontSize:10, letterSpacing:'1px',
            textTransform:'uppercase' as const, color:T.mut, borderBottom:`1px solid ${T.brd}`,
          }

          return (
            <div style={{ padding:'20px 0' }}>
              <div style={{ fontFamily:'Oswald,sans-serif', fontSize:10, letterSpacing:'2px', textTransform:'uppercase', color:T.mut, marginBottom:16 }}>
                Vista marca × canal · últimos 90 días
              </div>
              <div style={{ overflowX:'auto', marginBottom:24 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'Lexend,sans-serif', fontSize:12 }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, textAlign:'left', padding:'8px 12px' }}>Marca</th>
                      {PLATAFORMAS_COLS.map(c => (
                        <th key={c.id} style={{ ...thStyle, color: c.id === 'glovo' ? '#aabc00' : c.color }}>{c.label}</th>
                      ))}
                      <th style={{ ...thStyle, color:T.pri }}>Total bruto</th>
                      <th style={thStyle}>Margen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marcasOrdenadas.map(({ marca, totalBruto, totalNeto, canales }) => {
                      const margenPct = totalBruto > 0 ? (totalNeto / totalBruto) * 100 : 0
                      return (
                        <tr key={marca}>
                          <td style={{ padding:'10px 12px', color:T.pri, borderBottom:`0.5px solid ${T.brd}`, fontWeight:500 }}>{marca}</td>
                          {PLATAFORMAS_COLS.map(c => {
                            const cel = canales[c.id]
                            const celBruto = cel?.bruto ?? 0
                            const intensity = totalGlobal > 0 ? celBruto / totalGlobal : 0
                            const alpha = Math.min(Math.round(intensity * 800), 220)
                            const alphaHex = alpha.toString(16).padStart(2, '0')
                            return (
                              <td key={c.id} style={{
                                padding:'10px 10px', textAlign:'right', borderBottom:`0.5px solid ${T.brd}`,
                                background: celBruto > 0 ? `${c.color}${alphaHex}` : 'transparent',
                                color: celBruto > 0 ? T.pri : T.mut,
                              }}>
                                {celBruto > 0 ? fmtEur(celBruto) : '—'}
                              </td>
                            )
                          })}
                          <td style={{ padding:'10px 12px', textAlign:'right', fontFamily:'Oswald,sans-serif', fontWeight:600, color:T.pri, borderBottom:`0.5px solid ${T.brd}` }}>
                            {fmtEur(totalBruto)}
                          </td>
                          <td style={{
                            padding:'10px 10px', textAlign:'right', borderBottom:`0.5px solid ${T.brd}`,
                            color: margenPct > 20 ? NETO_GREEN : margenPct > 10 ? '#f5a623' : '#E24B4A',
                            fontFamily:'Oswald,sans-serif', fontSize:12,
                          }}>
                            {margenPct.toFixed(1)}%
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ fontFamily:'Oswald,sans-serif', fontSize:10, letterSpacing:'2px', textTransform:'uppercase', color:T.mut, marginBottom:10 }}>Top 5 marcas (bruto)</div>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                {marcasOrdenadas.slice(0, 5).map(({ marca, totalBruto, totalNeto }, i) => {
                  const margenPct = totalBruto > 0 ? (totalNeto / totalBruto) * 100 : 0
                  return (
                    <div key={marca} style={{ background:T.card, border:`0.5px solid ${T.brd}`, borderRadius:10, padding:'12px 16px', minWidth:140 }}>
                      <div style={{ fontFamily:'Oswald,sans-serif', fontSize:10, color:T.mut, letterSpacing:'1px' }}>#{i+1}</div>
                      <div style={{ fontFamily:'Lexend,sans-serif', fontSize:13, color:T.pri, fontWeight:600, marginTop:2 }}>{marca}</div>
                      <div style={{ fontFamily:'Oswald,sans-serif', fontSize:16, color:'#B01D23', marginTop:4 }}>{fmtEur(totalBruto)}</div>
                      <div style={{ fontFamily:'Lexend,sans-serif', fontSize:11, color: margenPct > 15 ? NETO_GREEN : '#f5a623', marginTop:2 }}>
                        Margen {margenPct.toFixed(1)}%
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

      </div>
    </div>
  )
}
