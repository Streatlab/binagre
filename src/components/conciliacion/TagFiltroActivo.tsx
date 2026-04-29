import React from 'react'

interface TagFiltroActivoProps {
  label: string
  count: number
  onRemove: () => void
}

const TAG_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 8px',
  borderRadius: 10,
  background: '#FF475715',
  color: '#FF4757',
  fontSize: 11,
  fontWeight: 500,
}

export default function TagFiltroActivo({ label, count, onRemove }: TagFiltroActivoProps) {
  if (!label) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
      <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#7a8090' }}>
        Filtro activo:
      </span>
      <span style={TAG_STYLE}>
        {label}
        <span
          onClick={onRemove}
          style={{ cursor: 'pointer', fontWeight: 600, marginLeft: 2 }}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onRemove() }}
        >
          {' '}×
        </span>
      </span>
      <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#7a8090' }}>
        · {count} movimientos
      </span>
    </div>
  )
}
