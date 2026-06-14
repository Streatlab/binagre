import { useEffect, useState } from 'react'

/**
 * Detección robusta de móvil vs ordenador + interruptor manual.
 *
 * Problema: en "Sitio de escritorio" el navegador del móvil falsea ancho,
 * pantalla y puntero, así que ninguna señal automática es 100% fiable.
 * Solución: combinamos varias señales reales del dispositivo Y dejamos un
 * override manual (Móvil / Ordenador) guardado en el navegador, que manda
 * por encima de todo. Así el usuario nunca se queda atrapado en escritorio.
 */

export type Vista = 'auto' | 'movil' | 'ordenador'

const KEY = 'sl_vista'
const EVENTO = 'sl-vista'

export function getVista(): Vista {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'movil' || v === 'ordenador' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

export function setVista(v: Vista) {
  try {
    if (v === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, v)
  } catch {
    /* almacenamiento no disponible: seguimos con detección automática */
  }
  window.dispatchEvent(new Event(EVENTO))
}

/** Detección automática por múltiples señales (sin contar el override). */
function detectaMovil(): boolean {
  if (typeof window === 'undefined') return false
  // 1. Viewport estrecho (lo normal en un móvil sin modo escritorio)
  if (window.matchMedia('(max-width: 768px)').matches) return true
  // 2. User-Agent móvil
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

/** Resultado final: override manual si existe, si no la detección automática. */
export function esMovil(): boolean {
  const v = getVista()
  if (v === 'movil') return true
  if (v === 'ordenador') return false
  return detectaMovil()
}

export function useEsMovil(): boolean {
  const [movil, setMovil] = useState<boolean>(esMovil)
  useEffect(() => {
    const on = () => setMovil(esMovil())
    on()
    window.addEventListener('resize', on)
    window.addEventListener('orientationchange', on)
    window.addEventListener(EVENTO, on)
    return () => {
      window.removeEventListener('resize', on)
      window.removeEventListener('orientationchange', on)
      window.removeEventListener(EVENTO, on)
    }
  }, [])
  return movil
}

export default useEsMovil
