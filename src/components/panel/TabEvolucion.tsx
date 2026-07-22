/**
 * TabEvolucion — Panel Global · pestaña Evolución
 * Composición PROPIA (no clon de Resumen): la historia es la TRAYECTORIA en el
 * tiempo. Hero de tendencia a sangre + gráfico mensual como firma + racha,
 * detalle mes a mes, ritmo semanal, tienda propia y comparativa de periodo.
 * Toda la lógica de datos es la original (mesMap, netoDeRow, racha, día de
 * semana, online, CardComparativaPeriodo): solo cambia la presentación.
 */

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  INK, OSC, CREMA, CLARO, TRACK, ROSA, ROJO, AMA, VERDE, NAR, AZUL, GRANATE, GRIS, OSW, LEX, SHADOW, PAD, eyebrow, d, BLANCO } from '@/styles/neobrutal'
import { fmtEur, fmtNum } from '@/utils/format'
import type { RowFacturacion } from '@/components/panel/resumen/types'
import { resolverNeto } from '@/lib/panel/netoResolver'
import { useNetoContext } from '@/lib/panel/useNetoContext'

interface Props {
  rowsAll: RowFacturacion[]
  periodoDesde?: Date
  periodoHasta?: Date
  periodoOpcion?: string
}

const MESES_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const DIAS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

// LEY-NETO-01: el neto SIEMPRE sale de resolverNeto, nunca de comisiones fijas.
const CH = [
  { id: 'uber',  bk: 'uber_bruto',    pk: 'uber_pedidos' },
  { id: 'glovo', bk: 'glovo_bruto',   pk: 'glovo_pedidos' },
  { id: 'je',    bk: 'je_bruto',      pk: 'je_pedidos' },
  { id: 'web',   bk: 'web_bruto',     pk: 'web_pedidos' },
  { id: 'dir',   bk: 'directa_bruto', pk: 'directa_pedidos' },
] as const

// ── Helpers de cifra ──────────────────────────────────────────
const EUR = (n: number) => fmtEur(n)
const E = (n: number) => fmtEur(n).replace(/\s?€/, '')
const N = (n: number) => fmtNum(n)
const P0 = (n: number) => `${Math.round(n)}%`
const P1 = (n: number) => `${n.toFixed(1)}%`
const fmtMesKey = (key: string) => { const [y, m] = key.split('-'); return `${MESES_ES[parseInt(m, 10) - 1]} ${y}` }

// ── Dispositivos visuales ─────────────────────────────────────
function Arrow({ v }: { v: number | null }) {
  if (v == null) return null
  const up = v >= 0
  return <span style={{ fontSize: '0.62em', marginRight: 5, color: up ? VERDE : ROJO }}>{up ? '▲' : '▼'}</span>
}

function Spark({ serie, color = INK, w = 240, h = 54, dashed = false }: { serie: number[]; color?: string; w?: number; h?: number; dashed?: boolean }) {
  if (!serie || serie.length < 2) return null
  const max = Math.max(1, ...serie), step = w / (serie.length - 1)
  const path = serie.map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${(h - (v / max) * h).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', maxWidth: w, height: h }} preserveAspectRatio="none">
      <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill={`${color}${dashed ? '14' : '22'}`} />
      <path d={path} fill="none" stroke={color} strokeWidth={dashed ? 2.5 : 3} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={dashed ? '5 4' : undefined} />
    </svg>
  )
}

function Barra({ nombre, pct, color, valor, alto = 30, track = TRACK }: { nombre: string; pct: number; color: string; valor: string; alto?: number; track?: string }) {
  const fill = Math.min(100, Math.max(0, pct))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ ...d('15px'), width: 64, flexShrink: 0, lineHeight: 1.05 }}>{nombre}</span>
      <div style={{ position: 'relative', flex: 1, height: alto, background: track, border: `3px solid ${INK}`, overflow: 'hidden' }}>
        <div style={{ width: `${fill}%`, height: '100%', background: color, transition: 'width .3s', boxShadow: `2px 0 0 ${INK}` }} />
      </div>
      <span style={{ ...d('16px'), width: 90, textAlign: 'right', flexShrink: 0 }}>{valor}</span>
    </div>
  )
}

const Title: React.FC<{ tag: string; tagBg: string; tagColor?: string; title: string; dark?: boolean }> = ({ tag, tagBg, tagColor = INK, title, dark }) => (
  <>
    <span style={eyebrow(tagBg, tagColor)}>{tag}</span>
    {title && <div style={{ ...d('clamp(24px,3vw,38px)', dark ? CREMA : INK), margin: '14px 0 22px' }}>{title}</div>}
  </>
)

// ── Racha de objetivo (async, lógica intacta) ─────────────────
interface ObjetivoDia { anio: number; mes: number; importe: number }
function useRacha(rowsAll: RowFacturacion[]) {
  const [objetivos, setObjetivos] = useState<ObjetivoDia[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('objetivos').select('anio, mes, importe').eq('tipo', 'diario')
      .then(({ data }) => { setObjetivos((data ?? []) as ObjetivoDia[]); setLoading(false) })
  }, [])
  if (loading || objetivos.length === 0) return null
  const objMap: Record<string, number> = {}
  objetivos.forEach(o => { objMap[`${o.anio}-${String(o.mes).padStart(2, '0')}`] = o.importe })
  const sorted = [...rowsAll].sort((a, b) => b.fecha.localeCompare(a.fecha))
  let racha = 0
  for (const r of sorted) {
    const obj = objMap[r.fecha.slice(0, 7)]
    if (obj === undefined) break
    if (r.total_bruto >= obj) racha++; else break
  }
  const objActual = sorted[0] ? objMap[sorted[0].fecha.slice(0, 7)] : undefined
  if (objActual === undefined) return null
  return { racha, objActual }
}

// ── Comparativa del periodo (lógica de fechas 100% intacta) ───
type Metrica = 'ventas' | 'pedidos' | 'ticket'

function CardComparativaPeriodo({ rowsAll, ancla }: { rowsAll: RowFacturacion[]; ancla: Date }) {
  const [vista, setVista] = useState<'dia' | 'semana'>('dia')
  const [metrica, setMetrica] = useState<Metrica>('ventas')

  const brutoMap: Record<string, number> = {}
  const pedidosMap: Record<string, number> = {}
  const datoSet = new Set<string>()
  rowsAll.forEach(r => {
    const f = r.fecha.slice(0, 10)
    brutoMap[f] = (brutoMap[f] ?? 0) + r.total_bruto
    pedidosMap[f] = (pedidosMap[f] ?? 0) + r.total_pedidos
    datoSet.add(f)
  })

  const ymd = (dd: Date) => `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`
  const addDays = (dd: Date, n: number) => { const r = new Date(dd); r.setDate(dd.getDate() + n); return r }
  const mondayOf = (dd: Date) => { const r = new Date(dd); const w = r.getDay() || 7; r.setDate(r.getDate() - w + 1); r.setHours(0, 0, 0, 0); return r }

  const valorDia = (dd: Date): number | null => {
    const f = ymd(dd)
    if (!datoSet.has(f)) return null
    const b = brutoMap[f] ?? 0, p = pedidosMap[f] ?? 0
    return metrica === 'ventas' ? b : metrica === 'pedidos' ? p : (p > 0 ? b / p : 0)
  }
  const valorRango = (desde: Date, hasta: Date): number | null => {
    let b = 0, p = 0, hayDato = false
    for (let dd = new Date(desde); dd <= hasta; dd = addDays(dd, 1)) {
      const f = ymd(dd)
      if (datoSet.has(f)) { hayDato = true; b += brutoMap[f] ?? 0; p += pedidosMap[f] ?? 0 }
    }
    if (!hayDato) return null
    return metrica === 'ventas' ? b : metrica === 'pedidos' ? p : (p > 0 ? b / p : 0)
  }
  const nthWeekdayOfMonth = (year: number, month: number, weekday: number, n: number) => {
    const first = new Date(year, month, 1)
    const shift = (weekday - first.getDay() + 7) % 7
    return new Date(year, month, 1 + shift + (n - 1) * 7)
  }
  const isoWeek = (dd: Date) => {
    const x = new Date(Date.UTC(dd.getFullYear(), dd.getMonth(), dd.getDate()))
    const dn = x.getUTCDay() || 7
    x.setUTCDate(x.getUTCDate() + 4 - dn)
    const ys = new Date(Date.UTC(x.getUTCFullYear(), 0, 1))
    return Math.ceil(((x.getTime() - ys.getTime()) / 86400000 + 1) / 7)
  }
  const isoWeekYear = (dd: Date) => {
    const x = new Date(Date.UTC(dd.getFullYear(), dd.getMonth(), dd.getDate()))
    const dn = x.getUTCDay() || 7
    x.setUTCDate(x.getUTCDate() + 4 - dn)
    return x.getUTCFullYear()
  }
  const mondayOfISOWeek = (year: number, week: number) => {
    const simple = new Date(year, 0, 1 + (week - 1) * 7)
    const dow = simple.getDay()
    const r = new Date(simple)
    if (dow <= 4) r.setDate(simple.getDate() - simple.getDay() + 1)
    else r.setDate(simple.getDate() + 8 - simple.getDay())
    r.setHours(0, 0, 0, 0)
    return r
  }

  const y = ancla.getFullYear(), mo = ancla.getMonth(), day = ancla.getDate(), wd = ancla.getDay()
  let posLabel = '', posMesAntLbl = '', posAnioAntLbl = ''
  let fchLabel = '', fchMesAntLbl = '', fchAnioAntLbl = ''
  let posActual: number | null = null, posMesAnt: number | null = null, posAnioAnt: number | null = null
  let fchActual: number | null = null, fchMesAnt: number | null = null, fchAnioAnt: number | null = null

  if (vista === 'dia') {
    const n = Math.ceil(day / 7)
    const ord = ['1er', '2º', '3er', '4º', '5º'][n - 1] ?? `${n}º`
    posLabel = `${ord} ${DIAS_ES[wd]} del mes`
    posActual = valorDia(ancla)
    posMesAnt = valorDia(nthWeekdayOfMonth(y, mo - 1, wd, n))
    posAnioAnt = valorDia(nthWeekdayOfMonth(y - 1, mo, wd, n))
    posMesAntLbl = `${ord} ${DIAS_ES[wd]} de ${MESES_ES[(mo + 11) % 12]}`
    posAnioAntLbl = `${ord} ${DIAS_ES[wd]} de ${MESES_ES[mo]} ${y - 1}`
    fchLabel = `Día ${day}`
    fchActual = valorDia(ancla)
    fchMesAnt = valorDia(new Date(y, mo - 1, day))
    fchAnioAnt = valorDia(new Date(y - 1, mo, day))
    fchMesAntLbl = `${day} de ${MESES_ES[(mo + 11) % 12]}`
    fchAnioAntLbl = `${day} de ${MESES_ES[mo]} ${y - 1}`
  } else {
    const lunes = mondayOf(ancla), domingo = addDays(lunes, 6)
    const nSem = Math.ceil(day / 7)
    const week = isoWeek(ancla), wYear = isoWeekYear(ancla)
    posLabel = `${nSem}ª semana del mes`
    posActual = valorRango(lunes, domingo)
    const lunMesAnt = mondayOf(new Date(y, mo - 1, Math.min((nSem - 1) * 7 + 1, 28)))
    posMesAnt = valorRango(lunMesAnt, addDays(lunMesAnt, 6))
    const lunISOprev = mondayOfISOWeek(wYear - 1, week)
    posAnioAnt = valorRango(lunISOprev, addDays(lunISOprev, 6))
    posMesAntLbl = `${nSem}ª sem. de ${MESES_ES[(mo + 11) % 12]}`
    posAnioAntLbl = `sem. ISO ${week} de ${wYear - 1}`
    fchLabel = `Semana del ${day}`
    fchActual = valorRango(lunes, domingo)
    const lunFMesAnt = mondayOf(new Date(y, mo - 1, day))
    fchMesAnt = valorRango(lunFMesAnt, addDays(lunFMesAnt, 6))
    const lunFAnioAnt = mondayOf(new Date(y - 1, mo, day))
    fchAnioAnt = valorRango(lunFAnioAnt, addDays(lunFAnioAnt, 6))
    fchMesAntLbl = `sem. del ${day} de ${MESES_ES[(mo + 11) % 12]}`
    fchAnioAntLbl = `sem. del ${day} de ${MESES_ES[mo]} ${y - 1}`
  }

  const fmtVal = (v: number) => metrica === 'pedidos' ? N(v) : E(v)
  const deltaPct = (v: number | null, actual: number | null) => (v !== null && v > 0 && actual !== null) ? ((actual - v) / v) * 100 : null

  const pill = (active: boolean, bg: string): React.CSSProperties => ({
    padding: '6px 14px', border: `2px solid ${INK}`, background: active ? bg : BLANCO,
    color: active ? (bg === AMA ? INK : BLANCO) : GRIS, fontFamily: OSW, fontWeight: 700,
    fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer',
  })

  const Ref = ({ valor, actual, etq, sub }: { valor: number | null; actual: number | null; etq: string; sub: string }) => {
    const dp = deltaPct(valor, actual)
    return (
      <div style={{ flex: 1, minWidth: 110, borderLeft: `3px solid ${INK}22`, paddingLeft: 14 }}>
        <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: GRIS }}>{etq}</div>
        <div style={{ ...d('20px', INK), marginTop: 3 }}>{valor === null ? '—' : fmtVal(valor)}</div>
        <div style={{ fontFamily: LEX, fontSize: 11, color: GRIS, marginTop: 2 }}>{sub}</div>
        <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 14, color: dp === null ? GRIS : dp >= 0 ? VERDE : ROJO, marginTop: 4 }}>
          {dp === null ? 'sin dato' : <><Arrow v={dp} />{P1(dp)}</>}
        </div>
      </div>
    )
  }

  const Bloque = ({ titulo, label, actual, mesAnt, anioAnt, mesAntSub, anioAntSub, accent }: {
    titulo: string; label: string; actual: number | null; mesAnt: number | null; anioAnt: number | null
    mesAntSub: string; anioAntSub: string; accent: string
  }) => (
    <div style={{ flex: '1 1 360px', background: BLANCO, border: `3px solid ${INK}`, boxShadow: SHADOW, padding: '20px 22px' }}>
      <span style={{ ...eyebrow(accent, accent === AMA ? INK : BLANCO), fontSize: 12 }}>{titulo}</span>
      <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, margin: '8px 0 16px' }}>{label}</div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 110 }}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: GRIS }}>Periodo actual</div>
          <div style={{ ...d('clamp(26px,3.2vw,36px)', INK), marginTop: 4 }}>{actual === null ? '—' : fmtVal(actual)}</div>
        </div>
        <Ref valor={mesAnt} actual={actual} etq="Mes anterior" sub={mesAntSub} />
        <Ref valor={anioAnt} actual={actual} etq="Año anterior" sub={anioAntSub} />
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {(['ventas', 'pedidos', 'ticket'] as const).map((v, i) => (
            <button key={v} onClick={() => setMetrica(v)} style={{ ...pill(metrica === v, GRANATE), borderRight: i < 2 ? 'none' : `2px solid ${INK}` }}>
              {v === 'ventas' ? 'Ventas' : v === 'pedidos' ? 'Pedidos' : 'Ticket'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 0 }}>
          {(['dia', 'semana'] as const).map((v, i) => (
            <button key={v} onClick={() => setVista(v)} style={{ ...pill(vista === v, AMA), borderRight: i === 0 ? 'none' : `2px solid ${INK}` }}>
              {v === 'dia' ? 'Día' : 'Semana'}
            </button>
          ))}
        </div>
        <span style={{ fontFamily: LEX, fontSize: 12, color: '#6b5d45' }}>
          Ancla {day} {MESES_ES[mo]} {y} · misma posición y misma fecha frente a mes y año anteriores
        </span>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <Bloque titulo="Por posición" label={posLabel} actual={posActual} mesAnt={posMesAnt} anioAnt={posAnioAnt} mesAntSub={posMesAntLbl} anioAntSub={posAnioAntLbl} accent={GRANATE} />
        <Bloque titulo="Por fecha" label={fchLabel} actual={fchActual} mesAnt={fchMesAnt} anioAnt={fchAnioAnt} mesAntSub={fchMesAntLbl} anioAntSub={fchAnioAntLbl} accent={AZUL} />
      </div>
    </div>
  )
}

// ── LANDING principal ─────────────────────────────────────────
export default function TabEvolucion({ rowsAll, periodoHasta }: Props) {
  const racha = useRacha(rowsAll)
  const { configCanales: config, marcasPorCanal } = useNetoContext()

  if (!rowsAll.length) {
    return (
      <div style={{ background: CREMA, border: `4px solid ${INK}`, padding: `64px ${PAD}`, fontFamily: LEX, color: GRIS, textAlign: 'center' }}>
        Sin datos históricos disponibles
      </div>
    )
  }

  // ── Agregación mensual · neto por canal vía resolverNeto (LEY-NETO-01) ──
  const mesAgg: Record<string, { bruto: number; pedidos: number; online: number; canal: Record<string, { b: number; p: number }>; dias: Set<string> }> = {}
  rowsAll.forEach(r => {
    const key = r.fecha.slice(0, 7)
    const e = (mesAgg[key] ??= { bruto: 0, pedidos: 0, online: 0, canal: {}, dias: new Set() })
    e.bruto += r.total_bruto
    e.pedidos += r.total_pedidos
    e.online += (r.web_bruto ?? 0) + (r.directa_bruto ?? 0)
    if ((r.total_bruto ?? 0) > 0) e.dias.add(r.fecha)
    for (const c of CH) {
      const cc = (e.canal[c.id] ??= { b: 0, p: 0 })
      cc.b += (r as unknown as Record<string, number>)[c.bk] ?? 0
      cc.p += (r as unknown as Record<string, number>)[c.pk] ?? 0
    }
  })
  const mesMap: Record<string, { bruto: number; pedidos: number; neto: number; online: number }> = {}
  for (const [key, e] of Object.entries(mesAgg)) {
    const [y, m] = key.split('-').map(Number)
    const mDesde = new Date(y, m - 1, 1)
    const mHasta = new Date(y, m, 0)
    const nD = e.dias.size || 1
    let neto = 0
    for (const c of CH) {
      const cc = e.canal[c.id] ?? { b: 0, p: 0 }
      neto += resolverNeto(c.id, cc.b, cc.p, {
        modo: 'agregado_canal', marcasPorCanal, fechaDesde: mDesde, fechaHasta: mHasta,
        configCanales: config, diasConDatos: nD,
      }).neto
    }
    mesMap[key] = { bruto: e.bruto, pedidos: e.pedidos, neto, online: e.online }
  }
  const ultimos12 = Object.keys(mesMap).sort().slice(-12)
  const mejorMes = ultimos12.reduce((b, k) => mesMap[k].bruto > mesMap[b].bruto ? k : b, ultimos12[0])
  const peorMes = ultimos12.reduce((w, k) => mesMap[k].bruto < mesMap[w].bruto ? k : w, ultimos12[0])
  const mesActualKey = ultimos12[ultimos12.length - 1]
  const mesActual = mesMap[mesActualKey]
  const [yA, mA] = mesActualKey.split('-')
  const mesAnterior = mesMap[`${parseInt(yA) - 1}-${mA}`]
  const tendencia = mesAnterior && mesAnterior.bruto > 0 ? ((mesActual.bruto - mesAnterior.bruto) / mesAnterior.bruto) * 100 : null
  const maxBruto = Math.max(...ultimos12.map(k => mesMap[k].bruto), 1)
  const serie12 = ultimos12.map(k => mesMap[k].bruto)

  const tmActual = mesActual.pedidos > 0 ? mesActual.bruto / mesActual.pedidos : 0
  const pesoOnline = mesActual.bruto > 0 ? (mesActual.online / mesActual.bruto) * 100 : 0
  const tmMedio = (() => { const tot = ultimos12.reduce((a, k) => ({ b: a.b + mesMap[k].bruto, p: a.p + mesMap[k].pedidos }), { b: 0, p: 0 }); return tot.p > 0 ? tot.b / tot.p : 0 })()
  const pedidosTotales = ultimos12.reduce((a, k) => a + mesMap[k].pedidos, 0)

  // ── Día de semana (intacta) ──
  const diaMap: Record<number, { suma: number; count: number }> = {}
  for (let i = 0; i < 7; i++) diaMap[i] = { suma: 0, count: 0 }
  rowsAll.forEach(r => { const dd = new Date(r.fecha + 'T00:00:00').getDay(); diaMap[dd].suma += r.total_bruto; diaMap[dd].count += 1 })
  const medias = Object.entries(diaMap).map(([dd, v]) => ({ dia: parseInt(dd), media: v.count > 0 ? v.suma / v.count : 0 })).filter(x => x.media > 0)
  const maxMedia = medias.length ? Math.max(...medias.map(x => x.media)) : 1
  const mejorDia = medias.length ? medias.reduce((a, x) => x.media > a.media ? x : a) : null
  const peorDia = medias.length ? medias.reduce((a, x) => x.media < a.media ? x : a) : null

  // ── Serie online 12m para sparkline ──
  const serieOnline = ultimos12.map(k => mesMap[k].bruto > 0 ? (mesMap[k].online / mesMap[k].bruto) * 100 : 0)

  // Color y verbo de la tendencia (la tendencia es el protagonista de Evolución)
  const tendColor = tendencia == null ? AMA : tendencia >= 3 ? VERDE : tendencia <= -3 ? ROJO : NAR
  const tendTxt = tendencia == null ? INK : BLANCO
  const verbo = tendencia == null ? 'En marcha' : tendencia >= 3 ? 'En crecimiento' : tendencia <= -3 ? 'A la baja' : 'Estable'

  // Mini-stats de la tira inferior del hero (resumen de la trayectoria)
  const heroStats: Array<{ l: string; v: string; c: string }> = [
    { l: 'Mejor mes (12m)', v: fmtMesKey(mejorMes), c: VERDE },
    { l: 'Peor mes (12m)', v: fmtMesKey(peorMes), c: ROJO },
    { l: 'TM medio 12m', v: EUR(tmMedio), c: NAR },
    { l: 'Pedidos 12m', v: N(pedidosTotales), c: INK },
    { l: 'Neto est. último mes', v: EUR(mesActual.neto), c: VERDE },
  ]

  const sec = (bg: string, pad = `44px ${PAD}`): React.CSSProperties => ({ background: bg, padding: pad, borderBottom: `4px solid ${INK}` })

  return (
    <div style={{ background: CREMA, fontFamily: LEX, color: INK, border: `4px solid ${INK}` }}>

      {/* 0 · HERO — la TENDENCIA manda. Full-bleed, sin tarjeta lateral. */}
      <section style={{ background: tendColor, color: tendTxt, borderBottom: `4px solid ${INK}`, padding: `42px ${PAD} 34px` }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={eyebrow(BLANCO)}>Evolución · últimos 12 meses</span>
          <span style={{ ...eyebrow(INK, tendColor === AMA ? AMA : BLANCO), fontSize: 12, color: tendColor === AMA ? INK : tendColor }}>{verbo}</span>
        </div>
        <div style={{ ...d('clamp(30px,4vw,52px)', tendTxt), margin: '18px 0', maxWidth: 760 }}>
          {tendencia == null
            ? <>Aún no hay histórico del año pasado para comparar.</>
            : <>Frente al año pasado, el negocio va{' '}
                <span style={{ background: INK, color: tendColor, padding: '0 .14em', display: 'inline-block' }}>{tendencia >= 0 ? '+' : '−'}{P1(Math.abs(tendencia))}</span>.</>}
        </div>
        <div style={{ display: 'flex', gap: 28, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: OSW, fontSize: 13, fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase' }}>Facturación último mes · {fmtMesKey(mesActualKey)}</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
              <div style={d('clamp(44px,6.8vw,92px)', tendTxt)}>{EUR(mesActual.bruto)}</div>
              {tendencia != null && <div style={{ ...eyebrow(tendencia >= 0 ? VERDE : ROJO, BLANCO), fontSize: 18, padding: '7px 12px', marginBottom: 10 }}><Arrow v={tendencia} />{P1(Math.abs(tendencia))}</div>}
            </div>
          </div>
          <div style={{ marginBottom: 4, minWidth: 200, flex: 1 }}><Spark serie={serie12} color={tendColor === AMA ? INK : BLANCO} w={320} /></div>
          <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 12, background: VERDE, color: BLANCO, border: `3px solid ${INK}`, boxShadow: SHADOW, padding: '8px 16px' }}>
            <span style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Neto est. mes</span>
            <span style={d('clamp(22px,3.2vw,38px)', BLANCO)}>{EUR(mesActual.neto)}</span>
            <span style={{ fontFamily: OSW, fontSize: 15, fontWeight: 600 }}>{N(mesActual.pedidos)} ped.</span>
          </div>
        </div>
        {/* tira de mini-stats: la trayectoria en una línea */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 26 }}>
          {heroStats.map(s => (
            <div key={s.l} style={{ background: BLANCO, border: `3px solid ${INK}`, boxShadow: SHADOW, padding: '12px 14px' }}>
              <div style={{ fontFamily: OSW, fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: GRIS }}>{s.l}</div>
              <div style={{ ...d('clamp(18px,2.4vw,24px)', s.c), marginTop: 4 }}>{s.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 1 · GRÁFICO MES A MES — la firma de Evolución, a todo el ancho */}
      <section style={sec(BLANCO)}>
        <Title tag="Cómo ha ido mes a mes" tagBg={AMA} title="Facturación bruta · últimos 12 meses" />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, minHeight: 180, marginBottom: 14 }}>
          {ultimos12.map(key => {
            const { bruto } = mesMap[key]
            const isMejor = key === mejorMes, isPeor = key === peorMes
            const barCol = isMejor ? VERDE : isPeor ? ROJO : GRANATE
            const [, mm] = key.split('-')
            return (
              <div key={key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                <span style={{ fontFamily: OSW, fontSize: 10.5, fontWeight: 600 }}>{E(bruto)}</span>
                <div style={{ width: '100%', height: `${Math.max(4, (bruto / maxBruto) * 100)}%`, minHeight: 4, background: barCol, border: `3px solid ${INK}` }} />
                <span style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{MESES_ES[parseInt(mm, 10) - 1]}</span>
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: OSW, fontSize: 13, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
          <span><span style={{ color: VERDE }}>▲</span> {fmtMesKey(mejorMes)} · {E(mesMap[mejorMes].bruto)}</span>
          <span><span style={{ color: ROJO }}>▼</span> {fmtMesKey(peorMes)} · {E(mesMap[peorMes].bruto)}</span>
        </div>
      </section>

      {/* 2 · DETALLE MENSUAL (66%) | TICKET MEDIO + RACHA (33%) */}
      <section style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', borderBottom: `4px solid ${INK}` }}>
        <div style={{ padding: `44px ${PAD}`, borderRight: `4px solid ${INK}`, background: BLANCO }}>
          <Title tag="Mes a mes" tagBg={VERDE} tagColor={BLANCO} title="Detalle mensual" />
          <div style={{ border: `3px solid ${INK}`, boxShadow: SHADOW, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr 1fr', gap: 8, padding: '11px 16px', background: INK, fontFamily: OSW, fontSize: 11.5, letterSpacing: '1px', textTransform: 'uppercase', color: CREMA }}>
              <span>Mes</span><span style={{ textAlign: 'right' }}>Pedidos</span><span style={{ textAlign: 'right' }}>Bruto</span><span style={{ textAlign: 'right' }}>Neto est.</span><span style={{ textAlign: 'right' }}>vs año</span>
            </div>
            {[...ultimos12].reverse().map((key, i) => {
              const { bruto, pedidos, neto } = mesMap[key]
              const [yy, mm] = key.split('-')
              const ant = mesMap[`${parseInt(yy) - 1}-${mm}`]
              const vsAnt = ant && ant.bruto > 0 ? ((bruto - ant.bruto) / ant.bruto) * 100 : null
              const isMejor = key === mejorMes, isPeor = key === peorMes
              const dot = isMejor ? VERDE : isPeor ? ROJO : GRANATE
              return (
                <div key={key} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr 1fr', gap: 8, alignItems: 'center', padding: '12px 16px', borderTop: `1px solid ${INK}1a`, background: isMejor ? '#eafaef' : isPeor ? '#fdecec' : (i % 2 ? '#fbf8f1' : BLANCO) }}>
                  <span style={{ fontFamily: LEX, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 9, height: 9, flexShrink: 0, background: dot, border: `1px solid ${INK}` }} />{fmtMesKey(key)}
                  </span>
                  <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 16, color: INK, textAlign: 'right' }}>{N(pedidos)}</span>
                  <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 16, color: INK, textAlign: 'right' }}>{E(bruto)}</span>
                  <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 16, color: VERDE, textAlign: 'right' }}>{E(neto)}</span>
                  <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 14, color: vsAnt == null ? GRIS : vsAnt >= 0 ? VERDE : ROJO, textAlign: 'right' }}>{vsAnt == null ? '—' : <><Arrow v={vsAnt} />{P1(Math.abs(vsAnt))}</>}</span>
                </div>
              )
            })}
          </div>
        </div>
        <div style={{ padding: `44px ${PAD}`, background: CLARO, display: 'flex', flexDirection: 'column', gap: 26 }}>
          <div>
            <span style={eyebrow(NAR, BLANCO)}>Ticket medio último mes</span>
            <div style={{ ...d('clamp(32px,4.4vw,52px)', NAR), margin: '12px 0 8px' }}>{EUR(tmActual)}</div>
            <Spark serie={ultimos12.map(k => mesMap[k].pedidos > 0 ? mesMap[k].bruto / mesMap[k].pedidos : 0)} color={NAR} w={240} h={44} />
            <div style={{ fontFamily: LEX, fontSize: 13, fontWeight: 600, color: '#5c5340', marginTop: 6 }}>Media 12m · {EUR(tmMedio)}</div>
          </div>
          <div style={{ borderTop: `3px solid ${INK}`, paddingTop: 18 }}>
            <span style={eyebrow(VERDE, BLANCO)}>Racha de objetivo diario</span>
            {racha
              ? <>
                  <div style={{ ...d('clamp(40px,5.5vw,68px)', racha.racha >= 7 ? VERDE : racha.racha >= 3 ? NAR : ROJO), margin: '12px 0 6px' }}>{N(racha.racha)}</div>
                  <div style={{ fontFamily: OSW, fontSize: 13, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{racha.racha === 1 ? 'día consecutivo' : 'días consecutivos'}</div>
                  <div style={{ fontFamily: LEX, fontSize: 12.5, fontWeight: 600, color: '#5c5340', marginTop: 6 }}>Objetivo · {EUR(racha.objActual)}/día</div>
                </>
              : <div style={{ fontFamily: LEX, fontSize: 13, fontWeight: 600, color: '#5c5340', marginTop: 12 }}>Sin objetivo diario configurado.</div>}
          </div>
        </div>
      </section>

      {/* 3 · RITMO SEMANAL (AMA) | TIENDA PROPIA (AZUL) */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `4px solid ${INK}` }}>
        <div style={{ background: AMA, padding: `44px ${PAD}`, borderRight: `4px solid ${INK}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
            <span style={eyebrow(INK, AMA)}>Tu semana típica</span>
            {mejorDia && peorDia && (
              <span style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                <span style={{ color: VERDE }}>▲ {DIAS_ES[mejorDia.dia]}</span>
                <span style={{ color: ROJO, marginLeft: 8 }}>▼ {DIAS_ES[peorDia.dia]}</span>
              </span>
            )}
          </div>
          {medias.length
            ? <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, minHeight: 160 }}>
                {[1, 2, 3, 4, 5, 6, 0].map(dd => {
                  const { suma, count } = diaMap[dd]
                  const media = count > 0 ? suma / count : 0
                  const isMejor = mejorDia?.dia === dd, isPeor = peorDia?.dia === dd
                  const barCol = isMejor ? VERDE : isPeor ? ROJO : INK
                  return (
                    <div key={dd} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                      <span style={{ fontFamily: OSW, fontSize: 10.5, fontWeight: 600 }}>{media > 0 ? E(media) : ''}</span>
                      <div style={{ width: '100%', height: `${Math.max(4, (media / maxMedia) * 100)}%`, minHeight: 4, background: barCol, border: `3px solid ${INK}` }} />
                      <span style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{DIAS_ES[dd].slice(0, 2)}</span>
                    </div>
                  )
                })}
              </div>
            : <div style={{ fontFamily: LEX, fontWeight: 600, fontSize: 13.5, color: '#5c5340' }}>Sin datos suficientes por día de semana.</div>}
          <div style={{ fontFamily: LEX, fontSize: 13, fontWeight: 600, marginTop: 14 }}>Media por día de semana · histórico completo.</div>
        </div>
        <div style={{ background: AZUL, color: BLANCO, padding: `44px ${PAD}`, display: 'flex', flexDirection: 'column' }}>
          <span style={eyebrow(BLANCO)}>Canal propio · web + directa</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, margin: '18px 0 6px', flexWrap: 'wrap' }}>
            <div style={d('clamp(48px,6.5vw,82px)', BLANCO)}>{P0(pesoOnline)}</div>
            <div style={{ fontFamily: OSW, fontSize: 14, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', opacity: 0.9 }}>de la facturación</div>
          </div>
          <div style={{ marginTop: 12 }}><Spark serie={serieOnline} color={BLANCO} w={300} h={56} /></div>
          <div style={{ marginTop: 'auto', paddingTop: 18 }}>
            <Barra nombre="Online" pct={pesoOnline} color={AMA} valor={E(mesActual.online)} alto={26} track="#ffffff33" />
            <div style={{ fontFamily: LEX, fontSize: 13, fontWeight: 600, opacity: 0.9, marginTop: 12 }}>
              Cuanto más peso propio, menos comisión de plataforma. Web 7% vs marketplaces 30%.
            </div>
          </div>
        </div>
      </section>

      {/* 4 · COMPARATIVA DEL PERIODO */}
      <section style={sec(CREMA)}>
        <Title tag="Comparativa del periodo" tagBg={GRANATE} tagColor={BLANCO} title="Misma posición y misma fecha, frente a mes y año anteriores." />
        <CardComparativaPeriodo rowsAll={rowsAll} ancla={periodoHasta ?? new Date()} />
      </section>

      {/* 5 · CIERRE */}
      <section style={{ background: OSC, color: CREMA, padding: PAD, textAlign: 'center' }}>
        <div style={d('clamp(30px,5.5vw,64px)', CREMA)}>Cada mes, un peldaño más.</div>
        <div style={{ fontFamily: OSW, letterSpacing: '6px', fontSize: 15, color: AMA, marginTop: 12, textTransform: 'uppercase' }}>Comer bien. Aquí y ahora.</div>
      </section>

    </div>
  )
}
