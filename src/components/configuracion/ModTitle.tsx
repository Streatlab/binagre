import type { ReactNode } from 'react'

/**
 * ModTitle — título de módulo de Ajustes · CANTERA ALEGRE v4.
 * Miga de pan de un nivel (tinta, Oswald 26, mismo look que RutaPantalla).
 */
export function ModTitle({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', lineHeight: 1, marginBottom: 18 }}>
      <span style={{ fontWeight: 700, fontSize: 26, letterSpacing: '2px', color: 'var(--neo-ink)' }}>{children}</span>
    </div>
  )
}
