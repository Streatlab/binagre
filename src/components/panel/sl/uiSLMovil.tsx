/**
 * uiSLMovil — detección de pantalla móvil para la Ley Visual SL v2.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CÓMO HACER RESPONSIVE UNA PANTALLA SL (receta obligatoria)
 * ═══════════════════════════════════════════════════════════════════
 *
 * 1) Importa el hook:
 *      import { useMovil } from '@/components/panel/sl/uiSLMovil'
 *
 * 2) Llámalo arriba del componente:
 *      const movil = useMovil()   // true si la pantalla mide < 768px
 *
 *    Detecta con matchMedia y se actualiza en vivo: si giras el móvil
 *    o achicas la ventana del ordenador, la pantalla se reordena sola.
 *    Por eso funciona igual en móvil real y en "ordenador con pantalla
 *    móvil" (ventana estrecha o modo responsive del navegador).
 *
 * 3) Aplica estas CUATRO reglas, siempre las mismas:
 *
 *    a) Padding de la página:
 *         padding: movil ? '14px 12px' : '24px 28px'
 *
 *    b) Rejilla de KPIs (KpiGrid): 4 columnas pasan a 2.
 *         <KpiGrid cols={movil ? 2 : 4}>
 *
 *    c) Rejillas de dos cards (gráfico + ranking): pasan a 1 columna.
 *         gridTemplateColumns: movil ? '1fr' : '1.15fr 1fr'
 *
 *    d) Rejillas dentro de modales: también a 1 columna.
 *         gridTemplateColumns: movil ? '1fr' : 'repeat(2, 1fr)'
 *
 * 4) Lo que NO hay que tocar:
 *    - Las tablas ya hacen scroll lateral solas (overflowX en Tabla).
 *    - El Hero ya envuelve sus piezas (flexWrap).
 *    - Pills, chips y botones ya envuelven (flexWrap en Toolbar/Chips).
 *
 * Toda pantalla SL nueva debe nacer con esta receta puesta.
 * ═══════════════════════════════════════════════════════════════════
 */
import { useEffect, useState } from 'react'

/** Punto de corte único para todo el skin SL. */
export const BP_MOVIL = 768

/**
 * true si el ancho visible es menor que BP_MOVIL.
 * Reacciona en vivo a cambios de tamaño y orientación.
 */
export function useMovil(): boolean {
  const [movil, setMovil] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(`(max-width: ${BP_MOVIL - 1}px)`).matches
  })

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${BP_MOVIL - 1}px)`)
    const on = (e: MediaQueryListEvent) => setMovil(e.matches)
    mq.addEventListener('change', on)
    setMovil(mq.matches)
    return () => mq.removeEventListener('change', on)
  }, [])

  return movil
}
