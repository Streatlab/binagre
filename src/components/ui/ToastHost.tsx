import type { CSSProperties } from 'react'
import { useTheme, FONT } from '@/styles/tokens'
import { toast, useToasts, type ToastItem } from '@/lib/toastStore'

const VERDE = '#06C167'
const ROJO  = '#B01D23'

function Spinner({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block', width: 14, height: 14,
        border: `2px solid ${color}33`, borderTopColor: color,
        borderRadius: '50%', animation: 'rf-toast-spin 0.8s linear infinite',
      }}
    />
  )
}

function ToastCard({ item }: { item: ToastItem }) {
  const { T, isDark } = useTheme()
  const accent =
    item.status === 'loading' ? T.sec :
    item.status === 'success' ? VERDE : ROJO
  const icon =
    item.status === 'loading' ? <Spinner color={T.pri} /> :
    item.status === 'success' ? '✓' : '✗'

  const wrap: CSSProperties = {
    background: T.card,
    border: `1px solid ${T.brd}`,
    borderLeft: `3px solid ${accent}`,
    borderRadius: 10,
    padding: '12px 14px',
    minWidth: 320,
    maxWidth: 460,
    boxShadow: isDark ? '0 6px 20px rgba(0,0,0,0.45)' : '0 6px 20px rgba(0,0,0,0.12)',
    display: 'flex', alignItems: 'flex-start', gap: 10,
    fontFamily: FONT.body,
  }

  return (
    <div role="status" style={wrap}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, fontSize: 16, color: accent, flexShrink: 0, marginTop: 1 }}>
        {icon}
      </span>
      <div style={{ flex: 1, fontSize: 13, color: T.pri, whiteSpace: 'pre-line', lineHeight: 1.4 }}>
        {item.message}
        {item.action && (
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => { item.action?.onClick() }}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: 'none',
                background: ROJO,
                color: '#fff',
                fontFamily: FONT.heading,
                fontSize: 11,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >{item.action.label}</button>
          </div>
        )}
      </div>
      {item.status !== 'loading' && (
        <button
          onClick={() => toast.dismiss(item.id)}
          aria-label="Cerrar"
          style={{
            background: 'transparent', border: 'none', color: T.mut,
            cursor: 'pointer', fontSize: 18, padding: 0, lineHeight: 1, marginLeft: 4,
          }}
        >×</button>
      )}
    </div>
  )
}

export default function ToastHost() {
  const items = useToasts()
  return (
    <div
      style={{
        position: 'fixed',
        top: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        pointerEvents: 'none',
      }}
    >
      {items.map(item => (
        <div key={item.id} style={{ pointerEvents: 'auto' }}>
          <ToastCard item={item} />
        </div>
      ))}
      <style>{`@keyframes rf-toast-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
