// ocrUploadStore v28 — retry automático subida (3 intentos, backoff exponencial)
// Cambios vs v27:
// - conReintentos(): 3 intentos con espera 2s/4s/8s para errores de red/timeout
// - NO reintenta errores permanentes: tamaño excedido, Object not found
// - subirAlStorage y procesarUno usan conReintentos automáticamente

import { useEffect, useState } from 'react'
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
  archivosPendientes: any[]
  creadoEn: number
  completadoEn: number | null
  orden: number
  archivoActual?: string | null
  grupoId?: string | null
  lotesIds?: string[]
  subiendoAStorage?: number | null
}

const emitter = new EventTarget()
let rawSessions: OcrSession[] = []
let preparandoLocal: OcrSession[] = []
let inicializado = false
let realtimeChannel: any = null
let pollTimer: number | null = null
let cancelacionesLocales: Set<string> = new Set()

const SESION_MAX_ARCHIVOS = 500
const PARALELO_SUBIDAS = 4
const TOAST_COMPLETADO_MS = 20000
const RETRY_MAX = 3
const RETRY_BASE_MS = 2000

function emit() { emitter.dispatchEvent(new CustomEvent('change')) }

function getExt(name: string) { return name.split('.').pop()?.toLowerCase() ?? '' }

// --- RETRY ---
// Errores permanentes que no mejoran reintentando
const ERRORES_PERMANENTES = [
  'exceeded the maximum allowed size',
  'Object not found',
  'Bucket not found',
  'duplicate',
  'ya existe',
]

function esErrorPermanente(msg: string): boolean {
  return ERRORES_PERMANENTES.some(p => msg.includes(p))
}

function esperar(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

async function conReintentos<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let ultimo: any
  for (let intento = 0; intento < RETRY_MAX; intento++) {
    try {
      return await fn()
    } catch (e: any) {
      ultimo = e
      const msg = e?.message || String(e)
      if (esErrorPermanente(msg)) throw e
      if (intento < RETRY_MAX - 1) {
        const wait = RETRY_BASE_MS * Math.pow(2, intento) // 2s, 4s, 8s
        console.warn(`[OCR retry] ${label} intento ${intento + 1}/${RETRY_MAX} falló: ${msg}. Reintentando en ${wait}ms…`)
        await esperar(wait)
      }
    }
  }
  throw ultimo
}

async function cargarSheetJS(): Promise<any> {
  if ((window as any).XLSX) return (window as any).XLSX
  await new Promise<void>((res, rej) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    s.onload = () => res()
    s.onerror = () => rej(new Error('SheetJS'))
    document.head.appendChild(s)
  })
  return (window as any).XLSX
}

async function cargarMammoth(): Promise<any> {
  if ((window as any).mammoth) return (window as any).mammoth
  await new Promise<void>((res, rej) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'
    s.onload = () => res()
    s.onerror = () => rej(new Error('Mammoth'))
    document.head.appendChild(s)
  })
  return (window as any).mammoth
}

async function excelACSV(file: File | Blob): Promise<string> {
  const XLSX = await cargarSheetJS()
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const partes: string[] = []
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
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
    const csv = XLSX.utils.sheet_to_csv(ws, { FS: ';', blankrows: false })
    if (csv.trim()) partes.push(`=== ${sheetName} ===\n${csv}`)
  }
  return partes.join('\n\n')
}

async function docxATexto(file: File | Blob): Promise<string> {
  const mammoth = await cargarMammoth()
  const buf = await file.arrayBuffer()
  const r = await mammoth.extractRawText({ arrayBuffer: buf })
  return r.value || ''
}

async function docATexto(file: File | Blob): Promise<string> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let texto = ''
  let buffer = ''
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]
    if ((b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9) {
      buffer += String.fromCharCode(b)
    } else {
      if (buffer.length >= 4) texto += buffer + '\n'
      buffer = ''
    }
  }
  if (buffer.length >= 4) texto += buffer
  texto = texto.replace(/[\x00-\x1F\x7F]+/g, ' ').replace(/\s+/g, ' ').trim()
  return texto
}

async function htmlATexto(file: File | Blob): Promise<string> {
  const html = await file.text()
  const div = document.createElement('div')
  div.innerHTML = html
  const scripts = div.querySelectorAll('script,style,noscript')
  scripts.forEach(s => s.remove())
  return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim()
}

function getMimeTypeBase(ext: string): string {
  const map: Record<string, string> = {
    pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
    tif: 'image/tiff', tiff: 'image/tiff', gif: 'image/gif', bmp: 'image/bmp',
    csv: 'text/csv', txt: 'text/plain',
    rar: 'application/x-rar-compressed', '7z': 'application/x-7z-compressed',
    zip: 'application/zip',
  }
  return map[ext] ?? 'application/octet-stream'
}

async function normalizar(file: File): Promise<{ name: string; type: string; blob: Blob }> {
  const ext = getExt(file.name)
  if (['xlsx', 'xls'].includes(ext)) {
    const csv = await excelACSV(file)
    return { name: file.name.replace(/\.(xlsx|xls)$/i, '.csv'), type: 'text/csv', blob: new Blob([csv], { type: 'text/csv' }) }
  }
  if (ext === 'docx') {
    const t = await docxATexto(file)
    return { name: file.name.replace(/\.docx$/i, '.txt'), type: 'text/plain', blob: new Blob([t], { type: 'text/plain' }) }
  }
  if (ext === 'doc') {
    const t = await docATexto(file)
    return { name: file.name.replace(/\.doc$/i, '.txt'), type: 'text/plain', blob: new Blob([t], { type: 'text/plain' }) }
  }
  if (['html', 'htm'].includes(ext)) {
    const t = await htmlATexto(file)
    return { name: file.name.replace(/\.html?$/i, '.txt'), type: 'text/plain', blob: new Blob([t], { type: 'text/plain' }) }
  }
  // RAR, 7z, ZIP: subir tal cual — la edge function los descomprime server-side
  if (['rar', '7z', 'zip'].includes(ext)) {
    const t = getMimeTypeBase(ext)
    return { name: file.name, type: t, blob: file }
  }
  const t = file.type && file.type !== 'application/octet-stream' ? file.type : getMimeTypeBase(ext)
  return { name: file.name, type: t, blob: file }
}

function sanitizeForPath(name: string, idx: number): string {
  const clean = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
  return `${String(idx).padStart(5, '0')}_${clean}`
}

function dbToSession(s: any): OcrSession {
  return {
    id: s.id,
    total: s.total || 0,
    enviados: s.enviados || 0,
    ok: s.ok || 0,
    pendientes: s.pendientes || 0,
    duplicados: s.duplicados || 0,
    errores: s.errores || 0,
    achtung: s.achtung || 0,
    cancelados: s.cancelados || 0,
    achtungMensaje: s.achtung_mensaje || null,
    achtungTipo: s.achtung_tipo || null,
    log: (s.log as any[]) || [],
    visible: s.visible !== false,
    procesando: s.estado_cola === 'procesando' || s.estado_cola === 'en_espera',
    cancelado: s.estado === 'cancelada' || s.cancelar_solicitado,
    fnName: s.fn_name || null,
    titular_id: s.titular_id || null,
    archivosPendientes: (s.archivos_pendientes as any[]) || [],
    creadoEn: s.creado_en ? new Date(s.creado_en).getTime() : Date.now(),
    completadoEn: s.completado_en ? new Date(s.completado_en).getTime() : null,
    orden: s.orden_cola || 0,
    grupoId: s.grupo_id || null,
  }
}

function colapsarPorGrupo(raw: OcrSession[]): OcrSession[] {
  const sueltas: OcrSession[] = []
  const porGrupo: Record<string, OcrSession[]> = {}
  for (const s of raw) {
    if (s.grupoId) {
      if (!porGrupo[s.grupoId]) porGrupo[s.grupoId] = []
      porGrupo[s.grupoId].push(s)
    } else {
      sueltas.push(s)
    }
  }
  const agregadas: OcrSession[] = Object.entries(porGrupo).map(([grupoId, lotes]) => {
    lotes.sort((a, b) => a.orden - b.orden)
    const algunoProcesando = lotes.some(l => l.procesando)
    const todosCompletados = lotes.every(l => !l.procesando && !l.cancelado)
    const todosCancelados = lotes.every(l => l.cancelado)
    const achtungL = lotes.find(l => l.achtungMensaje)
    const total = lotes.reduce((acc, l) => acc + l.total, 0)
    const enviados = lotes.reduce((acc, l) => acc + l.enviados, 0)
    const ok = lotes.reduce((acc, l) => acc + l.ok, 0)
    const dup = lotes.reduce((acc, l) => acc + l.duplicados, 0)
    const pend = lotes.reduce((acc, l) => acc + l.pendientes, 0)
    const err = lotes.reduce((acc, l) => acc + l.errores, 0)
    const ach = lotes.reduce((acc, l) => acc + l.achtung, 0)
    const can = lotes.reduce((acc, l) => acc + l.cancelados, 0)
    const logAcumulado: ArchivoLog[] = []
    for (const l of lotes) logAcumulado.push(...(l.log || []))
    const primerLote = lotes[0]
    return {
      id: `grp_${grupoId}`,
      total, enviados, ok, pendientes: pend, duplicados: dup, errores: err, achtung: ach, cancelados: can,
      achtungMensaje: achtungL?.achtungMensaje || null,
      achtungTipo: achtungL?.achtungTipo || null,
      log: logAcumulado,
      visible: lotes.some(l => l.visible),
      procesando: algunoProcesando,
      cancelado: todosCancelados,
      fnName: primerLote.fnName,
      titular_id: primerLote.titular_id,
      archivosPendientes: [],
      creadoEn: Math.min(...lotes.map(l => l.creadoEn)),
      completadoEn: todosCompletados ? Math.max(...lotes.map(l => l.completadoEn || 0)) || null : null,
      orden: primerLote.orden,
      archivoActual: algunoProcesando ? `Procesando ${enviados} de ${total}…` : null,
      grupoId,
      lotesIds: lotes.map(l => l.id),
    }
  })
  return [...agregadas, ...sueltas].sort((a, b) => a.orden - b.orden)
}

function snapshot(): OcrSession[] {
  return [...preparandoLocal, ...colapsarPorGrupo(rawSessions)]
}

async function cargarSesionesActivas() {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('ocr_sessions')
      .select('id,total,enviados,ok,pendientes,duplicados,errores,achtung,cancelados,achtung_mensaje,achtung_tipo,log,estado,estado_cola,fn_name,titular_id,visible,cancelar_solicitado,creado_en,completado_en,orden_cola,archivos_pendientes,grupo_id')
      .gte('creado_en', cutoff)
      .eq('visible', true)
      .in('estado_cola', ['en_espera', 'procesando'])
      .order('orden_cola', { ascending: true })
    if (error) return
    rawSessions = (data || []).map(dbToSession)
    const hayPendientes = rawSessions.some(s => s.procesando && s.archivosPendientes.length > 0 && !s.cancelado)
    if (hayPendientes) lanzarWorker()
    emit()
  } catch {}
}

function suscribirRealtime() {
  try {
    if (realtimeChannel) return
    realtimeChannel = supabase
      .channel('ocr_sessions_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ocr_sessions' }, (payload: any) => {
        const row = payload.new || payload.old
        if (!row) return
        if (payload.eventType === 'DELETE') {
          rawSessions = rawSessions.filter(s => s.id !== row.id)
          emit()
          return
        }
        const next = dbToSession(payload.new)
        if (payload.new.estado_cola === 'completada' || payload.new.estado_cola === 'cancelada' || payload.new.estado === 'error') {
          const ya = rawSessions.find(s => s.id === next.id)
          if (ya) {
            rawSessions = rawSessions.map(s => s.id === next.id ? { ...next, procesando: false } : s)
            emit()
            setTimeout(() => {
              rawSessions = rawSessions.filter(s => s.id !== next.id)
              emit()
            }, TOAST_COMPLETADO_MS)
          }
          return
        }
        const existe = rawSessions.find(s => s.id === next.id)
        if (existe) rawSessions = rawSessions.map(s => s.id === next.id ? next : s)
        else rawSessions = [...rawSessions, next]
        emit()
      })
      .subscribe()
  } catch {}
}

function lanzarPoll() {
  if (pollTimer) return
  pollTimer = window.setInterval(() => { cargarSesionesActivas() }, 3000)
}

function inicializar() {
  if (inicializado) return
  inicializado = true
  cargarSesionesActivas()
  suscribirRealtime()
  lanzarPoll()
}

if (typeof window !== 'undefined') inicializar()

async function lanzarWorker() {
  try {
    await supabase.functions.invoke('ocr-procesar-sesion', { body: {} })
  } catch {}
}

function ponerPreparando(idLocal: string, total: number, hechos: number, mensaje: string) {
  const ya = preparandoLocal.find(s => s.id === idLocal)
  const ses: OcrSession = {
    id: idLocal, total, enviados: hechos,
    ok: 0, pendientes: 0, duplicados: 0, errores: 0, achtung: 0, cancelados: 0,
    achtungMensaje: null, achtungTipo: null, log: [], visible: true,
    procesando: true, cancelado: false, fnName: null, titular_id: null,
    archivosPendientes: [], creadoEn: ya?.creadoEn ?? Date.now(),
    completadoEn: null, orden: 0, archivoActual: mensaje,
  }
  if (ya) preparandoLocal = preparandoLocal.map(s => s.id === idLocal ? ses : s)
  else preparandoLocal = [...preparandoLocal, ses]
  emit()
}

function quitarPreparando(idLocal: string) {
  preparandoLocal = preparandoLocal.filter(s => s.id !== idLocal)
  emit()
}

async function subirAlStorage(grupoId: string, idx: number, name: string, type: string, blob: Blob): Promise<string> {
  const path = `${grupoId}/${sanitizeForPath(name, idx)}`
  return conReintentos(async () => {
    const { error } = await supabase.storage.from('ocr-uploads').upload(path, blob, { contentType: type, upsert: true })
    if (error) throw new Error(`storage: ${error.message}`)
    return path
  }, `upload ${name}`)
}

async function crearSesionBBDD(
  sesionId: string, grupoId: string, total: number,
  fnName: string, titular_id: string | null, ordenCola: number,
): Promise<string | null> {
  const { error } = await supabase.from('ocr_sessions').insert({
    id: sesionId, total, enviados: 0, ok: 0, pendientes: 0, duplicados: 0,
    errores: 0, achtung: 0, cancelados: 0, achtung_mensaje: null, achtung_tipo: null,
    log: [], visible: true, cancelar_solicitado: false, fn_name: fnName,
    titular_id: titular_id || null, archivos_pendientes: [],
    estado: 'procesando', estado_cola: 'en_espera', orden_cola: ordenCola,
    creado_en: new Date().toISOString(), grupo_id: grupoId,
  })
  if (error) return error.message
  return null
}

async function añadirArchivoASesion(sesionId: string, archivo: any): Promise<string | null> {
  return conReintentos(async () => {
    const { data: ses, error: errR } = await supabase
      .from('ocr_sessions')
      .select('archivos_pendientes,cancelar_solicitado')
      .eq('id', sesionId)
      .maybeSingle()
    if (errR || !ses) throw new Error(errR?.message || 'sesión no encontrada')
    if (ses.cancelar_solicitado) return 'cancelada'
    const actuales = (ses.archivos_pendientes as any[]) || []
    const nuevos = [...actuales, archivo]
    const { error } = await supabase
      .from('ocr_sessions')
      .update({ archivos_pendientes: nuevos })
      .eq('id', sesionId)
    if (error) throw new Error(error.message)
    return null
  }, `addFile ${archivo.name}`)
}

async function añadirErrorASesion(sesionId: string, filename: string, detalle: string) {
  const { data: ses } = await supabase
    .from('ocr_sessions')
    .select('log,errores,enviados')
    .eq('id', sesionId)
    .maybeSingle()
  if (!ses) return
  const log = [...((ses.log as any[]) || []), { filename, status: 'error', detalle: `subida: ${detalle}` }]
  await supabase.from('ocr_sessions').update({
    log, errores: (ses.errores || 0) + 1, enviados: (ses.enviados || 0) + 1,
  }).eq('id', sesionId)
}

export function useOcrUpload() {
  const [snap, setSnap] = useState<OcrSession[]>(snapshot())
  const [errorVisible, setErrorVisible] = useState<string | null>(null)

  useEffect(() => {
    const h = () => setSnap(snapshot())
    emitter.addEventListener('change', h)
    inicializar()
    return () => emitter.removeEventListener('change', h)
  }, [])

  async function procesar(
    files: File[],
    fnName: 'ocr-procesar-factura' | 'ocr-procesar-extracto',
    titular_id: string | null,
  ) {
    setErrorVisible(null)
    const idLocal = `prep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const grupoId = `g_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const totalLotes = Math.max(1, Math.ceil(files.length / SESION_MAX_ARCHIVOS))
    const baseOrden = Math.floor(Date.now() / 1000)
    const sesionesCreadas: { id: string; rangoIni: number; rangoFin: number }[] = []

    ponerPreparando(idLocal, files.length, 0, `Creando sesión…`)

    for (let lote = 0; lote < totalLotes; lote++) {
      const ini = lote * SESION_MAX_ARCHIVOS
      const fin = Math.min(ini + SESION_MAX_ARCHIVOS, files.length)
      const sesionId = `ocr_${Date.now()}_${lote}_${Math.random().toString(36).slice(2, 5)}`
      const err = await crearSesionBBDD(sesionId, grupoId, fin - ini, fnName, titular_id, baseOrden + lote)
      if (err) {
        const msg = `Error creando sesión BBDD lote ${lote + 1}: ${err}`
        setErrorVisible(msg)
        quitarPreparando(idLocal)
        throw new Error(msg)
      }
      sesionesCreadas.push({ id: sesionId, rangoIni: ini, rangoFin: fin })
    }

    await cargarSesionesActivas()
    lanzarWorker()

    let subidos = 0
    let fallosSubida = 0
    const cancelado = () => cancelacionesLocales.has(grupoId)

    async function procesarUno(file: File, idxGlobal: number) {
      if (cancelado()) return
      const ses = sesionesCreadas.find(s => idxGlobal >= s.rangoIni && idxGlobal < s.rangoFin)!
      try {
        const norm = await normalizar(file)
        const path = await subirAlStorage(grupoId, idxGlobal, norm.name, norm.type, norm.blob)
        const errAdd = await añadirArchivoASesion(ses.id, { name: norm.name, type: norm.type, storagePath: path })
        if (errAdd === 'cancelada') return
        if (errAdd) { await añadirErrorASesion(ses.id, file.name, errAdd); fallosSubida++ }
        else { subidos++ }
      } catch (e: any) {
        await añadirErrorASesion(ses.id, file.name, e?.message || String(e))
        fallosSubida++
      }
    }

    ponerPreparando(idLocal, files.length, 0, `Subiendo 0 de ${files.length}…`)

    let nextIdx = 0
    async function workerLocal() {
      while (true) {
        if (cancelado()) return
        const idx = nextIdx++
        if (idx >= files.length) return
        await procesarUno(files[idx], idx)
        const hechos = subidos + fallosSubida
        ponerPreparando(idLocal, files.length, hechos, `Subiendo ${hechos} de ${files.length}…`)
        if (hechos % 50 === 0) lanzarWorker()
      }
    }

    const workers = Array.from({ length: PARALELO_SUBIDAS }, () => workerLocal())
    await Promise.all(workers)
    quitarPreparando(idLocal)
    await cargarSesionesActivas()
    lanzarWorker()
  }

  async function cancelar(id: string) {
    if (id.startsWith('grp_')) {
      const grupoId = id.slice(4)
      cancelacionesLocales.add(grupoId)
      await supabase
        .from('ocr_sessions')
        .update({ cancelar_solicitado: true, archivos_pendientes: [], estado: 'cancelada', estado_cola: 'cancelada' })
        .eq('grupo_id', grupoId)
    } else {
      await supabase
        .from('ocr_sessions')
        .update({ cancelar_solicitado: true, archivos_pendientes: [], estado: 'cancelada', estado_cola: 'cancelada' })
        .eq('id', id)
    }
  }

  async function cerrar(id: string) {
    if (id.startsWith('grp_')) {
      const grupoId = id.slice(4)
      const lotesIds = rawSessions.filter(s => s.grupoId === grupoId).map(s => s.id)
      rawSessions = rawSessions.filter(s => s.grupoId !== grupoId)
      emit()
      if (lotesIds.length > 0) await supabase.from('ocr_sessions').update({ visible: false }).in('id', lotesIds)
    } else {
      rawSessions = rawSessions.filter(s => s.id !== id)
      emit()
      await supabase.from('ocr_sessions').update({ visible: false }).eq('id', id)
    }
  }

  async function ocultar(id: string) {
    if (id.startsWith('grp_')) {
      const grupoId = id.slice(4)
      const lotesIds = rawSessions.filter(s => s.grupoId === grupoId).map(s => s.id)
      rawSessions = rawSessions.map(s => s.grupoId === grupoId ? { ...s, visible: false } : s)
      emit()
      if (lotesIds.length > 0) await supabase.from('ocr_sessions').update({ visible: false }).in('id', lotesIds)
    } else {
      rawSessions = rawSessions.map(s => s.id === id ? { ...s, visible: false } : s)
      emit()
      await supabase.from('ocr_sessions').update({ visible: false }).eq('id', id)
    }
  }

  return { sessions: snap, procesar, cancelar, cerrar, ocultar, errorVisible }
}
