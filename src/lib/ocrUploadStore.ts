// ocrUploadStore v18 — persistente BBDD + contadores locales intactos
// Cola secuencial, cancelar inmediato, auto-cerrar 20s, persiste entre dispositivos/F5/módulos
import { useEffect, useRef, useState, useCallback } from 'react'
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
  dbEstado?: string
}

const PAUSA_MS = 1500
const RATE_LIMIT_BACKOFF_MS = 65000
const MAX_REINTENTOS = 3
const AUTO_CERRAR_MS = 20000

const emitter = new EventTarget()

let sessions: OcrSession[] = []
let procesandoActualId: string | null = null
const cancelacionesActivas = new Set<string>()
const autoCerrarTimers = new Map<string, number>()
let ordenCounter = 0
let dbJobsLoaded = false

function emit() { emitter.dispatchEvent(new CustomEvent('change')) }

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

// ========== BBDD sync ==========

async function syncDesdeDB() {
  const ahora = new Date()
  const hace20s = new Date(ahora.getTime() - AUTO_CERRAR_MS).toISOString()

  const { data: jobs } = await supabase
    .from('ocr_jobs')
    .select('*')
    .or(`estado.in.(pendiente,procesando),and(estado.eq.completado,completed_at.gte.${hace20s}),and(estado.eq.error,completed_at.gte.${hace20s})`)
    .order('created_at', { ascending: true })

  if (!jobs) return

  for (const job of jobs) {
    const existing = sessions.find(s => s.dbJobId === job.id)
    if (existing) {
      // Solo actualizar dbEstado, NO sobreescribir contadores locales
      updateSession(existing.id, { dbEstado: job.estado })
    } else if (!dbJobsLoaded) {
      // Job de BBDD sin sesión local (vino de otro dispositivo/pestaña)
      ordenCounter++
      const ses: OcrSession = {
        id: `db_${job.id}`,
        total: job.archivos_total,
        enviados: job.archivos_procesados + job.archivos_error,
        ok: job.archivos_procesados,
        pendientes: 0,
        duplicados: 0,
        errores: job.archivos_error,
        achtung: 0,
        cancelados: 0,
        achtungMensaje: null,
        achtungTipo: null,
        log: [],
        visible: true,
        procesando: job.estado === 'procesando',
        cancelado: job.estado === 'cancelado',
        fnName: null,
        titular_id: job.titular_id,
        archivosPendientes: [],
        creadoEn: new Date(job.created_at).getTime(),
        completadoEn: job.completed_at ? new Date(job.completed_at).getTime() : null,
        orden: ordenCounter,
        dbJobId: job.id,
        dbEstado: job.estado,
      }
      sessions.push(ses)
      if (ses.completadoEn) programarAutoCierre(ses.id)
    }
  }
  dbJobsLoaded = true
  emit()
}

async function crearJobEnDB(tipo: string, archivosCount: number, titularId: string | null): Promise<string | null> {
  const { data: job, error } = await supabase
    .from('ocr_jobs')
    .insert({
      tipo: tipo === 'ocr-procesar-factura' ? 'factura' : 'extracto',
      estado: 'pendiente',
      archivos_total: archivosCount,
      titular_id: titularId,
    })
    .select('id')
    .single()

  if (error || !job) return null

  const { data: activo } = await supabase
    .from('ocr_jobs')
    .select('id')
    .eq('estado', 'procesando')
    .limit(1)
    .single()

  if (!activo) {
    await supabase.from('ocr_jobs').update({ estado: 'procesando' }).eq('id', job.id)
  }

  return job.id
}

async function actualizarJobDB(jobId: string, patch: Record<string, any>) {
  await supabase.from('ocr_jobs').update(patch).eq('id', jobId)
}

async function cancelarJobDB(jobId: string) {
  await supabase.from('ocr_jobs')
    .update({ estado: 'cancelado', completed_at: new Date().toISOString() })
    .eq('id', jobId)
    .in('estado', ['pendiente', 'procesando'])

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
}

async function completarJobDB(jobId: string, procesados: number, errores: number) {
  await supabase.from('ocr_jobs').update({
    estado: errores > 0 && procesados === 0 ? 'error' : 'completado',
    archivos_procesados: procesados,
    archivos_error: errores,
    completed_at: new Date().toISOString(),
    mensaje: `${procesados} procesados, ${errores} errores`,
  }).eq('id', jobId)

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

// ========== OCR invoke ==========

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

// ========== Procesamiento ==========

async function runSession(id: string) {
  if (procesandoActualId !== null && procesandoActualId !== id) return
  procesandoActualId = id

  const ses = sessions.find(s => s.id === id)
  const dbJobId = ses?.dbJobId

  try {
    while (true) {
      const sesNow = sessions.find(s => s.id === id)
      if (!sesNow) break

      if (cancelacionesActivas.has(id)) {
        if (dbJobId) await cancelarJobDB(dbJobId)
        sessions = sessions.filter(s => s.id !== id)
        cancelacionesActivas.delete(id)
        emit()
        break
      }

      if (sesNow.archivosPendientes.length === 0) {
        updateSession(id, { procesando: false })
        if (dbJobId) await completarJobDB(dbJobId, sesNow.ok + sesNow.duplicados + sesNow.pendientes, sesNow.errores)
        break
      }

      const [item, ...resto] = sesNow.archivosPendientes
      updateSession(id, { archivosPendientes: resto })

      if (dbJobId) await actualizarJobDB(dbJobId, { archivo_actual: item.name })

      let result: any = null
      for (let intento = 0; intento <= MAX_REINTENTOS; intento++) {
        if (cancelacionesActivas.has(id)) break
        try {
          result = await invocarOCR(item, sesNow.fnName!, sesNow.titular_id)
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
        if (dbJobId) await cancelarJobDB(dbJobId)
        sessions = sessions.filter(s => s.id !== id)
        cancelacionesActivas.delete(id)
        emit()
        break
      }

      const entry: ArchivoLog = { filename: item.name, status: result.status, detalle: result.detalle, achtungTipo: result.achtungTipo }
      const sesAfter = sessions.find(s => s.id === id)
      if (!sesAfter) break

      const patch: Partial<OcrSession> = {
        log: [...sesAfter.log, entry],
        enviados: sesAfter.enviados + 1,
        ok: sesAfter.ok + (entry.status === 'ok' ? 1 : 0),
        duplicados: sesAfter.duplicados + (entry.status === 'duplicado' ? 1 : 0),
        pendientes: sesAfter.pendientes + (entry.status === 'pendiente' ? 1 : 0),
        errores: sesAfter.errores + (entry.status === 'error' ? 1 : 0),
        achtung: sesAfter.achtung + (entry.status === 'achtung' ? 1 : 0),
      }

      if (entry.status === 'achtung' && !sesAfter.achtungMensaje) {
        patch.achtungMensaje = result.achtungMensaje
        patch.achtungTipo = result.achtungTipo
        patch.archivosPendientes = []
        patch.procesando = false
      }

      updateSession(id, patch)

      // Sync contadores a BBDD (solo escritura, nunca lectura)
      if (dbJobId) {
        const s = sessions.find(x => x.id === id)
        if (s) await actualizarJobDB(dbJobId, {
          archivos_procesados: s.ok + s.duplicados + s.pendientes,
          archivos_error: s.errores,
        })
      }

      if (entry.status === 'achtung') {
        if (dbJobId) await actualizarJobDB(dbJobId, {
          estado: 'error',
          mensaje: result.achtungMensaje,
          completed_at: new Date().toISOString(),
        })
        break
      }

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

// ========== Hook público ==========

export function useOcrUpload() {
  const [snap, setSnap] = useState<OcrSession[]>([...sessions])
  const initRef = useRef(false)

  useEffect(() => {
    const handler = () => setSnap([...sessions])
    emitter.addEventListener('change', handler)

    if (!initRef.current) {
      initRef.current = true
      syncDesdeDB().then(() => {
        arrancarSiguienteEnCola()
      })

      const channel = supabase
        .channel('ocr-jobs-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ocr_jobs' }, () => {
          syncDesdeDB()
        })
        .subscribe()

      return () => {
        emitter.removeEventListener('change', handler)
        supabase.removeChannel(channel)
      }
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
      dbEstado: 'pendiente',
    }
    sessions = [...sessions, nueva]
    emit()
    arrancarSiguienteEnCola()
  }

  function cancelar(id: string) {
    cancelacionesActivas.add(id)
    const ses = sessions.find(s => s.id === id)
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
