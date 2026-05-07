// OcrUploadToast v5 — añade banner ACHTUNG rojo para errores críticos (créditos, API key, modelo)
import { useState } from 'react'
import { useOcrUpload } from '@/lib/ocrUploadStore'
import type { OcrSession } from '@/lib/ocrUploadStore'

function AchtungBanner({ session }: { session: OcrSession }) {
  if (!session.achtungMensaje) return null
  return (
    <div style={{
      background: 'linear-gradient(135deg, #B01D23, #7a0d12)',
      color: '#fff',
      padding: '14px 16px',
      borderRadius: 10,
      marginBottom: 10,
      border: '2px solid #FF4757',
      animation: 'achtungPulse 1.4s ease-in-out infinite',
      boxShadow: '0 0 16px rgba(255, 71, 87, 0.5)',
    }}>
      <div style={{
        fontFamily: 'Oswald, sans-serif',
        fontSize: 14,
        letterSpacing: '3px',
        fontWeight: 700,
        marginBottom: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{ fontSize: 18 }}>⚠️</span>
        <span>ACHTUNG</span>
      </div>
      <div style={{
        fontFamily: 'Lexend, sans-serif',
        fontSize: 12,
        lineHeight: 1.4,
        fontWeight: 500,
      }}>
        {session.achtungMensaje}
      </div>
      <style>{`
        @keyframes achtungPulse {
          0%, 100% { box-shadow: 0 0 16px rgba(255, 71, 87, 0.5); }
          50% { box-shadow: 0 0 24px rgba(255, 71, 87, 0.9); }
        }
      `}</style>
    </div>
  )
}

function SessionToast({ session, onCerrar, onOcultar }: {
  session: OcrSession; onCerrar: () => void; onOcultar: () => void
}) {
  const [expandido, setExpandido] = useState(false)
  const pct = session.total > 0 ? Math.round((session.enviados / session.total) * 100) : 0
  const tieneAchtung = session.achtung > 0
  return (
    <div style={{
      background: tieneAchtung ? '#2a1a1d' : '#1e2233',
      color: '#fff',
      padding: '14px 18px',
      borderRadius: 12,
      width: 360,
      fontFamily: 'Lexend, sans-serif',
      fontSize: 13,
      boxShadow: tieneAchtung ? '0 6px 32px rgba(176, 29, 35, 0.5)' : '0 6px 24px rgba(0,0,0,0.35)',
      border: tieneAchtung ? '0.5px solid #B01D23' : '0.5px solid rgba(255,255,255,0.08)',
    }}>
      <AchtungBanner session={session} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: tieneAchtung ? '#FF4757' : (session.procesando ? '#e8f442' : '#1D9E75') }}>
          {tieneAchtung ? `Abortado · ${session.enviados}/${session.total}` : (session.procesando ? `Procesando… ${session.enviados}/${session.total}` : `Completado · ${session.total} archivos`)}
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
        {session.achtung > 0 && <span style={{ color: '#FF4757', fontWeight: 700 }}>⚠ {session.achtung}</span>}
      </div>
      <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: tieneAchtung ? '#FF4757' : (session.procesando ? '#e8f442' : '#1D9E75'), transition: 'width 0.4s' }} />
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
                const colors: Record<string, string> = { ok: '#1D9E75', duplicado: '#7a8090', pendiente: '#F26B1F', error: '#E24B4A', achtung: '#FF4757' }
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', borderBottom: idx < session.log.length - 1 ? '0.5px solid rgba(255,255,255,0.06)' : 'none' }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: colors[entry.status], flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10, color: '#cdd0d8' }}>{entry.filename}</span>
                    <span style={{ color: colors[entry.status], fontSize: 9, flexShrink: 0, textTransform: 'uppercase' }}>{entry.status}</span>
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
  const visibles = [...sessions.filter(s => s.visible)].sort((a, b) => a.creadoEn - b.creadoEn)
  if (visibles.length === 0) return null
  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column-reverse', gap: 8, alignItems: 'flex-end', maxHeight: 'calc(100vh - 40px)', overflow: 'hidden' }}>
      {visibles.map(s => (
        <SessionToast key={s.id} session={s} onCerrar={() => cerrar(s.id)} onOcultar={() => ocultar(s.id)} />
      ))}
    </div>
  )
}
