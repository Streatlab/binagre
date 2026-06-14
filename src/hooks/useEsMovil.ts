import { useEffect, useState } from 'react'

/**
 * Detección automática de móvil vs ordenador por varias señales reales del
 * dispositivo (no solo el ancho del navegador). Sin botón ni override.
 */
function esMovil(): boolean {
  if (typeof window === 'undefined') return false
  // 1. Viewport estrecho (móvil normal)
  if (window.matchMedia('(max-width: 768px)').matches) return true
  // 2. User-Agent de móvil
  const ua = navigator.userAgent || ''
  if (/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|BlackBerry|Opera Mini|IEMobile|Windows Phone/i.test(ua)) return true
  // 3. Client Hints (Chrome): marca explícita de móvil
  const uad = (navigator as unknown as { userAgentData?: { mobile?: boolean } }).userAgentData
  if (uad && uad.mobile === true) return true
  // 4. Hardware táctil + pantalla físicamente pequeña
  const tactil = (navigator.maxTouchPoints || 0) > 0
  const ladoCorto = Math.min(window.screen.width, window.screen.height)
  if (tactil && ladoCorto <= 900) return true
  return false
}

export { esMovil }

export function useEsMovil(): boolean {
  const [movil, setMovil] = useState<boolean>(esMovil)
  useEffect(() => {
    const on = () => setMovil(esMovil())
    on()
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
