/**
 * useMultiSort — ordenación multi-criterio canónica del ERP Binagre
 *
 * ESTÁNDAR ÚNICO: todas las tablas del ERP con ordenación deben usar este hook.
 *
 * Comportamiento (tipo Excel):
 * - 1er click col nueva    → añade al FINAL como criterio (1↑)
 * - 2º click misma col     → invierte (1↓)
 * - 3er click misma col    → desactiva, las demás se reordenan sin gaps
 * - Múltiples cols apilan  → 1ª pulsada = prioridad 1, 2ª = prioridad 2, etc
 * - clearSorts             → quita todos los criterios
 * - sortIndex/sortDir      → para componente SortableHeader
 * - applySort/applySorts   → ordena en memoria
 * - toSupabaseOrder        → traduce a {field, ascending}[] para query servidor
 *
 * @param storageKey  clave única por tabla (futuro: persistencia URL)
 * @param opts.getValue  (opcional) función global col→valor para applySorts
 * @param opts.maxCriteria  máximo de criterios apilados (default 5)
 */

import { useState, useCallback, useMemo } from 'react'

export type SortDir = 'asc' | 'desc'

export interface SortCriterion<Col extends string = string> {
  col: Col
  dir: SortDir
}

export interface UseMultiSortOptions<Row = any, Col extends string = string> {
  /** opcional: función global col→valor. Si se pasa, applySorts(rows) funciona sin más */
  getValue?: (row: Row, col: Col) => string | number | null | undefined
  maxCriteria?: number
}

/**
 * Hook canónico. Acepta tanto el patrón legacy (con storageKey string) como
 * el patrón nuevo (con options object).
 */
export function useMultiSort<Row = any, Col extends string = string>(
  arg?: string | UseMultiSortOptions<Row, Col>
) {
  const opts: UseMultiSortOptions<Row, Col> = typeof arg === 'string' || arg === undefined
    ? {}
    : arg
  const { getValue, maxCriteria = 5 } = opts
  const [sorts, setSorts] = useState<SortCriterion<Col>[]>([])

  const handleSort = useCallback(
    (col: Col) => {
      setSorts(prev => {
        const idx = prev.findIndex(s => s.col === col)
        if (idx === -1) {
          const next = [...prev, { col, dir: 'asc' as SortDir }]
          return next.slice(0, maxCriteria)
        }
        const criterion = prev[idx]
        if (criterion.dir === 'asc') {
          return prev.map((s, i) => i === idx ? { ...s, dir: 'desc' as SortDir } : s)
        }
        return prev.filter((_, i) => i !== idx)
      })
    },
    [maxCriteria]
  )

  const clearSorts = useCallback(() => { setSorts([]) }, [])

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

  const sortIndex = useCallback((col: Col): number => sorts.findIndex(s => s.col === col), [sorts])
  const sortDir = useCallback((col: Col): SortDir | null => {
    const s = sorts.find(s => s.col === col)
    return s ? s.dir : null
  }, [sorts])

  /** Ordena con getValue del hook (modo legacy) */
  const applySorts = useCallback(
    (rows: Row[]): Row[] => {
      if (sorts.length === 0 || !getValue) return rows
      return [...rows].sort((a, b) => {
        for (const { col, dir } of sorts) {
          const va = getValue(a, col) ?? ''
          const vb = getValue(b, col) ?? ''
          let cmp = 0
          if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb
          else cmp = String(va).localeCompare(String(vb), 'es', { numeric: true })
          if (cmp !== 0) return dir === 'asc' ? cmp : -cmp
        }
        return 0
      })
    },
    [sorts, getValue]
  )

  /** Ordena con getters específicos por llamada (patrón nuevo) */
  const applySort = useCallback(
    <T,>(rows: T[], getters: Record<string, (r: T) => any>): T[] => {
      if (sorts.length === 0) return rows
      return [...rows].sort((a, b) => {
        for (const { col, dir } of sorts) {
          const get = getters[col as string]
          if (!get) continue
          const va = get(a)
          const vb = get(b)
          if (va === vb) continue
          if (va == null) return 1
          if (vb == null) return -1
          const cmp = typeof va === 'number' && typeof vb === 'number'
            ? va - vb
            : String(va).localeCompare(String(vb), 'es', { sensitivity: 'base' })
          if (cmp !== 0) return dir === 'asc' ? cmp : -cmp
        }
        return 0
      })
    },
    [sorts]
  )

  /** Traduce a parámetros Supabase query */
  const toSupabaseOrder = useCallback(
    (colToField: Record<string, string | null>): { field: string; ascending: boolean }[] => {
      return sorts
        .map(s => ({ field: colToField[s.col as string], ascending: s.dir === 'asc' }))
        .filter(x => x.field !== null && x.field !== undefined) as { field: string; ascending: boolean }[]
    },
    [sorts]
  )

  return useMemo(() => ({
    sorts,
    handleSort,        // legacy
    toggleSort: handleSort,
    clearSorts,
    sortIndicator,
    sortIndex,
    sortDir,
    applySorts,        // legacy con getValue del hook
    applySort,         // patrón nuevo con getters explícitos
    toSupabaseOrder,
    hasSort: sorts.length > 0,
    showClearButton: sorts.length > 1,
  }), [sorts, handleSort, clearSorts, sortIndicator, sortIndex, sortDir, applySorts, applySort, toSupabaseOrder])
}
