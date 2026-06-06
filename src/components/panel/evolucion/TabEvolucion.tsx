import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import {
  useTheme,
  cardStyle,
  sectionLabelStyle,
  CANALES,
  tabActiveStyle,
  tabInactiveStyle,
  tabsContainerStyle,
} from '@/styles/tokens'

/* ════════════════════════════════════════════════════════════
   COLORES SEMÁFORO OBJETIVO (Evolución)
   rojo = lejos / verde = cumplido o superado
   ════════════════════════════════════════════════════════════ */
const C_VERDE = '#1D9E75'
const C_NARANJA = '#f5a623'
const C_ROJO = '#B01D23'
const C_GRIS = '#b8b2a6'

function colorObjetivo(real: number, obj: number): string {
  if (obj <= 0) return C_GRIS
  const pct = (real / obj) * 100
  if (pct >= 100) return C_VERDE
  if (pct >= 50) return C_NARANJA
  return C_ROJO
}

function colorDelta(pct: number | null): string {
  if (pct == null) return C_GRIS
  if (pct >= 0) return C_VERDE
  return C_ROJO
}

/* ════════════════════════════════════════════════════════════
   FECHAS
   ════════════════════════════════════════════════════════════ */
function toLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function parseLocal(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function mondayOf(d: Date): Date {
  const dow = d.getDay() || 7
  const mon = new Date(d)
  mon.setDate(d.getDate() - dow + 1)
  return mon
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(d.getDate() + n)
  return r
}
// Ordinal del día de la semana dentro del mes (1..5): "Nº X miércoles del mes"
function nthWeekdayOfMonth(d: Date): number {
  return Math.floor((d.getDate() - 1) / 7) + 1
}
// Semana del mes (1..5)
function weekOfMonth(d: Date): number {
  return Math.ceil(d.getDate() / 7)
}
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DIAS_LARGO = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

/* ════════════════════════════════════════════════════════════
   TIPOS
   ════════════════════════════════════════════════════════════ */
interface Row {
  fecha: string
  uber_pedidos: number; uber_bruto: number
  glovo_pedidos: number; glovo_bruto: number
  je_pedidos: number; je_bruto: number
  web_pedidos: number; web_bruto: number
  directa_pedidos: number; directa_bruto: number
  total_pedidos: number; total_bruto: number
}

type Metrica = 'fact' | 'ped' | 'tm'
type Comparar = 'semana' | 'mes' | 'anio'

interface Props {
  fechaDesde: Date
  fechaHasta: Date
  canalesFiltro: string[]
}

const SELECT =
  'fecha,uber_pedidos,uber_bruto,glovo_pedidos,glovo_bruto,je_pedidos,je_bruto,web_pedidos,web_bruto,directa_pedidos,directa_bruto,total_pedidos,total_bruto'

/* Suma de bruto/pedidos respetando filtro de canales */
function brutoDe(r: Row, filtro: string[]): number {
  if (filtro.length === 0) return r.total_bruto || 0
  return filtro.reduce((a, id) => {
    const c = CANALES.find(x => x.id === id)
    return a + (c ? Number(r[c.bruKey as keyof Row] || 0) : 0)
  }, 0)
}
function pedidosDe(r: Row, filtro: string[]): number {
  if (filtro.length === 0) return r.total_pedidos || 0
  return filtro.reduce((a, id) => {
    const c = CANALES.find(x => x.id === id)
    return a + (c ? Number(r[c.pedKey as keyof Row] || 0) : 0)
  }, 0)
}

export default function TabEvolucion({ fechaDesde, canalesFiltro }: Props) {
  const { T } = useTheme()
  const [data, setData] = useState<Row[]>([])
  const [objDiario, setObjDiario] = useState(700)
  const [loading, setLoading] = useState(true)
  const [metrica, setMetrica] = useState<Metrica>('fact')
  const [comparar, setComparar] = useState<Comparar>('semana')

  useEffect(() => {
    let cancel = false
    ;(async () => {
      const { data: rows } = await supabase
        .from('facturacion_diario')
        .select(SELECT)
        .order('fecha', { ascending: true })
      if (!cancel) {
        setData((rows as Row[]) ?? [])
        setLoading(false)
      }
    })()
    supabase.from('objetivos').select('tipo,importe').eq('tipo', 'diario').then(({ data: o }) => {
      if (o && o[0]) setObjDiario(Number((o[0] as { importe: number }).importe) || 700)
    })
    return () => { cancel = true }
  }, [])

  // mapa fecha -> row para acceso rápido
  const byFecha = useMemo(() => {
    const m = new Map<string, Row>()
    for (const r of data) m.set(r.fecha, r)
    return m
  }, [data])

  const valDia = (fecha: string, met: Metrica): number | null => {
    const r = byFecha.get(fecha)
    if (!r) return null
    const b = brutoDe(r, canalesFiltro)
    const p = pedidosDe(r, canalesFiltro)
    if (met === 'fact') return b
    if (met === 'ped') return p
    return p > 0 ? b / p : 0
  }

  const sumaRango = (ini: Date, fin: Date, met: Metrica): { val: number | null; conDatos: boolean } => {
    let b = 0, p = 0, hay = false
    for (let d = new Date(ini); d <= fin; d = addDays(d, 1)) {
      const r = byFecha.get(toLocal(d))
      if (r) { hay = true; b += brutoDe(r, canalesFiltro); p += pedidosDe(r, canalesFiltro) }
    }
    if (!hay) return { val: null, conDatos: false }
    if (met === 'fact') return { val: b, conDatos: true }
    if (met === 'ped') return { val: p, conDatos: true }
    return { val: p > 0 ? b / p : 0, conDatos: true }
  }

  // Semana en curso (lunes de la fecha seleccionada arriba)
  const lunes = useMemo(() => mondayOf(fechaDesde), [fechaDesde])
  const domingo = useMemo(() => addDays(lunes, 6), [lunes])
  const hoyStr = toLocal(new Date())

  // Desplazamiento para la comparación elegida
  const shift = (d: Date): Date => {
    if (comparar === 'semana') return addDays(d, -7)
    if (comparar === 'mes') {
      const r = new Date(d); r.setMonth(d.getMonth() - 1); return r
    }
    const r = new Date(d); r.setFullYear(d.getFullYear() - 1); return r
  }
  const labelComp = comparar === 'semana' ? 'semana anterior' : comparar === 'mes' ? 'mes anterior' : 'año anterior'

  /* ── Barras de la semana (L-D) ── */
  const barras = useMemo(() => {
    return DIAS.map((nombre, i) => {
      const dia = addDays(lunes, i)
      const fecha = toLocal(dia)
      const real = valDia(fecha, 'fact')
      const hist = valDia(toLocal(shift(dia)), 'fact')
      const futuro = fecha > hoyStr
      const deltaPct = real != null && hist != null && hist > 0 ? ((real - hist) / hist) * 100 : null
      return { nombre, fecha, real, hist, futuro, deltaPct, esHoy: fecha === hoyStr }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lunes, byFecha, canalesFiltro, comparar, objDiario])

  const totalSemana = useMemo(() => barras.reduce((a, b) => a + (b.real || 0), 0), [barras])
  const objSemana = objDiario * 7
  const escala = useMemo(() => {
    const maxReal = Math.max(...barras.map(b => b.real || 0), objDiario)
    return maxReal * 1.18
  }, [barras, objDiario])

  /* ── Titular dinámico ── */
  const titular = useMemo(() => {
    const ini = lunes, fin = domingo
    const actual = sumaRango(ini, fin, 'fact')
    const prev = sumaRango(shift(ini), shift(fin), 'fact')
    const pct = actual.val != null && prev.val != null && prev.val > 0
      ? ((actual.val - prev.val) / prev.val) * 100 : null
    const cumplObj = objSemana > 0 ? (totalSemana / objSemana) * 100 : 0
    const diasConDatos = barras.filter(b => b.real != null && !b.futuro).length
    const diasRestantes = 7 - barras.filter(b => !b.futuro).length
    const faltaObj = Math.max(objSemana - totalSemana, 0)

    let big: { txt: string; pct: number | null }
    if (pct != null) big = { txt: `EL NEGOCIO VA`, pct }
    else big = { txt: `SEMANA EN CURSO`, pct: null }

    const frases: { txt: string; color: string }[] = []
    frases.push({
      txt: `Llevas ${fmtEur(totalSemana)} esta semana en ${diasConDatos} día${diasConDatos === 1 ? '' : 's'}.`,
      color: T.sec,
    })
    if (cumplObj >= 100) {
      frases.push({ txt: `Objetivo semanal SUPERADO (${cumplObj.toFixed(0)}% de ${fmtEur(objSemana)}).`, color: C_VERDE })
    } else if (diasRestantes > 0) {
      frases.push({
        txt: `Faltan ${fmtEur(faltaObj)} para el objetivo (${fmtEur(objSemana)}) en ${diasRestantes} día${diasRestantes === 1 ? '' : 's'}.`,
        color: cumplObj >= 50 ? C_NARANJA : C_ROJO,
      })
    } else {
      frases.push({ txt: `Semana cerrada al ${cumplObj.toFixed(0)}% del objetivo.`, color: colorObjetivo(totalSemana, objSemana) })
    }
    if (pct != null) {
      frases.push({
        txt: `${pct >= 0 ? 'Por encima' : 'Por debajo'} de la ${labelComp}: ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%.`,
        color: colorDelta(pct),
      })
    } else {
      frases.push({ txt: `Sin histórico de la ${labelComp} para comparar.`, color: C_GRIS })
    }
    return { big, frases }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barras, totalSemana, objSemana, comparar, T])

  /* ── Comparativas por posición de calendario ── */
  const compCalendario = useMemo(() => {
    const hoyD = new Date()
    const wdIdx = (hoyD.getDay() + 6) % 7
    const nth = nthWeekdayOfMonth(hoyD)
    const wom = weekOfMonth(hoyD)
    const hoyVal = valDia(hoyStr, metrica)

    // Mismo ordinal de weekday en mes/año anterior
    const buscarNth = (anios: number, meses: number): number | null => {
      const target = new Date(hoyD); target.setFullYear(hoyD.getFullYear() - anios); target.setMonth(hoyD.getMonth() - meses)
      const first = new Date(target.getFullYear(), target.getMonth(), 1)
      const firstWd = (first.getDay() + 6) % 7
      const day = 1 + ((wdIdx - firstWd + 7) % 7) + (nth - 1) * 7
      const dim = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
      if (day > dim) return null
      return valDia(toLocal(new Date(target.getFullYear(), target.getMonth(), day)), metrica)
    }

    // Media histórica de ese weekday
    const mismosWd = data.filter(r => ((parseLocal(r.fecha).getDay() + 6) % 7) === wdIdx)
    const mediaWd = mismosWd.length
      ? mismosWd.reduce((a, r) => {
          const v = metrica === 'fact' ? brutoDe(r, canalesFiltro)
            : metrica === 'ped' ? pedidosDe(r, canalesFiltro)
            : (pedidosDe(r, canalesFiltro) > 0 ? brutoDe(r, canalesFiltro) / pedidosDe(r, canalesFiltro) : 0)
          return a + v
        }, 0) / mismosWd.length
      : null

    return {
      etiqueta: `${nth}º ${DIAS_LARGO[wdIdx]} del mes · semana ${wom} del mes`,
      hoyVal,
      mesAnterior: buscarNth(0, 1),
      anioAnterior: buscarNth(1, 0),
      mediaWd,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, byFecha, metrica, canalesFiltro])

  /* ── Desglose por plataforma (semana actual vs comparación) ── */
  const plataformas = useMemo(() => {
    return CANALES.map(c => {
      let bAct = 0, pAct = 0, bPrev = 0, pPrev = 0, hayPrev = false
      for (let i = 0; i < 7; i++) {
        const dia = addDays(lunes, i)
        const r = byFecha.get(toLocal(dia))
        if (r) { bAct += Number(r[c.bruKey as keyof Row] || 0); pAct += Number(r[c.pedKey as keyof Row] || 0) }
        const rp = byFecha.get(toLocal(shift(dia)))
        if (rp) { hayPrev = true; bPrev += Number(rp[c.bruKey as keyof Row] || 0); pPrev += Number(rp[c.pedKey as keyof Row] || 0) }
      }
      const tmAct = pAct > 0 ? bAct / pAct : 0
      const val = metrica === 'fact' ? bAct : metrica === 'ped' ? pAct : tmAct
      const valPrev = metrica === 'fact' ? bPrev : metrica === 'ped' ? pPrev : (pPrev > 0 ? bPrev / pPrev : 0)
      const deltaPct = hayPrev && valPrev > 0 ? ((val - valPrev) / valPrev) * 100 : null
      return { id: c.id, label: c.label, color: c.color, val, deltaPct }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lunes, byFecha, comparar, metrica, canalesFiltro])

  const fmtMetrica = (v: number | null, met: Metrica = metrica): string => {
    if (v == null) return '—'
    if (met === 'ped') return Math.round(v).toLocaleString('es-ES')
    return fmtEur(v)
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div className="h-6 w-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const metricaTabs: { id: Metrica; label: string }[] = [
    { id: 'fact', label: 'Facturación' },
    { id: 'ped', label: 'Pedidos' },
    { id: 'tm', label: 'Ticket medio' },
  ]
  const compararTabs: { id: Comparar; label: string }[] = [
    { id: 'semana', label: 'vs semana ant.' },
    { id: 'mes', label: 'vs mes ant.' },
    { id: 'anio', label: 'vs año ant.' },
  ]

  return (
    <div style={{ padding: '4px 0 8px' }}>

      {/* ───── TITULAR DINÁMICO ───── */}
      <div style={{ ...cardStyle(T), marginBottom: 18, padding: '20px 22px' }}>
        <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 'clamp(26px,4vw,40px)', fontWeight: 600, lineHeight: 1.05, color: T.pri, letterSpacing: '0.5px' }}>
          {titular.big.txt}{' '}
          {titular.big.pct != null && (
            <span style={{ color: colorDelta(titular.big.pct), background: `${colorDelta(titular.big.pct)}22`, padding: '0 8px', borderRadius: 6 }}>
              {titular.big.pct >= 0 ? '+' : ''}{titular.big.pct.toFixed(1)}%
            </span>
          )}{' '}
          {titular.big.pct != null && <span>VS {labelComp.toUpperCase()}.</span>}
        </div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {titular.frases.map((f, i) => (
            <div key={i} style={{ fontFamily: 'Lexend,sans-serif', fontSize: 14, color: f.color, fontWeight: 500 }}>{f.txt}</div>
          ))}
        </div>
      </div>

      {/* ───── CARD GRANDE SEMANAL (objetivo + semáforo) ───── */}
      <div style={{ ...cardStyle(T), marginBottom: 18, padding: '18px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <div style={sectionLabelStyle(T)}>Facturación semana · {toLocal(lunes).slice(8)}/{toLocal(lunes).slice(5,7)} — {toLocal(domingo).slice(8)}/{toLocal(domingo).slice(5,7)}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontFamily: 'Oswald,sans-serif', fontSize: 30, fontWeight: 600, color: colorObjetivo(totalSemana, objSemana) }}>{fmtEur(totalSemana)}</span>
            <span style={{ fontFamily: 'Lexend,sans-serif', fontSize: 12, color: T.mut }}>obj {fmtEur(objSemana)}</span>
          </div>
        </div>

        {/* Barras */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 200, position: 'relative' }}>
          {/* línea objetivo diario */}
          {(() => {
            const yObj = Math.min((objDiario / escala) * 170, 170)
            return (
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 36 + yObj, height: 0, borderTop: `1.5px dashed ${C_ROJO}`, opacity: 0.5, pointerEvents: 'none' }}>
                <span style={{ position: 'absolute', right: 0, top: -14, fontSize: 9, color: C_ROJO, fontFamily: 'Oswald,sans-serif', letterSpacing: '0.5px' }}>OBJ {fmtEur(objDiario).replace(' €','')}</span>
              </div>
            )
          })()}
          {barras.map((b, i) => {
            const h = b.real != null ? Math.max((b.real / escala) * 170, 3) : 0
            const col = b.futuro ? C_GRIS : b.real != null ? colorObjetivo(b.real, objDiario) : C_GRIS
            const superado = b.real != null && b.real > objDiario
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                {/* valor */}
                <span style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, color: b.real != null ? col : T.mut, fontWeight: 600 }}>
                  {b.real != null ? fmtEur(b.real).replace(' €', '') : '—'}
                </span>
                {/* delta vs histórico */}
                {b.deltaPct != null && (
                  <span style={{ fontSize: 9, color: colorDelta(b.deltaPct), fontFamily: 'Lexend,sans-serif' }}>
                    {b.deltaPct >= 0 ? '▲' : '▼'}{Math.abs(b.deltaPct).toFixed(0)}%
                  </span>
                )}
                {/* superado */}
                {superado && <span style={{ fontSize: 10, color: C_VERDE, lineHeight: 0.6 }}>⋯</span>}
                {/* barra */}
                <div style={{
                  width: '70%', height: h,
                  background: b.futuro ? `repeating-linear-gradient(45deg, ${C_GRIS}33, ${C_GRIS}33 4px, transparent 4px, transparent 8px)` : col,
                  borderRadius: '4px 4px 0 0',
                  border: b.futuro ? `1px dashed ${C_GRIS}` : 'none',
                  boxShadow: superado ? `0 0 0 2px ${C_VERDE}33` : 'none',
                }} />
                {/* día */}
                <span style={{ fontFamily: 'Lexend,sans-serif', fontSize: 11, color: b.esHoy ? T.pri : T.mut, fontWeight: b.esHoy ? 700 : 400, height: 16 }}>{b.nombre}</span>
              </div>
            )
          })}
        </div>
        <div style={{ fontSize: 10, color: T.mut, marginTop: 8, fontFamily: 'Lexend,sans-serif' }}>
          Color = % del objetivo diario · ▲▼ = vs mismo día {labelComp} · rayado = día futuro · ⋯ = objetivo superado
        </div>
      </div>

      {/* ───── SELECTORES MÉTRICA + COMPARACIÓN ───── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div style={tabsContainerStyle()}>
          {metricaTabs.map(t => (
            <button key={t.id} onClick={() => setMetrica(t.id)} style={metrica === t.id ? tabActiveStyle(false) : tabInactiveStyle(T)}>{t.label}</button>
          ))}
        </div>
        <div style={tabsContainerStyle()}>
          {compararTabs.map(t => (
            <button key={t.id} onClick={() => setComparar(t.id)} style={comparar === t.id ? tabActiveStyle(false) : tabInactiveStyle(T)}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* ───── COMPARATIVA POSICIÓN DE CALENDARIO ───── */}
      <div style={{ ...cardStyle(T), marginBottom: 14 }}>
        <div style={{ ...sectionLabelStyle(T), marginBottom: 4 }}>Hoy por posición de calendario</div>
        <div style={{ fontSize: 11, color: T.mut, fontFamily: 'Lexend,sans-serif', marginBottom: 14 }}>{compCalendario.etiqueta}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
          {[
            { lbl: 'Hoy', val: compCalendario.hoyVal, base: null as number | null },
            { lbl: 'Mismo día mes ant.', val: compCalendario.mesAnterior, base: compCalendario.hoyVal },
            { lbl: 'Mismo día año ant.', val: compCalendario.anioAnterior, base: compCalendario.hoyVal },
            { lbl: `Media ${DIAS_LARGO[(new Date().getDay()+6)%7]}`, val: compCalendario.mediaWd, base: compCalendario.hoyVal },
          ].map((c, i) => {
            const delta = c.base != null && c.val != null && c.val > 0 ? ((c.base - c.val) / c.val) * 100 : null
            return (
              <div key={i} style={{ border: `0.5px solid ${T.brd}`, borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: T.mut, fontFamily: 'Oswald,sans-serif', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{c.lbl}</div>
                <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 20, fontWeight: 600, color: c.val == null ? C_GRIS : T.pri, marginTop: 4 }}>{fmtMetrica(c.val)}</div>
                {delta != null && i > 0 && (
                  <div style={{ fontSize: 11, color: colorDelta(delta), fontFamily: 'Lexend,sans-serif', marginTop: 2 }}>
                    {delta >= 0 ? '▲ +' : '▼ '}{delta.toFixed(1)}% hoy
                  </div>
                )}
                {c.val == null && i > 0 && <div style={{ fontSize: 10, color: C_GRIS, marginTop: 2 }}>sin histórico</div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* ───── DESGLOSE POR PLATAFORMA ───── */}
      <div style={cardStyle(T)}>
        <div style={{ ...sectionLabelStyle(T), marginBottom: 12 }}>
          {metricaTabs.find(t => t.id === metrica)?.label} por plataforma · semana vs {labelComp}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {plataformas.map(p => {
            const max = Math.max(...plataformas.map(x => x.val || 0), 1)
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ minWidth: 78, fontFamily: 'Lexend,sans-serif', fontSize: 12, color: T.sec }}>{p.label}</span>
                <div style={{ flex: 1, height: 8, background: T.brd, borderRadius: 4, position: 'relative' }}>
                  <div style={{ height: 8, width: `${Math.min((p.val / max) * 100, 100)}%`, background: p.id === 'glovo' ? '#c9d400' : p.color, borderRadius: 4 }} />
                </div>
                <span style={{ minWidth: 78, textAlign: 'right', fontFamily: 'Oswald,sans-serif', fontSize: 13, fontWeight: 600, color: T.pri }}>{fmtMetrica(p.val)}</span>
                <span style={{ minWidth: 64, textAlign: 'right', fontFamily: 'Lexend,sans-serif', fontSize: 11, color: colorDelta(p.deltaPct) }}>
                  {p.deltaPct == null ? '—' : `${p.deltaPct >= 0 ? '▲+' : '▼'}${Math.abs(p.deltaPct).toFixed(0)}%`}
                </span>
              </div>
            )
          })}
        </div>
        <div style={{ fontSize: 10, color: T.mut, marginTop: 10, fontFamily: 'Lexend,sans-serif' }}>
          Δ = variación vs misma semana del periodo anterior. Sin histórico → gris.
        </div>
      </div>

    </div>
  )
}
