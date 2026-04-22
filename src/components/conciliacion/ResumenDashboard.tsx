import { useMemo } from 'react'
import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts'
import { fmtEur } from '@/utils/format'
import { useTheme, FONT } from '@/styles/tokens'
import type { Movimiento, Categoria } from '@/types/conciliacion'

/* ═══════════════════════════════════════════════════════════
   PROPS
   ═══════════════════════════════════════════════════════════ */

interface Props {
  movimientos: Movimiento[]           // período actual
  movimientosAnterior: Movimiento[]   // período anterior (mismo tamaño)
  categorias: Categoria[]
  periodoLabel: string
  mesNombre: string                   // ej: "Abril"
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
  'RRHH':                  '#B01D23',
  'Proveedores':           '#D85A30',
  'Alquiler':              '#F59E0B',
  'Suministros':           '#7F77DD',
  'Marketing':             '#D4537E',
  'Otros':                 '#888780',
  'Sin categoría':         '#888780',
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

  /* — Datos período anterior — */
  const datosAnt = useMemo(() => {
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

  /* — Ratio — */
  const estadoRatio = calcularEstadoRatio(datos.ratio)
  const posicionIndicador = calcularPosicionIndicador(datos.ratio)

  /* — Variaciones totales — */
  const varIngTotal = variacion(datos.sumIng, datosAnt.sumIng, true)
  const varGstTotal = variacion(datos.sumGst, datosAnt.sumGst, false)
  const varBalance  = variacion(datos.balance, datosAnt.balance, true)

  /* ═══════════════════════════════════════════════════════════
     STYLES
     ═══════════════════════════════════════════════════════════ */

  const cardWrap = {
    backgroundColor: T.card,
    borderRadius: 14,
    padding: '22px 24px',
    border: `1px solid ${T.brd}`,
  } as const

  const labelSection = {
    fontFamily: FONT.heading,
    fontSize: 11,
    color: T.mut,
    letterSpacing: '1.3px',
    textTransform: 'uppercase' as const,
    fontWeight: 500,
  }

  const bigValue = {
    fontFamily: FONT.heading,
    fontSize: 36,
    fontWeight: 500,
    color: T.pri,
    lineHeight: 1,
    letterSpacing: '-0.5px',
    marginTop: 6,
  } as const

  const divider = { height: 1, backgroundColor: T.brd, margin: '16px 0' } as const

  const pctCell = { fontSize: 10, width: 48, textAlign: 'right' as const, fontFamily: FONT.heading, letterSpacing: '0.5px' }

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* FILA 1 — INGRESOS · GASTOS · TESORERÍA */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>

        {/* CARD INGRESOS */}
        <div style={cardWrap}>
          <div style={labelSection}>Ingresos</div>
          <div style={bigValue}>{fmtEur(datos.sumIng)}</div>
          <div style={{ fontSize: 12, color: varIngTotal.color, marginTop: 6, fontFamily: FONT.body }}>
            {varIngTotal.txt} vs período anterior
          </div>
          <div style={divider} />
          <div>
            {filasIngresos.length === 0 && (
              <div style={{ fontSize: 12, color: T.mut, padding: '7px 0', fontFamily: FONT.body }}>Sin ingresos</div>
            )}
            {filasIngresos.map(f => (
              <div key={f.canal} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: T.pri, fontFamily: FONT.body }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: f.color, display: 'inline-block' }} />
                  {f.canal}
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: T.pri, fontWeight: 500, width: 72, textAlign: 'right', fontFamily: FONT.body }}>{fmtEur(f.total)}</span>
                  <span style={{ ...pctCell, color: f.variacion.color }}>{f.variacion.txt}</span>
                  <span style={{ ...pctCell, color: T.mut }}>{f.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CARD GASTOS */}
        <div style={cardWrap}>
          <div style={labelSection}>Gastos</div>
          <div style={bigValue}>{fmtEur(datos.sumGst)}</div>
          <div style={{ fontSize: 12, color: varGstTotal.color, marginTop: 6, fontFamily: FONT.body }}>
            {varGstTotal.txt} vs período anterior
          </div>
          <div style={divider} />
          <div>
            {filasGastos.length === 0 && (
              <div style={{ fontSize: 12, color: T.mut, padding: '7px 0', fontFamily: FONT.body }}>Sin gastos</div>
            )}
            {filasGastos.map(f => (
              <div key={f.categoria} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: T.pri, fontFamily: FONT.body }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: f.color, display: 'inline-block' }} />
                  {f.categoria}
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: T.pri, fontWeight: 500, width: 72, textAlign: 'right', fontFamily: FONT.body }}>{fmtEur(f.total)}</span>
                  <span style={{ ...pctCell, color: f.variacion.color }}>{f.variacion.txt}</span>
                  <span style={{ ...pctCell, color: T.mut }}>{f.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CARD TESORERÍA */}
        <div style={cardWrap}>
          <div style={labelSection}>Tesorería · Hoy</div>
          <div style={bigValue}>{fmtEur(balanceDisponible)}</div>
          <div style={{ fontSize: 12, color: T.mut, marginTop: 6, fontFamily: FONT.body }}>
            Balance disponible
          </div>
          <div style={divider} />
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 13, color: T.pri, fontFamily: FONT.body }}>
              <span>Caja líquida</span>
              <span style={{ fontWeight: 500 }}>{fmtEur(cajaLiquida)}</span>
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
          </div>
        </div>
      </div>

      {/* FILA 2 — RATIO + BALANCE NETO */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>

        {/* CARD RATIO */}
        <div style={{
          flex: '2 1 480px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 30,
          padding: '24px 30px',
          backgroundColor: T.card,
          borderRadius: 14,
          border: `1px solid ${T.brd}`,
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontFamily: FONT.heading, fontSize: 11, color: T.mut, letterSpacing: '1.3px', textTransform: 'uppercase', marginBottom: 8 }}>
              Ratio Ingresos / Gastos
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
              <span style={{ fontFamily: FONT.heading, fontSize: 54, fontWeight: 500, color: T.pri, letterSpacing: '-1px', lineHeight: 1 }}>
                {datos.ratio.toFixed(2)}
              </span>
              <span style={{ backgroundColor: estadoRatio.bg, color: estadoRatio.fg, fontSize: 11, padding: '4px 12px', borderRadius: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.8px', fontFamily: FONT.heading }}>
                {estadoRatio.label}
              </span>
            </div>
            <div style={{ fontSize: 12, color: T.mut, marginTop: 8, fontFamily: FONT.body }}>Objetivo ≥ 1.25</div>
          </div>
          <div style={{ flex: 1, maxWidth: 320, minWidth: 240 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.mut, marginBottom: 6, fontFamily: FONT.heading, letterSpacing: '0.8px' }}>
              <span>Crítico</span><span>Alerta</span><span>OK</span><span>Saludable</span>
            </div>
            <div style={{ position: 'relative', height: 10, background: 'linear-gradient(to right, #F09595 0%, #F09595 25%, #FAC775 25%, #FAC775 50%, #C0DD97 50%, #C0DD97 75%, #5DCAA5 75%, #5DCAA5 100%)', borderRadius: 5 }}>
              <div style={{ position: 'absolute', left: `${posicionIndicador}%`, top: -4, width: 3, height: 18, backgroundColor: T.pri, borderRadius: 2, transform: 'translateX(-50%)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.mut, marginTop: 4, fontFamily: FONT.body }}>
              <span>0.5</span><span>1.0</span><span>1.25</span><span>2.0</span>
            </div>
          </div>
        </div>

        {/* CARD BALANCE NETO */}
        <div style={{ ...cardWrap, flex: '1 1 240px' }}>
          <div style={labelSection}>Balance neto</div>
          <div style={{
            fontFamily: FONT.heading,
            fontSize: 36,
            fontWeight: 500,
            color: datos.balance >= 0 ? VERDE_OK : ACCENT_RED,
            lineHeight: 1,
            letterSpacing: '-0.5px',
            marginTop: 6,
          }}>
            {datos.balance >= 0 ? '+' : ''}{fmtEur(datos.balance)}
          </div>
          <div style={{ fontSize: 12, color: T.mut, marginTop: 6, fontFamily: FONT.body }}>Ingresos − Gastos</div>
          <div style={divider} />
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 13, color: T.pri, fontFamily: FONT.body }}>
            <span>vs período anterior</span>
            <span style={{ color: varBalance.color, fontWeight: 500 }}>{varBalance.txt}</span>
          </div>
        </div>
      </div>

      {/* FILA 3 — PRESUPUESTOS */}
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
              </div>
            )
          })}
        </div>
      </div>

      {/* FILA 4 — GRÁFICOS */}
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
              <YAxis stroke={T.mut} tick={{ fontSize: 11, fill: T.mut, fontFamily: FONT.body }} domain={['auto', 'auto']} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
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
