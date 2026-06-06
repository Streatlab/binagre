/**
 * Tab Evolución — Panel Global · v9
 * Datos reales (agrega 2 filas/día). Barras iguales tamaño medio, relleno objetivo
 * (rojo #E24B4A → amarillo <50% → verde ≥50% → verde100; sobrebarra "⋯" verde oscuro
 * al superar). Importes sin € con separador de miles. Dos grupos de pills (comparación
 * + Semana/Mes/Año invertido). Batería de 20 frases por regla. Canal y pedidos/ticket
 * por día comparados. Posición de calendario lunes vs lunes y semana vs semana.
 */
import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
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

// Colores EXACTOS tabla cumplimiento Objetivos
const ROJO = '#E24B4A'           // lo que falta
const VERDE = '#1D9E75'          // relleno ≥50% / cumplido
const AMARILLO = '#f5a623'       // relleno <50%
const VERDE_SOBRE = '#147A5A'    // sobrecumplimiento (sobrebarra)
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
  { id: 'uber', label: 'Uber Eats', color: COLOR.uber, bk: 'uber_bruto', pk: 'uber_pedidos' },
  { id: 'glovo', label: 'Glovo', color: COLOR.glovo, bk: 'glovo_bruto', pk: 'glovo_pedidos' },
  { id: 'je', label: 'Just Eat', color: COLOR.je, bk: 'je_bruto', pk: 'je_pedidos' },
  { id: 'web', label: 'Web', color: COLOR.webSL, bk: 'web_bruto', pk: 'web_pedidos' },
  { id: 'dir', label: 'Directa', color: COLOR.directa, bk: 'directa_bruto', pk: 'directa_pedidos' },
] as const

/* ── BATERÍA DE FRASES (20) ──
   Cada frase: id, color, condición (regla sobre el escenario) y plantilla.
   El motor elige la PRIMERA cuya condición se cumple, por prioridad de lista. */
interface Escenario {
  pctObj: number          // % cumplimiento objetivo del periodo
  deltaVentas: number | null
  deltaPed: number | null
  deltaTM: number | null
  diasRestantes: number
  falta: number
  hayComp: boolean
  total: number
  proyeccion: number      // ritmo proyectado a fin de periodo
  labelComp: string
  periodo: Periodo
}
interface FraseDef { id: string; cond: (e: Escenario) => boolean; txt: (e: Escenario) => string; color: (e: Escenario) => string }

const POS = VERDE, NEG = ROJO, WARN = AMARILLO, NEU = COLOR.textSec

const BATERIA: FraseDef[] = [
  { id: 'sin_datos', cond: e => e.total === 0, txt: () => 'Aún no hay facturación registrada en este periodo.', color: () => NEU },
  { id: 'sobrecumple_fuerte', cond: e => e.pctObj >= 120, txt: e => `Objetivo pulverizado: ${e.pctObj.toFixed(0)}% del objetivo. Ritmo excelente.`, color: () => POS },
  { id: 'sobrecumple', cond: e => e.pctObj >= 100, txt: e => `Objetivo superado (${e.pctObj.toFixed(0)}%). A mantener el nivel.`, color: () => POS },
  { id: 'proy_supera', cond: e => e.pctObj < 100 && e.diasRestantes > 0 && e.proyeccion >= e.objLike(), txt: e => `Vas al ${e.pctObj.toFixed(0)}%, pero al ritmo actual cerrarías por encima del objetivo.`, color: () => POS },
  { id: 'casi', cond: e => e.pctObj >= 90 && e.pctObj < 100 && e.diasRestantes > 0, txt: e => `Muy cerca: ${e.pctObj.toFixed(0)}% del objetivo, faltan ${nf0(e.falta)} en ${e.diasRestantes} día${e.diasRestantes === 1 ? '' : 's'}.`, color: () => WARN },
  { id: 'buen_ritmo_subida', cond: e => e.hayComp && (e.deltaVentas ?? 0) >= 10, txt: e => `Facturación +${(e.deltaVentas ?? 0).toFixed(0)}% vs ${e.labelComp}. Tendencia al alza.`, color: () => POS },
  { id: 'leve_subida', cond: e => e.hayComp && (e.deltaVentas ?? 0) > 0 && (e.deltaVentas ?? 0) < 10, txt: e => `Ligeramente por encima de ${e.labelComp} (+${(e.deltaVentas ?? 0).toFixed(1)}%).`, color: () => POS },
  { id: 'plano', cond: e => e.hayComp && Math.abs(e.deltaVentas ?? 0) <= 1, txt: e => `En línea con ${e.labelComp}. Sin cambios relevantes.`, color: () => NEU },
  { id: 'caida_fuerte', cond: e => e.hayComp && (e.deltaVentas ?? 0) <= -15, txt: e => `Atención: facturación ${(e.deltaVentas ?? 0).toFixed(0)}% vs ${e.labelComp}. Hay que reaccionar.`, color: () => NEG },
  { id: 'caida', cond: e => e.hayComp && (e.deltaVentas ?? 0) < 0, txt: e => `Por debajo de ${e.labelComp} (${(e.deltaVentas ?? 0).toFixed(1)}%). Margen de mejora.`, color: () => NEG },
  { id: 'pocos_pedidos', cond: e => e.hayComp && (e.deltaPed ?? 0) <= -10, txt: e => `Caen los pedidos (${(e.deltaPed ?? 0).toFixed(0)}% vs ${e.labelComp}). Revisar visibilidad/promos.`, color: () => NEG },
  { id: 'mas_pedidos', cond: e => e.hayComp && (e.deltaPed ?? 0) >= 10, txt: e => `Más pedidos que ${e.labelComp} (+${(e.deltaPed ?? 0).toFixed(0)}%). Buen empuje de demanda.`, color: () => POS },
  { id: 'tm_sube', cond: e => e.hayComp && (e.deltaTM ?? 0) >= 5, txt: e => `Ticket medio +${(e.deltaTM ?? 0).toFixed(1)}% vs ${e.labelComp}. Suben los carritos.`, color: () => POS },
  { id: 'tm_baja', cond: e => e.hayComp && (e.deltaTM ?? 0) <= -5, txt: e => `Ticket medio ${(e.deltaTM ?? 0).toFixed(1)}% vs ${e.labelComp}. Trabajar upselling.`, color: () => NEG },
  { id: 'lejos_objetivo_resto', cond: e => e.pctObj < 50 && e.diasRestantes > 0, txt: e => `Vas al ${e.pctObj.toFixed(0)}% del objetivo, quedan ${e.diasRestantes} día${e.diasRestantes === 1 ? '' : 's'}: hay que apretar.`, color: () => NEG },
  { id: 'medio_objetivo_resto', cond: e => e.pctObj >= 50 && e.pctObj < 90 && e.diasRestantes > 0, txt: e => `Al ${e.pctObj.toFixed(0)}% del objetivo, faltan ${nf0(e.falta)} en ${e.diasRestantes} día${e.diasRestantes === 1 ? '' : 's'}.`, color: () => WARN },
  { id: 'cerrado_corto', cond: e => e.diasRestantes === 0 && e.pctObj < 100 && e.pctObj >= 80, txt: e => `Periodo cerrado al ${e.pctObj.toFixed(0)}% del objetivo. Cerca pero no.`, color: () => WARN },
  { id: 'cerrado_lejos', cond: e => e.diasRestantes === 0 && e.pctObj < 80, txt: e => `Periodo cerrado al ${e.pctObj.toFixed(0)}% del objetivo. Por debajo de lo previsto.`, color: () => NEG },
  { id: 'sin_comp', cond: e => !e.hayComp, txt: e => `Llevas ${nf0(e.total)} este periodo. Sin histórico de ${e.labelComp} para comparar.`, color: () => NEU },
  { id: 'fallback', cond: () => true, txt: e => `Periodo en marcha: ${nf0(e.total)} acumulado.`, color: () => NEU },
]
// helper inyectado en el escenario para regla de proyección
type EscFull = Escenario & { objLike: () => number }

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

  // segmentos
  const seg = useMemo(() => {
    if (periodo === 'semana') {
      return DIAS.map((nombre, i) => {
        const dia = addDays(lunes, i); const f = toLocal(dia)
        const real = brutoDia(f); const ped = pedDia(f)
        const hf = toLocal(shiftD(dia, comp)); const hist = brutoDia(hf); const histPed = pedDia(hf)
        const obj = objDia[i + 1] || objBase || 0
        const futuro = f > hoyStr
        const tm = ped && real != null && ped > 0 ? real / ped : null
        const tmH = histPed && hist != null && histPed > 0 ? hist / histPed : null
        return {
          nombre, real, hist, obj, futuro, ped, color: DIAS_COLOR[i], esActual: f === hoyStr,
          dV: real != null && hist != null && hist > 0 ? ((real - hist) / hist) * 100 : null,
          tm, dTM: tm != null && tmH != null && tmH > 0 ? ((tm - tmH) / tmH) * 100 : null,
          dPed: ped != null && histPed != null && histPed > 0 ? ((ped - histPed) / histPed) * 100 : null,
        }
      })
    }
    if (periodo === 'mes') {
      const y = hoy.getFullYear(), m = hoy.getMonth(), dim = new Date(y, m + 1, 0).getDate(), nS = Math.ceil(dim / 7)
      return Array.from({ length: nS }, (_, k) => {
        const cur = rango(new Date(y, m, k * 7 + 1), new Date(y, m, Math.min((k + 1) * 7, dim)))
        const cm = comp === 'anio' ? 12 : 1
        const dimC = new Date(y, m - cm + 1, 0).getDate()
        const cc = rango(new Date(y, m - cm, k * 7 + 1), new Date(y, m - cm, Math.min((k + 1) * 7, dimC)))
        const tm = cur.ped > 0 ? cur.v / cur.ped : null, tmH = cc.ped > 0 ? cc.v / cc.ped : null
        return { nombre: `S${k + 1}`, real: cur.hay ? cur.v : null, hist: cc.hay ? cc.v : null, obj: 0, futuro: new Date(y, m, k * 7 + 1) > hoy, ped: cur.hay ? cur.ped : null, color: COLOR.uber, esActual: wom(hoy) === k + 1, dV: cur.hay && cc.hay && cc.v > 0 ? ((cur.v - cc.v) / cc.v) * 100 : null, tm, dTM: tm != null && tmH != null && tmH > 0 ? ((tm - tmH) / tmH) * 100 : null, dPed: cur.hay && cc.hay && cc.ped > 0 ? ((cur.ped - cc.ped) / cc.ped) * 100 : null }
      })
    }
    const y = hoy.getFullYear()
    return Array.from({ length: hoy.getMonth() + 1 }, (_, k) => {
      const cur = rango(new Date(y, k, 1), new Date(y, k + 1, 0))
      const cc = rango(new Date(y - 1, k, 1), new Date(y - 1, k + 1, 0))
      const tm = cur.ped > 0 ? cur.v / cur.ped : null, tmH = cc.ped > 0 ? cc.v / cc.ped : null
      return { nombre: MESES[k], real: cur.hay ? cur.v : null, hist: cc.hay ? cc.v : null, obj: 0, futuro: false, ped: cur.hay ? cur.ped : null, color: COLOR.uber, esActual: hoy.getMonth() === k, dV: cur.hay && cc.hay && cc.v > 0 ? ((cur.v - cc.v) / cc.v) * 100 : null, tm, dTM: tm != null && tmH != null && tmH > 0 ? ((tm - tmH) / tmH) * 100 : null, dPed: cur.hay && cc.hay && cc.ped > 0 ? ((cur.ped - cc.ped) / cc.ped) * 100 : null }
    })
  }, [periodo, comp, lunes, brutoDia, pedDia, rango, objDia, objBase, hoyStr])

  const total = useMemo(() => seg.reduce((a, s) => a + (s.real || 0), 0), [seg])
  const objTotal = useMemo(() => seg.reduce((a, s) => a + (s.obj || 0), 0), [seg])
  const histTotal = useMemo(() => { const h = seg.filter(s => s.hist != null); return h.length ? h.reduce((a, s) => a + (s.hist || 0), 0) : null }, [seg])
  const pctObj = objTotal > 0 ? (total / objTotal) * 100 : 0
  const deltaTotal = histTotal != null && histTotal > 0 ? ((total - histTotal) / histTotal) * 100 : null

  // periodo totales + comparado (canal / pedidos)
  const pIni = periodo === 'semana' ? lunes : periodo === 'mes' ? new Date(hoy.getFullYear(), hoy.getMonth(), 1) : new Date(hoy.getFullYear(), 0, 1)
  const pFin = periodo === 'semana' ? domingo : periodo === 'mes' ? new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0) : new Date(hoy.getFullYear(), 11, 31)
  const cIni = periodo === 'semana' ? shiftD(pIni, comp) : comp === 'anio' ? new Date(pIni.getFullYear() - 1, pIni.getMonth(), 1) : new Date(pIni.getFullYear(), pIni.getMonth() - 1, 1)
  const cFin = periodo === 'semana' ? shiftD(pFin, comp) : comp === 'anio' ? new Date(pFin.getFullYear() - 1, pFin.getMonth(), pFin.getDate()) : new Date(pIni.getFullYear(), pIni.getMonth(), 0)
  const cur = useMemo(() => rango(pIni, pFin), [rango, pIni, pFin])
  const cmp = useMemo(() => rango(cIni, cFin), [rango, cIni, cFin])
  const pedidos = cur.ped
  const tm = pedidos > 0 ? cur.v / pedidos : 0
  const tmC = cmp.ped > 0 ? cmp.v / cmp.ped : 0
  const dPed = cmp.hay && cmp.ped > 0 ? ((pedidos - cmp.ped) / cmp.ped) * 100 : null
  const dTM = cmp.hay && tmC > 0 ? ((tm - tmC) / tmC) * 100 : null

  // proyección a fin de periodo (ritmo medio diario × días totales)
  const diasTotales = Math.round((pFin.getTime() - pIni.getTime()) / 86400000) + 1
  const diasTranscurridos = seg.filter(s => !s.futuro).length || 1
  const diasRestantes = periodo === 'semana' ? seg.filter(s => s.futuro || s.esActual).length : Math.max(diasTotales - Math.round((hoy.getTime() - pIni.getTime()) / 86400000) - 1, 0)
  const proyeccion = total / Math.max(diasTranscurridos, 1) * (periodo === 'semana' ? 7 : diasTotales)

  // motor de frases
  const fraseSel = useMemo(() => {
    const e: EscFull = {
      pctObj, deltaVentas: deltaTotal, deltaPed: dPed, deltaTM: dTM,
      diasRestantes, falta: Math.max(objTotal - total, 0), hayComp: cmp.hay, total, proyeccion, labelComp, periodo,
      objLike: () => objTotal,
    }
    const def = BATERIA.find(f => { try { return f.cond(e) } catch { return false } }) || BATERIA[BATERIA.length - 1]
    return { txt: def.txt(e), color: def.color(e) }
  }, [pctObj, deltaTotal, dPed, dTM, diasRestantes, objTotal, total, cmp.hay, proyeccion, labelComp, periodo])

  // canal comparado (base Resumen + comparación)
  const canal = useMemo(() => {
    const vis = filtra ? CANALES.filter(c => canalesFiltro.includes(c.id)) : CANALES
    return vis.map(c => {
      let v = 0, vc = 0, hayC = false
      for (let d = new Date(pIni); d <= pFin; d = addDays(d, 1)) { const a = agg.get(toLocal(d)); if (a) v += a[c.bk] }
      for (let d = new Date(cIni); d <= cFin; d = addDays(d, 1)) { const a = agg.get(toLocal(d)); if (a) { hayC = true; vc += a[c.bk] } }
      return { ...c, v, delta: hayC && vc > 0 ? ((v - vc) / vc) * 100 : null }
    })
  }, [agg, filtra, canalesFiltro, pIni, pFin, cIni, cFin])
  const maxCanal = Math.max(...canal.map(c => c.v), 1)

  // posición calendario
  const cal = useMemo(() => {
    const wd = (hoy.getDay() + 6) % 7, nth = nthWd(hoy), w = wom(hoy)
    const valHoy = brutoDia(hoyStr)
    const nthEn = (aM: number, aA: number): number | null => {
      const t = new Date(hoy.getFullYear() - aA, hoy.getMonth() - aM, 1)
      const fw = (t.getDay() + 6) % 7
      const day = 1 + ((wd - fw + 7) % 7) + (nth - 1) * 7
      const dim = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()
      if (day > dim) return null
      return brutoDia(toLocal(new Date(t.getFullYear(), t.getMonth(), day)))
    }
    const semEn = (aM: number, aA: number): number | null => {
      const t = new Date(hoy.getFullYear() - aA, hoy.getMonth() - aM, 1)
      const dim = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()
      if ((w - 1) * 7 + 1 > dim) return null
      const r = rango(new Date(t.getFullYear(), t.getMonth(), (w - 1) * 7 + 1), new Date(t.getFullYear(), t.getMonth(), Math.min(w * 7, dim)))
      return r.hay ? r.v : null
    }
    const semAct = (() => { const r = rango(new Date(hoy.getFullYear(), hoy.getMonth(), (w - 1) * 7 + 1), new Date(hoy.getFullYear(), hoy.getMonth(), w * 7)); return r.hay ? r.v : null })()
    return { diaLabel: `${nth}º ${DIAS_L[wd]} del mes`, valHoy, diaMes: nthEn(1, 0), diaAno: nthEn(0, 1), semLabel: `${w}ª semana del mes`, semAct, semMes: semEn(1, 0), semAno: semEn(0, 1) }
  }, [hoyStr, brutoDia, rango])

  // ── estilos pills (clon Facturación) ──
  const pillBase: React.CSSProperties = { padding: '8px 18px', borderRadius: 999, fontSize: 12, cursor: 'pointer', fontFamily: OSWALD, letterSpacing: '0.5px', textTransform: 'uppercase', fontWeight: 700, lineHeight: 1, transition: 'all .15s' }
  const pillMain = (a: boolean): React.CSSProperties => ({ ...pillBase, border: a ? 'none' : `0.5px solid ${BORDE}`, background: a ? COLOR.rojo : '#fff', color: a ? '#fff' : '#3a4050' })
  const pillInv = (a: boolean): React.CSSProperties => ({ ...pillBase, border: 'none', background: a ? '#7a1419' : '#f6c9cc', color: a ? '#fff' : '#7a1419' })
  const pTabs: { id: Periodo; label: string }[] = [{ id: 'semana', label: 'Semana' }, { id: 'mes', label: 'Mes' }, { id: 'anio', label: 'Año' }]
  const cTabs: { id: Comp; label: string }[] = periodo === 'semana'
    ? [{ id: 'prev', label: 'vs sem. ant.' }, { id: 'mes', label: 'vs mes ant.' }, { id: 'anio', label: 'vs año ant.' }]
    : [{ id: 'mes', label: 'vs mes ant.' }, { id: 'anio', label: 'vs año ant.' }]

  const card: React.CSSProperties = { background: '#fff', border: `0.5px solid ${BORDE}`, borderRadius: 16, padding: '18px 20px' }
  const lblS: React.CSSProperties = { fontFamily: OSWALD, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: COLOR.textMut }
  const BAR_H = 150        // altura fija media de la barra
  const SOBRE_H = 34       // hueco para sobrebarra

  // relleno color por % cumplimiento (Objetivos): <50 amarillo, ≥50 verde
  const fill = (p: number) => p >= 50 ? VERDE : AMARILLO
  const maxValSeg = Math.max(...seg.map(s => s.real || 0), 1)

  return (
    <div style={{ fontFamily: LEXEND, color: COLOR.textPri, paddingTop: 18 }}>

      {/* TITULAR + 2 GRUPOS DE PILLS */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ display: 'inline-flex', gap: 8 }}>{cTabs.map(t => <button key={t.id} onClick={() => setCompP(t.id)} style={pillMain(comp === t.id)}>{t.label}</button>)}</div>
          <div style={{ display: 'inline-flex', gap: 8 }}>{pTabs.map(t => <button key={t.id} onClick={() => setPeriodoP(t.id)} style={pillInv(periodo === t.id)}>{t.label}</button>)}</div>
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
          <div style={{ fontFamily: OSWALD, fontSize: 'clamp(15px,1.8vw,18px)', fontWeight: 500, color: fraseSel.color, letterSpacing: '0.3px' }}>{fraseSel.txt}</div>
        </div>
      </div>

      {/* BARRAS (2/3) + POSICIÓN CALENDARIO (1/3) */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <span style={{ fontFamily: OSWALD, fontSize: 32, fontWeight: 600, color: objTotal > 0 ? (pctObj >= 100 ? VERDE : pctObj >= 50 ? VERDE : AMARILLO) : COLOR.textPri }}>{nf2(total)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: periodo === 'anio' ? 6 : 12, paddingTop: SOBRE_H }}>
            {seg.map((s, i) => {
              const sinObj = s.obj === 0
              const p = !sinObj && s.real != null ? (s.real / s.obj) * 100 : 0
              const rellenoPct = sinObj
                ? (s.real != null ? Math.min((s.real / maxValSeg) * 100, 100) : 0)   // mes/año: proporción al máximo
                : Math.min(p, 100)
              const supera = !sinObj && s.real != null && s.real > s.obj
              const colFill = sinObj ? (s.dV == null ? COLOR.textMut : s.dV >= 0 ? VERDE : ROJO) : fill(p)
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontFamily: OSWALD, fontSize: periodo === 'anio' ? 9 : 11, fontWeight: 600, color: s.futuro ? COLOR.textMut : s.real != null ? COLOR.textPri : COLOR.textMut, marginBottom: 3, height: 14 }}>
                    {s.real != null ? nf0(s.real) : '—'}
                  </span>
                  {/* contenedor barra tamaño fijo medio */}
                  <div style={{ width: '56%', height: BAR_H, position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    {/* sobrebarra */}
                    {supera && <div style={{ position: 'absolute', bottom: BAR_H, left: 0, right: 0, height: SOBRE_H - 12, background: VERDE_SOBRE, borderRadius: '4px 4px 0 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}><span style={{ color: '#fff', fontSize: 12, lineHeight: 1 }}>⋯</span></div>}
                    {/* track */}
                    <div style={{ width: '100%', height: '100%', background: s.futuro ? TRACK : ROJO, borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', opacity: s.futuro ? 0.4 : 1 }}>
                      {!s.futuro && rellenoPct > 0 && <div style={{ width: '100%', height: `${rellenoPct}%`, background: colFill, borderRadius: rellenoPct >= 99 ? 6 : '0 0 6px 6px' }} />}
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

      {/* CANAL COMPARADO + TICKET/PEDIDOS POR DÍA */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={card}>
          <div style={{ ...lblS, marginBottom: 14 }}>Facturación por canal · vs {labelComp}</div>
          {canal.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 11 }}>
              <span style={{ minWidth: 74, fontFamily: LEXEND, fontSize: 12, color: COLOR.textSec }}>{c.label}</span>
              <div style={{ flex: 1, height: 8, background: TRACK, borderRadius: 4 }}>
                <div style={{ height: 8, width: `${Math.min((c.v / maxCanal) * 100, 100)}%`, background: c.id === 'glovo' ? '#c9d400' : c.color, borderRadius: 4 }} />
              </div>
              <span style={{ minWidth: 64, textAlign: 'right', fontFamily: OSWALD, fontSize: 14, fontWeight: 600, color: COLOR.textPri }}>{nf0(c.v)}</span>
              <span style={{ minWidth: 50, textAlign: 'right', fontFamily: LEXEND, fontSize: 12, color: colorDelta(c.delta) }}>{c.delta == null ? '—' : `${c.delta >= 0 ? '▲' : '▼'}${Math.abs(c.delta).toFixed(0)}%`}</span>
            </div>
          ))}
        </div>

        {/* Ticket medio / pedidos por día con comparación (base Días Pico) */}
        <div style={card}>
          <div style={{ ...lblS, marginBottom: 4 }}>Ticket medio por día · vs {labelComp}</div>
          <div style={{ fontFamily: LEXEND, fontSize: 12, color: COLOR.textMut, marginBottom: 14 }}>Pedidos {nf0(pedidos)} ({dPed != null ? `${dPed >= 0 ? '+' : ''}${dPed.toFixed(0)}%` : '—'}) · TM {nf2(tm)} ({dTM != null ? `${dTM >= 0 ? '+' : ''}${dTM.toFixed(0)}%` : '—'})</div>
          {seg.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
              <span style={{ minWidth: 36, fontFamily: LEXEND, fontSize: 12, color: s.esActual ? COLOR.textPri : COLOR.textSec, fontWeight: s.esActual ? 700 : 400 }}>{s.nombre}</span>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontFamily: OSWALD, fontSize: 14, fontWeight: 600, color: s.tm != null ? COLOR.textPri : COLOR.textMut }}>{s.tm != null ? nf2(s.tm) : '—'}</span>
              <span style={{ minWidth: 56, textAlign: 'right', fontFamily: LEXEND, fontSize: 11, color: COLOR.textMut }}>{s.ped != null ? `${nf0(s.ped)} ped` : ''}</span>
              <span style={{ minWidth: 50, textAlign: 'right', fontFamily: LEXEND, fontSize: 12, color: colorDelta(s.dTM) }}>{s.dTM == null ? '—' : `${s.dTM >= 0 ? '▲' : '▼'}${Math.abs(s.dTM).toFixed(0)}%`}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
