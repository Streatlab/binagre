/**
 * Tab Evolución — Panel Global · v31
 */
import { useEffect, useMemo, useState, useCallback, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import TabsPastilla from '@/components/ui/TabsPastilla'
import {
  INK, CREMA, CLARO, TRACK, VERDE, ROJO, NAR, AZUL, GRIS,
  OSW, LEX, SHADOW, BORDER, BORDER_CARD,
  CORP, CLARA,
  eyebrow,
} from '@/styles/neobrutal'
import { calcNetoPorCanal, loadConfigCanales, recargarConfigCanales, loadMarcasPorCanal, type CanalConfig, type MarcasPorCanal } from '@/lib/panel/calcNetoPlataforma'
import type { RowFacturacion } from '../resumen/types'
import { COLOR } from '../resumen/tokens'

interface Props {
  rowsAll: RowFacturacion[]
  canalesFiltro: string[]
  rowsPeriodo?: RowFacturacion[]
  fechaDesde?: Date
  fechaHasta?: Date
  fechaOpcion?: string
  onFiltrarDiaSemana?: (idx: number) => void
}

type Periodo = 'semana' | 'mes' | 'anio'
type Comp = 'prev' | 'mes' | 'anio'

// El desplegable manda la vista de Evolución: cada opción fija su periodo
// (semana → Semana, mes → Mes, año → Año). Personalizado/sin opción no fuerza
// (el usuario elige Semana/Mes/Año con las pills).
function periodoDeOpcion(op: string | undefined): Periodo | null {
  if (op === 'esta_semana' || op === 'semana_pasada' || op === 'ultimos_7' || op === 'semanas_x' || op === 'semana_actual') return 'semana'
  if (op === 'este_mes' || op === 'mes_pasado' || op === 'ultimos_30' || op === 'ultimos_60' || op === 'ultimas_12_semanas' || op === 'mes_en_curso') return 'mes'
  if (op === 'ultimos_12_meses') return 'anio'
  return null
}

const AZUL_PED = AZUL
const NARANJA_TM = NAR

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DIAS_LARGO = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
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
function colorDelta(v: number | null) { return v == null ? GRIS : v >= 0 ? VERDE : ROJO }

const CANALES = [
  { id: 'uber', label: 'Uber Eats', color: CORP['uber'], bk: 'uber_bruto', pk: 'uber_pedidos' },
  { id: 'glovo', label: 'Glovo', color: CORP['glovo'], bk: 'glovo_bruto', pk: 'glovo_pedidos' },
  { id: 'je', label: 'Just Eat', color: CORP['je'], bk: 'je_bruto', pk: 'je_pedidos' },
  { id: 'web', label: 'Web', color: CORP['web'], bk: 'web_bruto', pk: 'web_pedidos' },
  { id: 'dir', label: 'Directa', color: CORP['dir'], bk: 'directa_bruto', pk: 'directa_pedidos' },
] as const

const SUBTAB_CONTAINER: CSSProperties = { display: 'inline-flex', gap: 4, padding: '3px 4px', borderRadius: 0, background: INK, border: `2px solid ${INK}` }
const SUBTAB_ACTIVE: CSSProperties = { padding: '4px 10px', borderRadius: 0, border: 'none', background: '#ffffff', color: INK, fontFamily: OSW, fontSize: 10, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', cursor: 'pointer', outline: 'none' }
const SUBTAB_INACTIVE: CSSProperties = { padding: '4px 10px', borderRadius: 0, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#ffffff', fontFamily: OSW, fontSize: 10, fontWeight: 500, letterSpacing: '1.2px', textTransform: 'uppercase', cursor: 'pointer', outline: 'none' }

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

export default function TabEvolucion({ rowsAll, canalesFiltro, fechaHasta, fechaOpcion }: Props) {
  // Evolución arranca SIEMPRE en Semana + 'vs sem. ant.' (no se lee de localStorage a propósito:
  // así la vista por defecto es la semanal y se auto-recupera de estados previos forzados a 'mes').
  const [periodo, setPeriodo] = useState<Periodo>('semana')
  const [comp, setComp] = useState<Comp>('prev')
  const setPeriodoP = useCallback((p: Periodo) => { setPeriodo(p); if (p !== 'semana' && comp === 'prev') setComp('mes') }, [comp])
  const setCompP = useCallback((c: Comp) => { setComp(c) }, [])

  // El desplegable manda la vista: opción de semana → Semana (vs sem. ant.), de mes → Mes (vs mes ant.),
  // de año → Año (vs año ant.). Reaccionar también a fechaHasta para reasegurar al cambiar de tramo.
  useEffect(() => {
    const p = periodoDeOpcion(fechaOpcion)
    if (p === 'semana') { setPeriodo('semana'); setComp('prev') }
    else if (p === 'mes') { setPeriodo('mes'); setComp('mes') }
    else if (p === 'anio') { setPeriodo('anio'); setComp('anio') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaOpcion, fechaHasta])

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
  // Última fecha con datos reales. Si el ancla (fechaHasta) cae en una zona todavía sin ventas
  // (p.ej. hoy es lunes y la semana en curso aún no tiene datos), retrocede a la última fecha con
  // datos para no enseñar el panel vacío.
  const maxDato = useMemo(() => { let mx = ''; for (const r of rowsAll) { const f = r.fecha; if (f && f > mx) mx = f } return mx }, [rowsAll])
  const anclaStr = useMemo(() => {
    const base = fechaHasta ? toLocal(fechaHasta) : hoyStr
    // Si la fecha de referencia cae por delante del último día con ventas (p.ej. hoy es lunes y la
    // semana/periodo en curso aún no tiene datos), retrocede a la última fecha con datos para mostrar
    // siempre el último tramo real en vez de un panel vacío.
    return maxDato && base > maxDato ? maxDato : base
  }, [fechaHasta, hoyStr, maxDato])
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
  const pctObjPeriodo = objPeriodo > 0 ? (total / objPeriodo) * 100 : 0
  const periodoCerrado = pFinTramo >= pFin

  // Proyección de cierre REAL (media diaria de días con datos × días totales)
  const proy = curT.dias > 0 ? (curT.v / curT.dias) * diasTotDias : 0
  const proyDeltaObj = objPeriodo > 0 ? ((proy - objPeriodo) / objPeriodo) * 100 : null
  const diasRest = Math.max(diasTotDias - diasTransDias, 0)

  const diaHoyNombre = useMemo(() => {
    if (periodo === 'semana') return DIAS_LARGO[((pFinTramo.getDay() || 7) - 1)]
    if (periodo === 'mes') return `la semana ${wom(pFinTramo)}`
    return MESES[pFinTramo.getMonth()]
  }, [periodo, pFinTramo])

  // FRASE 1 — ritmo a día de hoy: lo conseguido frente a lo que TOCABA hasta hoy (objetivo proporcional).
  // Sin repetir 'hoy', con día completo y cifras, y dejando claro que el % es lo ya conseguido.
  const fraseHoy = useMemo(() => {
    if (total <= 0 || objTramo <= 0) return null
    const pct = pctObj
    const ini = periodo === 'semana' ? `Hasta el ${diaHoyNombre}` : `Hasta ${diaHoyNombre}`
    const tocaban = `de los ${nf0(objTramo)} que tocaban a estas alturas`
    if (pct >= 100) return { txt: `${ini} llevas ${nf0(total)}: ya has cubierto lo previsto (${pct.toFixed(0)}% ${tocaban}).`, color: VERDE }
    if (pct >= 85) return { txt: `${ini} llevas ${nf0(total)}, el ${pct.toFixed(0)}% ${tocaban}. Buen ritmo.`, color: VERDE }
    if (pct >= 60) return { txt: `${ini} llevas ${nf0(total)}, el ${pct.toFixed(0)}% ${tocaban}.`, color: NAR }
    return { txt: `${ini} llevas ${nf0(total)}, solo el ${pct.toFixed(0)}% ${tocaban}. Hay que apretar.`, color: ROJO }
  }, [periodo, total, objTramo, pctObj, diaHoyNombre])

  // FRASE 2 — cómo va / cómo cerrará el periodo completo (proyección al ritmo actual).
  const fraseCierre = useMemo(() => {
    if (total <= 0 || objPeriodo <= 0) return null
    const u = periodo === 'semana' ? 'la semana' : periodo === 'mes' ? 'el mes' : 'el año'
    if (periodoCerrado) {
      const pp = pctObjPeriodo
      return { txt: `${cap(u)} cerró en ${nf0(total)} (${pp.toFixed(0)}% del objetivo).`, color: pp >= 100 ? VERDE : pp >= 85 ? NAR : ROJO }
    }
    const pc = (proy / objPeriodo) * 100
    if (proy >= objPeriodo) return { txt: `A este ritmo ${u} cerrará en ${nf0(proy)}, por encima del objetivo de ${nf0(objPeriodo)} (+${(pc - 100).toFixed(0)}%).`, color: VERDE }
    return { txt: `A este ritmo ${u} cerrará en ${nf0(proy)}, el ${pc.toFixed(0)}% del objetivo de ${nf0(objPeriodo)}.`, color: pc >= 85 ? NAR : ROJO }
  }, [periodo, total, objPeriodo, pctObjPeriodo, periodoCerrado, proy])

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

  // Reparto del dia: almuerzo vs cena. Compara día-a-día por POSICIÓN: cada día del tramo actual
  // contra el MISMO día desplazado (semana/mes/año anterior), y suma. Así almuerzo vs almuerzo de fecha equivalente.
  const franja = useMemo(() => {
    let alm = 0, cenas = 0, almPed = 0, cenasPed = 0, hay = false
    let almC = 0, cenasC = 0, almPedC = 0, cenasPedC = 0, hayC = false
    for (let d = new Date(pIni); d <= pFinTramo; d = addDays(d, 1)) {
      const a = aggServ.get(toLocal(d))
      if (a) { hay = true; alm += a.alm; cenas += a.cenas; almPed += a.almPed; cenasPed += a.cenasPed }
      const c = aggServ.get(toLocal(shiftD(d, comp)))
      if (c) { hayC = true; almC += c.alm; cenasC += c.cenas; almPedC += c.almPed; cenasPedC += c.cenasPed }
    }
    const tot = alm + cenas, totC = almC + cenasC
    const act = { alm, cenas, almPed, cenasPed, tot, pctAlm: tot > 0 ? (alm / tot) * 100 : 0, pctCenas: tot > 0 ? (cenas / tot) * 100 : 0, hay }
    const cmp = { alm: almC, cenas: cenasC, almPed: almPedC, cenasPed: cenasPedC, tot: totC, pctAlm: totC > 0 ? (almC / totC) * 100 : 0, pctCenas: totC > 0 ? (cenasC / totC) * 100 : 0, hay: hayC }
    const dAlm = cmp.hay && cmp.alm > 0 ? ((act.alm - cmp.alm) / cmp.alm) * 100 : null
    const dCenas = cmp.hay && cmp.cenas > 0 ? ((act.cenas - cmp.cenas) / cmp.cenas) * 100 : null
    const dPctAlm = cmp.hay ? act.pctAlm - cmp.pctAlm : null
    return { act, cmp, dAlm, dCenas, dPctAlm }
  }, [aggServ, pIni, pFinTramo, comp])

  // Posición en el calendario: en vez de duplicar las barras de Facturación, destila DÓNDE cae
  // el periodo — mejor/peor segmento, media, racha al alza y ranking del segmento en curso.
  // Todo deriva de 'seg', que ya respeta periodo (semana=días, mes=semanas, año=meses) y comparado.
  const posCal = useMemo(() => {
    const conDatos = seg.filter(s => s.real != null && (s.real as number) > 0 && !s.futuro)
    if (conDatos.length === 0) return null
    const mejor = conDatos.reduce((a, b) => ((b.real as number) > (a.real as number) ? b : a))
    const peor = conDatos.reduce((a, b) => ((b.real as number) < (a.real as number) ? b : a))
    const media = conDatos.reduce((s, x) => s + (x.real as number), 0) / conDatos.length
    // Racha al alza: segmentos consecutivos (desde el último con datos hacia atrás) por encima del comparado.
    let racha = 0
    for (let i = conDatos.length - 1; i >= 0; i--) {
      if (conDatos[i].dV != null && (conDatos[i].dV as number) >= 0) racha++; else break
    }
    const superan = conDatos.filter(s => s.obj > 0 && (s.real as number) >= s.obj).length
    const actual = conDatos.find(s => s.esActual) ?? conDatos[conDatos.length - 1]
    const rank = [...conDatos].sort((a, b) => (b.real as number) - (a.real as number)).findIndex(s => s === actual) + 1
    const gap = (peor.real as number) > 0 ? (((mejor.real as number) - (peor.real as number)) / (peor.real as number)) * 100 : null
    return { mejor, peor, media, racha, superan, total: conDatos.length, actual, rank, gap }
  }, [seg])

  // Suppress unused variable warnings — these are kept for reference
  void cFin; void dPed; void proyDeltaObj; void diasRest

  const cTabs = periodo === 'semana'
    ? [{ id: 'prev', label: 'vs sem. ant.' }, { id: 'mes', label: 'vs mes ant.' }, { id: 'anio', label: 'vs año ant.' }]
    : [{ id: 'mes', label: 'vs mes ant.' }, { id: 'anio', label: 'vs año ant.' }]
  const pTabs: { id: Periodo; label: string }[] = [{ id: 'semana', label: 'Semana' }, { id: 'mes', label: 'Mes' }, { id: 'anio', label: 'Año' }]

  const card: CSSProperties = { background: '#fff', border: BORDER_CARD, boxShadow: SHADOW, borderRadius: 0, padding: '18px 20px' }
  const BAR_H = 150, SOBRE = 26
  const fill = (p: number) => p >= 50 ? VERDE : NAR
  const maxTM = Math.max(...seg.map(s => Math.max(s.tm || 0, s.tmH || 0)), 1)
  const unidad = periodo === 'semana' ? 'día' : periodo === 'mes' ? 'semana' : 'mes'
  const unidadPl = periodo === 'semana' ? 'días' : periodo === 'mes' ? 'semanas' : 'meses'

  return (
    <div style={{ fontFamily: LEX, color: INK, paddingTop: 18 }}>

      {/* TITULAR + PILLS */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 16, flexWrap: 'wrap' }}>
          <TabsPastilla tabs={cTabs} activeId={comp} onChange={id => setCompP(id as Comp)} />
          <div style={{ width: 2, height: 24, background: INK, flexShrink: 0, marginLeft: 2, marginRight: 2 }} />
          <div style={SUBTAB_CONTAINER}>
            {pTabs.map(t => <button key={t.id} onClick={() => setPeriodoP(t.id)} style={periodo === t.id ? SUBTAB_ACTIVE : SUBTAB_INACTIVE}>{t.label}</button>)}
          </div>
        </div>
        <div style={{ fontFamily: OSW, fontSize: 'clamp(28px,4.2vw,44px)', fontWeight: 600, lineHeight: 1.04 }}>
          {deltaTotal == null ? 'PERIODO EN MARCHA' : 'EL NEGOCIO VA'}{' '}
          {deltaTotal != null && <span style={{ color: colorDelta(deltaTotal), background: `${colorDelta(deltaTotal)}1f`, padding: '0 10px', borderRadius: 0, border: `2px solid ${colorDelta(deltaTotal)}` }}>{deltaTotal >= 0 ? '+' : ''}{deltaTotal.toFixed(1)}%</span>}
          {deltaTotal != null && <span> VS {`los mismos días de ${labelComp}`.replace('de el ', 'del ').toUpperCase()}.</span>}
        </div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontFamily: OSW, fontSize: 'clamp(20px,2.8vw,28px)', fontWeight: 600, letterSpacing: '0.3px' }}>
            <span style={{ color: VERDE }}>{nf2(total)}</span>
            <span style={{ color: GRIS }}> · </span>
            <span style={{ color: AZUL_PED }}>{nf0(pedidos)} pedidos</span>
            <span style={{ color: GRIS }}> · </span>
            <span style={{ color: NARANJA_TM }}>TM {nf2(tm)}</span>
          </div>
          {fraseHoy && <div style={{ fontFamily: OSW, fontSize: 'clamp(16px,2.2vw,21px)', fontWeight: 600, color: fraseHoy.color, letterSpacing: '0.3px' }}>{fraseHoy.txt}</div>}
          {fraseCierre && <div style={{ fontFamily: OSW, fontSize: 'clamp(16px,2.2vw,21px)', fontWeight: 600, color: fraseCierre.color, letterSpacing: '0.3px' }}>{fraseCierre.txt}</div>}
        </div>
      </div>

      {/* FACTURACIÓN POR DÍA (2/3) + TICKET MEDIO (1/3) */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>
        <div style={card}>
          <div style={eyebrow(CREMA)}>Facturación · {periodo === 'semana' ? 'por día' : periodo === 'mes' ? 'por semana' : 'por mes'}</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: periodo === 'anio' ? 6 : 12, paddingTop: SOBRE + 18, marginTop: 8 }}>
            {seg.map((s, i) => {
              const sinObj = s.obj === 0
              const p = !sinObj && s.real != null ? (s.real / s.obj) * 100 : 0
              const rell = sinObj ? (s.real != null ? Math.min((s.real / Math.max(...seg.map(x => x.real || 0), 1)) * 100, 100) : 0) : Math.min(p, 100)
              const supera = !sinObj && s.real != null && s.real >= s.obj && s.obj > 0
              const colF = sinObj ? (s.dV == null ? GRIS : s.dV >= 0 ? VERDE : ROJO) : fill(p)
              const dif = s.real != null && s.hist != null ? s.real - s.hist : null
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontFamily: OSW, fontSize: periodo === 'anio' ? 13 : 16, fontWeight: 700, color: s.futuro ? GRIS : s.real != null ? INK : GRIS, height: 19, lineHeight: '19px' }}>{s.real != null ? nf0(s.real) : '—'}</span>
                  <div style={{ position: 'relative', width: '60%', height: BAR_H, marginTop: 2 }}>
                    {supera && <div style={{ position: 'absolute', top: -SOBRE, left: -4, right: -4, bottom: -4, border: `2px dashed ${VERDE}`, borderRadius: 0, pointerEvents: 'none' }} />}
                    {supera && <span style={{ position: 'absolute', top: -SOBRE + 2, left: 0, right: 0, textAlign: 'center', fontSize: 13, color: VERDE, fontWeight: 700 }}>⋯</span>}
                    <div style={{ position: 'absolute', inset: 0, background: s.futuro ? TRACK : ROJO, borderRadius: 0, border: BORDER_CARD, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', opacity: s.futuro ? 0.4 : 1 }}>
                      {!s.futuro && rell > 0 && <div style={{ width: '100%', height: `${rell}%`, background: colF, boxShadow: '2px 0 0 #140f08' }} />}
                    </div>
                  </div>
                  <span style={{ fontFamily: LEX, fontSize: periodo === 'anio' ? 10 : 12, color: s.esActual ? INK : GRIS, fontWeight: s.esActual ? 700 : 400, marginTop: 6, height: 15 }}>{s.nombre}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: colorDelta(s.dV), height: 17, lineHeight: '17px' }}>{s.dV != null ? `${s.dV >= 0 ? '▲' : '▼'}${Math.abs(s.dV).toFixed(0)}%` : ''}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: colorDelta(s.dV), height: 17, lineHeight: '17px' }}>{dif != null ? `${dif >= 0 ? '+' : '−'}${nf0(Math.abs(dif))}` : ''}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* TICKET MEDIO (estilo Resumen): actual naranja + comparado gris, por día */}
        <div style={card}>
          <div style={eyebrow(CREMA)}>Ticket medio</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginBottom: 16, flexWrap: 'wrap', marginTop: 12 }}>
            <div>
              <div style={{ fontFamily: OSW, fontSize: 32, fontWeight: 600, color: NARANJA_TM }}>{nf2(tm)}</div>
              <div style={{ fontFamily: OSW, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: NARANJA_TM, fontWeight: 500 }}>TM actual</div>
            </div>
            <div>
              <div style={{ fontFamily: OSW, fontSize: 32, fontWeight: 600, color: GRIS }}>{tmC > 0 ? nf2(tmC) : '—'}</div>
              <div style={{ fontFamily: OSW, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS, fontWeight: 500 }}>{labelComp}</div>
            </div>
            {dTM != null && <span style={{ fontFamily: LEX, fontSize: 16, fontWeight: 700, color: colorDelta(dTM) }}>{dTM >= 0 ? '▲ +' : '▼ '}{Math.abs(dTM).toFixed(1)}%</span>}
          </div>
          {seg.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ minWidth: 30, fontFamily: LEX, fontSize: 12, color: s.esActual ? INK : GRIS, fontWeight: s.esActual ? 700 : 400 }}>{s.nombre}</span>
              <div style={{ flex: 1, height: 10, background: TRACK, borderRadius: 0, border: BORDER_CARD }}>
                <div style={{ height: 10, width: `${Math.min(((s.tm || 0) / maxTM) * 100, 100)}%`, background: s.color, boxShadow: '2px 0 0 #140f08' }} />
              </div>
              <span style={{ minWidth: 48, textAlign: 'right', fontFamily: OSW, fontSize: 15, fontWeight: 600, color: s.tm != null ? NARANJA_TM : GRIS }}>{s.tm != null ? nf2(s.tm) : '—'}</span>
              <span style={{ minWidth: 48, textAlign: 'right', fontFamily: OSW, fontSize: 15, fontWeight: 600, color: GRIS }}>{s.tmH != null ? nf2(s.tmH) : '—'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CARDS POR CANAL: actual vs comparado enfrentados */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={eyebrow(CREMA)}>Por canal · vs {labelComp}</div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${canalPeriodo.length}, 1fr)`, gap: 10, marginTop: 12 }}>
          {canalPeriodo.map(c => (
            <div key={c.id} style={{ background: CORP[c.id] ?? c.color, border: BORDER_CARD, boxShadow: SHADOW, borderRadius: 0, padding: '16px 18px' }}>
              <div style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: CLARA[c.id] ? INK : '#fff', marginBottom: 6 }}>{c.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: OSW, fontSize: 28, fontWeight: 600, color: CLARA[c.id] ? INK : '#fff' }}>{nf2(c.b)}</span>
                <span style={{ fontFamily: OSW, fontSize: 28, fontWeight: 600, color: CLARA[c.id] ? 'rgba(20,15,8,0.5)' : 'rgba(255,255,255,0.5)' }}>{c.bc > 0 ? nf2(c.bc) : '—'}</span>
              </div>
              <div style={{ fontFamily: LEX, fontSize: 16, fontWeight: 700, color: colorDelta(c.delta), marginTop: 3, marginBottom: 12 }}>{c.delta == null ? 'sin comparativa' : `${c.delta >= 0 ? '▲ +' : '▼ '}${Math.abs(c.delta).toFixed(1)}%`}</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '4px 8px', alignItems: 'baseline' }}>
                <span style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1.2px', textTransform: 'uppercase', color: CLARA[c.id] ? INK : '#fff' }}>Pedidos</span>
                <span style={{ fontFamily: OSW, fontSize: 22, fontWeight: 600, color: CLARA[c.id] ? INK : '#fff', textAlign: 'right' }}>{nf0(c.ped)}</span>
                <span style={{ fontFamily: OSW, fontSize: 22, fontWeight: 500, color: CLARA[c.id] ? 'rgba(20,15,8,0.5)' : 'rgba(255,255,255,0.5)', textAlign: 'right', minWidth: 44 }}>{c.pedC > 0 ? nf0(c.pedC) : '—'}</span>

                <span style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1.2px', textTransform: 'uppercase', color: CLARA[c.id] ? INK : '#fff' }}>TM bruto</span>
                <span style={{ fontFamily: OSW, fontSize: 22, fontWeight: 600, color: CLARA[c.id] ? INK : '#fff', textAlign: 'right' }}>{nf2(c.tmBruto)}</span>
                <span style={{ fontFamily: OSW, fontSize: 22, fontWeight: 500, color: CLARA[c.id] ? 'rgba(20,15,8,0.5)' : 'rgba(255,255,255,0.5)', textAlign: 'right' }}>{c.tmBrutoC > 0 ? nf2(c.tmBrutoC) : '—'}</span>

                <span style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1.2px', textTransform: 'uppercase', color: CLARA[c.id] ? INK : '#fff' }}>TM neto</span>
                <span style={{ fontFamily: OSW, fontSize: 22, fontWeight: 600, color: CLARA[c.id] ? INK : '#fff', textAlign: 'right' }}>{nf2(c.tmNeto)}</span>
                <span style={{ fontFamily: OSW, fontSize: 22, fontWeight: 500, color: CLARA[c.id] ? 'rgba(20,15,8,0.5)' : 'rgba(255,255,255,0.5)', textAlign: 'right' }}>{c.tmNetoC > 0 ? nf2(c.tmNetoC) : '—'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* POSICIÓN EN EL CALENDARIO */}
      <div style={card}>
        <div style={eyebrow(CREMA)}>Posición en el calendario · por {unidad} · vs {labelComp}</div>
        {posCal == null ? (
          <div style={{ fontFamily: LEX, fontSize: 13, color: GRIS, marginTop: 8 }}>Aún no hay {unidadPl} con datos en este periodo.</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 12 }}>
              <div style={{ background: VERDE, border: BORDER_CARD, boxShadow: SHADOW, borderRadius: 0, padding: '14px 16px' }}>
                <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#fff', marginBottom: 6 }}>Mejor {unidad}</div>
                <div style={{ fontFamily: OSW, fontSize: 24, fontWeight: 600, color: '#fff' }}>{posCal.mejor.nombre}</div>
                <div style={{ fontFamily: OSW, fontSize: 18, fontWeight: 600, color: '#fff' }}>{nf0(posCal.mejor.real as number)}</div>
              </div>
              <div style={{ background: ROJO, border: BORDER_CARD, boxShadow: SHADOW, borderRadius: 0, padding: '14px 16px' }}>
                <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#fff', marginBottom: 6 }}>{unidad === 'día' ? 'Día' : unidad === 'semana' ? 'Semana' : 'Mes'} más flojo</div>
                <div style={{ fontFamily: OSW, fontSize: 24, fontWeight: 600, color: '#fff' }}>{posCal.peor.nombre}</div>
                <div style={{ fontFamily: OSW, fontSize: 18, fontWeight: 600, color: '#fff' }}>{nf0(posCal.peor.real as number)}</div>
              </div>
              <div style={{ background: NAR, border: BORDER_CARD, boxShadow: SHADOW, borderRadius: 0, padding: '14px 16px' }}>
                <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#fff', marginBottom: 6 }}>Media · {unidad}</div>
                <div style={{ fontFamily: OSW, fontSize: 24, fontWeight: 600, color: '#fff' }}>{nf0(posCal.media)}</div>
                <div style={{ fontFamily: LEX, fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{posCal.total} {posCal.total === 1 ? unidad : unidadPl} con datos</div>
              </div>
              <div style={{ background: AZUL, border: BORDER_CARD, boxShadow: SHADOW, borderRadius: 0, padding: '14px 16px' }}>
                <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#fff', marginBottom: 6 }}>Racha al alza</div>
                <div style={{ fontFamily: OSW, fontSize: 24, fontWeight: 600, color: '#fff' }}>{posCal.racha} {posCal.racha === 1 ? unidad : unidadPl}</div>
                <div style={{ fontFamily: LEX, fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{posCal.racha > 0 ? `por encima de ${labelComp}` : `sin racha vs ${labelComp}`}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 14, marginTop: 14, borderTop: `2px solid ${INK}` }}>
              <span style={{ fontFamily: OSW, fontSize: 'clamp(15px,2vw,18px)', fontWeight: 600, color: INK }}>
                {posCal.gap != null && posCal.mejor !== posCal.peor
                  ? `El ${unidad} fuerte (${posCal.mejor.nombre}) factura un ${posCal.gap.toFixed(0)}% más que el más flojo (${posCal.peor.nombre}).`
                  : `${posCal.mejor.nombre} es el ${unidad} con más facturación del tramo.`}
              </span>
              <span style={{ fontFamily: LEX, fontSize: 14, color: GRIS }}>
                {posCal.actual.esActual ? `${posCal.actual.nombre} en curso: nº ${posCal.rank} de ${posCal.total} ${posCal.total === 1 ? unidad : unidadPl}. ` : ''}
                {posCal.superan > 0 ? `${posCal.superan} ${posCal.superan === 1 ? unidad : unidadPl} ${posCal.superan === 1 ? 'supera' : 'superan'} objetivo.` : 'Ningún tramo supera objetivo todavía.'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* REPARTO DEL DÍA · ALMUERZO vs CENA */}
      <div style={{ ...card, marginTop: 14 }}>
        <div style={eyebrow(CREMA)}>Almuerzo vs cena · vs {labelComp}</div>

        {franja.act.tot === 0 ? (
          <div style={{ fontFamily: LEX, fontSize: 13, color: GRIS, marginTop: 8 }}>Sin desglose de almuerzo/cena en este tramo.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 12 }}>
            {([
              { key: 'alm', label: 'Almuerzo', col: NARANJA_TM, bruto: franja.act.alm, ped: franja.act.almPed, pct: franja.act.pctAlm, pctC: franja.cmp.pctAlm, d: franja.dAlm },
              { key: 'cenas', label: 'Cena', col: AZUL_PED, bruto: franja.act.cenas, ped: franja.act.cenasPed, pct: franja.act.pctCenas, pctC: franja.cmp.pctCenas, d: franja.dCenas },
            ] as const).map(f => (
              <div key={f.key} style={{ background: f.col, border: BORDER_CARD, boxShadow: SHADOW, borderRadius: 0, padding: '16px 18px' }}>
                <div style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#fff', marginBottom: 6 }}>{f.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontFamily: OSW, fontSize: 30, fontWeight: 600, color: '#fff' }}>{nf2(f.bruto)}</span>
                  <span style={{ fontFamily: OSW, fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{f.pct.toFixed(0)}%</span>
                </div>
                <div style={{ fontFamily: LEX, fontSize: 13, fontWeight: 600, color: colorDelta(f.d), marginTop: 3, marginBottom: 12 }}>{f.d == null ? 'sin comparativa' : `${f.d >= 0 ? '▲ +' : '▼ '}${Math.abs(f.d).toFixed(1)}% vs ${labelComp}`}</div>
                <div style={{ height: 10, background: 'rgba(255,255,255,0.3)', borderRadius: 0, border: `2px solid rgba(255,255,255,0.6)`, marginBottom: 6 }}>
                  <div style={{ height: 10, width: `${Math.min(f.pct, 100)}%`, background: '#fff', boxShadow: '2px 0 0 rgba(255,255,255,0.8)' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: LEX, fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
                  <span>{nf0(f.ped)} pedidos</span>
                  <span>{labelComp}: {f.pctC.toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {franja.dPctAlm != null && franja.act.tot > 0 && (
          <div style={{ fontFamily: OSW, fontSize: 'clamp(15px,2vw,18px)', fontWeight: 600, marginTop: 14, color: Math.abs(franja.dPctAlm) < 2 ? GRIS : franja.dPctAlm > 0 ? NARANJA_TM : AZUL_PED }}>
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
