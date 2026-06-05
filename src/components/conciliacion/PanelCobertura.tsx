import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { COLORS, OSWALD, LEXEND } from '@/components/panel/resumen/tokens'

interface KpiRow {
  movimientos_total: number
  movimientos_con_factura: number
  pct_cobertura: number
  facturas_total: number
  facturas_sin_categoria: number
  facturas_posible_duplicado: number
  facturas_aviso_aritmetica: number
}

export function PanelCobertura() {
  const [kpi, setKpi] = useState<KpiRow | null>(null)

  useEffect(() => {
    supabase
      .from('v_kpi_cobertura_conciliacion')
      .select('*')
      .then(({ data }) => {
        if (data && data.length > 0) setKpi(data[0] as KpiRow)
      })
  }, [])

  if (!kpi) return null

  const pct = Number(kpi.pct_cobertura ?? 0)
  const barColor = pct >= 80 ? COLORS.ok : pct >= 50 ? COLORS.warn : COLORS.err

  return (
    <div
      style={{
        background: COLORS.sidebar,
        borderRadius: 14,
        padding: '20px 28px',
        marginBottom: 18,
        display: 'flex',
        gap: 32,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      {/* % cobertura grande */}
      <div style={{ textAlign: 'center', minWidth: 110 }}>
        <div
          style={{
            fontFamily: OSWALD,
            fontSize: 10,
            letterSpacing: '2px',
            color: '#6a7890',
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          COBERTURA
        </div>
        <div style={{ fontFamily: OSWALD, fontSize: 48, fontWeight: 700, color: barColor, lineHeight: 1 }}>
          {pct.toFixed(1)}%
        </div>
        <div
          style={{ height: 5, borderRadius: 3, background: '#2a3050', marginTop: 8, overflow: 'hidden' }}
        >
          <div
            style={{
              width: `${Math.min(pct, 100)}%`,
              height: '100%',
              background: barColor,
              borderRadius: 3,
              transition: 'width 0.6s ease',
            }}
          />
        </div>
      </div>

      <div style={{ width: 1, height: 52, background: '#2a3050', flexShrink: 0 }} />

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
        <StatOscura label="Cuadrados" value={`${kpi.movimientos_con_factura} / ${kpi.movimientos_total}`} color="#e0e8f0" />
        <StatOscura
          label="Sin categoría"
          value={kpi.facturas_sin_categoria}
          color={kpi.facturas_sin_categoria > 0 ? COLORS.warn : COLORS.ok}
        />
        <StatOscura
          label="Posibles dup."
          value={kpi.facturas_posible_duplicado}
          color={kpi.facturas_posible_duplicado > 0 ? COLORS.warn : COLORS.ok}
        />
        <StatOscura
          label="Aviso aritmética"
          value={kpi.facturas_aviso_aritmetica}
          color={kpi.facturas_aviso_aritmetica > 0 ? COLORS.err : COLORS.ok}
        />
      </div>

      <div style={{ marginLeft: 'auto' }}>
        <div style={{ fontFamily: LEXEND, fontSize: 11, color: '#6a7890' }}>
          {kpi.facturas_total} facturas totales
        </div>
      </div>
    </div>
  )
}

function StatOscura({
  label,
  value,
  color,
}: {
  label: string
  value: string | number
  color: string
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: OSWALD,
          fontSize: 10,
          letterSpacing: '1.5px',
          color: '#6a7890',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: OSWALD, fontSize: 22, fontWeight: 600, color, lineHeight: 1.2 }}>
        {value}
      </div>
    </div>
  )
}
