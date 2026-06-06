/**
 * Tab Evolución — Panel Global · v12
 */
import { useEffect, useMemo, useState, useCallback, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import TabsPastilla from '@/components/ui/TabsPastilla'
import { COLOR, COLORS, FONT, LEXEND, OSWALD } from '../resumen/tokens'
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
const TRACK = '#ebe8e2'
const BORDE = '#d0c8bc'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DIAS_L = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const DIAS_COLOR = [COLOR.diaLun, COLOR.diaMar, COLOR.diaMie, COLOR.diaJue, COLOR.diaVie, COLOR.diaSab, COLOR.diaDom]

const nf0 = (n: number) => Math.round(n).toLocaleString('es-ES', { useGrouping: true })
const nf2 = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })

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
  { id: 'uber', label: 'Uber Eats', color: COLOR.uber, bk: 'uber_bruto', pk: 'uber_pedidos' },
  { id: 'glovo', label: 'Glovo', color: '#c9a900', bk: 'glovo_bruto', pk: 'glovo_pedidos' },
  { id: 'je', label: 'Just Eat', color: COLOR.je, bk: 'je_bruto', pk: 'je_pedidos' },
  { id: 'web', label: 'Web', color: COLOR.webSL, bk: 'web_bruto', pk: 'web_pedidos' },
  { id: 'dir', label: 'Directa', color: COLOR.directa, bk: 'directa_bruto', pk: 'directa_pedidos' },
] as const

const SUBTAB_CONTAINER: CSSProperties = { display: 'inline-flex', gap: 4, padding: '3px 4px', borderRadius: 10, background: COLORS.accent, border: `0.5px solid ${COLORS.accent}` }
const SUBTAB_ACTIVE: CSSProperties = { padding: '4px 10px', borderRadius: 6, border: 'none', background: '#ffffff', color: COLORS.pri, fontFamily: FONT.heading, fontSize: 10, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', cursor: 'pointer', outline: 'none' }
const SUBTAB_INACTIVE: CSSProperties = { padding: '4px 10px', borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.25)', color: '#ffffff', fontFamily: FONT.heading, fontSize: 10, fontWeight: 500, letterSpacing: '1.2px', textTransform: 'uppercase', cursor: 'pointer', outline: 'none' }

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
  const [canalSel, setCanalSel] = useState<string>('uber')
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

  const hoyStr = toLocal(new Date())
  const lunes = useMemo(() => mondayOf(new Date(hoyStr + 'T12:00:00')), [hoyStr])
  const domingo = useMemo(() => addDays(lunes, 6), [lunes])
  const ref = useMemo(() => new Date(hoyStr + 'T12:00:00'), [hoyStr])
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
      const y = ref.getFullYear(), m = ref.getMonth(), dim = new Date(y, m + 1, 0).getDate(), nS = Math.ceil(dim / 7)
      return Array.from({ length: nS }, (_, k) => {
        const cur = rango(new Date(y, m, k * 7 + 1), new Date(y, m, Math.min((k + 1) * 7, dim)))
        const cm = comp === 'anio' ? 12 : 1, dimC = new Date(y, m - cm + 1, 0).getDate()
        const cc = rango(new Date(y, m - cm, k * 7 + 1), new Date(y, m - cm, Math.min((k + 1) * 7, dimC)))
        const tm = cur.ped > 0 ? cur.v / cur.ped : null, tmH = cc.ped > 0 ? cc.v / cc.ped : null
        return { nombre: `S${k + 1}`, real: cur.hay ? cur.v : null, hist: cc.hay ? cc.v : null, obj: 0, futuro: new Date(y, m, k * 7 + 1) > ref, ped: cur.hay ? cur.ped : null, color: COLOR.uber, esActual: wom(ref) === k + 1, dV: cur.hay && cc.hay && cc.v > 0 ? ((cur.v - cc.v) / cc.v) * 100 : null, tm, dTM: tm != null && tmH != null && tmH > 0 ? ((tm - tmH) / tmH) * 100 : null }
      })
    }
    const y = ref.getFullYear()
    return Array.from({ length: ref.getMonth() + 1 }, (_, k) => {
      const cur = rango(new Date(y, k, 1), new Date(y, k + 1, 0)), cc = rango(new Date(y - 1, k, 1), new Date(y - 1, k + 1, 0))
      const tm = cur.ped > 0 ? cur.v / cur.ped : null, tmH = cc.ped > 0 ? cc.v / cc.ped : null
      return { nombre: MESES[k], real: cur.hay ? cur.v : null, hist: cc.hay ? cc.v : null, obj: 0, futuro: false, ped: cur.hay ? cur.ped : null, color: COLOR.uber, esActual: ref.getMonth() === k, dV: cur.hay && cc.hay && cc.v > 0 ? ((cur.v - cc.v) / cc.v) * 100 : null, tm, dTM: tm != null && tmH != null && tmH > 0 ? ((tm - tmH) / tmH) * 100 : null }
    })
  }, [periodo, comp, lunes, ref, brutoDia, pedDia, rango, objDia, objBase, hoyStr])

  const total = useMemo(() => seg.reduce((a, s) => a + (s.real || 0), 0), [seg])
  const objTotal = useMemo(() => seg.reduce((a, s) => a + (s.obj || 0), 0), [seg])
  const histTotal = useMemo(() => { const h = seg.filter(s => s.hist != null); return h.length ? h.reduce((a, s) => a + (s.hist || 0), 0) : null }, [seg])
  const pctObj = objTotal > 0 ? (total / objTotal) * 100 : 0
  const deltaTotal = histTotal != null && histTotal > 0 ? ((total - histTotal) / histTotal) * 100 : null

  const { pIni, pFin, cIni, cFin } = useMemo(() => {
    const pi = periodo === 'semana' ? lunes : periodo === 'mes' ? new Date(ref.getFullYear(), ref.getMonth(), 1) : new Date(ref.getFullYear(), 0, 1)
    const pf = periodo === 'semana' ? domingo : periodo === 'mes' ? new Date(ref.getFullYear(), ref.getMonth() + 1, 0) : new Date(ref.getFullYear(), 11, 31)
    const ci = periodo === 'semana' ? shiftD(pi, comp) : comp === 'anio' ? new Date(pi.getFullYear() - 1, pi.getMonth(), 1) : new Date(pi.getFullYear(), pi.getMonth() - 1, 1)
    const cf = periodo === 'semana' ? shiftD(pf, comp) : comp === 'anio' ? new Date(pf.getFullYear() - 1, pf.getMonth(), pf.getDate()) : new Date(pi.getFullYear(), pi.getMonth(), 0)
    return { pIni: pi, pFin: pf, cIni: ci, cFin: cf }
  }, [periodo, comp, lunes, domingo, ref])

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

  // Detalle por canal y día (base Días Pico) — desglose del canal seleccionado por día del periodo
  const canalDia = useMemo(() => {
    const c = CANALES.find(x => x.id === canalSel)!
    let bTot = 0, pTot = 0, bTotC = 0, hayC = false
    const items = seg.map((s, i) => {
      let bruto: number | null = null, ped = 0, brutoC: number | null = null
      if (periodo === 'semana') {
        const f = toLocal(addDays(lunes, i)); const a = agg.get(f)
        if (a) { bruto = a[c.bk]; ped = a[c.pk] }
        const fc = toLocal(shiftD(addDays(lunes, i), comp)); const ac = agg.get(fc)
        if (ac) brutoC = ac[c.bk]
      } else {
        // mes/año: sumar canal por segmento
        let ini: Date, fin: Date, iniC: Date, finC: Date
        if (periodo === 'mes') {
          const y = ref.getFullYear(), m = ref.getMonth(), dim = new Date(y, m + 1, 0).getDate()
          ini = new Date(y, m, i * 7 + 1); fin = new Date(y, m, Math.min((i + 1) * 7, dim))
          const cm = comp === 'anio' ? 12 : 1, dimC = new Date(y, m - cm + 1, 0).getDate()
          iniC = new Date(y, m - cm, i * 7 + 1); finC = new Date(y, m - cm, Math.min((i + 1) * 7, dimC))
        } else {
          const y = ref.getFullYear()
          ini = new Date(y, i, 1); fin = new Date(y, i + 1, 0); iniC = new Date(y - 1, i, 1); finC = new Date(y - 1, i + 1, 0)
        }
        let bb = 0, pp = 0, hay = false, bbc = 0, hayc = false
        for (let d = new Date(ini); d <= fin; d = addDays(d, 1)) { const a = agg.get(toLocal(d)); if (a) { hay = true; bb += a[c.bk]; pp += a[c.pk] } }
        for (let d = new Date(iniC); d <= finC; d = addDays(d, 1)) { const a = agg.get(toLocal(d)); if (a) { hayc = true; bbc += a[c.bk] } }
        if (hay) { bruto = bb; ped = pp }
        if (hayc) brutoC = bbc
      }
      if (bruto != null) { bTot += bruto; pTot += ped }
      if (brutoC != null) { hayC = true; bTotC += brutoC }
      const tmDia = bruto != null && ped > 0 ? bruto / ped : null
      const delta = bruto != null && brutoC != null && brutoC > 0 ? ((bruto - brutoC) / brutoC) * 100 : null
      return { nombre: s.nombre, color: s.color, esActual: s.esActual, futuro: s.futuro, bruto, ped, tm: tmDia, delta }
    })
    const max = Math.max(...items.map(x => x.bruto || 0), 1)
    const deltaTot = hayC && bTotC > 0 ? ((bTot - bTotC) / bTotC) * 100 : null
    return { canal: c, items, max, bTot, pTot, tmTot: pTot > 0 ? bTot / pTot : 0, deltaTot }
  }, [canalSel, seg, periodo, comp, lunes, ref, agg])

  const diasConDatos = useMemo(() => { let n = 0; for (let d = new Date(pIni); d <= pFin; d = addDays(d, 1)) if ((agg.get(toLocal(d))?.bruto ?? 0) > 0) n++; return n }, [agg, pIni, pFin])
  const canalSelNeto = useMemo(() => {
    const c = canalDia.canal
    const { neto, margenPct } = calcNetoPorCanal(c.id, canalDia.bTot, canalDia.pTot, { modo: 'agregado_canal', marcasPorCanal, fechaDesde: pIni, fechaHasta: pFin, configCanales, diasConDatos })
    return { neto, margen: margenPct }
  }, [canalDia, marcasPorCanal, pIni, pFin, configCanales, diasConDatos])

  const cal = useMemo(() => {
    const wd = (ref.getDay() + 6) % 7, nth = nthWd(ref), w = wom(ref)
    const valHoy = brutoDia(hoyStr)
    const nthEn = (aM: number, aA: number): number | null => {
      const t = new Date(ref.getFullYear() - aA, ref.getMonth() - aM, 1); const fw = (t.getDay() + 6) % 7
      const day = 1 + ((wd - fw + 7) % 7) + (nth - 1) * 7; const dim = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()
      if (day > dim) return null
      return brutoDia(toLocal(new Date(t.getFullYear(), t.getMonth(), day)))
    }
    const semEn = (aM: number, aA: number): number | null => {
      const t = new Date(ref.getFullYear() - aA, ref.getMonth() - aM, 1); const dim = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()
      if ((w - 1) * 7 + 1 > dim) return null
      const r = rango(new Date(t.getFullYear(), t.getMonth(), (w - 1) * 7 + 1), new Date(t.getFullYear(), t.getMonth(), Math.min(w * 7, dim))); return r.hay ? r.v : null
    }
    const semAct = (() => { const r = rango(new Date(ref.getFullYear(), ref.getMonth(), (w - 1) * 7 + 1), new Date(ref.getFullYear(), ref.getMonth(), w * 7)); return r.hay ? r.v : null })()
    return { diaLabel: `${nth}º ${DIAS_L[wd]} del mes`, valHoy, diaMes: nthEn(1, 0), diaAno: nthEn(0, 1), semLabel: `${w}ª semana del mes`, semAct, semMes: semEn(1, 0), semAno: semEn(0, 1) }
  }, [ref, hoyStr, brutoDia, rango])

  const cTabs = periodo === 'semana'
    ? [{ id: 'prev', label: 'vs sem. ant.' }, { id: 'mes', label: 'vs mes ant.' }, { id: 'anio', label: 'vs año ant.' }]
    : [{ id: 'mes', label: 'vs mes ant.' }, { id: 'anio', label: 'vs año ant.' }]
  const pTabs: { id: Periodo; label: string }[] = [{ id: 'semana', label: 'Semana' }, { id: 'mes', label: 'Mes' }, { id: 'anio', label: 'Año' }]

  const card: CSSProperties = { background: '#fff', border: `0.5px solid ${BORDE}`, borderRadius: 16, padding: '18px 20px' }
  const lblS: CSSProperties = { fontFamily: OSWALD, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: COLOR.textMut }
  const BAR_H = 150, SOBRE = 26
  const fill = (p: number) => p >= 50 ? VERDE : AMARILLO

  return (
    <div style={{ fontFamily: LEXEND, color: COLOR.textPri, paddingTop: 18 }}>

      {/* TITULAR + PILLS */}
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
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: periodo === 'anio' ? 6 : 12, paddingTop: SOBRE + 10 }}>
            {seg.map((s, i) => {
              const sinObj = s.obj === 0
              const p = !sinObj && s.real != null ? (s.real / s.obj) * 100 : 0
              const rell = sinObj ? (s.real != null ? Math.min((s.real / Math.max(...seg.map(x => x.real || 0), 1)) * 100, 100) : 0) : Math.min(p, 100)
              const supera = !sinObj && s.real != null && s.real >= s.obj && s.obj > 0
              const colF = sinObj ? (s.dV == null ? COLOR.textMut : s.dV >= 0 ? VERDE : ROJO) : fill(p)
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontFamily: OSWALD, fontSize: periodo === 'anio' ? 9 : 11, fontWeight: 600, color: s.futuro ? COLOR.textMut : s.real != null ? COLOR.textPri : COLOR.textMut, marginBottom: 3, height: 14 }}>{s.real != null ? nf0(s.real) : '—'}</span>
                  {/* contenedor SIEMPRE mismo tamaño */}
                  <div style={{ position: 'relative', width: '60%', height: BAR_H }}>
                    {supera && <div style={{ position: 'absolute', top: -SOBRE, left: -4, right: -4, bottom: -4, border: `2px dashed ${VERDE}`, borderRadius: 8, pointerEvents: 'none' }} />}
                    {supera && <span style={{ position: 'absolute', top: -SOBRE + 2, left: 0, right: 0, textAlign: 'center', fontSize: 13, color: VERDE, fontWeight: 700 }}>⋯</span>}
                    <div style={{ position: 'absolute', inset: 0, background: s.futuro ? TRACK : ROJO, borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', opacity: s.futuro ? 0.4 : 1 }}>
                      {!s.futuro && rell > 0 && <div style={{ width: '100%', height: `${rell}%`, background: colF }} />}
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

      {/* DETALLE POR CANAL Y DÍA (base Días Pico, comparado) */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={lblS}>Detalle por canal · {periodo === 'semana' ? 'día' : periodo === 'mes' ? 'semana' : 'mes'} · vs {labelComp}</div>
          <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
            {CANALES.filter(c => !filtra || canalesFiltro.includes(c.id)).map(c => (
              <button key={c.id} onClick={() => setCanalSel(c.id)} style={{ padding: '5px 12px', borderRadius: 999, border: canalSel === c.id ? 'none' : `0.5px solid ${BORDE}`, background: canalSel === c.id ? c.color : '#fff', color: canalSel === c.id ? '#fff' : '#3a4050', fontFamily: OSWALD, fontSize: 11, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', cursor: 'pointer' }}>{c.label}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 18 }}>
          <span style={{ fontFamily: OSWALD, fontSize: 28, fontWeight: 600, color: canalDia.canal.color }}>{nf2(canalDia.bTot)}</span>
          <span style={{ fontFamily: LEXEND, fontSize: 13, color: VERDE }}>{nf2(canalSelNeto.neto)} neto · margen {canalSelNeto.margen.toFixed(1)}%</span>
          <span style={{ fontFamily: LEXEND, fontSize: 13, color: COLOR.textMut }}>{nf0(canalDia.pTot)} pedidos · TM {nf2(canalDia.tmTot)}</span>
          {canalDia.deltaTot != null && <span style={{ fontFamily: LEXEND, fontSize: 13, color: colorDelta(canalDia.deltaTot) }}>{canalDia.deltaTot >= 0 ? '▲ +' : '▼ '}{Math.abs(canalDia.deltaTot).toFixed(1)}% vs {labelComp}</span>}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: periodo === 'anio' ? 6 : 12, height: 170 }}>
          {canalDia.items.map((it, i) => {
            const h = it.bruto != null && it.bruto > 0 ? Math.max((it.bruto / canalDia.max) * 120, 4) : 0
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                <span style={{ fontFamily: OSWALD, fontSize: periodo === 'anio' ? 9 : 11, fontWeight: 600, color: it.futuro ? COLOR.textMut : COLOR.textPri, marginBottom: 2 }}>{it.bruto != null ? nf0(it.bruto) : '—'}</span>
                {it.delta != null && <span style={{ fontSize: 9, color: colorDelta(it.delta), marginBottom: 2 }}>{it.delta >= 0 ? '▲' : '▼'}{Math.abs(it.delta).toFixed(0)}%</span>}
                <div style={{ width: '58%', height: h, background: it.futuro ? TRACK : canalDia.canal.color, borderRadius: '4px 4px 0 0', opacity: it.futuro ? 0.4 : 1 }} />
                <span style={{ fontFamily: LEXEND, fontSize: 10, color: COLOR.textMut, marginTop: 4 }}>{it.tm != null ? `${nf2(it.tm)}€` : ''}</span>
                <span style={{ fontFamily: LEXEND, fontSize: 9, color: COLOR.textMut }}>{it.ped > 0 ? `${nf0(it.ped)}p` : ''}</span>
                <span style={{ fontFamily: LEXEND, fontSize: periodo === 'anio' ? 10 : 12, color: it.esActual ? COLOR.textPri : COLOR.textMut, fontWeight: it.esActual ? 700 : 400, marginTop: 3 }}>{it.nombre}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
