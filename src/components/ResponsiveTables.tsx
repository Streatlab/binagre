import { useEffect } from 'react'

/**
 * Responsive móvil del ERP (capa transversal).
 *
 * 1) Detecta si el dispositivo es móvil de verdad — NO se fía solo del
 *    ancho que reporta el navegador, porque el modo "Sitio de escritorio"
 *    miente y reporta ~980px. Usa también puntero táctil + tamaño físico
 *    de pantalla. Marca <html class="sl-movil"> para que se active el CSS.
 * 2) Convierte cada <table> en cards apiladas: lee la cabecera de cada
 *    columna y la estampa en cada celda (data-label). Re-aplica cuando
 *    entran filas/tablas nuevas.
 *
 * Excluir una tabla del volcado: marcarla con data-no-cards (mantiene
 * scroll horizontal). Útil en matrices (Running, Cashflow, Panel Global,
 * Menú Engineering).
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

function stampTables() {
  const main = document.querySelector('main')
  if (!main) return
  main.querySelectorAll<HTMLTableElement>('table:not([data-no-cards])').forEach((table) => {
    const headers = Array.from(table.querySelectorAll('thead th')).map(
      (th) => (th.textContent || '').trim()
    )
    if (!headers.length) return
    table.classList.add('sl-cards')
    table.querySelectorAll('tbody tr').forEach((tr) => {
      tr.querySelectorAll('td').forEach((td, idx) => {
        const label = headers[idx]
        if (label && !td.getAttribute('data-label')) td.setAttribute('data-label', label)
      })
    })
  })
}

export default function ResponsiveTables() {
  useEffect(() => {
    syncMovil()
    stampTables()

    let raf = 0
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(stampTables)
    }
    const onResize = () => {
      syncMovil()
      schedule()
    }

    const main = document.querySelector('main')
    const observer = new MutationObserver(schedule)
    if (main) observer.observe(main, { childList: true, subtree: true })

    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      cancelAnimationFrame(raf)
    }
  }, [])

  return null
}
