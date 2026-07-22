import { INK } from '@/styles/neobrutal'
import { useEffect, useState } from 'react'

const OSW = 'Oswald, sans-serif'

/**
 * Fuerza la escala de móvil aunque el navegador esté en "modo escritorio"
 * (en ese modo Chrome ignora la meta viewport, así que escalamos el lienzo).
 * Devuelve el ancho base y el factor de escala; null cuando no hace falta.
 */
export function useEscalaMovil() {
  const [esc, setEsc] = useState<{ base: number; scale: number; alto: number } | null>(null)

  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      // Si el navegador nos da un lienzo demasiado ancho para ser un móvil real,
      // dibujamos a 402px de ancho y lo escalamos hasta llenar la pantalla.
      if (w > 560) {
        const base = 402
        setEsc({ base, scale: w / base, alto: h / (w / base) })
      } else {
        setEsc(null)
      }
    }
    calc()
    window.addEventListener('resize', calc)
    window.addEventListener('orientationchange', calc)
    return () => {
      window.removeEventListener('resize', calc)
      window.removeEventListener('orientationchange', calc)
    }
  }, [])

  return esc
}

/** Banner "Instalar app" (Android/Chrome) + instrucción para iPhone. */
export function InstalarPWA() {
  const [prompt, setPrompt] = useState<any>(null)
  const [oculto, setOculto] = useState<boolean>(() => localStorage.getItem('pwa_oculto') === '1')
  const [ios, setIos] = useState(false)

  useEffect(() => {
    const yaInstalada = window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true
    if (yaInstalada) { setOculto(true); return }

    const esIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    setIos(esIos)

    const onPrompt = (e: any) => { e.preventDefault(); setPrompt(e) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (oculto) return null
  if (!prompt && !ios) return null

  const cerrar = () => { localStorage.setItem('pwa_oculto', '1'); setOculto(true) }
  const instalar = async () => {
    if (!prompt) return
    prompt.prompt()
    await prompt.userChoice
    setPrompt(null)
    cerrar()
  }

  return (
    <div style={{
      background: '#FFC400', border: `3px solid ${INK}`, boxShadow: `4px 4px 0 ${INK}`,
      padding: 10, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: 22 }}>📲</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b style={{ display: 'block', fontFamily: OSW, fontWeight: 700, fontSize: 14, textTransform: 'uppercase' }}>
          Instalar Binagre
        </b>
        <span style={{ fontSize: 10.5, fontWeight: 500 }}>
          {ios ? 'Compartir → Añadir a pantalla de inicio' : 'Se abre como una app, sin barra del navegador'}
        </span>
      </div>
      {!ios && (
        <button onClick={instalar} style={{
          background: INK, color: '#FFC400', border: `2px solid ${INK}`, borderRadius: 0,
          fontFamily: OSW, fontWeight: 700, fontSize: 12, textTransform: 'uppercase',
          padding: '6px 10px', cursor: 'pointer',
        }}>Instalar</button>
      )}
      <button onClick={cerrar} aria-label="Cerrar" style={{
        background: 'transparent', border: 'none', borderRadius: 0, fontFamily: OSW,
        fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: '0 4px',
      }}>✕</button>
    </div>
  )
}
