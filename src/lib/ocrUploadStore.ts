// ocrUploadStore v17 — Storage-first + resume interrumpida (no duplicar, no reempezar)
// Cola estricta + cancelar inmediato + auto-cerrar 20s + localStorage + BBDD background
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface ArchivoLog {
  filename: string
  status: 'ok' | 'duplicado' | 'pendiente' | 'error' | 'achtung' | 'cancelado'
  detalle: string
  achtungTipo?: 'creditos' | 'api_key' | 'modelo' | 'otro'
}

export interface OcrSession {
  id: string
  grupoId: string           // = id; carpeta en ocr-uploads/{grupoId}/
  storagePaths: string[]    // filenames subidos al bucket con éxito
  total: number
  enviados: number
  ok: number
  pendientes: number
  duplicados: number
  errores: number
  achtung: number
  cancelados: number
  achtungMensaje: string | null
  achtungTipo: 'creditos' | 'api_key' | 'modelo' | 'otro' | null
  log: ArchivoLog[]
  visible: boolean
  procesando: boolean
  cancelado: boolean
  fnName: 'ocr-procesar-factura' | 'ocr-procesar-extracto' | null
  titular_id: string | null
  archivosPendientes: { name: string; type: string; base64: string }[]
  creadoEn: number
  completadoEn: number | null
  orden: number
  dbJobId?: string
  interrumpida?: boolean
}

const STORAGE_KEY = 'ocr_sessions_v4'
const BUCKET = 'ocr-uploads'
const PAUSA_MS = 1500
const RATE_LIMIT_BACKOFF_MS = 65000
const MAX_REINTENTOS = 3
const AUTO_CERRAR_MS = 20000

const emitter = new EventTarget()

function loadSessions(): OcrSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr: OcrSession[] = JSON.parse(raw)
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    return arr
      .filter(s => s.creadoEn > cutoff && s.visible)
      .map((s, i) => ({
        ...s,
        grupoId: s.grupoId || s.id,
        storagePaths: s.storagePaths || [],
        completadoEn: s.completadoEn ?? null,
        achtung: s.achtung ?? 0,
        cancelados: s.cancelados ?? 0,
        achtungMensaje: s.achtungMensaje ?? null,
        achtungTipo: s.achtungTipo ?? null,
        cancelado: s.cancelado ?? false,
        orden: s.orden ?? i,
        interrumpida: s.interrumpida ?? false,
      }))
  } catch { return [] }
}

let sessions: OcrSession[] = loadSessions()
let procesandoActualId: string | null = null
const cancelacionesActivas = new Set<string>()
const autoCerrarTimers = new Map<string, number>()
let ordenCounter = sessions.reduce((m, s) => Math.max(m, s.orden ?? 0), 0)

function persist() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)) } catch {} }
function emit() { persist(); emitter.dispatchEvent(new CustomEvent('change')) }

function programarAutoCierre(id: string) {
  const t = autoCerrarTimers.get(id)
  if (t) clearTimeout(t)
  const timerId = window.setTimeout(() => {
    sessions = sessions.filter(s => s.id !== id)
    autoCerrarTimers.delete(id)
    emit()
  }, AUTO_CERRAR_MS)
  autoCerrarTimers.set(id, timerId)
}

function updateSession(id: string, patch: Partial<OcrSession>) {
  sessions = sessions.map(s => {
    if (s.id !== id) return s
    const next = { ...s, ...patch }
    if (s.procesando && next.procesando === false && next.completadoEn == null) next.completadoEn = Date.now()
    return next
  })
  emit()
  const ses = sessions.find(s => s.id === id)
  if (ses && !ses.procesando) programarAutoCierre(id)
}

function removeSession(id: string) {
  sessions = sessions.filter(s => s.id !== id)
  cancelacionesActivas.delete(id)
  const t = autoCerrarTimers.get(id); if (t) { clearTimeout(t); autoCerrarTimers.delete(id) }
  if (procesandoActualId === id) procesandoActualId = null
  emit()
  arrancarSiguienteEnCola()
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key === STORAGE_KEY) {
      try { sessions = e.newValue ? JSON.parse(e.newValue) : [] } catch { sessions = [] }
      emitter.dispatchEvent(new CustomEvent('change'))
    }
  })
}

// ========== BBDD sync (solo escritura, nunca lectura) ==========
const RUBEN_ID_DEFAULT = '6ce69d55-60d0-423c-b68b-eb795a0f32fe'

async function crearJobEnDB(tipo: string, total: number, titularId: string | null): Promise<string | null> {
  try {
    const { data, error } = await supabase.from('ocr_jobs').insert({
      tipo: tipo === 'ocr-procesar-factura' ? 'factura' : 'extracto',
      estado: 'procesando',
      archivos_total: total,
      titular_id: titularId || RUBEN_ID_DEFAULT,
    }).select('id').single()
    return error ? null : data?.id || null
  } catch { return null }
}

async function actualizarJobDB(jobId: string, patch: Record<string, unknown>) {
  try { await supabase.from('ocr_jobs').update(patch).eq('id', jobId) } catch {}
}

async function completarJobDB(jobId: string, ok: number, errores: number) {
  try {
    await supabase.from('ocr_jobs').update({
      estado: errores > 0 && ok === 0 ? 'error' : 'completado',
      archivos_procesados: ok,
      archivos_error: errores,
      completed_at: new Date().toISOString(),
    }).eq('id', jobId)
  } catch {}
}

async function cancelarJobDB(jobId: string) {
  try {
    await supabase.from('ocr_jobs').update({
      estado: 'cancelado',
      completed_at: new Date().toISOString(),
    }).eq('id', jobId)
  } catch {}
}

// ========== Storage helpers ==========

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64)
  const array = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i)
  return new Blob([array], { type: mimeType })
}

async function uploadArchivoAlStorage(grupoId: string, item: { name: string; type: string; base64: string }): Promise<boolean> {
  try {
    const blob = base64ToBlob(item.base64, item.type)
    const path = `${grupoId}/${item.name}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType: item.type,
      upsert: true,
    })
    return !error
  } catch { return false }
}

async function downloadFromStorage(grupoId: string, filename: string): Promise<{ base64: string; type: string } | null> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(`${grupoId}/${filename}`)
    if (error || !data) return null
    return new Promise(res => {
      const r = new FileReader()
      r.onload = () => {
        const result = r.result as string
        const comma = result.indexOf(',')
        const base64 = comma >= 0 ? result.slice(comma + 1) : result
        res({ base64, type: data.type || 'application/pdf' })
      }
      r.onerror = () => res(null)
      r.readAsDataURL(data)
    })
  } catch { return null }
}

// ========== Helpers de archivos ==========

function getExt(name: string) { return name.split('.').pop()?.toLowerCase() ?? '' }
function esTextoPlano(name: string, type: string) {
  const ext = getExt(name); return ext === 'csv' || ext === 'txt' || type === 'text/csv' || type === 'text/plain'
}
function esExcel(name: string) { const ext = getExt(name); return ext === 'xlsx' || ext === 'xls' }
function getMimeType(file: File): string {
  if (file.type && file.type !== 'application/octet-stream') return file.type
  const map: Record<string, string> = {
    csv: 'text/csv', txt: 'text/csv', pdf: 'application/pdf', png: 'image/png',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel',
  }
  return map[getExt(file.name)] ?? 'application/pdf'
}
function leerBase64(file: File): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res((r.result as string).split(',')[1]); r.onerror = () => rej(new Error('Error leyendo')); r.readAsDataURL(file) })
}
function leerTexto(file: File): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = () => rej(new Error('Error texto')); r.readAsText(file, 'UTF-8') })
}
async function cargarSheetJS(): Promise<any> {
  if ((window as any).XLSX) return (window as any).XLSX
  await new Promise<void>((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = () => res(); s.onerror = () => rej(new Error('SheetJS')); document.head.appendChild(s) })
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
        const addr = XLSX.utils.encode_cell({ r: R, c: C }); const cell = ws[addr]; if (!cell) continue
        if (cell.t === 'd' && cell.v instanceof Date) {
          const d = cell.v as Date; cell.t = 's'
          cell.v = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
          cell.w = cell.v
        }
      }
    }
  }
  return XLSX.utils.sheet_to_csv(ws, { FS: ';', blankrows: false })
}

function esRateLimit(d: string): boolean { const t = d.toLowerCase(); return t.includes('429') || t.includes('rate_limit') || t.includes('rate limit') }
function detectarAchtung(d: string) {
  const t = d.toLowerCase()
  if (t.includes('credit balance')) return { tipo: 'creditos' as const, mensaje: 'SIN CRÉDITOS ANTHROPIC' }
  if (t.includes('invalid x-api-key') || t.includes('authentication_error')) return { tipo: 'api_key' as const, mensaje: 'API KEY ANTHROPIC INVÁLIDA' }
  if (t.includes('not_found_error') && t.includes('model')) return { tipo: 'modelo' as const, mensaje: 'MODELO CLAUDE NO DISPONIBLE' }
  return null
}

async function invocarOCR(item: { name: string; type: string; base64: string }, fnName: string, titular_id: string | null) {
  const body: any = fnName === 'ocr-procesar-factura'
    ? { fileBase64: item.base64, filename: item.name, mimeType: item.type }
    : { fileBase64: item.base64, filename: item.name, mimeType: item.type, ...(titular_id ? { titular_id } : {}) }
  const { data, error } = await supabase.functions.invoke(fnName, { body })
  if (error) {
    const msg = (error as any).message || String(error)
    return { status: 'error', detalle: msg }
  }
  if (data?.status === 'duplicado') return { status: 'duplicado', detalle: 'Ya existía' }
  if (data?.status === 'ok') {
    if (fnName === 'ocr-procesar-factura') {
      return data.matched ? { status: 'ok', detalle: 'Conciliada' } : (data.drive_uploaded ? { status: 'ok', detalle: 'Solo Drive' } : { status: 'pendiente', detalle: 'Pendiente' })
    }
    return { status: 'ok', detalle: `${data.insertados||0} nuevos · ${data.saltados||0} ya existían` }
  }
  if (data?.error) {
    const ach = detectarAchtung(data.error)
    if (ach) return { status: 'achtung', detalle: data.error, achtungTipo: ach.tipo, achtungMensaje: ach.mensaje }
    return { status: 'error', detalle: data.error }
  }
  return { status: 'error', detalle: 'Respuesta inesperada' }
}

// ========== Worker principal ==========

async function runSession(id: string) {
  if (procesandoActualId !== null && procesandoActualId !== id) return
  procesandoActualId = id

  try {
    while (true) {
      const ses = sessions.find(s => s.id === id)
      if (!ses) break

      if (cancelacionesActivas.has(id)) {
        const sesCan = sessions.find(s => s.id === id)
        if (sesCan?.dbJobId) cancelarJobDB(sesCan.dbJobId)
        sessions = sessions.filter(s => s.id !== id)
        cancelacionesActivas.delete(id)
        emit()
        break
      }

      if (ses.archivosPendientes.length === 0) {
        updateSession(id, { procesando: false })
        const sesEnd = sessions.find(x => x.id === id)
        if (sesEnd?.dbJobId) completarJobDB(sesEnd.dbJobId, sesEnd.ok + sesEnd.duplicados + sesEnd.pendientes, sesEnd.errores)
        break
      }

      const [item, ...resto] = ses.archivosPendientes

      // 1. Subir al Storage ANTES de encolar (permite detectar interrupciones)
      const subido = await uploadArchivoAlStorage(ses.grupoId, item)
      if (subido) {
        const sesNowStorage = sessions.find(s => s.id === id)
        if (sesNowStorage) {
          updateSession(id, {
            storagePaths: [...sesNowStorage.storagePaths, item.name],
          })
        }
      }

      // 2. Desencolar del array de pendientes
      updateSession(id, { archivosPendientes: resto })

      if (cancelacionesActivas.has(id)) {
        sessions = sessions.filter(s => s.id !== id)
        cancelacionesActivas.delete(id)
        emit()
        break
      }

      // 3. Invocar OCR con reintentos
      let result: any = null
      for (let intento = 0; intento <= MAX_REINTENTOS; intento++) {
        if (cancelacionesActivas.has(id)) break
        try {
          result = await invocarOCR(item, ses.fnName!, ses.titular_id)
          if (result.status === 'error' && esRateLimit(result.detalle) && intento < MAX_REINTENTOS) {
            await new Promise(r => setTimeout(r, RATE_LIMIT_BACKOFF_MS))
            continue
          }
          break
        } catch (e: any) {
          result = { status: 'error', detalle: e?.message || String(e) }
          break
        }
      }

      if (cancelacionesActivas.has(id)) {
        sessions = sessions.filter(s => s.id !== id)
        cancelacionesActivas.delete(id)
        emit()
        break
      }

      const entry: ArchivoLog = { filename: item.name, status: result.status, detalle: result.detalle, achtungTipo: result.achtungTipo }
      const sesNow = sessions.find(s => s.id === id)
      if (!sesNow) break

      const patch: Partial<OcrSession> = {
        log: [...sesNow.log, entry],
        enviados: sesNow.enviados + 1,
        ok: sesNow.ok + (entry.status === 'ok' ? 1 : 0),
        duplicados: sesNow.duplicados + (entry.status === 'duplicado' ? 1 : 0),
        pendientes: sesNow.pendientes + (entry.status === 'pendiente' ? 1 : 0),
        errores: sesNow.errores + (entry.status === 'error' ? 1 : 0),
        achtung: sesNow.achtung + (entry.status === 'achtung' ? 1 : 0),
      }

      if (entry.status === 'achtung' && !sesNow.achtungMensaje) {
        patch.achtungMensaje = result.achtungMensaje
        patch.achtungTipo = result.achtungTipo
        patch.archivosPendientes = []
        patch.procesando = false
      }

      updateSession(id, patch)

      const sesSync = sessions.find(x => x.id === id)
      if (sesSync?.dbJobId) {
        actualizarJobDB(sesSync.dbJobId, {
          archivos_procesados: sesSync.ok + sesSync.duplicados + sesSync.pendientes,
          archivos_error: sesSync.errores,
          archivo_actual: item.name,
        })
      }

      if (entry.status === 'achtung') break

      await new Promise(r => setTimeout(r, PAUSA_MS))
    }
  } finally {
    if (procesandoActualId === id) procesandoActualId = null
    arrancarSiguienteEnCola()
  }
}

function arrancarSiguienteEnCola() {
  if (procesandoActualId !== null) return
  const cola = sessions
    .filter(s => s.procesando && s.archivosPendientes.length > 0 && !cancelacionesActivas.has(s.id))
    .sort((a, b) => a.orden - b.orden)
  if (cola.length > 0) runSession(cola[0].id)
}

// ========== Detección y reanudación de sesiones interrumpidas ==========
// Sesión interrumpida: procesando=true en localStorage pero ningún worker activo.
// Puede haber archivos en el bucket que fueron subidos pero cuyo OCR no completó.

async function detectarYReanudarInterrumpidas() {
  // Las sesiones con procesando:true que no están ya corriendo
  const candidatas = sessions.filter(
    s => s.procesando && s.grupoId && procesandoActualId !== s.id
  )
  if (candidatas.length === 0) return

  for (const ses of candidatas) {
    // Archivos ya procesados (en log)
    const procesados = new Set(ses.log.map(l => l.filename))
    // Archivos aún en cola (tienen base64)
    const enCola = new Set(ses.archivosPendientes.map(a => a.name))

    // Listar lo que llegó al bucket
    let storageNames: string[] = []
    try {
      const { data } = await supabase.storage.from(BUCKET).list(ses.grupoId)
      storageNames = (data || []).map(f => f.name)
    } catch { /* sin Storage → resume clásico desde archivosPendientes */ }

    // Archivos que llegaron al bucket pero no están en el log ni en la cola
    // → se desencolaron pero el OCR no completó
    const perdidosEnStorage = storageNames.filter(
      name => !procesados.has(name) && !enCola.has(name)
    )

    if (perdidosEnStorage.length === 0) continue

    const reconstruidos: { name: string; type: string; base64: string }[] = []
    const noRecuperados: string[] = []

    for (const filename of perdidosEnStorage) {
      const dl = await downloadFromStorage(ses.grupoId, filename)
      if (dl) {
        reconstruidos.push({ name: filename, type: dl.type, base64: dl.base64 })
      } else {
        noRecuperados.push(filename)
      }
    }

    const logExtra: ArchivoLog[] = noRecuperados.map(name => ({
      filename: name,
      status: 'error' as const,
      detalle: 'No recuperado — volver a arrastrar',
    }))

    const sesActual = sessions.find(s => s.id === ses.id)
    if (!sesActual) continue

    updateSession(ses.id, {
      archivosPendientes: [...reconstruidos, ...sesActual.archivosPendientes],
      log: [...sesActual.log, ...logExtra],
      errores: sesActual.errores + noRecuperados.length,
      interrumpida: false,
    })
  }

  // Arrancar lo que haya quedado listo
  arrancarSiguienteEnCola()
}

// Al cargar: primero intenta arrancar lo que tiene base64, luego recupera del Storage
if (typeof window !== 'undefined') {
  arrancarSiguienteEnCola()
  detectarYReanudarInterrumpidas()
}

// ========== Hook público ==========

export function useOcrUpload() {
  const [snap, setSnap] = useState<OcrSession[]>([...sessions])
  const initRef = useRef(false)

  useEffect(() => {
    const handler = () => setSnap([...sessions])
    emitter.addEventListener('change', handler)
    if (!initRef.current) {
      initRef.current = true
      arrancarSiguienteEnCola()
      detectarYReanudarInterrumpidas()
    }
    return () => emitter.removeEventListener('change', handler)
  }, [])

  async function procesar(files: File[], fnName: 'ocr-procesar-factura' | 'ocr-procesar-extracto', titular_id: string | null) {
    const archivos: { name: string; type: string; base64: string }[] = []
    const fallos: ArchivoLog[] = []
    for (const file of files) {
      try {
        if (esExcel(file.name)) {
          const csv = await excelACSV(file)
          archivos.push({ name: file.name.replace(/\.(xlsx|xls)$/i, '.csv'), type: 'text/csv', base64: btoa(unescape(encodeURIComponent(csv))) })
        } else if (esTextoPlano(file.name, file.type)) {
          const t = await leerTexto(file)
          archivos.push({ name: file.name, type: 'text/csv', base64: btoa(unescape(encodeURIComponent(t))) })
        } else {
          archivos.push({ name: file.name, type: getMimeType(file), base64: await leerBase64(file) })
        }
      } catch (e: any) {
        fallos.push({ filename: file.name, status: 'error', detalle: `Error leyendo: ${e?.message || e}` })
      }
    }

    const dbJobId = await crearJobEnDB(fnName, files.length, titular_id)

    ordenCounter++
    const nuevoId = `ocr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const nueva: OcrSession = {
      id: nuevoId,
      grupoId: nuevoId,
      storagePaths: [],
      total: files.length, enviados: fallos.length, ok: 0, pendientes: 0, duplicados: 0,
      errores: fallos.length, achtung: 0, cancelados: 0,
      achtungMensaje: null, achtungTipo: null,
      log: fallos, visible: true, procesando: true, cancelado: false,
      fnName, titular_id, archivosPendientes: archivos,
      creadoEn: Date.now(), completadoEn: null,
      orden: ordenCounter,
      dbJobId: dbJobId || undefined,
      interrumpida: false,
    }
    sessions = [...sessions, nueva]
    emit()
    arrancarSiguienteEnCola()
  }

  function cancelar(id: string) {
    cancelacionesActivas.add(id)
    if (procesandoActualId !== id) {
      const ses = sessions.find(s => s.id === id)
      if (ses?.dbJobId) cancelarJobDB(ses.dbJobId)
      sessions = sessions.filter(s => s.id !== id)
      cancelacionesActivas.delete(id)
      emit()
      arrancarSiguienteEnCola()
    }
  }

  function cerrar(id: string) { removeSession(id) }
  function ocultar(id: string) { updateSession(id, { visible: false }) }

  return { sessions: snap, procesar, cancelar, cerrar, ocultar }
}
