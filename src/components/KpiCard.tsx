import type { CSSProperties } from 'react'
import { useTheme, cardStyle, kpiLabelStyle, kpiValueStyle, FONT } from '@/styles/tokens'

export type KpiAccent = 'success' | 'danger' | 'warning' | 'info' | 'default'

interface KpiCardProps {
  label: string
  value: string
  period?: string
  delta?: { value: string; trend: 'up' | 'down' | 'neutral' }
  accent?: KpiAccent
  highlighted?: boolean
  subtitle?: string
}

const ACCENT_COLOR: Record<KpiAccent, string | null> = {
  success: '#06C167',
  danger:  '#B01D23',
  warning: '#f5a623',
  info:    '#66aaff',
  default: null,
}

export function KpiCard({ label, value, period, delta, accent = 'default', highlighted = false, subtitle }: KpiCardProps) {
  const { T } = useTheme()

  const valueColor = ACCENT_COLOR[accent] ?? T.pri

  const wrap: CSSProperties = {
    ...cardStyle(T),
    background: highlighted ? T.group : T.card,
    minHeight: 96,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  }

  const trendColor =
    delta?.trend === 'up'   ? '#06C167' :
    delta?.trend === 'down' ? '#B01D23' :
                              T.mut

  const trendIcon =
    delta?.trend === 'up'   ? '▲' :
    delta?.trend === 'down' ? '▼' : '·'

  return (
    <div style={wrap}>
      <div style={{ ...kpiLabelStyle(T) }}>{label}</div>
      {period && (
        <div style={{
          fontFamily: FONT.body,
          fontSize: 10,
          color: T.mut,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginTop: -2,
          marginBottom: 2,
        }}>
          {period}
        </div>
      )}
      <div style={{ ...kpiValueStyle(T), color: valueColor, fontSize: '1.8rem' }}>{value}</div>
      {delta && (
        <div style={{ fontFamily: FONT.body, fontSize: 11, color: trendColor, marginTop: 2 }}>
          {trendIcon} {delta.value}
        </div>
      )}
      {subtitle && (
        <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginTop: 2 }}>{subtitle}</div>
      )}
    </div>
  )
}
