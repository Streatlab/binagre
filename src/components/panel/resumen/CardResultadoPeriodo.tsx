/**
 * CardResultadoPeriodo — Ronda 7
 * R7-05: cascada con datos reales disponibles (facturación de Rubén) + estimaciones cuando falten
 *   - "Ingresos brutos" → "Facturación" (usa el bruto que mete Rubén)
 *   - "Comisiones + IVA" → eliminada
 *   - "Provisiones" → eliminada (se ven en CardProvisiones)
 *   - "Ingresos netos" estimado vía margen neto si no hay running
 *   - "Margen bruto" calculado = ingresos netos - producto
 *   - "Resultado limpio" calculado = margen bruto - personal - local - controlables
 *   - % s/netos color según barra (verde si OK, rojo en cualquier otro caso, nunca amarillo invisible)
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur, fmtNum, fmtPct } from '@/lib/format'
import { COLOR, OSWALD, LEXEND, cardBig, lbl, lblXs, lblSm } from './tokens'
import { BarraCumplimiento } from '@/components/ui/BarraCumplimiento'
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
  /** Facturación bruta del periodo (la que mete Rubén a mano) */
  facturacionBruta?: number
  /** % margen neto estimado del periodo (viene de CardVentas) */
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

  // R7-05: % s/netos: verde si prime cost <= objetivo, rojo en cualquier otro caso (nunca amarillo)
  const objetivoPC = kpiObj?.prime_cost_target ?? 60
  const primeCostColor = primeCostPct <= objetivoPC ? COLOR.verde : '#B01D23'
  const pcCapped = Math.min(100, Math.max(0, primeCostPct))

  // R7-05: lógica de cascada con datos reales + estimaciones
  const r = running

  // Línea 1: FACTURACIÓN — viene de la facturación que mete Rubén (siempre disponible)
  const facturacion = facturacionBruta ?? r?.ingresos_brutos ?? null

  // Línea 3: INGRESOS NETOS — real si existe, si no estimado vía margen neto
  const tieneNetoReal = r?.ingresos_netos != null
  let ingresosNetos: number | null = null
  let netoEsEstimado = false
  if (tieneNetoReal) {
    ingresosNetos = r!.ingresos_netos
  } else if (facturacion != null && margenNetoEstimadoPct != null && margenNetoEstimadoPct > 0) {
    ingresosNetos = facturacion * (margenNetoEstimadoPct / 100)
    netoEsEstimado = true
  }

  // Línea 4: PRODUCTO
  const producto = r?.producto ?? null

  // Línea 5: MARGEN BRUTO calculado
  const margenBruto = (ingresosNetos != null && producto != null)
    ? ingresosNetos - producto
    : null

  // Línea 6: PERSONAL
  const personal = r?.personal ?? null

  // Línea 7: LOCAL + CONTROLABLES
  const localControlables = r ? (r.local != null || r.controlables != null
    ? (r.local ?? 0) + (r.controlables ?? 0)
    : null) : null

  // Línea 8: RESULTADO LIMPIO calculado
  const resultadoLimpioCalc = (margenBruto != null && personal != null && localControlables != null)
    ? margenBruto - personal - localControlables
    : (r?.resultado_limpio ?? null)

  // Helpers cascada
  function valNum(v: number | null | undefined, esEstimado = false): string {
    if (v === null || v === undefined) return 'Datos insuficientes'
    const txt = fmtEur(v, { showEuro: false, decimals: 2 })
    return esEstimado ? `${txt} *` : txt
  }

  // EBITDA: si no hay datos suficientes para calcular nada, mostrar "Datos insuficientes"
  const sinDatosCascada = facturacion == null && ingresosNetos == null && resultadoLimpioCalc == null

  return (
    <div style={cardBig}>
      <div style={lbl}>RESULTADO</div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: OSWALD, fontSize: 38, fontWeight: 600, color: sinDatosCascada ? COLOR.textMut : colorEbitda }}>
            {sinDatosCascada
              ? 'Datos insuficientes'
              : fmtEur(ebitda, { showEuro: true, decimals: 2 })}
          </div>
          <div style={lblXs}>EBITDA</div>
        </div>
        <div>
          <div style={{ fontFamily: OSWALD, fontSize: 24, fontWeight: 600, color: sinDatosCascada ? COLOR.textMut : colorEbitda }}>
            {sinDatosCascada ? '—' : `${fmtNum(ebitdaPct, 0)}%`}
          </div>
          <div style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: '1.5px', color: sinDatosCascada ? COLOR.textMut : colorEbitda, fontWeight: 500 }}>
            % s/netos
          </div>
        </div>
      </div>

      {deltaPp !== null && !sinDatosCascada && (
        <div style={{ fontSize: 12, color: colorDelta, margin: '10px 0 16px', fontFamily: LEXEND }}>
          {flecha} {fmtNum(Math.abs(deltaPp), 1)} puntos porcentuales vs anterior
        </div>
      )}

      {/* Cascada PyG simplificada — sin Comisiones, sin Provisiones */}
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
          <div style={{ fontSize: 10, color: COLOR.textMut, marginTop: 6, fontFamily: LEXEND, fontStyle: 'italic' }}>
            * estimado a partir del margen neto medio del periodo
          </div>
        )}
      </div>

      {/* Prime Cost */}
      <div style={{ borderTop: `0.5px solid ${COLOR.borde}`, paddingTop: 12, marginTop: 12 }}>
        <div style={{ ...lblSm, display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={lblSm} title="COGS + Personal sobre netos. KPI hostelería.">PRIME COST</span>
          <span style={{ ...lblSm, color: primeCostColor }}>{fmtPct(primeCostPct, 2)}</span>
        </div>
        <div style={{ marginBottom: 4 }}>
          <BarraCumplimiento pct={pcCapped} altura={8} />
        </div>
        <div style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', fontFamily: LEXEND }}>
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
