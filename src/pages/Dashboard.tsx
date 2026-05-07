import { useEffect, useState, useMemo, useCallback, type CSSProperties } from 'react'
import { ChevronDown } from 'lucide-react'
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
import { calcNetoPorCanal, loadConfigCanales, type CanalConfig as ConfigCanalRow } from '@/lib/panel/calcNetoPlataforma'
import TabResumen from '@/components/panel/resumen/TabResumen'

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

interface ToastMsg { id: number; msg: string; type: 'success' | 'warning' }

export default function Dashboard() {
  const { T, isDark } = useTheme()
  const { diasOperativosEnRango, esDiaOperativo } = useCalendario()
  const navigate = useNavigate()

  const [data, setData] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [fechaDesde, setFechaDesde] = useState<Date>(() => {
    const now = new Date(); const dow = now.getDay() || 7
    const monday = new Date(now); monday.setDate(now.getDate() - dow + 1); return monday
  })
  const [fechaHasta, setFechaHasta] = useState<Date>(new Date())
  const [fechaLabel, setFechaLabel] = useState('Semana actual')

  const [marcasBD, setMarcasBD] = useState<string[]>([])
  const [configCanales, setConfigCanales] = useState<Record<string, ConfigCanalRow>>({})
  const [marcasActivas, setMarcasActivas] = useState<number>(1)

  useEffect(() => {
    loadConfigCanales().then(setConfigCanales)
    supabase.from('marcas').select('id', { count: 'exact', head: true }).eq('activo', true)
      .then(({ count }) => { if (count && count > 0) setMarcasActivas(count) })
  }, [])
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

  const [tareasAtrasadas, setTareasAtrasadas] = useState<string[]>([])
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const hoy = new Date().toISOString().slice(0, 10)
    return localStorage.getItem(`banner_tareas_dismissed_${hoy}`) === '1'
  })

  const showToast = useCallback((msg: string, type: 'success' | 'warning') => {
    const id = Date.now()
    setToasts(p => [...p, { id, msg, type }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000)
  }, [])

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

  const handleFechaChange = useCallback((desde: Date, hasta: Date, label: string) => {
    setFechaDesde(desde)
    setFechaHasta(hasta)
    setFechaLabel(label)
  }, [])

  async function guardarObjetivo(tipo: 'semanal'|'mensual'|'anual', valor: string) {
    const num = parseFloat(valor.replace(',', '.'))
    if (!valor.trim() || isNaN(num) || num <= 0) {
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
      const { neto, margenPct: margen } = calcNetoPorCanal(c.id, bruto, pedidos, marcasActivas, fechaDesde, fechaHasta, configCanales)
      const pct = ventasPeriodo > 0 ? (bruto / ventasPeriodo) * 100 : 0
      const ticket = pedidos > 0 ? bruto / pedidos : 0
      return { id:c.id, label:c.label, color:c.color, bruto, neto, pct, pedidos, ticket, margen }
    })
  }, [rowsPeriodo, canalesFiltro, ventasPeriodo, configCanales, marcasActivas, fechaDesde, fechaHasta])

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

  void progressBgStyle
  void progressFillStyle

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

  void topTab

  return (
    <div style={{ fontFamily: 'Lexend, sans-serif', position: 'relative' }}>

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

      {!bannerDismissed && tareasAtrasadas.length > 0 && (
        <div style={{
          background: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: 8,
          padding: '8px 16px',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontFamily: 'Lexend, sans-serif',
          fontSize: 13,
          color: '#111111',
          position: 'relative',
        }}>
          <span style={{ flexShrink: 0, fontSize: 14 }}>⚠️</span>
          <span style={{ flex: 1, fontSize: 13 }}>
            Tienes pendiente subir: <strong>{tareasAtrasadas.join(', ')}</strong>.
          </span>
          <button
            onClick={() => navigate('/importador')}
            style={{ background: '#B01D23', color: '#ffffff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontFamily: 'Oswald, sans-serif', fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}
          >Ir al Importador</button>
          <button
            onClick={dismissBanner}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontSize: 16, padding: '0 4px', flexShrink: 0, lineHeight: 1 }}
            title="Cerrar"
          >×</button>
        </div>
      )}

      <div style={groupStyle(T)}>

        <div style={{
          display:'flex',
          alignItems: isMobile ? 'flex-start' : 'center',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 10 : 16,
          marginBottom:20,
          flexWrap:'wrap',
        }}>
          <div style={{ display:'flex', flexDirection:'column', gap:2, flexShrink:0 }}>
            <span style={{ ...tituloPaginaStyle(T), margin:0, fontSize:22, letterSpacing:'3px' }}>
              PANEL GLOBAL
            </span>
            <span style={{ fontFamily:'Lexend,sans-serif', fontSize:13, color:T.mut, lineHeight:1.3 }}>
              {fechaLabel} · {formatearFechaCorta(fechaDesde)} — {formatearFechaCorta(fechaHasta)}
            </span>
          </div>

          <div style={{ flex:1 }} />

          <div style={{ flexShrink:0 }}>
            <SelectorFechaUniversal
              nombreModulo="panel-global"
              defaultOpcion="mes_en_curso"
              onChange={handleFechaChange}
            />
          </div>

          <div style={{ position:'relative', flexShrink:0 }} data-drop="marca">
            <button
              onClick={() => { setDropMarcaOpen(p => !p); setDropCanalOpen(false) }}
              style={{ padding:'6px 10px', borderRadius:8, border:'0.5px solid #d0c8bc', background:'#fff', color:'#111', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:4, whiteSpace:'nowrap', fontFamily:'Lexend,sans-serif' }}
            >
              <span>{marcasFiltro.length === 0 ? 'Todas las marcas' : marcasFiltro.length === 1 ? marcasFiltro[0] : `${marcasFiltro.length} marcas`}</span><ChevronDown size={11} strokeWidth={2.5} style={{ marginLeft: 4 }} />
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

          <div style={{ position:'relative', flexShrink:0 }} data-drop="canal">
            <button
              onClick={() => { setDropCanalOpen(p => !p); setDropMarcaOpen(false) }}
              style={{ padding:'6px 10px', borderRadius:8, border:'0.5px solid #d0c8bc', background:'#fff', color:'#111', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:4, whiteSpace:'nowrap', fontFamily:'Lexend,sans-serif' }}
            >
              <span>{canalesFiltro.length === 0 ? 'Canales' : canalesFiltro.length === 1 ? CANALES.find(c => c.id === canalesFiltro[0])?.label ?? 'Canales' : `${canalesFiltro.length} canales`}</span><ChevronDown size={11} strokeWidth={2.5} style={{ marginLeft: 4 }} />
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
          </div>
        )}

        {mainTab === 'finanzas' && <div style={{ padding:'20px 0', color:T.mut }}>Finanzas tab — usa Running para PyG completo.</div>}
        {mainTab === 'cashflow' && <div style={{ padding:'20px 0', color:T.mut }}>Cashflow tab</div>}
        {mainTab === 'marcas' && <div style={{ padding:'20px 0', color:T.mut }}>Marcas tab</div>}

      </div>
    </div>
  )
}
