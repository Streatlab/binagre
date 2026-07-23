import { BLANCO, GRANATE, GRIS, INK } from '@/styles/neobrutal'
import { CONFIG_BORDE, CONFIG_MUT } from '@/styles/palettes'
import type { ReactNode, InputHTMLAttributes, ButtonHTMLAttributes } from 'react'
import { Search } from 'lucide-react'
import { useIsDark } from '@/hooks/useIsDark'

export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  )
}

export function Spacer() {
  return <div style={{ flex: 1 }} />
}

export function BtnRed({ children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      style={{
        padding: '9px 16px',
        borderRadius: 0,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.04em',
        background: GRANATE,
        color: BLANCO,
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'Oswald, sans-serif',
        textTransform: 'uppercase',
        transition: 'filter 0.15s',
        ...rest.style,
      }}
      onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.1)')}
      onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
    >
      {children}
    </button>
  )
}

export function BtnGhost({ children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const isDark = useIsDark()
  return (
    <button
      {...rest}
      style={{
        padding: '9px 16px',
        borderRadius: 0,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.04em',
        background: isDark ? INK : BLANCO,
        color: isDark ? BLANCO : INK,
        border: `1px solid ${isDark ? INK : CONFIG_BORDE}`,
        cursor: 'pointer',
        fontFamily: 'Oswald, sans-serif',
        textTransform: 'uppercase',
        transition: 'filter 0.15s',
        ...rest.style,
      }}
    >
      {children}
    </button>
  )
}

export function SearchInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const isDark = useIsDark()
  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      <Search
        size={14}
        color={isDark ? GRIS : CONFIG_MUT}
        style={{ position: 'absolute', left: 10, pointerEvents: 'none' }}
      />
      <input
        {...props}
        style={{
          background: isDark ? INK : BLANCO,
          border: `1px solid ${isDark ? INK : CONFIG_BORDE}`,
          borderRadius: 0,
          padding: '8px 12px 8px 30px',
          fontSize: 13,
          color: isDark ? BLANCO : INK,
          fontFamily: 'Lexend, sans-serif',
          outline: 'none',
          minWidth: 260,
          ...props.style,
        }}
      />
    </div>
  )
}
