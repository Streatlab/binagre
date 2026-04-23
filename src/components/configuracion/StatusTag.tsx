import type { ReactNode } from 'react'
import { useIsDark } from '@/hooks/useIsDark'

type Variant = 'ok' | 'off' | 'admin' | 'cocina'

export function StatusTag({
  variant,
  children,
}: {
  variant: Variant
  children: ReactNode
}) {
  const isDark = useIsDark()

  const styles: Record<Variant, { bg: string; color: string }> = {
    ok:     { bg: isDark ? '#0f3a26' : '#D4F0E0', color: isDark ? '#06C167' : '#027b4b' },
    off:    { bg: isDark ? '#2a2a2a' : '#ebe5d8', color: isDark ? '#777777' : '#9E9588' },
    admin:  { bg: '#B01D23', color: '#ffffff' },
    cocina: { bg: '#e8f442', color: isDark ? '#1a1a00' : '#5c550d' },
  }
  const s = styles[variant]

  return (
    <span
      style={{
        display: 'inline-flex',
        padding: '3px 10px',
        borderRadius: 5,
        fontSize: 10,
        letterSpacing: '0.06em',
        fontWeight: 600,
        textTransform: 'uppercase',
        background: s.bg,
        color: s.color,
        fontFamily: 'Oswald, sans-serif',
      }}
    >
      {children}
    </span>
  )
}
