import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

interface OcrJob {
  id: string
  tipo: string
  estado: string
  archivos_total: number
  archivos_procesados: number
  archivos_error: number
  archivo_actual: string | null
  mensaje: string | null
  created_at: string
  completed_at: string | null
}

export default function OcrJobToasts() {
  const [jobs, setJobs] = useState<OcrJob[]>([])
  const [cancelando, setCancelando] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoCloseTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const cargarJobs = useCallback(async () => {
    const ahora = new Date()
    const hace20s = new Date(ahora.getTime() - 20000).toISOString()

    const { data } = await supabase
      .from('ocr_jobs')
      .select('*')
      .or(`estado.in.(pendiente,procesando),and(estado.eq.completado,completed_at.gte.${hace20s}),and(estado.eq.error,completed_at.gte.${hace20s})`)
      .order('created_at', { ascending: true })

    if (data) setJobs(data)
  }, [])

  useEffect(() => {
    cargarJobs()

    const channel = supabase
      .channel('ocr-jobs-realtime-toasts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ocr_jobs' }, () => {
        cargarJobs()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [cargarJobs])

  // Auto-close completados después de 20s
  useEffect(() => {
    jobs.forEach(j => {
      if ((j.estado === 'completado' || j.estado === 'error') && j.completed_at && !autoCloseTimers.current[j.id]) {
        const elapsed = Date.now() - new Date(j.completed_at).getTime()
        const remaining = Math.max(0, 20000 - elapsed)

        autoCloseTimers.current[j.id] = setTimeout(() => {
          setJobs(prev => prev.filter(p => p.id !== j.id))
          delete autoCloseTimers.current[j.id]
        }, remaining)
      }
    })
  }, [jobs])

  const cancelar = async (jobId: string) => {
    setCancelando(jobId)
  }

  const confirmarCancelar = async (jobId: string) => {
    await supabase
      .from('ocr_jobs')
      .update({ estado: 'cancelado', completed_at: new Date().toISOString() })
      .eq('id', jobId)
      .in('estado', ['pendiente', 'procesando'])

    // Arrancar siguiente
    const { data: siguiente } = await supabase
      .from('ocr_jobs')
      .select('id')
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (siguiente) {
      await supabase.from('ocr_jobs').update({ estado: 'procesando' }).eq('id', siguiente.id)
    }

    setJobs(prev => prev.filter(j => j.id !== jobId))
    setCancelando(null)
  }

  if (jobs.length === 0) return null

  const tipoLabel: Record<string, string> = {
    factura: 'Facturas',
    extracto: 'Extractos',
    venta: 'Ventas',
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column-reverse',
      gap: 10,
      maxWidth: 380,
      fontFamily: 'Lexend, sans-serif',
    }}>
      {jobs.map(job => {
        const pct = job.archivos_total > 0 ? Math.round((job.archivos_procesados / job.archivos_total) * 100) : 0
        const isComplete = job.estado === 'completado'
        const isError = job.estado === 'error'
        const isPending = job.estado === 'pendiente'
        const isProcessing = job.estado === 'procesando'

        return (
          <div key={job.id} style={{
            background: '#1e2233',
            borderRadius: 10,
            padding: '14px 16px',
            color: '#fff',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            fontSize: 13,
            minWidth: 320,
            transition: 'all 0.3s ease',
            opacity: isPending ? 0.7 : 1,
            borderLeft: `4px solid ${isComplete ? '#1D9E75' : isError ? '#B01D23' : isPending ? '#666' : '#FF4757'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 600, fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', fontSize: 12, letterSpacing: 1 }}>
                {isComplete ? '✅ ' : isError ? '❌ ' : isPending ? '⏳ ' : '🔄 '}
                {tipoLabel[job.tipo] || job.tipo}
                {isPending && ' — En cola'}
              </div>
              {(isProcessing || isPending) && cancelando !== job.id && (
                <button
                  onClick={() => cancelar(job.id)}
                  style={{
                    background: 'transparent',
                    border: '1px solid #555',
                    color: '#aaa',
                    borderRadius: 4,
                    padding: '2px 8px',
                    cursor: 'pointer',
                    fontSize: 11,
                  }}
                >
                  Cancelar
                </button>
              )}
              {cancelando === job.id && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => confirmarCancelar(job.id)}
                    style={{
                      background: '#B01D23',
                      border: 'none',
                      color: '#fff',
                      borderRadius: 4,
                      padding: '2px 10px',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    Sí, cancelar
                  </button>
                  <button
                    onClick={() => setCancelando(null)}
                    style={{
                      background: 'transparent',
                      border: '1px solid #555',
                      color: '#aaa',
                      borderRadius: 4,
                      padding: '2px 8px',
                      cursor: 'pointer',
                      fontSize: 11,
                    }}
                  >
                    No
                  </button>
                </div>
              )}
            </div>

            {isProcessing && (
              <>
                <div style={{
                  background: '#2a2f45',
                  borderRadius: 4,
                  height: 6,
                  marginBottom: 6,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    background: '#B01D23',
                    height: '100%',
                    width: `${pct}%`,
                    borderRadius: 4,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                <div style={{ fontSize: 11, color: '#999' }}>
                  {job.archivos_procesados}/{job.archivos_total} ({pct}%)
                  {job.archivo_actual && <span style={{ marginLeft: 6 }}>· {job.archivo_actual}</span>}
                  {job.archivos_error > 0 && <span style={{ color: '#FF4757', marginLeft: 6 }}>· {job.archivos_error} errores</span>}
                </div>
              </>
            )}

            {isPending && (
              <div style={{ fontSize: 11, color: '#666' }}>
                {job.archivos_total} archivos esperando
              </div>
            )}

            {isComplete && (
              <div style={{ fontSize: 11, color: '#1D9E75' }}>
                {job.archivos_procesados} procesados
                {job.archivos_error > 0 && <span style={{ color: '#FF4757' }}> · {job.archivos_error} errores</span>}
              </div>
            )}

            {isError && (
              <div style={{ fontSize: 11, color: '#FF4757' }}>
                {job.mensaje || 'Error en el procesamiento'}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
