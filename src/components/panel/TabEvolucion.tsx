/**
 * TabEvolucion — Panel Global · pestaña Evolución
 * Layout: editorial neobrutalista (secciones apiladas, fondo CREMA, bordes INK 4px)
 * Datos: intactos (mesMap, netoDeRow, CardComparativa, racha, días semana, tienda online)
 */

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  INK, CREMA, CLARO, TRACK, VERDE, ROJO, NAR, AZUL, GRIS, AMA, GRANATE, OSC,
  OSW, LEX, SHADOW, BORDER_CARD,
  eyebrow, d,
} from '@/styles/neobrutal'
import { fmtEur, fmtNum } from '@/utils/format'
import type { RowFacturacion } from '@/components/panel/resumen/types'

interface Props {
  rowsAll: RowFacturacion[]
  periodoDesde?: Date
  periodoHasta?: Date
  periodoOpcion?: string
}

const MESES_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const DIAS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const COMISIONES: Record<string, number> = {
  uber: 0.30, glovo: 0.30, je: 0.30, web: 0.07, directa: 0.00,
}
const CANALES_IDS = ['uber', 'glovo', 'je', 'web', 'directa'] as const

function netoDeRow(r: RowFacturacion): number {
  return CANALES_IDS.reduce((s, c) => {
    const bruto = (r as unknown as Record<string, number>)[`${c}_bruto`] ?? 0
    return s + bruto * (1 - COMISIONES[c])
  }, 0)
}

function fmtMesKey(key: string): string {
  const [y, m] = key.split('-')
  return `${MESES_ES[parseInt(m, 10) - 1]} ${y}`
}

// ── CardPesoOnline — lógica intacta, estilo neobrutal ────────
function CardPesoOnline({ rowsAll }: { rowsAll: RowFacturacion[] }) {
  const mesMap: Record<string, { total: number; online: number }> = {}
  rowsAll.forEach(r => {
    const key = r.fecha.slice(0, 7)
    if (!mesMap[key]) mesMap[key] = { total: 0, online: 0 }
    mesMap[key].total += r.total_bruto
    mesMap[key].online += (r.web_bruto ?? 0) + (r.directa_bruto ?? 0)
  })
  const keys = Object.keys(mesMap).sort().slice(-12)
  if (keys.length === 0) return null

  const ultimo = keys[keys.length - 1]
  const penultimo = keys.length >= 2 ? keys[keys.length - 2] : null
  const pctActual = mesMap[ultimo].total > 0 ? (mesMap[ultimo].online / mesMap[ultimo].total) * 100 : 0
  const pctAnterior = penultimo && mesMap[penultimo].total > 0 ? (mesMap[penultimo].online / mesMap[penultimo].total) * 100 : null
  const delta = pctAnterior !== null ? pctActual - pctAnterior : null

  return (
    <div style={{ background: '#fff', border: BORDER_CARD, boxShadow: SHADOW, padding: '20px 22px' }}>
      <span style={eyebrow(AZUL, '#fff')}>Tienda online · web + directa</span>
      <div style={{ ...d('clamp(32px,4vw,48px)', AZUL), marginTop: 10 }}>{pctActual.toFixed(1)}%</div>
      {delta !== null && (
        <div style={{ fontFamily: OSW, fontSize: 14, fontWeight: 600, color: delta >= 0 ? VERDE : ROJO, marginTop: 4 }}>
          {delta >= 0 ? '▲ +' : '▼ '}{Math.abs(delta).toFixed(1)} pts vs mes ant.
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 48, marginTop: 14 }}>
        {keys.map(k => {
          const pct = mesMap[k].total > 0 ? (mesMap[k].online / mesMap[k].total) * 100 : 0
          const h = Math.max(3, (pct / 100) * 44)
          const isActual = k === ultimo
          const [, m] = k.split('-')
          return (
            <div key={k} style={{ flex: 1, minWidth: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ width: '100%', height: h, background: isActual ? AZUL : AZUL + '55', border: isActual ? `1px solid ${INK}` : 'none' }} />
              <span style={{ fontFamily: OSW, fontSize: 9, color: isActual ? AZUL : GRIS, textTransform: 'uppercase' }}>
                {MESES_ES[parseInt(m, 10) - 1]}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── CardDiaSemana ─────────────────────────────────────────────
const DIA_NEO: Record<number, string> = { 0: ROJO, 1: AZUL, 2: VERDE, 3: NAR, 4: GRANATE, 5: AMA, 6: NAR }

function CardDiaSemana({ rowsAll }: { rowsAll: RowFacturacion[] }) {
  const diaMap: Record<number, { suma: number; count: number }> = {}
  for (let i = 0; i < 7; i++) diaMap[i] = { suma: 0, count: 0 }
  rowsAll.forEach(r => {
    const dd = new Date(r.fecha + 'T00:00:00').getDay()
    diaMap[dd].suma += r.total_bruto
    diaMap[dd].count += 1
  })
  const medias = Object.entries(diaMap).map(([dd, v]) => ({
    dia: parseInt(dd), media: v.count > 0 ? v.suma / v.count : 0,
  })).filter(x => x.media > 0)
  if (medias.length === 0) return null

  const maxMedia = Math.max(...medias.map(x => x.media))
  const minMedia = Math.min(...medias.map(x => x.media))
  const mejor = medias.find(x => x.media === maxMedia)!
  const peor = medias.find(x => x.media === minMedia)!

  return (
    <div style={{ background: '#fff', border: BORDER_CARD, boxShadow: SHADOW, padding: '20px 22px' }}>
      <span style={eyebrow(VERDE, '#fff')}>Mejor / peor día de semana</span>
      <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
        <div>
          <div style={{ fontFamily: OSW, fontSize: 11, color: VERDE, letterSpacing: '1px', textTransform: 'uppercase' }}>Mejor</div>
          <div style={{ ...d('clamp(24px,3vw,32px)', VERDE) }}>{DIAS_ES[mejor.dia]}</div>
          <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginTop: 3 }}>{fmtEur(mejor.media)} / día</div>
        </div>
        <div>
          <div style={{ fontFamily: OSW, fontSize: 11, color: ROJO, letterSpacing: '1px', textTransform: 'uppercase' }}>Peor</div>
          <div style={{ ...d('clamp(24px,3vw,32px)', ROJO) }}>{DIAS_ES[peor.dia]}</div>
          <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginTop: 3 }}>{fmtEur(peor.media)} / día</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 64, marginTop: 14 }}>
        {[1, 2, 3, 4, 5, 6, 0].map(dd => {
          const { suma, count } = diaMap[dd]
          const media = count > 0 ? suma / count : 0
          const h = maxMedia > 0 ? Math.max(3, (media / maxMedia) * 56) : 3
          const isMejor = dd === mejor.dia
          const isPeor = dd === peor.dia
          const barColor = isMejor ? VERDE : isPeor ? ROJO : DIA_NEO[dd]
          return (
            <div key={dd} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ width: '100%', height: h, background: barColor, border: `1px solid ${INK}` }} />
              <span style={{ fontFamily: OSW, fontSize: 10, color: isMejor ? VERDE : isPeor ? ROJO : GRIS, textTransform: 'uppercase' }}>
                {DIAS_ES[dd].slice(0, 2)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── CardTicketMedio ───────────────────────────────────────────
function CardTicketMedio({ rowsAll }: { rowsAll: RowFacturacion[] }) {
  const mesMap: Record<string, { bruto: number; pedidos: number }> = {}
  rowsAll.forEach(r => {
    const key = r.fecha.slice(0, 7)
    if (!mesMap[key]) mesMap[key] = { bruto: 0, pedidos: 0 }
    mesMap[key].bruto += r.total_bruto
    mesMap[key].pedidos += r.total_pedidos
  })
  const keys = Object.keys(mesMap).sort().slice(-12)
  if (keys.length === 0) return null
  const ultimo = keys[keys.length - 1]
  const penultimo = keys.length >= 2 ? keys[keys.length - 2] : null
  const tmActual = mesMap[ultimo].pedidos > 0 ? mesMap[ultimo].bruto / mesMap[ultimo].pedidos : 0
  const tmAnterior = penultimo && mesMap[penultimo].pedidos > 0 ? mesMap[penultimo].bruto / mesMap[penultimo].pedidos : null
  const delta = tmAnterior !== null ? tmActual - tmAnterior : null
  const maxTm = Math.max(...keys.map(k => mesMap[k].pedidos > 0 ? mesMap[k].bruto / mesMap[k].pedidos : 0), 1)

  return (
    <div style={{ background: '#fff', border: BORDER_CARD, boxShadow: SHADOW, padding: '20px 22px' }}>
      <span style={eyebrow(NAR, '#fff')}>Ticket medio mensual</span>
      <div style={{ ...d('clamp(28px,3.5vw,42px)', NAR), marginTop: 10 }}>{fmtEur(tmActual)}</div>
      {delta !== null && (
        <div style={{ fontFamily: OSW, fontSize: 14, fontWeight: 600, color: delta >= 0 ? VERDE : ROJO, marginTop: 4 }}>
          {delta >= 0 ? '▲ +' : '▼ '}{fmtEur(Math.abs(delta))} vs mes ant.
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 48, marginTop: 14 }}>
        {keys.map(k => {
          const tm = mesMap[k].pedidos > 0 ? mesMap[k].bruto / mesMap[k].pedidos : 0
          const h = maxTm > 0 ? Math.max(3, (tm / maxTm) * 44) : 3
          const isActual = k === ultimo
          const [, m] = k.split('-')
          return (
            <div key={k} style={{ flex: 1, minWidth: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ width: '100%', height: h, background: isActual ? NAR : NAR + '55', border: isActual ? `1px solid ${INK}` : 'none' }} />
              <span style={{ fontFamily: OSW, fontSize: 9, color: isActual ? NAR : GRIS, textTransform: 'uppercase' }}>
                {MESES_ES[parseInt(m, 10) - 1]}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── CardRachaObjetivo ─────────────────────────────────────────
interface ObjetivoDia { anio: number; mes: number; importe: number }

function CardRachaObjetivo({ rowsAll }: { rowsAll: RowFacturacion[] }) {
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
    if (r.total_bruto >= obj) racha++
    else break
  }

  const objActual = sorted[0] ? objMap[sorted[0].fecha.slice(0, 7)] : undefined
  if (objActual === undefined) return null

  const rachaColor = racha >= 7 ? VERDE : racha >= 3 ? NAR : ROJO
  const rachaLabel = racha === 0 ? 'Sin racha activa' : racha === 1 ? '1 día consecutivo' : `${racha} días consecutivos`

  return (
    <div style={{ background: OSC, border: BORDER_CARD, boxShadow: SHADOW, padding: '20px 22px' }}>
      <span style={eyebrow(AMA)}>Racha de objetivo diario</span>
      <div style={{ ...d('clamp(44px,6vw,72px)', rachaColor), marginTop: 10 }}>{fmtNum(racha)}</div>
      <div style={{ fontFamily: OSW, fontSize: 14, fontWeight: 600, color: rachaColor, marginTop: 4 }}>{rachaLabel}</div>
      <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginTop: 8 }}>Objetivo: {fmtEur(objActual)} / día</div>
    </div>
  )
}

// ── CardComparativaPeriodo — lógica intacta, estilo neobrutal ─
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

  const y = ancla.getFullYear(), m = ancla.getMonth(), day = ancla.getDate(), wd = ancla.getDay()

  let posLabel = '', posMesAntLbl = '', posAnioAntLbl = ''
  let fchLabel = '', fchMesAntLbl = '', fchAnioAntLbl = ''
  let posActual: number | null = null, posMesAnt: number | null = null, posAnioAnt: number | null = null
  let fchActual: number | null = null, fchMesAnt: number | null = null, fchAnioAnt: number | null = null

  if (vista === 'dia') {
    const n = Math.ceil(day / 7)
    const ord = ['1er', '2º', '3er', '4º', '5º'][n - 1] ?? `${n}º`
    posLabel = `${ord} ${DIAS_ES[wd]} del mes`
    posActual = valorDia(ancla)
    posMesAnt = valorDia(nthWeekdayOfMonth(y, m - 1, wd, n))
    posAnioAnt = valorDia(nthWeekdayOfMonth(y - 1, m, wd, n))
    posMesAntLbl = `${ord} ${DIAS_ES[wd]} de ${MESES_ES[(m + 11) % 12]}`
    posAnioAntLbl = `${ord} ${DIAS_ES[wd]} de ${MESES_ES[m]} ${y - 1}`
    fchLabel = `Día ${day}`
    fchActual = valorDia(ancla)
    fchMesAnt = valorDia(new Date(y, m - 1, day))
    fchAnioAnt = valorDia(new Date(y - 1, m, day))
    fchMesAntLbl = `${day} de ${MESES_ES[(m + 11) % 12]}`
    fchAnioAntLbl = `${day} de ${MESES_ES[m]} ${y - 1}`
  } else {
    const lunes = mondayOf(ancla), domingo = addDays(lunes, 6)
    const nSem = Math.ceil(day / 7)
    const week = isoWeek(ancla), wYear = isoWeekYear(ancla)
    posLabel = `${nSem}ª semana del mes`
    posActual = valorRango(lunes, domingo)
    const lunMesAnt = mondayOf(new Date(y, m - 1, Math.min((nSem - 1) * 7 + 1, 28)))
    posMesAnt = valorRango(lunMesAnt, addDays(lunMesAnt, 6))
    const lunISOprev = mondayOfISOWeek(wYear - 1, week)
    posAnioAnt = valorRango(lunISOprev, addDays(lunISOprev, 6))
    posMesAntLbl = `${nSem}ª sem. de ${MESES_ES[(m + 11) % 12]}`
    posAnioAntLbl = `sem. ISO ${week} de ${wYear - 1}`
    fchLabel = `Semana del ${day}`
    fchActual = valorRango(lunes, domingo)
    const lunFMesAnt = mondayOf(new Date(y, m - 1, day))
    fchMesAnt = valorRango(lunFMesAnt, addDays(lunFMesAnt, 6))
    const lunFAnioAnt = mondayOf(new Date(y - 1, m, day))
    fchAnioAnt = valorRango(lunFAnioAnt, addDays(lunFAnioAnt, 6))
    fchMesAntLbl = `sem. del ${day} de ${MESES_ES[(m + 11) % 12]}`
    fchAnioAntLbl = `sem. del ${day} de ${MESES_ES[m]} ${y - 1}`
  }

  const fmtVal = (v: number) => metrica === 'pedidos' ? fmtNum(v) : fmtEur(v)
  const deltaColor = (v: number | null, actual: number | null) => {
    if (v === null || actual === null || v === 0) return GRIS
    return ((actual - v) / v) * 100 >= 0 ? VERDE : ROJO
  }
  const deltaStr = (v: number | null, actual: number | null) => {
    if (v === null || actual === null || v === 0) return null
    const pct = ((actual - v) / v) * 100
    return `${pct >= 0 ? '▲ +' : '▼ '}${Math.abs(pct).toFixed(1)}%`
  }

  const pillStyle = (active: boolean, activeBg: string): React.CSSProperties => ({
    padding: '5px 13px', border: `2px solid ${INK}`, background: active ? activeBg : '#fff',
    color: active ? (activeBg === AMA ? INK : '#fff') : GRIS,
    fontFamily: OSW, fontSize: 12, fontWeight: 700, letterSpacing: '1px',
    textTransform: 'uppercase', cursor: 'pointer',
  })

  const Ref = ({ valor, actual, etq, sub }: { valor: number | null; actual: number | null; etq: string; sub: string }) => (
    <div style={{ flex: 1, borderLeft: `3px solid ${INK}`, paddingLeft: 12 }}>
      <div style={{ fontFamily: OSW, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: GRIS }}>{etq}</div>
      <div style={{ fontFamily: OSW, fontSize: 20, fontWeight: 600, color: INK, marginTop: 2 }}>{valor === null ? '—' : fmtVal(valor)}</div>
      <div style={{ fontFamily: LEX, fontSize: 10, color: GRIS, marginTop: 1 }}>{sub}</div>
      <div style={{ fontFamily: OSW, fontSize: 13, fontWeight: 700, color: deltaColor(valor, actual), marginTop: 3 }}>
        {deltaStr(valor, actual) ?? 'sin dato'}
      </div>
    </div>
  )

  const Bloque = ({ titulo, label, actual, mesAnt, anioAnt, mesAntSub, anioAntSub, accentColor }: {
    titulo: string; label: string; actual: number | null
    mesAnt: number | null; anioAnt: number | null; mesAntSub: string; anioAntSub: string; accentColor: string
  }) => (
    <div style={{ flex: 1, background: '#fff', border: BORDER_CARD, boxShadow: SHADOW, padding: '18px 20px' }}>
      <span style={eyebrow(accentColor, accentColor === AMA ? INK : '#fff')}>{titulo}</span>
      <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginTop: 6, marginBottom: 14 }}>{label}</div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: OSW, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: GRIS }}>Periodo actual</div>
          <div style={{ ...d('clamp(24px,3vw,32px)', INK), marginTop: 4 }}>{actual === null ? '—' : fmtVal(actual)}</div>
        </div>
        <Ref valor={mesAnt} actual={actual} etq="Mes anterior" sub={mesAntSub} />
        <Ref valor={anioAnt} actual={actual} etq="Año anterior" sub={anioAntSub} />
      </div>
    </div>
  )

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {(['ventas', 'pedidos', 'ticket'] as const).map((v, i) => (
            <button key={v} onClick={() => setMetrica(v)}
              style={{ ...pillStyle(metrica === v, GRANATE), borderRight: i < 2 ? 'none' : `2px solid ${INK}` }}>
              {v === 'ventas' ? 'Ventas' : v === 'pedidos' ? 'Pedidos' : 'Ticket'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 0 }}>
          {(['dia', 'semana'] as const).map((v, i) => (
            <button key={v} onClick={() => setVista(v)}
              style={{ ...pillStyle(vista === v, AMA), borderRight: i === 0 ? 'none' : `2px solid ${INK}` }}>
              {v === 'dia' ? 'Día' : 'Semana'}
            </button>
          ))}
        </div>
      </div>
      {/* Nota ancla */}
      <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginBottom: 14 }}>
        Ancla: {day} {MESES_ES[m]} {y} · misma posición y misma fecha frente a mes y año anteriores
      </div>
      {/* Bloques */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Bloque titulo="Por posición" label={posLabel} actual={posActual} mesAnt={posMesAnt} anioAnt={posAnioAnt}
          mesAntSub={posMesAntLbl} anioAntSub={posAnioAntLbl} accentColor={GRANATE} />
        <Bloque titulo="Por fecha" label={fchLabel} actual={fchActual} mesAnt={fchMesAnt} anioAnt={fchAnioAnt}
          mesAntSub={fchMesAntLbl} anioAntSub={fchAnioAntLbl} accentColor={AZUL} />
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────
export default function TabEvolucion({ rowsAll, periodoHasta }: Props) {
  if (!rowsAll.length) {
    return (
      <div style={{ background: CREMA, border: `4px solid ${INK}`, padding: '44px 40px', fontFamily: LEX, color: GRIS, textAlign: 'center' }}>
        Sin datos históricos disponibles
      </div>
    )
  }

  const mesMap: Record<string, { bruto: number; pedidos: number; neto: number }> = {}
  rowsAll.forEach(r => {
    const key = r.fecha.slice(0, 7)
    if (!mesMap[key]) mesMap[key] = { bruto: 0, pedidos: 0, neto: 0 }
    mesMap[key].bruto += r.total_bruto
    mesMap[key].pedidos += r.total_pedidos
    mesMap[key].neto += netoDeRow(r)
  })
  const todosMeses = Object.keys(mesMap).sort()
  const ultimos12 = todosMeses.slice(-12)
  const mejorMes = ultimos12.reduce((best, key) => mesMap[key].bruto > mesMap[best].bruto ? key : best, ultimos12[0])
  const peorMes = ultimos12.reduce((worst, key) => mesMap[key].bruto < mesMap[worst].bruto ? key : worst, ultimos12[0])
  const mesActualKey = ultimos12[ultimos12.length - 1]
  const mesActual = mesMap[mesActualKey]
  const [yActual, mActual] = mesActualKey.split('-')
  const mesAnteriorKey = `${parseInt(yActual) - 1}-${mActual}`
  const mesAnterior = mesMap[mesAnteriorKey]
  const tendenciaPct = mesAnterior && mesAnterior.bruto > 0
    ? ((mesActual.bruto - mesAnterior.bruto) / mesAnterior.bruto) * 100
    : null
  const maxBruto = Math.max(...ultimos12.map(k => mesMap[k].bruto), 1)

  const tendenciaColor = tendenciaPct === null ? GRIS : tendenciaPct >= 0 ? VERDE : ROJO

  return (
    <div style={{ background: CREMA, fontFamily: LEX, color: INK, border: `4px solid ${INK}` }}>

      {/* ── S1 · HERO (AMA) ── */}
      <section style={{ background: AMA, borderBottom: `4px solid ${INK}`, padding: '44px 40px' }}>
        <span style={eyebrow(INK, AMA)}>Evolución · últimos 12 meses</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 40, alignItems: 'start', marginTop: 18 }}>
          {/* Left: tendencia hero */}
          <div>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: INK, opacity: 0.6, marginBottom: 6 }}>
              Tendencia vs año anterior · {fmtMesKey(mesActualKey)}
            </div>
            <div style={{ ...d('clamp(52px,7.5vw,96px)', tendenciaColor) }}>
              {tendenciaPct === null ? '—' : `${tendenciaPct >= 0 ? '+' : ''}${tendenciaPct.toFixed(1)}%`}
            </div>
            <div style={{ display: 'flex', gap: 28, marginTop: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: OSW, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: INK, opacity: 0.6 }}>Bruto último mes</div>
                <div style={{ ...d('clamp(22px,3vw,30px)', INK), marginTop: 4 }}>{fmtEur(mesActual.bruto)}</div>
              </div>
              <div>
                <div style={{ fontFamily: OSW, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: INK, opacity: 0.6 }}>Neto estimado</div>
                <div style={{ ...d('clamp(22px,3vw,30px)', VERDE), marginTop: 4 }}>{fmtEur(mesActual.neto)}</div>
              </div>
              <div>
                <div style={{ fontFamily: OSW, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: INK, opacity: 0.6 }}>Pedidos</div>
                <div style={{ ...d('clamp(22px,3vw,30px)', INK), marginTop: 4 }}>{fmtNum(mesActual.pedidos)}</div>
              </div>
            </div>
          </div>
          {/* Right: mejor/peor mes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: VERDE, border: BORDER_CARD, boxShadow: SHADOW, padding: '14px 18px' }}>
              <div style={{ fontFamily: OSW, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#fff', opacity: 0.8 }}>Mejor mes (12m)</div>
              <div style={{ ...d('clamp(18px,2.5vw,24px)', '#fff'), marginTop: 4 }}>{fmtMesKey(mejorMes)}</div>
              <div style={{ fontFamily: LEX, fontSize: 13, color: '#ffffffcc', marginTop: 3 }}>{fmtEur(mesMap[mejorMes].bruto)}</div>
            </div>
            <div style={{ background: ROJO, border: BORDER_CARD, boxShadow: SHADOW, padding: '14px 18px' }}>
              <div style={{ fontFamily: OSW, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#fff', opacity: 0.8 }}>Peor mes (12m)</div>
              <div style={{ ...d('clamp(18px,2.5vw,24px)', '#fff'), marginTop: 4 }}>{fmtMesKey(peorMes)}</div>
              <div style={{ fontFamily: LEX, fontSize: 13, color: '#ffffffcc', marginTop: 3 }}>{fmtEur(mesMap[peorMes].bruto)}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── S2 · EVOLUCIÓN MENSUAL (#fff) ── */}
      <section style={{ background: '#fff', borderBottom: `4px solid ${INK}`, padding: '44px 40px' }}>
        <span style={eyebrow(CREMA)}>Evolución mensual · ventas brutas · últimos 12 meses</span>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140, marginTop: 24 }}>
          {ultimos12.map(key => {
            const { bruto } = mesMap[key]
            const h = maxBruto > 0 ? Math.max(4, (bruto / maxBruto) * 124) : 4
            const isMejor = key === mejorMes
            const isPeor = key === peorMes
            const barColor = isMejor ? VERDE : isPeor ? ROJO : GRANATE
            const [, mm] = key.split('-')
            return (
              <div key={key} style={{ flex: 1, minWidth: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontFamily: OSW, fontSize: 10, color: GRIS, textAlign: 'center' }}>
                  {fmtEur(bruto).replace(' €', '')}
                </span>
                <div style={{ width: '100%', height: h, background: barColor, border: BORDER_CARD, boxShadow: isMejor || isPeor ? SHADOW : 'none' }} />
                <span style={{ fontFamily: OSW, fontSize: 10, color: isMejor ? VERDE : isPeor ? ROJO : GRIS, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {MESES_ES[parseInt(mm, 10) - 1]}
                </span>
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
          <span style={{ fontFamily: LEX, fontSize: 11, color: VERDE }}>■ Mejor</span>
          <span style={{ fontFamily: LEX, fontSize: 11, color: ROJO }}>■ Peor</span>
          <span style={{ fontFamily: LEX, fontSize: 11, color: GRANATE }}>■ Resto</span>
        </div>
      </section>

      {/* ── S3 · ANÁLISIS (grid 2fr/1fr) ── */}
      <section style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', borderBottom: `4px solid ${INK}` }}>
        {/* Left: tabla mensual */}
        <div style={{ background: CREMA, padding: '44px 40px', borderRight: `4px solid ${INK}` }}>
          <span style={eyebrow(INK, CREMA)}>Detalle mensual</span>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
            <thead>
              <tr style={{ background: INK }}>
                {['Mes', 'Pedidos', 'Bruto', 'Neto est.', 'Ticket', 'vs año ant.'].map((h, i) => (
                  <th key={h} style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, padding: '9px 10px', textAlign: i === 0 ? 'left' : 'right', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...ultimos12].reverse().map((key, idx) => {
                const { bruto, pedidos, neto } = mesMap[key]
                const ticket = pedidos > 0 ? bruto / pedidos : 0
                const [yy, mm] = key.split('-')
                const antKey = `${parseInt(yy) - 1}-${mm}`
                const ant = mesMap[antKey]
                const vsAnt = ant && ant.bruto > 0 ? ((bruto - ant.bruto) / ant.bruto) * 100 : null
                const isMejor = key === mejorMes, isPeor = key === peorMes
                return (
                  <tr key={key} style={{ background: isMejor ? VERDE + '22' : isPeor ? ROJO + '22' : idx % 2 === 0 ? '#fff' : CLARO }}>
                    <td style={{ fontFamily: OSW, fontSize: 13, color: INK, padding: '8px 10px', borderBottom: `1px solid ${INK}22` }}>
                      {fmtMesKey(key)}
                      {isMejor && <span style={{ marginLeft: 8, fontSize: 9, color: VERDE, fontFamily: OSW }}>▲ MEJOR</span>}
                      {isPeor && <span style={{ marginLeft: 8, fontSize: 9, color: ROJO, fontFamily: OSW }}>▼ PEOR</span>}
                    </td>
                    <td style={{ fontFamily: OSW, fontSize: 13, color: INK, padding: '8px 10px', textAlign: 'right', borderBottom: `1px solid ${INK}22` }}>{fmtNum(pedidos)}</td>
                    <td style={{ fontFamily: OSW, fontSize: 13, color: INK, padding: '8px 10px', textAlign: 'right', borderBottom: `1px solid ${INK}22` }}>{fmtEur(bruto)}</td>
                    <td style={{ fontFamily: OSW, fontSize: 13, color: VERDE, padding: '8px 10px', textAlign: 'right', borderBottom: `1px solid ${INK}22` }}>{fmtEur(neto)}</td>
                    <td style={{ fontFamily: OSW, fontSize: 13, color: NAR, padding: '8px 10px', textAlign: 'right', borderBottom: `1px solid ${INK}22` }}>{fmtEur(ticket)}</td>
                    <td style={{ fontFamily: OSW, fontSize: 13, color: vsAnt === null ? GRIS : vsAnt >= 0 ? VERDE : ROJO, padding: '8px 10px', textAlign: 'right', borderBottom: `1px solid ${INK}22` }}>
                      {vsAnt === null ? '—' : `${vsAnt >= 0 ? '+' : ''}${vsAnt.toFixed(1)}%`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {/* Right: métricas extra */}
        <div style={{ background: CLARO, padding: '44px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <span style={eyebrow(INK, CREMA)}>Métricas extra</span>
          <CardTicketMedio rowsAll={rowsAll} />
          <CardRachaObjetivo rowsAll={rowsAll} />
        </div>
      </section>

      {/* ── S4 · DÍAS + TIENDA ONLINE (grid 1fr/1fr, #fff) ── */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `4px solid ${INK}` }}>
        <div style={{ background: '#fff', padding: '44px 40px', borderRight: `4px solid ${INK}` }}>
          <span style={eyebrow(VERDE, '#fff')}>Rendimiento por día de semana</span>
          <div style={{ marginTop: 16 }}>
            <CardDiaSemana rowsAll={rowsAll} />
          </div>
        </div>
        <div style={{ background: '#fff', padding: '44px 40px' }}>
          <span style={eyebrow(AZUL, '#fff')}>Canal propio · peso sobre total</span>
          <div style={{ marginTop: 16 }}>
            <CardPesoOnline rowsAll={rowsAll} />
          </div>
        </div>
      </section>

      {/* ── S5 · COMPARATIVA PERIODO (CREMA) ── */}
      <section style={{ background: CREMA, padding: '44px 40px' }}>
        <span style={eyebrow(GRANATE, '#fff')}>Comparativa del periodo · posición y fecha</span>
        <div style={{ marginTop: 20 }}>
          <CardComparativaPeriodo rowsAll={rowsAll} ancla={periodoHasta ?? new Date()} />
        </div>
      </section>

    </div>
  )
}
