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
    let alive = true
    const cargar = () => {
      supabase
        .from('v_kpi_cobertura_conciliacion')
        .select('*')
        .then(({ data }) => {
          if (alive && data && data.length > 0) setKpi(data[0] as KpiRow)
        })
    }
    cargar()
    const t = setInterval(cargar, 30_000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  if (!kpi) return null

  const pct = Number(kpi.pct_cobertura ?? 0)
  const barColor = pct >= 80 ? COLORS.ok : pct >= 50 ? COLORS.warn : COLORS.err

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e5e2dc',
        borderRadius: 14,
        padding: '20px 28px',
        marginBottom: 18,
        display: 'flex',
        gap: 32,
        alignItems: 'center',
        flexWrap: 'wrap',
        boxShadow: '0 1px 3px rgba(30,34,51,0.06)',
      }}
    >
      {/* % cobertura grande (movimientos con factura) */}
      <div style={{ textAlign: 'center', minWidth: 120 }}>
        <div
          style={{
            fontFamily: OSWALD,
            fontSize: 10,
            letterSpacing: '2px',
            color: '#7a8090',
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          MOVIMIENTOS CON FACTURA
        </div>
        <div style={{ fontFamily: OSWALD, fontSize: 48, fontWeight: 700, color: barColor, lineHeight: 1 }}>
          {pct.toFixed(1)}%
        </div>
        <div style={{ height: 5, borderRadius: 3, background: '#ece9e3', marginTop: 8, overflow: 'hidden' }}>
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

      <div style={{ width: 1, height: 52, background: '#e5e2dc', flexShrink: 0 }} />

      {/* Bloque MOVIMIENTOS */}
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
        <Stat
          label="Mov. cuadrados"
          value={`${kpi.movimientos_con_factura} / ${kpi.movimientos_total}`}
          color="#1e2233"
        />
      </div>

      <div style={{ width: 1, height: 52, background: '#e5e2dc', flexShrink: 0 }} />

      {/* Bloque FACTURAS (otro universo: el módulo de Facturas/OCR) */}
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
        <Stat label="Facturas totales" value={kpi.facturas_total} color="#1e2233" />
        <Stat
          label="Facturas sin categoría"
          value={kpi.facturas_sin_categoria}
          color={kpi.facturas_sin_categoria > 0 ? COLORS.warn : COLORS.ok}
        />
        <Stat
          label="Facturas duplicadas"
          value={kpi.facturas_posible_duplicado}
          color={kpi.facturas_posible_duplicado > 0 ? COLORS.warn : COLORS.ok}
        />
        <Stat
          label="Facturas aviso IVA"
          value={kpi.facturas_aviso_aritmetica}
          color={kpi.facturas_aviso_aritmetica > 0 ? COLORS.err : COLORS.ok}
        />
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div>
      <div
        style={{
          fontFamily: OSWALD,
          fontSize: 10,
          letterSpacing: '1.5px',
          color: '#7a8090',
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
