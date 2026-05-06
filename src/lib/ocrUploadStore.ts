// ocrUploadStore v8 — múltiples sesiones simultáneas, persiste en localStorage, sobrevive F5
// Cada lote tiene su propio ID. Los toasts se apilan. El proceso continúa tras F5.
// TTL: cuando una sesión completa (procesando=false) pasa 5 minutos, se auto-oculta.

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface ArchivoLog {
  filename: string
  status: 'ok' | 'duplicado' | 'pendiente' | 'error'
  detalle: string
}

export interface OcrSession {
  id: string
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
  titular_id: string | null
  // Archivos pendientes de procesar (serializados como nombre+tipo para reanudar)
  archivosPendientes: { name: string; type: string; base64: string }[]
  creadoEn: number
  // Timestamp de cuando completó la sesión (procesando=false). Se usa para TTL auto-cierre.
  completadoEn: number | null
}

const STORAGE_KEY = 'ocr_sessions_v2'
const TTL_COMPLETADO_MS = 5 * 60 * 1000 // 5 min tras completar
const emitter = new EventTarget()

function loadSessions(): OcrSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const sessions: OcrSession[] = JSON.parse(raw)
    // Limpiar sesiones muy viejas (>24h) o que no estaban procesando
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    return sessions
      .filter(s => s.creadoEn > cutoff && s.visible)
      .map(s => ({ ...s, completadoEn: s.completadoEn ?? null }))
  } catch { return [] }
}

let sessions: OcrSession[] = loadSessions()

function persistSessions() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)) } catch {}
}

function emit() {
  persistSessions()
  emitter.dispatchEvent(new CustomEvent('change'))
}

function updateSession(id: string, patch: Partial<OcrSession>) {
  sessions = sessions.map(s => {
    if (s.id !== id) return s
    const next = { ...s, ...patch }
    // Si pasa a no procesando, marcar timestamp para TTL
    if (s.procesando && next.procesando === false && next.completadoEn == null) {
      next.completadoEn = Date.now()
    }
    return next
  })
  emit()
}

function removeSession(id: string) {
  sessions = sessions.filter(s => s.id !== id)
  emit()
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key === STORAGE_KEY) {
      try { sessions = e.newValue ? JSON.parse(e.newValue) : [] } catch { sessions = [] }
      emitter.dispatchEvent(new CustomEvent('change'))
    }
  })

  // Watcher TTL: cada 30s revisa sesiones completadas y oculta las que pasen 5 min
  setInterval(() => {
    const ahora = Date.now()
    let cambio = false
    sessions = sessions.map(s => {
      if (!s.procesando && s.completadoEn && (ahora - s.completadoEn) > TTL_COMPLETADO_MS && s.visible) {
        cambio = true
        return { ...s, visible: false }
      }
      return s
    })
    if (cambio) emit()
  }, 30000)
}

// Helpers de archivo
function getExt(name: string) { return name.split('.').pop()?.toLowerCase() ?? '' }
function esTextoPlano(name: string, type: string) {
  const ext = getExt(name)
  return ext === 'csv' || ext === 'txt' || type === 'text/csv' || type === 'text/plain'
}
function esExcel(name: string) { const ext = getExt(name); return ext === 'xlsx' || ext === 'xls' }

function getMimeType(file: File): string {
  if (file.type && file.type !== 'application/octet-stream') return file.type
  const map: Record<string, string> = {
    csv: 'text/csv', txt: 'text/csv', pdf: 'application/pdf', png: 'image/png',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
  }
  return map[getExt(file.name)] ?? 'application/pdf'
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
    s.onload = () => res(); s.onerror = () => rej(new Error('No se pudo cargar SheetJS'))
    document.head.appendChild(s)
  })
  return (window as any).XLSX
}
async function excelACSV(file: File): Promise<string> {
  const XLSX = await cargarSheetJS()
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const ref = ws['!ref']
  if (ref) {
    const range = XLSX.utils.decode_range(ref)
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C })
        const cell = ws[addr]
        if (!cell) continue
        if (cell.t === 'd' && cell.v instanceof Date) {
          const d = cell.v as Date
          cell.t = 's'
          cell.v = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
          cell.w = cell.v
        }
      }
    }
  }
  return XLSX.utils.sheet_to_csv(ws, { FS: ';', blankrows: false })
}

// Procesar un archivo ya serializado (base64 + metadata)
async function procesarArchivo(
  sessionId: string,
  item: { name: string; type: string; base64: string },
  fnName: 'ocr-procesar-factura' | 'ocr-procesar-extracto',
  titular_id: string | null
): Promise<ArchivoLog> {
  try {
    let body: Record<string, unknown>
    const mimeType = item.type

    if (esTextoPlano(item.name, item.type)) {
      // base64 → texto
      const texto = atob(item.base64)
      body = { fileTexto: texto, filename: item.name, mimeType }
    } else {
      body = { fileBase64: item.base64, filename: item.name, mimeType }
    }

    if (fnName === 'ocr-procesar-extracto' && titular_id) body.titular_id = titular_id

    const { data, error } = await supabase.functions.invoke(fnName, { body })

    if (error) return { filename: item.name, status: 'error', detalle: `Error: ${error.message || JSON.stringify(error)}` }
    if (data?.error) return { filename: item.name, status: 'error', detalle: `${data.error}${data.detail ? ': ' + String(data.detail).slice(0, 200) : ''}` }
    if (data?.status === 'duplicado') return { filename: item.name, status: 'duplicado', detalle: 'Ya existía en la BD' }
    if (data?.status === 'ok') {
      if (fnName === 'ocr-procesar-extracto') {
        return { filename: item.name, status: 'ok', detalle: `${data.insertados||0} nuevos · ${data.saltados||0} ya existían · ${data.categorizados_auto||0} categ.` }
      }
      if (data?.matched && !data?.sin_categoria && !data?.sin_titular) {
        return { filename: item.name, status: 'ok', detalle: 'Conciliada' }
      }
      const motivos: string[] = []
      if (!data.matched) motivos.push('sin mov. bancario')
      if (data.sin_categoria) motivos.push('sin categoría')
      if (data.sin_titular) motivos.push('sin titular')
      return { filename: item.name, status: 'pendiente', detalle: `Subida — falta: ${motivos.join(', ')}` }
    }
    return { filename: item.name, status: 'error', detalle: 'Respuesta inesperada' }
  } catch (err) {
    return { filename: item.name, status: 'error', detalle: err instanceof Error ? err.message : String(err) }
  }
}

// Loop de procesamiento — reanudable tras F5
async function runSession(sessionId: string) {
  const getSession = () => sessions.find(s => s.id === sessionId)

  while (true) {
    const s = getSession()
    if (!s || !s.procesando) break
    if (s.archivosPendientes.length === 0) {
      updateSession(sessionId, { procesando: false })
      break
    }

    const [item, ...resto] = s.archivosPendientes
    updateSession(sessionId, { archivosPendientes: resto })

    const logEntry = await procesarArchivo(sessionId, item, s.fnName!, s.titular_id)

    const cur = getSession()
    if (!cur) break
    updateSession(sessionId, {
      enviados: cur.enviados + 1,
      log: [...cur.log, logEntry],
      ok: cur.ok + (logEntry.status === 'ok' ? 1 : 0),
      duplicados: cur.duplicados + (logEntry.status === 'duplicado' ? 1 : 0),
      pendientes: cur.pendientes + (logEntry.status === 'pendiente' ? 1 : 0),
      errores: cur.errores + (logEntry.status === 'error' ? 1 : 0),
    })

    // Pequeña pausa entre archivos para no saturar
    await new Promise(r => setTimeout(r, 800))
  }
}

// Al arrancar: reanudar sesiones que estaban en curso
export function reanudarSesionsPendientes() {
  for (const s of sessions) {
    if (s.procesando && s.archivosPendientes.length > 0) {
      runSession(s.id)
    }
  }
}

export function useOcrUpload() {
  const [snap, setSnap] = useState<OcrSession[]>([...sessions])

  useEffect(() => {
    const handler = () => setSnap([...sessions])
    emitter.addEventListener('change', handler)
    // Reanudar sesiones pendientes al montar
    reanudarSesionsPendientes()
    return () => emitter.removeEventListener('change', handler)
  }, [])

  async function procesar(
    files: File[],
    fnName: 'ocr-procesar-factura' | 'ocr-procesar-extracto',
    titular_id: string | null
  ) {
    // Serializar archivos a base64 ANTES de guardar (para sobrevivir F5)
    const archivosSerial: { name: string; type: string; base64: string }[] = []
    for (const file of files) {
      let base64: string
      if (esExcel(file.name)) {
        const csvTexto = await excelACSV(file)
        base64 = btoa(unescape(encodeURIComponent(csvTexto)))
        archivosSerial.push({ name: file.name.replace(/\.(xlsx|xls)$/i, '.csv'), type: 'text/csv', base64 })
      } else if (esTextoPlano(file.name, file.type)) {
        const texto = await leerTexto(file)
        base64 = btoa(unescape(encodeURIComponent(texto)))
        archivosSerial.push({ name: file.name, type: 'text/csv', base64 })
      } else {
        base64 = await leerBase64(file)
        archivosSerial.push({ name: file.name, type: getMimeType(file), base64 })
      }
    }

    const newSession: OcrSession = {
      id: `ocr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      total: files.length,
      enviados: 0, ok: 0, pendientes: 0, duplicados: 0, errores: 0,
      log: [], visible: true, procesando: true,
      fnName, titular_id,
      archivosPendientes: archivosSerial,
      creadoEn: Date.now(),
      completadoEn: null,
    }

    sessions = [...sessions, newSession]
    emit()
    runSession(newSession.id)
  }

  function cerrar(id: string) { removeSession(id) }
  function ocultar(id: string) { updateSession(id, { visible: false }) }

  return { sessions: snap, procesar, cerrar, ocultar }
}
