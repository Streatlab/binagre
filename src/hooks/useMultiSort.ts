/**
 * useMultiSort — ordenación multi-criterio tipo checks acumulativo
 *
 * Comportamiento:
 * - 1er click en col nueva   → activa como criterio 1 (↑ asc), desplaza las demás (+1)
 * - 2º click en misma col    → invierte dirección (↓ desc)
 * - Click en col ya activa   → la DESACTIVA y las demás se reordenan (gaps eliminados)
 * - sortIndicator(col)       → ' ↑' | ' ↓' | ' ↑2' | ' ↓2' | ' ↑3' | ' ↓3' | ''
 * - applySorts(rows)         → rows ordenadas por todos los criterios activos
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
  const { getValue, maxCriteria = 3 } = opts
  const [sorts, setSorts] = useState<SortCriterion<Col>[]>([])

  const handleSort = useCallback(
    (col: Col) => {
      setSorts(prev => {
        const idx = prev.findIndex(s => s.col === col)

        if (idx === -1) {
          // Col nueva: añadir al FRENTE como criterio 1, desplazar las demás
          const next = [{ col, dir: 'asc' as SortDir }, ...prev]
          return next.slice(0, maxCriteria)
        }

        const criterion = prev[idx]

        if (criterion.dir === 'asc') {
          // Primer click (ya activa en asc) → cambiar a desc
          return prev.map((s, i) => i === idx ? { ...s, dir: 'desc' as SortDir } : s)
        }

        // Segundo click (ya activa en desc) → DESACTIVAR y reordenar
        return prev.filter((_, i) => i !== idx)
      })
    },
    [maxCriteria]
  )

  const sortIndicator = useCallback(
    (col: Col): string => {
      const idx = sorts.findIndex(s => s.col === col)
      if (idx === -1) return ''
      const arrow = sorts[idx].dir === 'asc' ? '↑' : '↓'
      const num = sorts.length > 1 ? String(idx + 1) : ''
      return ` ${arrow}${num}`
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
