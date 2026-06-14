import { useEffect, useState } from 'react'
import { esMovil, getVista, setVista, type Vista } from '@/hooks/useEsMovil'

/**
 * Sincroniza <html class="sl-movil"> según la vista efectiva y muestra el
 * interruptor manual Móvil / Ordenador (siempre visible, abajo a la derecha).
 *
 * El override manual manda sobre la detección automática. Si el navegador
 * está en "Sitio de escritorio" y la detección falla, el usuario fuerza
 * Móvil con un toque y se queda guardado.
 */

function syncClase() {
  document.documentElement.classList.toggle('sl-movil', esMovil())
}

const SIGUIENTE: Record<Vista, Vista> = { auto: 'movil', movil: 'ordenador', ordenador: 'auto' }
const ETIQUETA: Record<Vista, string> = { auto: 'Auto', movil: 'Móvil', ordenador: 'Ordenador' }

export default function ResponsiveTables() {
  const [vista, setV] = useState<Vista>(getVista)

  useEffect(() => {
    const on = () => {
      syncClase()
      setV(getVista())
    }
    on()
    window.addEventListener('resize', on)
    window.addEventListener('orientationchange', on)
    window.addEventListener('sl-vista', on)
    return () => {
      window.removeEventListener('resize', on)
      window.removeEventListener('orientationchange', on)
      window.removeEventListener('sl-vista', on)
    }
  }, [])

  const efectivaMovil = esMovil()
  const detalle = vista === 'auto' ? ` · ${efectivaMovil ? 'móvil' : 'ordenador'}` : ''

  const iconoMovil = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <line x1="11" y1="18" x2="13" y2="18" />
    </svg>
  )
  const iconoOrdenador = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <line x1="8" y1="20" x2="16" y2="20" />
      <line x1="12" y1="16" x2="12" y2="20" />
    </svg>
  )

  return (
    <button
      onClick={() => setVista(SIGUIENTE[vista])}
      title="Cambiar entre vista móvil y ordenador"
      aria-label={`Vista actual: ${ETIQUETA[vista]}. Tocar para cambiar.`}
      style={{
        position: 'fixed',
        bottom: 14,
        right: 14,
        zIndex: 2147483647,
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        background: '#1e2233',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.18)',
        borderRadius: 22,
        padding: '8px 13px',
        cursor: 'pointer',
        font: '600 12px/1 Lexend, sans-serif',
        boxShadow: '0 2px 10px rgba(0,0,0,0.28)',
      }}
    >
      {efectivaMovil ? iconoMovil : iconoOrdenador}
      <span>Vista: {ETIQUETA[vista]}{detalle}</span>
    </button>
  )
}
