/**
 * CardResultadoPeriodo — Fixes 30-42
 * FIX 30: sublabel "RESULTADO"
 * FIX 31: EBITDA con €
 * FIX 32: demás cifras sin €
 * FIX 33: "puntos porcentuales"
 * FIX 34: cascada PyG 9 líneas
 * FIX 35: datos desde tabla running
 * FIX 36: tooltips HTML
 * FIX 37: Prime Cost tooltip
 * FIX 38: eliminar "Banda sector 55-65%"
 * FIX 39: objetivo editable inline kpi_objetivos
 * FIX 40: "Objetivo" en verde
 * FIX 41: % prime cost con colorSemaforo(100-pct)
 * FIX 42: BarraCumplimiento prime cost
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur, colorSemaforo } from '@/lib/format'
import { COLOR, OSWALD, LEXEND, cardBig, lbl, lblXs, lblSm, barTrack } from './tokens'
import { BarraCumplimiento } from '@/components/ui/BarraCumplimiento'
import { EditableInline } from '@/components/ui/EditableInline'

// Re-export fmtDec from lib/format doesn't exist — use inline
function fmtDecLocal(v: number, decimals = 1): string {
  if (!isFinite(v)) return '—'
  return v.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

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
  año?: number
  mes?: number
}

export default function CardResultadoPeriodo({
  ebitda, ebitdaPct, deltaPp,
  primeCostPct,
  año, mes,
}: Props) {
  const [running, setRunning] = useState<RunningRow | null>(null)
  const [kpiObj, setKpiObj] = useState<KpiObjetivos | null>(null)
  const [kpiVersion, setKpiVersion] = useState(0)

  const añoActual = año ?? new Date().getFullYear()
  const mesActual = mes ?? (new Date().getMonth() + 1)

  // FIX 35: lectura running
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

  // FIX 39: lectura kpi_objetivos
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

  // FIX 41: colorSemaforo(100 - primeCostPct) porque menor = mejor
  const primeCostColor = colorSemaforo(100 - Math.min(primeCostPct, 100))
  const pcCapped = Math.min(100, Math.max(0, primeCostPct))

  // Helpers cascada PyG
  function val(v: number | null | undefined): string {
    if (v === null || v === undefined) return 'Datos insuficientes'
    return fmtEur(v, { showEuro: false })
  }

  const r = running

  return (
    <div style={cardBig}>
      {/* FIX 30: RESULTADO */}
      <div style={lbl}>RESULTADO</div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 8, flexWrap: 'wrap' }}>
        <div>
          {/* FIX 31: EBITDA con € */}
          <div style={{ fontFamily: OSWALD, fontSize: 38, fontWeight: 600, color: colorEbitda }}>
            {fmtEur(ebitda, { showEuro: true, decimals: 2 })}
          </div>
          <div style={lblXs}>EBITDA</div>
        </div>
        <div>
          {/* FIX 32: % sin € */}
          <div style={{ fontFamily: OSWALD, fontSize: 24, fontWeight: 600, color: colorEbitda }}>
            {ebitdaPct.toFixed(0)}%
          </div>
          <div style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: '1.5px', color: colorEbitda, textTransform: 'uppercase', fontWeight: 500 }}>
            % S/NETOS
          </div>
        </div>
      </div>

      {deltaPp !== null && (
        <div style={{ fontSize: 12, color: colorDelta, margin: '10px 0 16px', fontFamily: LEXEND }}>
          {/* FIX 33: "puntos porcentuales" con coma decimal */}
          {flecha} {fmtDecLocal(Math.abs(deltaPp), 1).replace('.', ',')} puntos porcentuales vs anterior
        </div>
      )}

      {/* FIX 34-36: cascada PyG 9 líneas con tooltips */}
      <div style={{ borderTop: `0.5px solid ${COLOR.borde}`, paddingTop: 12 }}>
        <LineaPyG
          label="Ingresos brutos"
          valor={val(r?.ingresos_brutos)}
          tooltip="Facturación plataforma + venta directa"
        />
        <LineaPyG
          label="Comisiones + IVA"
          valor={val(r ? (r.comisiones_plataforma ?? 0) + (r.iva_comisiones ?? 0) : null)}
          tooltip="Comisiones plataformas + 21% IVA sobre comisiones"
        />
        <LineaPyG
          label="Ingresos netos"
          valor={val(r?.ingresos_netos)}
          tooltip="Lo que de verdad entra a Streat Lab"
          bold
        />
        <LineaPyG
          label="Producto"
          valor={val(r?.producto)}
          tooltip="Food cost + bebida + packaging + mermas"
        />
        <LineaPyG
          label="Margen bruto"
          valor={val(r?.margen_bruto)}
          tooltip=""
          bold
        />
        <LineaPyG
          label="Personal"
          valor={val(r?.personal)}
          tooltip="Sueldos + SS + sueldos socios"
        />
        <LineaPyG
          label="Local + Controlables"
          valor={val(r ? (r.local ?? 0) + (r.controlables ?? 0) : null)}
          tooltip="Alquiler + IRPF + suministros + marketing + software + gestoría + bancos + transporte + seguros"
        />
        <LineaPyG
          label="Provisiones"
          valor={val(r ? (r.provisiones_iva ?? 0) + (r.provisiones_irpf ?? 0) : null)}
          tooltip="Provisión IVA + IRPF"
        />
        <LineaPyG
          label="Resultado limpio"
          valor={val(r?.resultado_limpio)}
          tooltip="Lo que queda tras provisiones"
          bold
          colorVal={r?.resultado_limpio != null ? (r.resultado_limpio >= 0 ? COLOR.verde : COLOR.rojo) : undefined}
        />
      </div>

      {/* FIX 37-42: Prime Cost */}
      <div style={{ borderTop: `0.5px solid ${COLOR.borde}`, paddingTop: 12, marginTop: 12 }}>
        <div style={{ ...lblSm, display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={lblSm} title="COGS + Personal sobre netos. KPI hostelería.">PRIME COST</span>
          {/* FIX 41: color semáforo */}
          <span style={{ ...lblSm, color: primeCostColor }}>{primeCostPct.toFixed(0)}%</span>
        </div>
        {/* FIX 42: BarraCumplimiento */}
        <div style={{ marginBottom: 4 }}>
          <BarraCumplimiento pct={pcCapped} altura={8} />
        </div>
        <div style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', fontFamily: LEXEND }}>
          {/* FIX 38: eliminar "Banda sector 55-65%" */}
          {/* FIX 39-40: "Objetivo X%" editable, "Objetivo" en verde */}
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
      <span style={{ color: colorVal ?? '#111111' }}>{valor}</span>
    </div>
  )
}
