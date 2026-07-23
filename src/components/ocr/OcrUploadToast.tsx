import { BLANCO, BORDE_SUAVE, CREMA, GRANATE, GRIS, INK, NAR, ROJO, VERDE } from '@/styles/neobrutal'
import {
  OCR_TOAST_GRANATE_OSCURO, CORREO_ALERTA_BORDE, OCR_TOAST_AMBER_BG, OCR_TOAST_AMBER_TXT,
  OCR_TOAST_VERDE_WASH, OCR_TOAST_ROJO_WASH,
} from '@/styles/palettes'
// OcrUploadToast v11 — aviso visible durante subida (no cerrar a media subida)
import { useState, useEffect } from 'react'
import { useOcrUpload, cargarResumenManifiesto, reintentarPendientes } from '@/lib/ocrUploadStore'
import type { OcrSession, ResumenManifiesto } from '@/lib/ocrUploadStore'

// C02: inyectar CSS global una sola vez
const STYLE_ID = 'ocr-toast-styles'
function inyectarEstilosGlobales() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `@keyframes achtungPulse { 0%,100% { box-shadow: 0 0 16px rgba(255,71,87,0.5);} 50% { box-shadow: 0 0 24px rgba(255,71,87,0.9);}} @keyframes ocrSpin { from { transform: rotate(0deg);} to { transform: rotate(360deg);}}`
  document.head.appendChild(style)
}

function AchtungBanner({ session }: { session: OcrSession }) {
  if (!session.achtungMensaje) return null
  // Si el problema es Google Drive desconectado, mostrar el botón de conectar
  // DIRECTAMENTE en el aviso (lleva al OAuth real ?action=start). Al volver de
  // Google, el usuario pulsa "Reanudar" y el lote continúa donde lo dejó.
  const esDrive = (session.achtungMensaje || '').toUpperCase().includes('DRIVE')
  return (
    <div style={{
      background: `linear-gradient(135deg, ${GRANATE}, ${OCR_TOAST_GRANATE_OSCURO})`,
      color: BLANCO,
      padding: '14px 16px',
      borderRadius: 0,
      marginBottom: 10,
      border: `2px solid ${CORREO_ALERTA_BORDE}`,
      animation: 'achtungPulse 1.4s ease-in-out infinite',
      boxShadow: '0 0 16px rgba(255, 71, 87, 0.5)',
    }}>
      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, letterSpacing: '3px', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>⚠️</span>
        <span>ACHTUNG</span>
      </div>
      <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, lineHeight: 1.4, fontWeight: 500 }}>
        {session.achtungMensaje}
      </div>
      {esDrive && (
        <a
          href="/api/oauth/google?action=start"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10,
            padding: '8px 14px', borderRadius: 0, background: BLANCO, color: GRANATE,
            textDecoration: 'none', fontFamily: 'Oswald, sans-serif', fontSize: 11,
            letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 700,
          }}
        >
          🔗 Conectar Drive
        </a>
      )}
    </div>
  )
}

// Aviso: mientras los archivos suben al servidor (fase frágil en el navegador),
// NO se debe cerrar ni cambiar de página o se pierden los no subidos.
function SubiendoBanner({ session }: { session: OcrSession }) {
  const totalSt = session.totalStorage ?? 0
  const subidosSt = session.subidosStorage ?? 0
  const subiendo = session.procesando && totalSt > 0 && subidosSt < totalSt
  if (!subiendo) return null
  return (
    <div style={{
      background: OCR_TOAST_AMBER_BG,
      border: `1px solid ${NAR}`,
      color: OCR_TOAST_AMBER_TXT,
      padding: '10px 12px',
      borderRadius: 0,
      marginBottom: 10,
      fontSize: 11.5,
      fontFamily: 'Lexend, sans-serif',
      lineHeight: 1.45,
      fontWeight: 500,
    }}>
      ⚠ Subiendo {subidosSt} de {totalSt} al servidor. No cierres esta ventana ni cambies de página hasta que ponga “Procesando”.
    </div>
  )
}

// Pastilla mini: icono + contador. Toca para expandir al toast completo.
function MiniToast({ session, onExpandir }: { session: OcrSession; onExpandir: () => void }) {
  const esAbortReal = !!session.achtungMensaje && (session.achtungTipo === 'creditos' || session.achtungTipo === 'api_key' || session.achtungTipo === 'modelo' || (session.achtungMensaje || '').includes('DRIVE'))
  const color = session.cancelado ? GRIS : (esAbortReal ? GRANATE : (session.pausada ? NAR : (session.procesando ? GRANATE : VERDE)))
  const icono = esAbortReal ? '⚠' : session.cancelado ? '⊘' : session.pausada ? '⏸' : session.procesando ? '⏳' : '✓'
  const girando = session.procesando && !session.pausada && !esAbortReal
  return (
    <button onClick={onExpandir} title="Ver detalle"
      style={{ display: 'flex', alignItems: 'center', gap: 8, background: BLANCO, border: `1px solid ${color}`, borderRadius: 999, padding: '8px 14px', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', fontFamily: 'Oswald, sans-serif' }}>
      <span style={{ fontSize: 15, color, display: 'inline-block', animation: girando ? 'ocrSpin 1.6s linear infinite' : 'none' }}>{icono}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color, letterSpacing: '0.5px' }}>{session.enviados}/{session.total}</span>
    </button>
  )
}

// Panel de cierre "cero pérdidas": lee el manifiesto y muestra la línea de criterio
// de éxito (Subidos N · Únicos U · Leídos · Lectura manual · Ignorados · Duplicados ·
// Errores · FALTAN), la lista nombrada de errores/faltantes con motivo, y "Retomar".
function ResumenManifiestoPanel({ grupoId }: { grupoId: string }) {
  const [resumen, setResumen] = useState<ResumenManifiesto | null>(null)
  const [cargando, setCargando] = useState(true)
  const [retomando, setRetomando] = useState(false)

  async function recargar() {
    const r = await cargarResumenManifiesto(grupoId)
    setResumen(r); setCargando(false)
  }
  useEffect(() => { recargar() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [grupoId])

  if (cargando) return null
  if (!resumen || resumen.subidos === 0) return null

  const r = resumen
  const muted = GRIS
  const okFaltan = r.faltan === 0
  const linea = `Subidos ${r.subidos} · Únicos ${r.unicos} · Leídos ${r.leidos} · Lectura manual ${r.lecturaManual} · Ignorados ${r.ignorados} · Duplicados ${r.duplicados} · Errores ${r.errores} · FALTAN ${r.faltan}`

  async function onRetomar() {
    setRetomando(true)
    await reintentarPendientes(grupoId)
    setTimeout(() => { recargar(); setRetomando(false) }, 1500)
  }

  return (
    <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 0, background: okFaltan ? OCR_TOAST_VERDE_WASH : OCR_TOAST_ROJO_WASH, border: `1px solid ${okFaltan ? VERDE : ROJO}` }}>
      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10.5, letterSpacing: '0.5px', lineHeight: 1.5, color: INK, fontWeight: 600 }}>
        {linea}
      </div>
      {!okFaltan && r.faltantes.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10.5, color: ROJO, fontWeight: 700, marginBottom: 4, fontFamily: 'Oswald, sans-serif', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            Sin resolver ({r.faltantes.length})
          </div>
          <div style={{ maxHeight: 130, overflowY: 'auto' }}>
            {r.faltantes.slice(0, 50).map((f, i) => (
              <div key={i} style={{ fontSize: 10.5, color: INK, lineHeight: 1.4, padding: '2px 0', wordBreak: 'break-word' }}>
                <span style={{ fontWeight: 600 }}>{f.nombre}</span>
                <span style={{ color: muted }}> — {f.estado === 'error_subida' ? 'no se subió' : f.estado === 'registrado' || f.estado === 'en_storage' ? 'sin procesar' : 'error'}{f.detalle ? `: ${f.detalle}` : ''}</span>
              </div>
            ))}
          </div>
          {r.reencolables > 0 && (
            <button onClick={onRetomar} disabled={retomando}
              style={{ marginTop: 8, width: '100%', background: retomando ? GRIS : GRANATE, color: BLANCO, border: 'none', borderRadius: 0, padding: '8px 10px', cursor: retomando ? 'default' : 'pointer', fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 700 }}>
              {retomando ? 'Retomando…' : `↻ Retomar pendientes (${r.reencolables})`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function SessionToast({ session, onCerrar, onOcultar, onCancelar, onPausar, onReanudar, onMini }: {
  session: OcrSession; onCerrar: () => void; onOcultar: () => void; onCancelar: () => void; onPausar: () => void; onReanudar: () => void; onMini: () => void
}) {
  const esAbortReal = !!session.achtungMensaje && (session.achtungTipo === 'creditos' || session.achtungTipo === 'api_key' || session.achtungTipo === 'modelo' || (session.achtungMensaje || '').includes('DRIVE'))
  const tieneErroresOAchtung = session.errores > 0 || session.achtung > 0
  const [expandido, setExpandido] = useState(tieneErroresOAchtung)
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)
  const [confirmarCerrar, setConfirmarCerrar] = useState(false)
  const pct = session.total > 0 ? Math.round((session.enviados / session.total) * 100) : 0
  const tieneAchtung = esAbortReal

  const bgPrincipal = BLANCO
  const bgSubtle = CREMA
  const bordeColor = tieneAchtung ? GRANATE : BORDE_SUAVE
  const textoPrincipal = INK
  const textoMuted = GRIS

  return (
    <div style={{
      background: bgPrincipal,
      color: textoPrincipal,
      padding: '14px 18px',
      borderRadius: 0,
      width: '100%', // C04: responsive
      maxWidth: 380, // C04: max-width en vez de width fijo
      fontFamily: 'Lexend, sans-serif',
      fontSize: 13,
      boxShadow: tieneAchtung ? '0 6px 32px rgba(176, 29, 35, 0.25)' : '0 6px 24px rgba(0,0,0,0.12)',
      border: tieneAchtung ? `1px solid ${bordeColor}` : `0.5px solid ${bordeColor}`,
      boxSizing: 'border-box' as const,
    }}>
      <AchtungBanner session={session} />
      <SubiendoBanner session={session} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{
          fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase',
          color: session.cancelado ? GRIS : (tieneAchtung ? GRANATE : (session.pausada ? NAR : (session.procesando ? GRANATE : VERDE))),
          fontWeight: 600,
        }}>
          {session.cancelado
            ? `Cancelada · ${session.enviados}/${session.total}`
            : esAbortReal
              ? `Abortado · ${session.enviados}/${session.total}`
              : session.pausada
                ? `Pausado · ${session.enviados}/${session.total}`
                : session.procesando
                  ? `Procesando ${session.enviados}/${session.total}`
                  : `Completado · ${session.total} archivos`}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {session.procesando && !confirmarCancelar && (
            session.pausada
              ? <button onClick={onReanudar}
                  style={{ background: NAR, border: 'none', color: BLANCO, cursor: 'pointer', padding: '0 10px', height: 22, borderRadius: 0, fontSize: 10, fontFamily: 'Oswald, sans-serif', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600 }}>
                  ▶ Reanudar
                </button>
              : <button onClick={onPausar}
                  style={{ background: 'transparent', border: `0.5px solid ${NAR}`, color: NAR, cursor: 'pointer', padding: '0 10px', height: 22, borderRadius: 0, fontSize: 10, fontFamily: 'Oswald, sans-serif', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  ⏸ Pausar
                </button>
          )}
          {session.procesando && !confirmarCancelar && (
            <button onClick={() => setConfirmarCancelar(true)}
              style={{ background: 'transparent', border: `0.5px solid ${BORDE_SUAVE}`, color: ROJO, cursor: 'pointer', padding: '0 10px', height: 22, borderRadius: 0, fontSize: 10, fontFamily: 'Oswald, sans-serif', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Cancelar
            </button>
          )}
          {session.procesando && confirmarCancelar && (
            <>
              <button onClick={() => setConfirmarCancelar(false)}
                style={{ background: BLANCO, border: `0.5px solid ${BORDE_SUAVE}`, color: textoMuted, cursor: 'pointer', padding: '0 8px', height: 22, borderRadius: 0, fontSize: 10, fontFamily: 'Lexend, sans-serif' }}>
                No
              </button>
              <button onClick={() => { onCancelar(); setConfirmarCancelar(false) }}
                style={{ background: ROJO, border: 'none', color: BLANCO, cursor: 'pointer', padding: '0 10px', height: 22, borderRadius: 0, fontSize: 10, fontFamily: 'Oswald, sans-serif', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600 }}>
                Sí, cancelar
              </button>
            </>
          )}
          <button onClick={onMini} title="Minimizar a icono" style={{ background: bgSubtle, border: 'none', color: textoMuted, cursor: 'pointer', padding: '0 8px', height: 22, borderRadius: 0, fontSize: 13, fontFamily: 'Lexend, sans-serif' }}>⌄</button>
          {session.procesando
            ? <button onClick={onOcultar} title="Ocultar (sigue procesando en segundo plano)" style={{ background: bgSubtle, border: 'none', color: textoMuted, cursor: 'pointer', padding: '0 8px', height: 22, borderRadius: 0, fontSize: 11, fontFamily: 'Lexend, sans-serif' }}>–</button>
            : (confirmarCerrar
                ? <>
                    <button onClick={() => setConfirmarCerrar(false)} style={{ background: BLANCO, border: `0.5px solid ${BORDE_SUAVE}`, color: textoMuted, cursor: 'pointer', padding: '0 8px', height: 22, borderRadius: 0, fontSize: 10, fontFamily: 'Lexend, sans-serif' }}>No</button>
                    <button onClick={onCerrar} style={{ background: ROJO, border: 'none', color: BLANCO, cursor: 'pointer', padding: '0 10px', height: 22, borderRadius: 0, fontSize: 10, fontFamily: 'Oswald, sans-serif', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600 }}>Sí, cerrar</button>
                  </>
                : <button onClick={() => setConfirmarCerrar(true)} title="Cerrar" style={{ background: bgSubtle, border: 'none', color: textoMuted, cursor: 'pointer', width: 22, height: 22, borderRadius: '50%', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>)
          }
        </div>
      </div>
      <div style={{ display: 'flex', gap: 14, fontSize: 12, marginBottom: 8 }}>
        <span style={{ color: VERDE, fontWeight: 500 }}>✓ {session.ok}</span>
        <span style={{ color: NAR, fontWeight: 500 }}>⏳ {session.pendientes}</span>
        <span style={{ color: textoMuted }}>= {session.duplicados}</span>
        {session.ignorados > 0 && <span style={{ color: textoMuted }} title="Ignorados (no son factura)">⊝ {session.ignorados}</span>}
        {session.errores > 0 && <span style={{ color: ROJO, fontWeight: 500 }}>✕ {session.errores}</span>}
        {session.achtung > 0 && <span style={{ color: GRANATE, fontWeight: 700 }}>⚠ {session.achtung}</span>}
        {session.cancelados > 0 && <span style={{ color: textoMuted }}>⊘ {session.cancelados}</span>}
      </div>
      <div style={{ height: 4, background: bgSubtle, borderRadius: 0, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: session.cancelado ? GRIS : (tieneAchtung ? GRANATE : (session.pausada ? NAR : (session.procesando ? GRANATE : VERDE))),
          transition: 'width 0.4s'
        }} />
      </div>
      {!session.procesando && !session.cancelado && session.grupoId && (
        <ResumenManifiestoPanel grupoId={session.grupoId} />
      )}
      {session.log.length > 0 && (
        <>
          <button onClick={() => setExpandido(x => !x)}
            style={{ marginTop: 10, width: '100%', padding: '6px 8px', borderRadius: 0, background: bgSubtle, border: 'none', color: textoMuted, cursor: 'pointer', fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Detalle ({session.log.length})</span>
            <span>{expandido ? '▲' : '▼'}</span>
          </button>
          {expandido && (
            <div style={{ marginTop: 6, maxHeight: 240, overflowY: 'auto', background: bgSubtle, borderRadius: 0, padding: '8px 10px' }}>
              {[...session.log].reverse().map((entry, idx) => {
                const colors: Record<string, string> = {
                  ok: VERDE, duplicado: textoMuted, ignorada: textoMuted, pendiente: NAR,
                  error: ROJO, achtung: GRANATE, cancelado: textoMuted,
                }
                const esCritico = entry.status === 'error' || entry.status === 'achtung'
                return (
                  <div key={idx} style={{ padding: '6px 0', borderBottom: idx < session.log.length - 1 ? `0.5px solid ${BORDE_SUAVE}` : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors[entry.status], flexShrink: 0 }} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, color: textoPrincipal }}>{entry.filename}</span>
                      <span style={{ color: colors[entry.status], fontSize: 9, flexShrink: 0, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>{entry.status}</span>
                    </div>
                    {esCritico && entry.detalle && (
                      <div style={{ marginTop: 3, marginLeft: 12, fontSize: 10, color: colors[entry.status], lineHeight: 1.4, wordBreak: 'break-word' }}>
                        {entry.detalle}
                      </div>
                    )}
                    {!esCritico && entry.detalle && entry.status !== 'ok' && (
                      <div style={{ marginTop: 2, marginLeft: 12, fontSize: 10, color: textoMuted, lineHeight: 1.4, wordBreak: 'break-word' }}>
                        {entry.detalle}
                      </div>
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

export default function OcrUploadToast() {
  const { sessions, cerrar, ocultar, cancelar, pausar, reanudar } = useOcrUpload()
  // ids minimizados a pastilla. Por defecto en movil arranca mini.
  const esMovil = typeof window !== 'undefined' && window.innerWidth <= 640
  const [minis, setMinis] = useState<Set<string>>(new Set())
  const [autoMiniHecho, setAutoMiniHecho] = useState(false)

  // C02: inyectar estilos globales una vez
  useEffect(() => { inyectarEstilosGlobales() }, [])

  const visibles = [...sessions.filter(s => s.visible)].sort((a, b) => a.creadoEn - b.creadoEn)

  // Aviso al cerrar/recargar la pestaña si hay una subida en curso (fase frágil).
  useEffect(() => {
    const haySubiendo = visibles.some(s => s.procesando && (s.totalStorage ?? 0) > 0 && (s.subidosStorage ?? 0) < (s.totalStorage ?? 0))
    if (!haySubiendo) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [visibles])

  // En movil, la primera vez que aparece un toast procesando, arranca minimizado
  useEffect(() => {
    if (esMovil && !autoMiniHecho && visibles.some(s => s.procesando)) {
      setMinis(new Set(visibles.filter(s => s.procesando).map(s => s.id)))
      setAutoMiniHecho(true)
    }
  }, [esMovil, autoMiniHecho, visibles])

  function toggleMini(id: string, on: boolean) {
    setMinis(prev => { const n = new Set(prev); if (on) n.add(id); else n.delete(id); return n })
  }

  if (visibles.length === 0) return null
  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column-reverse', gap: 10, alignItems: 'flex-end', maxHeight: 'calc(100vh - 40px)', overflow: 'hidden', maxWidth: 'calc(100vw - 40px)' }}>
      {visibles.map(s => (
        minis.has(s.id)
          ? <MiniToast key={s.id} session={s} onExpandir={() => toggleMini(s.id, false)} />
          : <SessionToast key={s.id} session={s}
              onCerrar={() => cerrar(s.id)}
              onOcultar={() => ocultar(s.id)}
              onCancelar={() => cancelar(s.id)}
              onPausar={() => pausar(s.id)}
              onReanudar={() => reanudar(s.id)}
              onMini={() => toggleMini(s.id, true)} />
      ))}
    </div>
  )
}
