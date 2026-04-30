/**
 * CardRatio — Fixes 81-88
 * FIX 81: "obj" → "Objetivo" en verde
 * FIX 82: cifra editable objetivo en verde #1D9E75
 * FIX 83: coeficiente grande con colorSemaforo
 * FIX 84: barra + "▼/▲ X% bajo/sobre objetivo" bajo el coeficiente
 * FIX 85: ELIMINAR bloque inferior "Distancia al objetivo"
 * FIX 86: líneas: Ingresos netos / Gastos fijos / Gastos reales
 * FIX 87: ratio = ingresosNetos / (gastosFijos + gastosVariables) desde running
 * FIX 88: tooltip en título
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur, fmtNum, colorSemaforo } from '@/lib/format'
import { COLOR, OSWALD, LEXEND, card, lblSm } from './tokens'
import { BarraCumplimiento } from '@/components/ui/BarraCumplimiento'
import { EditableInline } from '@/components/ui/EditableInline'

interface Props {
  netosEstimados: number
  netosReales: number
  gastosFijos: number
  gastosReales: number
  objetivo: number
  onSaveObjetivo: (valor: number | null) => Promise<void>
  onToast: (msg: string, type: 'success' | 'warning') => void
  año?: number
  mes?: number
}

interface RunningRow {
  ingresos_netos: number | null
  gastos_fijos_periodo: number | null
  gastos_variables_periodo: number | null
}

interface KpiObj {
  id: number
  ratio_target: number | null
}

export default function CardRatio({
  netosEstimados, gastosFijos, gastosReales,
  objetivo: objetivoProp,
  onToast,
  año, mes,
}: Props) {
  const añoActual = año ?? new Date().getFullYear()
  const mesActual = mes ?? (new Date().getMonth() + 1)

  const [running, setRunning] = useState<RunningRow | null>(null)
  const [kpiObj, setKpiObj] = useState<KpiObj | null>(null)
  const [kpiVersion, setKpiVersion] = useState(0)

  useEffect(() => {
    supabase
      .from('running')
      .select('ingresos_netos, gastos_fijos_periodo, gastos_variables_periodo')
      .eq('año', añoActual)
      .eq('mes', mesActual)
      .maybeSingle()
      .then(({ data }) => setRunning(data as RunningRow | null))
  }, [añoActual, mesActual])

  useEffect(() => {
    supabase
      .from('kpi_objetivos')
      .select('id, ratio_target')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setKpiObj(data as KpiObj | null))
  }, [kpiVersion])

  // FIX 87: valores desde running si existen
  const ingresosNetos = running?.ingresos_netos ?? netosEstimados
  const gFijos = running?.gastos_fijos_periodo ?? gastosFijos
  const gVariables = running?.gastos_variables_periodo ?? Math.max(0, gastosReales - gastosFijos)
  const totalGastos = gFijos + gVariables

  const objetivo = kpiObj?.ratio_target ?? objetivoProp ?? 2.50

  // FIX 87: ratio = ingresosNetos / totalGastos
  const ratio = totalGastos > 0 ? ingresosNetos / totalGastos : 0
  const ratioInsuficiente = ingresosNetos < 100 || totalGastos < 100

  const ratioPctObj = objetivo > 0 ? (ratio / objetivo) * 100 : 0

  // FIX 83: colorSemaforo
  const semColor = colorSemaforo(ratioPctObj)

  const flecha = ratio >= objetivo ? '▲' : '▼'
  const difPct = Math.abs(ratioPctObj - 100)
  const textoDesv = ratio >= objetivo
    ? `▲ ${fmtNum(difPct, 1)}% sobre objetivo`
    : `▼ ${fmtNum(difPct, 1)}% bajo objetivo`

  return (
    <div style={card}>
      {/* FIX 88: tooltip en título */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
          <div
            style={lblSm}
            title="Euros que entran por cada euro de gasto. Mayor es mejor."
          >
            RATIO INGRESOS / GASTOS
          </div>
          <span
            title="Euros que entran por cada euro de gasto. Mayor es mejor."
            style={{ fontSize: 11, color: COLOR.textMut, cursor: 'help', fontFamily: LEXEND }}
          >
            ⓘ
          </span>
        </div>
        {/* FIX 81+82: "Objetivo" en verde, cifra editable en verde */}
        <div style={{ fontSize: 11, color: COLOR.verde, display: 'flex', alignItems: 'center', gap: 4, fontFamily: LEXEND }}>
          <span style={{ color: COLOR.verde }}>Objetivo</span>{' '}
          <EditableInline
            valor={objetivo}
            tabla="kpi_objetivos"
            campo="ratio_target"
            filtros={{}}
            decimales={2}
            unidad=""
            color="#1D9E75"
            onUpdate={() => setKpiVersion(v => v + 1)}
          />
        </div>
      </div>

      {/* FIX 83: coeficiente grande con colorSemaforo */}
      <div
        style={{ fontFamily: OSWALD, fontSize: 38, fontWeight: 600, color: ratioInsuficiente ? COLOR.textMut : semColor, marginTop: 6 }}
        title={ratioInsuficiente ? 'Datos insuficientes para calcular ratio' : undefined}
      >
        {ratioInsuficiente ? '—' : fmtNum(ratio, 2)}
      </div>

      {/* FIX 84: barra + texto desviación justo debajo del coeficiente */}
      <div style={{ marginTop: 6, marginBottom: 12 }}>
        <BarraCumplimiento pct={ratioPctObj} altura={6} />
        <div style={{ fontSize: 12, color: ratioInsuficiente ? COLOR.textMut : semColor, marginTop: 4, fontFamily: LEXEND }}>
          {ratioInsuficiente ? 'Datos insuficientes' : textoDesv}
        </div>
      </div>

      {/* FIX 86: Ingresos netos / Gastos fijos / Gastos reales */}
      <Linea
        label="Ingresos netos"
        valor={ratioInsuficiente ? '—' : `${fmtEur(ingresosNetos, { showEuro: false, decimals: 0 })} €`}
        tooltip=""
        top
      />
      <Linea
        label="Gastos fijos"
        valor={ratioInsuficiente ? '—' : `${fmtEur(gFijos, { showEuro: false, decimals: 0 })} €`}
        tooltip="Gastos fijos conocidos: alquiler, SS, nóminas, etc."
      />
      <Linea
        label="Gastos reales"
        valor={ratioInsuficiente ? '—' : `${fmtEur(gVariables, { showEuro: false, decimals: 0 })} €`}
        tooltip="Gastos variables que cambian mes a mes"
      />

      {/* FIX 85: ELIMINADO bloque "Distancia al objetivo" */}
    </div>
  )
}

function Linea({ label, valor, tooltip, top }: { label: string; valor: string; tooltip?: string; top?: boolean }) {
  return (
    <div style={{
      fontSize: 12,
      display: 'flex',
      justifyContent: 'space-between',
      marginTop: top ? 4 : 2,
      fontFamily: LEXEND,
    }}>
      <span
        style={{ color: COLOR.textMut, cursor: tooltip ? 'help' : 'default' }}
        title={tooltip}
      >
        {label}
      </span>
      <span style={{ color: COLOR.textPri }}>{valor}</span>
    </div>
  )
}
