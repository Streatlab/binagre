import React from 'react'

interface BarraCumplimientoProps {
  /** Alias del spec. Si se pasa pct, tiene prioridad sobre porcentaje. */
  pct?: number
  porcentaje?: number
  multiSegmento?: boolean
  /** Del spec: 8 | 6 | 5 */
  altura?: 8 | 6 | 5 | number
  mostrarEtiqueta?: boolean
  /** Del spec: si true divide cumplido + pendiente */
  multiSeg?: boolean
}

export default function BarraCumplimiento({
  pct: pctProp,
  porcentaje = 0,
  multiSegmento = false,
  multiSeg = false,
  altura = 8,
  mostrarEtiqueta = false,
}: BarraCumplimientoProps) {
  const rawVal = pctProp ?? porcentaje
  const pct = Math.max(0, Math.min(rawVal, 100))
  const esMulti = multiSeg || multiSegmento
  const pctDisplay = Math.round(rawVal)

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
        {esMulti ? (
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
          <div style={fillEstilo(rawVal)} />
        )}
      </div>

      {mostrarEtiqueta && (
        <span
          style={{
            fontSize: 12,
            fontFamily: 'Lexend, sans-serif',
            color: rawVal >= 80 ? '#1D9E75' : rawVal >= 50 ? '#f5a623' : '#E24B4A',
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
