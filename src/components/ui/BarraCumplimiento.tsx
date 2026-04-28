import React from 'react'

interface BarraCumplimientoProps {
  porcentaje: number
  multiSegmento?: boolean
  altura?: number
  mostrarEtiqueta?: boolean
}

export default function BarraCumplimiento({
  porcentaje,
  multiSegmento = false,
  altura = 8,
  mostrarEtiqueta = false,
}: BarraCumplimientoProps) {
  const pct = Math.max(0, Math.min(porcentaje, 100))
  const pctDisplay = Math.round(porcentaje)

  const barraBase: React.CSSProperties = {
    height: altura,
    borderRadius: 4,
    background: '#ebe8e2',
    position: 'relative',
    overflow: 'hidden',
    flex: 1,
  }

  const fillEstilo = (p: number): React.CSSProperties => ({
    height: '100%',
    width: `${Math.min(p, 100)}%`,
    background: p >= 80 ? '#1D9E75' : p >= 50 ? '#f5a623' : '#E24B4A',
    borderRadius: 4,
    transition: 'width 0.5s ease',
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={barraBase}>
        {multiSegmento ? (
          <div style={{ display: 'flex', height: '100%', width: '100%' }}>
            <div
              style={{
                height: '100%',
                width: `${pct}%`,
                background: '#1D9E75',
                transition: 'width 0.5s ease',
                flexShrink: 0,
              }}
            />
            <div
              style={{
                height: '100%',
                width: `${100 - pct}%`,
                background: '#E24B4A',
                transition: 'width 0.5s ease',
                flexShrink: 0,
              }}
            />
          </div>
        ) : (
          <div style={fillEstilo(porcentaje)} />
        )}
      </div>

      {mostrarEtiqueta && (
        <span
          style={{
            fontSize: 12,
            fontFamily: 'Lexend, sans-serif',
            color: porcentaje >= 80 ? '#1D9E75' : porcentaje >= 50 ? '#f5a623' : '#E24B4A',
            whiteSpace: 'nowrap',
            minWidth: 36,
          }}
        >
          {pctDisplay}%
        </span>
      )}
    </div>
  )
}
