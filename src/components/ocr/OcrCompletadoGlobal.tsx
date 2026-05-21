// OcrCompletadoGlobal v2 — mini-notificación fuera de /ocr al completarse un proceso
// Hace su propia query ligera cada 5s buscando sesiones completadas recientes.
// Se auto-oculta a los 20s. NO muestra progreso ni detalle, solo aviso de completado.
import { useEffect, useState, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

interface Notif {
  id: string
  ok: number
  errores: number
  ts: number
}

export default function OcrCompletadoGlobal() {
  const { pathname } = useLocation()
  const esOcr = pathname === '/ocr'
  const [notifs, setNotifs] = useState<Notif[]>([])
  const vistasRef = useRef<Set<string>>(new Set())

  const checkCompletadas = useCallback(async () => {
    if (esOcr) return
    try {
      const cutoff = new Date(Date.now() - 30000).toISOString()
      const { data } = await supabase
        .from('ocr_sessions')
        .select('id,ok,errores,completado_en')
        .eq('estado_cola', 'completada')
        .gte('completado_en', cutoff)
        .limit(10)
      if (!data) return
      const nuevas: Notif[] = []
      for (const s of data) {
        if (vistasRef.current.has(s.id)) continue
        vistasRef.current.add(s.id)
        nuevas.push({ id: s.id, ok: s.ok || 0, errores: s.errores || 0, ts: Date.now() })
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

  // Auto-borrar a los 20s
  useEffect(() => {
    if (notifs.length === 0) return
    const timer = setInterval(() => {
      setNotifs(prev => prev.filter(n => Date.now() - n.ts < 20000))
    }, 1000)
    return () => clearInterval(timer)
  }, [notifs.length])

  if (esOcr) return null
  if (notifs.length === 0) return null

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 9999,
      display: 'flex', flexDirection: 'column-reverse', gap: 8,
    }}>
      {notifs.map(n => (
        <div key={n.id} style={{
          background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 10,
          padding: '12px 16px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          display: 'flex', alignItems: 'center', gap: 10, minWidth: 260,
          animation: 'fadeInUp 0.3s ease',
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: n.errores > 0 ? '#E24B4A' : '#1D9E75', flexShrink: 0,
          }} />
          <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#111' }}>
            OCR completado: {n.ok} OK{n.errores > 0 ? `, ${n.errores} errores` : ''}
          </span>
          <button
            onClick={() => setNotifs(prev => prev.filter(x => x.id !== n.id))}
            style={{
              background: 'none', border: 'none', color: '#7a8090',
              cursor: 'pointer', fontSize: 14, marginLeft: 'auto', padding: '0 4px',
            }}
          >×</button>
        </div>
      ))}
      <style>{`@keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}
