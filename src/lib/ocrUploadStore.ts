// ocrUploadStore v15 — Vuelve al modelo localStorage funcional + BBDD opcional
// El front procesa con su propio loop. Si tienes varios dispositivos no se sincroniza
// (eso lo arreglamos cuando publiquemos OAuth en Producción).
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
}

const STORAGE_KEY = 'ocr_sessions_v3'
const PAUSA_MS = 1500
const RATE_LIMIT_BACKOFF_MS = 65000
const MAX_REINTENTOS = 3

const emitter = new EventTarget()

function loadSessions(): OcrSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr: OcrSession[] = JSON.parse(raw)
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    return arr
      .filter(s => s.creadoEn > cutoff && s.visible)
      .map(s => ({
        ...s,
        completadoEn: s.completadoEn ?? null,
        achtung: s.achtung ?? 0,
        cancelados: s.cancelados ?? 0,
        achtungMensaje: s.achtungMensaje ?? null,
        achtungTipo: s.achtungTipo ?? null,
        cancelado: s.cancelado ?? false,
      }))
  } catch { return [] }
}

let sessions: OcrSession[] = loadSessions()
const procesandoActivamente = new Set<string>()
const cancelacionesActivas = new Set<string>()

function persist() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)) } catch {} }
function emit() { persist(); emitter.dispatchEvent(new CustomEvent('change')) }

function updateSession(id: string, patch: Partial<OcrSession>) {
  sessions = sessions.map(s => {
    if (s.id !== id) return s
    const next = { ...s, ...patch }
    if (s.procesando && next.procesando === false && next.completadoEn == null) next.completadoEn = Date.now()
    return next
  })
  emit()
}

function removeSession(id: string) {
  sessions = sessions.filter(s => s.id !== id)
  procesandoActivamente.delete(id)
  cancelacionesActivas.delete(id)
  emit()
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key === STORAGE_KEY) {
      try { sessions = e.newValue ? JSON.parse(e.newValue) : [] } catch { sessions = [] }
      emitter.dispatchEvent(new CustomEvent('change'))
    }
  })
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
  if (procesandoActivamente.has(id)) return
  procesandoActivamente.add(id)
  
  try {
    while (true) {
      const ses = sessions.find(s => s.id === id)
      if (!ses) break
      if (cancelacionesActivas.has(id) || ses.cancelado) {
        const pendientes = ses.archivosPendientes.length
        updateSession(id, { 
          cancelado: true, procesando: false, 
          cancelados: (ses.cancelados||0) + pendientes,
          enviados: ses.enviados + pendientes,
          archivosPendientes: [],
        })
        break
      }
      if (ses.archivosPendientes.length === 0) {
        updateSession(id, { procesando: false })
        break
      }
      
      const [item, ...resto] = ses.archivosPendientes
      updateSession(id, { archivosPendientes: resto })
      
      let result: any = null
      for (let intento = 0; intento <= MAX_REINTENTOS; intento++) {
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
      if (entry.status === 'achtung') break
      
      await new Promise(r => setTimeout(r, PAUSA_MS))
    }
  } finally {
    procesandoActivamente.delete(id)
    // Arrancar siguiente sesión en cola
    const proxima = sessions.find(s => s.procesando && s.archivosPendientes.length > 0 && s.id !== id && !procesandoActivamente.has(s.id))
    if (proxima) runSession(proxima.id)
  }
}

// Reanudar sesiones al cargar
function reanudarTodas() {
  for (const s of sessions) {
    if (s.procesando && s.archivosPendientes.length > 0 && !procesandoActivamente.has(s.id)) {
      // Si ya hay otra procesando, dejar en cola
      if (procesandoActivamente.size === 0) {
        runSession(s.id)
        break // sólo arranca una; las demás esperan
      }
    }
  }
}

if (typeof window !== 'undefined') reanudarTodas()

export function useOcrUpload() {
  const [snap, setSnap] = useState<OcrSession[]>([...sessions])
  const initRef = useRef(false)

  useEffect(() => {
    const handler = () => setSnap([...sessions])
    emitter.addEventListener('change', handler)
    if (!initRef.current) { initRef.current = true; reanudarTodas() }
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
    
    const nueva: OcrSession = {
      id: `ocr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      total: files.length, enviados: fallos.length, ok: 0, pendientes: 0, duplicados: 0,
      errores: fallos.length, achtung: 0, cancelados: 0,
      achtungMensaje: null, achtungTipo: null,
      log: fallos, visible: true, procesando: true, cancelado: false,
      fnName, titular_id, archivosPendientes: archivos,
      creadoEn: Date.now(), completadoEn: null,
    }
    sessions = [...sessions, nueva]
    emit()
    // Si no hay nada procesando, arrancar; si no, espera en cola
    if (procesandoActivamente.size === 0) runSession(nueva.id)
  }

  function cancelar(id: string) {
    cancelacionesActivas.add(id)
    // Si no estaba procesando todavía (en cola), marcar cancelada ya
    const ses = sessions.find(s => s.id === id)
    if (ses && !procesandoActivamente.has(id)) {
      const pendientes = ses.archivosPendientes.length
      updateSession(id, {
        cancelado: true, procesando: false,
        cancelados: (ses.cancelados||0) + pendientes,
        archivosPendientes: [],
      })
      // Arrancar siguiente
      const proxima = sessions.find(s => s.procesando && s.archivosPendientes.length > 0 && s.id !== id && !procesandoActivamente.has(s.id))
      if (proxima) runSession(proxima.id)
    }
  }

  function cerrar(id: string) { removeSession(id) }
  function ocultar(id: string) { updateSession(id, { visible: false }) }

  return { sessions: snap, procesar, cancelar, cerrar, ocultar }
}
