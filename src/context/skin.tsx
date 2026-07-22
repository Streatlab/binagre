import { BLANCO, GRANATE } from '@/styles/neobrutal'
/**
 * skin — interruptor entre el estilo Neobrutal (antiguo) y el estilo SL (canon).
 *
 * jul-26 · Ley Visual SL v2 APROBADA: SL es el estilo por defecto.
 * El interruptor se mantiene para comparar mientras quedan pantallas sin migrar.
 *
 * Aislado a propósito: no toca ningún token ni componente neobrutal.
 * Sin provider: cualquier pantalla puede llamar a useSkin() y colocar <SkinToggle />.
 */
import { useEffect, useState } from 'react'
import '@/styles/sl.css'
import '@/styles/sl-movil.css'

export type Skin = 'neo' | 'sl'

const KEY = 'sl_skin'
const EVT = 'sl_skin:changed'

/** Canon: SL. Solo se sirve neobrutal si el usuario lo pide expresamente. */
function leer(): Skin {
  try { return localStorage.getItem(KEY) === 'neo' ? 'neo' : 'sl' } catch { return 'sl' }
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
 * Interruptor NEO / SL. Se coloca en la barra superior de cada pantalla migrada.
 * Estilos en línea a propósito: así ninguna regla global (neobrutal, index.css)
 * puede pisarle el color. El activo va SIEMPRE en granate de marca.
 */
export function SkinToggle() {
  const { skin, setSkin } = useSkin()
  const esMovil = useEsMovil()

  const base: React.CSSProperties = {
    border: 'none',
    cursor: 'pointer',
    padding: esMovil ? '9px 16px' : '7px 14px',
    fontFamily: "'Nunito', system-ui, sans-serif",
    fontSize: esMovil ? 12 : 11,
    fontWeight: 800,
    letterSpacing: '0.6px',
    lineHeight: 1.2,
    borderRadius: 0,
    boxShadow: 'none',
    minHeight: esMovil ? 40 : undefined,
  }
  const on: React.CSSProperties = { ...base, background: GRANATE, color: BLANCO }
  const off: React.CSSProperties = { ...base, background: 'transparent', color: '#9C9894' }

  return (
    <div
      role="group"
      aria-label="Estilo visual"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0,
        border: '1px solid #F0E7DC',
        borderRadius: 999,
        overflow: 'hidden',
        background: BLANCO,
      }}
    >
      <button style={skin === 'neo' ? on : off} onClick={() => setSkin('neo')}>NEO</button>
      <button style={skin === 'sl' ? on : off} onClick={() => setSkin('sl')}>SL</button>
    </div>
  )
}
