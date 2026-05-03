// Store global de subida OCR — persiste en localStorage y sobrevive a cambio de pestaña
// Sin dependencias externas, usa solo React + EventTarget
// v2: ventana match facturas ±60 días (algunas facturas se emiten meses después del cargo bancario)

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface ArchivoLog {
  filename: string
  status: 'ok' | 'duplicado' | 'pendiente' | 'error'
  detalle: string
}

export interface OcrUploadState {
  total: number
  enviados: number
  ok: number
  pendientes: number
  duplicados: number
  errores: number
  log: ArchivoLog[]
  visible: boolean
  procesando: boolean
  fnName: 'ocr-procesar-factura' | 'ocr-procesar-extracto' | null
}

const STORAGE_KEY = 'ocr_upload_state_v1'
const emitter = new EventTarget()

function loadInitial(): OcrUploadState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as OcrUploadState
    // Si el navegador se cerró durante un procesamiento, marcamos como completado
    if (s.procesando && s.enviados < s.total) {
      s.procesando = false
    }
    return s
  } catch {
    return null
  }
}

let currentState: OcrUploadState | null = loadInitial()

function persist(s: OcrUploadState | null) {
  try {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // swallow
  }
}

function setState(s: OcrUploadState | null) {
  currentState = s
  persist(s)
  emitter.dispatchEvent(new CustomEvent('change'))
}

// Sincronizar entre pestañas del mismo navegador
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key === STORAGE_KEY) {
      try {
        currentState = e.newValue ? JSON.parse(e.newValue) as OcrUploadState : null
      } catch {
        currentState = null
      }
      emitter.dispatchEvent(new CustomEvent('change'))
    }
  })
}

export function useOcrUpload(): {
  state: OcrUploadState | null
  procesar: (files: File[], fnName: 'ocr-procesar-factura' | 'ocr-procesar-extracto', titular_id_forzado: string | null) => Promise<void>
  cerrar: () => void
  ocultar: () => void
} {
  const [state, setSt] = useState<OcrUploadState | null>(currentState)

  useEffect(() => {
    const handler = () => setSt(currentState)
    emitter.addEventListener('change', handler)
    return () => emitter.removeEventListener('change', handler)
  }, [])

  return {
    state,
    procesar: async (files, fnName, titular_id_forzado) => {
      // Estado inicial
      setState({
        total: files.length, enviados: 0, ok: 0, pendientes: 0,
        duplicados: 0, errores: 0, log: [], visible: true,
        procesando: true, fnName,
      })

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        let logEntry: ArchivoLog = { filename: file.name, status: 'error', detalle: '' }

        try {
          const base64 = await new Promise<string>((res, rej) => {
            const r = new FileReader()
            r.onload = () => res((r.result as string).split(',')[1])
            r.onerror = () => rej(new Error('Error leyendo archivo'))
            r.readAsDataURL(file)
          })

          const body: Record<string, unknown> = { fileBase64: base64, filename: file.name, mimeType: file.type || 'application/pdf' }
          if (fnName === 'ocr-procesar-extracto' && titular_id_forzado) body.titular_id = titular_id_forzado

          const { data, error } = await supabase.functions.invoke(fnName, { body })

          if (error) {
            logEntry = { filename: file.name, status: 'error', detalle: `Error invoke: ${error.message || JSON.stringify(error)}` }
          } else if (data?.error) {
            logEntry = { filename: file.name, status: 'error', detalle: `${data.error}${data.detail ? ': ' + String(data.detail).slice(0, 200) : ''}` }
          } else if (data?.status === 'duplicado') {
            logEntry = { filename: file.name, status: 'duplicado', detalle: 'Ya existía en la BD' }
          } else if (data?.status === 'ok') {
            if (fnName === 'ocr-procesar-extracto') {
              logEntry = { filename: file.name, status: 'ok', detalle: `${data.insertados || 0} movs nuevos · ${data.saltados || 0} ya existían` }
            } else if (data?.matched && !data?.sin_categoria && !data?.sin_titular) {
              logEntry = { filename: file.name, status: 'ok', detalle: 'Conciliada' }
            } else {
              const motivos: string[] = []
              if (!data.matched) motivos.push('sin movimiento bancario')
              if (data.sin_categoria) motivos.push('sin categoría')
              if (data.sin_titular) motivos.push('sin titular')
              logEntry = { filename: file.name, status: 'pendiente', detalle: `Subida — falta: ${motivos.join(', ')}` }
            }
          } else {
            logEntry = { filename: file.name, status: 'error', detalle: 'Respuesta inesperada' }
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          logEntry = { filename: file.name, status: 'error', detalle: msg }
        }

        // Actualizar estado leyendo el currentState más reciente
        if (currentState) {
          const next: OcrUploadState = {
            ...currentState,
            enviados: currentState.enviados + 1,
            log: [...currentState.log, logEntry],
            ok: currentState.ok + (logEntry.status === 'ok' ? 1 : 0),
            duplicados: currentState.duplicados + (logEntry.status === 'duplicado' ? 1 : 0),
            pendientes: currentState.pendientes + (logEntry.status === 'pendiente' ? 1 : 0),
            errores: currentState.errores + (logEntry.status === 'error' ? 1 : 0),
          }
          setState(next)
        }

        if (i < files.length - 1) {
          await new Promise(r => setTimeout(r, 1500))
        }
      }

      // Marcar como terminado
      if (currentState) {
        setState({ ...currentState, procesando: false })
      }
    },
    cerrar: () => setState(null),
    ocultar: () => {
      if (currentState) setState({ ...currentState, visible: false })
    },
  }
}
