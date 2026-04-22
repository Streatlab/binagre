import { useMemo, type CSSProperties } from 'react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { fmtEur } from '@/utils/format'
import { useTheme, FONT } from '@/styles/tokens'
import type { Movimiento, Categoria } from '@/types/conciliacion'

type Periodo = 'mes' | 'mes_anterior' | '30d' | 'trimestre' | 'anio' | 'personalizado'

interface Props {
  movimientos: Movimiento[]
  categorias: Categoria[]
  periodo: Periodo
  setPeriodo: (p: Periodo) => void
}

const ACCENT_RED = '#B01D23'
const OK_GREEN = '#1D9E75'
const ERR_RED = '#A32D2D'

const CANAL_COLOR: Record<string, string> = {
  'Uber Eats': '#06C167',
  'Glovo':     '#FFC244',
  'Just Eat':  '#F59E0B',
  'Web':       '#B01D23',
  'Directa':   '#6BA4E8',
}

const CATEGORIA_COLOR: Record<string, string> = {
  'RRHH':         '#B01D23',
  'Proveedores':  '#D85A30',
  'Alquiler':     '#F59E0B',
  'Suministros':  '#7F77DD',
  'Marketing':    '#D4537E',
  'Otros':        '#888780',
}

const paletaPresupuesto: Record<string, { bg: string; border: string; text: string; subtext: string; valor: string; barra: string }> = {
  compras:     { bg: '#EAF3DE', border: '#C0DD97', text: '#173404', subtext: '#3B6D11', valor: '#1D9E75', barra: '#1D9E75' },
  rrhh:        { bg: '#FAEEDA', border: '#FAC775', text: '#412402', subtext: '#854F0B', valor: '#BA7517', barra: '#BA7517' },
  marketing:   { bg: '#FBEAF0', border: '#F4C0D1', text: '#4B1528', subtext: '#993556', valor: '#D4537E', barra: '#D4537E' },
  suministros: { bg: '#FAECE7', border: '#F5C4B3', text: '#4A1B0C', subtext: '#993C1D', valor: '#D85A30', barra: '#D85A30' },
}

const presupuestosMock = [
  { categoria: 'compras',     nombre: 'Compras',     consumido: 4448, tope: 6000 },
  { categoria: 'rrhh',        nombre: 'RRHH',        consumido: 4850, tope: 5000 },
  { categoria: 'marketing',   nombre: 'Marketing',   consumido:  530, tope: 1000 },
  { categoria: 'suministros', nombre: 'Suministros', consumido: 1028, tope: 1000 },
]

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

function fmtISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function calcRangos(periodo: Periodo): { actual: { ini: string; fin: string }; prev: { ini: string; fin: string } } {
  const hoy = new Date()
  let iniA: Date, finA: Date, iniP: Date, finP: Date

  if (periodo === 'mes') {
    iniA = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    finA = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
    iniP = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
    finP = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
  } else if (periodo === 'mes_anterior') {
    iniA = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
    finA = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
    iniP = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1)
    finP = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 0)
  } else if (periodo === '30d') {
    finA = new Date(hoy)
    iniA = new Date(hoy); iniA.setDate(hoy.getDate() - 29)
    finP = new Date(iniA); finP.setDate(finP.getDate() - 1)
    iniP = new Date(finP); iniP.setDate(iniP.getDate() - 29)
  } else if (periodo === 'trimestre') {
    finA = new Date(hoy)
    iniA = new Date(hoy); iniA.setMonth(hoy.getMonth() - 3)
    finP = new Date(iniA); finP.setDate(finP.getDate() - 1)
    iniP = new Date(finP); iniP.setMonth(iniP.getMonth() - 3)
  } else if (periodo === 'anio') {
    iniA = new Date(hoy.getFullYear(), 0, 1)
    finA = new Date(hoy)
    iniP = new Date(hoy.getFullYear() - 1, 0, 1)
    finP = new Date(hoy.getFullYear() - 1, hoy.getMonth(), hoy.getDate())
  } else {
    finA = new Date(hoy)
    iniA = new Date(hoy); iniA.setDate(hoy.getDate() - 29)
    finP = new Date(iniA); finP.setDate(finP.getDate() - 1)
    iniP = new Date(finP); iniP.setDate(iniP.getDate() - 29)
  }

  return {
    actual: { ini: fmtISO(iniA), fin: fmtISO(finA) },
    prev:   { ini: fmtISO(iniP), fin: fmtISO(finP) },
  }
}

function rangoLegible(ini: string, fin: string): string {
  const d1 = new Date(ini + 'T12:00:00')
  const d2 = new Date(fin + 'T12:00:00')
  const sameYear = d1.getFullYear() === d2.getFullYear()
  const sameMonth = sameYear && d1.getMonth() === d2.getMonth()
  const opts1: Intl.DateTimeFormatOptions = sameMonth
    ? { day: 'numeric' }
    : sameYear
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' }
  const opts2: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
  return `${d1.toLocaleDateString('es-ES', opts1)} — ${d2.toLocaleDateString('es-ES', opts2)}`
}

function detectarCanal(contraparte: string): string {
  const n = contraparte.toLowerCase()
  if (n.includes('uber')) return 'Uber Eats'
  if (n.includes('glovo')) return 'Glovo'
  if (n.includes('just eat') || n.includes('justeat')) return 'Just Eat'
  if (n.includes('rushour') || n.includes('web')) return 'Web'
  return 'Directa'
}

function agruparPorCanal(movs: Movimiento[]) {
  const map = new Map<string, number>()
  movs.forEach(m => {
    const k = detectarCanal(m.contraparte)
    map.set(k, (map.get(k) ?? 0) + Math.abs(m.importe))
  })
  return Array.from(map.entries()).map(([canal, total]) => ({ canal, total }))
}

function agruparPorCategoria(movs: Movimiento[], categorias: Categoria[]) {
  const map = new Map<string, number>()
  movs.forEach(m => {
    const cat = categorias.find(c => c.id === m.categoria_id)?.nombre ?? 'Otros'
    map.set(cat, (map.get(cat) ?? 0) + Math.abs(m.importe))
  })
  return Array.from(map.entries()).map(([categoria, total]) => ({ categoria, total }))
}

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function calcularEstadoRatio(ratio: number): { label: string; bg: string; fg: string } {
  if (ratio >= 1.5)  return { label: 'Saludable', bg: '#EAF3DE', fg: '#3B6D11' }
  if (ratio >= 1.25) return { label: 'OK',        bg: '#EAF3DE', fg: '#3B6D11' }
  if (ratio >= 1.0)  return { label: 'Alerta',    bg: '#FAEEDA', fg: '#854F0B' }
  return                    { label: 'Crítico',   bg: '#FCEBEB', fg: '#A32D2D' }
}

function calcularPosicionIndicador(ratio: number): number {
  const pos = ((ratio - 0.5) / 1.5) * 100
  return Math.max(0, Math.min(100, pos))
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */

export function ResumenDashboard({ movimientos, categorias, periodo, setPeriodo }: Props) {
  const { T } = useTheme()

  const rangos = useMemo(() => calcRangos(periodo), [periodo])

  const movsActual = useMemo(
    () => movimientos.filter(m => m.fecha >= rangos.actual.ini && m.fecha <= rangos.actual.fin).sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [movimientos, rangos],
  )
  const movsPrev = useMemo(
    () => movimientos.filter(m => m.fecha >= rangos.prev.ini && m.fecha <= rangos.prev.fin),
    [movimientos, rangos],
  )

  const resumen = useMemo(() => {
    const ingresos = movsActual.filter(m => m.importe > 0)
    const gastos = movsActual.filter(m => m.importe < 0)
    const sumIng = ingresos.reduce((s, m) => s + m.importe, 0)
    const sumGst = Math.abs(gastos.reduce((s, m) => s + m.importe, 0))
    const balance = sumIng - sumGst
    const ratio = sumGst > 0 ? sumIng / sumGst : 0
    const porCanal = agruparPorCanal(ingresos).sort((a, b) => b.total - a.total)
    const porCategoria = agruparPorCategoria(gastos, categorias).sort((a, b) => b.total - a.total)
    return { ingresos, gastos, sumIng, sumGst, balance, ratio, porCanal, porCategoria }
  }, [movsActual, categorias])

  const resumenPrev = useMemo(() => {
    const ingresos = movsPrev.filter(m => m.importe > 0)
    const gastos = movsPrev.filter(m => m.importe < 0)
    const sumIng = ingresos.reduce((s, m) => s + m.importe, 0)
    const sumGst = Math.abs(gastos.reduce((s, m) => s + m.importe, 0))
    const balance = sumIng - sumGst
    const porCanal = new Map(agruparPorCanal(ingresos).map(x => [x.canal, x.total]))
    const porCategoria = new Map(agruparPorCategoria(gastos, categorias).map(x => [x.categoria, x.total]))
    return { sumIng, sumGst, balance, porCanal, porCategoria }
  }, [movsPrev, categorias])

  function calcVariacion(actual: number, anterior: number, esIngreso: boolean): { txt: string; color: string } {
    if (anterior === 0 && actual === 0) return { txt: '—', color: T.mut }
    if (anterior === 0) return { txt: 'Nuevo', color: OK_GREEN }
    const pct = ((actual - anterior) / anterior) * 100
    const signo = pct > 0 ? '▲' : pct < 0 ? '▼' : '='
    const favorable = esIngreso ? pct >= 0 : pct <= 0
    const color = pct === 0 ? T.mut : (favorable ? OK_GREEN : ACCENT_RED)
    return { txt: `${signo} ${Math.abs(Math.round(pct))}%`, color }
  }

  /* — Datos semanales para el BarChart — */
  const datosSemanales = useMemo(() => {
    const map = new Map<string, { ingresos: number; gastos: number; weekNum: number }>()
    movsActual.forEach(m => {
      const d = new Date(m.fecha + 'T12:00:00')
      const wn = getWeekNumber(d)
      const key = `S${wn}`
      const acc = map.get(key) ?? { ingresos: 0, gastos: 0, weekNum: wn }
      if (m.importe > 0) acc.ingresos += m.importe
      else acc.gastos += Math.abs(m.importe)
      map.set(key, acc)
    })
    return Array.from(map.entries())
      .map(([semana, v]) => ({ semana, ingresos: Math.round(v.ingresos), gastos: Math.round(v.gastos), weekNum: v.weekNum }))
      .sort((a, b) => a.weekNum - b.weekNum)
  }, [movsActual])

  /* — Evolución diaria Ingresos · Gastos · Saldo — */
  const datosEvolucion = useMemo(() => {
    const dias: { fecha: string; ingresos: number; gastos: number; saldo: number }[] = []
    const ini = new Date(rangos.actual.ini + 'T12:00:00')
    const fin = new Date(rangos.actual.fin + 'T12:00:00')
    let saldoAcum = 0
    const total = Math.ceil((fin.getTime() - ini.getTime()) / 86400000) + 1
    const step = total > 31 ? Math.ceil(total / 31) : 1
    for (let i = 0; i < total; i++) {
      const d = new Date(ini); d.setDate(ini.getDate() + i)
      const iso = fmtISO(d)
      const movsDia = movsActual.filter(m => m.fecha === iso)
      const ing = movsDia.filter(m => m.importe > 0).reduce((s, m) => s + m.importe, 0)
      const gst = Math.abs(movsDia.filter(m => m.importe < 0).reduce((s, m) => s + m.importe, 0))
      saldoAcum += ing - gst
      if (i % step === 0 || i === total - 1) {
        dias.push({
          fecha: d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
          ingresos: Math.round(ing),
          gastos: Math.round(gst),
          saldo: Math.round(saldoAcum),
        })
      }
    }
    return dias
  }, [movsActual, rangos])

  /* — Tesorería (valores mock basados en totales) — */
  const tesoreria = useMemo(() => {
    const cajaLiquida = 18500
    const cobrosPendientes = Math.round(resumen.sumIng * 0.18)
    const pagosPendientes = Math.round(resumen.sumGst * 0.22)
    const balanceDisp = cajaLiquida + cobrosPendientes - pagosPendientes
    const diasRango = Math.max(1, Math.ceil((new Date(rangos.actual.fin).getTime() - new Date(rangos.actual.ini).getTime()) / 86400000))
    const flujoDiario = (resumen.sumIng - resumen.sumGst) / diasRango
    return {
      cajaLiquida,
      cobrosPendientes,
      pagosPendientes,
      balanceDisp,
      proyeccion7d:  Math.round(balanceDisp + flujoDiario * 7),
      proyeccion30d: Math.round(balanceDisp + flujoDiario * 30),
    }
  }, [resumen, rangos])

  /* — Presupuestos (mock por ahora) — */
  const hoy = new Date()
  const nombreMes = hoy.toLocaleDateString('es-ES', { month: 'long' })
  const mesCap = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
  const diasRestantes = Math.max(0, Math.ceil((finMes.getTime() - hoy.getTime()) / 86400000))

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */

  const cardWrap: CSSProperties = {
    backgroundColor: T.card,
    borderRadius: 14,
    padding: '22px 24px',
    border: `1px solid ${T.brd}`,
  }

  const labelStyle: CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 11,
    color: T.mut,
    letterSpacing: '1.3px',
    textTransform: 'uppercase',
    marginBottom: 10,
  }

  const heroValue: CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 36,
    fontWeight: 500,
    color: T.pri,
    lineHeight: 1,
    letterSpacing: '-0.5px',
  }

  const divider: CSSProperties = { height: 1, backgroundColor: T.brd, margin: '16px 0' }

  const selectStyle: CSSProperties = {
    padding: '8px 14px',
    border: `1px solid ${T.brd}`,
    borderRadius: 8,
    backgroundColor: T.card,
    fontSize: 13,
    color: T.pri,
    fontFamily: FONT.body,
    cursor: 'pointer',
  }

  const estadoRatio = calcularEstadoRatio(resumen.ratio)
  const posIndicador = calcularPosicionIndicador(resumen.ratio)

  const deltaIng = calcVariacion(resumen.sumIng, resumenPrev.sumIng, true)
  const deltaGst = calcVariacion(resumen.sumGst, resumenPrev.sumGst, false)
  const deltaBal = calcVariacion(resumen.balance, resumenPrev.balance, true)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ═════ HEADER ═════ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{
          color: ACCENT_RED,
          fontFamily: FONT.heading,
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: '1px',
          margin: 0,
          textTransform: 'uppercase',
        }}>
          Resumen · Conciliación
        </h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: T.mut, fontFamily: FONT.body }}>{rangoLegible(rangos.actual.ini, rangos.actual.fin)}</span>
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)} style={selectStyle}>
            <option value="mes">Este mes</option>
            <option value="mes_anterior">Mes anterior</option>
            <option value="30d">Últimos 30 días</option>
            <option value="trimestre">Trimestre</option>
            <option value="anio">Año</option>
            <option value="personalizado">Personalizado</option>
          </select>
        </div>
      </div>

      {/* ═════ FILA 1: INGRESOS · GASTOS · TESORERÍA ═════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>

        {/* CARD INGRESOS */}
        <div style={cardWrap}>
          <div style={labelStyle}>Ingresos</div>
          <div style={heroValue}>{fmtEur(resumen.sumIng)}</div>
          <div style={{ fontFamily: FONT.body, fontSize: 12, color: deltaIng.color, marginTop: 4 }}>
            {deltaIng.txt} vs período anterior
          </div>
          <div style={divider} />
          {resumen.porCanal.length === 0 && (
            <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, padding: '6px 0' }}>Sin ingresos en este período</div>
          )}
          {resumen.porCanal.map(c => {
            const color = CANAL_COLOR[c.canal] ?? '#888'
            const prev = resumenPrev.porCanal.get(c.canal) ?? 0
            const dlt = calcVariacion(c.total, prev, true)
            const pct = resumen.sumIng > 0 ? Math.round((c.total / resumen.sumIng) * 100) : 0
            return (
              <div key={c.canal} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: FONT.body, fontSize: 13, color: T.pri }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, display: 'inline-block' }} />
                  {c.canal}
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri, fontWeight: 500, width: 82, textAlign: 'right' }}>{fmtEur(c.total)}</span>
                  <span style={{ fontFamily: FONT.heading, fontSize: 10, width: 48, textAlign: 'right', letterSpacing: '0.5px', color: dlt.color }}>{dlt.txt}</span>
                  <span style={{ fontFamily: FONT.heading, fontSize: 10, width: 42, textAlign: 'right', letterSpacing: '0.5px', color: T.mut }}>{pct}%</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* CARD GASTOS */}
        <div style={cardWrap}>
          <div style={labelStyle}>Gastos</div>
          <div style={heroValue}>{fmtEur(resumen.sumGst)}</div>
          <div style={{ fontFamily: FONT.body, fontSize: 12, color: deltaGst.color, marginTop: 4 }}>
            {deltaGst.txt} vs período anterior
          </div>
          <div style={divider} />
          {resumen.porCategoria.length === 0 && (
            <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, padding: '6px 0' }}>Sin gastos en este período</div>
          )}
          {resumen.porCategoria.map(c => {
            const color = CATEGORIA_COLOR[c.categoria] ?? CATEGORIA_COLOR.Otros
            const prev = resumenPrev.porCategoria.get(c.categoria) ?? 0
            const dlt = calcVariacion(c.total, prev, false)
            const pct = resumen.sumGst > 0 ? Math.round((c.total / resumen.sumGst) * 100) : 0
            return (
              <div key={c.categoria} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: FONT.body, fontSize: 13, color: T.pri }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color, display: 'inline-block' }} />
                  {c.categoria}
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri, fontWeight: 500, width: 82, textAlign: 'right' }}>{fmtEur(c.total)}</span>
                  <span style={{ fontFamily: FONT.heading, fontSize: 10, width: 48, textAlign: 'right', letterSpacing: '0.5px', color: dlt.color }}>{dlt.txt}</span>
                  <span style={{ fontFamily: FONT.heading, fontSize: 10, width: 42, textAlign: 'right', letterSpacing: '0.5px', color: T.mut }}>{pct}%</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* CARD TESORERÍA */}
        <div style={cardWrap}>
          <div style={labelStyle}>Tesorería · Hoy</div>
          <div style={heroValue}>{fmtEur(tesoreria.balanceDisp)}</div>
          <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, marginTop: 4 }}>Balance disponible</div>
          <div style={divider} />
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontFamily: FONT.body, fontSize: 13, color: T.pri }}>
            <span>Caja líquida</span>
            <span style={{ fontWeight: 500 }}>{fmtEur(tesoreria.cajaLiquida)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontFamily: FONT.body, fontSize: 13, color: OK_GREEN }}>
            <span>Cobros pendientes</span>
            <span style={{ fontWeight: 500 }}>+{fmtEur(tesoreria.cobrosPendientes)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontFamily: FONT.body, fontSize: 13, color: ACCENT_RED }}>
            <span>Pagos pendientes</span>
            <span style={{ fontWeight: 500 }}>−{fmtEur(tesoreria.pagosPendientes)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontFamily: FONT.body, fontSize: 13, color: T.pri }}>
            <span>Proyección 7d</span>
            <span style={{ fontWeight: 500 }}>{fmtEur(tesoreria.proyeccion7d)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontFamily: FONT.body, fontSize: 13, color: T.pri }}>
            <span>Proyección 30d</span>
            <span style={{ fontWeight: 500 }}>{fmtEur(tesoreria.proyeccion30d)}</span>
          </div>
        </div>
      </div>

      {/* ═════ FILA 2: RATIO + BALANCE NETO ═════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {/* CARD RATIO (2fr en desktop) */}
        <div style={{
          ...cardWrap,
          padding: '24px 30px',
          gridColumn: 'span 2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 30,
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={labelStyle}>Ratio Ingresos / Gastos</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
              <span style={{ fontFamily: FONT.heading, fontSize: 54, fontWeight: 500, color: T.pri, letterSpacing: '-1px', lineHeight: 1 }}>
                {resumen.ratio.toFixed(2)}
              </span>
              <span style={{
                backgroundColor: estadoRatio.bg,
                color: estadoRatio.fg,
                fontSize: 11,
                padding: '4px 12px',
                borderRadius: 12,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                fontFamily: FONT.heading,
              }}>
                {estadoRatio.label}
              </span>
            </div>
            <div style={{ fontSize: 12, color: T.mut, marginTop: 8, fontFamily: FONT.body }}>Objetivo ≥ 1.25</div>
          </div>
          <div style={{ flex: 1, minWidth: 240, maxWidth: 360 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.mut, marginBottom: 6, fontFamily: FONT.heading, letterSpacing: '0.8px' }}>
              <span>Crítico</span><span>Alerta</span><span>OK</span><span>Saludable</span>
            </div>
            <div style={{
              position: 'relative',
              height: 10,
              background: 'linear-gradient(to right, #F09595 0%, #F09595 25%, #FAC775 25%, #FAC775 50%, #C0DD97 50%, #C0DD97 75%, #5DCAA5 75%, #5DCAA5 100%)',
              borderRadius: 5,
            }}>
              <div style={{ position: 'absolute', left: `${posIndicador}%`, top: -4, width: 3, height: 18, backgroundColor: T.pri, borderRadius: 2, transform: 'translateX(-50%)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.mut, marginTop: 4, fontFamily: FONT.body }}>
              <span>0.5</span><span>1.0</span><span>1.25</span><span>2.0</span>
            </div>
          </div>
        </div>

        {/* CARD BALANCE NETO */}
        <div style={cardWrap}>
          <div style={labelStyle}>Balance neto</div>
          <div style={{ ...heroValue, color: resumen.balance >= 0 ? OK_GREEN : ACCENT_RED }}>
            {resumen.balance >= 0 ? '+' : ''}{fmtEur(resumen.balance)}
          </div>
          <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, marginTop: 4 }}>Ingresos − Gastos</div>
          <div style={divider} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontFamily: FONT.body, fontSize: 12, color: T.mut }}>
            <span>vs período anterior</span>
            <span style={{ color: deltaBal.color, fontWeight: 500, fontFamily: FONT.heading, letterSpacing: '0.5px' }}>{deltaBal.txt}</span>
          </div>
        </div>
      </div>

      {/* ═════ FILA 3: PRESUPUESTOS ═════ */}
      <div>
        <div style={{
          fontFamily: FONT.heading,
          fontSize: 12,
          color: T.pri,
          letterSpacing: '1.3px',
          textTransform: 'uppercase',
          marginBottom: 12,
        }}>
          Presupuestos · {mesCap} {hoy.getFullYear()} · {diasRestantes} días restantes
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {presupuestosMock.map(p => {
            const pal = paletaPresupuesto[p.categoria] ?? paletaPresupuesto.compras
            const pct = Math.round((p.consumido / p.tope) * 100)
            const superado = p.consumido > p.tope
            const pctDisplay = superado ? 100 : Math.min(100, pct)
            const colorBarra = superado ? ERR_RED : pal.barra

            return (
              <div key={p.categoria} style={{
                backgroundColor: pal.bg,
                borderRadius: 12,
                padding: '16px 18px',
                border: `1px solid ${pal.border}`,
              }}>
                <div style={{ fontFamily: FONT.heading, fontSize: 12, color: pal.text, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 500, marginBottom: 10 }}>
                  {p.nombre}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 500, color: pal.text }}>{fmtEur(p.consumido)}</span>
                  <span style={{ fontFamily: FONT.body, fontSize: 11, color: pal.subtext }}>bruto</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                  <span style={{ fontFamily: FONT.heading, fontSize: 18, fontWeight: 500, color: pal.valor }}>{fmtEur(p.tope)}</span>
                  <span style={{ fontFamily: FONT.body, fontSize: 11, color: pal.subtext }}>tope</span>
                </div>
                <div style={{ height: 1, backgroundColor: pal.border, margin: '10px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: FONT.body, fontSize: 11, color: pal.subtext }}>{superado ? 'Superado' : 'Consumido'}</span>
                  <span style={{ fontFamily: FONT.heading, fontSize: 13, fontWeight: 500, color: superado ? ERR_RED : pal.text }}>{pct}%</span>
                </div>
                <div style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${pctDisplay}%`, height: '100%', backgroundColor: colorBarra, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ═════ FILA 4: GRÁFICOS ═════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>

        {/* BARRAS SEMANALES */}
        <div style={cardWrap}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 11, color: T.mut, letterSpacing: '1.3px', textTransform: 'uppercase' }}>
              Ingresos vs Gastos · semanal
            </div>
            <div style={{ display: 'flex', gap: 10, fontSize: 10, fontFamily: FONT.body }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: T.mut }}>
                <span style={{ width: 10, height: 2, backgroundColor: '#06C167' }} />Ing
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: T.mut }}>
                <span style={{ width: 10, height: 2, backgroundColor: ACCENT_RED }} />Gst
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={datosSemanales} barGap={4} barCategoryGap="15%">
              <CartesianGrid strokeDasharray="3 3" stroke={T.brd} vertical={false} />
              <XAxis dataKey="semana" stroke={T.mut} tick={{ fontSize: 11, fill: T.mut, fontFamily: FONT.body }} />
              <YAxis stroke={T.mut} tick={{ fontSize: 11, fill: T.mut, fontFamily: FONT.body }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: T.card, border: `1px solid ${T.brd}`, color: T.pri, fontFamily: FONT.body, borderRadius: 8 }}
                formatter={(v) => fmtEur(Number(v))}
              />
              <Bar dataKey="ingresos" name="Ingresos" fill="#06C167" radius={[3, 3, 0, 0]} />
              <Bar dataKey="gastos" name="Gastos" fill={ACCENT_RED} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* EVOLUCIÓN 3 LÍNEAS */}
        <div style={cardWrap}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 11, color: T.mut, letterSpacing: '1.3px', textTransform: 'uppercase' }}>
              Evolución · Ingresos · Gastos · Saldo
            </div>
            <div style={{ display: 'flex', gap: 10, fontSize: 10, fontFamily: FONT.body }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: T.mut }}>
                <span style={{ width: 10, height: 2, backgroundColor: '#06C167' }} />Ing
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: T.mut }}>
                <span style={{ width: 10, height: 2, backgroundColor: ACCENT_RED }} />Gst
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: T.mut }}>
                <span style={{ width: 10, height: 2, backgroundColor: '#F59E0B' }} />Saldo
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={datosEvolucion}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.brd} />
              <XAxis dataKey="fecha" stroke={T.mut} tick={{ fontSize: 11, fill: T.mut, fontFamily: FONT.body }} interval="preserveStartEnd" />
              <YAxis stroke={T.mut} tick={{ fontSize: 11, fill: T.mut, fontFamily: FONT.body }} domain={['auto', 'auto']} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: T.card, border: `1px solid ${T.brd}`, color: T.pri, fontFamily: FONT.body, borderRadius: 8 }}
                formatter={(v) => fmtEur(Number(v))}
              />
              <ReferenceLine y={0} stroke={T.mut} strokeDasharray="4 4" />
              <Line type="linear" dataKey="ingresos" name="Ingresos" stroke="#06C167" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
              <Line type="linear" dataKey="gastos"   name="Gastos"   stroke={ACCENT_RED} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
              <Line type="linear" dataKey="saldo"    name="Saldo"    stroke="#F59E0B" strokeWidth={2.5} dot={false} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

      </div>

    </div>
  )
}
