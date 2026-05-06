// OcrUploadToast v2 — múltiples toasts apilados, uno por sesión
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
      minWidth: 320, maxWidth: 420,
      fontFamily: 'Lexend, sans-serif', fontSize: 13,
      boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: '#e8f442' }}>
          {session.procesando ? `Procesando… ${session.enviados}/${session.total}` : 'Completado'}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {!session.procesando && (
            <button onClick={onCerrar} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', width: 24, height: 24, borderRadius: '50%', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          )}
          {session.procesando && (
            <button onClick={onOcultar} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', padding: '0 8px', height: 24, borderRadius: 12, fontSize: 10 }}>–</button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
        <div style={{ color: '#1D9E75' }}>Nuevas: <b>{session.ok}</b></div>
        <div style={{ color: '#7a8090' }}>Duplicadas: <b>{session.duplicados}</b></div>
        <div style={{ color: '#F26B1F' }}>Pendientes: <b>{session.pendientes}</b></div>
        {session.errores > 0 && <div style={{ color: '#E24B4A' }}>Errores: <b>{session.errores}</b></div>}
      </div>

      <div style={{ marginTop: 10, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: session.procesando ? '#e8f442' : '#1D9E75', transition: 'width 0.3s' }} />
      </div>

      {session.log.length > 0 && (
        <>
          <button onClick={() => setExpandido(x => !x)} style={{ marginTop: 10, width: '100%', padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', cursor: 'pointer', fontFamily: 'Lexend, sans-serif', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{expandido ? 'Ocultar detalle' : 'Ver detalle'}</span>
            <span>{expandido ? '▲' : '▼'}</span>
          </button>
          {expandido && (
            <div style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: 6, padding: 8, fontSize: 11 }}>
              {session.log.map((entry, idx) => {
                const colors: Record<string, string> = { ok: '#1D9E75', duplicado: '#7a8090', pendiente: '#F26B1F', error: '#E24B4A' }
                const labels: Record<string, string> = { ok: 'OK', duplicado: 'Dup', pendiente: 'Pdte', error: 'Err' }
                return (
                  <div key={idx} style={{ marginBottom: 5, paddingBottom: 5, borderBottom: idx < session.log.length - 1 ? '0.5px solid rgba(255,255,255,0.1)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors[entry.status], flexShrink: 0 }} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10 }}>{entry.filename}</span>
                      <span style={{ color: colors[entry.status], textTransform: 'uppercase', fontSize: 9, letterSpacing: '1px', flexShrink: 0 }}>{labels[entry.status]}</span>
                    </div>
                    {entry.detalle && <div style={{ fontSize: 10, color: '#a0a8b8', marginTop: 2, paddingLeft: 12 }}>{entry.detalle}</div>}
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

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20,
      display: 'flex', flexDirection: 'column-reverse', gap: 10,
      zIndex: 9999, maxHeight: '90vh', overflowY: 'auto',
    }}>
      {visibles.map(s => (
        <SessionToast
          key={s.id}
          session={s}
          onCerrar={() => cerrar(s.id)}
          onOcultar={() => ocultar(s.id)}
        />
      ))}
    </div>
  )
}
