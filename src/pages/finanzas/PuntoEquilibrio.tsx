/**
 * Punto de Equilibrio — refactor 3 may 2026
 *
 * Cero mentiras. Cero parámetros hardcoded en pe_parametros.
 * Datos REALES:
 *   - Ingresos: tabla `ingresos_mensuales` (neto por canal/mes)
 *   - Gastos: tabla `gastos` (clasificados en 7 categorías canónicas)
 *   - Días operativos: useCalendario
 *
 * Estructura visual: Header SelectorFechaUniversal + TabsPastilla copia literal Conciliación.
 * Cards grandes Panel Global con barra apilada + desglose.
 */
import { useState, useMemo, useEffect } from 'react'
import { useTheme, FONT, fmtFechaCorta } from '@/styles/tokens'
import { useIVA } from '@/contexts/IVAContext'
import { useCalendario } from '@/contexts/CalendarioContext'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'
import TabsPastilla from '@/components/ui/TabsPastilla'
import {
  CATEGORIA_NOMBRE, CATEGORIA_COLOR,
  GASTOS_FIJOS, GASTOS_VARIABLES,
  type Categoria, type PeriodoRango,
} from '@/lib/running'
import { useRunning } from '@/hooks/useRunning'

const ROJO = '#B01D23'
const VERDE = '#10B981'
const AMBAR = '#F4C542'

/* Formato sin símbolo €, separadores es-ES */
function fmtNum(n: number, decimales = 0): string {
  if (!isFinite(n) || isNaN(n)) return '—'
  return n.toLocaleString('es-ES', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })
}

function fmtPct(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '—'
  return n.toFixed(1) + '%'
}

const MESES_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

const CANAL_INFO: Record<string, { label: string; color: string }> = {
  'UBER EATS':  { label: 'Uber Eats',     color: '#06C167' },
  'GLOVO':      { label: 'Glovo',         color: '#e8f442' },
  'JUST EAT':   { label: 'Just Eat',      color: '#f5a623' },
  'WEB':        { label: 'Tienda online', color: '#B01D23' },
  'DIRECTA':    { label: 'Directa',       color: '#66aaff' },
}

type Tab = 'resumen' | 'simulador'

export default function PuntoEquilibrio() {
  const { T } = useTheme()
  const { modo: modoIVA } = useIVA()
  const [tab, setTab] = useState<Tab>('resumen')

  const [periodoDesde, setPeriodoDesde] = useState<Date>(() => {
    const h = new Date(); h.setDate(1); h.setHours(0,0,0,0); return h
  })
  const [periodoHasta, setPeriodoHasta] = useState<Date>(() => {
    const h = new Date(); h.setHours(23,59,59,999); return h
  })
  const [periodoLabel, setPeriodoLabel] = useState('Mes en curso')

  const periodo: PeriodoRango = useMemo(() => ({
    desde: periodoDesde,
    hasta: periodoHasta,
    key: 'pe',
    label: periodoLabel,
  }), [periodoDesde, periodoHasta, periodoLabel])
  const anio = periodo.desde.getFullYear()

  const { loading, error, gastos, ingresosMes, facturacion } = useRunning(
    periodo, anio, null, null, modoIVA,
  )
  const { diasOperativosEnRango } = useCalendario()

  const meses = useMemo(() => {
    const set = new Set<number>()
    const cur = new Date(periodo.desde)
    while (cur <= periodo.hasta) {
      if (cur.getFullYear() === anio) set.add(cur.getMonth() + 1)
      cur.setDate(cur.getDate() + 1)
    }
    return Array.from(set)
  }, [periodo, anio])

  const ingresosPorCanal = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of ingresosMes) {
      if (r.tipo !== 'neto' || !meses.includes(r.mes)) continue
      m.set(r.canal, (m.get(r.canal) ?? 0) + Number(r.importe || 0))
    }
    return m
  }, [ingresosMes, meses])

  const totalIngresos = useMemo(
    () => Array.from(ingresosPorCanal.values()).reduce((a, v) => a + v, 0),
    [ingresosPorCanal]
  )

  const totalPedidos = useMemo(
    () => facturacion.reduce((a, f) => a + Number(f.total_pedidos || 0), 0),
    [facturacion]
  )

  const gastosPorCategoria = useMemo(() => {
    const m: Partial<Record<Categoria, number>> = {}
    for (const g of gastos) {
      m[g.categoria] = (m[g.categoria] ?? 0) + Number(g.importe || 0)
    }
    return m
  }, [gastos])

  const totalFijos = useMemo(
    () => GASTOS_FIJOS.reduce((a, c) => a + (gastosPorCategoria[c] ?? 0), 0),
    [gastosPorCategoria]
  )

  const totalVariables = useMemo(
    () => GASTOS_VARIABLES.reduce((a, c) => a + (gastosPorCategoria[c] ?? 0), 0),
    [gastosPorCategoria]
  )

  const margenContribucion = totalIngresos - totalVariables
  const margenPct = totalIngresos > 0 ? (margenContribucion / totalIngresos) * 100 : 0
  const peMensual = margenPct > 0 ? totalFijos / (margenPct / 100) : null

  const diasOperativos = useMemo(
    () => diasOperativosEnRango(periodo.desde, periodo.hasta) || 1,
    [diasOperativosEnRango, periodo.desde, periodo.hasta]
  )

  const ingresoMedioDiario = totalIngresos / diasOperativos

  const diaCubrePE = useMemo(() => {
    if (!peMensual || ingresoMedioDiario <= 0) return null
    const diasNecesarios = Math.ceil(peMensual / ingresoMedioDiario)
    if (diasNecesarios > diasOperativos * 1.5) return null
    const inicioMes = new Date(periodo.desde)
    inicioMes.setDate(1)
    const cur = new Date(inicioMes)
    let contados = 0
    let safety = 0
    while (contados < diasNecesarios && safety < 365) {
      if (diasOperativosEnRango(cur, cur) === 1) contados++
      if (contados >= diasNecesarios) break
      cur.setDate(cur.getDate() + 1)
      safety++
    }
    return cur
  }, [peMensual, ingresoMedioDiario, diasOperativos, periodo.desde, diasOperativosEnRango])

  const estado: 'cubre' | 'ajustado' | 'pierde' =
    peMensual == null ? 'pierde'
      : totalIngresos >= peMensual * 1.05 ? 'cubre'
      : totalIngresos >= peMensual ? 'ajustado'
      : 'pierde'

  const colorEstado = estado === 'cubre' ? VERDE : estado === 'ajustado' ? AMBAR : ROJO

  return (
    <div style={{ background: '#f5f3ef', padding: '24px 28px', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{
            color: '#B01D23',
            fontFamily: 'Oswald, sans-serif',
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '3px',
            margin: 0,
            textTransform: 'uppercase',
          }}>
            PUNTO DE EQUILIBRIO
          </h2>
          <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#7a8090', display: 'block', marginTop: 4 }}>
            {fmtFechaCorta(periodo.desde.toISOString().slice(0,10))} — {fmtFechaCorta(periodo.hasta.toISOString().slice(0,10))}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <SelectorFechaUniversal
            nombreModulo="punto_equilibrio"
            defaultOpcion="mes_en_curso"
            onChange={(desde, hasta, label) => {
              setPeriodoDesde(desde)
              setPeriodoHasta(hasta)
              setPeriodoLabel(label)
            }}
          />
        </div>
      </div>

      <TabsPastilla
        tabs={[
          { id: 'resumen', label: 'Resumen' },
          { id: 'simulador', label: 'Simulador' },
        ]}
        activeId={tab}
        onChange={(id) => setTab(id as Tab)}
      />

      {error && (
        <div style={{ background: '#FCEBEB', border: '1px solid #B01D23', color: '#A32D2D', padding: 16, borderRadius: 8, fontFamily: FONT.body, fontSize: 13, marginTop: 16 }}>
          Error: {error}
        </div>
      )}

      {loading && !error && (
        <div style={{ padding: 40, color: T.mut, fontFamily: FONT.body }}>Cargando datos reales...</div>
      )}

      {!loading && !error && tab === 'resumen' && (
        <TabResumen
          totalIngresos={totalIngresos}
          totalPedidos={totalPedidos}
          totalFijos={totalFijos}
          totalVariables={totalVariables}
          margenContribucion={margenContribucion}
          margenPct={margenPct}
          peMensual={peMensual}
          diaCubrePE={diaCubrePE}
          ingresosPorCanal={ingresosPorCanal}
          gastosPorCategoria={gastosPorCategoria}
          diasOperativos={diasOperativos}
          ingresoMedioDiario={ingresoMedioDiario}
          estado={estado}
          colorEstado={colorEstado}
          periodoLabel={periodoLabel}
        />
      )}

      {!loading && !error && tab === 'simulador' && (
        <TabSimulador
          totalIngresos={totalIngresos}
          totalFijos={totalFijos}
          totalVariables={totalVariables}
          margenPct={margenPct}
          peMensual={peMensual}
          diasOperativos={diasOperativos}
          totalPedidos={totalPedidos}
          ingresosPorCanal={ingresosPorCanal}
        />
      )}
    </div>
  )
}

/* TAB RESUMEN */

interface TabResumenProps {
  totalIngresos: number
  totalPedidos: number
  totalFijos: number
  totalVariables: number
  margenContribucion: number
  margenPct: number
  peMensual: number | null
  diaCubrePE: Date | null
  ingresosPorCanal: Map<string, number>
  gastosPorCategoria: Partial<Record<Categoria, number>>
  diasOperativos: number
  ingresoMedioDiario: number
  estado: 'cubre' | 'ajustado' | 'pierde'
  colorEstado: string
  periodoLabel: string
}

function TabResumen(p: TabResumenProps) {
  const { T } = useTheme()

  const segIngresos = Array.from(p.ingresosPorCanal.entries())
    .map(([canal, importe]) => ({
      label: CANAL_INFO[canal]?.label ?? canal,
      valor: importe,
      color: CANAL_INFO[canal]?.color ?? '#7a8090',
    }))
    .filter(s => s.valor > 0)
    .sort((a, b) => b.valor - a.valor)

  const segFijos = GASTOS_FIJOS
    .map(cat => ({
      label: CATEGORIA_NOMBRE[cat],
      valor: p.gastosPorCategoria[cat] ?? 0,
      color: CATEGORIA_COLOR[cat],
    }))
    .filter(s => s.valor > 0)
    .sort((a, b) => b.valor - a.valor)

  const segVariables = GASTOS_VARIABLES
    .map(cat => ({
      label: CATEGORIA_NOMBRE[cat],
      valor: p.gastosPorCategoria[cat] ?? 0,
      color: CATEGORIA_COLOR[cat],
    }))
    .filter(s => s.valor > 0)

  const pctCubierto = p.peMensual ? Math.min(100, (p.totalIngresos / p.peMensual) * 100) : 0
  const ticketMedio = p.totalPedidos > 0 ? p.totalIngresos / p.totalPedidos : 0

  return (
    <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 14,
        marginBottom: 18,
        marginTop: 16,
      }}>
        <CardGrande
          label="Ingresos del periodo"
          valor={fmtNum(p.totalIngresos)}
          deltaText={p.totalPedidos > 0 ? `${fmtNum(p.totalPedidos)} pedidos · medio ${fmtNum(ticketMedio, 2)}` : 'Sin pedidos en el periodo'}
          deltaColor={T.mut}
          segmentos={segIngresos}
        />

        <CardGrande
          label="Costes fijos"
          valor={fmtNum(p.totalFijos)}
          deltaText="Categorías canónicas plan contable"
          deltaColor={T.mut}
          segmentos={segFijos}
        />

        <CardGrande
          label="Costes variables"
          valor={fmtNum(p.totalVariables)}
          deltaText={p.totalIngresos > 0 ? `${fmtPct(p.totalVariables / p.totalIngresos * 100)} sobre ingresos · margen ${fmtPct(p.margenPct)}` : 'Sin ingresos en el periodo'}
          deltaColor={T.mut}
          segmentos={segVariables}
        />

        <CardPE
          peMensual={p.peMensual}
          totalIngresos={p.totalIngresos}
          pctCubierto={pctCubierto}
          diaCubrePE={p.diaCubrePE}
          colorEstado={p.colorEstado}
          estado={p.estado}
          diasOperativos={p.diasOperativos}
        />
      </div>

      <div style={{
        background: '#fff',
        border: `0.5px solid ${T.brd}`,
        borderRadius: 16,
        padding: '20px 24px',
        marginBottom: 18,
      }}>
        <div style={{
          fontFamily: FONT.heading,
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: '2px',
          textTransform: 'uppercase',
          color: T.mut,
          marginBottom: 12,
        }}>
          Estado del periodo
        </div>
        <div style={{
          padding: '14px 18px',
          borderRadius: 10,
          background: `${p.colorEstado}15`,
          border: `1px solid ${p.colorEstado}40`,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: p.colorEstado, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 18, fontWeight: 600, color: T.pri }}>
              {p.estado === 'cubre' ? 'Cubres punto de equilibrio'
                : p.estado === 'ajustado' ? 'Ajustado — al límite'
                : 'No cubres punto de equilibrio'}
            </div>
            <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec, marginTop: 4, lineHeight: 1.4 }}>
              {p.peMensual == null
                ? 'Sin margen suficiente para calcular el PE.'
                : p.estado === 'cubre'
                  ? `Vas ${fmtNum(p.totalIngresos - p.peMensual)} por encima del PE (${fmtNum(p.peMensual)}). Excedente que tira al beneficio.`
                  : p.estado === 'ajustado'
                    ? `Vas ${fmtNum(p.totalIngresos - p.peMensual)} sobre el PE (${fmtNum(p.peMensual)}). Margen muy fino.`
                    : `Te faltan ${fmtNum(p.peMensual - p.totalIngresos)} para alcanzar el PE (${fmtNum(p.peMensual)}).`}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

interface SegItem { label: string; valor: number; color: string }

function CardGrande({ label, valor, deltaText, deltaColor, segmentos }: {
  label: string
  valor: string
  deltaText?: string
  deltaColor?: string
  segmentos: SegItem[]
}) {
  const { T } = useTheme()
  const total = segmentos.reduce((a, s) => a + Math.max(0, s.valor), 0)

  return (
    <div style={{
      background: '#fff',
      border: `0.5px solid ${T.brd}`,
      borderRadius: 16,
      padding: '24px 28px',
    }}>
      <div style={{
        fontFamily: FONT.heading,
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: '2px',
        textTransform: 'uppercase',
        color: T.mut,
        marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: FONT.heading,
        fontSize: 38,
        fontWeight: 600,
        color: T.pri,
        lineHeight: 1.05,
      }}>
        {valor}
      </div>
      {deltaText && (
        <div style={{ fontFamily: FONT.body, fontSize: 12, color: deltaColor ?? T.mut, marginTop: 4 }}>
          {deltaText}
        </div>
      )}

      {segmentos.length > 0 && total > 0 && (
        <>
          <div style={{
            height: 8, borderRadius: 4,
            background: T.brd, overflow: 'hidden',
            display: 'flex', marginTop: 12,
          }}>
            {segmentos.map((s, i) => (
              <div key={i} style={{
                width: `${(s.valor / total) * 100}%`,
                background: s.color,
                height: '100%',
              }} title={`${s.label}: ${fmtNum(s.valor)}`} />
            ))}
          </div>

          <div style={{ marginTop: 14 }}>
            {segmentos.map((s, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', padding: '8px 0',
                borderBottom: i < segmentos.length - 1 ? `0.5px solid #ebe8e2` : 'none',
                fontSize: 12,
              }}>
                <span style={{ color: T.sec, fontFamily: FONT.body, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: 4,
                    background: s.color, display: 'inline-block',
                  }} />
                  {s.label}
                </span>
                <span style={{
                  fontFamily: FONT.heading, fontSize: 13, fontWeight: 500,
                  color: T.pri,
                }}>
                  {fmtNum(s.valor)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {segmentos.length === 0 && (
        <div style={{ marginTop: 16, fontFamily: FONT.body, fontSize: 12, color: T.mut, fontStyle: 'italic' }}>
          Sin movimientos en el periodo seleccionado
        </div>
      )}
    </div>
  )
}

function CardPE({ peMensual, totalIngresos, pctCubierto, diaCubrePE, colorEstado, estado, diasOperativos }: {
  peMensual: number | null
  totalIngresos: number
  pctCubierto: number
  diaCubrePE: Date | null
  colorEstado: string
  estado: 'cubre' | 'ajustado' | 'pierde'
  diasOperativos: number
}) {
  const { T } = useTheme()

  const diaTexto = diaCubrePE ? `${diaCubrePE.getDate()}` : '—'
  const mesTexto = diaCubrePE ? MESES_ES[diaCubrePE.getMonth()].slice(0, 3).toUpperCase() : ''

  return (
    <div style={{
      background: 'linear-gradient(180deg, #fff 0%, #1D9E7508 100%)',
      border: `0.5px solid ${T.brd}`,
      borderRadius: 16,
      padding: '24px 28px',
    }}>
      <div style={{
        fontFamily: FONT.heading,
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: '2px',
        textTransform: 'uppercase',
        color: T.mut,
        marginBottom: 8,
      }}>
        Punto de equilibrio
      </div>
      <div style={{
        fontFamily: FONT.heading,
        fontSize: 38,
        fontWeight: 600,
        color: T.pri,
        lineHeight: 1.05,
      }}>
        {peMensual != null ? fmtNum(peMensual) : '—'}
      </div>
      <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, marginTop: 4 }}>
        Ingresos para no perder
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16 }}>
        <div style={{
          width: 78, height: 78, borderRadius: '50%',
          background: colorEstado, color: '#fff',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 28, fontWeight: 600, lineHeight: 1 }}>
            {diaTexto}
          </div>
          {mesTexto && (
            <div style={{ fontFamily: FONT.heading, fontSize: 9, fontWeight: 500, letterSpacing: 1, marginTop: 3 }}>
              {mesTexto}
            </div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: 1.5, color: T.mut, textTransform: 'uppercase' }}>
            Día en que se cubre
          </div>
          <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec, marginTop: 4, lineHeight: 1.4 }}>
            {diaCubrePE == null
              ? 'Al ritmo actual no se cubre dentro de los días operativos.'
              : estado === 'cubre'
                ? `Cubierto al ritmo medio del periodo.`
                : `Estimación al ritmo medio (${diasOperativos} días operativos).`}
          </div>
        </div>
      </div>

      {peMensual != null && (
        <>
          <div style={{
            height: 8, borderRadius: 4, background: T.brd,
            overflow: 'hidden', marginTop: 14,
          }}>
            <div style={{
              width: `${pctCubierto}%`,
              height: '100%',
              background: colorEstado,
              transition: 'width 0.5s ease',
            }} />
          </div>
          <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginTop: 6 }}>
            Cubierto {fmtPct(pctCubierto)} {totalIngresos < peMensual ? `· faltan ${fmtNum(peMensual - totalIngresos)}` : `· excedente ${fmtNum(totalIngresos - peMensual)}`}
          </div>
        </>
      )}
    </div>
  )
}

/* TAB SIMULADOR */

interface Escenario {
  id: string
  titulo: string
  pill: 'base' | 'mejora' | 'empeora' | 'mixto'
  pillLabel: string
  ticketMedio: number
  margenPct: number
  fijos: number
  mixWebPct: number
  bloqueado?: boolean
}

function TabSimulador(p: {
  totalIngresos: number
  totalFijos: number
  totalVariables: number
  margenPct: number
  peMensual: number | null
  diasOperativos: number
  totalPedidos: number
  ingresosPorCanal: Map<string, number>
}) {
  const { T } = useTheme()

  const ticketMedioBase = p.totalPedidos > 0 ? p.totalIngresos / p.totalPedidos : 0
  const mixWebBase = p.totalIngresos > 0
    ? ((p.ingresosPorCanal.get('WEB') ?? 0) + (p.ingresosPorCanal.get('DIRECTA') ?? 0)) / p.totalIngresos * 100
    : 0

  const baseEscenario: Escenario = {
    id: 'base',
    titulo: 'Datos reales del periodo',
    pill: 'base',
    pillLabel: 'Base',
    ticketMedio: ticketMedioBase,
    margenPct: p.margenPct,
    fijos: p.totalFijos,
    mixWebPct: mixWebBase,
    bloqueado: true,
  }

  const [escenarios, setEscenarios] = useState<Escenario[]>([
    baseEscenario,
    {
      id: 'mejora-ticket',
      titulo: 'Subir ticket medio +1',
      pill: 'mejora',
      pillLabel: 'Mejora',
      ticketMedio: ticketMedioBase + 1,
      margenPct: p.margenPct,
      fijos: p.totalFijos,
      mixWebPct: mixWebBase,
    },
    {
      id: 'mejora-web',
      titulo: '+10pp tienda online',
      pill: 'mejora',
      pillLabel: 'Mejora',
      ticketMedio: ticketMedioBase,
      margenPct: p.margenPct + 3,
      fijos: p.totalFijos,
      mixWebPct: mixWebBase + 10,
    },
    {
      id: 'empeora-fijos',
      titulo: '+ persona en plantilla',
      pill: 'empeora',
      pillLabel: 'Empeora',
      ticketMedio: ticketMedioBase,
      margenPct: p.margenPct,
      fijos: p.totalFijos + 1800,
      mixWebPct: mixWebBase,
    },
  ])

  useEffect(() => {
    setEscenarios(prev => {
      if (prev.length === 0) return prev
      const updated = [...prev]
      updated[0] = baseEscenario
      return updated
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.totalIngresos, p.totalFijos, p.margenPct, p.totalPedidos])

  function actualizarEscenario(id: string, campo: keyof Escenario, valor: number) {
    setEscenarios(prev => prev.map(e => e.id === id ? { ...e, [campo]: valor } : e))
  }

  function calcularPE(e: Escenario): number | null {
    return e.margenPct > 0 ? e.fijos / (e.margenPct / 100) : null
  }

  function calcularDiasNecesarios(e: Escenario): number | null {
    const peValor = calcularPE(e)
    if (!peValor) return null
    const ingresoMedioDiario = p.diasOperativos > 0 ? p.totalIngresos / p.diasOperativos : 0
    if (ingresoMedioDiario <= 0) return null
    return Math.ceil(peValor / ingresoMedioDiario)
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{
        fontFamily: FONT.body, fontSize: 12, color: T.sec,
        marginBottom: 14, lineHeight: 1.5,
      }}>
        Edita cualquier campo en cualquier escenario · todos se recalculan en vivo. La base usa datos reales del periodo seleccionado.
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 14,
      }}>
        {escenarios.map(e => (
          <CardEscenario
            key={e.id}
            escenario={e}
            peValor={calcularPE(e)}
            diasNecesarios={calcularDiasNecesarios(e)}
            peBase={p.peMensual}
            onChange={(campo, valor) => actualizarEscenario(e.id, campo, valor)}
          />
        ))}
      </div>
    </div>
  )
}

function CardEscenario({ escenario, peValor, diasNecesarios, peBase, onChange }: {
  escenario: Escenario
  peValor: number | null
  diasNecesarios: number | null
  peBase: number | null
  onChange: (campo: keyof Escenario, valor: number) => void
}) {
  const { T } = useTheme()
  const e = escenario

  const PILL_BG: Record<Escenario['pill'], string> = {
    base: '#3a4050', mejora: '#1D9E75', empeora: '#E24B4A', mixto: '#f5a623',
  }

  const deltaPE = peValor != null && peBase != null ? peValor - peBase : null

  return (
    <div style={{
      background: '#fff',
      border: e.bloqueado ? `1.5px solid #3a4050` : `0.5px solid ${T.brd}`,
      borderRadius: 14,
      padding: 18,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{
          fontFamily: FONT.heading, fontSize: 13, fontWeight: 600,
          letterSpacing: '1px', textTransform: 'uppercase', color: T.pri,
        }}>
          {e.titulo}
        </div>
        <span style={{
          fontFamily: FONT.heading, fontSize: 10, fontWeight: 500,
          letterSpacing: '1px', padding: '3px 8px', borderRadius: 4,
          textTransform: 'uppercase', background: PILL_BG[e.pill], color: '#fff',
        }}>
          {e.pillLabel}
        </span>
      </div>

      <RowInput label="Ticket medio" value={e.ticketMedio} decimales={2}
        onChange={v => onChange('ticketMedio', v)} bloqueado={e.bloqueado} />
      <RowInput label="Margen contribución (%)" value={e.margenPct} decimales={1}
        onChange={v => onChange('margenPct', v)} bloqueado={e.bloqueado} />
      <RowInput label="Costes fijos" value={e.fijos} decimales={0}
        onChange={v => onChange('fijos', v)} bloqueado={e.bloqueado} />
      <RowInput label="% tienda online" value={e.mixWebPct} decimales={0}
        onChange={v => onChange('mixWebPct', v)} bloqueado={e.bloqueado} />

      <div style={{
        background: '#ebe8e2', borderRadius: 8, padding: 12, marginTop: 12,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <span style={{
            fontFamily: FONT.heading, fontSize: 10, fontWeight: 500,
            letterSpacing: '1px', textTransform: 'uppercase', color: T.mut,
          }}>
            Punto de equilibrio
          </span>
          <span style={{
            fontFamily: FONT.heading, fontSize: 22, fontWeight: 600, color: T.pri,
          }}>
            {peValor != null ? fmtNum(peValor) : '—'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <span style={{
            fontFamily: FONT.heading, fontSize: 10, fontWeight: 500,
            letterSpacing: '1px', textTransform: 'uppercase', color: T.mut,
          }}>
            Días para cubrirlo
          </span>
          <span style={{
            fontFamily: FONT.heading, fontSize: 18, fontWeight: 600, color: T.pri,
          }}>
            {diasNecesarios != null ? `${diasNecesarios} días` : '—'}
          </span>
        </div>
        {!e.bloqueado && deltaPE != null && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{
              fontFamily: FONT.heading, fontSize: 10, fontWeight: 500,
              letterSpacing: '1px', textTransform: 'uppercase', color: T.mut,
            }}>
              Vs base
            </span>
            <span style={{
              fontSize: 13, fontWeight: 500,
              color: deltaPE < 0 ? VERDE : deltaPE > 0 ? '#E24B4A' : T.mut,
            }}>
              {deltaPE < 0 ? '−' : deltaPE > 0 ? '+' : ''}{fmtNum(Math.abs(deltaPE))}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function RowInput({ label, value, decimales, onChange, bloqueado }: {
  label: string
  value: number
  decimales: number
  onChange: (v: number) => void
  bloqueado?: boolean
}) {
  const { T } = useTheme()
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 90px',
      gap: 10, alignItems: 'center', padding: '7px 0',
    }}>
      <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec }}>{label}</span>
      <input
        type="number"
        step={decimales > 0 ? 0.01 : 1}
        value={Number.isFinite(value) ? value.toFixed(decimales) : ''}
        disabled={bloqueado}
        onChange={(ev) => {
          const n = parseFloat(ev.target.value)
          if (!isNaN(n)) onChange(n)
        }}
        style={{
          width: '100%', padding: '6px 10px',
          border: `0.5px solid ${T.brd}`,
          borderRadius: 6, fontSize: 13,
          fontFamily: FONT.heading, fontWeight: 500,
          background: bloqueado ? '#ebe8e2' : '#fff',
          color: bloqueado ? T.mut : T.pri,
          textAlign: 'right',
          outline: 'none',
          cursor: bloqueado ? 'not-allowed' : 'text',
        }}
      />
    </div>
  )
}
