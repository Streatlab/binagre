import React from 'react';

interface BarraCumplimientoProps {
  /** Porcentaje 0-100+ */
  pct?: number
  porcentaje?: number
  /** Altura en px. Default 8 */
  altura?: number
  mostrarEtiqueta?: boolean
  presupuesto?: number
  // Aliases de compatibilidad
  multiSegmento?: boolean
  multiSeg?: boolean
}

export function BarraCumplimiento({
  pct: pctProp,
  porcentaje = 0,
  altura = 8,
  mostrarEtiqueta = false,
  presupuesto,
}: BarraCumplimientoProps) {
  const rawVal = pctProp ?? porcentaje

  // Si presupuesto es 0, barra gris vacía
  if (presupuesto === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ height: altura, borderRadius: altura / 2, background: '#ebe8e2', flex: 1 }} />
      </div>
    )
  }

  const c = Math.min(Math.max(rawVal, 0), 100)
  const colorFill = c >= 50 ? '#1D9E75' : '#f5a623'
  const colorRest = '#E24B4A'
  const rest = 100 - c

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        height: altura,
        borderRadius: altura / 2,
        background: '#ebe8e2',
        overflow: 'hidden',
        display: 'flex',
        flex: 1,
      }}>
        <div style={{ height: '100%', width: `${c}%`, background: colorFill }} />
        <div style={{ height: '100%', width: `${rest}%`, background: colorRest }} />
      </div>

      {mostrarEtiqueta && (
        <span style={{
          fontSize: 12,
          fontFamily: 'Lexend, sans-serif',
          color: rawVal >= 50 ? '#1D9E75' : rawVal >= 1 ? '#f5a623' : '#E24B4A',
          whiteSpace: 'nowrap',
          minWidth: 36,
        }}>
          {Math.round(rawVal)}%
        </span>
      )}
    </div>
  )
}

export default BarraCumplimiento
