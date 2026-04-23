import type { ReactNode, CSSProperties } from 'react'
import { useIsDark } from '@/hooks/useIsDark'

export function Table({ children }: { children: ReactNode }) {
  return (
    <table
      style={{
        width: '100%',
        fontSize: 13.5,
        borderCollapse: 'collapse',
        fontFamily: 'Lexend, sans-serif',
      }}
    >
      {children}
    </table>
  )
}

export function THead({ children }: { children: ReactNode }) {
  return <thead>{children}</thead>
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>
}

export function TH({
  children,
  num = false,
  style,
}: {
  children: ReactNode
  num?: boolean
  style?: CSSProperties
}) {
  const isDark = useIsDark()
  const mut = isDark ? '#777777' : '#9E9588'
  const border = isDark ? '#2a2a2a' : '#DDD4BF'
  return (
    <th
      style={{
        fontSize: 11,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: mut,
        padding: 14,
        fontFamily: 'Oswald, sans-serif',
        fontWeight: 500,
        textAlign: num ? 'right' : 'left',
        borderBottom: `1px solid ${border}`,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </th>
  )
}

export function TR({
  children,
  onClick,
  style,
}: {
  children: ReactNode
  onClick?: () => void
  style?: CSSProperties
}) {
  return (
    <tr onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default', ...style }}>
      {children}
    </tr>
  )
}

export function TD({
  children,
  num = false,
  bold = false,
  muted = false,
  style,
  colSpan,
}: {
  children: ReactNode
  num?: boolean
  bold?: boolean
  muted?: boolean
  style?: CSSProperties
  colSpan?: number
}) {
  const isDark = useIsDark()
  const border = isDark ? '#2a2a2a' : '#F0E8D5'
  const pri = isDark ? '#ffffff' : '#1A1A1A'
  const mut = isDark ? '#777777' : '#9E9588'
  return (
    <td
      colSpan={colSpan}
      style={{
        padding: 14,
        borderBottom: `1px solid ${border}`,
        color: muted ? mut : pri,
        fontWeight: bold ? 700 : 500,
        textAlign: num ? 'right' : 'left',
        fontVariantNumeric: num ? 'tabular-nums' : 'normal',
        ...style,
      }}
    >
      {children}
    </td>
  )
}

export function TotalTR({ children }: { children: ReactNode }) {
  const isDark = useIsDark()
  const border = isDark ? '#383838' : '#DDD4BF'
  return (
    <tr style={{ borderTop: `2px solid ${border}`, fontWeight: 700 }}>
      {children}
    </tr>
  )
}
