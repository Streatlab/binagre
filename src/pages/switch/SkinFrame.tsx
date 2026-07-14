/**
 * Interruptor de estilo por pantalla.
 * Deja convivir la pantalla antigua (neobrutal) y la nueva (Ley Visual SL v2)
 * bajo la misma ruta. El botón NEO/SL decide cuál se ve.
 *
 * La posición del botón la manda sl-movil.css (.sl-toggle-flotante):
 * arriba a la derecha en ordenador, abajo a la derecha en móvil.
 */
import type { ReactNode } from 'react'
import { SkinToggle } from '@/context/skin'

export function ToggleFlotante() {
  return (
    <div className="sl-toggle-flotante">
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
