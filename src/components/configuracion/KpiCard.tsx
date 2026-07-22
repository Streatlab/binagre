import { BLANCO, GRANATE, GRIS, INK } from '@/styles/neobrutal'
import { CONFIG_BORDE, CONFIG_MUT, KPI_POS_VERDE } from '@/styles/palettes'
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
  const cardBg = isDark ? INK : BLANCO
  const border = isDark ? INK : CONFIG_BORDE
  const labelColor = isDark ? GRIS : CONFIG_MUT
  const valueColor = isDark ? BLANCO : INK

  const subColor =
    subTone === 'pos' ? KPI_POS_VERDE :
    subTone === 'neg' ? GRANATE :
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
