import { useEffect, useState } from 'react'

/**
 * Detección automática de móvil vs ordenador.
 *
 * Criterio principal: la PANTALLA TÁCTIL. Es lo único que un móvil no puede
 * ocultar, ni siquiera en modo "Sitio de escritorio" (es hardware). Un
 * ordenador con ratón no tiene táctil → escritorio. Un móvil siempre tiene
 * táctil → móvil, pase lo que pase con el ancho, el user-agent o el modo.
 */
function esMovil(): boolean {
  if (typeof window === 'undefined') return false
  // 1. Hardware táctil (sobrevive al modo escritorio)
  if ((navigator.maxTouchPoints || 0) > 0) return true
  // 2. Puntero grueso (dedo)
  if (window.matchMedia('(pointer: coarse)').matches) return true
  // 3. Viewport estrecho
  if (window.matchMedia('(max-width: 768px)').matches) return true
  // 4. User-Agent de móvil
  const ua = navigator.userAgent || ''
  if (/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|BlackBerry|Opera Mini|IEMobile|Windows Phone/i.test(ua)) return true
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
