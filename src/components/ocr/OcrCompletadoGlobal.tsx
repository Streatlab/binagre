import { BLANCO, GRIS, INK, ROJO, VERDE } from '@/styles/neobrutal'
// OcrCompletadoGlobal v5 — aviso GRANDE y veraz fuera de Papeleo al terminar un lote.
// v5: TOAST ÚNICO — OcrUploadToast (montado una sola vez en Layout) ya avisa de todo
//     lote con visible=true, en cualquier página. Este componente solo debe cubrir el
//     hueco de los lotes que el usuario ocultó a mitad de proceso ("Ocultar: sigue
//     procesando en segundo plano", visible=false) para que no se queden sin resumen
//     final. Por eso solo consulta sesiones visible=false: si está visible, ya la
//     muestra OcrUploadToast y una segunda notificación aquí sería un aviso duplicado
//     del mismo evento.
// v4: el mensaje refleja el desglose real (nuevas / ya estaban / a revisar / con error).
//     Las DUPLICADAS no son un fallo: "ya estaban" no pinta de rojo. Solo hay error si
//     errores>0. Antes mostraba "{ok} de {total}" y un lote de duplicados (p.ej. 9/144)
//     daba falsa imagen de error.
import { useEffect, useState, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

interface Notif {
  id: string
  ok: number
  duplicados: number
  pendientes: number
  errores: number
  ignorados: number
  total: number
  ts: number
}

const DURACION_MS = 60000

export default function OcrCompletadoGlobal() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const esOcr = pathname === '/finanzas/papeleo' && (new URLSearchParams(search).get('tab') ?? 'bandeja') === 'bandeja'
  const [notifs, setNotifs] = useState<Notif[]>([])
  const vistasRef = useRef<Set<string>>(new Set())

  const checkCompletadas = useCallback(async () => {
    if (esOcr) return
    try {
      const cutoff = new Date(Date.now() - DURACION_MS).toISOString()
      const { data } = await supabase
        .from('ocr_sessions')
        .select('id,ok,duplicados,pendientes,errores,ignorados,total,completado_en')
        .eq('estado_cola', 'completada')
        .eq('visible', false) // visible=true ya lo cubre OcrUploadToast: evita el aviso duplicado
        .gte('completado_en', cutoff)
        .limit(10)
      if (!data) return
      const nuevas: Notif[] = []
      for (const s of data) {
        if (vistasRef.current.has(s.id)) continue
        vistasRef.current.add(s.id)
        nuevas.push({
          id: s.id, ok: s.ok || 0, duplicados: s.duplicados || 0,
          pendientes: s.pendientes || 0, errores: s.errores || 0,
          ignorados: s.ignorados || 0, total: s.total || 0, ts: Date.now(),
        })
      }
      if (nuevas.length > 0) setNotifs(prev => [...prev, ...nuevas])
    } catch {}
  }, [esOcr])

  useEffect(() => {
    if (esOcr) return
    checkCompletadas()
    const timer = setInterval(checkCompletadas, 5000)
    return () => clearInterval(timer)
  }, [esOcr, checkCompletadas])

  // Auto-borrar a los 60s
  useEffect(() => {
    if (notifs.length === 0) return
    const timer = setInterval(() => {
      setNotifs(prev => prev.filter(n => Date.now() - n.ts < DURACION_MS))
    }, 1000)
    return () => clearInterval(timer)
  }, [notifs.length])

  // Inyectar animaciones una vez
  useEffect(() => {
    const ID = 'ocr-completado-anim'
    if (document.getElementById(ID)) return
    const st = document.createElement('style')
    st.id = ID
    st.textContent = `
@keyframes ocrDoneIn { from { opacity:0; transform: translateY(16px) scale(0.96);} to { opacity:1; transform: translateY(0) scale(1);} }
@keyframes ocrDonePulse { 0%,100% { box-shadow: 0 8px 28px rgba(29,158,117,0.45);} 50% { box-shadow: 0 8px 40px rgba(29,158,117,0.85);} }
@keyframes ocrDonePulseErr { 0%,100% { box-shadow: 0 8px 28px rgba(226,75,74,0.45);} 50% { box-shadow: 0 8px 40px rgba(226,75,74,0.9);} }`
    document.head.appendChild(st)
  }, [])

  if (esOcr) return null
  if (notifs.length === 0) return null

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 10000,
      display: 'flex', flexDirection: 'column-reverse', gap: 10,
    }}>
      {notifs.map(n => {
        const hayError = n.errores > 0
        const acento = hayError ? ROJO : VERDE
        // Mensaje veraz: cada categoría se nombra por lo que es. Duplicada = "ya estaban".
        const partes: string[] = []
        if (n.ok > 0) partes.push(`${n.ok} ${n.ok === 1 ? 'nueva' : 'nuevas'}`)
        if (n.duplicados > 0) partes.push(`${n.duplicados} ya ${n.duplicados === 1 ? 'estaba' : 'estaban'}`)
        if (n.pendientes > 0) partes.push(`${n.pendientes} a revisar`)
        if (n.ignorados > 0) partes.push(`${n.ignorados} ${n.ignorados === 1 ? 'ignorado' : 'ignorados'}`)
        if (n.errores > 0) partes.push(`${n.errores} con error`)
        const totalTxt = n.total ? `${n.total} ${n.total === 1 ? 'documento' : 'documentos'}` : 'Lote'
        const detalle = partes.length > 0 ? partes.join(' · ') : 'sin novedades'
        return (
          <div key={n.id} style={{
            background: BLANCO,
            borderRadius: 0,
            padding: '16px 18px',
            minWidth: 300,
            maxWidth: 360,
            border: `2px solid ${acento}`,
            animation: `ocrDoneIn 0.35s ease, ${hayError ? 'ocrDonePulseErr' : 'ocrDonePulse'} 1.6s ease-in-out infinite`,
            fontFamily: 'Lexend, sans-serif',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{
                width: 30, height: 30, borderRadius: '50%', background: acento,
                color: BLANCO, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17, fontWeight: 700, flexShrink: 0,
              }}>{hayError ? '!' : '✓'}</span>
              <span style={{
                fontFamily: 'Oswald, sans-serif', fontSize: 15, letterSpacing: '1.5px',
                textTransform: 'uppercase', fontWeight: 700, color: acento,
              }}>Lote OCR terminado</span>
              <button
                onClick={() => setNotifs(prev => prev.filter(x => x.id !== n.id))}
                style={{ background: 'none', border: 'none', color: GRIS, cursor: 'pointer', fontSize: 16, marginLeft: 'auto', padding: '0 2px' }}
              >×</button>
            </div>
            <div style={{ fontSize: 13, color: INK, marginBottom: 12, lineHeight: 1.4 }}>
              {totalTxt}: {detalle}.
              <br />Ve a revisar el resultado.
            </div>
            <button
              onClick={() => { setNotifs(prev => prev.filter(x => x.id !== n.id)); navigate('/finanzas/papeleo?tab=bandeja') }}
              style={{
                width: '100%', background: acento, color: BLANCO, border: 'none',
                borderRadius: 0, padding: '10px 12px', cursor: 'pointer',
                fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '1.5px',
                textTransform: 'uppercase', fontWeight: 700,
              }}
            >Revisar lote →</button>
          </div>
        )
      })}
    </div>
  )
}
