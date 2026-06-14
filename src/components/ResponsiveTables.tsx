import { useEffect, useState } from 'react'
import { esMovil } from '@/hooks/useEsMovil'

/**
 * Sincroniza <html class="sl-movil"> con la detección automática y muestra
 * un panel de diagnóstico TEMPORAL en grande para leer, desde una foto, qué
 * detecta el móvil real (táctil, puntero, medidas, build). QUITAR tras cerrar.
 */

const BUILD = 'DIAG-A'

function syncClase() {
  document.documentElement.classList.toggle('sl-movil', esMovil())
}

export default function ResponsiveTables() {
  const [info, setInfo] = useState<string[]>([])

  useEffect(() => {
    const upd = () => {
      syncClase()
      const mt = navigator.maxTouchPoints || 0
      const coarse = window.matchMedia('(pointer: coarse)').matches
      const ua = navigator.userAgent || ''
      const uaCorto = /Android/i.test(ua)
        ? 'Android'
        : /iPhone|iPad|iPod/i.test(ua)
        ? 'iOS'
        : /Windows/i.test(ua)
        ? 'Windows'
        : /Mac/i.test(ua)
        ? 'Mac'
        : 'otro'
      setInfo([
        `BUILD ${BUILD}`,
        `RESULTADO: ${esMovil() ? 'MÓVIL' : 'ORDENADOR'}`,
        `tactil(maxTouch): ${mt}`,
        `puntero: ${coarse ? 'dedo (coarse)' : 'raton (fine)'}`,
        `ventana: ${window.innerWidth} x ${window.innerHeight}`,
        `pantalla: ${window.screen.width} x ${window.screen.height}`,
        `UA: ${uaCorto}`,
      ])
    }
    upd()
    window.addEventListener('resize', upd)
    window.addEventListener('orientationchange', upd)
    return () => {
      window.removeEventListener('resize', upd)
      window.removeEventListener('orientationchange', upd)
    }
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2147483647,
        background: '#B01D23',
        color: '#fff',
        font: '700 13px/1.55 monospace',
        padding: '10px 13px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
      }}
    >
      {info.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  )
}
