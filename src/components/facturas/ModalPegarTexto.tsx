import { useState } from 'react'
import { X } from 'lucide-react'
import type { FacturasTokens } from '@/styles/facturasTheme'

interface Props {
  T: FacturasTokens
  onClose: () => void
  onSubmit: (texto: string) => void | Promise<void>
}

export default function ModalPegarTexto({ T, onClose, onSubmit }: Props) {
  const [texto, setTexto] = useState('')

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#1a1a1a',
          borderRadius: 14,
          width: '100%',
          maxWidth: 600,
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${T.border}`,
        }}
      >
        <div
          style={{
            padding: '18px 22px',
            borderBottom: `1px solid ${T.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2
            style={{
              fontFamily: T.fontTitle,
              fontSize: 16,
              color: T.text,
              margin: 0,
              letterSpacing: 2,
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            PEGAR TEXTO DE FACTURA
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Pega aquí el contenido de la factura (email, WhatsApp, tabla, lo que sea)..."
            rows={14}
            style={{
              width: '100%',
              padding: 12,
              backgroundColor: '#1e1e1e',
              color: T.text,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              fontFamily: 'Consolas, monospace',
              fontSize: 12,
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
        </div>

        <div
          style={{
            padding: '14px 22px',
            borderTop: `1px solid ${T.border}`,
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '9px 18px',
              backgroundColor: '#222222',
              color: T.text,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              fontFamily: T.fontTitle,
              fontSize: 12,
              letterSpacing: 1,
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => onSubmit(texto)}
            disabled={!texto.trim()}
            style={{
              padding: '9px 18px',
              backgroundColor: T.accentRed,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontFamily: T.fontTitle,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 1,
              textTransform: 'uppercase',
              cursor: texto.trim() ? 'pointer' : 'not-allowed',
              opacity: texto.trim() ? 1 : 0.5,
            }}
          >
            Procesar
          </button>
        </div>
      </div>
    </div>
  )
}
