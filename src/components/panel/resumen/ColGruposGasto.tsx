/**
 * ColGruposGasto — Fixes 52-64
 * FIX 52: consumido fmtEur showEuro:true decimals:2
 * FIX 53: presupuesto fmtEur showEuro:true decimals:2
 * FIX 54: desviación fmtEur showEuro:false decimals:2
 * FIX 55: desviación color verde si bajo, rojo si sobre, + prefijo
 * FIX 56: cabecera derecha Producto = "Food Cost X%" verde
 * FIX 57: eliminar "% s/netos X%" de Equipo/Local/Controlables
 * FIX 58: eliminar "Banda X-X%"
 * FIX 59: "Objetivo X%" editable inline
 * FIX 60: BarraCumplimiento
 * FIX 61: % consumo coloreado colorSemaforo(100 - min(pct,100))
 * FIX 62: presupuesto = running.ingresos_netos * pctObjetivo / 100
 * FIX 63: consumido = running.{grupo} mes actual
 * FIX 64: running vacío → "Datos insuficientes"
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur, fmtPct, colorSemaforo } from '@/lib/format'
import { COLOR, OSWALD, LEXEND, card, lbl, lblSm } from './tokens'
import { BarraCumplimiento } from '@/components/ui/BarraCumplimiento'
import { EditableInline } from '@/components/ui/EditableInline'

export type GrupoGasto = 'producto' | 'equipo' | 'local' | 'controlables'

interface GrupoData {
  gasto: number
  presupuesto: number
  pctSobreNetos: number
}

interface Props {
  data: Record<GrupoGasto, GrupoData>
  onSavePresupuesto?: (grupo: GrupoGasto, valor: number | null) => Promise<void>
  onToast?: (msg: string, type: 'success' | 'warning') => void
  año?: number
  mes?: number
}

interface KpiObj {
  id: number
  presupuesto_producto_pct: number | null
  presupuesto_personal_pct: number | null
  presupuesto_local_pct: number | null
  presupuesto_controlables_pct: number | null
}

interface RunningRow {
  ingresos_netos: number | null
  producto: number | null
  personal: number | null
  local: number | null
  controlables: number | null
}

const DEFAULT_PCT: Record<string, number> = {
  producto: 30,
  equipo: 40,
  local: 15,
  controlables: 15,
}

const GRUPOS: { id: GrupoGasto; label: string }[] = [
  { id: 'producto',     label: 'PRODUCTO · COGS'       },
  { id: 'equipo',       label: 'EQUIPO · LABOR'         },
  { id: 'local',        label: 'LOCAL · OCCUPANCY'      },
  { id: 'controlables', label: 'CONTROLABLES · OPEX'    },
]

export default function ColGruposGasto({ data, año, mes, onSavePresupuesto: _onSave, onToast: _onToast }: Props) {
  const añoActual = año ?? new Date().getFullYear()
  const mesActual = mes ?? (new Date().getMonth() + 1)

  const [kpiObj, setKpiObj] = useState<KpiObj | null>(null)
  const [kpiVersion, setKpiVersion] = useState(0)
  const [running, setRunning] = useState<RunningRow | null>(null)

  // FIX 59: leer kpi_objetivos
  useEffect(() => {
    supabase
      .from('kpi_objetivos')
      .select('id, presupuesto_producto_pct, presupuesto_personal_pct, presupuesto_local_pct, presupuesto_controlables_pct')
      .limit(1)
      .maybeSingle()
      .then(({ data: d }) => setKpiObj(d as KpiObj | null))
  }, [kpiVersion])

  // FIX 63: leer running mes actual
  useEffect(() => {
    supabase
      .from('running')
      .select('ingresos_netos, producto, personal, local, controlables')
      .eq('año', añoActual)
      .eq('mes', mesActual)
      .maybeSingle()
      .then(({ data: d }) => setRunning(d as RunningRow | null))
  }, [añoActual, mesActual])

  function getPct(grupo: GrupoGasto): number {
    if (!kpiObj) return DEFAULT_PCT[grupo] ?? 30
    const map: Record<GrupoGasto, keyof KpiObj> = {
      producto: 'presupuesto_producto_pct',
      equipo: 'presupuesto_personal_pct',
      local: 'presupuesto_local_pct',
      controlables: 'presupuesto_controlables_pct',
    }
    return (kpiObj[map[grupo]] as number | null) ?? DEFAULT_PCT[grupo] ?? 30
  }

  function getCampoRunning(grupo: GrupoGasto): number | null {
    if (!running) return null
    const map: Record<GrupoGasto, keyof RunningRow> = {
      producto: 'producto',
      equipo: 'personal',
      local: 'local',
      controlables: 'controlables',
    }
    return running[map[grupo]] as number | null
  }

  return (
    <div>
      <div style={{ ...lbl, marginBottom: 10 }}>GRUPOS DE GASTO · CONSUMO vs PRESUPUESTO</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {GRUPOS.map(g => {
          const pctObjetivo = getPct(g.id)
          const ingresosNetos = running?.ingresos_netos ?? null

          // FIX 62: presupuesto = running.ingresos_netos * pctObjetivo / 100
          const presupuesto = ingresosNetos !== null
            ? (ingresosNetos * pctObjetivo / 100)
            : data[g.id].presupuesto

          // FIX 63: consumido desde running
          const consumidoRunning = getCampoRunning(g.id)
          // FIX 64: si running vacío, usar data prop
          const consumido = consumidoRunning !== null ? consumidoRunning : data[g.id].gasto

          // FIX 64: texto "Datos insuficientes" si running completamente vacío
          const sinDatos = running === null && consumidoRunning === null

          const pctCumpl = presupuesto > 0 ? (consumido / presupuesto) * 100 : 0

          // FIX 61: colorSemaforo(100 - min(pctCumpl, 100)) — menos consumo = mejor
          const colorCumpl = colorSemaforo(100 - Math.min(pctCumpl, 100))

          // FIX 55: desviación
          const desv = consumido - presupuesto

          return (
            <div key={g.id} style={{ ...card, padding: '12px 14px 14px 14px', overflow: 'visible' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={lblSm}>{g.label}</div>
                {/* FIX 56: solo Producto muestra Food Cost en verde; FIX 57: resto sin % */}
                {g.id === 'producto' && (
                  <div style={{ fontSize: 11, color: COLOR.verde, fontFamily: LEXEND, fontWeight: 500 }}>
                    Food Cost{' '}
                    <span style={{ color: COLOR.verde }}>{fmtPct(data[g.id].pctSobreNetos, 0)}</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
                <div>
                  <span style={{ fontFamily: OSWALD, fontSize: 18, fontWeight: 600, color: COLOR.textPri }}>
                    {/* FIX 52: showEuro:true decimals:2 */}
                    {sinDatos ? 'Datos insuficientes' : fmtEur(consumido, { showEuro: true, decimals: 2 })}
                  </span>
                  <span style={{ fontSize: 12, color: COLOR.textMut, fontFamily: LEXEND }}>
                    {' / '}
                    {/* FIX 53: presupuesto showEuro:true decimals:2 */}
                    {sinDatos ? 'Datos insuficientes' : fmtEur(presupuesto, { showEuro: true, decimals: 2 })}
                  </span>
                </div>
                {/* FIX 61: % con colorSemaforo */}
                <div style={{ fontSize: 12, color: colorCumpl, fontWeight: 500, fontFamily: LEXEND }}>
                  {Math.round(pctCumpl)}%
                </div>
              </div>

              {/* FIX 60: BarraCumplimiento */}
              <div style={{ margin: '6px 0 4px' }}>
                <BarraCumplimiento pct={pctCumpl} altura={6} presupuesto={presupuesto} />
              </div>

              <div style={{ fontSize: 10, color: COLOR.textMut, display: 'flex', justifyContent: 'space-between', fontFamily: LEXEND }}>
                {/* FIX 59: Objetivo editable */}
                <span>
                  <span>Objetivo </span>
                  <EditableInline
                    valor={pctObjetivo}
                    tabla="kpi_objetivos"
                    campo={
                      g.id === 'producto' ? 'presupuesto_producto_pct'
                      : g.id === 'equipo' ? 'presupuesto_personal_pct'
                      : g.id === 'local' ? 'presupuesto_local_pct'
                      : 'presupuesto_controlables_pct'
                    }
                    filtros={{}}
                    decimales={0}
                    unidad="%"
                    onUpdate={() => setKpiVersion(v => v + 1)}
                  />
                </span>
                {/* FIX 54+55: desviación sin €, color verde/rojo con signo */}
                {!sinDatos && (
                  <span style={{ color: desv <= 0 ? COLOR.verde : COLOR.rojo }}>
                    {desv > 0 ? '+' : ''}{fmtEur(desv, { showEuro: false, decimals: 2 })} desv
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
