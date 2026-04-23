import type { ReactNode } from 'react'
import { useIsDark } from '@/hooks/useIsDark'

type SubTone = 'pos' | 'neg' | 'muted'

export function KpiCard({
  label,
  value,
  unit,
  sub,
  subTone = 'muted',
}: {
  label: string
  value: ReactNode
  unit?: string
  sub?: string
  subTone?: SubTone
}) {
  const isDark = useIsDark()
  const cardBg = isDark ? '#141414' : '#ffffff'
  const border = isDark ? '#2a2a2a' : '#E9E1D0'
  const labelColor = isDark ? '#777777' : '#9E9588'
  const valueColor = isDark ? '#ffffff' : '#1A1A1A'

  const subColor =
    subTone === 'pos' ? '#22B573' :
    subTone === 'neg' ? '#B01D23' :
    labelColor
  const subPrefix = subTone === 'pos' ? '▲ ' : subTone === 'neg' ? '▼ ' : ''

  return (
    <div
      style={{
        background: cardBg,
        border: `1px solid ${border}`,
        borderRadius: 12,
        padding: '24px 26px',
      }}
    >
      <div
        style={{
          fontFamily: 'Oswald, sans-serif',
          fontSize: 11,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: labelColor,
          fontWeight: 500,
          marginBottom: 12,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'Oswald, sans-serif',
          fontSize: 38,
          fontWeight: 700,
          color: valueColor,
          lineHeight: 1,
          letterSpacing: '-0.02em',
        }}
      >
        {value}
        {unit && (
          <span style={{ fontSize: 24, fontWeight: 700, color: valueColor, marginLeft: 4 }}>
            {unit}
          </span>
        )}
      </div>
      {sub && (
        <div
          style={{
            fontFamily: 'Lexend, sans-serif',
            fontSize: 12,
            color: subColor,
            marginTop: 10,
          }}
        >
          {subPrefix}{sub}
        </div>
      )}
    </div>
  )
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: 14,
        marginBottom: 20,
      }}
    >
      {children}
    </div>
  )
}
