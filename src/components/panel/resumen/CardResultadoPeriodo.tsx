/**
 * CardResultadoPeriodo — Ronda 10
 * R10-01: cascada usa rango fechaDesde/fechaHasta del periodo (oculto al usuario)
 * R10-02: prioridad de fuentes:
 *   1) tabla running mensual si existe row → usa esos valores
 *   2) fallback → valores calculados desde gastos (recibidos por props desde TabResumen)
 * R10-03: facturación e ingresos netos siempre del periodo elegido (vienen ya filtrados)
 *
 * Cuando Conciliación pueble running con agregados mensuales:
 *   - si periodo elegido = mes completo Y existe row running → priorizar running
 *   - si periodo elegido ≠ mes completo (semana, rango custom) → siempre cálculo desde gastos
 *   - si no hay running ni gastos → "Datos insuficientes"
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur, fmtNum, fmtPct } from '@/lib/format'
import { COLOR, OSWALD, LEXEND, cardBig, lbl, lblXs, lblSm } from './tokens'
import { EditableInline } from '@/components/ui/EditableInline'

interface RunningRow {
  ingresos_brutos: number | null
  ingresos_netos: number | null
  producto: number | null
  margen_bruto: number | null
  personal: number | null
  local: number | null
  controlables: number | null
  resultado_limpio: number | null
}

interface KpiObjetivos {
  id: number
  prime_cost_target: number | null
}

interface Props {
  ebitda: number
  ebitdaPct: number
  deltaPp: number | null
  netosEstimados: number
  netosReales: number
  totalGastos: number
  resultadoLimpio: number
  primeCostPct: number
  /** Facturación bruta del periodo seleccionado (siempre disponible, la mete Rubén) */
  facturacionBruta?: number
  /** % margen neto estimado del periodo (calculado en CardVentas) */
  margenNetoEstimadoPct?: number
  /** R10-02: gastos del periodo desde tabla gastos, agrupados (fallback cuando running está vacío) */
  gastosPorGrupo?: {
    producto: number
    equipo: number
    local: number
    controlables: number
  }
  /** R10-01: rango del periodo elegido. Oculto al usuario, solo determina el filtro */
  fechaDesde?: Date
  fechaHasta?: Date
  año?: number
  mes?: number
}

export default function CardResultadoPeriodo({
  ebitda, ebitdaPct, deltaPp,
  primeCostPct,
  facturacionBruta,
  margenNetoEstimadoPct,
  gastosPorGrupo,
  fechaDesde,
  fechaHasta,
  año, mes,
}: Props) {
  const [running, setRunning] = useState<RunningRow | null>(null)
  const [kpiObj, setKpiObj] = useState<KpiObjetivos | null>(null)
  const [kpiVersion, setKpiVersion] = useState(0)

  const añoActual = año ?? new Date().getFullYear()
  const mesActual = mes ?? (new Date().getMonth() + 1)

  // R10-02: solo intenta priorizar running cuando el periodo es exactamente un mes completo
  const esMesCompleto = (() => {
    if (!fechaDesde || !fechaHasta) return false
    const inicioMes = new Date(fechaDesde.getFullYear(), fechaDesde.getMonth(), 1)
    const finMes = new Date(fechaDesde.getFullYear(), fechaDesde.getMonth() + 1, 0)
    const sameStart = fechaDesde.getDate() === 1
    const sameEnd = fechaHasta.getDate() === finMes.getDate() &&
                    fechaHasta.getMonth() === finMes.getMonth() &&
                    fechaHasta.getFullYear() === finMes.getFullYear()
    return sameStart && sameEnd
  })()

  useEffect(() => {
    if (!esMesCompleto) {
      setRunning(null)
      return
    }
    const añoConsulta = fechaDesde?.getFullYear() ?? añoActual
    const mesConsulta = fechaDesde ? fechaDesde.getMonth() + 1 : mesActual

    supabase
      .from('running')
      .select('ingresos_brutos, ingresos_netos, producto, margen_bruto, personal, local, controlables, resultado_limpio')
      .eq('año', añoConsulta)
      .eq('mes', mesConsulta)
      .maybeSingle()
      .then(({ data }) => {
        setRunning(data as RunningRow | null)
      })
  }, [esMesCompleto, fechaDesde?.getTime(), añoActual, mesActual])

  useEffect(() => {
    supabase
      .from('kpi_objetivos')
      .select('id, prime_cost_target')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setKpiObj(data as KpiObjetivos | null)
      })
  }, [kpiVersion])

  const colorEbitda = ebitda >= 0 ? COLOR.verde : COLOR.rojo
  const flecha = (deltaPp ?? 0) >= 0 ? '▲' : '▼'
  const colorDelta = (deltaPp ?? 0) >= 0 ? COLOR.verde : COLOR.rojo

  const objetivoPC = kpiObj?.prime_cost_target ?? 60
  const primeCostColor = primeCostPct <= objetivoPC ? COLOR.verde : '#B01D23'

  // R10-02: resolución de cada fila — prioridad running, fallback gastos
  function resolverValor(
    valorRunning: number | null | undefined,
    valorGastos: number | undefined
  ): number | null {
    if (valorRunning != null) return valorRunning
    if (valorGastos != null && valorGastos > 0) return valorGastos
    return null
  }

  // Línea 1: Facturación
  const facturacion = facturacionBruta ?? running?.ingresos_brutos ?? null

  // Línea 2: Ingresos netos
  const tieneNetoReal = running?.ingresos_netos != null
  let ingresosNetos: number | null = null
  if (tieneNetoReal) {
    ingresosNetos = running!.ingresos_netos
  } else if (facturacion != null && margenNetoEstimadoPct != null && margenNetoEstimadoPct > 0) {
    ingresosNetos = facturacion * (margenNetoEstimadoPct / 100)
  }

  // Línea 3: Producto · COGS — running > gastos
  const producto = resolverValor(running?.producto, gastosPorGrupo?.producto) ?? 0

  // Línea 4: Margen bruto = netos - producto
  const margenBruto = ingresosNetos != null
    ? ingresosNetos - producto
    : null

  // Línea 5: Equipo
  const equipo = resolverValor(running?.personal, gastosPorGrupo?.equipo)

  // Líneas 6-7: Local y Controlables
  const local = resolverValor(running?.local, gastosPorGrupo?.local)
  const controlables = resolverValor(running?.controlables, gastosPorGrupo?.controlables)

  // Línea 8: Resultado neto
  const resultadoNetoCalc = margenBruto != null
    ? margenBruto - (equipo ?? 0) - (local ?? 0) - (controlables ?? 0)
    : null

  const mostrarResultadoNeto = resultadoNetoCalc != null && Math.abs(resultadoNetoCalc - ebitda) > 0.01

  function valNum(v: number | null | undefined): string {
    if (v === null || v === undefined) return 'Datos insuficientes'
    return fmtNum(v, 2)
  }

  const sinDatosCascada = facturacion == null && ingresosNetos == null

  return (
    <div style={cardBig}>
      <div style={lbl}>RESULTADO</div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: OSWALD, fontSize: 38, fontWeight: 600, color: sinDatosCascada ? '#3a4050' : colorEbitda }}>
            {sinDatosCascada
              ? 'Datos insuficientes'
              : fmtEur(ebitda, { showEuro: true, decimals: 2 })}
          </div>
          <div style={lblXs}>EBITDA</div>
        </div>
        <div>
          <div style={{ fontFamily: OSWALD, fontSize: 24, fontWeight: 600, color: sinDatosCascada ? '#3a4050' : colorEbitda }}>
            {sinDatosCascada ? '—' : `${fmtNum(ebitdaPct, 0)}%`}
          </div>
          <div style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: '1.5px', color: '#3a4050', fontWeight: 600 }}>
            % s/netos
          </div>
        </div>
      </div>

      {deltaPp !== null && !sinDatosCascada && (
        <div style={{ fontSize: 12, color: colorDelta, margin: '10px 0 16px', fontFamily: LEXEND }}>
          {flecha} {fmtNum(Math.abs(deltaPp), 1)} puntos porcentuales vs anterior
        </div>
      )}

      <div style={{ borderTop: `0.5px solid ${COLOR.borde}`, paddingTop: 12 }}>
        <LineaPyG
          label="Facturación"
          valor={valNum(facturacion)}
          tooltip="Ventas brutas del periodo (módulo Facturación)"
        />
        <LineaPyG
          label="Ingresos netos"
          valor={valNum(ingresosNetos)}
          tooltip="Ingresos netos del periodo (real o estimado vía margen neto)"
          bold
        />
        <LineaPyG
          label="Producto · COGS"
          valor={valNum(producto)}
          tooltip="Food cost + bebida + packaging + mermas"
        />
        <LineaPyG
          label="Margen bruto"
          valor={valNum(margenBruto)}
          tooltip="Ingresos netos − Producto"
          bold
        />
        <LineaPyG
          label="Equipo"
          valor={valNum(equipo)}
          tooltip="Sueldos + SS + sueldos socios"
        />
        <LineaPyG
          label="Local"
          valor={valNum(local)}
          tooltip="Alquiler + suministros + seguros"
        />
        <LineaPyG
          label="Controlables"
          valor={valNum(controlables)}
          tooltip="Marketing + software + gestoría + bancos + transporte"
        />
        {mostrarResultadoNeto && (
          <LineaPyG
            label="Resultado neto"
            valor={valNum(resultadoNetoCalc)}
            tooltip="Margen bruto − Equipo − Local − Controlables"
            bold
            colorVal={resultadoNetoCalc != null ? (resultadoNetoCalc >= 0 ? COLOR.verde : COLOR.rojo) : undefined}
          />
        )}
      </div>

      <div style={{ borderTop: `0.5px solid ${COLOR.borde}`, paddingTop: 12, marginTop: 12 }}>
        <div style={{ ...lblSm, display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={lblSm} title="COGS + Personal sobre netos. KPI hostelería. Menos es mejor.">PRIME COST</span>
          <span style={{ ...lblSm, color: primeCostColor }}>{fmtPct(primeCostPct, 2)}</span>
        </div>
        <BarraPrimeCost pctActual={primeCostPct} objetivo={objetivoPC} />
        <div style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', fontFamily: LEXEND, marginTop: 4 }}>
          <span>
            <span style={{ color: COLOR.verde }}>Objetivo</span>{' '}
            <EditableInline
              valor={kpiObj?.prime_cost_target ?? 60}
              tabla="kpi_objetivos"
              campo="prime_cost_target"
              filtros={{}}
              decimales={0}
              unidad="%"
              color="#1D9E75"
              onUpdate={() => setKpiVersion(v => v + 1)}
            />
          </span>
        </div>
      </div>
    </div>
  )
}

function BarraPrimeCost({ pctActual, objetivo }: { pctActual: number; objetivo: number }) {
  const dentroObjetivo = pctActual <= objetivo
  const fillPct = dentroObjetivo
    ? Math.min(100, (pctActual / objetivo) * 100)
    : 100
  const colorFill = dentroObjetivo ? '#1D9E75' : '#B01D23'

  return (
    <div style={{ height: 8, borderRadius: 4, background: '#ebe8e2', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${fillPct}%`, background: colorFill, transition: 'width 0.4s' }} />
    </div>
  )
}

function LineaPyG({
  label, valor, tooltip, bold, colorVal
}: {
  label: string
  valor: string
  tooltip?: string
  bold?: boolean
  colorVal?: string
}) {
  return (
    <div
      title={tooltip}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 12,
        marginBottom: 4,
        fontFamily: 'Lexend, sans-serif',
        fontWeight: bold ? 500 : 400,
      }}
    >
      <span style={{ color: '#7a8090', cursor: tooltip ? 'help' : 'default' }}>{label}</span>
      <span style={{ color: colorVal ?? (valor === 'Datos insuficientes' ? '#7a8090' : '#111111'), fontStyle: valor === 'Datos insuficientes' ? 'italic' : 'normal' }}>{valor}</span>
    </div>
  )
}
