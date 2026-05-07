// ocrUploadStore v10 — detecta errores críticos (créditos, API key, modelo) y los marca como ACHTUNG
// Sesiones múltiples, persiste en localStorage, sobrevive F5

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface ArchivoLog {
  filename: string
  status: 'ok' | 'duplicado' | 'pendiente' | 'error' | 'achtung'
  detalle: string
  achtungTipo?: 'creditos' | 'api_key' | 'modelo' | 'otro'
}

export interface OcrSession {
  id: string
  total: number
  enviados: number
  ok: number
  pendientes: number
  duplicados: number
  errores: number
  achtung: number
  achtungMensaje: string | null
  achtungTipo: 'creditos' | 'api_key' | 'modelo' | 'otro' | null
  log: ArchivoLog[]
  visible: boolean
  procesando: boolean
  fnName: 'ocr-procesar-factura' | 'ocr-procesar-extracto' | null
  titular_id: string | null
  archivosPendientes: { name: string; type: string; base64: string }[]
  creadoEn: number
  completadoEn: number | null
}

const STORAGE_KEY = 'ocr_sessions_v2'
const TTL_COMPLETADO_MS = 5 * 60 * 1000
const emitter = new EventTarget()

function loadSessions(): OcrSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const sessions: OcrSession[] = JSON.parse(raw)
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    return sessions
      .filter(s => s.creadoEn > cutoff && s.visible)
      .map(s => ({
        ...s,
        completadoEn: s.completadoEn ?? null,
        achtung: s.achtung ?? 0,
        achtungMensaje: s.achtungMensaje ?? null,
        achtungTipo: s.achtungTipo ?? null,
      }))
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

  setInterval(() => {
    const ahora = Date.now()
    let cambio = false
    sessions = sessions.map(s => {
      if (!s.procesando && s.completadoEn && (ahora - s.completadoEn) > TTL_COMPLETADO_MS && s.visible) {
        // No auto-ocultar si hay achtung activo
        if (s.achtung > 0) return s
        cambio = true
        return { ...s, visible: false }
      }
      return s
    })
    if (cambio) emit()
  }, 30000)
}

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

// Detecta errores críticos del API de Anthropic
function detectarAchtung(detalle: string): { tipo: 'creditos' | 'api_key' | 'modelo' | 'otro'; mensaje: string } | null {
  const txt = detalle.toLowerCase()
  if (txt.includes('credit balance is too low') || txt.includes('credit balance')) {
    return { tipo: 'creditos', mensaje: 'SIN CRÉDITOS ANTHROPIC · Ve a console.anthropic.com/settings/billing y recarga' }
  }
  if (txt.includes('invalid x-api-key') || txt.includes('authentication_error') || (txt.includes('401') && txt.includes('anthropic'))) {
    return { tipo: 'api_key', mensaje: 'API KEY ANTHROPIC INVÁLIDA · Renueva la key en Vercel → Environment Variables' }
  }
  if (txt.includes('not_found_error') && txt.includes('model')) {
    return { tipo: 'modelo', mensaje: 'MODELO CLAUDE NO DISPONIBLE · Avisa en este chat para actualizar' }
  }
  if (txt.includes('ocr falló') && (txt.includes('429') || txt.includes('rate_limit'))) {
    return { tipo: 'otro', mensaje: 'LÍMITE DE PETICIONES · Espera 1 min y vuelve a probar' }
  }
  return null
}

// Procesar via /api/facturas?action=upload (Vercel) — facturas
async function procesarFactura(item: { name: string; type: string; base64: string }): Promise<ArchivoLog> {
  try {
    const res = await fetch('/api/facturas?action=upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: item.name,
        base64: item.base64,
        mimeType: item.type,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      const detalle = `HTTP ${res.status}: ${data?.error || 'sin detalle'}`
      const ach = detectarAchtung(detalle)
      if (ach) return { filename: item.name, status: 'achtung', detalle, achtungTipo: ach.tipo }
      return { filename: item.name, status: 'error', detalle }
    }
    if (data?.error) {
      const ach = detectarAchtung(data.error)
      if (ach) return { filename: item.name, status: 'achtung', detalle: data.error, achtungTipo: ach.tipo }
      return { filename: item.name, status: 'error', detalle: data.error }
    }
    if (data?.estado === 'duplicada') {
      return { filename: item.name, status: 'duplicado', detalle: data.motivo || 'Ya existía' }
    }
    if (data?.estado === 'error') {
      const det = data.error || 'Error procesando'
      const ach = detectarAchtung(det)
      if (ach) return { filename: item.name, status: 'achtung', detalle: det, achtungTipo: ach.tipo }
      return { filename: item.name, status: 'error', detalle: det }
    }
    if (data?.estado === 'ok') {
      const fact = data.factura
      const estado = fact?.estado || 'asociada'
      if (estado === 'asociada') return { filename: item.name, status: 'ok', detalle: fact?.mensaje_matching || 'Conciliada' }
      if (estado === 'solo_drive') return { filename: item.name, status: 'ok', detalle: 'Solo Drive (no requiere match)' }
      if (estado === 'pendiente_revision') return { filename: item.name, status: 'pendiente', detalle: fact?.mensaje_matching || 'Pendiente revisión' }
      if (estado === 'sin_match') return { filename: item.name, status: 'pendiente', detalle: 'Sin movimiento bancario' }
      if (estado === 'pendiente_titular_manual') return { filename: item.name, status: 'pendiente', detalle: 'Falta titular manual' }
      return { filename: item.name, status: 'pendiente', detalle: estado }
    }
    if (data?.estado === 'multi') {
      const ok = data.resultados?.filter((r: any) => r.estado === 'ok').length || 0
      const err = data.resultados?.filter((r: any) => r.estado === 'error').length || 0
      return { filename: item.name, status: ok > 0 ? 'ok' : 'error', detalle: `${ok} ok · ${err} error` }
    }
    return { filename: item.name, status: 'error', detalle: 'Respuesta inesperada' }
  } catch (err) {
    return { filename: item.name, status: 'error', detalle: err instanceof Error ? err.message : String(err) }
  }
}

// Extractos siguen yendo a Supabase Edge Function (no se ha tocado esa)
async function procesarExtracto(
  item: { name: string; type: string; base64: string },
  titular_id: string | null
): Promise<ArchivoLog> {
  try {
    let body: Record<string, unknown>
    if (esTextoPlano(item.name, item.type)) {
      const texto = atob(item.base64)
      body = { fileTexto: texto, filename: item.name, mimeType: item.type }
    } else {
      body = { fileBase64: item.base64, filename: item.name, mimeType: item.type }
    }
    if (titular_id) body.titular_id = titular_id

    const { data, error } = await supabase.functions.invoke('ocr-procesar-extracto', { body })
    if (error) return { filename: item.name, status: 'error', detalle: `Error: ${error.message || JSON.stringify(error)}` }
    if (data?.error) return { filename: item.name, status: 'error', detalle: data.error }
    if (data?.status === 'ok') {
      return { filename: item.name, status: 'ok', detalle: `${data.insertados||0} nuevos · ${data.saltados||0} ya existían · ${data.categorizados_auto||0} categ.` }
    }
    return { filename: item.name, status: 'error', detalle: 'Respuesta inesperada' }
  } catch (err) {
    return { filename: item.name, status: 'error', detalle: err instanceof Error ? err.message : String(err) }
  }
}

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

    let logEntry: ArchivoLog
    if (s.fnName === 'ocr-procesar-factura') {
      logEntry = await procesarFactura(item)
    } else if (s.fnName === 'ocr-procesar-extracto') {
      logEntry = await procesarExtracto(item, s.titular_id)
    } else {
      logEntry = { filename: item.name, status: 'error', detalle: 'Función desconocida' }
    }

    const cur = getSession()
    if (!cur) break

    // Si es achtung, abortar resto de archivos pendientes (no tiene sentido seguir)
    const esAchtung = logEntry.status === 'achtung'
    const patch: Partial<OcrSession> = {
      enviados: cur.enviados + 1,
      log: [...cur.log, logEntry],
      ok: cur.ok + (logEntry.status === 'ok' ? 1 : 0),
      duplicados: cur.duplicados + (logEntry.status === 'duplicado' ? 1 : 0),
      pendientes: cur.pendientes + (logEntry.status === 'pendiente' ? 1 : 0),
      errores: cur.errores + (logEntry.status === 'error' ? 1 : 0),
      achtung: cur.achtung + (esAchtung ? 1 : 0),
    }
    if (esAchtung && !cur.achtungMensaje) {
      const ach = detectarAchtung(logEntry.detalle)
      if (ach) {
        patch.achtungMensaje = ach.mensaje
        patch.achtungTipo = ach.tipo
      }
      // Abortar: vaciar pendientes y marcar todos como error con mismo detalle
      patch.archivosPendientes = []
      patch.procesando = false
    }
    updateSession(sessionId, patch)

    if (esAchtung) break
    await new Promise(r => setTimeout(r, 800))
  }
}

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
    reanudarSesionsPendientes()
    return () => emitter.removeEventListener('change', handler)
  }, [])

  async function procesar(
    files: File[],
    fnName: 'ocr-procesar-factura' | 'ocr-procesar-extracto',
    titular_id: string | null
  ) {
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
      achtung: 0, achtungMensaje: null, achtungTipo: null,
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
