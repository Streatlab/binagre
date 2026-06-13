import { useEffect } from 'react'

/**
 * Responsive móvil del ERP (capa transversal).
 *
 * Detecta si el dispositivo es móvil real — NO se fía del ancho que
 * reporta el navegador, porque el modo "Sitio de escritorio" miente.
 * Marca <html class="sl-movil"> para activar el CSS móvil (márgenes,
 * 1 columna, media contenida y scroll seguro de tablas).
 *
 * NO convierte tablas a cards de forma automática: el volcado en bruto
 * de todas las columnas queda ilegible en tablas densas. Las cards
 * móviles buenas se diseñan por módulo (campos clave + detalle al tocar)
 * y se marcan explícitamente. Por defecto, tabla densa = scroll seguro.
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
