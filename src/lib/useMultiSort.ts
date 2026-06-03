/**
 * Re-export del hook canónico desde /hooks para mantener compatibilidad
 * con imports legacy desde @/lib/useMultiSort.
 *
 * SISTEMA CANÓNICO DE ORDENACIÓN — DOCUMENTACIÓN ÚNICA AQUÍ:
 *
 * Toda tabla del ERP con ordenación DEBE usar este hook + el componente
 * SortableHeader. PROHIBIDO crear sortCol/sortDir/handleSort locales.
 *
 * Imports canónicos (cualquiera de los dos funciona):
 *   import { useMultiSort } from '@/hooks/useMultiSort'
 *   import { useMultiSort } from '@/lib/useMultiSort'   // legacy, redirige
 *   import SortableHeader, { ClearSortButton } from '@/components/ui/SortableHeader'
 *
 * API:
 *   const ms = useMultiSort('clave_tabla')
 *   ms.sortIndex(col)      → 0-based o -1
 *   ms.sortDir(col)        → 'asc' | 'desc' | null
 *   ms.toggleSort(col)     → ciclo asc→desc→off
 *   ms.clearSorts()        → quita todos
 *   ms.showClearButton     → bool (true si 2+ activos)
 *   ms.applySort(rows, getters)         → ordena en memoria
 *   ms.toSupabaseOrder({col:'campo_db'}) → array para query servidor
 *
 * Ejemplo en JSX:
 *   <SortableHeader col="fecha" label="Fecha"
 *     sortIndex={ms.sortIndex('fecha')} sortDir={ms.sortDir('fecha')}
 *     onToggle={ms.toggleSort} align="left" />
 *   <ClearSortButton show={ms.showClearButton} onClear={ms.clearSorts} />
 */

export { useMultiSort } from '@/hooks/useMultiSort'
export type { SortDir, SortCriterion, UseMultiSortOptions } from '@/hooks/useMultiSort'
