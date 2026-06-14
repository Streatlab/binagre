import { useEffect } from 'react'

/**
 * Responsive móvil del ERP (capa transversal).
 *
 * Detecta dispositivo móvil real — no se fía del ancho que reporta el
 * navegador (el modo "Sitio de escritorio" miente): usa también puntero
 * táctil + tamaño físico de pantalla. Marca <html class="sl-movil"> para
 * activar el CSS móvil (márgenes, 1 columna, media contenida, scroll
 * seguro de tablas). Las cards por módulo se deciden con useEsMovil.
 */

function esMovil(): boolean {
  if (window.matchMedia('(max-width: 768px)').matches) return true
  const tactil = window.matchMedia('(pointer: coarse)').matches
  const ladoCorto = Math.min(window.screen.width, window.screen.height)
  return tactil && ladoCorto <= 820
}

function syncMovil() {
  document.documentElement.classList.toggle('sl-movil', esMovil())
}

export default function ResponsiveTables() {
  useEffect(() => {
    syncMovil()
    window.addEventListener('resize', syncMovil)
    window.addEventListener('orientationchange', syncMovil)
    return () => {
      window.removeEventListener('resize', syncMovil)
      window.removeEventListener('orientationchange', syncMovil)
    }
  }, [])

  return null
}
