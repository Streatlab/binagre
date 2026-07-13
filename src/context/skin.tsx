/**
 * skin — interruptor entre el estilo Neobrutal (antiguo) y el estilo SL (canon).
 *
 * jul-26 · Ley Visual SL v2 APROBADA: SL pasa a ser el estilo POR DEFECTO.
 * El interruptor se mantiene solo para poder comparar con el neobrutal mientras
 * quedan pestañas sin migrar (Operaciones, Finanzas, Marcas). Cuando estén todas
 * en SL, se retira el interruptor y el neobrutal se borra.
 *
 * Aislado a propósito: no toca ningún token ni componente neobrutal.
 * Sin provider: cualquier pantalla puede llamar a useSkin() y colocar <SkinToggle />.
 */
import { useEffect, useState } from 'react'
import '@/styles/sl.css'

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

/** Interruptor NEO / SL. Se coloca en la barra superior de cada pantalla migrada. */
export function SkinToggle() {
  const { skin, setSkin } = useSkin()
  return (
    <div className="sl-switch" role="group" aria-label="Estilo visual">
      <button className={skin === 'neo' ? 'on' : ''} onClick={() => setSkin('neo')}>NEO</button>
      <button className={skin === 'sl' ? 'on' : ''} onClick={() => setSkin('sl')}>SL</button>
    </div>
  )
}
