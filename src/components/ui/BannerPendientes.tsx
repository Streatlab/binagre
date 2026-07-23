import { INK, LIMA } from '@/styles/neobrutal'
import React, { useState } from 'react'
import { X } from 'lucide-react'

interface Props {
  mensaje?: string
  onIrImportador?: () => void
}

export default function BannerPendientes({ mensaje, onIrImportador }: Props) {
  const [visible, setVisible] = useState(true)
  if (!visible) return null

  return (
    <div style={{
      background: LIMA,
      color: INK,
      padding: '6px 14px',
      fontSize: 12,
      fontFamily: 'Lexend, sans-serif',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      borderRadius: 0,
      marginBottom: 12,
    }}>
      <span>{mensaje ?? 'Hay datos pendientes de subir'}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {onIrImportador && (
          <button
            onClick={onIrImportador}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              fontFamily: 'Oswald, sans-serif',
              background: INK,
              color: LIMA,
              border: 'none',
              borderRadius: 0,
              cursor: 'pointer',
              fontWeight: 500,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            IR AL IMPORTADOR
          </button>
        )}
        <button
          onClick={() => setVisible(false)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: INK, padding: 2, display: 'flex', alignItems: 'center' }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
