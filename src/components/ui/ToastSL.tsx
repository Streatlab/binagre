/**
 * ToastSL — contenedor único de toasts, kit v5-B. Sustituye a ToastHost.
 * Esquina inferior derecha, tarjeta blanca con franja lateral por severidad.
 * Sin emojis, sin tecnicismos: solo qué pasó + número + qué sigue.
 */
import type { CSSProperties } from 'react'
import { RefreshCw, Check, AlertTriangle, Info } from 'lucide-react'
import { OSW, LEX, INK, VERDE, AMA, ROJO, AZUL, GRIS, SHADOW, BORDER_CARD } from '@/styles/neobrutal'
import { toast, useToasts, type ToastItem, type ToastStatus } from '@/lib/toastStore'

const ACENTO: Record<ToastStatus, string> = {
  loading: GRIS, success: VERDE, aviso: AMA, error: ROJO, info: AZUL,
}

function Icono({ status }: { status: ToastStatus }) {
  const color = ACENTO[status]
  if (status === 'loading') return <RefreshCw size={16} strokeWidth={2.6} color={color} style={{ animation: 'sl-toast-spin 1s linear infinite' }} />
  if (status === 'success') return <Check size={16} strokeWidth={3} color={color} />
  if (status === 'error' || status === 'aviso') return <AlertTriangle size={16} strokeWidth={2.6} color={color} />
  return <Info size={16} strokeWidth={2.6} color={color} />
}

// Resalta los números del mensaje en Oswald (cifra destacada), el resto en Lexend.
function Cuerpo({ texto }: { texto: string }) {
  const partes = texto.split(/(\d[\d.,]*)/)
  return (
    <>
      {partes.map((p, i) =>
        /^\d/.test(p)
          ? <span key={i} style={{ fontFamily: OSW, fontWeight: 700 }}>{p}</span>
          : <span key={i}>{p}</span>,
      )}
    </>
  )
}

function ToastCard({ item }: { item: ToastItem }) {
  const accent = ACENTO[item.status]
  const wrap: CSSProperties = {
    background: '#fff', border: BORDER_CARD, boxShadow: SHADOW,
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: '12px 14px', minWidth: 300, maxWidth: 440,
    position: 'relative', paddingLeft: 18,
  }
  return (
    <div role="status" style={wrap}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, background: accent }} />
      <span style={{ flexShrink: 0, marginTop: 1 }}><Icono status={item.status} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: LEX, fontSize: 12.5, color: INK, lineHeight: 1.4, whiteSpace: 'pre-line' }}>
          <Cuerpo texto={item.message} />
        </div>
        {item.action && (
          <button
            onClick={() => { item.action?.onClick() }}
            style={{
              marginTop: 8, background: accent, color: '#fff', border: 'none',
              padding: '5px 12px', fontFamily: OSW, fontWeight: 700, fontSize: 11,
              letterSpacing: '0.5px', textTransform: 'uppercase', cursor: 'pointer',
            }}
          >
            {item.action.label}
          </button>
        )}
      </div>
      {item.status !== 'loading' && (
        <button
          onClick={() => toast.dismiss(item.id)}
          aria-label="Cerrar"
          style={{ background: 'transparent', border: 'none', color: GRIS, cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1, marginLeft: 2 }}
        >
          ×
        </button>
      )}
    </div>
  )
}

export default function ToastSL() {
  const items = useToasts()
  return (
    <div
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        display: 'flex', flexDirection: 'column-reverse', gap: 10, pointerEvents: 'none',
      }}
    >
      {items.map((item) => (
        <div key={item.id} style={{ pointerEvents: 'auto' }}>
          <ToastCard item={item} />
        </div>
      ))}
      <style>{`@keyframes sl-toast-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
