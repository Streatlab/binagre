import { RefreshCw } from 'lucide-react'
import { COLORS, FONT, CARDS, BAR, semaforoBarra } from '@/components/panel/resumen/tokens'
import { useKpiCobertura } from '@/hooks/useKpiCobertura'

export default function PanelCierre() {
  const { kpi, loading, refetch } = useKpiCobertura()

  const pct = kpi?.pct_cobertura ?? 0
  const color = semaforoBarra(pct)

  return (
    <div style={{
      ...CARDS.big,
      marginBottom: 18,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: FONT.heading, fontSize: 13, fontWeight: 500, letterSpacing: '2px', color: COLORS.mut, textTransform: 'uppercase' }}>
          Cobertura de conciliación
        </span>
        <button onClick={refetch} title="Refrescar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.mut, padding: 4, display: 'flex' }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {loading ? (
        <div style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.mut }}>Cargando…</div>
      ) : (
        <>
          {/* Número grande + barra */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
            <span style={{ fontFamily: FONT.heading, fontSize: 48, fontWeight: 700, color, lineHeight: 1 }}>
              {pct.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
            </span>
            <span style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.mut, paddingBottom: 6 }}>
              {kpi?.movimientos_con_factura ?? 0} de {kpi?.total_movimientos ?? 0} movimientos cuadrados
            </span>
          </div>

          {/* Barra de progreso */}
          <div style={{ ...BAR.track }}>
            <div style={{
              width: `${Math.min(pct, 100)}%`,
              background: color,
              borderRadius: 0,
              transition: 'width 600ms ease',
            }} />
          </div>

          {/* Métricas secundarias */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 4 }}>
            <MetricChip
              label="Sin categoría"
              value={kpi?.facturas_sin_categoria ?? 0}
              color={kpi?.facturas_sin_categoria ? COLORS.warn : COLORS.ok}
            />
            <MetricChip
              label="Posibles duplicados"
              value={kpi?.posibles_duplicados ?? 0}
              color={kpi?.posibles_duplicados ? COLORS.err : COLORS.ok}
            />
            <MetricChip
              label="Avisos aritmética"
              value={kpi?.avisos_aritmetica ?? 0}
              color={kpi?.avisos_aritmetica ? COLORS.warn : COLORS.ok}
            />
          </div>
        </>
      )}
    </div>
  )
}

function MetricChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: COLORS.group,
      borderRadius: 0,
      padding: '10px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    }}>
      <span style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 600, color }}>{value}</span>
      <span style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut }}>{label}</span>
    </div>
  )
}
