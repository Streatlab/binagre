// Toast global de subida OCR — montado en Layout, sobrevive cambio de pestaña
import { useState } from 'react'
import { useOcrUpload } from '@/lib/ocrUploadStore'

export default function OcrUploadToast() {
  const { state, cerrar, ocultar } = useOcrUpload()
  const [expandido, setExpandido] = useState(false)

  if (!state || !state.visible) return null

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20,
      background: '#1e2233', color: '#fff',
      padding: '14px 18px', borderRadius: 12,
      minWidth: 320, maxWidth: 420,
      fontFamily: 'Lexend, sans-serif', fontSize: 13,
      zIndex: 9999,
      boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: '#e8f442' }}>
          {state.procesando ? 'Procesando…' : 'Completado'}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {!state.procesando && (
            <button
              onClick={cerrar}
              style={{
                background: 'rgba(255,255,255,0.1)', border: 'none',
                color: '#fff', cursor: 'pointer',
                width: 24, height: 24, borderRadius: '50%',
                fontSize: 14, lineHeight: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              aria-label="Cerrar"
              title="Cerrar"
            >
              ×
            </button>
          )}
          {state.procesando && (
            <button
              onClick={ocultar}
              style={{
                background: 'rgba(255,255,255,0.1)', border: 'none',
                color: '#fff', cursor: 'pointer',
                padding: '0 8px', height: 24, borderRadius: 12,
                fontSize: 10, lineHeight: 1,
              }}
              aria-label="Minimizar"
              title="Minimizar mientras procesa"
            >
              –
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
        <div>Procesados: <b>{state.enviados}/{state.total}</b></div>
        <div style={{ color: '#1D9E75' }}>Conciliadas: <b>{state.ok}</b></div>
        <div style={{ color: '#F26B1F' }}>Pendientes: <b>{state.pendientes}</b></div>
        <div style={{ color: '#7a8090' }}>Duplicados: <b>{state.duplicados}</b></div>
        {state.errores > 0 && (
          <div style={{ color: '#E24B4A', gridColumn: '1 / -1' }}>Errores: <b>{state.errores}</b></div>
        )}
      </div>

      <div style={{ marginTop: 10, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${(state.enviados / state.total) * 100}%`, height: '100%', background: '#1D9E75', transition: 'width 0.3s' }} />
      </div>

      {state.log.length > 0 && (
        <>
          <button
            onClick={() => setExpandido(x => !x)}
            style={{
              marginTop: 10, width: '100%',
              padding: '6px 10px', borderRadius: 6,
              background: 'rgba(255,255,255,0.08)',
              border: 'none', color: '#fff',
              cursor: 'pointer',
              fontFamily: 'Lexend, sans-serif', fontSize: 11,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
            <span>{expandido ? 'Ocultar detalle' : 'Ver detalle'}</span>
            <span>{expandido ? '▲' : '▼'}</span>
          </button>

          {expandido && (
            <div style={{
              marginTop: 8, maxHeight: 240, overflowY: 'auto',
              background: 'rgba(0,0,0,0.2)', borderRadius: 6,
              padding: 8, fontSize: 11,
            }}>
              {state.log.map((entry, idx) => {
                const colors: Record<string, string> = {
                  ok: '#1D9E75',
                  duplicado: '#7a8090',
                  pendiente: '#F26B1F',
                  error: '#E24B4A',
                }
                const labels: Record<string, string> = {
                  ok: 'Conciliada',
                  duplicado: 'Duplicado',
                  pendiente: 'Pendiente',
                  error: 'Error',
                }
                return (
                  <div key={idx} style={{ marginBottom: 6, paddingBottom: 6, borderBottom: idx < state.log.length - 1 ? '0.5px solid rgba(255,255,255,0.1)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors[entry.status], flexShrink: 0 }} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.filename}</span>
                      <span style={{ color: colors[entry.status], textTransform: 'uppercase', fontSize: 9, letterSpacing: '1px', flexShrink: 0 }}>{labels[entry.status]}</span>
                    </div>
                    {entry.detalle && (
                      <div style={{ fontSize: 10, color: '#a0a8b8', marginTop: 2, paddingLeft: 12 }}>{entry.detalle}</div>
                    )}
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
