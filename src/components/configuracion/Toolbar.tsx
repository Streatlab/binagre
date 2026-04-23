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
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.04em',
        background: '#B01D23',
        color: '#ffffff',
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
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.04em',
        background: isDark ? '#141414' : '#ffffff',
        color: isDark ? '#ffffff' : '#1A1A1A',
        border: `1px solid ${isDark ? '#2a2a2a' : '#E9E1D0'}`,
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
        color={isDark ? '#777777' : '#9E9588'}
        style={{ position: 'absolute', left: 10, pointerEvents: 'none' }}
      />
      <input
        {...props}
        style={{
          background: isDark ? '#1e1e1e' : '#ffffff',
          border: `1px solid ${isDark ? '#2a2a2a' : '#E9E1D0'}`,
          borderRadius: 8,
          padding: '8px 12px 8px 30px',
          fontSize: 13,
          color: isDark ? '#ffffff' : '#1A1A1A',
          fontFamily: 'Lexend, sans-serif',
          outline: 'none',
          minWidth: 260,
          ...props.style,
        }}
      />
    </div>
  )
}
