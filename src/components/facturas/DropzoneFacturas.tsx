import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import type { FacturasTokens } from '@/styles/facturasTheme'

export interface SubidaItem {
  id: string
  name: string
  estado: 'uploading' | 'ok' | 'duplicada' | 'error' | string
  total?: number | string
  mensaje?: string
}

interface Props {
  T: FacturasTokens
  onSubir: (files: File[]) => void | Promise<void>
  onPasteClick: () => void
  subiendo: SubidaItem[]
}

export default function DropzoneFacturas({ T, onSubir, onPasteClick, subiendo }: Props) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          onSubir(Array.from(e.dataTransfer.files))
        }}
        onClick={() => inputRef.current?.click()}
        style={{
          backgroundColor: T.card,
          border: `2px dashed ${dragging ? T.accentRed : T.border}`,
          borderRadius: 12,
          padding: 20,
          minHeight: 140,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        <Upload size={24} color={T.accentRed} />
        <div
          style={{
            fontFamily: T.fontTitle,
            fontSize: 12,
            color: T.text,
            letterSpacing: 1,
            textTransform: 'uppercase',
            marginTop: 8,
            textAlign: 'center',
            fontWeight: 600,
          }}
        >
          ARRASTRA O CLIC
        </div>
        <div
          style={{
            fontFamily: T.fontUi,
            fontSize: 10,
            color: T.muted,
            marginTop: 4,
            textAlign: 'center',
          }}
        >
          PDF · IMG · WORD · XLSX · EMAIL
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.docx,.doc,.xlsx,.xls,.eml,.msg"
          onChange={(e) => onSubir(Array.from(e.target.files || []))}
          style={{ display: 'none' }}
        />
      </div>

      <button
        onClick={onPasteClick}
        style={{
          padding: '8px 14px',
          border: `1px solid ${T.border}`,
          borderRadius: 8,
          backgroundColor: T.base,
          color: T.text,
          fontFamily: T.fontUi,
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        📋 Pegar texto de factura
      </button>

      {subiendo.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {subiendo.map((s) => (
            <div
              key={s.id}
              style={{
                backgroundColor: T.base,
                border: `1px solid ${T.border}`,
                borderRadius: 6,
                padding: '6px 10px',
                fontFamily: T.fontUi,
                fontSize: 11,
                color: T.text,
                display: 'flex',
                justifyContent: 'space-between',
                gap: 6,
              }}
            >
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.estado === 'uploading'
                  ? '⏳'
                  : s.estado === 'ok'
                    ? '✅'
                    : s.estado === 'duplicada'
                      ? '🟰'
                      : '❌'}{' '}
                {s.name}
              </span>
              {s.total !== undefined && s.total !== null && s.total !== '' && (
                <span style={{ color: T.accentRed, fontWeight: 600 }}>
                  {typeof s.total === 'number' ? `${s.total.toFixed(2)}€` : s.total}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
