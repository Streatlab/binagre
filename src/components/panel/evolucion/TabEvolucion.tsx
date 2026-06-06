/**
 * Tab Evolución — Panel Global · v8.1
 * - Datos REALES de facturacion_diario AGREGANDO todas las filas por fecha (2/día).
 * - Foco semana actual real (lunes de hoy). Grupos de pills: periodo (Semana/Mes/Año)
 *   a la izquierda + comparación a la derecha, estilo Facturación.
 * - Barras verticales con objetivo real y colores EXACTOS de Objetivos
 *   (#E24B4A rojo / #1D9E75 verde / #f5a623 naranja). Ancho 2 de 3 cards.
 * - Cards de comparación reales: canal, pedidos/TM y posición de calendario.
 */
import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/lib/format'
import { COLOR, LEXEND, OSWALD } from '../resumen/tokens'
import type { RowFacturacion } from '../resumen/types'

interface Props {
  rowsAll: RowFacturacion[]
  canalesFiltro: string[]
  rowsPeriodo?: RowFacturacion[]
  fechaDesde?: Date
  fechaHasta?: Date
  onFiltrarDiaSemana?: (idx: number) => void
}

type Periodo = 'semana' | 'mes' | 'anio'
type Comp = 'prev' | 'mes' | 'anio'

// Colores EXACTOS de la barra de cumplimiento de Objetivos
const ROJO = '#E24B4A'
const VERDE = '#1D9E75'
const NARANJA = '#f5a623'
const TRACK = '#ebe8e2'
const BORDE = '#d0c8bc'

const NOMBRES_DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const NOMBRES_DIAS_L = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const NOMBRES_MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

interface Agg {
  bruto: number; ped: number
  uber_bruto: number; uber_pedidos: number
  glovo_bruto: number; glovo_pedidos: number
  je_bruto: number; je_pedidos: number
  web_bruto: number; web_pedidos: number
  directa_bruto: number; directa_pedidos: number
}
const ZERO: Agg = { bruto: 0, ped: 0, uber_bruto: 0, uber_pedidos: 0, glovo_bruto: 0, glovo_pedidos: 0, je_bruto: 0, je_pedidos: 0, web_bruto: 0, web_pedidos: 0, directa_bruto: 0, directa_pedidos: 0 }

function toLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function mondayOf(d: Date): Date { const r = new Date(d); const dow = r.getDay() || 7; r.setDate(r.getDate() - dow + 1); r.setHours(0, 0, 0, 0); return r }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(d.getDate() + n); return r }
function shift(d: Date, c: Comp): Date {
  const r = new Date(d)
  if (c === 'prev') r.setDate(r.getDate() - 7)
  else if (c === 'mes') r.setMonth(r.getMonth() - 1)
  else r.setFullYear(r.getFullYear() - 1)
  return r
}
function nthWeekdayOfMonth(d: Date): number { return Math.floor((d.getDate() - 1) / 7) + 1 }
function weekOfMonth(d: Date): number { return Math.ceil(d.getDate() / 7) }

// color de relleno: igual que Objetivos (verde desde 50%)
function colorRelleno(pct: number): string { return pct >= 50 ? VERDE : NARANJA }
function colorDelta(v: number | null): string { return v == null ? COLOR.textMut : v >= 0 ? VERDE : ROJO }

const CANALES_DEF = [
  { id: 'uber', label: 'Uber Eats', color: COLOR.uber, bk: 'uber_bruto', pk: 'uber_pedidos' },
  { id: 'glovo', label: 'Glovo', color: COLOR.glovo, bk: 'glovo_bruto', pk: 'glovo_pedidos' },
  { id: 'je', label: 'Just Eat', color: COLOR.je, bk: 'je_bruto', pk: 'je_pedidos' },
  { id: 'web', label: 'Web', color: COLOR.webSL, bk: 'web_bruto', pk: 'web_pedidos' },
  { id: 'dir', label: 'Directa', color: COLOR.directa, bk: 'directa_bruto', pk: 'directa_pedidos' },
] as const

export default function TabEvolucion({ rowsAll, canalesFiltro }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>(() => (localStorage.getItem('evo_periodo') as Periodo) || 'semana')
  const [comp, setComp] = useState<Comp>(() => (localStorage.getItem('evo_comp') as Comp) || 'prev')
  const setPeriodoP = useCallback((p: Periodo) => { setPeriodo(p); localStorage.setItem('evo_periodo', p); if (p !== 'semana' && comp === 'prev') { setComp('mes'); localStorage.setItem('evo_comp', 'mes') } }, [comp])
  const setCompP = useCallback((c: Comp) => { setComp(c); localStorage.setItem('evo_comp', c) }, [])

  const [objDia, setObjDia] = useState<Record<number, number>>({})
  const [objBase, setObjBase] = useState(0)

  useEffect(() => {
    Promise.all([
      supabase.from('objetivos').select('importe').eq('tipo', 'diario'),
      supabase.from('objetivos_dia_semana').select('dia,importe'),
    ]).then(([rd, rs]) => {
      setObjBase(Number(((rd.data ?? [])[0] as { importe: number })?.importe || 0))
      const m: Record<number, number> = {}
      for (const r of (rs.data ?? []) as { dia: number; importe: number }[]) m[Number(r.dia)] = Number(r.importe)
      setObjDia(m)
    })
  }, [])

  // AGREGACIÓN por fecha (suma TODAS las filas del día — corrige el doble servicio)
  const agg = useMemo(() => {
    const m = new Map<string, Agg>()
    for (const r of rowsAll) {
      const a = m.get(r.fecha) ?? { ...ZERO }
      a.bruto += r.total_bruto || 0; a.ped += r.total_pedidos || 0
      a.uber_bruto += r.uber_bruto || 0; a.uber_pedidos += r.uber_pedidos || 0
      a.glovo_bruto += r.glovo_bruto || 0; a.glovo_pedidos += r.glovo_pedidos || 0
      a.je_bruto += r.je_bruto || 0; a.je_pedidos += r.je_pedidos || 0
      a.web_bruto += r.web_bruto || 0; a.web_pedidos += r.web_pedidos || 0
      a.directa_bruto += r.directa_bruto || 0; a.directa_pedidos += r.directa_pedidos || 0
      m.set(r.fecha, a)
    }
    return m
  }, [rowsAll])

  const filtra = canalesFiltro.length > 0
  const brutoDia = useCallback((f: string): number | null => {
    const a = agg.get(f); if (!a) return null
    if (!filtra) return a.bruto
    return canalesFiltro.reduce((s, id) => { const c = CANALES_DEF.find(x => x.id === id); return s + (c ? (a[c.bk] as number) : 0) }, 0)
  }, [agg, filtra, canalesFiltro])
  const pedDia = useCallback((f: string): number => {
    const a = agg.get(f); if (!a) return 0
    if (!filtra) return a.ped
    return canalesFiltro.reduce((s, id) => { const c = CANALES_DEF.find(x => x.id === id); return s + (c ? (a[c.pk] as number) : 0) }, 0)
  }, [agg, filtra, canalesFiltro])

  const brutoRango = useCallback((ini: Date, fin: Date): { v: number; hay: boolean; ped: number } => {
    let v = 0, ped = 0, hay = false
    for (let d = new Date(ini); d <= fin; d = addDays(d, 1)) {
      const f = toLocal(d); const b = brutoDia(f)
      if (b != null) { hay = true; v += b; ped += pedDia(f) }
    }
    return { v, hay, ped }
  }, [brutoDia, pedDia])

  const hoy = new Date(); const hoyStr = toLocal(hoy)
  const lunes = useMemo(() => mondayOf(hoy), [hoyStr])
  const domingo = useMemo(() => addDays(lunes, 6), [lunes])

  const labelComp = comp === 'prev' ? (periodo === 'semana' ? 'la semana anterior' : 'el periodo anterior') : comp === 'mes' ? 'el mes anterior' : 'el año anterior'

  // ── Segmentos de barras según periodo ──
  const segmentos = useMemo(() => {
    if (periodo === 'semana') {
      return NOMBRES_DIAS.map((nombre, i) => {
        const dia = addDays(lunes, i); const f = toLocal(dia)
        const real = brutoDia(f)
        const histF = toLocal(shift(dia, comp))
        const hist = brutoDia(histF)
        const obj = objDia[i + 1] || objBase || 0
        const futuro = f > hoyStr
        return { nombre, real, hist, obj, futuro, esActual: f === hoyStr, deltaPct: real != null && hist != null && hist > 0 ? ((real - hist) / hist) * 100 : null }
      })
    }
    if (periodo === 'mes') {
      const y = hoy.getFullYear(), m = hoy.getMonth()
      const finMes = new Date(y, m + 1, 0).getDate()
      const nSem = Math.ceil(finMes / 7)
      return Array.from({ length: nSem }, (_, k) => {
        const ini = new Date(y, m, k * 7 + 1)
        const fin = new Date(y, m, Math.min((k + 1) * 7, finMes))
        const cur = brutoRango(ini, fin)
        const compMs = comp === 'anio' ? 12 : 1
        const iniC = new Date(y, m - compMs, k * 7 + 1)
        const finCdim = new Date(y, m - compMs + 1, 0).getDate()
        const finC = new Date(y, m - compMs, Math.min((k + 1) * 7, finCdim))
        const cc = brutoRango(iniC, finC)
        return { nombre: `S${k + 1}`, real: cur.hay ? cur.v : null, hist: cc.hay ? cc.v : null, obj: 0, futuro: ini > hoy, esActual: weekOfMonth(hoy) === k + 1, deltaPct: cur.hay && cc.hay && cc.v > 0 ? ((cur.v - cc.v) / cc.v) * 100 : null }
      })
    }
    // año → meses
    const y = hoy.getFullYear()
    return Array.from({ length: hoy.getMonth() + 1 }, (_, k) => {
      const ini = new Date(y, k, 1), fin = new Date(y, k + 1, 0)
      const cur = brutoRango(ini, fin)
      const iniC = new Date(y - 1, k, 1), finC = new Date(y - 1, k + 1, 0)
      const cc = brutoRango(iniC, finC)
      return { nombre: NOMBRES_MES[k], real: cur.hay ? cur.v : null, hist: cc.hay ? cc.v : null, obj: 0, futuro: false, esActual: hoy.getMonth() === k, deltaPct: cur.hay && cc.hay && cc.v > 0 ? ((cur.v - cc.v) / cc.v) * 100 : null }
    })
  }, [periodo, comp, lunes, brutoDia, brutoRango, objDia, objBase, hoyStr])

  const total = useMemo(() => segmentos.reduce((a, s) => a + (s.real || 0), 0), [segmentos])
  const objTotal = useMemo(() => segmentos.reduce((a, s) => a + (s.obj || 0), 0), [segmentos])
  const totalHist = useMemo(() => { const hs = segmentos.filter(s => s.hist != null); return hs.length ? hs.reduce((a, s) => a + (s.hist || 0), 0) : null }, [segmentos])
  const pct = objTotal > 0 ? (total / objTotal) * 100 : 0
  const deltaTotal = totalHist != null && totalHist > 0 ? ((total - totalHist) / totalHist) * 100 : null
  const escala = useMemo(() => Math.max(...segmentos.map(s => Math.max(s.real || 0, s.obj || 0, s.hist || 0)), 1) * 1.15, [segmentos])

  // pedidos/tm del periodo + comparado
  const periodoIni = periodo === 'semana' ? lunes : periodo === 'mes' ? new Date(hoy.getFullYear(), hoy.getMonth(), 1) : new Date(hoy.getFullYear(), 0, 1)
  const periodoFin = periodo === 'semana' ? domingo : periodo === 'mes' ? new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0) : new Date(hoy.getFullYear(), 11, 31)
  const cur = useMemo(() => brutoRango(periodoIni, periodoFin), [brutoRango, periodoIni, periodoFin])
  const compIni = periodo === 'semana' ? shift(periodoIni, comp) : comp === 'anio' ? new Date(periodoIni.getFullYear() - 1, periodoIni.getMonth(), periodoIni.getDate()) : new Date(periodoIni.getFullYear(), periodoIni.getMonth() - 1, 1)
  const compFin = periodo === 'semana' ? shift(periodoFin, comp) : comp === 'anio' ? new Date(periodoFin.getFullYear() - 1, periodoFin.getMonth(), periodoFin.getDate()) : new Date(periodoIni.getFullYear(), periodoIni.getMonth(), 0)
  const curComp = useMemo(() => brutoRango(compIni, compFin), [brutoRango, compIni, compFin])
  const pedidos = cur.ped
  const tm = pedidos > 0 ? cur.v / pedidos : 0
  const tmComp = curComp.ped > 0 ? curComp.v / curComp.ped : 0
  const deltaPedidos = curComp.hay && curComp.ped > 0 ? ((pedidos - curComp.ped) / curComp.ped) * 100 : null
  const deltaTM = curComp.hay && tmComp > 0 ? ((tm - tmComp) / tmComp) * 100 : null

  // canal comparado
  const canalComp = useMemo(() => {
    const visibles = filtra ? CANALES_DEF.filter(c => canalesFiltro.includes(c.id)) : CANALES_DEF
    return visibles.map(c => {
      let v = 0, vc = 0, hayC = false
      for (let d = new Date(periodoIni); d <= periodoFin; d = addDays(d, 1)) { const a = agg.get(toLocal(d)); if (a) v += a[c.bk] as number }
      for (let d = new Date(compIni); d <= compFin; d = addDays(d, 1)) { const a = agg.get(toLocal(d)); if (a) { hayC = true; vc += a[c.bk] as number } }
      return { ...c, v, vc: hayC ? vc : null, delta: hayC && vc > 0 ? ((v - vc) / vc) * 100 : null }
    })
  }, [agg, filtra, canalesFiltro, periodoIni, periodoFin, compIni, compFin])
  const maxCanal = Math.max(...canalComp.map(c => c.v), 1)

  // posición de calendario
  const calendario = useMemo(() => {
    const wd = (hoy.getDay() + 6) % 7
    const nth = nthWeekdayOfMonth(hoy)
    const wom = weekOfMonth(hoy)
    const valHoy = brutoDia(hoyStr)
    const nthEnMes = (atrasMes: number, atrasAnio: number): number | null => {
      const t = new Date(hoy.getFullYear() - atrasAnio, hoy.getMonth() - atrasMes, 1)
      const firstWd = (t.getDay() + 6) % 7
      const day = 1 + ((wd - firstWd + 7) % 7) + (nth - 1) * 7
      const dim = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()
      if (day > dim) return null
      return brutoDia(toLocal(new Date(t.getFullYear(), t.getMonth(), day)))
    }
    const semDeMes = (atrasMes: number, atrasAnio: number): number | null => {
      const t = new Date(hoy.getFullYear() - atrasAnio, hoy.getMonth() - atrasMes, 1)
      const dim = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()
      if ((wom - 1) * 7 + 1 > dim) return null
      const ini = new Date(t.getFullYear(), t.getMonth(), (wom - 1) * 7 + 1)
      const fin = new Date(t.getFullYear(), t.getMonth(), Math.min(wom * 7, dim))
      const r = brutoRango(ini, fin); return r.hay ? r.v : null
    }
    const semActual = (() => { const ini = new Date(hoy.getFullYear(), hoy.getMonth(), (wom - 1) * 7 + 1); const fin = new Date(hoy.getFullYear(), hoy.getMonth(), wom * 7); const r = brutoRango(ini, fin); return r.hay ? r.v : null })()
    return {
      diaLabel: `${nth}º ${NOMBRES_DIAS_L[wd]} del mes`,
      valHoy, diaMesAnt: nthEnMes(1, 0), diaAnioAnt: nthEnMes(0, 1),
      semLabel: `${wom}ª semana del mes`,
      semActual, semMesAnt: semDeMes(1, 0), semAnioAnt: semDeMes(0, 1),
    }
  }, [hoyStr, brutoDia, brutoRango])

  // ── pills ──
  const pill = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
    fontFamily: OSWALD, letterSpacing: '0.5px', textTransform: 'uppercase', fontWeight: 600,
    border: active ? 'none' : `0.5px solid ${BORDE}`,
    background: active ? COLOR.rojo : '#fff', color: active ? '#fff' : '#3a4050',
  })

  const periodoTabs: { id: Periodo; label: string }[] = [{ id: 'semana', label: 'Semana' }, { id: 'mes', label: 'Mes' }, { id: 'anio', label: 'Año' }]
  const compTabs: { id: Comp; label: string }[] = periodo === 'semana'
    ? [{ id: 'prev', label: 'vs sem. ant.' }, { id: 'mes', label: 'vs mes ant.' }, { id: 'anio', label: 'vs año ant.' }]
    : [{ id: 'mes', label: 'vs mes ant.' }, { id: 'anio', label: 'vs año ant.' }]

  const tituloPeriodo = periodo === 'semana' ? `${String(lunes.getDate()).padStart(2, '0')}/${String(lunes.getMonth() + 1).padStart(2, '0')} — ${String(domingo.getDate()).padStart(2, '0')}/${String(domingo.getMonth() + 1).padStart(2, '0')}`
    : periodo === 'mes' ? hoy.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : String(hoy.getFullYear())

  const lblStyle: React.CSSProperties = { fontFamily: OSWALD, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: COLOR.textMut }
  const cardSt: React.CSSProperties = { background: '#fff', border: `0.5px solid ${BORDE}`, borderRadius: 16, padding: '18px 20px' }
  const BAR_AREA = 190

  return (
    <div style={{ fontFamily: LEXEND, color: COLOR.textPri, paddingTop: 18 }}>

      {/* ── TITULAR + GRUPOS DE PILLS ── */}
      <div style={{ ...cardSt, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ display: 'inline-flex', gap: 8 }}>
            {periodoTabs.map(t => <button key={t.id} onClick={() => setPeriodoP(t.id)} style={pill(periodo === t.id)}>{t.label}</button>)}
          </div>
          <div style={{ display: 'inline-flex', gap: 8 }}>
            {compTabs.map(t => <button key={t.id} onClick={() => setCompP(t.id)} style={pill(comp === t.id)}>{t.label}</button>)}
          </div>
        </div>
        <div style={{ fontFamily: OSWALD, fontSize: 'clamp(28px,4.2vw,44px)', fontWeight: 600, lineHeight: 1.04, color: COLOR.textPri }}>
          {deltaTotal == null ? 'PERIODO EN MARCHA' : 'EL NEGOCIO VA'}{' '}
          {deltaTotal != null && <span style={{ color: colorDelta(deltaTotal), background: `${colorDelta(deltaTotal)}1f`, padding: '0 10px', borderRadius: 8 }}>{deltaTotal >= 0 ? '+' : ''}{deltaTotal.toFixed(1)}%</span>}
          {deltaTotal != null && <span> VS {labelComp.toUpperCase()}.</span>}
        </div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ fontFamily: LEXEND, fontSize: 16, fontWeight: 500, color: COLOR.textSec }}>
            Llevas <strong style={{ color: COLOR.textPri }}>{fmtEur(total, { decimals: 2 })}</strong> · {pedidos} pedidos · ticket medio <strong style={{ color: COLOR.textPri }}>{fmtEur(tm, { decimals: 2 })}</strong>.
          </div>
          {deltaPedidos != null && (
            <div style={{ fontFamily: LEXEND, fontSize: 16, fontWeight: 500, color: COLOR.textSec }}>
              Pedidos <strong style={{ color: colorDelta(deltaPedidos) }}>{deltaPedidos >= 0 ? '+' : ''}{deltaPedidos.toFixed(1)}%</strong> y ticket <strong style={{ color: colorDelta(deltaTM) }}>{deltaTM != null ? `${deltaTM >= 0 ? '+' : ''}${deltaTM.toFixed(1)}%` : '—'}</strong> vs {labelComp}.
            </div>
          )}
        </div>
      </div>

      {/* ── FILA: barras (2/3) + posición calendario (1/3) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>

        {/* CARD BARRAS */}
        <div style={cardSt}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            <div style={lblStyle}>{periodo === 'semana' ? 'FACTURACIÓN SEMANA' : periodo === 'mes' ? 'FACTURACIÓN MES' : 'FACTURACIÓN AÑO'} · {tituloPeriodo}</div>
            <span style={{ fontFamily: OSWALD, fontSize: 32, fontWeight: 600, color: objTotal > 0 ? (pct >= 100 ? VERDE : pct >= 50 ? NARANJA : ROJO) : COLOR.textPri }}>{fmtEur(total, { decimals: 2 })}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: periodo === 'anio' ? 6 : 10, height: BAR_AREA + 46 }}>
            {segmentos.map((s, i) => {
              const hObj = s.obj > 0 ? Math.max((s.obj / escala) * BAR_AREA, 4) : 0
              const hReal = s.real != null ? Math.max((s.real / escala) * BAR_AREA, s.real > 0 ? 3 : 0) : 0
              const p = s.obj > 0 && s.real != null ? (s.real / s.obj) * 100 : 0
              const relleno = Math.min(hReal, hObj)
              const sobre = Math.max(hReal - hObj, 0)
              const sinObj = s.obj === 0
              const hVal = sinObj ? hReal : 0
              const colVal = s.deltaPct == null ? COLOR.textMut : s.deltaPct >= 0 ? VERDE : ROJO
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  <span style={{ fontFamily: OSWALD, fontSize: periodo === 'anio' ? 9 : 11, fontWeight: 600, color: s.futuro ? COLOR.textMut : s.real != null ? (!sinObj && p >= 100 ? VERDE : COLOR.textPri) : COLOR.textMut, marginBottom: 2 }}>
                    {s.real != null ? fmtEur(s.real, { decimals: 0 }) : '—'}
                  </span>
                  {s.deltaPct != null && <span style={{ fontSize: 9, color: colorDelta(s.deltaPct), marginBottom: 3 }}>{s.deltaPct >= 0 ? '▲' : '▼'}{Math.abs(s.deltaPct).toFixed(0)}%</span>}
                  {sinObj ? (
                    <div style={{ width: '62%', height: hVal, background: s.futuro ? TRACK : colVal, borderRadius: '4px 4px 0 0', opacity: s.futuro ? 0.5 : 1 }} />
                  ) : (
                    <>
                      {sobre > 0 && <div style={{ width: '60%', height: sobre, background: VERDE, borderRadius: '4px 4px 0 0', position: 'relative' }}><span style={{ position: 'absolute', top: -2, left: 0, right: 0, textAlign: 'center', fontSize: 9, color: VERDE }}>⋯</span></div>}
                      <div style={{ width: '60%', height: hObj, background: s.futuro ? TRACK : ROJO, borderRadius: sobre > 0 ? 0 : '4px 4px 0 0', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', opacity: s.futuro ? 0.4 : 1, overflow: 'hidden' }}>
                        {!s.futuro && relleno > 0 && <div style={{ width: '100%', height: relleno, background: colorRelleno(p) }} />}
                      </div>
                    </>
                  )}
                  <span style={{ fontFamily: LEXEND, fontSize: periodo === 'anio' ? 10 : 12, color: s.esActual ? COLOR.textPri : COLOR.textMut, fontWeight: s.esActual ? 700 : 400, marginTop: 6 }}>{s.nombre}</span>
                </div>
              )
            })}
          </div>
          {objTotal > 0 && (
            <div style={{ marginTop: 12, fontFamily: LEXEND, fontSize: 12, color: COLOR.textMut }}>
              Barra roja = objetivo del día (Objetivos) · relleno verde/naranja = cumplimiento · objetivo total {fmtEur(objTotal, { decimals: 0 })}
            </div>
          )}
        </div>

        {/* CARD POSICIÓN CALENDARIO */}
        <div style={cardSt}>
          <div style={{ ...lblStyle, marginBottom: 14 }}>Posición en el calendario</div>
          {[
            { tit: calendario.diaLabel, base: calendario.valHoy, comps: [{ l: 'mes ant.', v: calendario.diaMesAnt }, { l: 'año ant.', v: calendario.diaAnioAnt }] },
            { tit: calendario.semLabel, base: calendario.semActual, comps: [{ l: 'mes ant.', v: calendario.semMesAnt }, { l: 'año ant.', v: calendario.semAnioAnt }] },
          ].map((blk, bi) => (
            <div key={bi} style={{ marginBottom: bi === 0 ? 18 : 0 }}>
              <div style={{ fontFamily: OSWALD, fontSize: 12, letterSpacing: '0.5px', textTransform: 'uppercase', color: COLOR.textSec, marginBottom: 6 }}>{blk.tit}</div>
              <div style={{ fontFamily: OSWALD, fontSize: 26, fontWeight: 600, color: blk.base == null ? COLOR.textMut : COLOR.textPri }}>{blk.base != null ? fmtEur(blk.base, { decimals: 0 }) : '—'}</div>
              <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
                {blk.comps.map((c, ci) => {
                  const d = blk.base != null && c.v != null && c.v > 0 ? ((blk.base - c.v) / c.v) * 100 : null
                  return (
                    <div key={ci} style={{ fontFamily: LEXEND, fontSize: 12 }}>
                      <span style={{ color: COLOR.textMut }}>{c.l}: </span>
                      <span style={{ color: c.v == null ? COLOR.textMut : COLOR.textSec }}>{c.v != null ? fmtEur(c.v, { decimals: 0 }) : 'sin dato'}</span>
                      {d != null && <span style={{ color: colorDelta(d), marginLeft: 4 }}>{d >= 0 ? '▲' : '▼'}{Math.abs(d).toFixed(0)}%</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FILA: canal comparado + pedidos/tm comparado ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* CANAL COMPARADO */}
        <div style={cardSt}>
          <div style={{ ...lblStyle, marginBottom: 4 }}>Facturación por canal</div>
          <div style={{ fontFamily: LEXEND, fontSize: 12, color: COLOR.textMut, marginBottom: 14 }}>actual vs {labelComp}</div>
          {canalComp.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 11 }}>
              <span style={{ minWidth: 74, fontFamily: LEXEND, fontSize: 12, color: COLOR.textSec }}>{c.label}</span>
              <div style={{ flex: 1, height: 8, background: TRACK, borderRadius: 4 }}>
                <div style={{ height: 8, width: `${Math.min((c.v / maxCanal) * 100, 100)}%`, background: c.id === 'glovo' ? '#c9d400' : c.color, borderRadius: 4 }} />
              </div>
              <span style={{ minWidth: 72, textAlign: 'right', fontFamily: OSWALD, fontSize: 14, fontWeight: 600, color: COLOR.textPri }}>{fmtEur(c.v, { decimals: 0 })}</span>
              <span style={{ minWidth: 56, textAlign: 'right', fontFamily: LEXEND, fontSize: 12, color: colorDelta(c.delta) }}>{c.delta == null ? '—' : `${c.delta >= 0 ? '▲' : '▼'}${Math.abs(c.delta).toFixed(0)}%`}</span>
            </div>
          ))}
        </div>

        {/* PEDIDOS / TM COMPARADO */}
        <div style={cardSt}>
          <div style={{ ...lblStyle, marginBottom: 14 }}>Pedidos y ticket medio · vs {labelComp}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { l: 'Pedidos', v: pedidos.toLocaleString('es-ES'), prev: curComp.hay ? curComp.ped.toLocaleString('es-ES') : null, d: deltaPedidos, col: '#1E5BCC' },
              { l: 'Ticket medio', v: fmtEur(tm, { decimals: 2 }), prev: tmComp > 0 ? fmtEur(tmComp, { decimals: 2 }) : null, d: deltaTM, col: NARANJA },
            ].map((k, i) => (
              <div key={i}>
                <div style={{ fontFamily: OSWALD, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: COLOR.textMut, marginBottom: 4 }}>{k.l}</div>
                <div style={{ fontFamily: OSWALD, fontSize: 26, fontWeight: 600, color: k.col }}>{k.v}</div>
                <div style={{ fontFamily: LEXEND, fontSize: 12, color: COLOR.textMut, marginTop: 4 }}>
                  {labelComp}: {k.prev ?? 'sin dato'}
                  {k.d != null && <span style={{ color: colorDelta(k.d), marginLeft: 6 }}>{k.d >= 0 ? '▲' : '▼'}{Math.abs(k.d).toFixed(1)}%</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
