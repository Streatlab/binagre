import { BLANCO } from '@/styles/neobrutal'
/** Frase HERO 💬 — tarjeta que cuenta el periodo en cristiano. Kit oficial. */
import type { ReactNode } from 'react'
import { BORDER, SHADOW } from '@/styles/kit'

export function Sub({ children, wash, borde }: { children: ReactNode; wash: string; borde: string }) {
  return <b style={{ background: wash, borderBottom: `3px solid ${borde}`, padding: '0 3px' }}>{children}</b>
}

export default function FraseHero({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: BLANCO, border: BORDER, boxShadow: SHADOW, padding: '13px 15px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 24, lineHeight: 1 }}>💬</span>
      <div style={{ fontSize: 15, lineHeight: 1.55 }}>{children}</div>
    </div>
  )
}
