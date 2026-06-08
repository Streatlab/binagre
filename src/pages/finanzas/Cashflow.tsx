import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import TabsPastilla from '@/components/ui/TabsPastilla'
import { COLOR, COLORS, LEXEND, OSWALD } from '@/components/panel/resumen/tokens'
import {
  calcNetoPorCanal, loadConfigCanales, recargarConfigCanales, loadMarcasPorCanal,
  type CanalConfig, type MarcasPorCanal,
} from '@/lib/panel/calcNetoPlataforma'

/* ════════════════════════════════════════════════════════════
   CASH FLOW · Ingresos — pestaña del Panel Global
   Neto vía calcNetoPorCanal (calculadora central). Fechas de pago
   reales por plataforma. Estilo homogéneo con Resumen/Evolución.
   ════════════════════════════════════════════════════════════ */

type Periodo = 'semana' | 'mes' | 'anio'
type Comp = 'prev' | 'mes' | 'anio'

const VERDE = '#1D9E75'
const ROJO = '#E24B4A'
const AMARILLO = '#f5a623'
const GRIS = '#9ba3af'
const BORDE = '#d0c8bc'
const TRACK = '#ebe8e2'
const POS = VERDE, WARN = AMARILLO, NEG = ROJO

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

const CANALES = [
  { id: 'uber', label: 'Uber Eats', color: COLOR.uber, bk: 'uber_bruto', pk: 'uber_pedidos' },
  { id: 'glovo', label: 'Glovo', color: '#c9a900', bk: 'glovo_bruto', pk: 'glovo_pedidos' },
  { id: 'je', label: 'Just Eat', color: COLOR.je, bk: 'je_bruto', pk: 'je_pedidos' },
  { id: 'web', label: 'Web', color: COLOR.webSL, bk: 'web_bruto', pk: 'web_pedidos' },
  { id: 'dir', label: 'Directa', color: COLOR.directa, bk: 'directa_bruto', pk: 'directa_pedidos' },
] as const

// Festivos Madrid (nacional + autonómico + local). Mantener cada año.
const FESTIVOS = new Set<string>([
  '2026-01-01', '2026-01-06', '2026-04-02', '2026-04-03', '2026-05-01', '2026-05-15',
  '2026-08-15', '2026-10-12', '2026-11-02', '2026-11-09', '2026-12-07', '2026-12-08', '2026-12-25',
])

const nf0 = (n: number) => Math.round(n).toLocaleString('es-ES', { useGrouping: true })
const nf2 = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })

function toLocal(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function parse(s: string) { return new Date(s.slice(0, 10) + 'T12:00:00') }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(d.getDate() + n); return r }
function mondayOf(d: Date) { const r = new Date(d); const w = r.getDay() || 7; r.setDate(r.getDate() - w + 1); r.setHours(12, 0, 0, 0); return r }
function finDeMes(y: number, m: number) { return new Date(y, m + 1, 0, 12) }
function fmtCorta(s: string) { const d = parse(s); return `${d.getDate()} ${MESES[d.getMonth()]}` }
function fmtLarga(s: string) { const d = parse(s); return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}` }

/* Reglas de pago reales por plataforma */
// Uber: semana lun-dom → cobra el lunes siguiente. Si festivo, siguiente día hábil.
function pagoUber(domingo: Date): string {
  let p = addDays(domingo, 1)
  for (let i = 0; i < 7 && FESTIVOS.has(toLocal(p)); i++) p = addDays(p, 1)
  return toLocal(p)
}
// Glovo: 1-15 → cobra el 5 del mes siguiente; 16-fin → cobra el 20 del mes siguiente.
function pagoGlovo(y: number, m: number, q: 1 | 2): string { return toLocal(new Date(y, m + 1, q === 1 ? 5 : 20, 12)) }
// Just Eat: 1-15 → cobra el 20 del mismo mes; 16-fin → cobra el 5 del mes siguiente.
function pagoJE(y: number, m: number, q: 1 | 2): string { return q === 1 ? toLocal(new Date(y, m, 20, 12)) : toLocal(new Date(y, m + 1, 5, 12)) }

interface Row {
  fecha: string; servicio?: string
  uber_bruto: number; uber_pedidos: number
  glovo_bruto: number; glovo_pedidos: number
  je_bruto: number; je_pedidos: number
  web_bruto: number; web_pedidos: number
  directa_bruto: number; directa_pedidos: number
  total_bruto: number; total_pedidos: number
}

interface Cobro {
  canal: string; label: string; color: string
  ini: string; fin: string; pago: string
  bruto: number; neto: number; pedidos: number; futuro: boolean
}

const SELECT = 'fecha,servicio,uber_bruto,uber_pedidos,glovo_bruto,glovo_pedidos,je_bruto,je_pedidos,web_bruto,web_pedidos,directa_bruto,directa_pedidos,total_bruto,total_pedidos'

export default function Cashflow() {
  const [periodo, setPeriodo] = useState<Periodo>('semana')
  const [comp, setComp] = useState<Comp>('prev')
  const setPeriodoP = (p: Periodo) => { setPeriodo(p); if (p !== 'semana' && comp === 'prev') setComp('mes') }

  const [rows, setRows] = useState<Row[]>([])
  const [config, setConfig] = useState<Record<string, CanalConfig>>({})
  const [marcas, setMarcas] = useState<MarcasPorCanal>({ uber: 1, glovo: 1, je: 1, web: 1, dir: 1 })
  const [loading, setLoading] = useState(true)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    loadConfigCanales().then(setConfig); loadMarcasPorCanal().then(setMarcas)
    const on = () => { recargarConfigCanales().then(setConfig); loadMarcasPorCanal().then(setMarcas) }
    window.addEventListener('config_canales:changed', on)
    return () => window.removeEventListener('config_canales:changed', on)
  }, [])

  useEffect(() => {
    supabase.from('facturacion_diario').select(SELECT).order('fecha', { ascending: true })
      .then(({ data }) => { setRows((data as Row[]) ?? []); setLoading(false) })
  }, [])

  const hoy = toLocal(new Date())

  // Bruto/pedidos por canal por día (TODO si existe; si no, ALM+CENAS). Nunca sumar los tres.
  const aggDia = useMemo(() => {
    const todo = new Set<string>()
    for (const r of rows) if (r.servicio === 'TODO') todo.add(r.fecha)
    const m = new Map<string, Record<string, number>>()
    for (const r of rows) {
      if (todo.has(r.fecha)) { if (r.servicio !== 'TODO') continue }
      else { if (r.servicio !== 'ALM' && r.servicio !== 'CENAS') continue }
      const a = m.get(r.fecha) ?? {}
      for (const c of CANALES) {
        a[c.bk] = (a[c.bk] ?? 0) + ((r[c.bk as keyof Row] as number) || 0)
        a[c.pk] = (a[c.pk] ?? 0) + ((r[c.pk as keyof Row] as number) || 0)
      }
      m.set(r.fecha, a)
    }
    return m
  }, [rows])

  // Construye los cobros agrupados por periodo de liquidación real de cada canal.
  const cobros = useMemo<Cobro[]>(() => {
    if (loading) return []
    type G = { canal: typeof CANALES[number]; ini: string; fin: string; pago: string; bruto: number; ped: number; dias: Set<string> }
    const grupos = new Map<string, G>()
    const push = (key: string, canal: typeof CANALES[number], ini: string, fin: string, pago: string, bruto: number, ped: number, f: string) => {
      if (bruto <= 0) return
      let g = grupos.get(key)
      if (!g) { g = { canal, ini, fin, pago, bruto: 0, ped: 0, dias: new Set() }; grupos.set(key, g) }
      g.bruto += bruto; g.ped += ped; g.dias.add(f)
    }
    for (const [f, a] of aggDia) {
      const d = parse(f); const y = d.getFullYear(); const m = d.getMonth(); const q: 1 | 2 = d.getDate() <= 15 ? 1 : 2
      for (const c of CANALES) {
        const bruto = a[c.bk] ?? 0; const ped = a[c.pk] ?? 0
        if (bruto <= 0) continue
        if (c.id === 'uber') {
          const lun = mondayOf(d); const dom = addDays(lun, 6)
          push('U' + toLocal(lun), c, toLocal(lun), toLocal(dom), pagoUber(dom), bruto, ped, f)
        } else if (c.id === 'glovo' || c.id === 'je') {
          const ini = toLocal(new Date(y, m, q === 1 ? 1 : 16, 12))
          const fin = q === 1 ? toLocal(new Date(y, m, 15, 12)) : toLocal(finDeMes(y, m))
          const pago = c.id === 'glovo' ? pagoGlovo(y, m, q) : pagoJE(y, m, q)
          push(`${c.id}${y}-${m}-${q}`, c, ini, fin, pago, bruto, ped, f)
        } else {
          // Web / Directa: cobro inmediato
          push(`${c.id}${f}`, c, f, f, f, bruto, ped, f)
        }
      }
    }
    const out: Cobro[] = []
    for (const g of grupos.values()) {
      const { neto } = calcNetoPorCanal(g.canal.id, g.bruto, g.ped, {
        modo: 'agregado_canal', marcasPorCanal: marcas,
        fechaDesde: parse(g.ini), fechaHasta: parse(g.fin), configCanales: config, diasConDatos: g.dias.size,
      })
      out.push({ canal: g.canal.id, label: g.canal.label, color: g.canal.color, ini: g.ini, fin: g.fin, pago: g.pago, bruto: g.bruto, neto, pedidos: g.ped, futuro: g.pago > hoy })
    }
    return out.sort((a, b) => (a.pago < b.pago ? -1 : 1))
  }, [aggDia, config, marcas, loading, hoy])

  /* Ventana del periodo seleccionado (por fecha de pago) */
  const { winIni, winFin } = useMemo(() => {
    const now = new Date(); const y = now.getFullYear(); const m = now.getMonth()
    if (periodo === 'semana') { const li = mondayOf(now); return { winIni: toLocal(li), winFin: toLocal(addDays(li, 6)) } }
    if (periodo === 'mes') return { winIni: toLocal(new Date(y, m, 1, 12)), winFin: toLocal(finDeMes(y, m)) }
    return { winIni: toLocal(new Date(y, 0, 1, 12)), winFin: toLocal(new Date(y, 11, 31, 12)) }
  }, [periodo])

  const { cIni, cFin, labelComp } = useMemo(() => {
    const a = parse(winIni); const b = parse(winFin)
    if (comp === 'prev') {
      const dias = Math.round((b.getTime() - a.getTime()) / 86400000) + 1
      return { cIni: toLocal(addDays(a, -dias)), cFin: toLocal(addDays(a, -1)), labelComp: periodo === 'semana' ? 'la semana anterior' : 'el periodo anterior' }
    }
    if (comp === 'mes') return { cIni: toLocal(new Date(a.getFullYear(), a.getMonth() - 1, a.getDate(), 12)), cFin: toLocal(new Date(b.getFullYear(), b.getMonth() - 1, b.getDate(), 12)), labelComp: 'el mes anterior' }
    return { cIni: toLocal(new Date(a.getFullYear() - 1, a.getMonth(), a.getDate(), 12)), cFin: toLocal(new Date(b.getFullYear() - 1, b.getMonth(), b.getDate(), 12)), labelComp: 'el año anterior' }
  }, [winIni, winFin, comp, periodo])

  const finMesStr = useMemo(() => { const d = new Date(); return toLocal(finDeMes(d.getFullYear(), d.getMonth())) }, [])

  const futuros = useMemo(() => cobros.filter(c => c.pago > hoy), [cobros, hoy])
  const porCobrarTotal = useMemo(() => futuros.reduce((s, c) => s + c.neto, 0), [futuros])
  const porCobrarFinMes = useMemo(() => futuros.filter(c => c.pago <= finMesStr).reduce((s, c) => s + c.neto, 0), [futuros, finMesStr])
  const proximo = futuros[0] ?? null

  const cobradoPeriodo = useMemo(() => cobros.filter(c => c.pago >= winIni && c.pago <= winFin && c.pago <= hoy).reduce((s, c) => s + c.neto, 0), [cobros, winIni, winFin, hoy])
  const previstoPeriodo = useMemo(() => cobros.filter(c => c.pago >= winIni && c.pago <= winFin && c.pago > hoy).reduce((s, c) => s + c.neto, 0), [cobros, winIni, winFin, hoy])
  const cobradoComp = useMemo(() => cobros.filter(c => c.pago >= cIni && c.pago <= cFin).reduce((s, c) => s + c.neto, 0), [cobros, cIni, cFin])
  const totalPeriodo = cobradoPeriodo + previstoPeriodo
  const delta = cobradoComp > 0 ? ((totalPeriodo - cobradoComp) / cobradoComp) * 100 : null

  // Lo que está por cobrar, por plataforma (cards)
  const porCanal = useMemo(() => {
    return CANALES.map(c => {
      const list = futuros.filter(x => x.canal === c.id)
      const bruto = list.reduce((s, x) => s + x.bruto, 0)
      const neto = list.reduce((s, x) => s + x.neto, 0)
      const prox = list.sort((a, b) => (a.pago < b.pago ? -1 : 1))[0]
      return { ...c, bruto, neto, prox: prox?.pago ?? null }
    }).filter(c => c.neto > 0).sort((a, b) => b.neto - a.neto)
  }, [futuros])

  // Puntos del gráfico: cobros de la ventana agrupados por fecha de pago (o por mes si periodo=año)
  const puntos = useMemo(() => {
    const inWin = cobros.filter(c => c.pago >= winIni && c.pago <= winFin)
    const m = new Map<string, { orden: string; label: string; total: number; futuro: boolean; items: { label: string; color: string; neto: number }[] }>()
    for (const c of inWin) {
      let key: string, label: string, orden: string
      if (periodo === 'anio') { const d = parse(c.pago); key = `${d.getFullYear()}-${d.getMonth()}`; label = MESES[d.getMonth()]; orden = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}` }
      else { key = c.pago; label = fmtCorta(c.pago); orden = c.pago }
      const e = m.get(key) ?? { orden, label, total: 0, futuro: true, items: [] }
      e.total += c.neto
      if (c.pago <= hoy) e.futuro = false
      const it = e.items.find(x => x.label === c.label)
      if (it) it.neto += c.neto; else e.items.push({ label: c.label, color: c.color, neto: c.neto })
      m.set(key, e)
    }
    return [...m.values()].sort((a, b) => (a.orden < b.orden ? -1 : 1))
  }, [cobros, winIni, winFin, periodo, hoy])

  // Próximos cobros agrupados por fecha de pago (futuros)
  const proximosPorFecha = useMemo(() => {
    const m = new Map<string, { pago: string; total: number; items: { label: string; color: string; bruto: number; neto: number }[] }>()
    for (const c of futuros) {
      const e = m.get(c.pago) ?? { pago: c.pago, total: 0, items: [] }
      e.total += c.neto
      const it = e.items.find(x => x.label === c.label)
      if (it) { it.bruto += c.bruto; it.neto += c.neto } else e.items.push({ label: c.label, color: c.color, bruto: c.bruto, neto: c.neto })
      m.set(c.pago, e)
    }
    return [...m.values()].sort((a, b) => (a.pago < b.pago ? -1 : 1)).slice(0, 8)
  }, [futuros])

  /* Batería de frases de negocio (condicional, estilo Evolución) */
  const fraseProximo = useMemo(() => {
    if (!proximo) return null
    const plats = proximosPorFecha[0]?.items.map(i => i.label).join(' + ') ?? proximo.label
    return { txt: `El próximo cobro entra el ${fmtLarga(proximo.pago)}: ${nf0(proximosPorFecha[0]?.total ?? proximo.neto)} de ${plats}.`, color: POS }
  }, [proximo, proximosPorFecha])

  const fraseFinMes = useMemo(() => {
    if (porCobrarFinMes <= 0) return null
    return { txt: `De aquí a fin de mes entrarán ${nf0(porCobrarFinMes)} netos.`, color: POS }
  }, [porCobrarFinMes])

  const fraseDominante = useMemo(() => {
    if (porCobrarTotal <= 0 || porCanal.length === 0) return null
    const top = porCanal[0]; const pct = (top.neto / porCobrarTotal) * 100
    if (pct < 45) return null
    return { txt: `${top.label} concentra el ${pct.toFixed(0)}% de lo que está por cobrar.`, color: pct >= 65 ? WARN : COLOR.textSec }
  }, [porCanal, porCobrarTotal])

  const frases = [fraseProximo, fraseFinMes ?? fraseDominante].filter(Boolean) as { txt: string; color: string }[]

  const cTabs = periodo === 'semana'
    ? [{ id: 'prev', label: 'vs sem. ant.' }, { id: 'mes', label: 'vs mes ant.' }, { id: 'anio', label: 'vs año ant.' }]
    : [{ id: 'mes', label: 'vs mes ant.' }, { id: 'anio', label: 'vs año ant.' }]
  const pTabs: { id: Periodo; label: string }[] = [{ id: 'semana', label: 'Semana' }, { id: 'mes', label: 'Mes' }, { id: 'anio', label: 'Año' }]

  const card: CSSProperties = { background: '#fff', border: `0.5px solid ${BORDE}`, borderRadius: 16, padding: '18px 20px' }
  const lblS: CSSProperties = { fontFamily: OSWALD, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: COLOR.textMut }
  const SUBTAB_CONTAINER: CSSProperties = { display: 'inline-flex', gap: 4, padding: '3px 4px', borderRadius: 10, background: COLORS.accent, border: `0.5px solid ${COLORS.accent}` }
  const SUBTAB_ACTIVE: CSSProperties = { padding: '4px 10px', borderRadius: 6, border: 'none', background: '#fff', color: COLORS.pri, fontFamily: OSWALD, fontSize: 10, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', cursor: 'pointer' }
  const SUBTAB_INACTIVE: CSSProperties = { padding: '4px 10px', borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.25)', color: '#fff', fontFamily: OSWALD, fontSize: 10, fontWeight: 500, letterSpacing: '1.2px', textTransform: 'uppercase', cursor: 'pointer' }
  const colorDelta = (v: number | null) => v == null ? COLOR.textMut : v >= 0 ? VERDE : ROJO

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: COLOR.textSec, fontFamily: LEXEND }}>Cargando…</div>

  // Geometría gráfico
  const W = 720, H = 220, pad = { l: 44, r: 16, t: 22, b: 30 }
  const ix = W - pad.l - pad.r, iy = H - pad.t - pad.b
  const maxY = Math.max(...puntos.map(p => p.total), 1) * 1.15
  const X = (i: number) => pad.l + ix * (puntos.length <= 1 ? 0.5 : i / (puntos.length - 1))
  const Y = (v: number) => pad.t + iy * (1 - v / maxY)
  const idxHoy = puntos.findIndex(p => p.futuro)

  return (
    <div style={{ fontFamily: LEXEND, color: COLOR.textPri, paddingTop: 18 }}>

      {/* CABECERA · pills + titular + frases */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 16, flexWrap: 'wrap' }}>
          <TabsPastilla tabs={cTabs} activeId={comp} onChange={id => setComp(id as Comp)} />
          <div style={{ width: 1, height: 24, background: COLORS.brd, flexShrink: 0, margin: '0 2px' }} />
          <div style={SUBTAB_CONTAINER}>
            {pTabs.map(t => <button key={t.id} onClick={() => setPeriodoP(t.id)} style={periodo === t.id ? SUBTAB_ACTIVE : SUBTAB_INACTIVE}>{t.label}</button>)}
          </div>
        </div>

        <div style={{ fontFamily: OSWALD, fontSize: 'clamp(28px,4.2vw,44px)', fontWeight: 600, lineHeight: 1.04 }}>
          POR COBRAR <span style={{ color: VERDE }}>{nf0(porCobrarTotal)}</span>
          {delta != null && <span style={{ color: colorDelta(delta), background: `${colorDelta(delta)}1f`, padding: '0 10px', borderRadius: 8, marginLeft: 10, fontSize: '0.62em' }}>{delta >= 0 ? '+' : ''}{delta.toFixed(1)}% vs {labelComp}</span>}
        </div>

        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontFamily: OSWALD, fontSize: 'clamp(18px,2.6vw,26px)', fontWeight: 600 }}>
            <span style={{ color: COLOR.textSec }}>{futuros.length} cobros pendientes</span>
            {proximo && <><span style={{ color: COLOR.textMut }}> · </span><span style={{ color: VERDE }}>próximo {fmtCorta(proximo.pago)}</span></>}
          </div>
          {frases.map((f, i) => (
            <div key={i} style={{ fontFamily: OSWALD, fontSize: 'clamp(16px,2.2vw,21px)', fontWeight: 600, color: f.color, letterSpacing: '0.3px' }}>{f.txt}</div>
          ))}
        </div>
      </div>

      {/* GRÁFICO de cobros con tooltip por punto */}
      <div style={{ ...card, marginBottom: 14, position: 'relative' }}>
        <div style={{ ...lblS, marginBottom: 4 }}>Cobros previstos · {periodo === 'semana' ? 'esta semana' : periodo === 'mes' ? 'este mes' : 'este año'} · neto</div>
        {puntos.length === 0 ? (
          <div style={{ fontFamily: LEXEND, fontSize: 13, color: COLOR.textMut, padding: '20px 0' }}>Sin cobros en este periodo.</div>
        ) : (
          <div style={{ position: 'relative' }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
              {[0, 1, 2, 3].map(g => { const v = maxY / 3 * g; const y = Y(v); return (
                <g key={g}>
                  <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#efece6" />
                  <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize="9" fill={GRIS} fontFamily="Lexend">{nf0(v)}</text>
                </g>) })}
              {idxHoy > 0 && (() => { const xh = (X(idxHoy - 1) + X(idxHoy)) / 2; return (
                <g>
                  <line x1={xh} y1={pad.t} x2={xh} y2={H - pad.b} stroke={COLORS.accent} strokeWidth="1" strokeDasharray="3 3" />
                  <text x={xh} y={pad.t - 6} textAnchor="middle" fontSize="9" fill={COLORS.accent} fontFamily="Oswald">HOY</text>
                </g>) })()}
              {puntos.length > 1 && (
                <polyline points={puntos.map((p, i) => `${X(i)} ${Y(p.total)}`).join(' ')} fill="none" stroke={VERDE} strokeWidth="2.5" strokeDasharray={idxHoy >= 0 ? undefined : undefined} />
              )}
              {puntos.map((p, i) => (
                <g key={i}>
                  <circle cx={X(i)} cy={Y(p.total)} r={hover === i ? 6 : 4} fill={p.futuro ? '#fff' : VERDE} stroke={VERDE} strokeWidth="2"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
                  <text x={X(i)} y={H - pad.b + 14} textAnchor="middle" fontSize="9" fill={GRIS} fontFamily="Lexend">{p.label}</text>
                </g>
              ))}
            </svg>
            {hover != null && puntos[hover] && (
              <div style={{
                position: 'absolute', left: `${(X(hover) / W) * 100}%`, top: `${(Y(puntos[hover].total) / H) * 100}%`,
                transform: 'translate(-50%, calc(-100% - 12px))', background: COLORS.modal, color: '#fff',
                borderRadius: 10, padding: '10px 12px', minWidth: 150, pointerEvents: 'none', zIndex: 5,
                boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
              }}>
                <div style={{ fontFamily: OSWALD, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>{fmtLarga(puntos[hover].orden.length > 7 ? puntos[hover].orden : puntos[hover].orden + '-01')}</div>
                {puntos[hover].items.map((it, k) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, fontFamily: LEXEND, fontSize: 12, marginBottom: 2 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: it.color }} />{it.label}</span>
                    <span style={{ fontFamily: OSWALD, fontWeight: 600 }}>{nf0(it.neto)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginTop: 6, paddingTop: 6, borderTop: '0.5px solid rgba(255,255,255,0.25)', fontFamily: OSWALD, fontSize: 13, fontWeight: 700 }}>
                  <span>{puntos[hover].futuro ? 'Previsto' : 'Cobrado'}</span><span>{nf0(puntos[hover].total)}</span>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 16, fontSize: 11, color: COLOR.textSec, marginTop: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: VERDE }} />Cobrado</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff', border: `2px solid ${VERDE}` }} />Previsto</span>
            </div>
          </div>
        )}
      </div>

      {/* POR PLATAFORMA · lo que está por cobrar (bruto + neto) */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ ...lblS, marginBottom: 12 }}>Por cobrar · por plataforma</div>
        {porCanal.length === 0 ? (
          <div style={{ fontFamily: LEXEND, fontSize: 13, color: COLOR.textMut }}>No hay cobros pendientes.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${porCanal.length}, 1fr)`, gap: 10 }}>
            {porCanal.map(c => (
              <div key={c.id} style={{ background: `${c.color}1a`, border: `0.5px solid ${c.color}`, borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ fontFamily: OSWALD, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: c.color, marginBottom: 8 }}>{c.label}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 10px', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: OSWALD, fontSize: 11, letterSpacing: '1.2px', textTransform: 'uppercase', color: COLOR.textMut }}>Bruto</span>
                  <span style={{ fontFamily: OSWALD, fontSize: 22, fontWeight: 600, color: '#111', textAlign: 'right' }}>{nf0(c.bruto)}</span>
                  <span style={{ fontFamily: OSWALD, fontSize: 11, letterSpacing: '1.2px', textTransform: 'uppercase', color: VERDE }}>Neto</span>
                  <span style={{ fontFamily: OSWALD, fontSize: 26, fontWeight: 700, color: VERDE, textAlign: 'right' }}>{nf0(c.neto)}</span>
                </div>
                {c.prox && <div style={{ fontFamily: LEXEND, fontSize: 11, color: COLOR.textMut, marginTop: 8 }}>Próximo: {fmtCorta(c.prox)}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PRÓXIMOS COBROS · agrupados por fecha */}
      <div style={card}>
        <div style={{ ...lblS, marginBottom: 12 }}>Próximos cobros · por fecha</div>
        {proximosPorFecha.length === 0 ? (
          <div style={{ fontFamily: LEXEND, fontSize: 13, color: COLOR.textMut }}>Sin cobros futuros previstos.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {proximosPorFecha.map((g, i) => (
              <div key={i} style={{ border: `0.5px solid ${BORDE}`, borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontFamily: OSWALD, fontSize: 14, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: COLOR.textPri }}>{fmtLarga(g.pago)}</span>
                  <span style={{ fontFamily: OSWALD, fontSize: 18, fontWeight: 700, color: VERDE }}>{nf0(g.total)}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {g.items.map((it, k) => (
                    <div key={k} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'baseline' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: OSWALD, fontSize: 11.5, letterSpacing: '0.5px', textTransform: 'uppercase', color: it.color }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: it.color }} />{it.label}
                      </span>
                      <span style={{ fontFamily: OSWALD, fontSize: 14, color: COLOR.textMut, textAlign: 'right' }}>{nf0(it.bruto)}</span>
                      <span style={{ fontFamily: OSWALD, fontSize: 15, fontWeight: 700, color: VERDE, textAlign: 'right', minWidth: 64 }}>{nf0(it.neto)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, fontFamily: OSWALD, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: COLOR.textMut, paddingRight: 2 }}>
              <span style={{ minWidth: 64, textAlign: 'right' }}>Bruto</span><span style={{ minWidth: 64, textAlign: 'right' }}>Neto</span>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
