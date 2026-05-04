// Store global de subida OCR — persiste en localStorage y sobrevive a cambio de pestaña
// Sin dependencias externas, usa solo React + EventTarget
// v3: CSV/texto se envían como texto plano (no base64) para evitar corrupción en atob()

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

// Detectar si el archivo es texto plano (CSV, TXT)
function esTextoPlano(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return ext === 'csv' || ext === 'txt' || file.type === 'text/csv' || file.type === 'text/plain'
}

// Leer archivo como base64 (para PDF/imagen/binario)
function leerBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res((r.result as string).split(',')[1])
    r.onerror = () => rej(new Error('Error leyendo archivo'))
    r.readAsDataURL(file)
  })
}

// Leer archivo como texto (para CSV/TXT)
function leerTexto(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(new Error('Error leyendo texto'))
    // Intentar UTF-8 primero
    r.readAsText(file, 'UTF-8')
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
      setState({
        total: files.length, enviados: 0, ok: 0, pendientes: 0,
        duplicados: 0, errores: 0, log: [], visible: true,
        procesando: true, fnName,
      })

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        let logEntry: ArchivoLog = { filename: file.name, status: 'error', detalle: '' }

        try {
          const esCsv = esTextoPlano(file)

          // Detectar mimeType correcto
          let mimeType = file.type
          if (!mimeType || mimeType === 'application/octet-stream') {
            const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
            if (ext === 'csv' || ext === 'txt') mimeType = 'text/csv'
            else if (ext === 'pdf') mimeType = 'application/pdf'
            else if (ext === 'png') mimeType = 'image/png'
            else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg'
            else if (ext === 'webp') mimeType = 'image/webp'
            else if (ext === 'xlsx') mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            else mimeType = 'application/pdf'
          }

          let body: Record<string, unknown>

          if (esCsv) {
            // CSV: enviar como texto plano, NO base64
            const textoCSV = await leerTexto(file)
            body = {
              fileTexto: textoCSV,   // texto plano para parseo nativo
              filename: file.name,
              mimeType,
            }
          } else {
            // PDF/imagen: enviar como base64
            const base64 = await leerBase64(file)
            body = { fileBase64: base64, filename: file.name, mimeType }
          }

          if (fnName === 'ocr-procesar-extracto' && titular_id_forzado) {
            body.titular_id = titular_id_forzado
          }

          const { data, error } = await supabase.functions.invoke(fnName, { body })

          if (error) {
            logEntry = { filename: file.name, status: 'error', detalle: `Error invoke: ${error.message || JSON.stringify(error)}` }
          } else if (data?.error) {
            logEntry = { filename: file.name, status: 'error', detalle: `${data.error}${data.detail ? ': ' + String(data.detail).slice(0, 200) : ''}` }
          } else if (data?.status === 'duplicado') {
            logEntry = { filename: file.name, status: 'duplicado', detalle: 'Ya existía en la BD' }
          } else if (data?.status === 'ok') {
            if (fnName === 'ocr-procesar-extracto') {
              logEntry = { filename: file.name, status: 'ok', detalle: `${data.insertados || 0} movs nuevos · ${data.saltados || 0} ya existían · ${data.categorizados_auto || 0} categ. auto` }
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
