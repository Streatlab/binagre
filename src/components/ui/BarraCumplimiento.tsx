interface BarraCumplimientoProps {
  /** Porcentaje 0-100+ */
  pct?: number
  porcentaje?: number
  /** Altura en px. Default 8 */
  altura?: number
  mostrarEtiqueta?: boolean
  // Aliases de compatibilidad
  multiSegmento?: boolean
  multiSeg?: boolean
}

export default function BarraCumplimiento({
  pct: pctProp,
  porcentaje = 0,
  altura = 8,
  mostrarEtiqueta = false,
}: BarraCumplimientoProps) {
  const rawVal = pctProp ?? porcentaje

  // Colores del spec: verde >= 50, amarillo >= 1, gris si 0
  const colorFill =
    rawVal >= 50 ? '#1D9E75' :
    rawVal >= 1  ? '#f5a623' :
    '#ebe8e2'

  const colorRest = '#E24B4A'
  const filled = Math.min(rawVal, 100)
  const rest   = 100 - filled

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
        <div style={{ height: '100%', width: `${filled}%`, background: colorFill }} />
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
