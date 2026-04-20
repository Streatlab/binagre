import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'

/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */

interface Row {
  fecha: string; servicio: string
  uber_pedidos: number; uber_bruto: number
  glovo_pedidos: number; glovo_bruto: number
  je_pedidos: number; je_bruto: number
  web_pedidos: number; web_bruto: number
  directa_pedidos: number; directa_bruto: number
  total_pedidos: number; total_bruto: number
}
interface CanalStat { nombre: string; bruto: number; neto: number; pct: number; pedidos: number }
interface WeekBar { label: string; total: number; uber: number; glovo: number; je: number; web: number; directa: number; isCurrent: boolean }

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════ */

const SELECT = 'fecha,servicio,uber_pedidos,uber_bruto,glovo_pedidos,glovo_bruto,je_pedidos,je_bruto,web_pedidos,web_bruto,directa_pedidos,directa_bruto,total_pedidos,total_bruto'

const CANAL_COLOR: Record<string, string> = {
  'Uber Eats':     '#06C167',
  'Glovo':         '#e8f442',
  'Just Eat':      '#f5a623',
  'Web Propia':    '#B01D23',
  'Venta Directa': '#66aaff',
}

const COMISION: Record<string, { pct: number; fijo: number }> = {
  'Uber Eats':     { pct: 0.30, fijo: 0.82 },
  'Glovo':         { pct: 0.25, fijo: 0.75 },
  'Just Eat':      { pct: 0.20, fijo: 0.75 },
  'Web Propia':    { pct: 0.07, fijo: 0.50 },
  'Venta Directa': { pct: 0.00, fijo: 0.00 },
}

const TOP_PRODUCTOS_MOCK = [
  { nombre: 'Ramen Warriors',      canal: 'Uber Eats',      uds: 42, total: 796 },
  { nombre: 'KFC Gochujang',       canal: 'Glovo',          uds: 38, total: 570 },
  { nombre: 'Cocido Madrileño',    canal: 'Uber Eats',      uds: 29, total: 782 },
  { nombre: 'Katsu Curry',         canal: 'Just Eat',       uds: 26, total: 481 },
  { nombre: 'Fish & Chips',        canal: 'Web Propia',     uds: 22, total: 328 },
  { nombre: 'Cachopo Ternera',     canal: 'Uber Eats',      uds: 18, total: 359 },
  { nombre: 'Milanesa Napolitana', canal: 'Venta Directa',  uds: 15, total: 319 },
]

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

const todayStr = () => new Date().toISOString().slice(0, 10)

function startOfWeekStr(): string {
  const now = new Date()
  const day = now.getDay() || 7
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(now.getDate() - day + 1)
  return d.toISOString().slice(0, 10)
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

function sumRows(rows: Row[]): { pedidos: number; bruto: number } {
  let pedidos = 0, bruto = 0
  for (const r of rows) { pedidos += r.total_pedidos || 0; bruto += r.total_bruto || 0 }
  return { pedidos, bruto }
}

function sumCanal(rows: Row[], ped: keyof Row, bru: keyof Row): { pedidos: number; bruto: number } {
  let pedidos = 0, bruto = 0
  for (const r of rows) { pedidos += (r[ped] as number) || 0; bruto += (r[bru] as number) || 0 }
  return { pedidos, bruto }
}

function calcNeto(bruto: number, pedidos: number, canal: string): number {
  const c = COMISION[canal]
  if (!c) return bruto
  return Math.max(0, bruto * (1 - c.pct) - pedidos * c.fijo)
}

function rangoFecha(periodo: string): { desde: string; hasta: string } {
  const hoy = new Date()
  const hasta = hoy.toISOString().slice(0, 10)
  const sub = (d: number) => { const x = new Date(hoy); x.setDate(x.getDate() - d); return x.toISOString().slice(0, 10) }
  const mesActual = hasta.slice(0, 7)
  const mesAnterior = (() => { const x = new Date(hoy); x.setMonth(x.getMonth() - 1); return x.toISOString().slice(0, 7) })()
  const anoActual = hoy.getFullYear().toString()
  const weekStart = (() => {
    const d = new Date(hoy); const day = d.getDay() || 7
    d.setDate(d.getDate() - day + 1); return d.toISOString().slice(0, 10)
  })()
  const prevWeekEnd = (() => { const d = new Date(weekStart); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) })()
  const prevWeekStart = (() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10) })()

  switch (periodo) {
    case 'semana_actual':   return { desde: weekStart, hasta }
    case 'semana_anterior': return { desde: prevWeekStart, hasta: prevWeekEnd }
    case '7d':   return { desde: sub(7),  hasta }
    case '14d':  return { desde: sub(14), hasta }
    case '30d':  return { desde: sub(30), hasta }
    case '60d':  return { desde: sub(60), hasta }
    case '90d':  return { desde: sub(90), hasta }
    case 'mes_actual':   return { desde: mesActual + '-01', hasta }
    case 'mes_anterior': return { desde: mesAnterior + '-01', hasta: mesAnterior + '-31' }
    case 'ano_actual':   return { desde: anoActual + '-01-01', hasta }
    default: return { desde: weekStart, hasta }
  }
}

const PERIODO_LABEL: Record<string, string> = {
  semana_actual: 'Semana actual', semana_anterior: 'Semana anterior',
  '7d': 'Últimos 7 días', '14d': 'Últimos 14 días', '30d': 'Últimos 30 días',
  '60d': 'Últimos 60 días', '90d': 'Últimos 90 días',
  mes_actual: 'Mes actual', mes_anterior: 'Mes anterior', ano_actual: 'Año actual',
}

function hexAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${alpha})`
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function Dashboard() {
  const [data, setData] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [periodo, setPeriodo] = useState('semana_actual')
  const [isDark, setIsDark] = useState(
    typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark'
  )

  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
    )
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
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

  const [objetivos, setObjetivos] = useState({ diario: 700, semanal: 5000, mensual: 20000, anual: 240000 })

  useEffect(() => {
    supabase.from('objetivos').select('tipo,importe').then(({ data }) => {
      if (!data) return
      const obj = { diario: 700, semanal: 5000, mensual: 20000, anual: 240000 }
      for (const r of data) {
        if (r.tipo === 'diario')   obj.diario   = Number(r.importe)
        if (r.tipo === 'semanal')  obj.semanal  = Number(r.importe)
        if (r.tipo === 'mensual')  obj.mensual  = Number(r.importe)
        if (r.tipo === 'anual')    obj.anual    = Number(r.importe)
      }
      setObjetivos(obj)
    })
  }, [])

  /* ── derived data ──────────────────────────────────────── */

  const { desde, hasta } = useMemo(() => rangoFecha(periodo), [periodo])

  const rowsPeriodo = useMemo(
    () => data.filter(r => r.fecha >= desde && r.fecha <= hasta),
    [data, desde, hasta]
  )

  const agPeriodo = useMemo(() => sumRows(rowsPeriodo), [rowsPeriodo])
  const ventasPeriodo = agPeriodo.bruto
  const pedidosPeriodo = agPeriodo.pedidos
  const ticketMedio = pedidosPeriodo > 0 ? ventasPeriodo / pedidosPeriodo : 0

  const canalStats = useMemo((): CanalStat[] => {
    const uber    = sumCanal(rowsPeriodo, 'uber_pedidos',    'uber_bruto')
    const glovo   = sumCanal(rowsPeriodo, 'glovo_pedidos',   'glovo_bruto')
    const je      = sumCanal(rowsPeriodo, 'je_pedidos',      'je_bruto')
    const web     = sumCanal(rowsPeriodo, 'web_pedidos',     'web_bruto')
    const directa = sumCanal(rowsPeriodo, 'directa_pedidos', 'directa_bruto')
    const pct = (v: number) => ventasPeriodo > 0 ? (v / ventasPeriodo) * 100 : 0
    return [
      { nombre: 'Uber Eats',     bruto: uber.bruto,    neto: calcNeto(uber.bruto, uber.pedidos, 'Uber Eats'),    pct: pct(uber.bruto),    pedidos: uber.pedidos },
      { nombre: 'Glovo',         bruto: glovo.bruto,   neto: calcNeto(glovo.bruto, glovo.pedidos, 'Glovo'),      pct: pct(glovo.bruto),   pedidos: glovo.pedidos },
      { nombre: 'Just Eat',      bruto: je.bruto,      neto: calcNeto(je.bruto, je.pedidos, 'Just Eat'),         pct: pct(je.bruto),      pedidos: je.pedidos },
      { nombre: 'Web Propia',    bruto: web.bruto,     neto: calcNeto(web.bruto, web.pedidos, 'Web Propia'),     pct: pct(web.bruto),     pedidos: web.pedidos },
      { nombre: 'Venta Directa', bruto: directa.bruto, neto: directa.bruto,                                      pct: pct(directa.bruto), pedidos: directa.pedidos },
    ].filter(c => c.bruto > 0)
  }, [rowsPeriodo, ventasPeriodo])

  const weekBars = useMemo((): WeekBar[] => {
    const map = new Map<string, WeekBar>()
    const currentWeekKey = (() => { const { year, week } = isoWeek(todayStr()); return `${year}-${String(week).padStart(2,'0')}` })()
    for (const r of data) {
      const { year, week } = isoWeek(r.fecha)
      const key = `${year}-${String(week).padStart(2,'0')}`
      const prev = map.get(key) ?? { label: `S${week}`, total: 0, uber: 0, glovo: 0, je: 0, web: 0, directa: 0, isCurrent: key === currentWeekKey }
      prev.total   += r.total_bruto   || 0
      prev.uber    += r.uber_bruto    || 0
      prev.glovo   += r.glovo_bruto   || 0
      prev.je      += r.je_bruto      || 0
      prev.web     += r.web_bruto     || 0
      prev.directa += r.directa_bruto || 0
      map.set(key, prev)
    }
    return [...map.entries()].sort((a,b) => b[0].localeCompare(a[0])).slice(0,4).reverse().map(([,v]) => v)
  }, [data])

  const nSemana = isoWeek(todayStr()).week
  const weekStart = startOfWeekStr()
  const hoyStr = todayStr()
  const rowsSemana = useMemo(() => data.filter(r => r.fecha >= weekStart && r.fecha <= hoyStr), [data, weekStart, hoyStr])
  const ventasSemana = useMemo(() => sumRows(rowsSemana).bruto, [rowsSemana])
  const currentMonth = hoyStr.slice(0,7)
  const rowsMes = useMemo(() => data.filter(r => r.fecha.startsWith(currentMonth)), [data, currentMonth])
  const ventasMes = useMemo(() => sumRows(rowsMes).bruto, [rowsMes])
  const ventasAno = useMemo(() => sumRows(data.filter(r => r.fecha.startsWith(new Date().getFullYear().toString()))).bruto, [data])

  const diaSemana = new Date().getDay() || 7
  const pctTiempoSemana = Math.round((diaSemana / 7) * 100)
  const pctObjetivoSemana = objetivos.semanal > 0 ? Math.round((ventasSemana / objetivos.semanal) * 100) : 0

  const diasSemana = useMemo(() => {
    const dias = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']
    const vals = [0,0,0,0,0,0,0]
    for (const r of rowsSemana) {
      const d = new Date(r.fecha + 'T12:00:00')
      const idx = (d.getDay() || 7) - 1
      vals[idx] += r.total_bruto || 0
    }
    return dias.map((nombre, i) => ({ nombre, valor: vals[i] }))
  }, [rowsSemana])

  const ticketPorCanal = useMemo(() =>
    canalStats.filter(c => c.pedidos > 0).map(c => ({ nombre: c.nombre, ticket: c.bruto / c.pedidos }))
  , [canalStats])

  /* ── tokens ────────────────────────────────────────────── */

  const surface  = isDark ? '#1a1f32' : '#ffffff'
  const surface2 = isDark ? '#111827' : '#f8f7f4'
  const border   = isDark ? '#2a3050' : '#e2ddd6'
  const textPri  = isDark ? '#f0f0ff' : '#111111'
  const textSec  = isDark ? '#9ba8c0' : '#5a6478'
  const textMut  = isDark ? '#5a6880' : '#9ba0aa'
  const accent   = '#e8f442'

  const card: React.CSSProperties = { backgroundColor: surface, border: `1px solid ${border}`, borderRadius: 10, padding: '18px 20px' }
  const sectionLabel: React.CSSProperties = { fontFamily: 'Oswald, sans-serif', fontSize: '0.6rem', letterSpacing: '2px', textTransform: 'uppercase', color: textMut, marginBottom: 14 }
  const groupBox: React.CSSProperties = { background: isDark ? '#131928' : '#f5f3ef', border: `1px solid ${isDark ? '#2a3050' : '#e2ddd6'}`, borderRadius: 14, padding: '20px 24px', marginBottom: 20 }
  const groupLabel: React.CSSProperties = { fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: isDark ? '#5a6880' : '#9ba0aa', marginBottom: 16 }

  /* ── semáforo ──────────────────────────────────────────── */
  const semaforo = (pct: number) => pct >= 80 ? '#1D9E75' : pct >= 50 ? '#f5a623' : '#E24B4A'

  /* ── loading / error ───────────────────────────────────── */

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:80 }}>
      <div className="h-6 w-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div style={{ ...card, textAlign:'center', padding:40 }}>
      <p style={{ color:'#E24B4A', fontSize:13 }}>{error}</p>
    </div>
  )

  /* ── chart helpers ─────────────────────────────────────── */

  const maxBarTotal = Math.max(...weekBars.map(w => w.total), 1)
  const CANAL_KEYS: (keyof WeekBar)[] = ['uber','glovo','je','web','directa']
  const CANAL_NAMES = ['Uber Eats','Glovo','Just Eat','Web Propia','Venta Directa']

  /* ── render ────────────────────────────────────────────── */

  return (
    <div style={{ fontFamily: 'Lexend, sans-serif' }}>

      {/* CABECERA */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <h1 style={{ fontFamily:'Oswald, sans-serif', fontSize:'1.3rem', letterSpacing:'3px', textTransform:'uppercase', color:textSec, margin:0 }}>
          Panel Global
        </h1>
        <select
          value={periodo}
          onChange={e => setPeriodo(e.target.value)}
          style={{ padding:'8px 14px', borderRadius:8, border:`1px solid ${border}`, background:surface, color:textPri, fontFamily:'Lexend, sans-serif', fontSize:13, cursor:'pointer' }}
        >
          <option value="semana_actual">Semana actual</option>
          <option value="semana_anterior">Semana anterior</option>
          <option value="7d">Últimos 7 días</option>
          <option value="14d">Últimos 14 días</option>
          <option value="30d">Últimos 30 días</option>
          <option value="60d">Últimos 60 días</option>
          <option value="90d">Últimos 90 días</option>
          <option value="mes_actual">Mes actual</option>
          <option value="mes_anterior">Mes anterior</option>
          <option value="ano_actual">Año actual</option>
        </select>
      </div>

      {/* SECCIÓN 1 — KPIs período */}
      <div style={groupBox}>
        <div style={groupLabel}>{PERIODO_LABEL[periodo] ?? periodo}</div>
        {ventasPeriodo === 0 ? (
          <div style={{ ...card, textAlign:'center', color:textMut, fontSize:13, padding:32 }}>Sin datos para este período</div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
            {[
              { label:'Ventas período', valor: fmtEur(ventasPeriodo), sub:'bruto total' },
              { label:'Pedidos período', valor: Math.round(pedidosPeriodo).toString(), sub:'todos los canales' },
              { label:'Ticket medio', valor: fmtEur(ticketMedio), sub:'bruto / pedido' },
            ].map(k => (
              <div key={k.label} style={card}>
                <div style={{ fontFamily:'Oswald, sans-serif', fontSize:'0.58rem', letterSpacing:'1.5px', color:textMut, marginBottom:6, textTransform:'uppercase' }}>{k.label}</div>
                <div style={{ fontFamily:'Oswald, sans-serif', fontSize:'1.6rem', fontWeight:600, color:textPri, lineHeight:1.1 }}>{k.valor}</div>
                <div style={{ fontSize:'0.68rem', color:textSec, marginTop:4 }}>{k.sub}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECCIÓN 2 — Por canal */}
      <div style={groupBox}>
        <div style={groupLabel}>Por canal — {PERIODO_LABEL[periodo] ?? periodo}</div>
        {ventasPeriodo === 0 ? (
          <div style={{ ...card, textAlign:'center', color:textMut, fontSize:13, padding:32 }}>Sin datos para este período</div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:16 }}>
            {canalStats.map(c => {
              const color = CANAL_COLOR[c.nombre] ?? '#888'
              const bg = hexAlpha(color, isDark ? 0.12 : 0.07)
              const ratio = c.bruto > 0 ? (c.neto / c.bruto) * 100 : 0
              const semaforoColor = ratio >= 75 ? '#1D9E75' : ratio >= 55 ? '#f5a623' : '#E24B4A'
              const semaforoLabel = ratio >= 75 ? 'Rentable' : ratio >= 55 ? 'Moderado' : 'Bajo margen'
              return (
                <div key={c.nombre} style={{ borderRadius:10, padding:'14px 16px', backgroundColor:bg, border:`1px solid ${hexAlpha(color, 0.35)}` }}>
                  <div style={{ fontFamily:'Oswald, sans-serif', fontSize:'0.62rem', letterSpacing:'1px', color, textTransform:'uppercase', marginBottom:6 }}>{c.nombre}</div>
                  <div style={{ fontFamily:'Oswald, sans-serif', fontSize:'1.1rem', fontWeight:600, color:textPri, marginBottom:2 }}>{fmtEur(c.bruto)}</div>
                  <div style={{ fontSize:'0.68rem', color:hexAlpha(color, 0.8), marginBottom:8 }}>Neto {fmtEur(c.neto)}</div>
                  <div style={{ height:3, backgroundColor:hexAlpha(color,0.2), borderRadius:2, marginBottom:8 }}>
                    <div style={{ height:3, width:`${Math.min(c.pct,100)}%`, backgroundColor:color, borderRadius:2 }} />
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop: 8 }}>
                    <span style={{ fontFamily:'Lexend, sans-serif', fontSize:11, color: semaforoColor }}>● {semaforoLabel}</span>
                    <span style={{ fontFamily:'Oswald, sans-serif', fontSize:11, color: semaforoColor }}>{ratio.toFixed(1)}% neto</span>
                  </div>
                  <div style={{ fontSize:'0.65rem', color:textMut, marginTop:6 }}>{c.pedidos} pedidos · {c.pct.toFixed(1)}%</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* SECCIÓN 3 — Gráfico + Objetivos */}
      <div style={groupBox}>
        <div style={groupLabel}>Tendencia y objetivos</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

        {/* Gráfico 4 semanas */}
        <div style={card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <span style={{ fontFamily:'Oswald, sans-serif', fontSize:'0.6rem', letterSpacing:'2px', textTransform:'uppercase', color:textMut }}>Últimas 4 semanas</span>
            <span style={{ fontSize:'0.72rem', color:textSec }}>Total: {fmtEur(weekBars.reduce((a,w)=>a+w.total,0))}</span>
          </div>
          {/* Leyenda */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 12px', marginBottom:14 }}>
            {CANAL_NAMES.map((n,i) => (
              <div key={n} style={{ display:'flex', alignItems:'center', gap:4, fontSize:'0.62rem', color:textSec }}>
                <div style={{ width:8, height:8, borderRadius:2, backgroundColor:CANAL_COLOR[n] ?? '#888' }} />
                <span>{n.replace(' Eats','').replace(' Propia','').replace(' Directa','')}</span>
              </div>
            ))}
          </div>
          {weekBars.length === 0 ? (
            <p style={{ color:textMut, fontSize:13, textAlign:'center', padding:'24px 0' }}>Sin datos</p>
          ) : (
            <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:180 }}>
              {weekBars.map((w) => {
                const barH = maxBarTotal > 0 ? (w.total / maxBarTotal) * 160 : 4
                const segs = [
                  { key:'uber',    color: CANAL_COLOR['Uber Eats'],     val: w.uber },
                  { key:'glovo',   color: CANAL_COLOR['Glovo'],         val: w.glovo },
                  { key:'je',      color: CANAL_COLOR['Just Eat'],      val: w.je },
                  { key:'web',     color: CANAL_COLOR['Web Propia'],    val: w.web },
                  { key:'directa', color: CANAL_COLOR['Venta Directa'], val: w.directa },
                ].filter(s => s.val > 0)
                return (
                  <div key={w.label} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, height:'100%', justifyContent:'flex-end' }}>
                    <span style={{ fontFamily:'Lexend, sans-serif', fontSize:'0.65rem', color: w.isCurrent ? accent : textPri, fontWeight: w.isCurrent ? 600 : 400 }}>
                      {fmtEur(w.total)}
                    </span>
                    <div style={{
                      width:'100%', height:`${barH}px`, minHeight:4,
                      display:'flex', flexDirection:'column', justifyContent:'flex-end',
                      border: w.isCurrent ? `2px solid ${accent}` : 'none',
                      borderRadius:'4px 4px 0 0',
                      overflow:'hidden',
                      opacity: w.isCurrent ? 1 : 0.6,
                    }}>
                      {segs.map((s, si) => (
                        <div key={s.key} style={{
                          width:'100%',
                          height:`${w.total > 0 ? (s.val / w.total) * 100 : 0}%`,
                          minHeight: si === segs.length-1 ? 4 : 0,
                          backgroundColor: s.color,
                        }} />
                      ))}
                    </div>
                    <span style={{ fontFamily:'Oswald, sans-serif', fontSize:'0.65rem', color: w.isCurrent ? accent : textSec, letterSpacing:'1px', fontWeight: w.isCurrent ? 600 : 400 }}>
                      {w.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Objetivos */}
        <div style={card}>
          <div style={sectionLabel}>Objetivos</div>
          {[
            { label:'Semanal', valor:ventasSemana, objetivo:objetivos.semanal, sub:`S${nSemana}` },
            { label:'Mensual', valor:ventasMes,    objetivo:objetivos.mensual, sub:'mes actual' },
            { label:'Anual',   valor:ventasAno,    objetivo:objetivos.anual,   sub:new Date().getFullYear().toString() },
          ].map((obj, idx) => {
            const pct = obj.objetivo > 0 ? Math.min(Math.round((obj.valor / obj.objetivo) * 100), 100) : 0
            const color = semaforo(pct)
            const faltan = Math.max(0, obj.objetivo - obj.valor)
            return (
              <div key={obj.label}>
                {idx > 0 && <div style={{ height:1, backgroundColor:border, margin:'12px 0' }} />}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', backgroundColor:color, flexShrink:0 }} />
                    <span style={{ fontFamily:'Oswald, sans-serif', fontSize:'0.72rem', letterSpacing:'1px', textTransform:'uppercase', color:textPri }}>{obj.label}</span>
                    <span style={{ fontSize:'0.65rem', color:textMut }}>— {obj.sub}</span>
                  </div>
                  <span style={{ fontFamily:'Oswald, sans-serif', fontSize:'0.85rem', fontWeight:600, color }}>{pct}%</span>
                </div>
                <div style={{ fontSize:'0.65rem', color:textMut, marginBottom:6 }}>
                  {fmtEur(obj.valor)} · Faltan {fmtEur(faltan)} de {fmtEur(obj.objetivo)}
                </div>
                <div style={{ height:4, backgroundColor:hexAlpha(color,0.2), borderRadius:2 }}>
                  <div style={{ height:4, width:`${pct}%`, backgroundColor:color, borderRadius:2, transition:'width 500ms ease' }} />
                </div>
              </div>
            )
          })}

          {/* Velocidad */}
          <div style={{ height:1, backgroundColor:border, margin:'14px 0' }} />
          <div style={sectionLabel}>Velocidad — semana actual</div>
          <div style={{ fontSize:'0.7rem', color:textSec, marginBottom:10, lineHeight:1.5 }}>
            Vas al <span style={{ color: semaforo(pctObjetivoSemana), fontWeight:600 }}>{pctObjetivoSemana}%</span> del objetivo con el <span style={{ color:textPri, fontWeight:600 }}>{pctTiempoSemana}%</span> de la semana transcurrida
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:'0.6rem', color:textMut, width:60, flexShrink:0 }}>Tiempo</span>
              <div style={{ flex:1, height:6, backgroundColor:hexAlpha('#66aaff',0.2), borderRadius:3 }}>
                <div style={{ height:6, width:`${pctTiempoSemana}%`, backgroundColor:'#66aaff', borderRadius:3 }} />
              </div>
              <span style={{ fontSize:'0.6rem', color:'#66aaff', width:30, textAlign:'right' }}>{pctTiempoSemana}%</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:'0.6rem', color:textMut, width:60, flexShrink:0 }}>Objetivo</span>
              <div style={{ flex:1, height:6, backgroundColor:hexAlpha(semaforo(pctObjetivoSemana),0.2), borderRadius:3 }}>
                <div style={{ height:6, width:`${pctObjetivoSemana}%`, backgroundColor:semaforo(pctObjetivoSemana), borderRadius:3 }} />
              </div>
              <span style={{ fontSize:'0.6rem', color:semaforo(pctObjetivoSemana), width:30, textAlign:'right' }}>{pctObjetivoSemana}%</span>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* SECCIÓN 4 — Top productos + Días pico + Ticket canal */}
      <div style={groupBox}>
        <div style={groupLabel}>Productos y actividad</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

        {/* Top productos */}
        <div style={card}>
          <div style={sectionLabel}>Top productos — semana actual</div>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                {['#','Producto','Canal','Uds','Total'].map(h => (
                  <th key={h} style={{ fontFamily:'Oswald, sans-serif', fontSize:'0.58rem', letterSpacing:'1px', textTransform:'uppercase', color:textMut, textAlign: h==='#'||h==='Uds'||h==='Total' ? 'right' : 'left', paddingBottom:8, borderBottom:`1px solid ${border}`, paddingRight: h==='Total' ? 0 : 8, fontWeight:600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TOP_PRODUCTOS_MOCK.map((p, idx) => {
                const color = CANAL_COLOR[p.canal] ?? '#888'
                return (
                  <tr key={idx} style={{ borderBottom:`1px solid ${hexAlpha(border, 0.5)}` }}>
                    <td style={{ fontSize:'0.7rem', color:textMut, textAlign:'right', padding:'7px 8px 7px 0' }}>{idx+1}</td>
                    <td style={{ fontSize:'0.75rem', color:textPri, padding:'7px 8px' }}>{p.nombre}</td>
                    <td style={{ padding:'7px 8px' }}>
                      <span style={{ fontSize:'0.6rem', backgroundColor:hexAlpha(color,0.15), color, border:`1px solid ${hexAlpha(color,0.3)}`, borderRadius:4, padding:'2px 6px', fontFamily:'Oswald, sans-serif', letterSpacing:'0.5px', whiteSpace:'nowrap' }}>
                        {p.canal.replace(' Eats','').replace(' Propia','').replace(' Directa','')}
                      </span>
                    </td>
                    <td style={{ fontSize:'0.75rem', color:textSec, textAlign:'right', padding:'7px 8px' }}>{p.uds}</td>
                    <td style={{ fontSize:'0.75rem', color:textPri, textAlign:'right', padding:'7px 0', fontWeight:500 }}>{fmtEur(p.total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p style={{ fontSize:'0.62rem', color:textMut, marginTop:10, marginBottom:0 }}>* Datos de ventas por plato disponibles cuando se integre POS</p>
        </div>

        {/* Días pico + Ticket canal */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Días pico */}
          <div style={card}>
            <div style={sectionLabel}>Días pico — semana actual (S{nSemana})</div>
            {diasSemana.every(d => d.valor === 0) ? (
              <p style={{ color:textMut, fontSize:13, textAlign:'center', padding:'16px 0' }}>Sin datos esta semana</p>
            ) : (
              <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:100 }}>
                {(() => {
                  const maxD = Math.max(...diasSemana.map(d => d.valor), 1)
                  return diasSemana.map(d => {
                    const h = Math.max((d.valor / maxD) * 80, d.valor > 0 ? 4 : 0)
                    const isMax = d.valor === maxD && d.valor > 0
                    return (
                      <div key={d.nombre} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, height:'100%', justifyContent:'flex-end' }}>
                        {d.valor > 0 && <span style={{ fontSize:'0.58rem', color: isMax ? accent : textSec }}>{fmtEur(d.valor)}</span>}
                        <div style={{ width:'100%', height:`${h}px`, minHeight: d.valor>0?4:0, backgroundColor: isMax ? accent : hexAlpha(CANAL_COLOR['Uber Eats'],0.5), borderRadius:'3px 3px 0 0' }} />
                        <span style={{ fontFamily:'Oswald, sans-serif', fontSize:'0.6rem', color: isMax ? accent : textMut, letterSpacing:'0.5px' }}>{d.nombre}</span>
                      </div>
                    )
                  })
                })()}
              </div>
            )}
          </div>

          {/* Ticket por canal */}
          <div style={card}>
            <div style={sectionLabel}>Ticket medio por canal</div>
            {ticketPorCanal.length === 0 ? (
              <p style={{ color:textMut, fontSize:13, textAlign:'center', padding:'12px 0' }}>Sin datos</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column' }}>
                {ticketPorCanal.map((t, idx) => {
                  const color = CANAL_COLOR[t.nombre] ?? '#888'
                  return (
                    <div key={t.nombre}>
                      {idx > 0 && <div style={{ height:1, backgroundColor:border, margin:'8px 0' }} />}
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:8, height:8, borderRadius:'50%', backgroundColor:color, flexShrink:0 }} />
                          <span style={{ fontSize:'0.72rem', color:textSec }}>{t.nombre}</span>
                        </div>
                        <span style={{ fontFamily:'Oswald, sans-serif', fontSize:'0.82rem', fontWeight:600, color:textPri }}>{fmtEur(t.ticket)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
        </div>
      </div>

    </div>
  )
}
