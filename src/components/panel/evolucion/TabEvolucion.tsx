/**
 * Tab Evolución — Panel Global · v20
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
const AZUL_PED = '#1E5BCC'
const NARANJA_TM = '#F26B1F'
const VERDE = '#1D9E75'
const AMARILLO = '#f5a623'
const TRACK = '#ebe8e2'
const BORDE = '#d0c8bc'
const GRIS_COMP = '#9ba3af'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
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
  { cond: e => e.pctObj < 100 && e.diasRest > 0 && e.proy >= e.obj && e.obj > 0, txt: e => `Vas al ${e.pctObj.toFixed(0)}% del tramo, pero al ritmo actual cerrarías por encima del objetivo.`, color: () => POS },
  { cond: e => e.pctObj >= 90 && e.pctObj < 100 && e.diasRest > 0, txt: e => `Muy cerca: ${e.pctObj.toFixed(0)}% del objetivo del tramo, faltan ${nf0(e.falta)}.`, color: () => WARN },
  { cond: e => e.hayComp && (e.dV ?? 0) >= 10, txt: e => `Facturación +${(e.dV ?? 0).toFixed(0)}% vs ${e.labelComp} (mismo tramo). Tendencia al alza.`, color: () => POS },
  { cond: e => e.hayComp && (e.dV ?? 0) > 0 && (e.dV ?? 0) < 10, txt: e => `Ligeramente por encima de ${e.labelComp} (+${(e.dV ?? 0).toFixed(1)}%, mismo tramo).`, color: () => POS },
  { cond: e => e.hayComp && Math.abs(e.dV ?? 0) <= 1, txt: e => `En línea con ${e.labelComp} (mismo tramo). Sin cambios relevantes.`, color: () => NEU },
  { cond: e => e.hayComp && (e.dV ?? 0) <= -15, txt: e => `Atención: facturación ${(e.dV ?? 0).toFixed(0)}% vs ${e.labelComp} (mismo tramo). Hay que reaccionar.`, color: () => NEG },
  { cond: e => e.hayComp && (e.dV ?? 0) < 0, txt: e => `Por debajo de ${e.labelComp} (${(e.dV ?? 0).toFixed(1)}%, mismo tramo). Margen de mejora.`, color: () => NEG },
  { cond: e => e.hayComp && (e.dP ?? 0) <= -10, txt: e => `Caen los pedidos (${(e.dP ?? 0).toFixed(0)}% vs ${e.labelComp}). Revisar visibilidad/promos.`, color: () => NEG },
  { cond: e => e.hayComp && (e.dP ?? 0) >= 10, txt: e => `Más pedidos que ${e.labelComp} (+${(e.dP ?? 0).toFixed(0)}%). Buen empuje de demanda.`, color: () => POS },
  { cond: e => e.hayComp && (e.dT ?? 0) >= 5, txt: e => `Ticket medio +${(e.dT ?? 0).toFixed(1)}% vs ${e.labelComp}. Suben los carritos.`, color: () => POS },
  { cond: e => e.hayComp && (e.dT ?? 0) <= -5, txt: e => `Ticket medio ${(e.dT ?? 0).toFixed(1)}% vs ${e.labelComp}. Trabajar upselling.`, color: () => NEG },
  { cond: e => e.obj > 0 && e.pctObj < 50 && e.diasRest > 0, txt: e => `Vas al ${e.pctObj.toFixed(0)}% del objetivo del tramo: hay que apretar.`, color: () => NEG },
  { cond: e => e.obj > 0 && e.pctObj >= 50 && e.pctObj < 90 && e.diasRest > 0, txt: e => `Al ${e.pctObj.toFixed(0)}% del objetivo del tramo, faltan ${nf0(e.falta)}.`, color: () => WARN },
  { cond: e => e.obj > 0 && e.diasRest === 0 && e.pctObj < 100 && e.pctObj >= 80, txt: e => `Periodo cerrado al ${e.pctObj.toFixed(0)}% del objetivo. Cerca pero no.`, color: () => WARN },
  { cond: e => e.obj > 0 && e.diasRest === 0 && e.pctObj < 80, txt: e => `Periodo cerrado al ${e.pctObj.toFixed(0)}% del objetivo. Por debajo de lo previsto.`, color: () => NEG },
  { cond: e => !e.hayComp, txt: e => `Llevas ${nf0(e.total)} este periodo. Sin histórico de ${e.labelComp} para comparar.`, color: () => NEU },
  { cond: () => true, txt: e => `Periodo en marcha: ${nf0(e.total)} acumulado.`, color: () => NEU },
]

export default function TabEvolucion({ rowsAll, canalesFiltro, fechaHasta }: Props) {
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

  // Total real del día. La fila servicio='TODO' es la verdad cuando existe.
  // Cuando NO hay fila TODO (p.ej. importaciones recientes solo ALM/CENAS), el total = suma de ALM+CENAS,
  // igual que hace el módulo Facturación al construir la fila "TODOS" al vuelo. Nunca sumar TODO+ALM+CENAS.
  const agg = useMemo(() => {
    const todoFechas = new Set<string>()
    for (const r of rowsAll) if ((r as { servicio?: string }).servicio === 'TODO') todoFechas.add(r.fecha)
    const m = new Map<string, Agg>()
    for (const r of rowsAll) {
      const serv = (r as { servicio?: string }).servicio
      // Si existe fila TODO para la fecha, usar solo TODO. Si no existe, usar ALM+CENAS.
      if (todoFechas.has(r.fecha)) { if (serv !== 'TODO') continue }
      else { if (serv !== 'ALM' && serv !== 'CENAS') continue }
      const a = m.get(r.fecha) ?? ZERO()
      a.bruto += r.total_bruto || 0; a.ped += r.total_pedidos || 0
      for (const c of CANALES) { a[c.bk] += (r[c.bk as keyof RowFacturacion] as number) || 0; a[c.pk] += (r[c.pk as keyof RowFacturacion] as number) || 0 }
      m.set(r.fecha, a)
    }
    return m
  }, [rowsAll])

  // Agregado ALM / CENAS por fecha (reparto del día). 'TODO' es el total y se excluye aqui.
  const aggServ = useMemo(() => {
    const m = new Map<string, { alm: number; cenas: number; almPed: number; cenasPed: number }>()
    for (const r of rowsAll) {
      const serv = (r as { servicio?: string }).servicio
      if (serv !== 'ALM' && serv !== 'CENAS') continue
      const a = m.get(r.fecha) ?? { alm: 0, cenas: 0, almPed: 0, cenasPed: 0 }
      if (serv === 'ALM') { a.alm += r.total_bruto || 0; a.almPed += r.total_pedidos || 0 }
      else { a.cenas += r.total_bruto || 0; a.cenasPed += r.total_pedidos || 0 }
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
    let v = 0, ped = 0, hay = false, dias = 0
    for (let d = new Date(ini); d <= fin; d = addDays(d, 1)) { const f = toLocal(d); const b = brutoDia(f); if (b != null) { hay = true; v += b; ped += pedDia(f) || 0; if (b > 0) dias++ } }
    return { v, ped, hay, dias }
  }, [brutoDia, pedDia])
  const objetivoRango = useCallback((ini: Date, fin: Date) => {
    let o = 0
    for (let d = new Date(ini); d <= fin; d = addDays(d, 1)) { const dow = d.getDay() === 0 ? 7 : d.getDay(); o += objDia[dow] || objBase || 0 }
    return o
  }, [objDia, objBase])

  const hoyStr = toLocal(new Date())
  const anclaStr = fechaHasta ? toLocal(fechaHasta) : hoyStr
  const lunes = useMemo(() => mondayOf(new Date(anclaStr + 'T12:00:00')), [anclaStr])
  const domingo = useMemo(() => addDays(lunes, 6), [lunes])
  const ref = useMemo(() => new Date(anclaStr + 'T12:00:00'), [anclaStr])
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
        return { nombre, real, hist, obj, futuro: f > hoyStr, ped, color: DIAS_COLOR[i], esActual: f === hoyStr, dV: real != null && hist != null && hist > 0 ? ((real - hist) / hist) * 100 : null, tm, tmH, dTM: tm != null && tmH != null && tmH > 0 ? ((tm - tmH) / tmH) * 100 : null }
      })
    }
    if (periodo === 'mes') {
      const y = ref.getFullYear(), m = ref.getMonth(), dim = new Date(y, m + 1, 0).getDate(), nS = Math.ceil(dim / 7)
      return Array.from({ length: nS }, (_, k) => {
        const cur = rango(new Date(y, m, k * 7 + 1), new Date(y, m, Math.min((k + 1) * 7, dim)))
        const cm = comp === 'anio' ? 12 : 1, dimC = new Date(y, m - cm + 1, 0).getDate()
        const cc = rango(new Date(y, m - cm, k * 7 + 1), new Date(y, m - cm, Math.min((k + 1) * 7, dimC)))
        const tm = cur.ped > 0 ? cur.v / cur.ped : null, tmH = cc.ped > 0 ? cc.v / cc.ped : null
        return { nombre: `S${k + 1}`, real: cur.hay ? cur.v : null, hist: cc.hay ? cc.v : null, obj: objetivoRango(new Date(y, m, k * 7 + 1), new Date(y, m, Math.min((k + 1) * 7, dim))), futuro: new Date(y, m, k * 7 + 1) > ref, ped: cur.hay ? cur.ped : null, color: DIAS_COLOR[k % 7], esActual: wom(ref) === k + 1, dV: cur.hay && cc.hay && cc.v > 0 ? ((cur.v - cc.v) / cc.v) * 100 : null, tm, tmH, dTM: tm != null && tmH != null && tmH > 0 ? ((tm - tmH) / tmH) * 100 : null }
      })
    }
    const y = ref.getFullYear()
    return Array.from({ length: ref.getMonth() + 1 }, (_, k) => {
      const cur = rango(new Date(y, k, 1), new Date(y, k + 1, 0)), cc = rango(new Date(y - 1, k, 1), new Date(y - 1, k + 1, 0))
      const tm = cur.ped > 0 ? cur.v / cur.ped : null, tmH = cc.ped > 0 ? cc.v / cc.ped : null
      return { nombre: MESES[k], real: cur.hay ? cur.v : null, hist: cc.hay ? cc.v : null, obj: objetivoRango(new Date(y, k, 1), new Date(y, k + 1, 0)), futuro: false, ped: cur.hay ? cur.ped : null, color: DIAS_COLOR[k % 7], esActual: ref.getMonth() === k, dV: cur.hay && cc.hay && cc.v > 0 ? ((cur.v - cc.v) / cc.v) * 100 : null, tm, tmH, dTM: tm != null && tmH != null && tmH > 0 ? ((tm - tmH) / tmH) * 100 : null }
    })
  }, [periodo, comp, lunes, ref, brutoDia, pedDia, rango, objetivoRango, objDia, objBase, hoyStr])

  // Rango del periodo actual y comparado, recortado al MISMO tramo transcurrido (días vividos)
  const { pIni, pFin, cIni, cFin, pFinTramo, cFinTramo, diasTransDias, diasTotDias } = useMemo(() => {
    const pi = periodo === 'semana' ? lunes : periodo === 'mes' ? new Date(ref.getFullYear(), ref.getMonth(), 1) : new Date(ref.getFullYear(), 0, 1)
    const pf = periodo === 'semana' ? domingo : periodo === 'mes' ? new Date(ref.getFullYear(), ref.getMonth() + 1, 0) : new Date(ref.getFullYear(), 11, 31)
    const ci = periodo === 'semana' ? shiftD(pi, comp) : comp === 'anio' ? new Date(pi.getFullYear() - 1, pi.getMonth(), 1) : new Date(pi.getFullYear(), pi.getMonth() - 1, 1)
    const cf = periodo === 'semana' ? shiftD(pf, comp) : comp === 'anio' ? new Date(pf.getFullYear() - 1, pf.getMonth(), pf.getDate()) : new Date(pi.getFullYear(), pi.getMonth(), 0)
    const hoyD = new Date(hoyStr + 'T12:00:00')
    const finReal = hoyD < pf ? hoyD : pf
    const dTrans = Math.max(Math.round((finReal.getTime() - pi.getTime()) / 86400000) + 1, 1)
    const pFinT = finReal < pi ? pi : finReal
    const cFinT = addDays(ci, dTrans - 1)
    const dTot = Math.round((pf.getTime() - pi.getTime()) / 86400000) + 1
    return { pIni: pi, pFin: pf, cIni: ci, cFin: cf, pFinTramo: pFinT, cFinTramo: cFinT, diasTransDias: dTrans, diasTotDias: dTot }
  }, [periodo, comp, lunes, domingo, ref, hoyStr])

  // Tramo-contra-tramo: actual transcurrido vs mismos días del comparado
  const curT = useMemo(() => rango(pIni, pFinTramo), [rango, pIni, pFinTramo])
  const cmpT = useMemo(() => rango(cIni, cFinTramo), [rango, cIni, cFinTramo])

  const total = curT.v
  const pedidos = curT.ped
  const tm = pedidos > 0 ? curT.v / pedidos : 0
  const tmC = cmpT.ped > 0 ? cmpT.v / cmpT.ped : 0
  const histTotal = cmpT.hay ? cmpT.v : null
  const deltaTotal = histTotal != null && histTotal > 0 ? ((total - histTotal) / histTotal) * 100 : null
  const dPed = cmpT.hay && cmpT.ped > 0 ? ((pedidos - cmpT.ped) / cmpT.ped) * 100 : null
  const dTM = cmpT.hay && tmC > 0 ? ((tm - tmC) / tmC) * 100 : null

  // Objetivo proporcional al tramo transcurrido (para % honesto)
  const objTramo = useMemo(() => objetivoRango(pIni, pFinTramo), [objetivoRango, pIni, pFinTramo])
  const objPeriodo = useMemo(() => objetivoRango(pIni, pFin), [objetivoRango, pIni, pFin])
  const pctObj = objTramo > 0 ? (total / objTramo) * 100 : 0
  const periodoCerrado = pFinTramo >= pFin

  // Proyección de cierre REAL (media diaria de días con datos × días totales)
  const proy = curT.dias > 0 ? (curT.v / curT.dias) * diasTotDias : 0
  const proyDeltaObj = objPeriodo > 0 ? ((proy - objPeriodo) / objPeriodo) * 100 : null
  const diasRest = Math.max(diasTotDias - diasTransDias, 0)

  const frase = useMemo(() => {
    const e: Esc = { pctObj, dV: deltaTotal, dP: dPed, dT: dTM, diasRest, falta: Math.max(objTramo - total, 0), hayComp: cmpT.hay, total, proy, obj: objTramo, labelComp }
    const def = BATERIA.find(f => { try { return f.cond(e) } catch { return false } }) || BATERIA[BATERIA.length - 1]
    return { txt: def.txt(e), color: def.color() }
  }, [pctObj, deltaTotal, dPed, dTM, diasRest, objTramo, total, cmpT.hay, proy, labelComp])

  const diasConDatosCanal = useMemo(() => { let n = 0; for (let d = new Date(pIni); d <= pFinTramo; d = addDays(d, 1)) if ((agg.get(toLocal(d))?.bruto ?? 0) > 0) n++; return n }, [agg, pIni, pFinTramo])

  // Cards por canal: actual (tramo) vs comparado (mismo tramo). Pedidos / TM bruto / TM neto enfrentados.
  const canalPeriodo = useMemo(() => {
    const vis = filtra ? CANALES.filter(c => canalesFiltro.includes(c.id)) : CANALES
    return vis.map(c => {
      let b = 0, p = 0, bc = 0, pc = 0, hayC = false
      for (let d = new Date(pIni); d <= pFinTramo; d = addDays(d, 1)) { const a = agg.get(toLocal(d)); if (a) { b += a[c.bk]; p += a[c.pk] } }
      for (let d = new Date(cIni); d <= cFinTramo; d = addDays(d, 1)) { const a = agg.get(toLocal(d)); if (a) { hayC = true; bc += a[c.bk]; pc += a[c.pk] } }
      const { neto } = calcNetoPorCanal(c.id, b, p, { modo: 'agregado_canal', marcasPorCanal, fechaDesde: pIni, fechaHasta: pFinTramo, configCanales, diasConDatos: diasConDatosCanal })
      const { neto: netoC } = calcNetoPorCanal(c.id, bc, pc, { modo: 'agregado_canal', marcasPorCanal, fechaDesde: cIni, fechaHasta: cFinTramo, configCanales, diasConDatos: diasConDatosCanal })
      return {
        ...c, b, ped: p, tmBruto: p > 0 ? b / p : 0, tmNeto: p > 0 ? neto / p : 0,
        bc, pedC: pc, tmBrutoC: pc > 0 ? bc / pc : 0, tmNetoC: pc > 0 ? netoC / pc : 0,
        delta: hayC && bc > 0 ? ((b - bc) / bc) * 100 : null,
      }
    })
  }, [agg, filtra, canalesFiltro, pIni, pFinTramo, cIni, cFinTramo, marcasPorCanal, configCanales, diasConDatosCanal])

  // Reparto del dia: almuerzo vs cena (tramo actual vs mismo tramo comparado)
  const franja = useMemo(() => {
    const sum = (ini: Date, fin: Date) => {
      let alm = 0, cenas = 0, almPed = 0, cenasPed = 0, hay = false
      for (let d = new Date(ini); d <= fin; d = addDays(d, 1)) {
        const a = aggServ.get(toLocal(d))
        if (a) { hay = true; alm += a.alm; cenas += a.cenas; almPed += a.almPed; cenasPed += a.cenasPed }
      }
      const tot = alm + cenas
      return { alm, cenas, almPed, cenasPed, tot, pctAlm: tot > 0 ? (alm / tot) * 100 : 0, pctCenas: tot > 0 ? (cenas / tot) * 100 : 0, hay }
    }
    const act = sum(pIni, pFinTramo)
    const cmp = sum(cIni, cFinTramo)
    const dAlm = cmp.hay && cmp.alm > 0 ? ((act.alm - cmp.alm) / cmp.alm) * 100 : null
    const dCenas = cmp.hay && cmp.cenas > 0 ? ((act.cenas - cmp.cenas) / cmp.cenas) * 100 : null
    const dPctAlm = cmp.hay ? act.pctAlm - cmp.pctAlm : null
    return { act, cmp, dAlm, dCenas, dPctAlm }
  }, [aggServ, pIni, pFinTramo, cIni, cFinTramo])

  // Movimiento en calendario: cada día L-D actual vs misma posición del comparado
  const calBars = useMemo(() => {
    return DIAS.map((nombre, i) => {
      const dia = addDays(lunes, i); const f = toLocal(dia)
      const real = brutoDia(f)
      const hf = toLocal(shiftD(dia, comp)); const hist = brutoDia(hf)
      return { nombre, color: DIAS_COLOR[i], real, hist, esActual: f === hoyStr, futuro: f > hoyStr, delta: real != null && hist != null && hist > 0 ? ((real - hist) / hist) * 100 : null }
    })
  }, [lunes, comp, brutoDia, hoyStr])
  const maxCalBar = Math.max(...calBars.map(b => Math.max(b.real || 0, b.hist || 0)), 1)
  const semCal = useMemo(() => {
    const w = wom(ref)
    const cur = (() => { const r = rango(new Date(ref.getFullYear(), ref.getMonth(), (w - 1) * 7 + 1), new Date(ref.getFullYear(), ref.getMonth(), w * 7)); return r.hay ? r.v : null })()
    const en = (aM: number, aA: number): number | null => {
      const t = new Date(ref.getFullYear() - aA, ref.getMonth() - aM, 1); const dim = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()
      if ((w - 1) * 7 + 1 > dim) return null
      const r = rango(new Date(t.getFullYear(), t.getMonth(), (w - 1) * 7 + 1), new Date(t.getFullYear(), t.getMonth(), Math.min(w * 7, dim))); return r.hay ? r.v : null
    }
    const histC = comp === 'anio' ? en(0, 1) : en(1, 0)
    // Etiqueta del comparado de la semana
    const lbl = comp === 'prev' ? 'semana anterior' : comp === 'mes' ? MESES[(ref.getMonth() + 11) % 12] : `${MESES[ref.getMonth()]} ${ref.getFullYear() - 1}`
    return { w, cur, hist: histC, lbl, delta: cur != null && histC != null && histC > 0 ? ((cur - histC) / histC) * 100 : null }
  }, [ref, comp, rango])

  const cTabs = periodo === 'semana'
    ? [{ id: 'prev', label: 'vs sem. ant.' }, { id: 'mes', label: 'vs mes ant.' }, { id: 'anio', label: 'vs año ant.' }]
    : [{ id: 'mes', label: 'vs mes ant.' }, { id: 'anio', label: 'vs año ant.' }]
  const pTabs: { id: Periodo; label: string }[] = [{ id: 'semana', label: 'Semana' }, { id: 'mes', label: 'Mes' }, { id: 'anio', label: 'Año' }]

  const card: CSSProperties = { background: '#fff', border: `0.5px solid ${BORDE}`, borderRadius: 16, padding: '18px 20px' }
  const lblS: CSSProperties = { fontFamily: OSWALD, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: COLOR.textMut }
  const BAR_H = 150, SOBRE = 26
  const fill = (p: number) => p >= 50 ? VERDE : AMARILLO
  const maxTM = Math.max(...seg.map(s => Math.max(s.tm || 0, s.tmH || 0)), 1)

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
          <div style={{ fontFamily: OSWALD, fontSize: 'clamp(20px,2.8vw,28px)', fontWeight: 600, letterSpacing: '0.3px' }}>
            <span style={{ color: VERDE }}>{nf2(total)}</span>
            <span style={{ color: COLOR.textMut }}> · </span>
            <span style={{ color: AZUL_PED }}>{nf0(pedidos)} pedidos</span>
            <span style={{ color: COLOR.textMut }}> · </span>
            <span style={{ color: NARANJA_TM }}>TM {nf2(tm)}</span>
          </div>
          <div style={{ fontFamily: OSWALD, fontSize: 'clamp(18px,2.4vw,24px)', fontWeight: 600, color: frase.color, letterSpacing: '0.3px' }}>{frase.txt}</div>
          {!periodoCerrado && proy > 0 && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginTop: 4, paddingTop: 10, borderTop: `0.5px solid ${BORDE}` }}>
              <span style={{ fontFamily: OSWALD, fontSize: 15, letterSpacing: '1px', textTransform: 'uppercase', color: COLOR.textSec }}>Proyección de cierre</span>
              <span style={{ fontFamily: OSWALD, fontSize: 24, fontWeight: 600, color: COLOR.textPri }}>{nf2(proy)}</span>
              {objPeriodo > 0 && <span style={{ fontFamily: LEXEND, fontSize: 14, color: COLOR.textSec }}>objetivo {nf0(objPeriodo)}</span>}
              {proyDeltaObj != null && <span style={{ fontFamily: LEXEND, fontSize: 14, fontWeight: 600, color: colorDelta(proyDeltaObj) }}>{proyDeltaObj >= 0 ? '+' : ''}{proyDeltaObj.toFixed(0)}% vs objetivo</span>}
            </div>
          )}
        </div>
      </div>

      {/* FACTURACIÓN POR DÍA (2/3) + TICKET MEDIO (1/3) */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>
        <div style={card}>
          <div style={{ ...lblS, marginBottom: 4 }}>Facturación · {periodo === 'semana' ? 'por día' : periodo === 'mes' ? 'por semana' : 'por mes'}</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: periodo === 'anio' ? 6 : 12, paddingTop: SOBRE + 18 }}>
            {seg.map((s, i) => {
              const sinObj = s.obj === 0
              const p = !sinObj && s.real != null ? (s.real / s.obj) * 100 : 0
              const rell = sinObj ? (s.real != null ? Math.min((s.real / Math.max(...seg.map(x => x.real || 0), 1)) * 100, 100) : 0) : Math.min(p, 100)
              const supera = !sinObj && s.real != null && s.real >= s.obj && s.obj > 0
              const colF = sinObj ? (s.dV == null ? COLOR.textMut : s.dV >= 0 ? VERDE : ROJO) : fill(p)
              const dif = s.real != null && s.hist != null ? s.real - s.hist : null
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontFamily: OSWALD, fontSize: periodo === 'anio' ? 13 : 16, fontWeight: 700, color: s.futuro ? COLOR.textMut : s.real != null ? COLOR.textPri : COLOR.textMut, height: 19, lineHeight: '19px' }}>{s.real != null ? nf0(s.real) : '—'}</span>
                  <div style={{ position: 'relative', width: '60%', height: BAR_H, marginTop: 2 }}>
                    {supera && <div style={{ position: 'absolute', top: -SOBRE, left: -4, right: -4, bottom: -4, border: `2px dashed ${VERDE}`, borderRadius: 8, pointerEvents: 'none' }} />}
                    {supera && <span style={{ position: 'absolute', top: -SOBRE + 2, left: 0, right: 0, textAlign: 'center', fontSize: 13, color: VERDE, fontWeight: 700 }}>⋯</span>}
                    <div style={{ position: 'absolute', inset: 0, background: s.futuro ? TRACK : ROJO, borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', opacity: s.futuro ? 0.4 : 1 }}>
                      {!s.futuro && rell > 0 && <div style={{ width: '100%', height: `${rell}%`, background: colF }} />}
                    </div>
                  </div>
                  <span style={{ fontFamily: LEXEND, fontSize: periodo === 'anio' ? 10 : 12, color: s.esActual ? COLOR.textPri : COLOR.textMut, fontWeight: s.esActual ? 700 : 400, marginTop: 6, height: 15 }}>{s.nombre}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: colorDelta(s.dV), height: 14, lineHeight: '14px' }}>{s.dV != null ? `${s.dV >= 0 ? '▲' : '▼'}${Math.abs(s.dV).toFixed(0)}%` : ''}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: colorDelta(s.dV), height: 13, lineHeight: '13px' }}>{dif != null ? `${dif >= 0 ? '+' : '−'}${nf0(Math.abs(dif))}` : ''}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* TICKET MEDIO (estilo Resumen): actual naranja + comparado gris, por día */}
        <div style={card}>
          <div style={{ ...lblS, marginBottom: 12 }}>Ticket medio · {periodo === 'semana' ? 'por día' : periodo === 'mes' ? 'por semana' : 'por mes'}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginBottom: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: OSWALD, fontSize: 32, fontWeight: 600, color: NARANJA_TM }}>{nf2(tm)}</div>
              <div style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: NARANJA_TM, fontWeight: 500 }}>TM actual</div>
            </div>
            <div>
              <div style={{ fontFamily: OSWALD, fontSize: 26, fontWeight: 600, color: GRIS_COMP }}>{tmC > 0 ? nf2(tmC) : '—'}</div>
              <div style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS_COMP, fontWeight: 500 }}>{labelComp}</div>
            </div>
            {dTM != null && <span style={{ fontFamily: LEXEND, fontSize: 13, fontWeight: 600, color: colorDelta(dTM) }}>{dTM >= 0 ? '▲ +' : '▼ '}{Math.abs(dTM).toFixed(1)}%</span>}
          </div>
          {seg.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ minWidth: 30, fontFamily: LEXEND, fontSize: 12, color: s.esActual ? COLOR.textPri : COLOR.textSec, fontWeight: s.esActual ? 700 : 400 }}>{s.nombre}</span>
              <div style={{ flex: 1, height: 10, background: TRACK, borderRadius: 5 }}>
                <div style={{ height: 10, width: `${Math.min(((s.tm || 0) / maxTM) * 100, 100)}%`, background: s.color, borderRadius: 5 }} />
              </div>
              <span style={{ minWidth: 48, textAlign: 'right', fontFamily: OSWALD, fontSize: 15, fontWeight: 600, color: s.tm != null ? NARANJA_TM : COLOR.textMut }}>{s.tm != null ? nf2(s.tm) : '—'}</span>
              <span style={{ minWidth: 44, textAlign: 'right', fontFamily: OSWALD, fontSize: 13, fontWeight: 500, color: GRIS_COMP }}>{s.tmH != null ? nf2(s.tmH) : '—'}</span>
            </div>
          ))}
          <div style={{ fontFamily: LEXEND, fontSize: 10, color: COLOR.textMut, marginTop: 4 }}>Naranja: actual · Gris: {labelComp}</div>
        </div>
      </div>

      {/* CARDS POR CANAL: actual vs comparado enfrentados */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ ...lblS, marginBottom: 12 }}>Por canal · vs {labelComp}</div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${canalPeriodo.length}, 1fr)`, gap: 10 }}>
          {canalPeriodo.map(c => (
            <div key={c.id} style={{ background: `${c.color}1a`, border: `0.5px solid ${c.color}`, borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ fontFamily: OSWALD, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: c.color, marginBottom: 6 }}>{c.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: OSWALD, fontSize: 28, fontWeight: 600, color: '#111' }}>{nf2(c.b)}</span>
                <span style={{ fontFamily: OSWALD, fontSize: 16, fontWeight: 500, color: GRIS_COMP }}>{c.bc > 0 ? nf0(c.bc) : '—'}</span>
              </div>
              <div style={{ fontFamily: LEXEND, fontSize: 13, fontWeight: 600, color: colorDelta(c.delta), marginTop: 3, marginBottom: 12 }}>{c.delta == null ? 'sin comparativa' : `${c.delta >= 0 ? '▲ +' : '▼ '}${Math.abs(c.delta).toFixed(1)}%`}</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '4px 8px', alignItems: 'baseline' }}>
                <span style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: '1.2px', textTransform: 'uppercase', color: AZUL_PED }}>Pedidos</span>
                <span style={{ fontFamily: OSWALD, fontSize: 18, fontWeight: 600, color: AZUL_PED, textAlign: 'right' }}>{nf0(c.ped)}</span>
                <span style={{ fontFamily: OSWALD, fontSize: 13, fontWeight: 500, color: GRIS_COMP, textAlign: 'right', minWidth: 38 }}>{c.pedC > 0 ? nf0(c.pedC) : '—'}</span>

                <span style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: '1.2px', textTransform: 'uppercase', color: NARANJA_TM }}>TM bruto</span>
                <span style={{ fontFamily: OSWALD, fontSize: 18, fontWeight: 600, color: NARANJA_TM, textAlign: 'right' }}>{nf2(c.tmBruto)}</span>
                <span style={{ fontFamily: OSWALD, fontSize: 13, fontWeight: 500, color: GRIS_COMP, textAlign: 'right' }}>{c.tmBrutoC > 0 ? nf2(c.tmBrutoC) : '—'}</span>

                <span style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: '1.2px', textTransform: 'uppercase', color: VERDE }}>TM neto</span>
                <span style={{ fontFamily: OSWALD, fontSize: 18, fontWeight: 600, color: VERDE, textAlign: 'right' }}>{nf2(c.tmNeto)}</span>
                <span style={{ fontFamily: OSWALD, fontSize: 13, fontWeight: 500, color: GRIS_COMP, textAlign: 'right' }}>{c.tmNetoC > 0 ? nf2(c.tmNetoC) : '—'}</span>
              </div>
              <div style={{ fontFamily: LEXEND, fontSize: 10, color: COLOR.textMut, marginTop: 8 }}>Izq: actual · Der gris: {labelComp}</div>
            </div>
          ))}
        </div>
      </div>

      {/* MOVIMIENTO EN CALENDARIO */}
      <div style={card}>
        <div style={{ ...lblS, marginBottom: 16 }}>Movimiento en el calendario · vs {labelComp}</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 200, marginBottom: 14 }}>
          {calBars.map((b, i) => {
            const h = b.real != null && b.real > 0 ? Math.max((b.real / maxCalBar) * 120, 4) : 0
            const hH = b.hist != null && b.hist > 0 ? Math.max((b.hist / maxCalBar) * 120, 2) : 0
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                <span style={{ fontFamily: OSWALD, fontSize: 13, fontWeight: 700, color: b.futuro ? COLOR.textMut : COLOR.textPri, height: 17 }}>{b.real != null ? nf0(b.real) : '—'}</span>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
                  <div style={{ width: 16, height: h, background: b.futuro ? TRACK : b.color, borderRadius: '3px 3px 0 0', opacity: b.futuro ? 0.4 : 1 }} title="actual" />
                  <div style={{ width: 10, height: hH, background: `${b.color}55`, borderRadius: '3px 3px 0 0' }} title="comparado" />
                </div>
                <span style={{ fontFamily: LEXEND, fontSize: 12, color: b.esActual ? COLOR.textPri : COLOR.textMut, fontWeight: b.esActual ? 700 : 400, marginTop: 6, height: 16 }}>{b.nombre}</span>
                <span style={{ fontFamily: OSWALD, fontSize: 12, fontWeight: 500, color: GRIS_COMP, height: 15 }}>{b.hist != null ? nf0(b.hist) : '—'}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: colorDelta(b.delta), height: 14 }}>{b.delta != null ? `${b.delta >= 0 ? '▲' : '▼'}${Math.abs(b.delta).toFixed(0)}%` : ''}</span>
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, paddingTop: 12, borderTop: `0.5px solid ${BORDE}`, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: OSWALD, fontSize: 18, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: COLOR.textSec }}>{semCal.w}ª semana del mes</span>
          <span style={{ fontFamily: OSWALD, fontSize: 24, fontWeight: 600, color: semCal.cur == null ? COLOR.textMut : COLOR.textPri }}>{semCal.cur != null ? nf0(semCal.cur) : '—'}</span>
          <span style={{ fontFamily: OSWALD, fontSize: 20, fontWeight: 500, color: GRIS_COMP }}>{semCal.hist != null ? nf0(semCal.hist) : '—'}</span>
          <span style={{ fontFamily: LEXEND, fontSize: 13, color: COLOR.textMut }}>({semCal.lbl})</span>
          {semCal.delta != null && <span style={{ fontFamily: LEXEND, fontSize: 14, fontWeight: 600, color: colorDelta(semCal.delta) }}>{semCal.delta >= 0 ? '▲ +' : '▼ '}{Math.abs(semCal.delta).toFixed(1)}%</span>}
        </div>
      </div>

      {/* REPARTO DEL DÍA · ALMUERZO vs CENA */}
      <div style={{ ...card, marginTop: 14 }}>
        <div style={{ ...lblS, marginBottom: 4 }}>Reparto del día · almuerzo vs cena · vs {labelComp}</div>
        <div style={{ fontFamily: LEXEND, fontSize: 12, color: COLOR.textMut, marginBottom: 16 }}>Cómo se reparte la facturación entre el turno de comidas y el de cenas, y cómo evoluciona frente a {labelComp}.</div>

        {franja.act.tot === 0 ? (
          <div style={{ fontFamily: LEXEND, fontSize: 13, color: COLOR.textMut }}>Sin desglose de almuerzo/cena en este tramo.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {([
              { key: 'alm', label: 'Almuerzo', col: NARANJA_TM, bruto: franja.act.alm, ped: franja.act.almPed, pct: franja.act.pctAlm, pctC: franja.cmp.pctAlm, d: franja.dAlm },
              { key: 'cenas', label: 'Cena', col: AZUL_PED, bruto: franja.act.cenas, ped: franja.act.cenasPed, pct: franja.act.pctCenas, pctC: franja.cmp.pctCenas, d: franja.dCenas },
            ] as const).map(f => (
              <div key={f.key} style={{ background: `${f.col}1a`, border: `0.5px solid ${f.col}`, borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ fontFamily: OSWALD, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: f.col, marginBottom: 6 }}>{f.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontFamily: OSWALD, fontSize: 30, fontWeight: 600, color: '#111' }}>{nf2(f.bruto)}</span>
                  <span style={{ fontFamily: OSWALD, fontSize: 22, fontWeight: 600, color: f.col }}>{f.pct.toFixed(0)}%</span>
                </div>
                <div style={{ fontFamily: LEXEND, fontSize: 13, fontWeight: 600, color: colorDelta(f.d), marginTop: 3, marginBottom: 12 }}>{f.d == null ? 'sin comparativa' : `${f.d >= 0 ? '▲ +' : '▼ '}${Math.abs(f.d).toFixed(1)}% vs ${labelComp}`}</div>
                <div style={{ height: 10, background: TRACK, borderRadius: 5, marginBottom: 6 }}>
                  <div style={{ height: 10, width: `${Math.min(f.pct, 100)}%`, background: f.col, borderRadius: 5 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: LEXEND, fontSize: 11, color: COLOR.textMut }}>
                  <span>{nf0(f.ped)} pedidos</span>
                  <span>{labelComp}: {f.pctC.toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {franja.dPctAlm != null && franja.act.tot > 0 && (
          <div style={{ fontFamily: OSWALD, fontSize: 'clamp(15px,2vw,18px)', fontWeight: 600, marginTop: 14, color: Math.abs(franja.dPctAlm) < 2 ? COLOR.textSec : franja.dPctAlm > 0 ? NARANJA_TM : AZUL_PED }}>
            {Math.abs(franja.dPctAlm) < 2
              ? 'El reparto comida/cena se mantiene estable.'
              : franja.dPctAlm > 0
                ? `El almuerzo gana peso: +${franja.dPctAlm.toFixed(1)} puntos sobre el total vs ${labelComp}.`
                : `La cena gana peso: +${Math.abs(franja.dPctAlm).toFixed(1)} puntos sobre el total vs ${labelComp}.`}
          </div>
        )}
      </div>
    </div>
  )
}
