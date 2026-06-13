import { useEffect, useState } from 'react'

/**
 * Devuelve true en dispositivo móvil real. No se fía solo del ancho del
 * navegador (el modo "Sitio de escritorio" miente): usa también puntero
 * táctil + tamaño físico de pantalla. Reutilizable en cualquier módulo
 * para decidir entre vista tabla (escritorio) y vista cards (móvil).
 */
function calc(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(max-width: 768px)').matches) return true
  const tactil = window.matchMedia('(pointer: coarse)').matches
  const ladoCorto = Math.min(window.screen.width, window.screen.height)
  return tactil && ladoCorto <= 820
}

export function useEsMovil(): boolean {
  const [movil, setMovil] = useState<boolean>(calc)
  useEffect(() => {
    const on = () => setMovil(calc())
    window.addEventListener('resize', on)
    window.addEventListener('orientationchange', on)
    return () => {
      window.removeEventListener('resize', on)
      window.removeEventListener('orientationchange', on)
    }
  }, [])
  return movil
}

export default useEsMovil
