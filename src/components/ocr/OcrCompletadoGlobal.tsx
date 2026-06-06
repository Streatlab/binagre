// OcrCompletadoGlobal v3 — aviso GRANDE y visible fuera de /ocr al terminar un lote.
// Pulso para llamar la atencion en cualquier modulo. Boton directo para ir a revisar.
// Dura 60s y luego se auto-oculta. Hace su propia query ligera cada 5s.
import { useEffect, useState, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

interface Notif {
  id: string
  ok: number
  errores: number
  total: number
  ts: number
}

const DURACION_MS = 60000

export default function OcrCompletadoGlobal() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const esOcr = pathname === '/ocr'
  const [notifs, setNotifs] = useState<Notif[]>([])
  const vistasRef = useRef<Set<string>>(new Set())

  const checkCompletadas = useCallback(async () => {
    if (esOcr) return
    try {
      const cutoff = new Date(Date.now() - DURACION_MS).toISOString()
      const { data } = await supabase
        .from('ocr_sessions')
        .select('id,ok,errores,total,completado_en')
        .eq('estado_cola', 'completada')
        .gte('completado_en', cutoff)
        .limit(10)
      if (!data) return
      const nuevas: Notif[] = []
      for (const s of data) {
        if (vistasRef.current.has(s.id)) continue
        vistasRef.current.add(s.id)
        nuevas.push({ id: s.id, ok: s.ok || 0, errores: s.errores || 0, total: s.total || 0, ts: Date.now() })
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
        const acento = hayError ? '#E24B4A' : '#1D9E75'
        return (
          <div key={n.id} style={{
            background: '#fff',
            borderRadius: 14,
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
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17, fontWeight: 700, flexShrink: 0,
              }}>{hayError ? '!' : '✓'}</span>
              <span style={{
                fontFamily: 'Oswald, sans-serif', fontSize: 15, letterSpacing: '1.5px',
                textTransform: 'uppercase', fontWeight: 700, color: acento,
              }}>Lote OCR terminado</span>
              <button
                onClick={() => setNotifs(prev => prev.filter(x => x.id !== n.id))}
                style={{ background: 'none', border: 'none', color: '#7a8090', cursor: 'pointer', fontSize: 16, marginLeft: 'auto', padding: '0 2px' }}
              >×</button>
            </div>
            <div style={{ fontSize: 13, color: '#111', marginBottom: 12, lineHeight: 1.4 }}>
              {n.ok} leídas correctamente{hayError ? ` · ${n.errores} con error` : ''}{n.total ? ` de ${n.total}` : ''}.
              <br />Ve a revisar el resultado.
            </div>
            <button
              onClick={() => { setNotifs(prev => prev.filter(x => x.id !== n.id)); navigate('/ocr') }}
              style={{
                width: '100%', background: acento, color: '#fff', border: 'none',
                borderRadius: 8, padding: '10px 12px', cursor: 'pointer',
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
