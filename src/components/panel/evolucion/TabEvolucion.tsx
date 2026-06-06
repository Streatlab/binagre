/**
 * Tab Evolución — Panel Global · v10
 * Pills idénticos a Facturación (TabsPastilla comparación + separador + SUBTAB invertido Semana/Mes/Año).
 * Canal: cards de color reales (estilo Resumen) con bruto/neto/margen + delta vs comparado.
 * Barras tamaño fijo medio, relleno objetivo (rojo #E24B4A/amarillo<50/verde≥50/sobrebarra).
 * Importes sin € con miles. Batería 20 frases por regla. Ticket/pedidos por día. Posición calendario.
 */
import { useEffect, useMemo, useState, useCallback, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import TabsPastilla from '@/components/ui/TabsPastilla'
import { COLOR, COLORS, FONT, LEXEND, OSWALD, lblXs } from '../resumen/tokens'
import { calcNetoPorCanal, loadConfigCanales, recargarConfigCanales, loadMarcasPorCanal, type CanalConfig, type MarcasPorCanal } from '@/lib/panel/calcNetoPlataforma'
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

const ROJO = '#E24B4A'
const VERDE = '#1D9E75'
const AMARILLO = '#f5a623'
const VERDE_SOBRE = '#147A5A'
const TRACK = '#ebe8e2'
const BORDE = '#d0c8bc'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DIAS_L = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const DIAS_COLOR = [COLOR.diaLun, COLOR.diaMar, COLOR.diaMie, COLOR.diaJue, COLOR.diaVie, COLOR.diaSab, COLOR.diaDom]

const nf0 = (n: number) => Math.round(n).toLocaleString('es-ES')
const nf2 = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface Agg { bruto: number; ped: number;[k: string]: number }
const ZERO = (): Agg => ({ bruto: 0, ped: 0, uber_bruto: 0, uber_pedidos: 0, glovo_bruto: 0, glovo_pedidos: 0, je_bruto: 0, je_pedidos: 0, web_bruto: 0, web_pedidos: 0, directa_bruto: 0, directa_pedidos: 0 })

function toLocal(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function mondayOf(d: Date) { const r = new Date(d); const w = r.getDay() || 7; r.setDate(r.getDate() - w + 1); r.setHours(0, 0, 0, 0); return r }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(d.getDate() + n); return r }
function shiftD(d: Date, c: Comp) { const r = new Date(d); if (c === 'prev') r.setDate(r.getDate() - 7); else if (c === 'mes') r.setMonth(r.getMonth() - 1); else r.setFullYear(r.getFullYear() - 1); return r }
function nthWd(d: Date) { return Math.floor((d.getDate() - 1) / 7) + 1 }
function wom(d: Date) { return Math.ceil(d.getDate() / 7) }
function colorDelta(v: number | null) { return v == null ? COLOR.textMut : v >= 0 ? VERDE : ROJO }

const CANALES = [
  { id: 'uber', label: 'UBER EATS', color: COLOR.uber, bk: 'uber_bruto', pk: 'uber_pedidos', mini: false, bg: `${COLOR.uber}20`, brd: COLOR.uber, lab: COLOR.verdeOscuro },
  { id: 'glovo', label: 'GLOVO', color: COLOR.glovo, bk: 'glovo_bruto', pk: 'glovo_pedidos', mini: false, bg: `${COLOR.glovo}30`, brd: 'rgba(200,180,0,0.30)', lab: COLOR.glovoDark },
  { id: 'je', label: 'JUST EAT', color: COLOR.je, bk: 'je_bruto', pk: 'je_pedidos', mini: false, bg: `${COLOR.je}20`, brd: COLOR.je, lab: COLOR.jeDark },
  { id: 'web', label: 'WEB', color: COLOR.webSL, bk: 'web_bruto', pk: 'web_pedidos', mini: true, bg: `${COLOR.webSL}10`, brd: `${COLOR.webSL}50`, lab: COLOR.webDark },
  { id: 'dir', label: 'DIRECTA', color: COLOR.directa, bk: 'directa_bruto', pk: 'directa_pedidos', mini: true, bg: `${COLOR.directa}20`, brd: COLOR.directa, lab: COLOR.directaDark },
] as const

/* SUBTAB invertido — idéntico a Facturación */
const SUBTAB_CONTAINER: CSSProperties = { display: 'inline-flex', gap: 4, padding: '3px 4px', borderRadius: 10, background: COLORS.accent, border: `0.5px solid ${COLORS.accent}` }
const SUBTAB_ACTIVE: CSSProperties = { padding: '4px 10px', borderRadius: 6, border: 'none', background: '#ffffff', color: COLORS.pri, fontFamily: FONT.heading, fontSize: 10, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', cursor: 'pointer', outline: 'none' }
const SUBTAB_INACTIVE: CSSProperties = { padding: '4px 10px', borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.25)', color: '#ffffff', fontFamily: FONT.heading, fontSize: 10, fontWeight: 500, letterSpacing: '1.2px', textTransform: 'uppercase', cursor: 'pointer', outline: 'none' }

/* ── BATERÍA 20 FRASES ── */
interface Esc { pctObj: number; dV: number | null; dP: number | null; dT: number | null; diasRest: number; falta: number; hayComp: boolean; total: number; proy: number; obj: number; labelComp: string }
interface FraseDef { cond: (e: Esc) => boolean; txt: (e: Esc) => string; color: () => string }
const POS = VERDE, NEG = ROJO, WARN = AMARILLO, NEU = COLOR.textSec
const BATERIA: FraseDef[] = [
  { cond: e => e.total === 0, txt: () => 'Aún no hay facturación registrada en este periodo.', color: () => NEU },
  { cond: e => e.pctObj >= 120, txt: e => `Objetivo pulverizado: ${e.pctObj.toFixed(0)}% del objetivo. Ritmo excelente.`, color: () => POS },
  { cond: e => e.pctObj >= 100, txt: e => `Objetivo superado (${e.pctObj.toFixed(0)}%). A mantener el nivel.`, color: () => POS },
  { cond: e => e.pctObj < 100 && e.diasRest > 0 && e.proy >= e.obj && e.obj > 0, txt: e => `Vas al ${e.pctObj.toFixed(0)}%, pero al ritmo actual cerrarías por encima del objetivo.`, color: () => POS },
  { cond: e => e.pctObj >= 90 && e.pctObj < 100 && e.diasRest > 0, txt: e => `Muy cerca: ${e.pctObj.toFixed(0)}% del objetivo, faltan ${nf0(e.falta)} en ${e.diasRest} día${e.diasRest === 1 ? '' : 's'}.`, color: () => WARN },
  { cond: e => e.hayComp && (e.dV ?? 0) >= 10, txt: e => `Facturación +${(e.dV ?? 0).toFixed(0)}% vs ${e.labelComp}. Tendencia al alza.`, color: () => POS },
  { cond: e => e.hayComp && (e.dV ?? 0) > 0 && (e.dV ?? 0) < 10, txt: e => `Ligeramente por encima de ${e.labelComp} (+${(e.dV ?? 0).toFixed(1)}%).`, color: () => POS },
  { cond: e => e.hayComp && Math.abs(e.dV ?? 0) <= 1, txt: e => `En línea con ${e.labelComp}. Sin cambios relevantes.`, color: () => NEU },
  { cond: e => e.hayComp && (e.dV ?? 0) <= -15, txt: e => `Atención: facturación ${(e.dV ?? 0).toFixed(0)}% vs ${e.labelComp}. Hay que reaccionar.`, color: () => NEG },
  { cond: e => e.hayComp && (e.dV ?? 0) < 0, txt: e => `Por debajo de ${e.labelComp} (${(e.dV ?? 0).toFixed(1)}%). Margen de mejora.`, color: () => NEG },
  { cond: e => e.hayComp && (e.dP ?? 0) <= -10, txt: e => `Caen los pedidos (${(e.dP ?? 0).toFixed(0)}% vs ${e.labelComp}). Revisar visibilidad/promos.`, color: () => NEG },
  { cond: e => e.hayComp && (e.dP ?? 0) >= 10, txt: e => `Más pedidos que ${e.labelComp} (+${(e.dP ?? 0).toFixed(0)}%). Buen empuje de demanda.`, color: () => POS },
  { cond: e => e.hayComp && (e.dT ?? 0) >= 5, txt: e => `Ticket medio +${(e.dT ?? 0).toFixed(1)}% vs ${e.labelComp}. Suben los carritos.`, color: () => POS },
  { cond: e => e.hayComp && (e.dT ?? 0) <= -5, txt: e => `Ticket medio ${(e.dT ?? 0).toFixed(1)}% vs ${e.labelComp}. Trabajar upselling.`, color: () => NEG },
  { cond: e => e.obj > 0 && e.pctObj < 50 && e.diasRest > 0, txt: e => `Vas al ${e.pctObj.toFixed(0)}% del objetivo, quedan ${e.diasRest} día${e.diasRest === 1 ? '' : 's'}: hay que apretar.`, color: () => NEG },
  { cond: e => e.obj > 0 && e.pctObj >= 50 && e.pctObj < 90 && e.diasRest > 0, txt: e => `Al ${e.pctObj.toFixed(0)}% del objetivo, faltan ${nf0(e.falta)} en ${e.diasRest} día${e.diasRest === 1 ? '' : 's'}.`, color: () => WARN },
  { cond: e => e.obj > 0 && e.diasRest === 0 && e.pctObj < 100 && e.pctObj >= 80, txt: e => `Periodo cerrado al ${e.pctObj.toFixed(0)}% del objetivo. Cerca pero no.`, color: () => WARN },
  { cond: e => e.obj > 0 && e.diasRest === 0 && e.pctObj < 80, txt: e => `Periodo cerrado al ${e.pctObj.toFixed(0)}% del objetivo. Por debajo de lo previsto.`, color: () => NEG },
  { cond: e => !e.hayComp, txt: e => `Llevas ${nf0(e.total)} este periodo. Sin histórico de ${e.labelComp} para comparar.`, color: () => NEU },
  { cond: () => true, txt: e => `Periodo en marcha: ${nf0(e.total)} acumulado.`, color: () => NEU },
]

export default function TabEvolucion({ rowsAll, canalesFiltro }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>(() => (localStorage.getItem('evo_periodo') as Periodo) || 'semana')
  const [comp, setComp] = useState<Comp>(() => (localStorage.getItem('evo_comp') as Comp) || 'prev')
  const setPeriodoP = useCallback((p: Periodo) => { setPeriodo(p); localStorage.setItem('evo_periodo', p); if (p !== 'semana' && comp === 'prev') { setComp('mes'); localStorage.setItem('evo_comp', 'mes') } }, [comp])
  const setCompP = useCallback((c: Comp) => { setComp(c); localStorage.setItem('evo_comp', c) }, [])

  const [objDia, setObjDia] = useState<Record<number, number>>({})
  const [objBase, setObjBase] = useState(0)
  const [configCanales, setConfigCanales] = useState<Record<string, CanalConfig>>({})
  const [marcasPorCanal, setMarcasPorCanal] = useState<MarcasPorCanal>({ uber: 1, glovo: 1, je: 1, web: 1, dir: 1 })

  useEffect(() => {
    loadConfigCanales().then(setConfigCanales); loadMarcasPorCanal().then(setMarcasPorCanal)
    const on = () => { recargarConfigCanales().then(setConfigCanales); loadMarcasPorCanal().then(setMarcasPorCanal) }
    window.addEventListener('config_canales:changed', on)
    return () => window.removeEventListener('config_canales:changed', on)
  }, [])
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

  const agg = useMemo(() => {
    const m = new Map<string, Agg>()
    for (const r of rowsAll) {
      const a = m.get(r.fecha) ?? ZERO()
      a.bruto += r.total_bruto || 0; a.ped += r.total_pedidos || 0
      for (const c of CANALES) { a[c.bk] += (r[c.bk as keyof RowFacturacion] as number) || 0; a[c.pk] += (r[c.pk as keyof RowFacturacion] as number) || 0 }
      m.set(r.fecha, a)
    }
    return m
  }, [rowsAll])

  const filtra = canalesFiltro.length > 0
  const brutoDia = useCallback((f: string): number | null => {
    const a = agg.get(f); if (!a) return null
    if (!filtra) return a.bruto
    return canalesFiltro.reduce((s, id) => { const c = CANALES.find(x => x.id === id); return s + (c ? a[c.bk] : 0) }, 0)
  }, [agg, filtra, canalesFiltro])
  const pedDia = useCallback((f: string): number | null => {
    const a = agg.get(f); if (!a) return null
    if (!filtra) return a.ped
    return canalesFiltro.reduce((s, id) => { const c = CANALES.find(x => x.id === id); return s + (c ? a[c.pk] : 0) }, 0)
  }, [agg, filtra, canalesFiltro])
  const rango = useCallback((ini: Date, fin: Date) => {
    let v = 0, ped = 0, hay = false
    for (let d = new Date(ini); d <= fin; d = addDays(d, 1)) { const f = toLocal(d); const b = brutoDia(f); if (b != null) { hay = true; v += b; ped += pedDia(f) || 0 } }
    return { v, ped, hay }
  }, [brutoDia, pedDia])

  const hoy = new Date(); const hoyStr = toLocal(hoy)
  const lunes = useMemo(() => mondayOf(hoy), [hoyStr])
  const domingo = useMemo(() => addDays(lunes, 6), [lunes])
  const labelComp = comp === 'prev' ? (periodo === 'semana' ? 'la semana anterior' : 'el periodo anterior') : comp === 'mes' ? 'el mes anterior' : 'el año anterior'

  const seg = useMemo(() => {
    if (periodo === 'semana') {
      return DIAS.map((nombre, i) => {
        const dia = addDays(lunes, i); const f = toLocal(dia)
        const real = brutoDia(f); const ped = pedDia(f)
        const hf = toLocal(shiftD(dia, comp)); const hist = brutoDia(hf); const hp = pedDia(hf)
        const obj = objDia[i + 1] || objBase || 0
        const tm = ped && real != null && ped > 0 ? real / ped : null
        const tmH = hp && hist != null && hp > 0 ? hist / hp : null
        return { nombre, real, hist, obj, futuro: f > hoyStr, ped, color: DIAS_COLOR[i], esActual: f === hoyStr, dV: real != null && hist != null && hist > 0 ? ((real - hist) / hist) * 100 : null, tm, dTM: tm != null && tmH != null && tmH > 0 ? ((tm - tmH) / tmH) * 100 : null }
      })
    }
    if (periodo === 'mes') {
      const y = hoy.getFullYear(), m = hoy.getMonth(), dim = new Date(y, m + 1, 0).getDate(), nS = Math.ceil(dim / 7)
      return Array.from({ length: nS }, (_, k) => {
        const cur = rango(new Date(y, m, k * 7 + 1), new Date(y, m, Math.min((k + 1) * 7, dim)))
        const cm = comp === 'anio' ? 12 : 1, dimC = new Date(y, m - cm + 1, 0).getDate()
        const cc = rango(new Date(y, m - cm, k * 7 + 1), new Date(y, m - cm, Math.min((k + 1) * 7, dimC)))
        const tm = cur.ped > 0 ? cur.v / cur.ped : null, tmH = cc.ped > 0 ? cc.v / cc.ped : null
        return { nombre: `S${k + 1}`, real: cur.hay ? cur.v : null, hist: cc.hay ? cc.v : null, obj: 0, futuro: new Date(y, m, k * 7 + 1) > hoy, ped: cur.hay ? cur.ped : null, color: COLOR.uber, esActual: wom(hoy) === k + 1, dV: cur.hay && cc.hay && cc.v > 0 ? ((cur.v - cc.v) / cc.v) * 100 : null, tm, dTM: tm != null && tmH != null && tmH > 0 ? ((tm - tmH) / tmH) * 100 : null }
      })
    }
    const y = hoy.getFullYear()
    return Array.from({ length: hoy.getMonth() + 1 }, (_, k) => {
      const cur = rango(new Date(y, k, 1), new Date(y, k + 1, 0)), cc = rango(new Date(y - 1, k, 1), new Date(y - 1, k + 1, 0))
      const tm = cur.ped > 0 ? cur.v / cur.ped : null, tmH = cc.ped > 0 ? cc.v / cc.ped : null
      return { nombre: MESES[k], real: cur.hay ? cur.v : null, hist: cc.hay ? cc.v : null, obj: 0, futuro: false, ped: cur.hay ? cur.ped : null, color: COLOR.uber, esActual: hoy.getMonth() === k, dV: cur.hay && cc.hay && cc.v > 0 ? ((cur.v - cc.v) / cc.v) * 100 : null, tm, dTM: tm != null && tmH != null && tmH > 0 ? ((tm - tmH) / tmH) * 100 : null }
    })
  }, [periodo, comp, lunes, brutoDia, pedDia, rango, objDia, objBase, hoyStr])

  const total = useMemo(() => seg.reduce((a, s) => a + (s.real || 0), 0), [seg])
  const objTotal = useMemo(() => seg.reduce((a, s) => a + (s.obj || 0), 0), [seg])
  const histTotal = useMemo(() => { const h = seg.filter(s => s.hist != null); return h.length ? h.reduce((a, s) => a + (s.hist || 0), 0) : null }, [seg])
  const pctObj = objTotal > 0 ? (total / objTotal) * 100 : 0
  const deltaTotal = histTotal != null && histTotal > 0 ? ((total - histTotal) / histTotal) * 100 : null

  const pIni = periodo === 'semana' ? lunes : periodo === 'mes' ? new Date(hoy.getFullYear(), hoy.getMonth(), 1) : new Date(hoy.getFullYear(), 0, 1)
  const pFin = periodo === 'semana' ? domingo : periodo === 'mes' ? new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0) : new Date(hoy.getFullYear(), 11, 31)
  const cIni = periodo === 'semana' ? shiftD(pIni, comp) : comp === 'anio' ? new Date(pIni.getFullYear() - 1, pIni.getMonth(), 1) : new Date(pIni.getFullYear(), pIni.getMonth() - 1, 1)
  const cFin = periodo === 'semana' ? shiftD(pFin, comp) : comp === 'anio' ? new Date(pFin.getFullYear() - 1, pFin.getMonth(), pFin.getDate()) : new Date(pIni.getFullYear(), pIni.getMonth(), 0)
  const cur = useMemo(() => rango(pIni, pFin), [rango, pIni, pFin])
  const cmp = useMemo(() => rango(cIni, cFin), [rango, cIni, cFin])
  const pedidos = cur.ped, tm = pedidos > 0 ? cur.v / pedidos : 0, tmC = cmp.ped > 0 ? cmp.v / cmp.ped : 0
  const dPed = cmp.hay && cmp.ped > 0 ? ((pedidos - cmp.ped) / cmp.ped) * 100 : null
  const dTM = cmp.hay && tmC > 0 ? ((tm - tmC) / tmC) * 100 : null

  const diasTrans = seg.filter(s => !s.futuro).length || 1
  const diasTot = periodo === 'semana' ? 7 : Math.round((pFin.getTime() - pIni.getTime()) / 86400000) + 1
  const diasRest = periodo === 'semana' ? seg.filter(s => s.futuro || s.esActual).length : Math.max(diasTot - diasTrans, 0)
  const proy = total / Math.max(diasTrans, 1) * diasTot

  const frase = useMemo(() => {
    const e: Esc = { pctObj, dV: deltaTotal, dP: dPed, dT: dTM, diasRest, falta: Math.max(objTotal - total, 0), hayComp: cmp.hay, total, proy, obj: objTotal, labelComp }
    const def = BATERIA.find(f => { try { return f.cond(e) } catch { return false } }) || BATERIA[BATERIA.length - 1]
    return { txt: def.txt(e), color: def.color() }
  }, [pctObj, deltaTotal, dPed, dTM, diasRest, objTotal, total, cmp.hay, proy, labelComp])

  // canal con neto/margen + delta vs comparado
  const diasConDatos = useMemo(() => { let n = 0; for (let d = new Date(pIni); d <= pFin; d = addDays(d, 1)) if ((agg.get(toLocal(d))?.bruto ?? 0) > 0) n++; return n }, [agg, pIni, pFin])
  const canal = useMemo(() => {
    const vis = filtra ? CANALES.filter(c => canalesFiltro.includes(c.id)) : CANALES
    return vis.map(c => {
      let b = 0, p = 0, bc = 0, hayC = false
      for (let d = new Date(pIni); d <= pFin; d = addDays(d, 1)) { const a = agg.get(toLocal(d)); if (a) { b += a[c.bk]; p += a[c.pk] } }
      for (let d = new Date(cIni); d <= cFin; d = addDays(d, 1)) { const a = agg.get(toLocal(d)); if (a) { hayC = true; bc += a[c.bk] } }
      const { neto, margenPct } = calcNetoPorCanal(c.id, b, p, { modo: 'agregado_canal', marcasPorCanal, fechaDesde: pIni, fechaHasta: pFin, configCanales, diasConDatos })
      return { ...c, b, neto, margen: margenPct, delta: hayC && bc > 0 ? ((b - bc) / bc) * 100 : null }
    })
  }, [agg, filtra, canalesFiltro, pIni, pFin, cIni, cFin, marcasPorCanal, configCanales, diasConDatos])

  const cal = useMemo(() => {
    const wd = (hoy.getDay() + 6) % 7, nth = nthWd(hoy), w = wom(hoy)
    const valHoy = brutoDia(hoyStr)
    const nthEn = (aM: number, aA: number): number | null => {
      const t = new Date(hoy.getFullYear() - aA, hoy.getMonth() - aM, 1); const fw = (t.getDay() + 6) % 7
      const day = 1 + ((wd - fw + 7) % 7) + (nth - 1) * 7; const dim = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()
      if (day > dim) return null
      return brutoDia(toLocal(new Date(t.getFullYear(), t.getMonth(), day)))
    }
    const semEn = (aM: number, aA: number): number | null => {
      const t = new Date(hoy.getFullYear() - aA, hoy.getMonth() - aM, 1); const dim = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()
      if ((w - 1) * 7 + 1 > dim) return null
      const r = rango(new Date(t.getFullYear(), t.getMonth(), (w - 1) * 7 + 1), new Date(t.getFullYear(), t.getMonth(), Math.min(w * 7, dim))); return r.hay ? r.v : null
    }
    const semAct = (() => { const r = rango(new Date(hoy.getFullYear(), hoy.getMonth(), (w - 1) * 7 + 1), new Date(hoy.getFullYear(), hoy.getMonth(), w * 7)); return r.hay ? r.v : null })()
    return { diaLabel: `${nth}º ${DIAS_L[wd]} del mes`, valHoy, diaMes: nthEn(1, 0), diaAno: nthEn(0, 1), semLabel: `${w}ª semana del mes`, semAct, semMes: semEn(1, 0), semAno: semEn(0, 1) }
  }, [hoyStr, brutoDia, rango])

  const cTabs: { id: string; label: string }[] = periodo === 'semana'
    ? [{ id: 'prev', label: 'vs sem. ant.' }, { id: 'mes', label: 'vs mes ant.' }, { id: 'anio', label: 'vs año ant.' }]
    : [{ id: 'mes', label: 'vs mes ant.' }, { id: 'anio', label: 'vs año ant.' }]
  const pTabs: { id: Periodo; label: string }[] = [{ id: 'semana', label: 'Semana' }, { id: 'mes', label: 'Mes' }, { id: 'anio', label: 'Año' }]

  const card: CSSProperties = { background: '#fff', border: `0.5px solid ${BORDE}`, borderRadius: 16, padding: '18px 20px' }
  const lblS: CSSProperties = { fontFamily: OSWALD, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: COLOR.textMut }
  const BAR_H = 150, SOBRE_H = 34
  const fill = (p: number) => p >= 50 ? VERDE : AMARILLO
  const maxSeg = Math.max(...seg.map(s => s.real || 0), 1)

  return (
    <div style={{ fontFamily: LEXEND, color: COLOR.textPri, paddingTop: 18 }}>

      {/* TITULAR + PILLS (idéntico Facturación) */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 16, flexWrap: 'wrap' }}>
          <TabsPastilla tabs={cTabs} activeId={comp} onChange={id => setCompP(id as Comp)} />
          <div style={{ width: 1, height: 24, background: COLORS.brd, flexShrink: 0, marginLeft: 2, marginRight: 2 }} />
          <div style={SUBTAB_CONTAINER}>
            {pTabs.map(t => <button key={t.id} onClick={() => setPeriodoP(t.id)} style={periodo === t.id ? SUBTAB_ACTIVE : SUBTAB_INACTIVE}>{t.label}</button>)}
          </div>
        </div>
        <div style={{ fontFamily: OSWALD, fontSize: 'clamp(28px,4.2vw,44px)', fontWeight: 600, lineHeight: 1.04 }}>
          {deltaTotal == null ? 'PERIODO EN MARCHA' : 'EL NEGOCIO VA'}{' '}
          {deltaTotal != null && <span style={{ color: colorDelta(deltaTotal), background: `${colorDelta(deltaTotal)}1f`, padding: '0 10px', borderRadius: 8 }}>{deltaTotal >= 0 ? '+' : ''}{deltaTotal.toFixed(1)}%</span>}
          {deltaTotal != null && <span> VS {labelComp.toUpperCase()}.</span>}
        </div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontFamily: OSWALD, fontSize: 'clamp(17px,2vw,21px)', fontWeight: 500, color: COLOR.textPri, letterSpacing: '0.3px' }}>
            {nf2(total)} · {nf0(pedidos)} pedidos · ticket medio {nf2(tm)}
          </div>
          <div style={{ fontFamily: OSWALD, fontSize: 'clamp(15px,1.8vw,18px)', fontWeight: 500, color: frase.color, letterSpacing: '0.3px' }}>{frase.txt}</div>
        </div>
      </div>

      {/* BARRAS (2/3) + CALENDARIO (1/3) */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <span style={{ fontFamily: OSWALD, fontSize: 32, fontWeight: 600, color: objTotal > 0 ? (pctObj >= 50 ? VERDE : AMARILLO) : COLOR.textPri }}>{nf2(total)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: periodo === 'anio' ? 6 : 12, paddingTop: SOBRE_H }}>
            {seg.map((s, i) => {
              const sinObj = s.obj === 0
              const p = !sinObj && s.real != null ? (s.real / s.obj) * 100 : 0
              const rell = sinObj ? (s.real != null ? Math.min((s.real / maxSeg) * 100, 100) : 0) : Math.min(p, 100)
              const supera = !sinObj && s.real != null && s.real > s.obj
              const colF = sinObj ? (s.dV == null ? COLOR.textMut : s.dV >= 0 ? VERDE : ROJO) : fill(p)
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontFamily: OSWALD, fontSize: periodo === 'anio' ? 9 : 11, fontWeight: 600, color: s.futuro ? COLOR.textMut : s.real != null ? COLOR.textPri : COLOR.textMut, marginBottom: 3, height: 14 }}>{s.real != null ? nf0(s.real) : '—'}</span>
                  <div style={{ width: '56%', height: BAR_H, position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    {supera && <div style={{ position: 'absolute', bottom: BAR_H, left: 0, right: 0, height: SOBRE_H - 12, background: VERDE_SOBRE, borderRadius: '4px 4px 0 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}><span style={{ color: '#fff', fontSize: 12 }}>⋯</span></div>}
                    <div style={{ width: '100%', height: '100%', background: s.futuro ? TRACK : ROJO, borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', opacity: s.futuro ? 0.4 : 1 }}>
                      {!s.futuro && rell > 0 && <div style={{ width: '100%', height: `${rell}%`, background: colF, borderRadius: rell >= 99 ? 6 : '0 0 6px 6px' }} />}
                    </div>
                  </div>
                  {s.dV != null && <span style={{ fontSize: 9, color: colorDelta(s.dV), marginTop: 4 }}>{s.dV >= 0 ? '▲' : '▼'}{Math.abs(s.dV).toFixed(0)}%</span>}
                  <span style={{ fontFamily: LEXEND, fontSize: periodo === 'anio' ? 10 : 12, color: s.esActual ? COLOR.textPri : COLOR.textMut, fontWeight: s.esActual ? 700 : 400, marginTop: 4 }}>{s.nombre}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div style={card}>
          <div style={{ ...lblS, marginBottom: 14 }}>Posición en el calendario</div>
          {[
            { tit: cal.diaLabel, base: cal.valHoy, c: [{ l: 'mes ant.', v: cal.diaMes }, { l: 'año ant.', v: cal.diaAno }] },
            { tit: cal.semLabel, base: cal.semAct, c: [{ l: 'mes ant.', v: cal.semMes }, { l: 'año ant.', v: cal.semAno }] },
          ].map((b, bi) => (
            <div key={bi} style={{ marginBottom: bi === 0 ? 18 : 0 }}>
              <div style={{ fontFamily: OSWALD, fontSize: 12, letterSpacing: '0.5px', textTransform: 'uppercase', color: COLOR.textSec, marginBottom: 6 }}>{b.tit}</div>
              <div style={{ fontFamily: OSWALD, fontSize: 26, fontWeight: 600, color: b.base == null ? COLOR.textMut : COLOR.textPri }}>{b.base != null ? nf0(b.base) : '—'}</div>
              <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
                {b.c.map((c, ci) => {
                  const d = b.base != null && c.v != null && c.v > 0 ? ((b.base - c.v) / c.v) * 100 : null
                  return (
                    <div key={ci} style={{ fontFamily: LEXEND, fontSize: 12 }}>
                      <span style={{ color: COLOR.textMut }}>{c.l}: </span>
                      <span style={{ color: c.v == null ? COLOR.textMut : COLOR.textSec }}>{c.v != null ? nf0(c.v) : 'sin dato'}</span>
                      {d != null && <span style={{ color: colorDelta(d), marginLeft: 4 }}>{d >= 0 ? '▲' : '▼'}{Math.abs(d).toFixed(0)}%</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CANAL (cards color + delta) + TICKET/PEDIDOS POR DÍA */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
        <div style={card}>
          <div style={{ ...lblS, marginBottom: 12 }}>Facturación por canal · vs {labelComp}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {canal.filter(c => !c.mini).map(c => (
              <div key={c.id} style={{ background: c.bg, border: `0.5px solid ${c.brd}`, borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ ...lblXs, color: c.lab }}>{c.label}</div>
                  <div style={{ fontFamily: OSWALD, fontSize: 24, fontWeight: 600, color: '#111', marginTop: 2 }}>{nf2(c.b)}</div>
                  <div style={{ fontSize: 11, color: colorDelta(c.delta), fontFamily: LEXEND }}>{c.delta == null ? 'sin comparativa' : `${c.delta >= 0 ? '▲ +' : '▼ '}${Math.abs(c.delta).toFixed(1)}% vs ${labelComp}`}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: OSWALD, fontSize: 24, fontWeight: 600, color: VERDE }}>{nf2(c.neto)}</div>
                  <div style={{ fontSize: 13, color: VERDE, fontFamily: LEXEND }}>Margen {c.margen.toFixed(1)}%</div>
                </div>
              </div>
            ))}
            {canal.some(c => c.mini) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {canal.filter(c => c.mini).map(c => (
                  <div key={c.id} style={{ background: c.bg, border: `0.5px solid ${c.brd}`, borderRadius: 14, padding: '10px 12px' }}>
                    <div style={{ ...lblXs, color: c.lab }}>{c.label}</div>
                    <div style={{ fontFamily: OSWALD, fontSize: 15, fontWeight: 600, color: '#111', marginTop: 2 }}>{nf2(c.b)}</div>
                    <div style={{ fontSize: 10, color: colorDelta(c.delta), fontFamily: LEXEND }}>{c.delta == null ? '—' : `${c.delta >= 0 ? '▲+' : '▼'}${Math.abs(c.delta).toFixed(0)}% vs ${labelComp}`}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={card}>
          <div style={{ ...lblS, marginBottom: 4 }}>Ticket medio por día · vs {labelComp}</div>
          <div style={{ fontFamily: LEXEND, fontSize: 12, color: COLOR.textMut, marginBottom: 14 }}>Pedidos {nf0(pedidos)} ({dPed != null ? `${dPed >= 0 ? '+' : ''}${dPed.toFixed(0)}%` : '—'}) · TM {nf2(tm)} ({dTM != null ? `${dTM >= 0 ? '+' : ''}${dTM.toFixed(0)}%` : '—'})</div>
          {seg.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
              <span style={{ minWidth: 36, fontFamily: LEXEND, fontSize: 12, color: s.esActual ? COLOR.textPri : COLOR.textSec, fontWeight: s.esActual ? 700 : 400 }}>{s.nombre}</span>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontFamily: OSWALD, fontSize: 14, fontWeight: 600, color: s.tm != null ? COLOR.textPri : COLOR.textMut }}>{s.tm != null ? nf2(s.tm) : '—'}</span>
              <span style={{ minWidth: 54, textAlign: 'right', fontFamily: LEXEND, fontSize: 11, color: COLOR.textMut }}>{s.ped != null ? `${nf0(s.ped)} ped` : ''}</span>
              <span style={{ minWidth: 48, textAlign: 'right', fontFamily: LEXEND, fontSize: 12, color: colorDelta(s.dTM) }}>{s.dTM == null ? '—' : `${s.dTM >= 0 ? '▲' : '▼'}${Math.abs(s.dTM).toFixed(0)}%`}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
