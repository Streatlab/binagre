// Store global de subida OCR — persiste en localStorage y sobrevive a cambio de pestaña
// v5: Excel con SheetJS — fechas forzadas a string DD/MM/YYYY, no números de serie

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
    if (s.procesando && s.enviados < s.total) s.procesando = false
    return s
  } catch { return null }
}

let currentState: OcrUploadState | null = loadInitial()

function persist(s: OcrUploadState | null) {
  try {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

function setState(s: OcrUploadState | null) {
  currentState = s
  persist(s)
  emitter.dispatchEvent(new CustomEvent('change'))
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key === STORAGE_KEY) {
      try { currentState = e.newValue ? JSON.parse(e.newValue) as OcrUploadState : null }
      catch { currentState = null }
      emitter.dispatchEvent(new CustomEvent('change'))
    }
  })
}

function getExt(file: File) {
  return file.name.split('.').pop()?.toLowerCase() ?? ''
}

function esTextoPlano(file: File): boolean {
  const ext = getExt(file)
  return ext === 'csv' || ext === 'txt' || file.type === 'text/csv' || file.type === 'text/plain'
}

function esExcel(file: File): boolean {
  const ext = getExt(file)
  return ext === 'xlsx' || ext === 'xls'
}

function leerBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res((r.result as string).split(',')[1])
    r.onerror = () => rej(new Error('Error leyendo archivo'))
    r.readAsDataURL(file)
  })
}

function leerTexto(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(new Error('Error leyendo texto'))
    r.readAsText(file, 'UTF-8')
  })
}

async function cargarSheetJS(): Promise<any> {
  if ((window as any).XLSX) return (window as any).XLSX
  await new Promise<void>((res, rej) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    s.onload = () => res()
    s.onerror = () => rej(new Error('No se pudo cargar SheetJS'))
    document.head.appendChild(s)
  })
  return (window as any).XLSX
}

// Convertir Excel a CSV con fechas legibles
async function excelACSV(file: File): Promise<string> {
  const XLSX = await cargarSheetJS()
  const buf = await file.arrayBuffer()
  // cellDates: true → SheetJS devuelve Date() en lugar de números de serie
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]

  // Recorrer todas las celdas y convertir fechas a DD/MM/YYYY
  const ref = ws['!ref']
  if (ref) {
    const range = XLSX.utils.decode_range(ref)
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C })
        const cell = ws[addr]
        if (!cell) continue
        // Si la celda es fecha (tipo 'd' con cellDates:true, o tipo 'n' con formato fecha)
        if (cell.t === 'd' && cell.v instanceof Date) {
          const d = cell.v as Date
          const dd = String(d.getDate()).padStart(2, '0')
          const mm = String(d.getMonth() + 1).padStart(2, '0')
          const yyyy = d.getFullYear()
          cell.t = 's'
          cell.v = `${dd}/${mm}/${yyyy}`
          cell.w = cell.v
        }
      }
    }
  }

  const csv: string = XLSX.utils.sheet_to_csv(ws, { FS: ';', blankrows: false })
  return csv
}

function getMimeType(file: File): string {
  if (file.type && file.type !== 'application/octet-stream') return file.type
  const ext = getExt(file)
  const map: Record<string, string> = {
    csv: 'text/csv', txt: 'text/csv',
    pdf: 'application/pdf', png: 'image/png',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
  }
  return map[ext] ?? 'application/pdf'
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
          const mimeType = getMimeType(file)
          let body: Record<string, unknown>

          if (esExcel(file)) {
            // Excel → CSV con fechas legibles (cellDates:true + conversión manual)
            const csvTexto = await excelACSV(file)
            body = {
              fileTexto: csvTexto,
              filename: file.name.replace(/\.(xlsx|xls)$/i, '.csv'),
              mimeType: 'text/csv',
            }
          } else if (esTextoPlano(file)) {
            const textoCSV = await leerTexto(file)
            body = { fileTexto: textoCSV, filename: file.name, mimeType }
          } else {
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
          setState({
            ...currentState,
            enviados: currentState.enviados + 1,
            log: [...currentState.log, logEntry],
            ok: currentState.ok + (logEntry.status === 'ok' ? 1 : 0),
            duplicados: currentState.duplicados + (logEntry.status === 'duplicado' ? 1 : 0),
            pendientes: currentState.pendientes + (logEntry.status === 'pendiente' ? 1 : 0),
            errores: currentState.errores + (logEntry.status === 'error' ? 1 : 0),
          })
        }

        if (i < files.length - 1) await new Promise(r => setTimeout(r, 1500))
      }

      if (currentState) setState({ ...currentState, procesando: false })
    },
    cerrar: () => setState(null),
    ocultar: () => { if (currentState) setState({ ...currentState, visible: false }) },
  }
}
