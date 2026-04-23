import type { ReactNode } from 'react'
import { useIsDark } from '@/hooks/useIsDark'

export function ConfigModal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const isDark = useIsDark()
  const bg = isDark ? '#141414' : '#ffffff'
  const border = isDark ? '#2a2a2a' : '#E9E1D0'
  const titleColor = isDark ? '#ffffff' : '#1A1A1A'

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: 12,
          padding: 24,
          width: 480,
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <h2
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: titleColor,
            marginBottom: 16,
            fontFamily: 'Oswald, sans-serif',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {title}
        </h2>
        {children}
      </div>
    </div>
  )
}

export function ConfigField({ label, children }: { label: string; children: ReactNode }) {
  const isDark = useIsDark()
  const labelColor = isDark ? '#777777' : '#9E9588'
  return (
    <div style={{ marginBottom: 12 }}>
      <label
        style={{
          display: 'block',
          fontSize: 11,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: labelColor,
          marginBottom: 6,
          fontWeight: 500,
          fontFamily: 'Oswald, sans-serif',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}

export function useInputStyle() {
  const isDark = useIsDark()
  return {
    width: '100%',
    padding: '8px 12px',
    border: `1px solid ${isDark ? '#2a2a2a' : '#E9E1D0'}`,
    borderRadius: 8,
    fontSize: 13,
    background: isDark ? '#1e1e1e' : '#ffffff',
    color: isDark ? '#ffffff' : '#1A1A1A',
    fontFamily: 'Lexend, sans-serif',
    outline: 'none',
  } as const
}

export function ModalActions({
  onCancel,
  onSave,
  saving,
  disabled,
}: {
  onCancel: () => void
  onSave: () => void
  saving?: boolean
  disabled?: boolean
}) {
  const isDark = useIsDark()
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
      <button
        type="button"
        onClick={onCancel}
        style={{
          padding: '9px 16px',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          background: 'transparent',
          color: isDark ? '#cccccc' : '#6E6656',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'Oswald, sans-serif',
        }}
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={saving || disabled}
        style={{
          padding: '9px 16px',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          background: '#B01D23',
          color: '#ffffff',
          border: 'none',
          cursor: (saving || disabled) ? 'not-allowed' : 'pointer',
          opacity: (saving || disabled) ? 0.5 : 1,
          fontFamily: 'Oswald, sans-serif',
        }}
      >
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
    </div>
  )
}
