import type { CSSProperties } from 'react'
import { useTheme, cardStyle, kpiLabelStyle, kpiValueStyle, FONT } from '@/styles/tokens'

export type KpiAccent = 'success' | 'danger' | 'warning' | 'info' | 'default'

interface KpiCardProps {
  label: string
  value: string
  delta?: { value: string; trend: 'up' | 'down' | 'neutral' }
  accent?: KpiAccent
  highlighted?: boolean
  subtitle?: string
}

const ACCENT_COLOR: Record<KpiAccent, string | null> = {
  success: '#1D9E75',
  danger:  '#E24B4A',
  warning: '#f5a623',
  info:    '#66aaff',
  default: null,
}

export function KpiCard({ label, value, delta, accent = 'default', highlighted = false, subtitle }: KpiCardProps) {
  const { T } = useTheme()

  const valueColor = ACCENT_COLOR[accent] ?? T.pri

  const wrap: CSSProperties = {
    ...cardStyle(T),
    background: highlighted ? T.group : T.card,
    minHeight: 92,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  }

  const trendColor =
    delta?.trend === 'up'   ? '#1D9E75' :
    delta?.trend === 'down' ? '#E24B4A' :
                              T.mut

  const trendIcon =
    delta?.trend === 'up'   ? '▲' :
    delta?.trend === 'down' ? '▼' : '·'

  return (
    <div style={wrap}>
      <div style={{ ...kpiLabelStyle(T) }}>{label}</div>
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
