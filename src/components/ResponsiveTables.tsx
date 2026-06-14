import { useEffect, useState } from 'react'

/**
 * Responsive móvil del ERP + indicador de diagnóstico temporal.
 *
 * Detecta dispositivo móvil real (no se fía del ancho que reporta el
 * navegador) y marca <html class="sl-movil">. Muestra un recuadro con
 * lo que detecta para diagnosticar en pantalla real. QUITAR tras validar.
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
  const [info, setInfo] = useState('')

  useEffect(() => {
    const upd = () => {
      syncMovil()
      const coarse = window.matchMedia('(pointer: coarse)').matches
      setInfo(
        `${esMovil() ? 'MÓVIL ✓' : 'ESCRITORIO ✗'} · vp ${window.innerWidth}×${window.innerHeight} · scr ${window.screen.width}×${window.screen.height} · ${coarse ? 'táctil' : 'ratón'}`
      )
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
        bottom: 8,
        left: 8,
        zIndex: 2147483647,
        background: 'rgba(176,29,35,0.94)',
        color: '#fff',
        font: '700 10px/1.3 monospace',
        padding: '6px 9px',
        borderRadius: 6,
        pointerEvents: 'none',
        maxWidth: '92vw',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      SL· {info}
    </div>
  )
}
