// Sistema canónico de ordenación multi-criterio para tablas del ERP Binagre
// Estándar único — todas las tablas con ordenación deben usar este hook + SortableHeader
//
// Comportamiento:
// - Click cabecera: 1ª vez = asc, 2ª vez = desc, 3ª vez = quitar
// - Click otra cabecera: se añade como criterio adicional (apilado)
// - Indicador visual: número de prioridad + flecha
// - Botón "Limpiar orden" solo aparece si hay 2+ criterios activos
// - Persistencia: URL searchParam ?sort=col1:asc,col2:desc
//
// Uso típico cliente (memoria):
//   const { sorts, toggleSort, clearSorts, sortIndex, sortDir, applySort } = useMultiSort('mi_tabla')
//   const filasOrdenadas = applySort(filas, { contraparte: r => r.proveedor_nombre, importe: r => r.total })
//
// Uso típico servidor (Supabase):
//   const { sorts, toggleSort, ... } = useMultiSort('mi_tabla')
//   // mapear a campos BBDD:
//   sorts.forEach(s => { q = q.order(MAPA[s.col], { ascending: s.dir==='asc' }) })

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

export type SortDir = 'asc' | 'desc'
export interface SortCriterion { col: string; dir: SortDir }

function parseSortsFromUrl(raw: string | null): SortCriterion[] {
  if (!raw) return []
  return raw.split(',').map(s => {
    const [col, dir] = s.split(':')
    if (!col || (dir !== 'asc' && dir !== 'desc')) return null
    return { col, dir: dir as SortDir }
  }).filter(Boolean) as SortCriterion[]
}

function serializeSortsToUrl(sorts: SortCriterion[]): string {
  return sorts.map(s => `${s.col}:${s.dir}`).join(',')
}

/**
 * Hook canónico de multi-ordenación.
 * @param storageKey — clave única por tabla (para URL ?sort_<key>=...)
 */
export function useMultiSort(storageKey: string) {
  const [searchParams, setSearchParams] = useSearchParams()
  const paramKey = `sort_${storageKey}`
  const [sorts, setSorts] = useState<SortCriterion[]>(() => parseSortsFromUrl(searchParams.get(paramKey)))

  // Sincronizar URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams)
    if (sorts.length === 0) params.delete(paramKey)
    else params.set(paramKey, serializeSortsToUrl(sorts))
    setSearchParams(params, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorts])

  const toggleSort = useCallback((col: string) => {
    setSorts(prev => {
      const idx = prev.findIndex(s => s.col === col)
      if (idx < 0) return [...prev, { col, dir: 'asc' as SortDir }]
      if (prev[idx].dir === 'asc') {
        const next = [...prev]
        next[idx] = { col, dir: 'desc' }
        return next
      }
      // desc → quitar
      return prev.filter((_, i) => i !== idx)
    })
  }, [])

  const clearSorts = useCallback(() => { setSorts([]) }, [])

  const sortIndex = useCallback((col: string): number => {
    const idx = sorts.findIndex(s => s.col === col)
    return idx < 0 ? -1 : idx
  }, [sorts])

  const sortDir = useCallback((col: string): SortDir | null => {
    const s = sorts.find(s => s.col === col)
    return s ? s.dir : null
  }, [sorts])

  /**
   * Aplicar ordenación a un array en memoria.
   * @param rows — datos a ordenar
   * @param getters — mapa col → función que devuelve el valor para ordenar
   */
  const applySort = useCallback(<T,>(rows: T[], getters: Record<string, (r: T) => any>): T[] => {
    if (sorts.length === 0) return rows
    return [...rows].sort((a, b) => {
      for (const { col, dir } of sorts) {
        const get = getters[col]
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
  }, [sorts])

  /**
   * Convertir a parámetros para query Supabase: array de {field, ascending}
   * @param colToField — mapa col interno → campo real BBDD (puede devolver null para columnas no soportadas en servidor)
   */
  const toSupabaseOrder = useCallback((colToField: Record<string, string | null>): { field: string; ascending: boolean }[] => {
    return sorts
      .map(s => ({ field: colToField[s.col], ascending: s.dir === 'asc' }))
      .filter(x => x.field !== null && x.field !== undefined) as { field: string; ascending: boolean }[]
  }, [sorts])

  return useMemo(() => ({
    sorts,
    toggleSort,
    clearSorts,
    sortIndex,
    sortDir,
    applySort,
    toSupabaseOrder,
    hasSort: sorts.length > 0,
    showClearButton: sorts.length > 1, // botón limpiar solo si 2+
  }), [sorts, toggleSort, clearSorts, sortIndex, sortDir, applySort, toSupabaseOrder])
}
