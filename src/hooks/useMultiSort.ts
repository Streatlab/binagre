/**
 * useMultiSort — ordenación multi-criterio estilo Excel
 *
 * Uso:
 *   const { sorts, handleSort, sortIndicator, applySorts } = useMultiSort<MyRow>({ getValue })
 *
 * - Click normal      → columna principal (resetea secundarias)
 * - Shift+Click       → añade/alterna criterio secundario
 * - sortIndicator(col) → '↑' | '↓' | '↑₂' | '↓₂' | ''
 * - applySorts(rows)   → rows ordenadas
 */

import { useState, useCallback } from 'react'

export type SortDir = 'asc' | 'desc'

export interface SortCriterion<Col extends string = string> {
  col: Col
  dir: SortDir
}

export interface UseMultiSortOptions<Row, Col extends string = string> {
  /** Extrae el valor comparable de una fila para una columna dada */
  getValue: (row: Row, col: Col) => string | number | null | undefined
  /** Máx criterios simultáneos (default 2) */
  maxCriteria?: number
}

export function useMultiSort<Row, Col extends string = string>(
  opts: UseMultiSortOptions<Row, Col>
) {
  const { getValue, maxCriteria = 2 } = opts
  const [sorts, setSorts] = useState<SortCriterion<Col>[]>([])

  /** Manejar click en header. shiftKey añade criterio secundario. */
  const handleSort = useCallback(
    (col: Col, shiftKey = false) => {
      setSorts(prev => {
        const existing = prev.findIndex(s => s.col === col)

        if (shiftKey) {
          // Shift+click: añade o alterna criterio secundario
          if (existing !== -1) {
            // Ya existe: alterna dirección
            return prev.map((s, i) =>
              i === existing ? { ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' } : s
            )
          }
          // Añadir nuevo criterio secundario (respetar maxCriteria)
          const next = [...prev, { col, dir: 'asc' as SortDir }]
          return next.slice(-maxCriteria)
        } else {
          // Click normal: si es la columna primaria, alterna dirección
          if (prev.length > 0 && prev[0].col === col) {
            return [{ col, dir: prev[0].dir === 'asc' ? 'desc' : 'asc' }, ...prev.slice(1)]
          }
          // Nueva columna principal, mantener secundarias
          const secondaries = prev.filter(s => s.col !== col).slice(0, maxCriteria - 1)
          return [{ col, dir: 'asc' }, ...secondaries]
        }
      })
    },
    [maxCriteria]
  )

  /** Indicador visual para el header. '' si no ordena, '↑' / '↓' primario, '↑₂' / '↓₂' secundario */
  const sortIndicator = useCallback(
    (col: Col): string => {
      const idx = sorts.findIndex(s => s.col === col)
      if (idx === -1) return ''
      const dir = sorts[idx].dir
      const arrow = dir === 'asc' ? '↑' : '↓'
      return idx === 0 ? ` ${arrow}` : ` ${arrow}${idx + 1}`
    },
    [sorts]
  )

  /** Aplica los criterios de orden a un array de filas */
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
