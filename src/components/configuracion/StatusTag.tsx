import type { ReactNode } from 'react'
import { useIsDark } from '@/hooks/useIsDark'

type Variant =
  | 'ok' | 'off'
  | 'admin' | 'gestor' | 'cocina'
  | 'fijo' | 'var' | 'pers' | 'mkt'

export function StatusTag({
  variant,
  children,
}: {
  variant: Variant
  children: ReactNode
}) {
  const isDark = useIsDark()

  const styles: Record<Variant, { bg: string; color: string }> = {
    ok:     { bg: isDark ? 'rgba(29,158,117,0.22)' : '#D4F0E0', color: isDark ? '#5DCAA5' : '#027b4b' },
    off:    { bg: isDark ? 'rgba(255,255,255,0.08)' : '#ebe5d8', color: isDark ? '#9ba8c0' : '#9E9588' },
    admin:  { bg: isDark ? 'rgba(176,29,35,0.28)'  : '#FCEBEB', color: isDark ? '#F09595' : '#A32D2D' },
    gestor: { bg: isDark ? 'rgba(12,68,124,0.30)'  : '#E6F1FB', color: isDark ? '#89B5DF' : '#0C447C' },
    cocina: { bg: isDark ? 'rgba(186,117,23,0.26)' : '#FAEEDA', color: isDark ? '#F5C36B' : '#854F0B' },
    fijo:   { bg: isDark ? 'rgba(90,74,191,0.26)'  : '#E6DFFF', color: isDark ? '#B7A8F5' : '#5A4ABF' },
    var:    { bg: isDark ? 'rgba(184,86,31,0.22)'  : '#FFE6D9', color: isDark ? '#F5A983' : '#B8561F' },
    pers:   { bg: isDark ? 'rgba(31,108,184,0.26)' : '#D9EFFF', color: isDark ? '#89BFF0' : '#1F6CB8' },
    mkt:    { bg: isDark ? 'rgba(184,38,110,0.22)' : '#FFD9E9', color: isDark ? '#F092B6' : '#B8266E' },
  }
  const s = styles[variant]

  return (
    <span
      style={{
        display: 'inline-flex',
        padding: '5px 14px',
        borderRadius: 5,
        fontSize: 11,
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
