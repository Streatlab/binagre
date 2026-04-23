import type { ReactNode } from 'react'

export function ConfigShell({ children }: { children: ReactNode }) {
  // Sin fondo propio: cada página respira dentro del layout global con T.bg.
  return <div style={{ padding: '4px 0' }}>{children}</div>
}
