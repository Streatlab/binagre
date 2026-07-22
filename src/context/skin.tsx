/**
 * skin — sistema visual ÚNICO: SL (canon). El interruptor NEO/SL se retiró
 * (C30): neobrutal es ya solo el alias del kit. `skin` siempre vale 'sl'.
 */
import { useEffect, useState } from 'react'
import '@/styles/sl.css'
import '@/styles/sl-movil.css'

export type Skin = 'neo' | 'sl'

const KEY = 'sl_skin'
const EVT = 'sl_skin:changed'

/** Canon único: SL. Ya no se sirve la variante neobrutal antigua. */
function leer(): Skin {
  return 'sl'
}

export function useSkin() {
  const [skin, setSkinState] = useState<Skin>(leer)

  useEffect(() => {
    const on = () => setSkinState(leer())
    window.addEventListener(EVT, on)
    return () => window.removeEventListener(EVT, on)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-skin', skin)
  }, [skin])

  const setSkin = (s: Skin) => {
    try { localStorage.setItem(KEY, s) } catch { /* sin persistencia */ }
    setSkinState(s)
    window.dispatchEvent(new Event(EVT))
  }

  return { skin, setSkin }
}

/**
 * ¿Estamos en móvil? Detección real por ancho de pantalla, no por navegador.
 * Se actualiza sola al girar el móvil o al estrechar la ventana del ordenador,
 * así que también funciona con las herramientas de desarrollo en modo móvil.
 */
export function useEsMovil(corte = 768) {
  const [esMovil, setEsMovil] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(`(max-width: ${corte}px)`).matches
  )

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${corte}px)`)
    const on = (e: MediaQueryListEvent) => setEsMovil(e.matches)
    setEsMovil(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [corte])

  return esMovil
}

/**
 * Interruptor NEO / SL retirado (C30). Se mantiene el export como no-op para no
 * romper las pantallas que aún colocan <SkinToggle />; no renderiza nada.
 */
export function SkinToggle() {
  return null
}
