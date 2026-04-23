import type { ReactNode } from 'react'

export function ConfigShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-[var(--sl-sidebar)] rounded-2xl p-6 mx-2 my-2 min-h-[calc(100vh-80px)]">
      {children}
    </div>
  )
}
