/**
 * useMultiSort — ordenación multi-criterio tipo checks acumulativo
 *
 * Comportamiento:
 * - 1er click en col nueva   → activa como criterio N (se añade al final)
 * - 2º click en misma col    → invierte dirección (↓ desc)
 * - 3er click en misma col   → DESACTIVA y las demás se reordenan
 * - sortIndicator(col)       → ' ↑' | ' ↓' | ' ↑2' | ' ↓2' | ' ↑3' | ' ↓3' | ''
 * - applySorts(rows)         → rows ordenadas por todos los criterios activos
 *
 * Ejemplo: click Concepto → Concepto↑1, click Fecha → Concepto↑1 Fecha↑2
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
          // Col nueva: añadir al FINAL — el orden de clicks define la prioridad
          const next = [...prev, { col, dir: 'asc' as SortDir }]
          return next.slice(0, maxCriteria)
        }

        const criterion = prev[idx]

        if (criterion.dir === 'asc') {
          // Ya activa en asc → cambiar a desc
          return prev.map((s, i) => i === idx ? { ...s, dir: 'desc' as SortDir } : s)
        }

        // Ya activa en desc → DESACTIVAR y reordenar (gaps eliminados)
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
