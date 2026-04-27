import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { useTheme, FONT, kpiValueStyle } from '@/styles/tokens'
import type { Movimiento, Categoria } from '@/types/conciliacion'

/* ── Helper: cobros pendientes reales por canal ── */

function calcularRangoCiclo(canal: 'uber' | 'glovo' | 'just_eat'): { desde: string; hasta: string } | null {
  const hoy = new Date()
  const yy = hoy.getFullYear()
  const mm = hoy.getMonth() // 0-indexed
  const dd = hoy.getDate()

  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

  if (canal === 'uber') {
    // Semana lunes a domingo anterior (no liquidada)
    const dia = hoy.getDay() // 0=dom
    const lunes = new Date(hoy)
    lunes.setDate(dd - (dia === 0 ? 6 : dia - 1) - 7) // lunes semana anterior
    const domingo = new Date(lunes)
    domingo.setDate(lunes.getDate() + 6)
    return { desde: iso(lunes.getFullYear(), lunes.getMonth(), lunes.getDate()), hasta: iso(domingo.getFullYear(), domingo.getMonth(), domingo.getDate()) }
  }

  if (canal === 'glovo') {
    // 1-15 → paga el 5 del mes siguiente; 16-fin → paga el 20 del mes siguiente
    // Mostrar periodo pendiente según hoy
    if (dd <= 5) {
      // Estamos antes del 5: pendiente quincena 1-15 del mes anterior
      const mesAnt = mm === 0 ? 11 : mm - 1
      const anioAnt = mm === 0 ? yy - 1 : yy
      const ultimo15 = new Date(anioAnt, mesAnt, 15)
      return { desde: iso(anioAnt, mesAnt, 1), hasta: iso(ultimo15.getFullYear(), ultimo15.getMonth(), 15) }
    } else if (dd <= 20) {
      // Estamos entre 5 y 20: pendiente segunda quincena del mes anterior
      const mesAnt = mm === 0 ? 11 : mm - 1
      const anioAnt = mm === 0 ? yy - 1 : yy
      const ultimoDia = new Date(anioAnt, mesAnt + 1, 0).getDate()
      return { desde: iso(anioAnt, mesAnt, 16), hasta: iso(anioAnt, mesAnt, ultimoDia) }
    } else {
      // Después del 20: sin quincena pendiente aún
      return null
    }
  }

  if (canal === 'just_eat') {
    // 1-15 → paga el 20 del mismo mes; 16-fin → paga el 5 del mes siguiente
    if (dd <= 20) {
      // Pendiente primera quincena del mes actual
      return { desde: iso(yy, mm, 1), hasta: iso(yy, mm, 15) }
    } else {
      // Pendiente segunda quincena del mes actual
      const ultimoDia = new Date(yy, mm + 1, 0).getDate()
      return { desde: iso(yy, mm, 16), hasta: iso(yy, mm, ultimoDia) }
    }
  }

  return null
}

function useCobrosPendientes(): number {
  const [total, setTotal] = useState(MOCK_TESORERIA.cobrosPendientes)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      const canales: { canal: 'uber' | 'glovo' | 'just_eat'; bruKey: string }[] = [
        { canal: 'uber',     bruKey: 'uber_bruto' },
        { canal: 'glovo',    bruKey: 'glovo_bruto' },
        { canal: 'just_eat', bruKey: 'je_bruto' },
      ]

      let suma = 0
      for (const { canal, bruKey } of canales) {
        const rango = calcularRangoCiclo(canal)
        if (!rango) continue
        const { data } = await supabase
          .from('facturacion_diario')
          .select(bruKey)
          .gte('fecha', rango.desde)
          .lte('fecha', rango.hasta)
        if (data) {
          suma += (data as unknown as Record<string, number>[]).reduce((s, r) => s + (r[bruKey] ?? 0), 0)
        }
      }

      if (!cancel) setTotal(suma)
    })()
    return () => { cancel = true }
  }, [])

  return total
}

/* ═══════════════════════════════════════════════════════════
   PROPS
   ═══════════════════════════════════════════════════════════ */

interface Props {
  movimientos?: Movimiento[]
  movimientosAnterior?: Movimiento[]
  categorias?: Categoria[]
  mesNombre?: string
  anio?: number
  diasRestantes?: number
}

/* ═══════════════════════════════════════════════════════════
   CONSTANTES COLORES
   ═══════════════════════════════════════════════════════════ */

const VERDE_OK   = '#1D9E75'
const ROJO       = '#A32D2D'

const COLOR_CANAL: Record<string, string> = {
  'Uber Eats': '#06C167',
  'Glovo':     '#e8f442',
  'Just Eat':  '#f5a623',
  'Web':       '#B01D23',
  'Directa':   '#66aaff',
}

const COLOR_CATEGORIA: Record<string, string> = {
  'RRHH':         '#B01D23',
  'Proveedores':  '#D85A30',
  'Alquiler':     '#F59E0B',
  'Suministros':  '#7F77DD',
  'Marketing':    '#D4537E',
  'Otros':        '#888780',
}

/* ═══════════════════════════════════════════════════════════
   MOCKS COHERENTES (FIX 12)
   ═══════════════════════════════════════════════════════════ */

const MOCK_CANALES_ACTUAL = [
  { canal: 'Uber Eats', importe: 21190 },
  { canal: 'Glovo',     importe: 5340 },
  { canal: 'Just Eat',  importe: 3200 },
  { canal: 'Web',       importe: 738 },
  { canal: 'Directa',   importe: 0 },
]

const MOCK_CANALES_ANTERIOR = [
  { canal: 'Uber Eats', importe: 18585 },
  { canal: 'Glovo',     importe: 5565 },
  { canal: 'Just Eat',  importe: 2623 },
  { canal: 'Web',       importe: 683 },
  { canal: 'Directa',   importe: 0 },
]

const MOCK_CATEGORIAS_ACTUAL = [
  { categoria: 'RRHH',         importe: 4850 },
  { categoria: 'Proveedores',  importe: 4448 },
  { categoria: 'Alquiler',     importe: 2400 },
  { categoria: 'Suministros',  importe: 1028 },
  { categoria: 'Marketing',    importe: 530 },
]

const MOCK_CATEGORIAS_ANTERIOR = [
  { categoria: 'RRHH',         importe: 4709 },
  { categoria: 'Proveedores',  importe: 4888 },
  { categoria: 'Alquiler',     importe: 2400 },
  { categoria: 'Suministros',  importe: 918 },
  { categoria: 'Marketing',    importe: 646 },
]

const MOCK_PRESUPUESTOS = [
  { categoria: 'compras',     nombre: 'COMPRAS',     consumido: 4448, tope: 6000 },
  { categoria: 'rrhh',        nombre: 'RRHH',        consumido: 4850, tope: 5000 },
  { categoria: 'marketing',   nombre: 'MARKETING',   consumido:  530, tope: 1000 },
  { categoria: 'suministros', nombre: 'SUMINISTROS', consumido: 1028, tope: 1000 },
] as const

const MOCK_TESORERIA = {
  balanceActual: 16254.18,
  balanceHace30d: 14890.00,
  cajaLiquida: 12450,
  cobrosPendientes: 5340,
  pagosPendientes: 2100,
  proyeccion7d: 15690,
  proyeccion30d: 18200,
}

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

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


function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return isMobile
}

/* ═══════════════════════════════════════════════════════════
   STYLE NÚMERO GIGANTE (FIX 1) — copia de Dashboard card VENTAS
   Dashboard usa: { ...kpiValueStyle(T), marginBottom:4 }
   kpiValueStyle: { fontFamily:'Oswald,sans-serif', fontSize:'2.4rem', fontWeight:600, color:T.pri, lineHeight:1 }
   ═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTE FILA DISTRIBUCIÓN (FIX 6)
   ═══════════════════════════════════════════════════════════ */

interface FilaDistribucionProps {
  color: string
  nombre: string
  importe: number
  deltaPct: number | null
  porcentaje: number
  esIngreso: boolean
  cuadrado?: boolean
}

function FilaDistribucion({ color, nombre, importe, deltaPct, porcentaje, esIngreso, cuadrado }: FilaDistribucionProps) {
  const { T } = useTheme()

  let deltaSymbol = '='
  let deltaColor = T.mut
  if (deltaPct !== null) {
    if (deltaPct > 0) deltaSymbol = '▲'
    else if (deltaPct < 0) deltaSymbol = '▼'
    const favorable = esIngreso ? deltaPct > 0 : deltaPct < 0
    if (deltaPct !== 0) deltaColor = favorable ? VERDE_OK : ROJO
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 0',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flex: 1,
          minWidth: 0,
        }}>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: cuadrado ? 2 : '50%',
            backgroundColor: color,
            flexShrink: 0,
          }} />
          <span style={{
            fontFamily: FONT.body,
            fontSize: 13,
            color: T.pri,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {nombre}
          </span>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '90px 52px 36px',
          gap: 10,
          alignItems: 'center',
        }}>
          <span style={{
            fontFamily: FONT.body,
            fontSize: 13,
            color: T.pri,
            fontWeight: 500,
            textAlign: 'right',
          }}>
            {fmtEur(importe)}
          </span>
          <span style={{
            fontFamily: FONT.heading,
            fontSize: 11,
            letterSpacing: 0.5,
            color: deltaColor,
            textAlign: 'right',
          }}>
            {deltaPct === null ? '—' : `${deltaSymbol} ${Math.abs(Math.round(deltaPct))}%`}
          </span>
          <span style={{
            fontFamily: FONT.heading,
            fontSize: 11,
            letterSpacing: 0.5,
            color: T.mut,
            textAlign: 'right',
          }}>
            {porcentaje}%
          </span>
        </div>
      </div>
      <div style={{
        height: 3,
        backgroundColor: T.bg,
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 4,
      }}>
        <div style={{
          width: `${porcentaje}%`,
          height: '100%',
          backgroundColor: color,
        }} />
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   COMPONENT PRINCIPAL
   ═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTE: PRESUPUESTO VS REAL (datos reales de objetivos+gastos)
   ═══════════════════════════════════════════════════════════ */

interface PresupuestoCat { grupo: string; label: string; presupuesto: number; real: number }

function PresupuestoVsRealSection() {
  const { T } = useTheme()
  const [data, setData] = useState<PresupuestoCat[]>([])

  useEffect(() => {
    const hoy = new Date()
    const anio = hoy.getFullYear()
    const mes = hoy.getMonth() + 1

    // Load presupuesto for current month
    supabase.from('objetivos')
      .select('categoria_codigo,importe')
      .eq('tipo', 'presupuesto')
      .eq('anio', anio)
      .eq('mes', mes)
      .then(async ({ data: presRows }) => {
        // Group by main grupo prefix
        const grupoMap: Record<string, { label: string; presupuesto: number }> = {
          PRD: { label: 'Producto (COGS)', presupuesto: 0 },
          EQP: { label: 'Equipo (Labor)', presupuesto: 0 },
          LOC: { label: 'Local (Occupancy)', presupuesto: 0 },
          CTR: { label: 'Controlables (OPEX)', presupuesto: 0 },
        }
        for (const r of (presRows ?? [])) {
          const prefix = (r.categoria_codigo as string).slice(0, 3)
          if (grupoMap[prefix]) grupoMap[prefix].presupuesto += Number(r.importe) || 0
        }

        // Load gastos for current month from conciliacion table
        const mesStr = `${anio}-${String(mes).padStart(2, '0')}`
        const { data: gastoRows } = await supabase.from('conciliacion')
          .select('categoria,importe')
          .like('fecha', `${mesStr}-%`)
          .lt('importe', 0)

        const realMap: Record<string, number> = { PRD: 0, EQP: 0, LOC: 0, CTR: 0 }
        for (const g of (gastoRows ?? [])) {
          const prefix = (g.categoria as string ?? '').slice(0, 3)
          if (realMap[prefix] !== undefined) realMap[prefix] += Math.abs(Number(g.importe) || 0)
        }

        setData(Object.entries(grupoMap).map(([prefix, v]) => ({
          grupo: prefix,
          label: v.label,
          presupuesto: v.presupuesto,
          real: realMap[prefix] || 0,
        })))
      })
  }, [])

  if (data.length === 0) return null

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 10 }}>
        Presupuesto vs Real · Mes actual
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {data.map(cat => {
          const pct = cat.presupuesto > 0 ? Math.round((cat.real / cat.presupuesto) * 100) : 0
          const pctCap = Math.min(pct, 100)
          const barColor = pct > 100 ? '#E24B4A' : pct > 85 ? '#f5a623' : '#1D9E75'
          return (
            <div key={cat.grupo} style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, marginBottom: 6 }}>{cat.label}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <span style={{ fontFamily: FONT.heading, fontSize: 18, fontWeight: 600, color: barColor }}>{fmtEur(cat.real)}</span>
                <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>/ {fmtEur(cat.presupuesto)}</span>
              </div>
              <div style={{ height: 4, background: T.brd, borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
                <div style={{ height: 4, width: `${pctCap}%`, background: barColor, transition: 'width 0.4s ease' }} />
              </div>
              <div style={{ fontFamily: FONT.heading, fontSize: 11, color: barColor, textAlign: 'right' }}>{pct}%</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ResumenDashboard(_props: Props) {
  const { T } = useTheme()
  const isMobile = useIsMobile()
  const cobrosPendientesReal = useCobrosPendientes()

  /* — STYLE_NUM_GIGANTE_DASHBOARD (FIX 1): copia literal de Dashboard card VENTAS — */
  const STYLE_NUM_GIGANTE_DASHBOARD: CSSProperties = {
    ...kpiValueStyle(T),
    marginBottom: 4,
  }

  /* — Sumas a partir de mocks (FIX 12) — */
  const sumIng    = MOCK_CANALES_ACTUAL.reduce((s, c) => s + c.importe, 0)
  const sumIngAnt = MOCK_CANALES_ANTERIOR.reduce((s, c) => s + c.importe, 0)
  const sumGst    = MOCK_CATEGORIAS_ACTUAL.reduce((s, c) => s + c.importe, 0)
  const sumGstAnt = MOCK_CATEGORIAS_ANTERIOR.reduce((s, c) => s + c.importe, 0)

  const balance    = sumIng - sumGst
  const balanceAnt = sumIngAnt - sumGstAnt
  const ratio      = sumGst > 0 ? sumIng / sumGst : 0
  const ratioAnt   = sumGstAnt > 0 ? sumIngAnt / sumGstAnt : 0

  /* — Deltas globales (FIX 4) — */
  const ingDeltaPct = sumIngAnt !== 0 ? ((sumIng - sumIngAnt) / sumIngAnt) * 100 : 0
  const ingDeltaSym = ingDeltaPct > 0 ? '▲' : ingDeltaPct < 0 ? '▼' : '='
  const ingDeltaColor = ingDeltaPct > 0 ? VERDE_OK : ingDeltaPct < 0 ? ROJO : T.mut
  const ingDeltaTxt = `${ingDeltaSym} ${Math.abs(Math.round(ingDeltaPct))}% vs período anterior`

  const gstDeltaPct = sumGstAnt !== 0 ? ((sumGst - sumGstAnt) / sumGstAnt) * 100 : 0
  const gstDeltaSym = gstDeltaPct > 0 ? '▲' : gstDeltaPct < 0 ? '▼' : '='
  const gstDeltaColor = gstDeltaPct > 0 ? ROJO : gstDeltaPct < 0 ? VERDE_OK : T.mut
  const gstDeltaTxt = `${gstDeltaSym} ${Math.abs(Math.round(gstDeltaPct))}% vs período anterior`

  const tesDeltaPct = MOCK_TESORERIA.balanceHace30d !== 0
    ? ((MOCK_TESORERIA.balanceActual - MOCK_TESORERIA.balanceHace30d) / MOCK_TESORERIA.balanceHace30d) * 100
    : 0
  const tesDeltaSym = tesDeltaPct > 0 ? '▲' : tesDeltaPct < 0 ? '▼' : '='
  const tesDeltaColor = tesDeltaPct > 0 ? VERDE_OK : tesDeltaPct < 0 ? ROJO : T.mut
  const tesDeltaTxt = `${tesDeltaSym} ${Math.abs(Math.round(tesDeltaPct))}%`

  const balanceDeltaPct = balanceAnt !== 0
    ? ((balance - balanceAnt) / Math.abs(balanceAnt)) * 100
    : 0
  const balanceDeltaColor = balanceDeltaPct > 0 ? VERDE_OK : balanceDeltaPct < 0 ? ROJO : T.mut
  const balanceDeltaSym = balanceDeltaPct > 0 ? '▲' : balanceDeltaPct < 0 ? '▼' : '='
  const balanceDeltaTxt = `${balanceDeltaSym} ${Math.abs(Math.round(balanceDeltaPct))}%`

  const ratioDeltaPct = ratioAnt !== 0 ? ((ratio - ratioAnt) / ratioAnt) * 100 : 0
  const ratioDeltaColor = ratioDeltaPct > 0 ? VERDE_OK : ratioDeltaPct < 0 ? ROJO : T.mut
  const ratioDeltaSym = ratioDeltaPct > 0 ? '▲' : ratioDeltaPct < 0 ? '▼' : '='
  const ratioDeltaTxt = `${ratioDeltaSym} ${Math.abs(Math.round(ratioDeltaPct))}%`

  /* — Filas con % sobre total + delta por fila — */
  const filasIngresos = MOCK_CANALES_ACTUAL
    .filter(c => c.importe > 0)
    .map(c => {
      const ant = MOCK_CANALES_ANTERIOR.find(x => x.canal === c.canal)?.importe ?? 0
      const deltaPct = ant !== 0 ? ((c.importe - ant) / ant) * 100 : null
      const porcentaje = sumIng > 0 ? Math.round((c.importe / sumIng) * 100) : 0
      return { ...c, color: COLOR_CANAL[c.canal] ?? '#888', deltaPct, porcentaje }
    })
    .sort((a, b) => b.importe - a.importe)

  const filasGastos = MOCK_CATEGORIAS_ACTUAL
    .filter(c => c.importe > 0)
    .map(c => {
      const ant = MOCK_CATEGORIAS_ANTERIOR.find(x => x.categoria === c.categoria)?.importe ?? 0
      const deltaPct = ant !== 0 ? ((c.importe - ant) / ant) * 100 : null
      const porcentaje = sumGst > 0 ? Math.round((c.importe / sumGst) * 100) : 0
      return { ...c, color: COLOR_CATEGORIA[c.categoria] ?? '#888', deltaPct, porcentaje }
    })
    .sort((a, b) => b.importe - a.importe)

  /* — Ratio visual — */
  const estadoRatio = calcularEstadoRatio(ratio)
  const posicionIndicador = calcularPosicionIndicador(ratio)

  /* — Proyección Tesorería — */
  const minVal = Math.min(MOCK_TESORERIA.cajaLiquida, MOCK_TESORERIA.proyeccion30d, 0)
  const maxVal = Math.max(MOCK_TESORERIA.cajaLiquida, MOCK_TESORERIA.proyeccion30d)
  const rango = maxVal - minVal || 1
  const porcentajeProyeccion = ((MOCK_TESORERIA.proyeccion30d - minVal) / rango) * 100

  /* — Styles compartidos — */
  const cardBase: CSSProperties = {
    backgroundColor: T.card,
    borderRadius: 14,
    padding: '22px 24px',
    border: `1px solid ${T.brd}`,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  }

  const labelCard: CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 11,
    color: T.mut,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    marginBottom: 8,
    fontWeight: 500,
  }

  const divider: CSSProperties = { height: 1, backgroundColor: T.brd, margin: '16px 0' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ═══ FILA 1 — INGRESOS · GASTOS · TESORERÍA (FIX 2) ═══ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
        gap: 16,
        marginBottom: 16,
        alignItems: 'stretch',
      }}>
        {/* CARD INGRESOS */}
        <div style={cardBase}>
          <div style={labelCard}>INGRESOS NETOS</div>
          <div style={STYLE_NUM_GIGANTE_DASHBOARD}>{fmtEur(sumIng)}</div>
          <div style={{ fontFamily: FONT.body, fontSize: 12, color: ingDeltaColor, marginTop: 4, fontWeight: 500 }}>
            {ingDeltaTxt}
          </div>
          <div style={divider} />
          <div>
            {filasIngresos.map(f => (
              <FilaDistribucion
                key={f.canal}
                color={f.color}
                nombre={f.canal}
                importe={f.importe}
                deltaPct={f.deltaPct}
                porcentaje={f.porcentaje}
                esIngreso={true}
                cuadrado={false}
              />
            ))}
          </div>
        </div>

        {/* CARD GASTOS */}
        <div style={cardBase}>
          <div style={labelCard}>GASTOS</div>
          <div style={STYLE_NUM_GIGANTE_DASHBOARD}>{fmtEur(sumGst)}</div>
          <div style={{ fontFamily: FONT.body, fontSize: 12, color: gstDeltaColor, marginTop: 4, fontWeight: 500 }}>
            {gstDeltaTxt}
          </div>
          <div style={divider} />
          <div>
            {filasGastos.map(f => (
              <FilaDistribucion
                key={f.categoria}
                color={f.color}
                nombre={f.categoria}
                importe={f.importe}
                deltaPct={f.deltaPct}
                porcentaje={f.porcentaje}
                esIngreso={false}
                cuadrado={true}
              />
            ))}
          </div>
        </div>

        {/* CARD TESORERÍA (FIX 7) */}
        <div style={cardBase}>
          <div style={labelCard}>TESORERÍA · HOY</div>
          <div style={STYLE_NUM_GIGANTE_DASHBOARD}>{fmtEur(MOCK_TESORERIA.balanceActual)}</div>
          <div style={{ fontFamily: FONT.body, fontSize: 12, color: tesDeltaColor, marginTop: 4, fontWeight: 500 }}>
            {tesDeltaTxt} vs hace 30 días
          </div>
          <div style={divider} />

          {/* Caja líquida destacada */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 0',
            borderBottom: `1px solid ${T.brd}`,
          }}>
            <span style={{ fontFamily: FONT.heading, fontSize: 12, color: T.pri, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 500 }}>
              Caja líquida
            </span>
            <span style={{ fontFamily: FONT.heading, fontSize: 18, color: T.pri, fontWeight: 500 }}>
              {fmtEur(MOCK_TESORERIA.cajaLiquida)}
            </span>
          </div>

          {/* Filas normales */}
          {[
            { label: 'Cobros pendientes', valor: cobrosPendientesReal, color: VERDE_OK, prefijo: '+' },
            { label: 'Pagos pendientes',  valor: MOCK_TESORERIA.pagosPendientes,  color: ROJO,     prefijo: '−' },
            { label: 'Proyección 7d',     valor: MOCK_TESORERIA.proyeccion7d,     color: T.pri,    prefijo: '' },
            { label: 'Proyección 30d',    valor: MOCK_TESORERIA.proyeccion30d,    color: T.pri,    prefijo: '' },
          ].map(item => (
            <div key={item.label} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 0',
            }}>
              <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri }}>{item.label}</span>
              <span style={{ fontFamily: FONT.body, fontSize: 13, color: item.color, fontWeight: 500 }}>
                {item.prefijo}{fmtEur(Math.abs(item.valor))}
              </span>
            </div>
          ))}

          {/* Relleno altura - mini-barra proyección */}
          <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: `1px solid ${T.brd}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT.body, fontSize: 11, color: T.mut, marginBottom: 6 }}>
              <span>Hoy</span>
              <span>30d</span>
            </div>
            <div style={{ height: 6, backgroundColor: T.bg, borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                width: `${porcentajeProyeccion}%`,
                backgroundColor: MOCK_TESORERIA.proyeccion30d >= MOCK_TESORERIA.cajaLiquida ? VERDE_OK : ROJO,
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT.body, fontSize: 12, marginTop: 6 }}>
              <span style={{ color: T.pri, fontWeight: 500 }}>{fmtEur(MOCK_TESORERIA.cajaLiquida)}</span>
              <span style={{ color: MOCK_TESORERIA.proyeccion30d >= MOCK_TESORERIA.cajaLiquida ? VERDE_OK : ROJO, fontWeight: 500 }}>
                {fmtEur(MOCK_TESORERIA.proyeccion30d)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ FILA 1.5 — PRESUPUESTO VS REAL ═══ */}
      <PresupuestoVsRealSection />

      {/* ═══ FILA 2 — RATIO + BALANCE NETO (FIX 8, FIX 9, FIX 10) ═══ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr',
        gap: 16,
        marginBottom: 16,
      }}>
        {/* CARD RATIO */}
        <div style={{
          backgroundColor: T.card,
          borderRadius: 14,
          padding: '24px 30px',
          border: `1px solid ${T.brd}`,
          display: 'flex',
          alignItems: isMobile ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          gap: isMobile ? 16 : 30,
          flexDirection: isMobile ? 'column' : 'row',
        }}>
          {/* Columna izquierda */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 11, color: T.mut, letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 8, fontWeight: 500 }}>
              RATIO INGRESOS / GASTOS
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
              <span style={{ ...STYLE_NUM_GIGANTE_DASHBOARD, fontSize: 72, lineHeight: 1, marginBottom: 0 }}>
                {ratio.toFixed(2)}
              </span>
              <span style={{
                backgroundColor: estadoRatio.bg,
                color: estadoRatio.fg,
                fontSize: 11,
                padding: '4px 12px',
                borderRadius: 12,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                fontFamily: FONT.heading,
              }}>
                {estadoRatio.label}
              </span>
            </div>
            <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, marginTop: 8 }}>
              Objetivo ≥ 1.25
            </div>
            <div style={{ fontFamily: FONT.body, fontSize: 12, color: ratioDeltaColor, marginTop: 6, fontWeight: 500 }}>
              {ratioDeltaTxt} vs período anterior
            </div>
          </div>

          {/* Columna derecha - barra semáforo */}
          <div style={{ flex: 1, maxWidth: isMobile ? '100%' : 320, width: isMobile ? '100%' : undefined }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT.heading, fontSize: 10, color: T.mut, marginBottom: 6, letterSpacing: 0.8 }}>
              <span>Crítico</span>
              <span>Alerta</span>
              <span>OK</span>
              <span>Saludable</span>
            </div>
            <div style={{
              position: 'relative',
              height: 10,
              background: 'linear-gradient(to right, #F09595 0%, #F09595 25%, #FAC775 25%, #FAC775 50%, #C0DD97 50%, #C0DD97 75%, #5DCAA5 75%, #5DCAA5 100%)',
              borderRadius: 5,
            }}>
              <div style={{
                position: 'absolute',
                left: `${posicionIndicador}%`,
                top: -5,
                width: 4,
                height: 20,
                backgroundColor: T.pri,
                borderRadius: 2,
                transform: 'translateX(-2px)',
                boxShadow: `0 0 0 2px ${T.card}`,
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT.body, fontSize: 10, color: T.mut, marginTop: 4 }}>
              <span>0.5</span>
              <span>1.0</span>
              <span>1.25</span>
              <span>2.0</span>
            </div>
          </div>
        </div>

        {/* CARD BALANCE NETO */}
        <div style={{
          backgroundColor: T.card,
          borderRadius: 14,
          padding: '22px 24px',
          border: `1px solid ${T.brd}`,
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={labelCard}>BALANCE NETO</div>
          <div style={{
            ...STYLE_NUM_GIGANTE_DASHBOARD,
            color: balance >= 0 ? VERDE_OK : ROJO,
          }}>
            {balance >= 0 ? '+' : ''}{fmtEur(balance)}
          </div>
          <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, marginTop: 8 }}>
            Ingresos − Gastos
          </div>
          <div style={{ height: 1, backgroundColor: T.brd, margin: '14px 0' }} />
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontFamily: FONT.body,
            fontSize: 12,
          }}>
            <span style={{ color: T.mut }}>vs período anterior</span>
            <span style={{
              color: balanceDeltaColor,
              fontWeight: 500,
              fontFamily: FONT.heading,
              letterSpacing: 0.5,
            }}>
              {balanceDeltaTxt}
            </span>
          </div>
        </div>
      </div>

    </div>
  )
}
