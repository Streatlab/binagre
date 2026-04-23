import type { ReactNode } from 'react'
import { useTheme, groupStyle, FONT } from '@/styles/tokens'

interface Props {
  title?: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
  children: ReactNode
  padded?: boolean
  style?: React.CSSProperties
}

export default function ConfigGroupCard({ title, subtitle, right, children, padded = false, style }: Props) {
  const { T } = useTheme()
  return (
    <div style={{ ...groupStyle(T), padding: padded ? '18px 22px' : 0, marginBottom: 14, overflow: 'hidden', ...style }}>
      {(title || right) && (
        <div
          style={{
            padding: padded ? '0 0 10px' : '18px 22px 10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {title && (
            <div
              style={{
                fontFamily: FONT.heading,
                fontSize: 11,
                letterSpacing: '2px',
                textTransform: 'uppercase',
                color: T.mut,
              }}
            >
              {title}
              {subtitle != null && (
                <span style={{ color: T.pri, letterSpacing: '0.04em', textTransform: 'none', marginLeft: 6 }}>
                  · {subtitle}
                </span>
              )}
            </div>
          )}
          {right}
        </div>
      )}
      {children}
    </div>
  )
}

export function FacturacionTableStyle({
  children, scrollX = true,
}: {
  children: ReactNode
  scrollX?: boolean
}) {
  return (
    <div style={{ overflowX: scrollX ? 'auto' : 'visible' }}>
      <table style={{ width: '100%', fontSize: 13, whiteSpace: 'nowrap', borderCollapse: 'collapse' }}>
        {children}
      </table>
    </div>
  )
}
