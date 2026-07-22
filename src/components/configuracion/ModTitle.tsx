import { GRANATE } from '@/styles/neobrutal'
import type { ReactNode } from 'react'

export function ModTitle({ children }: { children: ReactNode }) {
  return (
    <h1
      style={{
        fontFamily: 'Oswald, sans-serif',
        fontSize: 22,
        fontWeight: 700,
        letterSpacing: '0.22em',
        color: GRANATE,
        textTransform: 'uppercase',
        marginBottom: 26,
      }}
    >
      {children}
    </h1>
  )
}
