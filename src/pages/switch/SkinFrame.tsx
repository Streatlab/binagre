/**
 * Interruptor de estilo por pantalla.
 * Deja convivir la pantalla antigua (neobrutal) y la nueva (Ley Visual SL v2)
 * bajo la misma ruta. El botón NEO/SL decide cuál se ve.
 *
 * Cuando el estilo SL esté aprobado del todo, esta pieza se borra y la ruta
 * apunta directamente a la pantalla SL.
 */
import type { ReactNode } from 'react'
import { SkinToggle } from '@/context/skin'

/** Toggle flotante para poder volver a SL desde una pantalla antigua. */
export function ToggleFlotante() {
  return (
    <div style={{
      position: 'fixed', top: 14, right: 20, zIndex: 400,
      boxShadow: '0 4px 14px rgba(0,0,0,0.12)', borderRadius: 999,
    }}>
      <SkinToggle />
    </div>
  )
}

export function ConNeo({ children }: { children: ReactNode }) {
  return (
    <>
      <ToggleFlotante />
      {children}
    </>
  )
}
