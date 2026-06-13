import { useEffect } from 'react'

/**
 * Convertidor global tabla → cards apiladas en móvil (≤768px).
 * Recorre todas las <table> dentro de <main>, lee la cabecera de
 * cada columna y la estampa en cada celda (data-label) para que el
 * CSS muestre "Etiqueta · Valor". Añade la clase .sl-cards que dispara
 * el volcado visual. Re-aplica cuando entran filas/tablas nuevas.
 *
 * Excluir una tabla concreta del volcado: marcarla con data-no-cards
 * (mantendrá scroll horizontal en lugar de apilar). Útil en matrices
 * tipo Running / Cashflow / Panel Global / Menú Engineering.
 *
 * Solo trabaja en móvil. En escritorio no toca el DOM.
 */

const MQ = '(max-width: 768px)'

function stampTables() {
  const main = document.querySelector('main')
  if (!main) return
  const tables = main.querySelectorAll<HTMLTableElement>('table:not([data-no-cards])')
  tables.forEach((table) => {
    const headers = Array.from(table.querySelectorAll('thead th')).map(
      (th) => (th.textContent || '').trim()
    )
    if (!headers.length) return
    table.classList.add('sl-cards')
    table.querySelectorAll('tbody tr').forEach((tr) => {
      const cells = tr.querySelectorAll('td')
      cells.forEach((td, idx) => {
        const label = headers[idx]
        if (label && !td.getAttribute('data-label')) {
          td.setAttribute('data-label', label)
        }
      })
    })
  })
}

export default function ResponsiveTables() {
  useEffect(() => {
    const mql = window.matchMedia(MQ)
    let observer: MutationObserver | null = null
    let raf = 0

    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => stampTables())
    }

    const connect = () => {
      const main = document.querySelector('main')
      if (!main || observer) return
      stampTables()
      // Observa solo altas/bajas de nodos (no atributos) → sin bucles.
      observer = new MutationObserver(schedule)
      observer.observe(main, { childList: true, subtree: true })
    }

    const disconnect = () => {
      if (observer) {
        observer.disconnect()
        observer = null
      }
    }

    const apply = () => {
      if (mql.matches) connect()
      else disconnect()
    }

    apply()
    mql.addEventListener('change', apply)
    return () => {
      mql.removeEventListener('change', apply)
      disconnect()
      cancelAnimationFrame(raf)
    }
  }, [])

  return null
}
