// ocrUploadStore v18 — fix toasts zombi al F5 + persistencia cross-device por BBDD
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
  remoto?: boolean
}

const STORAGE_KEY = 'ocr_sessions_v4'
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
      .filter(s => s.creadoEn > cutoff && s.visible && s.procesando) // solo procesando — cancelados/completados NO sobreviven al F5
      .map((s, i) => ({
        ...s,
        completadoEn: s.completadoEn ?? null,
        achtung: s.achtung ?? 0,
        cancelados: s.cancelados ?? 0,
        achtungMensaje: s.achtungMensaje ?? null,
        achtungTipo: s.achtungTipo ?? null,
        cancelado: s.cancelado ?? false,
        orden: s.orden ?? i,
      }))
  } catch { return [] }
}

let sessions: OcrSession[] = loadSessions()
let procesandoActualId: string | null = null
const cancelacionesActivas = new Set<string>()
const autoCerrarTimers = new Map<string, number>()
let ordenCounter = sessions.reduce((m, s) => Math.max(m, s.orden ?? 0), 0)

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.filter(s => !s.remoto))) } catch {}
}
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
      try {
        const locales: OcrSession[] = e.newValue ? JSON.parse(e.newValue) : []
        const remotas = sessions.filter(s => s.remoto)
        sessions = [...locales, ...remotas]
      } catch { sessions = sessions.filter(s => s.remoto) }
      emitter.dispatchEvent(new CustomEvent('change'))
    }
  })
}

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

async function actualizarJobDB(jobId: string, patch: Record<string, any>) {
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

function dbJobToSession(j: any): OcrSession {
  const total = j.archivos_total || 0
  const procesados = j.archivos_procesados || 0
  const errores = j.archivos_error || 0
  const procesando = j.estado === 'procesando'
  return {
    id: `remote_${j.id}`,
    total,
    enviados: procesados + errores,
    ok: procesados,
    pendientes: 0,
    duplicados: 0,
    errores,
    achtung: 0,
    cancelados: 0,
    achtungMensaje: null,
    achtungTipo: null,
    log: j.archivo_actual ? [{ filename: j.archivo_actual, status: 'ok', detalle: 'En proceso' }] : [],
    visible: true,
    procesando,
    cancelado: j.estado === 'cancelado',
    fnName: j.tipo === 'factura' ? 'ocr-procesar-factura' : 'ocr-procesar-extracto',
    titular_id: j.titular_id || null,
    archivosPendientes: [],
    creadoEn: new Date(j.created_at).getTime(),
    completadoEn: j.completed_at ? new Date(j.completed_at).getTime() : null,
    orden: 0,
    dbJobId: j.id,
    remoto: true,
  }
}

async function cargarJobsRemotos() {
  try {
    // Solo jobs VIVOS: estado=procesando con heartbeat reciente (<5min). Cancelados/completados NO se cargan.
    const heartbeatISO = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('ocr_jobs')
      .select('id, tipo, estado, archivos_total, archivos_procesados, archivos_error, archivo_actual, titular_id, created_at, completed_at, updated_at')
      .eq('estado', 'procesando')
      .gte('updated_at', heartbeatISO)
      .order('created_at', { ascending: false })
      .limit(20)
    if (error || !data) return
    const localesDbIds = new Set(sessions.filter(s => !s.remoto && s.dbJobId).map(s => s.dbJobId))
    const remotas = data
      .filter(j => !localesDbIds.has(j.id))
      .map(dbJobToSession)
    const locales = sessions.filter(s => !s.remoto)
    sessions = [...locales, ...remotas]
    emit()
  } catch {}
}

function suscribirRealtime() {
  try {
    const ch = supabase
      .channel('ocr_jobs_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ocr_jobs' }, (payload: any) => {
        const j = payload.new || payload.old
        if (!j) return
        const remoteId = `remote_${j.id}`
        const esLocal = sessions.some(s => !s.remoto && s.dbJobId === j.id)
        if (esLocal) return
        if (payload.eventType === 'DELETE') {
          sessions = sessions.filter(s => s.id !== remoteId)
          emit()
          return
        }
        // Si el job pasa a cancelado/completado/error, lo quitamos del UI (no mostramos jobs muertos)
        if (payload.new && payload.new.estado !== 'procesando') {
          sessions = sessions.filter(s => s.id !== remoteId)
          emit()
          return
        }
        const sesNueva = dbJobToSession(payload.new)
        const existe = sessions.find(s => s.id === remoteId)
        if (existe) {
          sessions = sessions.map(s => s.id === remoteId ? { ...sesNueva, orden: s.orden } : s)
        } else {
          sessions = [...sessions, sesNueva]
        }
        emit()
      })
      .subscribe()
    return ch
  } catch { return null }
}

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

async function invocarOCR(item: any, fnName: string, titular_id: string | null) {
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

async function runSession(id: string) {
  if (procesandoActualId !== null && procesandoActualId !== id) return
  procesandoActualId = id

  try {
    while (true) {
      const ses = sessions.find(s => s.id === id)
      if (!ses) break
      if (ses.remoto) break

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
      updateSession(id, { archivosPendientes: resto })

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
    .filter(s => !s.remoto && s.procesando && s.archivosPendientes.length > 0 && !cancelacionesActivas.has(s.id))
    .sort((a, b) => a.orden - b.orden)
  if (cola.length > 0) runSession(cola[0].id)
}

let realtimeChannel: any = null
let inicializado = false

function inicializar() {
  if (inicializado) return
  inicializado = true
  cargarJobsRemotos()
  realtimeChannel = suscribirRealtime()
  arrancarSiguienteEnCola()
}

if (typeof window !== 'undefined') inicializar()

export function useOcrUpload() {
  const [snap, setSnap] = useState<OcrSession[]>([...sessions])
  const initRef = useRef(false)

  useEffect(() => {
    const handler = () => setSnap([...sessions])
    emitter.addEventListener('change', handler)
    if (!initRef.current) {
      initRef.current = true
      inicializar()
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
    const nueva: OcrSession = {
      id: `ocr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      total: files.length, enviados: fallos.length, ok: 0, pendientes: 0, duplicados: 0,
      errores: fallos.length, achtung: 0, cancelados: 0,
      achtungMensaje: null, achtungTipo: null,
      log: fallos, visible: true, procesando: true, cancelado: false,
      fnName, titular_id, archivosPendientes: archivos,
      creadoEn: Date.now(), completadoEn: null,
      orden: ordenCounter,
      dbJobId: dbJobId || undefined,
    }
    sessions = [...sessions, nueva]
    emit()
    arrancarSiguienteEnCola()
  }

  function cancelar(id: string) {
    const ses = sessions.find(s => s.id === id)
    if (ses?.remoto) {
      if (ses.dbJobId) cancelarJobDB(ses.dbJobId)
      sessions = sessions.filter(s => s.id !== id)
      emit()
      return
    }
    cancelacionesActivas.add(id)
    if (procesandoActualId !== id) {
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
