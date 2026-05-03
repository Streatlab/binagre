import { create } from 'zustand'
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

interface Store {
  state: OcrUploadState | null
  iniciar: (total: number, fnName: 'ocr-procesar-factura' | 'ocr-procesar-extracto') => void
  procesar: (files: File[], fnName: 'ocr-procesar-factura' | 'ocr-procesar-extracto', titular_id_forzado: string | null) => Promise<void>
  cerrar: () => void
}

const STORAGE_KEY = 'ocr_upload_state_v1'

function loadInitial(): OcrUploadState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as OcrUploadState
    // Si quedó procesando de una sesión anterior interrumpida, marcamos como completado
    if (s.procesando) {
      s.procesando = false
    }
    return s
  } catch {
    return null
  }
}

function persist(s: OcrUploadState | null) {
  try {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // swallow
  }
}

export const useOcrUploadStore = create<Store>((set, get) => ({
  state: loadInitial(),

  iniciar: (total, fnName) => {
    const s: OcrUploadState = {
      total, enviados: 0, ok: 0, pendientes: 0, duplicados: 0, errores: 0,
      log: [], visible: true, procesando: true, fnName,
    }
    persist(s)
    set({ state: s })
  },

  procesar: async (files, fnName, titular_id_forzado) => {
    get().iniciar(files.length, fnName)

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

        const body: any = { fileBase64: base64, filename: file.name, mimeType: file.type || 'application/pdf' }
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
      } catch (err: any) {
        logEntry = { filename: file.name, status: 'error', detalle: err?.message || String(err) }
      }

      const cur = get().state
      if (cur) {
        const next: OcrUploadState = {
          ...cur,
          enviados: cur.enviados + 1,
          log: [...cur.log, logEntry],
          ok: cur.ok + (logEntry.status === 'ok' ? 1 : 0),
          duplicados: cur.duplicados + (logEntry.status === 'duplicado' ? 1 : 0),
          pendientes: cur.pendientes + (logEntry.status === 'pendiente' ? 1 : 0),
          errores: cur.errores + (logEntry.status === 'error' ? 1 : 0),
        }
        persist(next)
        set({ state: next })
      }

      if (i < files.length - 1) {
        await new Promise(r => setTimeout(r, 1500))
      }
    }

    const cur = get().state
    if (cur) {
      const final: OcrUploadState = { ...cur, procesando: false }
      persist(final)
      set({ state: final })
    }
  },

  cerrar: () => {
    persist(null)
    set({ state: null })
  },
}))
