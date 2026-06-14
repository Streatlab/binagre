import { useEffect } from 'react'
import { esMovil } from '@/hooks/useEsMovil'

/**
 * Sincroniza <html class="sl-movil"> según la detección automática de móvil,
 * para activar la capa CSS responsive. Sin botón ni override.
 */
function syncClase() {
  document.documentElement.classList.toggle('sl-movil', esMovil())
}

export default function ResponsiveTables() {
  useEffect(() => {
    syncClase()
    window.addEventListener('resize', syncClase)
    window.addEventListener('orientationchange', syncClase)
    return () => {
      window.removeEventListener('resize', syncClase)
      window.removeEventListener('orientationchange', syncClase)
    }
  }, [])

  return null
}
