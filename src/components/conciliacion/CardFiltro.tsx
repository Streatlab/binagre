import React from 'react'
import { fmtEur } from '@/utils/format'

interface CardFiltroProps {
  tipo: 'ingresos' | 'gastos' | 'pendientes'
  count: number
  importe: number
  active: boolean
  onClick: () => void
}

const FILTER_BASE: React.CSSProperties = {
  background: '#ffffff',
  border: '0.5px solid #d0c8bc',
  borderRadius: 12,
  padding: '14px 16px',
  cursor: 'pointer',
  transition: 'all 150ms',
  flex: 1,
}

const ACTIVE_STYLES: Record<string, React.CSSProperties> = {
  ingresos: { border: '1.5px solid #1D9E75', boxShadow: '0 0 0 3px #1D9E7515' },
  gastos: { border: '1.5px solid #E24B4A', boxShadow: '0 0 0 3px #E24B4A15' },
  pendientes: { border: '1.5px solid #FF4757', boxShadow: '0 0 0 3px #FF475715' },
}

const TYPE_COLOR: Record<string, string> = {
  ingresos: '#1D9E75',
  gastos: '#E24B4A',
  pendientes: '#FF4757',
}

const TYPE_LABEL: Record<string, string> = {
  ingresos: 'INGRESOS',
  gastos: 'GASTOS',
  pendientes: 'PENDIENTES',
}

const TYPE_DESC: Record<string, string> = {
  ingresos: 'Bruto del periodo · click para filtrar',
  gastos: 'Total gasto · click para filtrar',
  pendientes: 'Sin asociar / sin categoría · activo',
}

const TYPE_SIGN: Record<string, string> = {
  ingresos: '+',
  gastos: '-',
  pendientes: '',
}

export default function CardFiltro({ tipo, count, importe, active, onClick }: CardFiltroProps) {
  const color = TYPE_COLOR[tipo]
  const containerStyle: React.CSSProperties = {
    ...FILTER_BASE,
    ...(active ? ACTIVE_STYLES[tipo] : {}),
  }

  return (
    <div style={containerStyle} onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{
          fontFamily: 'Oswald, sans-serif',
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '1.5px',
          textTransform: 'uppercase' as const,
          color,
        }}>
          {TYPE_LABEL[tipo]}
        </span>
        <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090' }}>
          {tipo === 'pendientes' ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2px 8px',
                borderRadius: 9,
                background: '#FF4757',
                color: '#ffffff',
                fontFamily: 'Lexend, sans-serif',
                fontSize: 10,
                fontWeight: 500,
              }}>
                {count}
              </span>
              revisar
            </span>
          ) : `${count} movs`}
        </span>
      </div>

      {/* Importe */}
      <div style={{
        fontFamily: 'Oswald, sans-serif',
        fontSize: 26,
        fontWeight: 600,
        color,
        marginTop: 4,
      }}>
        {TYPE_SIGN[tipo]}{fmtEur(Math.abs(importe))}
      </div>

      {/* Descripcion */}
      <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090', marginTop: 2 }}>
        {TYPE_DESC[tipo]}
      </div>
    </div>
  )
}
