import { useEffect } from 'react'
import { esMovil } from '@/hooks/useEsMovil'

/**
 * Sincroniza <html class="sl-movil"> con la detección automática por táctil,
 * para activar la capa CSS responsive (armazón, márgenes, 1 columna, tablas).
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
