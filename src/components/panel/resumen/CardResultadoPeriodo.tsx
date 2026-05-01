/**
 * CardResultadoPeriodo — Ronda 8
 * R8-04: % s/netos siempre visible (color #3a4050 mínimo, rojo o verde según valor)
 * R8-05: PRIME COST con lógica invertida (menos es mejor)
 *        - color del % cabecera: verde si <= objetivo, rojo en cualquier otro caso
 *        - barra: si > 100% mostrar barra llena en rojo (alarma)
 * Mantiene: cascada con facturación real + estimaciones, Comisiones y Provisiones eliminadas
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur, fmtNum, fmtPct } from '@/lib/format'
import { COLOR, OSWALD, LEXEND, cardBig, lbl, lblXs, lblSm } from './tokens'
import { EditableInline } from '@/components/ui/EditableInline'

interface RunningRow {
  ingresos_brutos: number | null
  comisiones_plataforma: number | null
  iva_comisiones: number | null
  ingresos_netos: number | null
  producto: number | null
  margen_bruto: number | null
  personal: number | null
  local: number | null
  controlables: number | null
  provisiones_iva: number | null
  provisiones_irpf: number | null
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
  facturacionBruta?: number
  margenNetoEstimadoPct?: number
  año?: number
  mes?: number
}

export default function CardResultadoPeriodo({
  ebitda, ebitdaPct, deltaPp,
  primeCostPct,
  facturacionBruta,
  margenNetoEstimadoPct,
  año, mes,
}: Props) {
  const [running, setRunning] = useState<RunningRow | null>(null)
  const [kpiObj, setKpiObj] = useState<KpiObjetivos | null>(null)
  const [kpiVersion, setKpiVersion] = useState(0)

  const añoActual = año ?? new Date().getFullYear()
  const mesActual = mes ?? (new Date().getMonth() + 1)

  useEffect(() => {
    supabase
      .from('running')
      .select('*')
      .eq('año', añoActual)
      .eq('mes', mesActual)
      .maybeSingle()
      .then(({ data }) => {
        setRunning(data as RunningRow | null)
      })
  }, [añoActual, mesActual])

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

  // R8-05: Prime cost lógica invertida — menos es mejor
  const objetivoPC = kpiObj?.prime_cost_target ?? 60
  const primeCostColor = primeCostPct <= objetivoPC ? COLOR.verde : '#B01D23'

  const r = running

  const facturacion = facturacionBruta ?? r?.ingresos_brutos ?? null

  const tieneNetoReal = r?.ingresos_netos != null
  let ingresosNetos: number | null = null
  let netoEsEstimado = false
  if (tieneNetoReal) {
    ingresosNetos = r!.ingresos_netos
  } else if (facturacion != null && margenNetoEstimadoPct != null && margenNetoEstimadoPct > 0) {
    ingresosNetos = facturacion * (margenNetoEstimadoPct / 100)
    netoEsEstimado = true
  }

  const producto = r?.producto ?? null
  const margenBruto = (ingresosNetos != null && producto != null)
    ? ingresosNetos - producto
    : null
  const personal = r?.personal ?? null
  const localControlables = r ? (r.local != null || r.controlables != null
    ? (r.local ?? 0) + (r.controlables ?? 0)
    : null) : null

  const resultadoLimpioCalc = (margenBruto != null && personal != null && localControlables != null)
    ? margenBruto - personal - localControlables
    : (r?.resultado_limpio ?? null)

  function valNum(v: number | null | undefined, esEstimado = false): string {
    if (v === null || v === undefined) return 'Datos insuficientes'
    const txt = fmtEur(v, { showEuro: false, decimals: 2 })
    return esEstimado ? `${txt} *` : txt
  }

  const sinDatosCascada = facturacion == null && ingresosNetos == null && resultadoLimpioCalc == null

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
          {/* R8-04: % s/netos siempre visible — color oscuro mínimo */}
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
          tooltip="Ventas brutas del periodo (introducidas en módulo Facturación)"
        />
        <LineaPyG
          label="Ingresos netos"
          valor={valNum(ingresosNetos, netoEsEstimado)}
          tooltip={netoEsEstimado ? "Estimado a partir del margen neto del periodo" : "Ingresos netos reales del running"}
          bold
        />
        <LineaPyG
          label="Producto"
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
          label="Personal"
          valor={valNum(personal)}
          tooltip="Sueldos + SS + sueldos socios"
        />
        <LineaPyG
          label="Local + Controlables"
          valor={valNum(localControlables)}
          tooltip="Alquiler + suministros + marketing + software + gestoría + bancos + transporte + seguros"
        />
        <LineaPyG
          label="Resultado limpio"
          valor={valNum(resultadoLimpioCalc)}
          tooltip="Margen bruto − Personal − Local + Controlables"
          bold
          colorVal={resultadoLimpioCalc != null ? (resultadoLimpioCalc >= 0 ? COLOR.verde : COLOR.rojo) : undefined}
        />
        {netoEsEstimado && (
          <div style={{ fontSize: 10, color: '#7a8090', marginTop: 6, fontFamily: LEXEND, fontStyle: 'italic' }}>
            * estimado a partir del margen neto medio del periodo
          </div>
        )}
      </div>

      {/* R8-05: Prime Cost barra invertida — si supera objetivo, llenar en rojo */}
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

// R8-05: barra Prime Cost invertida (menos es mejor)
function BarraPrimeCost({ pctActual, objetivo }: { pctActual: number; objetivo: number }) {
  // Si pctActual <= objetivo: barra verde proporcional al uso
  // Si pctActual > objetivo: barra completamente roja como alarma
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
