/**
 * useMultiSort — ordenación multi-criterio estilo Excel
 *
 * Uso:
 *   const { sorts, handleSort, sortIndicator, applySorts } = useMultiSort<MyRow>({ getValue })
 *
 * - 1er click en columna nueva  → se añade como criterio 1 (el anterior pasa a ser 2)
 * - Click en columna ya activa  → alterna asc/desc
 * - sortIndicator(col)          → ' ↑' | ' ↓' | ' ↑2' | ' ↓2' | ''
 * - applySorts(rows)            → rows ordenadas por todos los criterios
 */

import { useState, useCallback } from 'react'

export type SortDir = 'asc' | 'desc'

export interface SortCriterion<Col extends string = string> {
  col: Col
  dir: SortDir
}

export interface UseMultiSortOptions<Row, Col extends string = string> {
  getValue: (row: Row, col: Col) => string | number | null | undefined
  maxCriteria?: number
}

export function useMultiSort<Row, Col extends string = string>(
  opts: UseMultiSortOptions<Row, Col>
) {
  const { getValue, maxCriteria = 2 } = opts
  const [sorts, setSorts] = useState<SortCriterion<Col>[]>([])

  const handleSort = useCallback(
    (col: Col) => {
      setSorts(prev => {
        const existing = prev.findIndex(s => s.col === col)

        if (existing !== -1) {
          // Ya está: alterna dirección manteniendo posición
          return prev.map((s, i) =>
            i === existing ? { ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' } : s
          )
        }

        // Nueva columna: se añade al frente como criterio 1
        // Los anteriores se desplazan (máx 2 criterios)
        const next = [{ col, dir: 'asc' as SortDir }, ...prev]
        return next.slice(0, maxCriteria)
      })
    },
    [maxCriteria]
  )

  const sortIndicator = useCallback(
    (col: Col): string => {
      const idx = sorts.findIndex(s => s.col === col)
      if (idx === -1) return ''
      const arrow = sorts[idx].dir === 'asc' ? '↑' : '↓'
      return idx === 0 ? ` ${arrow}` : ` ${arrow}${idx + 1}`
    },
    [sorts]
  )

  const applySorts = useCallback(
    (rows: Row[]): Row[] => {
      if (sorts.length === 0) return rows
      return [...rows].sort((a, b) => {
        for (const { col, dir } of sorts) {
          const va = getValue(a, col) ?? ''
          const vb = getValue(b, col) ?? ''
          let cmp = 0
          if (typeof va === 'number' && typeof vb === 'number') {
            cmp = va - vb
          } else {
            cmp = String(va).localeCompare(String(vb), 'es', { numeric: true })
          }
          if (cmp !== 0) return dir === 'asc' ? cmp : -cmp
        }
        return 0
      })
    },
    [sorts, getValue]
  )

  return { sorts, handleSort, sortIndicator, applySorts }
}
