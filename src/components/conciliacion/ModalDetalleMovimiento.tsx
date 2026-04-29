import React from 'react'
import { fmtEur } from '@/utils/format'
import type { Movimiento } from '@/types/conciliacion'

interface ModalDetalleMovimientoProps {
  movimiento: Movimiento | null
  onClose: () => void
  onReasignar?: (movId: string) => void
  onRecategorizar?: (movId: string) => void
  onMarcarSinDoc?: (movId: string) => void
}

function fmtFecha(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function ModalDetalleMovimiento({
  movimiento,
  onClose,
  onReasignar,
  onRecategorizar,
  onMarcarSinDoc,
}: ModalDetalleMovimientoProps) {
  if (!movimiento) return null

  const tieneFactura = !!(movimiento.factura_id && movimiento.factura_data?.pdf_drive_url)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: '#484f66' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          backgroundColor: '#484f66',
          borderRadius: 16,
          padding: '28px 32px',
          width: 560,
          maxWidth: '95vw',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{
                fontFamily: 'Oswald, sans-serif',
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: '2px',
                textTransform: 'uppercase',
                color: '#b0b8d0',
                marginBottom: 4,
              }}>
                DETALLE MOVIMIENTO
              </div>
              <div style={{
                fontFamily: 'Lexend, sans-serif',
                fontSize: 15,
                fontWeight: 500,
                color: '#ffffff',
              }}>
                {movimiento.concepto}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: 8,
                color: '#ffffff',
                fontSize: 18,
                cursor: 'pointer',
                padding: '4px 10px',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          {/* Datos */}
          <div style={{
            background: 'rgba(0,0,0,0.2)',
            borderRadius: 10,
            padding: '16px 18px',
            marginBottom: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            {([
              ['Fecha', fmtFecha(movimiento.fecha)],
              ['Importe', (movimiento.importe >= 0 ? '+' : '') + fmtEur(movimiento.importe)],
              ['Contraparte', movimiento.contraparte || '—'],
              ['Categoría', movimiento.categoria_id || 'Sin categorizar'],
              ['ID Movimiento', movimiento.id],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontFamily: 'Lexend, sans-serif' }}>
                <span style={{ color: '#b0b8d0' }}>{label}</span>
                <span style={{
                  color: label === 'Importe'
                    ? movimiento.importe >= 0 ? '#1D9E75' : '#E24B4A'
                    : '#ffffff',
                  fontWeight: label === 'Importe' ? 600 : 400,
                }}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* PDF embebido si tiene Drive URL */}
          {tieneFactura && (
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontFamily: 'Oswald, sans-serif',
                fontSize: 10,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                color: '#b0b8d0',
                marginBottom: 8,
              }}>
                FACTURA ASOCIADA
              </div>
              <div style={{
                background: 'rgba(0,0,0,0.2)',
                borderRadius: 8,
                padding: '10px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#ffffff' }}>
                  {movimiento.factura_data?.pdf_filename || 'Factura PDF'}
                </span>
                <button
                  onClick={() => window.open(movimiento.factura_data!.pdf_drive_url!, '_blank')}
                  style={{
                    background: '#1D9E75',
                    border: 'none',
                    borderRadius: 6,
                    color: '#ffffff',
                    fontFamily: 'Lexend, sans-serif',
                    fontSize: 12,
                    padding: '6px 12px',
                    cursor: 'pointer',
                  }}
                >
                  Abrir en Drive
                </button>
              </div>
            </div>
          )}

          {/* Botones accion */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => onReasignar?.(movimiento.id)}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                border: '0.5px solid rgba(255,255,255,0.2)',
                background: 'transparent',
                color: '#ffffff',
                fontFamily: 'Lexend, sans-serif',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Reasignar factura
            </button>
            <button
              onClick={() => onRecategorizar?.(movimiento.id)}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                border: '0.5px solid rgba(255,255,255,0.2)',
                background: 'transparent',
                color: '#ffffff',
                fontFamily: 'Lexend, sans-serif',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Recategorizar
            </button>
            <button
              onClick={() => onMarcarSinDoc?.(movimiento.id)}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                border: '0.5px solid rgba(255,255,255,0.2)',
                background: 'transparent',
                color: '#b0b8d0',
                fontFamily: 'Lexend, sans-serif',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              No requiere doc
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
