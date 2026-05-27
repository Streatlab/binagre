// Componente canónico SortableHeader
// Renderiza una celda <th> con indicador de orden y maneja el click.
// Usar SIEMPRE este componente para encabezados ordenables en cualquier tabla del ERP.

import type { CSSProperties, ReactNode } from 'react'
import type { SortDir } from '@/lib/useMultiSort'

interface SortableHeaderProps {
  col: string
  label: ReactNode
  sortIndex: number       // -1 si no está activa
  sortDir: SortDir | null
  onToggle: (col: string) => void
  align?: 'left' | 'right' | 'center'
  style?: CSSProperties
  className?: string
  colSpan?: number
  rowSpan?: number
}

export default function SortableHeader({
  col, label, sortIndex, sortDir, onToggle,
  align = 'left', style, className, colSpan, rowSpan
}: SortableHeaderProps) {
  const active = sortIndex >= 0
  const baseStyle: CSSProperties = {
    fontFamily: 'Oswald, sans-serif',
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: '2px',
    textTransform: 'uppercase',
    textAlign: align,
    color: active ? '#B01D23' : '#7a8090',
    padding: '10px 16px',
    background: '#f5f3ef',
    borderBottom: '0.5px solid #d0c8bc',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    userSelect: 'none',
    ...style,
  }
  return (
    <th
      className={className}
      colSpan={colSpan}
      rowSpan={rowSpan}
      onClick={() => onToggle(col)}
      style={baseStyle}
      title={active ? `Orden ${sortIndex + 1}º · ${sortDir === 'asc' ? 'ascendente' : 'descendente'} · Pulsa para alternar / quitar` : 'Pulsa para ordenar'}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start', width: '100%' }}>
        <span>{label}</span>
        {active && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            padding: '1px 6px',
            background: '#B01D2318',
            color: '#B01D23',
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: 0,
            lineHeight: 1.2,
          }}>
            {sortIndex + 1}{sortDir === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </span>
    </th>
  )
}

interface ClearSortButtonProps {
  show: boolean
  onClear: () => void
  style?: CSSProperties
}

export function ClearSortButton({ show, onClear, style }: ClearSortButtonProps) {
  if (!show) return null
  return (
    <button
      onClick={onClear}
      style={{
        padding: '6px 12px',
        borderRadius: 8,
        border: '0.5px solid #d0c8bc',
        background: '#fff',
        fontFamily: 'Oswald, sans-serif',
        fontSize: 10,
        letterSpacing: '1.5px',
        textTransform: 'uppercase',
        color: '#B01D23',
        cursor: 'pointer',
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        ...style,
      }}
      title="Quitar todos los criterios de orden"
    >
      ✕ Limpiar orden
    </button>
  )
}
