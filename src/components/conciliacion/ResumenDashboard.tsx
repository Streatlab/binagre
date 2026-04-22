import { useMemo, type CSSProperties } from 'react'
import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts'
import { fmtEur } from '@/utils/format'
import { useTheme, FONT, kpiValueStyle } from '@/styles/tokens'
import type { Movimiento, Categoria } from '@/types/conciliacion'

/* ═══════════════════════════════════════════════════════════
   PROPS
   ═══════════════════════════════════════════════════════════ */

interface Props {
  movimientos: Movimiento[]
  movimientosAnterior: Movimiento[]
  categorias: Categoria[]
  periodoLabel: string
  mesNombre: string
  anio: number
  diasRestantes: number
}

/* ═══════════════════════════════════════════════════════════
   CONSTANTES DATOS
   ═══════════════════════════════════════════════════════════ */

const COLOR_CANAL: Record<string, string> = {
  'Uber Eats': '#06C167',
  'Glovo':     '#FFC244',
  'Just Eat':  '#F59E0B',
  'Web':       '#B01D23',
  'Directa':   '#6BA4E8',
}

const COLOR_CATEGORIA: Record<string, string> = {
  'RRHH':          '#B01D23',
  'Proveedores':   '#D85A30',
  'Alquiler':      '#F59E0B',
  'Suministros':   '#7F77DD',
  'Marketing':     '#D4537E',
  'Otros':         '#888780',
  'Sin categoría': '#888780',
}

const VERDE_OK   = '#1D9E75'
const ROJO       = '#A32D2D'
const ACCENT_RED = '#B01D23'

const PRESUPUESTOS = [
  { categoria: 'compras',     nombre: 'Compras',     consumido: 4448, tope: 6000 },
  { categoria: 'rrhh',        nombre: 'RRHH',        consumido: 4850, tope: 5000 },
  { categoria: 'marketing',   nombre: 'Marketing',   consumido:  530, tope: 1000 },
  { categoria: 'suministros', nombre: 'Suministros', consumido: 1028, tope: 1000 },
]

const PALETA_PRESUPUESTO: Record<string, { bg: string; border: string; text: string; subtext: string; valor: string; barra: string }> = {
  compras:     { bg: '#EAF3DE', border: '#C0DD97', text: '#173404', subtext: '#3B6D11', valor: '#1D9E75', barra: '#1D9E75' },
  rrhh:        { bg: '#FAEEDA', border: '#FAC775', text: '#412402', subtext: '#854F0B', valor: '#BA7517', barra: '#BA7517' },
  marketing:   { bg: '#FBEAF0', border: '#F4C0D1', text: '#4B1528', subtext: '#993556', valor: '#D4537E', barra: '#D4537E' },
  suministros: { bg: '#FAECE7', border: '#F5C4B3', text: '#4A1B0C', subtext: '#993C1D', valor: '#D85A30', barra: '#D85A30' },
}

/* — Mock período anterior coherente (FIX 6) — */
const MOCK_ANT = {
  canales: {
    'Uber Eats': 9000,
    'Glovo':     5600,
    'Just Eat':  3080,
    'Web':        315,
    'Directa':      0,
  } as Record<string, number>,
  categorias: {
    'RRHH':          4850,
    'Proveedores':   3320,
    'Alquiler':      2400,
    'Sin categoría':  400,
    'Suministros':    577,
    'Marketing':      390,
  } as Record<string, number>,
}

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

function detectarCanal(contraparte: string): string {
  const n = (contraparte || '').toLowerCase()
  if (n.includes('uber')) return 'Uber Eats'
  if (n.includes('glovo')) return 'Glovo'
  if (n.includes('just eat') || n.includes('justeat')) return 'Just Eat'
  if (n.includes('rushour') || n.includes('web') || n.includes('tienda')) return 'Web'
  return 'Directa'
}

function agruparPorCanal(movs: Movimiento[]): Record<string, number> {
  const map: Record<string, number> = {}
  movs.forEach(m => {
    const k = detectarCanal(m.contraparte)
    map[k] = (map[k] ?? 0) + Math.abs(m.importe)
  })
  return map
}

function agruparPorCategoria(movs: Movimiento[], categorias: Categoria[]): Record<string, number> {
  const map: Record<string, number> = {}
  movs.forEach(m => {
    const cat = categorias.find(c => c.id === m.categoria_id)?.nombre ?? 'Sin categoría'
    map[cat] = (map[cat] ?? 0) + Math.abs(m.importe)
  })
  return map
}

function getWeekNumber(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00')
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function calcularEstadoRatio(ratio: number) {
  if (ratio >= 1.5)  return { label: 'Saludable', bg: '#EAF3DE', fg: '#3B6D11' }
  if (ratio >= 1.25) return { label: 'OK',        bg: '#EAF3DE', fg: '#3B6D11' }
  if (ratio >= 1.0)  return { label: 'Alerta',    bg: '#FAEEDA', fg: '#854F0B' }
  return               { label: 'Crítico',   bg: '#FCEBEB', fg: '#A32D2D' }
}

function calcularPosicionIndicador(ratio: number): number {
  const pos = ((ratio - 0.5) / 1.5) * 100
  return Math.max(0, Math.min(100, pos))
}

function estadoPresupuesto(pct: number): { label: string; bg: string; fg: string } {
  if (pct > 100) return { label: 'Superado',  bg: '#FCEBEB', fg: '#A32D2D' }
  if (pct >= 90) return { label: 'Al límite', bg: '#FAEEDA', fg: '#854F0B' }
  if (pct >= 50) return { label: 'En ritmo',  bg: '#EAF3DE', fg: '#3B6D11' }
  return              { label: 'Holgado',   bg: '#E6F1FB', fg: '#0C447C' }
}

/* ═══════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════ */

export function ResumenDashboard({
  movimientos,
  movimientosAnterior,
  categorias,
  mesNombre,
  anio,
  diasRestantes,
}: Props) {
  const { T } = useTheme()

  /* — Datos período actual — */
  const datos = useMemo(() => {
    const ingresos = movimientos.filter(m => m.importe > 0)
    const gastos   = movimientos.filter(m => m.importe < 0)
    const sumIng = ingresos.reduce((s, m) => s + m.importe, 0)
    const sumGst = Math.abs(gastos.reduce((s, m) => s + m.importe, 0))
    const balance = sumIng - sumGst
    const ratio = sumGst > 0 ? sumIng / sumGst : 0
    return {
      ingresos, gastos, sumIng, sumGst, balance, ratio,
      porCanal: agruparPorCanal(ingresos),
      porCategoria: agruparPorCategoria(gastos, categorias),
    }
  }, [movimientos, categorias])

  /* — Datos período anterior: si llega data real la uso, si no uso MOCK coherente (FIX 6) — */
  const datosAnt = useMemo(() => {
    const tieneData = movimientosAnterior && movimientosAnterior.length > 0
    if (!tieneData) {
      const sumIng = Object.values(MOCK_ANT.canales).reduce((s, v) => s + v, 0)
      const sumGst = Object.values(MOCK_ANT.categorias).reduce((s, v) => s + v, 0)
      return {
        sumIng, sumGst,
        balance: sumIng - sumGst,
        porCanal: { ...MOCK_ANT.canales },
        porCategoria: { ...MOCK_ANT.categorias },
      }
    }
    const ingresos = movimientosAnterior.filter(m => m.importe > 0)
    const gastos   = movimientosAnterior.filter(m => m.importe < 0)
    const sumIng = ingresos.reduce((s, m) => s + m.importe, 0)
    const sumGst = Math.abs(gastos.reduce((s, m) => s + m.importe, 0))
    return {
      sumIng, sumGst, balance: sumIng - sumGst,
      porCanal: agruparPorCanal(ingresos),
      porCategoria: agruparPorCategoria(gastos, categorias),
    }
  }, [movimientosAnterior, categorias])

  /* — Helper variación — */
  const variacion = (actual: number, anterior: number, esIngreso: boolean): { txt: string; color: string } => {
    if (anterior === 0 && actual === 0) return { txt: '—', color: T.mut }
    if (anterior === 0) return { txt: 'Nuevo', color: VERDE_OK }
    const pct = ((actual - anterior) / anterior) * 100
    const pctRound = Math.round(pct)
    const signo = pctRound > 0 ? '▲' : pctRound < 0 ? '▼' : '='
    const favorable = esIngreso ? pct > 0 : pct < 0
    const color = pctRound === 0 ? T.mut : (favorable ? VERDE_OK : ACCENT_RED)
    return { txt: `${signo} ${Math.abs(pctRound)}%`, color }
  }

  /* — Filas Ingresos — */
  const filasIngresos = useMemo(() => {
    const canales = new Set([...Object.keys(datos.porCanal), ...Object.keys(datosAnt.porCanal)])
    return Array.from(canales)
      .filter(c => (datos.porCanal[c] ?? 0) > 0)
      .map(canal => ({
        canal,
        total: datos.porCanal[canal] ?? 0,
        pct: datos.sumIng > 0 ? Math.round(((datos.porCanal[canal] ?? 0) / datos.sumIng) * 100) : 0,
        variacion: variacion(datos.porCanal[canal] ?? 0, datosAnt.porCanal[canal] ?? 0, true),
        color: COLOR_CANAL[canal] ?? '#888',
      }))
      .sort((a, b) => b.total - a.total)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos, datosAnt])

  /* — Filas Gastos — */
  const filasGastos = useMemo(() => {
    const cats = new Set([...Object.keys(datos.porCategoria), ...Object.keys(datosAnt.porCategoria)])
    return Array.from(cats)
      .filter(c => (datos.porCategoria[c] ?? 0) > 0)
      .map(categoria => ({
        categoria,
        total: datos.porCategoria[categoria] ?? 0,
        pct: datos.sumGst > 0 ? Math.round(((datos.porCategoria[categoria] ?? 0) / datos.sumGst) * 100) : 0,
        variacion: variacion(datos.porCategoria[categoria] ?? 0, datosAnt.porCategoria[categoria] ?? 0, false),
        color: COLOR_CATEGORIA[categoria] ?? '#888',
      }))
      .sort((a, b) => b.total - a.total)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos, datosAnt])

  /* — Dataset semanas — */
  const datosSemanales = useMemo(() => {
    const semanas = new Map<number, { ingresos: number; gastos: number }>()
    movimientos.forEach(m => {
      const w = getWeekNumber(m.fecha)
      const acc = semanas.get(w) ?? { ingresos: 0, gastos: 0 }
      if (m.importe > 0) acc.ingresos += m.importe
      else acc.gastos += Math.abs(m.importe)
      semanas.set(w, acc)
    })
    return Array.from(semanas.entries())
      .map(([w, v]) => ({ semana: `S${w}`, ingresos: Math.round(v.ingresos), gastos: Math.round(v.gastos) }))
      .sort((a, b) => parseInt(a.semana.slice(1)) - parseInt(b.semana.slice(1)))
  }, [movimientos])

  /* — Dataset evolución 31 días — */
  const datosEvolucion = useMemo(() => {
    const hoy = new Date()
    hoy.setHours(12, 0, 0, 0)
    const dias: { fecha: string; ingresos: number; gastos: number; saldo: number }[] = []
    let saldoAcum = 0
    for (let i = 30; i >= 0; i--) {
      const d = new Date(hoy)
      d.setDate(d.getDate() - i)
      const y = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const iso = `${y}-${mm}-${dd}`
      const movsDia = movimientos.filter(m => m.fecha === iso)
      const ing = movsDia.filter(m => m.importe > 0).reduce((s, m) => s + m.importe, 0)
      const gst = Math.abs(movsDia.filter(m => m.importe < 0).reduce((s, m) => s + m.importe, 0))
      saldoAcum += ing - gst
      dias.push({
        fecha: d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
        ingresos: Math.round(ing),
        gastos: Math.round(gst),
        saldo: Math.round(saldoAcum),
      })
    }
    return dias
  }, [movimientos])

  /* — Tesorería (mock) — */
  const cajaLiquida = 12480
  const cobrosPendientes = 4820
  const pagosPendientes = 3150
  const balanceDisponible = cajaLiquida + cobrosPendientes - pagosPendientes
  const proy7d  = balanceDisponible + Math.round((datos.balance / 31) * 7)
  const proy30d = balanceDisponible + Math.round((datos.balance / 31) * 30)

  /* — Delta caja (FIX 7): balance hoy vs hace 30 días (mock fijo coherente) — */
  const balanceHace30d = 11800
  const varCaja = variacion(balanceDisponible, balanceHace30d, true)

  /* — Ratio — */
  const estadoRatio = calcularEstadoRatio(datos.ratio)
  const posicionIndicador = calcularPosicionIndicador(datos.ratio)
  const ratioAnt = datosAnt.sumGst > 0 ? datosAnt.sumIng / datosAnt.sumGst : 0
  const varRatio = variacion(datos.ratio, ratioAnt, true)

  /* — Variaciones totales — */
  const varIngTotal = variacion(datos.sumIng, datosAnt.sumIng, true)
  const varGstTotal = variacion(datos.sumGst, datosAnt.sumGst, false)
  const varBalance  = variacion(datos.balance, datosAnt.balance, true)

  /* — % proyección (para la barra de Tesorería) — */
  const porcentajeProyeccion = Math.max(0, Math.min(100, cajaLiquida > 0 ? (proy30d / cajaLiquida) * 100 : 100))

  /* — Ritmo diario presupuestos (FIX 11.2) — */
  const diasEnMes = new Date(anio, new Date().getMonth() + 1, 0).getDate()
  const diasTranscurridos = Math.max(1, diasEnMes - diasRestantes)

  /* ═══════════════════════════════════════════════════════════
     STYLES
     ═══════════════════════════════════════════════════════════ */

  const cardWrap: CSSProperties = {
    backgroundColor: T.card,
    borderRadius: 14,
    padding: '22px 24px',
    border: `1px solid ${T.brd}`,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  }

  const labelSection: CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 11,
    color: T.mut,
    letterSpacing: '1.3px',
    textTransform: 'uppercase',
    fontWeight: 500,
  }

  /* FIX 1 — copia EXACTA del número gigante del Dashboard */
  const STYLE_NUMERO_GIGANTE: CSSProperties = {
    ...kpiValueStyle(T),
    marginTop: 4,
  }

  const divider: CSSProperties = { height: 1, backgroundColor: T.brd, margin: '16px 0' }

  /* FIX 4 — rejilla fija para columnas importe / variación / pct */
  const FILA_COLS: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '90px 60px 40px',
    gap: 12,
    alignItems: 'center',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ═══ FILA 1 — INGRESOS · GASTOS · TESORERÍA ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, alignItems: 'stretch' }}>

        {/* CARD INGRESOS */}
        <div style={cardWrap}>
          <div style={labelSection}>Ingresos</div>
          <div style={STYLE_NUMERO_GIGANTE}>{fmtEur(datos.sumIng)}</div>
          <div style={{ fontSize: 12, color: varIngTotal.color, marginTop: 6, fontFamily: FONT.body, fontWeight: 500 }}>
            {varIngTotal.txt} vs período anterior
          </div>
          <div style={divider} />
          <div>
            {filasIngresos.length === 0 && (
              <div style={{ fontSize: 12, color: T.mut, padding: '7px 0', fontFamily: FONT.body }}>Sin ingresos</div>
            )}
            {filasIngresos.map(f => (
              <div key={f.canal}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, fontFamily: FONT.body, fontSize: 13, color: T.pri }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: f.color, flexShrink: 0 }} />
                    <span>{f.canal}</span>
                  </div>
                  <div style={FILA_COLS}>
                    <span style={{ fontSize: 13, color: T.pri, fontWeight: 500, textAlign: 'right', fontFamily: FONT.body }}>{fmtEur(f.total)}</span>
                    <span style={{ fontSize: 11, fontFamily: FONT.heading, letterSpacing: '0.5px', color: f.variacion.color, textAlign: 'right' }}>{f.variacion.txt}</span>
                    <span style={{ fontSize: 11, fontFamily: FONT.heading, letterSpacing: '0.5px', color: T.mut, textAlign: 'right' }}>{f.pct}%</span>
                  </div>
                </div>
                {/* FIX 5 — mini-barra de progreso */}
                <div style={{ marginTop: 2, marginBottom: 6 }}>
                  <div style={{ height: 3, backgroundColor: T.bg, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${f.pct}%`, height: '100%', backgroundColor: f.color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CARD GASTOS */}
        <div style={cardWrap}>
          <div style={labelSection}>Gastos</div>
          <div style={STYLE_NUMERO_GIGANTE}>{fmtEur(datos.sumGst)}</div>
          <div style={{ fontSize: 12, color: varGstTotal.color, marginTop: 6, fontFamily: FONT.body, fontWeight: 500 }}>
            {varGstTotal.txt} vs período anterior
          </div>
          <div style={divider} />
          <div>
            {filasGastos.length === 0 && (
              <div style={{ fontSize: 12, color: T.mut, padding: '7px 0', fontFamily: FONT.body }}>Sin gastos</div>
            )}
            {filasGastos.map(f => (
              <div key={f.categoria}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, fontFamily: FONT.body, fontSize: 13, color: T.pri }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: f.color, flexShrink: 0 }} />
                    <span>{f.categoria}</span>
                  </div>
                  <div style={FILA_COLS}>
                    <span style={{ fontSize: 13, color: T.pri, fontWeight: 500, textAlign: 'right', fontFamily: FONT.body }}>{fmtEur(f.total)}</span>
                    <span style={{ fontSize: 11, fontFamily: FONT.heading, letterSpacing: '0.5px', color: f.variacion.color, textAlign: 'right' }}>{f.variacion.txt}</span>
                    <span style={{ fontSize: 11, fontFamily: FONT.heading, letterSpacing: '0.5px', color: T.mut, textAlign: 'right' }}>{f.pct}%</span>
                  </div>
                </div>
                {/* FIX 5 — mini-barra de progreso */}
                <div style={{ marginTop: 2, marginBottom: 6 }}>
                  <div style={{ height: 3, backgroundColor: T.bg, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${f.pct}%`, height: '100%', backgroundColor: f.color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CARD TESORERÍA */}
        <div style={cardWrap}>
          <div style={labelSection}>Tesorería · Hoy</div>
          <div style={STYLE_NUMERO_GIGANTE}>{fmtEur(balanceDisponible)}</div>
          {/* FIX 7 — delta vs hace 30 días */}
          <div style={{ fontSize: 12, color: varCaja.color, marginTop: 4, fontWeight: 500, fontFamily: FONT.body }}>
            {varCaja.txt} vs hace 30 días
          </div>
          <div style={{ fontSize: 12, color: T.mut, marginTop: 4, fontFamily: FONT.body }}>
            Balance disponible
          </div>
          <div style={divider} />

          {/* FIX 3 — Caja líquida destacada */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${T.brd}` }}>
            <span style={{ fontFamily: FONT.heading, fontSize: 12, color: T.pri, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Caja líquida</span>
            <span style={{ fontFamily: FONT.heading, fontSize: 18, color: T.pri, fontWeight: 500 }}>{fmtEur(cajaLiquida)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 13, color: VERDE_OK, fontFamily: FONT.body }}>
            <span>Cobros pendientes</span>
            <span style={{ fontWeight: 500 }}>+{fmtEur(cobrosPendientes)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 13, color: ACCENT_RED, fontFamily: FONT.body }}>
            <span>Pagos pendientes</span>
            <span style={{ fontWeight: 500 }}>−{fmtEur(pagosPendientes)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 13, color: T.pri, fontFamily: FONT.body }}>
            <span>Proyección 7d</span>
            <span style={{ fontWeight: 500 }}>{fmtEur(proy7d)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 13, color: T.pri, fontFamily: FONT.body }}>
            <span>Proyección 30d</span>
            <span style={{ fontWeight: 500 }}>{fmtEur(proy30d)}</span>
          </div>

          {/* FIX 2 — bloque de proyección visual que rellena altura */}
          <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: `1px solid ${T.brd}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.mut, marginBottom: 6, fontFamily: FONT.body }}>
              <span>Hoy</span>
              <span>30d</span>
            </div>
            <div style={{ height: 6, backgroundColor: T.bg, borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, height: '100%',
                width: `${porcentajeProyeccion}%`,
                backgroundColor: proy30d >= cajaLiquida ? VERDE_OK : ACCENT_RED,
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 6, fontFamily: FONT.body }}>
              <span style={{ color: T.pri, fontWeight: 500 }}>{fmtEur(cajaLiquida)}</span>
              <span style={{ color: proy30d >= cajaLiquida ? VERDE_OK : ACCENT_RED, fontWeight: 500 }}>{fmtEur(proy30d)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ FILA 2 — RATIO + BALANCE NETO ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 16 }}>

        {/* CARD RATIO */}
        <div style={{
          backgroundColor: T.card,
          borderRadius: 14,
          border: `1px solid ${T.brd}`,
          padding: '24px 30px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 30,
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ ...labelSection, marginBottom: 8 }}>Ratio Ingresos / Gastos</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
              <span style={{
                ...kpiValueStyle(T),
                fontSize: 64,
                lineHeight: 1,
                letterSpacing: '-1.5px',
              }}>
                {datos.ratio.toFixed(2)}
              </span>
              <span style={{ backgroundColor: estadoRatio.bg, color: estadoRatio.fg, fontSize: 11, padding: '4px 12px', borderRadius: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.8px', fontFamily: FONT.heading }}>
                {estadoRatio.label}
              </span>
            </div>
            <div style={{ fontSize: 12, color: T.mut, marginTop: 8, fontFamily: FONT.body }}>Objetivo ≥ 1.25</div>
            {/* FIX 8.3 — delta ratio */}
            <div style={{ fontSize: 12, color: varRatio.color, marginTop: 6, fontWeight: 500, fontFamily: FONT.body }}>
              {varRatio.txt} vs período anterior
            </div>
          </div>
          <div style={{ flex: 1, maxWidth: 320, minWidth: 240 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.mut, marginBottom: 6, fontFamily: FONT.heading, letterSpacing: '0.8px' }}>
              <span>Crítico</span><span>Alerta</span><span>OK</span><span>Saludable</span>
            </div>
            <div style={{ position: 'relative', height: 10, background: 'linear-gradient(to right, #F09595 0%, #F09595 25%, #FAC775 25%, #FAC775 50%, #C0DD97 50%, #C0DD97 75%, #5DCAA5 75%, #5DCAA5 100%)', borderRadius: 5 }}>
              {/* FIX 8.2 — indicador más grueso con contorno */}
              <div style={{
                position: 'absolute',
                left: `${posicionIndicador}%`,
                top: -5,
                width: 4,
                height: 20,
                backgroundColor: T.pri,
                borderRadius: 2,
                boxShadow: `0 0 0 2px ${T.card}`,
                transform: 'translateX(-2px)',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.mut, marginTop: 4, fontFamily: FONT.body }}>
              <span>0.5</span><span>1.0</span><span>1.25</span><span>2.0</span>
            </div>
          </div>
        </div>

        {/* CARD BALANCE NETO */}
        <div style={cardWrap}>
          <div style={labelSection}>Balance neto</div>
          <div style={{
            ...STYLE_NUMERO_GIGANTE,
            color: datos.balance >= 0 ? VERDE_OK : ACCENT_RED,
          }}>
            {datos.balance >= 0 ? '+' : ''}{fmtEur(datos.balance)}
          </div>
          {/* FIX 10 — más espacio antes del subtítulo */}
          <div style={{ fontSize: 12, color: T.mut, marginTop: 8, fontFamily: FONT.body }}>Ingresos − Gastos</div>
          <div style={divider} />
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 13, color: T.pri, fontFamily: FONT.body }}>
            <span>vs período anterior</span>
            {/* FIX 9 — esIngreso=true: bajar = rojo */}
            <span style={{ color: varBalance.color, fontWeight: 500 }}>{varBalance.txt}</span>
          </div>
        </div>
      </div>

      {/* ═══ FILA 3 — PRESUPUESTOS ═══ */}
      <div>
        <div style={{ fontFamily: FONT.heading, fontSize: 12, color: T.pri, letterSpacing: '1.3px', textTransform: 'uppercase', marginBottom: 12, fontWeight: 500 }}>
          Presupuestos · {mesNombre} {anio} · {diasRestantes} días restantes
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {PRESUPUESTOS.map(p => {
            const pal = PALETA_PRESUPUESTO[p.categoria] ?? PALETA_PRESUPUESTO.compras
            const pct = Math.round((p.consumido / p.tope) * 100)
            const superado = p.consumido > p.tope
            const pctDisplay = superado ? 100 : Math.min(100, pct)
            const colorBarra = superado ? ROJO : pal.barra
            const badge = estadoPresupuesto(pct)
            const ritmoDiario = p.consumido / Math.max(diasTranscurridos, 1)
            return (
              <div key={p.categoria} style={{
                backgroundColor: pal.bg,
                borderRadius: 12,
                padding: '16px 18px',
                border: `1px solid ${pal.border}`,
              }}>
                {/* FIX 11.1 — badge estado */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontFamily: FONT.heading, fontSize: 12, color: pal.text, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 500 }}>
                    {p.nombre}
                  </div>
                  <span style={{
                    fontSize: 9,
                    padding: '2px 7px',
                    borderRadius: 8,
                    fontFamily: FONT.heading,
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    fontWeight: 500,
                    backgroundColor: badge.bg,
                    color: badge.fg,
                  }}>
                    {badge.label}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 500, color: pal.text }}>{fmtEur(p.consumido)}</span>
                  <span style={{ fontSize: 11, color: pal.subtext, fontFamily: FONT.body }}>bruto</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                  <span style={{ fontFamily: FONT.heading, fontSize: 18, fontWeight: 500, color: pal.valor }}>{fmtEur(p.tope)}</span>
                  <span style={{ fontSize: 11, color: pal.subtext, fontFamily: FONT.body }}>tope</span>
                </div>
                <div style={{ height: 1, backgroundColor: pal.border, margin: '10px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: pal.subtext, fontFamily: FONT.body }}>{superado ? 'Superado' : 'Consumido'}</span>
                  <span style={{ fontFamily: FONT.heading, fontSize: 13, fontWeight: 500, color: superado ? ROJO : pal.text }}>{pct}%</span>
                </div>
                <div style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${pctDisplay}%`, height: '100%', backgroundColor: colorBarra, transition: 'width 0.4s ease' }} />
                </div>
                {/* FIX 11.2 — ritmo diario */}
                <div style={{ fontSize: 10, color: pal.subtext, marginTop: 6, textAlign: 'right', fontFamily: FONT.body }}>
                  Ritmo: {fmtEur(ritmoDiario)} /día · quedan {diasRestantes}d
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ═══ FILA 4 — GRÁFICOS ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>

        {/* CARD BARRAS SEMANALES */}
        <div style={cardWrap}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={labelSection}>Ingresos vs Gastos · semanal</div>
            <div style={{ display: 'flex', gap: 10, fontSize: 10 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: T.mut, fontFamily: FONT.body }}>
                <span style={{ width: 10, height: 2, backgroundColor: '#06C167' }} />Ing
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: T.mut, fontFamily: FONT.body }}>
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
              <Bar dataKey="gastos"   name="Gastos"   fill={ACCENT_RED} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* CARD EVOLUCIÓN 3 LÍNEAS */}
        <div style={cardWrap}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={labelSection}>Evolución: Ingresos · Gastos · Saldo</div>
            <div style={{ display: 'flex', gap: 10, fontSize: 10 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: T.mut, fontFamily: FONT.body }}>
                <span style={{ width: 10, height: 2, backgroundColor: '#06C167' }} />Ing
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: T.mut, fontFamily: FONT.body }}>
                <span style={{ width: 10, height: 2, backgroundColor: ACCENT_RED }} />Gst
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: T.mut, fontFamily: FONT.body }}>
                <span style={{ width: 10, height: 2, backgroundColor: '#F59E0B' }} />Saldo
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={datosEvolucion}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.brd} />
              <XAxis dataKey="fecha" stroke={T.mut} tick={{ fontSize: 11, fill: T.mut, fontFamily: FONT.body }} interval="preserveStartEnd" />
              {/* FIX 13 — dominio ajustado, 6 ticks */}
              <YAxis
                stroke={T.mut}
                tick={{ fontSize: 11, fill: T.mut, fontFamily: FONT.body }}
                domain={[(dataMin: number) => Math.floor((dataMin - 500) / 500) * 500, (dataMax: number) => Math.ceil((dataMax + 500) / 500) * 500]}
                tickCount={6}
                tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: T.card, border: `1px solid ${T.brd}`, color: T.pri, fontFamily: FONT.body, borderRadius: 8 }}
                formatter={(v) => fmtEur(Number(v))}
              />
              <Line type="linear" dataKey="ingresos" name="Ingresos" stroke="#06C167"   strokeWidth={2}   dot={false} activeDot={{ r: 5 }} />
              <Line type="linear" dataKey="gastos"   name="Gastos"   stroke={ACCENT_RED} strokeWidth={2}   dot={false} activeDot={{ r: 5 }} />
              <Line type="linear" dataKey="saldo"    name="Saldo"    stroke="#F59E0B"   strokeWidth={2.5} dot={false} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
