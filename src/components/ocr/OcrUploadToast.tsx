// OcrUploadToast v3 — toasts apilados verticalmente como notificaciones, más reciente arriba
import { useState } from 'react'
import { useOcrUpload } from '@/lib/ocrUploadStore'
import type { OcrSession } from '@/lib/ocrUploadStore'

function SessionToast({ session, onCerrar, onOcultar }: {
  session: OcrSession
  onCerrar: () => void
  onOcultar: () => void
}) {
  const [expandido, setExpandido] = useState(false)
  const pct = session.total > 0 ? Math.round((session.enviados / session.total) * 100) : 0

  return (
    <div style={{
      background: '#1e2233', color: '#fff',
      padding: '14px 18px', borderRadius: 12,
      width: 340,
      fontFamily: 'Lexend, sans-serif', fontSize: 13,
      boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: session.procesando ? '#e8f442' : '#1D9E75' }}>
          {session.procesando ? `Procesando… ${session.enviados}/${session.total}` : `Completado · ${session.total} archivos`}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {session.procesando
            ? <button onClick={onOcultar} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', padding: '0 8px', height: 22, borderRadius: 10, fontSize: 10, fontFamily: 'Lexend, sans-serif' }}>–</button>
            : <button onClick={onCerrar} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', width: 22, height: 22, borderRadius: '50%', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          }
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, fontSize: 12, marginBottom: 8 }}>
        <span style={{ color: '#1D9E75' }}>✓ {session.ok}</span>
        <span style={{ color: '#F26B1F' }}>⏳ {session.pendientes}</span>
        <span style={{ color: '#7a8090' }}>= {session.duplicados}</span>
        {session.errores > 0 && <span style={{ color: '#E24B4A' }}>✕ {session.errores}</span>}
      </div>

      <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: session.procesando ? '#e8f442' : '#1D9E75', transition: 'width 0.4s' }} />
      </div>

      {session.log.length > 0 && (
        <>
          <button onClick={() => setExpandido(x => !x)} style={{ marginTop: 8, width: '100%', padding: '5px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: 'none', color: '#a0a8b8', cursor: 'pointer', fontFamily: 'Lexend, sans-serif', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Detalle ({session.log.length})</span>
            <span>{expandido ? '▲' : '▼'}</span>
          </button>
          {expandido && (
            <div style={{ marginTop: 6, maxHeight: 180, overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: 6, padding: '6px 8px' }}>
              {[...session.log].reverse().map((entry, idx) => {
                const colors: Record<string, string> = { ok: '#1D9E75', duplicado: '#7a8090', pendiente: '#F26B1F', error: '#E24B4A' }
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', borderBottom: idx < session.log.length - 1 ? '0.5px solid rgba(255,255,255,0.06)' : 'none' }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: colors[entry.status], flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10, color: '#cdd0d8' }}>{entry.filename}</span>
                    <span style={{ color: colors[entry.status], fontSize: 9, letterSpacing: '0.5px', flexShrink: 0, textTransform: 'uppercase' }}>{entry.status}</span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function OcrUploadToast() {
  const { sessions, cerrar, ocultar } = useOcrUpload()
  const visibles = sessions.filter(s => s.visible)
  if (visibles.length === 0) return null

  // Más reciente arriba → ordenar desc por creadoEn
  const ordenadas = [...visibles].sort((a, b) => b.creadoEn - a.creadoEn)

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      zIndex: 9999,
      alignItems: 'flex-end',
      pointerEvents: 'none',
    }}>
      {ordenadas.map(s => (
        <div key={s.id} style={{ pointerEvents: 'all' }}>
          <SessionToast
            session={s}
            onCerrar={() => cerrar(s.id)}
            onOcultar={() => ocultar(s.id)}
          />
        </div>
      ))}
    </div>
  )
}
