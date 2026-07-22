import { BLANCO, GRIS, INK } from '@/styles/neobrutal'
import { CONFIG_BORDE, CONFIG_MUT } from '@/styles/palettes'
import type { ReactNode } from 'react'
import { useIsDark } from '@/hooks/useIsDark'

export function BigCard({
  title,
  count,
  children,
}: {
  title: ReactNode
  count?: ReactNode
  children: ReactNode
}) {
  const isDark = useIsDark()
  const bg = isDark ? INK : BLANCO
  const border = isDark ? INK : CONFIG_BORDE
  const titleColor = isDark ? GRIS : CONFIG_MUT
  const countColor = isDark ? GRIS : INK

  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 12,
        padding: '24px 26px',
        marginBottom: 14,
      }}
    >
      <div
        style={{
          fontFamily: 'Oswald, sans-serif',
          fontSize: 11,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: titleColor,
          fontWeight: 500,
          marginBottom: 20,
        }}
      >
        {title}
        {count != null && (
          <span
            style={{
              color: countColor,
              fontWeight: 400,
              marginLeft: 6,
              letterSpacing: '0.04em',
              textTransform: 'none',
            }}
          >
            · {count}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}
