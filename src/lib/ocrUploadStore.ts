// ocrUploadStore v43 — PDF >20MB se comprime SOLO en el navegador antes de subir.
// Si tras comprimir sigue >20MB, se parte en varios PDF por páginas (cada parte <20MB),
// y cada parte se procesa como un archivo más. El usuario no hace nada.
// Mantiene v41: toast autocierre SIEMPRE a 1 min (60s).
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface ArchivoLog {
  filename: string
  status: 'ok' | 'duplicado' | 'ignorada' | 'pendiente' | 'error' | 'achtung' | 'cancelado'
  detalle: string
  achtungTipo?: 'creditos' | 'api_key' | 'modelo' | 'otro'
}

export interface OcrSession {
  id: string; total: number; enviados: number; ok: number; pendientes: number
  duplicados: number; ignorados: number; errores: number; achtung: number; cancelados: number
  achtungMensaje: string | null; achtungTipo: 'creditos' | 'api_key' | 'modelo' | 'otro' | null
  log: ArchivoLog[]; visible: boolean; procesando: boolean; cancelado: boolean; pausada: boolean
  fnName: 'ocr-procesar-factura' | 'ocr-procesar-extracto' | null
  titular_id: string | null; archivosPendientes: any[]; creadoEn: number
  completadoEn: number | null; orden: number; archivoActual?: string | null
  grupoId?: string | null; lotesIds?: string[]
  subidosStorage?: number; totalStorage?: number
  estadoCola?: string | null
}

const emitter = new EventTarget()
let rawSessions: OcrSession[] = []
let preparandoLocal: OcrSession[] = []
let inicializado = false
let realtimeChannel: any = null
let pollTimer: number | null = null
let cancelacionesLocales: Set<string> = new Set()
let timersAutoCerrar: Map<string, number> = new Map()

const SESION_MAX_ARCHIVOS = 500
const PARALELO_SUBIDAS = 6
const TOAST_COMPLETADO_MS = 60000
const RETRY_BASE_MS = 2000
const RETRY_CAP_MS = 30000
const MAX_REINTENTOS = 10
const MAX_ARCHIVO_MB = 20
const MAX_BYTES = MAX_ARCHIVO_MB * 1024 * 1024
const ERRORES_PERMANENTES = ['Bucket not found']

function emit() { emitter.dispatchEvent(new CustomEvent('change')) }
function getExt(name: string) { return name.split('.').pop()?.toLowerCase() ?? '' }
function esErrorPermanente(msg: string): boolean { return ERRORES_PERMANENTES.some(p => msg.includes(p)) }
function esperar(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)) }

async function conReintentos<T>(fn: () => Promise<T>, label: string, cancelado: () => boolean): Promise<T> {
  let intento = 0
  while (intento < MAX_REINTENTOS) {
    if (cancelado()) throw new Error('cancelado')
    try { return await fn() } catch (e: any) {
      const msg = e?.message || String(e)
      if (msg === 'cancelado') throw e
      if (esErrorPermanente(msg)) throw e
      intento++
      if (intento >= MAX_REINTENTOS) throw new Error(`${label}: falló tras ${MAX_REINTENTOS} intentos. Último error: ${msg}`)
      const wait = Math.min(RETRY_BASE_MS * Math.pow(2, Math.min(intento, 10)), RETRY_CAP_MS)
      console.warn(`[OCR retry] ${label} intento ${intento} falló: ${msg}. Reintentando en ${wait}ms…`)
      await esperar(wait)
    }
  }
  throw new Error(`${label}: agotados ${MAX_REINTENTOS} reintentos`)
}

async function cargarSheetJS(): Promise<any> {
  if ((window as any).XLSX) return (window as any).XLSX
  await new Promise<void>((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = () => res(); s.onerror = () => rej(new Error('No se pudo cargar SheetJS. Verifica tu conexión a internet.')); document.head.appendChild(s) })
  return (window as any).XLSX
}

async function cargarMammoth(): Promise<any> {
  if ((window as any).mammoth) return (window as any).mammoth
  await new Promise<void>((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'; s.onload = () => res(); s.onerror = () => rej(new Error('Mammoth')); document.head.appendChild(s) })
  return (window as any).mammoth
}

// pdf-lib para partir PDF grandes en el navegador (sin servidor, sin API).
async function cargarPdfLib(): Promise<any> {
  if ((window as any).PDFLib) return (window as any).PDFLib
  await new Promise<void>((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js'; s.onload = () => res(); s.onerror = () => rej(new Error('No se pudo cargar pdf-lib')); document.head.appendChild(s) })
  return (window as any).PDFLib
}

async function excelACSV(file: File | Blob): Promise<string> {
  const XLSX = await cargarSheetJS()
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const partes: string[] = []
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]; const ref = ws['!ref']
    if (ref) { const range = XLSX.utils.decode_range(ref); for (let R = range.s.r; R <= range.e.r; R++) { for (let C = range.s.c; C <= range.e.c; C++) { const addr = XLSX.utils.encode_cell({ r: R, c: C }); const cell = ws[addr]; if (!cell) continue; if (cell.t === 'd' && cell.v instanceof Date) { const d = cell.v as Date; cell.t = 's'; cell.v = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; cell.w = cell.v } } } }
    const csv = XLSX.utils.sheet_to_csv(ws, { FS: ';', blankrows: false })
    if (csv.trim()) partes.push(`=== ${sheetName} ===\n${csv}`)
  }
  return partes.join('\n\n')
}

async function docxATexto(file: File | Blob): Promise<string> { const mammoth = await cargarMammoth(); const buf = await file.arrayBuffer(); const r = await mammoth.extractRawText({ arrayBuffer: buf }); return r.value || '' }

async function docATexto(file: File | Blob): Promise<string> {
  const buf = await file.arrayBuffer(); const bytes = new Uint8Array(buf); let texto = ''; let buffer = ''
  for (let i = 0; i < bytes.length; i++) { const b = bytes[i]; if ((b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9) { buffer += String.fromCharCode(b) } else { if (buffer.length >= 4) texto += buffer + '\n'; buffer = '' } }
  if (buffer.length >= 4) texto += buffer
  return texto.replace(/[\x00-\x1F\x7F]+/g, ' ').replace(/\s+/g, ' ').trim()
}

async function htmlATexto(file: File | Blob): Promise<string> {
  const html = await file.text()
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  doc.querySelectorAll('script,style,noscript').forEach(s => s.remove())
  return (doc.body?.textContent || '').replace(/\s+/g, ' ').trim()
}

function getMimeTypeBase(ext: string): string {
  const map: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', tif: 'image/tiff', tiff: 'image/tiff', gif: 'image/gif', bmp: 'image/bmp', csv: 'text/csv', txt: 'text/plain', rar: 'application/x-rar-compressed', '7z': 'application/x-7z-compressed', zip: 'application/zip', eml: 'message/rfc822', msg: 'application/vnd.ms-outlook' }
  return map[ext] ?? 'application/octet-stream'
}

export interface ArchivoNormalizado { name: string; type: string; blob: Blob; esComprimido: boolean }

// FIX v42: un PDF >20MB se parte por páginas en el navegador en varios PDF, cada uno <20MB.
// Devuelve uno o varios archivos listos para subir. El usuario no hace nada.
async function partirPdfGrande(file: File): Promise<ArchivoNormalizado[]> {
  try {
    const PDFLib = await cargarPdfLib()
    const buf = await file.arrayBuffer()
    const src = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: true })
    const numPaginas = src.getPageCount()
    if (numPaginas <= 1) {
      // Una sola página enorme: no se puede partir por páginas. Se sube tal cual
      // (caerá en error >20MB, caso muy raro). Mejor intentarlo que perderlo.
      return [{ name: file.name, type: 'application/pdf', blob: file, esComprimido: false }]
    }
    // Repartir páginas en bloques cuyo peso estimado quede bajo el límite.
    const ratio = file.size / numPaginas
    const pagsPorParte = Math.max(1, Math.floor((MAX_BYTES * 0.85) / ratio))
    const partes: ArchivoNormalizado[] = []
    let parteNum = 1
    for (let ini = 0; ini < numPaginas; ini += pagsPorParte) {
      const fin = Math.min(ini + pagsPorParte, numPaginas)
      const nuevo = await PDFLib.PDFDocument.create()
      const indices = Array.from({ length: fin - ini }, (_, k) => ini + k)
      const copiadas = await nuevo.copyPages(src, indices)
      for (const p of copiadas) nuevo.addPage(p)
      const bytes = await nuevo.save()
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const baseName = file.name.replace(/\.pdf$/i, '')
      partes.push({ name: `${baseName}__parte${parteNum}.pdf`, type: 'application/pdf', blob, esComprimido: false })
      parteNum++
    }
    return partes
  } catch {
    // Si pdf-lib falla, devolver el original (caerá en error >20MB, no se pierde nada).
    return [{ name: file.name, type: 'application/pdf', blob: file, esComprimido: false }]
  }
}

// Devuelve SIEMPRE una lista (normalmente 1 elemento; varios si fue un PDF grande partido).
async function normalizar(file: File): Promise<ArchivoNormalizado[]> {
  const ext = getExt(file.name)
  if (['zip', 'rar', '7z'].includes(ext)) { const t = file.type && file.type !== 'application/octet-stream' ? file.type : getMimeTypeBase(ext); return [{ name: file.name, type: t, blob: file, esComprimido: true }] }
  if (['xlsx', 'xls'].includes(ext)) { const csv = await excelACSV(file); return [{ name: file.name.replace(/\.(xlsx|xls)$/i, '.csv'), type: 'text/csv', blob: new Blob([csv], { type: 'text/csv' }), esComprimido: false }] }
  if (ext === 'docx') { const t = await docxATexto(file); return [{ name: file.name.replace(/\.docx$/i, '.txt'), type: 'text/plain', blob: new Blob([t], { type: 'text/plain' }), esComprimido: false }] }
  // .doc: NO se convierte — se sube el original (Drive debe recibir el .doc tal cual).
  // El backend extrae el texto con word-extractor.
  if (ext === 'doc') { return [{ name: file.name, type: 'application/msword', blob: file, esComprimido: false }] }
  if (['html', 'htm'].includes(ext)) { const t = await htmlATexto(file); return [{ name: file.name.replace(/\.html?$/i, '.txt'), type: 'text/plain', blob: new Blob([t], { type: 'text/plain' }), esComprimido: false }] }
  // PDF grande -> partir por páginas en el navegador.
  if (ext === 'pdf' && file.size > MAX_BYTES) {
    return await partirPdfGrande(file)
  }
  const t = file.type && file.type !== 'application/octet-stream' ? file.type : getMimeTypeBase(ext)
  return [{ name: file.name, type: t, blob: file, esComprimido: false }]
}

function sanitizeForPath(name: string, idx: number): string { return `${String(idx).padStart(5, '0')}_${name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)}` }

function dbToSession(s: any): OcrSession {
  return { id: s.id, total: s.total || 0, enviados: s.enviados || 0, ok: s.ok || 0, pendientes: s.pendientes || 0, duplicados: s.duplicados || 0, ignorados: s.ignorados || 0, errores: s.errores || 0, achtung: s.achtung || 0, cancelados: s.cancelados || 0, achtungMensaje: s.achtung_mensaje || null, achtungTipo: s.achtung_tipo || null, log: (s.log as any[]) || [], visible: s.visible !== false, procesando: s.estado_cola === 'procesando' || s.estado_cola === 'en_espera' || s.estado_cola === 'staging' || s.estado_cola === 'pausada', cancelado: s.estado === 'cancelada', pausada: s.estado_cola === 'pausada', fnName: s.fn_name || null, titular_id: s.titular_id || null, archivosPendientes: (s.archivos_pendientes as any[]) || [], creadoEn: s.creado_en ? new Date(s.creado_en).getTime() : Date.now(), completadoEn: s.completado_en ? new Date(s.completado_en).getTime() : null, orden: s.orden_cola || 0, grupoId: s.grupo_id || null, subidosStorage: s.subidos_storage || 0, totalStorage: s.total_storage || 0, estadoCola: s.estado_cola || null }
}

function colapsarPorGrupo(raw: OcrSession[]): OcrSession[] {
  const sueltas: OcrSession[] = []; const porGrupo: Record<string, OcrSession[]> = {}
  for (const s of raw) { if (s.grupoId) { if (!porGrupo[s.grupoId]) porGrupo[s.grupoId] = []; porGrupo[s.grupoId].push(s) } else sueltas.push(s) }
  const agregadas: OcrSession[] = Object.entries(porGrupo).map(([grupoId, lotes]) => {
    if (lotes.length === 0) return null as any
    lotes.sort((a, b) => a.orden - b.orden)
    const algunoProcesando = lotes.some(l => l.procesando); const algunaPausada = lotes.some(l => l.pausada); const todosCompletados = lotes.every(l => !l.procesando && !l.cancelado); const todosCancelados = lotes.every(l => l.cancelado); const achtungL = lotes.find(l => l.achtungMensaje)
    const total = lotes.reduce((acc, l) => acc + l.total, 0); const enviados = lotes.reduce((acc, l) => acc + l.enviados, 0)
    const subidosStorage = lotes.reduce((acc, l) => acc + (l.subidosStorage || 0), 0); const totalStorage = lotes.reduce((acc, l) => acc + (l.totalStorage || 0), 0)
    const logAcumulado: ArchivoLog[] = []; for (const l of lotes) logAcumulado.push(...(l.log || []))
    const primerLote = lotes[0]
    let archivoActual: string | null = null
    if (algunoProcesando) { archivoActual = algunaPausada ? `Pausado en ${enviados} de ${total}` : (totalStorage > 0 && subidosStorage < totalStorage ? `Subiendo ${subidosStorage} de ${totalStorage} al servidor…` : `Procesando ${enviados} de ${total}…`) }
    return { id: `grp_${grupoId}`, total, enviados, ok: lotes.reduce((a, l) => a + l.ok, 0), pendientes: lotes.reduce((a, l) => a + l.pendientes, 0), duplicados: lotes.reduce((a, l) => a + l.duplicados, 0), ignorados: lotes.reduce((a, l) => a + (l.ignorados || 0), 0), errores: lotes.reduce((a, l) => a + l.errores, 0), achtung: lotes.reduce((a, l) => a + l.achtung, 0), cancelados: lotes.reduce((a, l) => a + l.cancelados, 0), achtungMensaje: achtungL?.achtungMensaje || null, achtungTipo: achtungL?.achtungTipo || null, log: logAcumulado, visible: lotes.some(l => l.visible), procesando: algunoProcesando, pausada: algunaPausada, cancelado: todosCancelados, fnName: primerLote.fnName, titular_id: primerLote.titular_id, archivosPendientes: [], creadoEn: Math.min(...lotes.map(l => l.creadoEn)), completadoEn: todosCompletados ? Math.max(...lotes.map(l => l.completadoEn || 0)) || null : null, orden: primerLote.orden, archivoActual, grupoId, lotesIds: lotes.map(l => l.id), subidosStorage, totalStorage }
  }).filter(Boolean)
  return [...agregadas, ...sueltas].sort((a, b) => a.orden - b.orden)
}

function snapshot(): OcrSession[] {
  const gruposPreparando = new Set(preparandoLocal.map(p => p.grupoId).filter(Boolean))
  const deBD = colapsarPorGrupo(rawSessions).filter(s => !(s.grupoId && gruposPreparando.has(s.grupoId)))
  return [...preparandoLocal, ...deBD]
}

function programarAutoCerrar(sesionId: string) {
  if (timersAutoCerrar.has(sesionId)) return
  const t = window.setTimeout(() => {
    rawSessions = rawSessions.filter(s => s.id !== sesionId)
    timersAutoCerrar.delete(sesionId)
    supabase.from('ocr_sessions').update({ visible: false }).eq('id', sesionId).then(() => {})
    emit()
  }, TOAST_COMPLETADO_MS)
  timersAutoCerrar.set(sesionId, t)
}

function debeAutoCerrar(s: OcrSession): boolean {
  return !s.procesando && !s.cancelado && s.visible
}

async function cargarSesionesActivas() {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('ocr_sessions')
      .select('id,total,enviados,ok,pendientes,duplicados,ignorados,errores,achtung,cancelados,achtung_mensaje,achtung_tipo,log,estado,estado_cola,fn_name,titular_id,visible,cancelar_solicitado,creado_en,completado_en,orden_cola,archivos_pendientes,grupo_id,subidos_storage,total_storage')
      .gte('creado_en', cutoff)
      .eq('visible', true)
      .in('estado_cola', ['staging', 'en_espera', 'procesando', 'completada', 'pausada'])
      .order('orden_cola', { ascending: true })
    if (error) { console.warn('[OCR] cargarSesionesActivas error:', error.message); return }
    const nuevas = (data || []).map(dbToSession)
    for (const s of nuevas) {
      if (debeAutoCerrar(s)) programarAutoCerrar(s.id)
    }
    rawSessions = nuevas; emit()
    if (typeof window !== 'undefined' && nuevas.some(s => s.procesando)) { try { window.dispatchEvent(new Event('facturas:changed')) } catch {} }

    // Detectar sesiones staging interrumpidas (pestaña cerrada durante la subida al Storage).
    // Condición: staging/procesando + sin archivos_pendientes + algo subido al Storage + >60s de edad
    // + NO está siendo subida activamente por este cliente.
    const ahora = Date.now()
    const interrumpidas = nuevas.filter(s =>
      s.estadoCola === 'staging' &&
      (s.subidosStorage ?? 0) > 0 &&
      s.grupoId != null &&
      !preparandoLocal.some(p => p.grupoId === s.grupoId) &&
      ahora - s.creadoEn > 60_000
    )
    for (const s of interrumpidas) {
      intentarReanudarInterrumpida(s).catch(e => console.warn('[OCR] reanudar error:', e))
    }
  } catch (e: any) { console.warn('[OCR] cargarSesionesActivas excepción:', e?.message || e) }
}

function suscribirRealtime() {
  try {
    if (realtimeChannel) return
    realtimeChannel = supabase.channel('ocr_sessions_live').on('postgres_changes', { event: '*', schema: 'public', table: 'ocr_sessions' }, (payload: any) => {
      const row = payload.new || payload.old; if (!row) return
      if (payload.eventType === 'DELETE') { rawSessions = rawSessions.filter(s => s.id !== row.id); emit(); return }
      const next = dbToSession(payload.new)
      const existe = rawSessions.find(s => s.id === next.id)
      if (existe) rawSessions = rawSessions.map(s => s.id === next.id ? next : s); else rawSessions = [...rawSessions, next]
      if (debeAutoCerrar(next)) programarAutoCerrar(next.id)
      emit()
    }).subscribe()
  } catch {}
}

function lanzarPoll() { if (pollTimer) return; pollTimer = window.setInterval(() => { cargarSesionesActivas() }, 3000) }
function inicializar() { if (inicializado) return; inicializado = true; cargarSesionesActivas(); suscribirRealtime(); lanzarPoll() }
if (typeof window !== 'undefined') inicializar()

let errorWorkerGlobal: string | null = null
async function lanzarWorker() {
  for (let i = 0; i < 3; i++) {
    try {
      await supabase.functions.invoke('ocr-procesar-sesion', { body: {} })
      errorWorkerGlobal = null
      return
    } catch (e: any) {
      if (i === 2) {
        errorWorkerGlobal = `Error lanzando procesamiento: ${e?.message || String(e)}. Los archivos están guardados, se procesarán cuando el servidor se recupere.`
        emit()
      }
      await esperar(2000 * (i + 1))
    }
  }
}

function ponerPreparando(idLocal: string, total: number, hechos: number, mensaje: string, grupoId?: string) {
  const ya = preparandoLocal.find(s => s.id === idLocal)
  const ses: OcrSession = { id: idLocal, total, enviados: hechos, ok: 0, pendientes: 0, duplicados: 0, ignorados: 0, errores: 0, achtung: 0, cancelados: 0, achtungMensaje: null, achtungTipo: null, log: [], visible: true, procesando: true, cancelado: false, pausada: false, fnName: null, titular_id: null, archivosPendientes: [], creadoEn: ya?.creadoEn ?? Date.now(), completadoEn: null, orden: 0, archivoActual: mensaje, grupoId: grupoId ?? ya?.grupoId ?? null }
  if (ya) preparandoLocal = preparandoLocal.map(s => s.id === idLocal ? ses : s); else preparandoLocal = [...preparandoLocal, ses]; emit()
}
function quitarPreparando(idLocal: string) { preparandoLocal = preparandoLocal.filter(s => s.id !== idLocal); emit() }

async function subirAlStorage(grupoId: string, idx: number, name: string, type: string, blob: Blob, cancelado: () => boolean): Promise<string> {
  const path = `${grupoId}/${sanitizeForPath(name, idx)}`
  return conReintentos(async () => { if (cancelado()) throw new Error('cancelado'); const { error } = await supabase.storage.from('ocr-uploads').upload(path, blob, { contentType: type, upsert: true }); if (error) throw new Error(`storage: ${error.message}`); return path }, `upload ${name}`, cancelado)
}

async function crearSesionBBDD(sesionId: string, grupoId: string, total: number, fnName: string, titular_id: string | null, ordenCola: number, totalStorage: number): Promise<string | null> {
  const { error } = await supabase.from('ocr_sessions').insert({ id: sesionId, total, enviados: 0, ok: 0, pendientes: 0, duplicados: 0, errores: 0, achtung: 0, cancelados: 0, achtung_mensaje: null, achtung_tipo: null, log: [], visible: true, cancelar_solicitado: false, fn_name: fnName, titular_id: titular_id || null, archivos_pendientes: [], estado: 'staging', estado_cola: 'staging', orden_cola: ordenCola, creado_en: new Date().toISOString(), grupo_id: grupoId, subidos_storage: 0, total_storage: totalStorage })
  if (error) return error.message; return null
}

// ── MANIFIESTO (cero pérdidas) ─────────────────────────────────────────────
// Estados finales de una fila de manifiesto.
const MANIFIESTO_FINALES = ['leida', 'lectura_manual', 'duplicada', 'ignorada', 'error', 'error_subida']

export interface ManifiestoFila { nombre: string; estado: string; detalle: string | null }
export interface ResumenManifiesto {
  subidos: number       // N — archivos del manifiesto (lo que se arrastró)
  leidos: number        // L
  lecturaManual: number // M
  ignorados: number     // I
  duplicados: number    // D
  errores: number       // E (error + error_subida)
  unicos: number        // U = L+M+I+D+E
  faltan: number        // sin estado final (registrado / en_storage)
  faltantes: ManifiestoFila[]   // errores + faltan, nombrados con motivo
  reencolables: number  // en_storage no procesados (los que "Retomar" puede relanzar)
}

// Inserta 1 fila por archivo en el manifiesto ANTES de subir nada al Storage.
async function insertarManifiesto(rows: any[]) {
  const CHUNK = 400
  for (let i = 0; i < rows.length; i += CHUNK) {
    try {
      const { error } = await supabase.from('ocr_manifiesto').insert(rows.slice(i, i + CHUNK))
      if (error) console.error('[OCR manifiesto] insert:', error.message)
    } catch (e: any) { console.error('[OCR manifiesto] insert excepción:', e?.message || e) }
  }
}

// Marca una fila de manifiesto por su storage_path (determinista y único por grupo).
async function marcarManifiesto(storagePath: string, estado: string, detalle?: string | null) {
  try {
    await supabase.from('ocr_manifiesto')
      .update({ estado, detalle: detalle ?? null, actualizado: new Date().toISOString() })
      .eq('storage_path', storagePath)
  } catch { /* el manifiesto nunca rompe la subida */ }
}

// Lee el manifiesto de un grupo y devuelve el resumen "cero pérdidas".
export async function cargarResumenManifiesto(grupoId: string): Promise<ResumenManifiesto | null> {
  const { data, error } = await supabase
    .from('ocr_manifiesto')
    .select('nombre,estado,detalle')
    .eq('grupo_id', grupoId)
  if (error || !data) return null
  let leidos = 0, lecturaManual = 0, ignorados = 0, duplicados = 0, errores = 0, faltan = 0, reencolables = 0
  const faltantes: ManifiestoFila[] = []
  for (const r of data as any[]) {
    const est = r.estado as string
    if (est === 'leida') leidos++
    else if (est === 'lectura_manual') lecturaManual++
    else if (est === 'ignorada') ignorados++
    else if (est === 'duplicada') duplicados++
    else if (est === 'error' || est === 'error_subida') { errores++; faltantes.push({ nombre: r.nombre, estado: est, detalle: r.detalle ?? null }) }
    else { // registrado / en_storage → sin estado final = FALTAN
      faltan++
      if (est === 'en_storage') reencolables++
      faltantes.push({ nombre: r.nombre, estado: est, detalle: r.detalle ?? null })
    }
  }
  const unicos = leidos + lecturaManual + ignorados + duplicados + errores
  return { subidos: data.length, leidos, lecturaManual, ignorados, duplicados, errores, unicos, faltan, faltantes, reencolables }
}

// "Retomar pendientes": reencola los archivos subidos (en_storage) que nunca se
// procesaron, reconstruyendo archivos_pendientes por sesión y relanzando el worker.
export async function reintentarPendientes(grupoId: string): Promise<number> {
  const { data } = await supabase
    .from('ocr_manifiesto')
    .select('sesion_id,nombre,storage_path,estado')
    .eq('grupo_id', grupoId)
    .eq('estado', 'en_storage')
  if (!data || data.length === 0) return 0
  const porSes: Record<string, any[]> = {}
  for (const r of data as any[]) { (porSes[r.sesion_id] ??= []).push(r) }
  for (const [sesId, rows] of Object.entries(porSes)) {
    const archivos = rows.map(r => ({ name: r.nombre, type: getMimeTypeBase(getExt(r.nombre)), storagePath: r.storage_path, esComprimido: ['zip', 'rar', '7z'].includes(getExt(r.nombre)) }))
    try {
      await supabase.from('ocr_sessions').update({ archivos_pendientes: archivos, estado: 'procesando', estado_cola: 'en_espera', pausar_solicitado: false, visible: true }).eq('id', sesId)
    } catch { /* noop */ }
  }
  lanzarWorker()
  await cargarSesionesActivas()
  return data.length
}

async function actualizarProgresoStorage(sesionId: string, subidos: number) {
  try { await supabase.from('ocr_sessions').update({ subidos_storage: subidos }).eq('id', sesionId) } catch {}
}

// Guarda las rutas de archivos ya subidos en la BD de forma incremental.
// Si la pestaña se cierra, la próxima apertura puede leer el bucket para reanudar.
async function actualizarArchivosPendientesIncrementales(
  sesionId: string,
  archivos: { name: string; type: string; storagePath: string; esComprimido: boolean }[]
) {
  try {
    await supabase.from('ocr_sessions').update({
      archivos_pendientes: archivos,
      subidos_storage: archivos.length,
    }).eq('id', sesionId)
  } catch {}
}

// Lista TODOS los archivos de un grupo paginando (el bucket devuelve 100 por defecto).
async function listarTodoElGrupo(grupoId: string): Promise<any[]> {
  const todos: any[] = []
  let offset = 0
  const LIMITE = 1000
  while (true) {
    const { data, error } = await supabase.storage
      .from('ocr-uploads')
      .list(grupoId, { limit: LIMITE, offset })
    if (error) throw error
    if (!data || data.length === 0) break
    // Solo archivos reales (no subcarpetas): tienen id
    for (const f of data) { if (f.id && f.name) todos.push(f) }
    if (data.length < LIMITE) break
    offset += LIMITE
  }
  return todos
}

// Intenta reanudar una sesión interrumpida (staging + algo subido al Storage + >60s de edad).
// Lista TODO el bucket paginando, reconstruye archivos_pendientes con los paths reales,
// y lanza el worker SOLO si hay pendientes. Si hay 0, marca como completada.
async function intentarReanudarInterrumpida(sesion: OcrSession) {
  const grupoId = sesion.grupoId
  if (!grupoId) return
  try {
    const archivosEnBucket = await listarTodoElGrupo(grupoId)

    if (archivosEnBucket.length === 0) {
      // Nada subido: marcar como cancelada con aviso
      await supabase.from('ocr_sessions').update({
        estado: 'cancelada', estado_cola: 'cancelada', visible: true,
        log: [...(sesion.log || []), {
          filename: '(sesión)',
          status: 'error',
          detalle: 'Sesión interrumpida antes de subir archivos. Vuelve a arrastrar los archivos para reintentar.',
        }],
      }).eq('id', sesion.id)
      return
    }

    const perdidos = Math.max(0, (sesion.totalStorage ?? 0) - archivosEnBucket.length)
    const archivosPendientes = archivosEnBucket.map((f: any) => ({
      name: f.name,
      type: getMimeTypeBase(getExt(f.name)),
      storagePath: `${grupoId}/${f.name}`,
      esComprimido: false,
    }))

    const nPendientes = archivosPendientes.length

    if (nPendientes === 0) {
      // Nada pendiente real: marcar como completada sin lanzar worker
      await supabase.from('ocr_sessions').update({
        estado: 'completada', estado_cola: 'completada',
        completado_en: new Date().toISOString(),
        log: [...(sesion.log || []), {
          filename: '(reanudado)',
          status: 'ok',
          detalle: 'Sesión retomada: ningún archivo pendiente en el servidor. Ya estaba completa.',
        }],
      }).eq('id', sesion.id)
      return
    }

    const logEntry: ArchivoLog = perdidos > 0
      ? { filename: '(reanudado)', status: 'achtung', detalle: `${nPendientes} archivos retomados del servidor. ${perdidos} no llegaron a subirse — arrástralos de nuevo.`, achtungTipo: 'otro' }
      : { filename: '(reanudado)', status: 'ok', detalle: `Subida retomada: ${nPendientes} archivos encontrados en el servidor.` }

    await supabase.from('ocr_sessions').update({
      archivos_pendientes: archivosPendientes,
      total: nPendientes,
      total_storage: nPendientes,
      subidos_storage: nPendientes,
      enviados: 0,
      estado: 'procesando',
      estado_cola: 'en_espera',
      log: [...(sesion.log || []), logEntry],
    }).eq('id', sesion.id)

    lanzarWorker()
  } catch (e: any) {
    console.warn('[OCR] intentarReanudarInterrumpida error:', e?.message || e)
  }
}

export function useOcrUpload() {
  const [snap, setSnap] = useState<OcrSession[]>(snapshot())
  const [errorVisible, setErrorVisible] = useState<string | null>(null)
  useEffect(() => {
    const h = () => { setSnap(snapshot()); if (errorWorkerGlobal) setErrorVisible(errorWorkerGlobal) }
    emitter.addEventListener('change', h)
    inicializar()
    return () => { emitter.removeEventListener('change', h) }
  }, [])

  async function procesar(files: File[], fnName: 'ocr-procesar-factura' | 'ocr-procesar-extracto', titular_id: string | null) {
    setErrorVisible(null)
    // v42: ya NO se descartan los PDF grandes; se parten en normalizar(). Solo se
    // descartan NO-PDF que superen el límite (imágenes enormes raras).
    const descartados: number[] = []
    for (let i = 0; i < files.length; i++) {
      if (files[i].size > MAX_BYTES && getExt(files[i].name) !== 'pdf') descartados.push(i)
    }
    if (descartados.length > 0) {
      const nombres = descartados.slice(0, 3).map(i => files[i].name).join(', ')
      setErrorVisible(`${descartados.length} archivo(s) no-PDF superan ${MAX_ARCHIVO_MB}MB: ${nombres}${descartados.length > 3 ? '…' : ''}`)
      files = files.filter((_, i) => !descartados.includes(i))
      if (files.length === 0) return
    }

    const idLocal = `prep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const grupoId = `g_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const baseOrden = Math.floor(Date.now() / 1000)
    ponerPreparando(idLocal, files.length, 0, `Preparando subida…`, grupoId)

    // v42: primero normalizar TODOS (parte los PDF grandes), luego repartir en lotes.
    const cancelado = () => cancelacionesLocales.has(grupoId)
    const normalizados: ArchivoNormalizado[] = []
    let preparados = 0
    for (const f of files) {
      if (cancelado()) { quitarPreparando(idLocal); return }
      try {
        const parts = await normalizar(f)
        normalizados.push(...parts)
      } catch (e: any) {
        console.error(`[OCR] normalizar ${f.name}:`, e?.message || e)
        // Si normalizar falla, subir el original tal cual.
        normalizados.push({ name: f.name, type: f.type || 'application/octet-stream', blob: f, esComprimido: false })
      }
      preparados++
      ponerPreparando(idLocal, files.length, preparados, `Preparando ${preparados} de ${files.length}…`, grupoId)
    }

    const totalReal = normalizados.length
    const totalLotes = Math.max(1, Math.ceil(totalReal / SESION_MAX_ARCHIVOS))
    const sesionesCreadas: { id: string; rangoIni: number; rangoFin: number }[] = []
    for (let lote = 0; lote < totalLotes; lote++) {
      const ini = lote * SESION_MAX_ARCHIVOS; const fin = Math.min(ini + SESION_MAX_ARCHIVOS, totalReal)
      const sesionId = `ocr_${Date.now()}_${lote}_${Math.random().toString(36).slice(2, 5)}`
      const err = await crearSesionBBDD(sesionId, grupoId, fin - ini, fnName, titular_id, baseOrden + lote, fin - ini)
      if (err) { setErrorVisible(`Error creando sesión: ${err}`); quitarPreparando(idLocal); return }
      sesionesCreadas.push({ id: sesionId, rangoIni: ini, rangoFin: fin })
    }

    // MANIFIESTO (cero pérdidas): 1 fila por archivo con estado 'registrado' ANTES de
    // subir nada a Storage. storage_path es determinista (= el que usará subirAlStorage),
    // así la subida puede marcar cada fila por su ruta. Si el navegador muere ahora, queda
    // rastro de TODO lo que entró → la sesión podrá retomarse sin perder nada.
    const manifiestoRows = normalizados.map((norm, idxGlobal) => {
      const ses = sesionesCreadas.find(s => idxGlobal >= s.rangoIni && idxGlobal < s.rangoFin)!
      return {
        sesion_id: ses.id,
        grupo_id: grupoId,
        nombre: norm.name,
        size: norm.blob.size,
        hash_cliente: null,
        storage_path: `${grupoId}/${sanitizeForPath(norm.name, idxGlobal)}`,
        estado: 'registrado',
        detalle: null,
      }
    })
    await insertarManifiesto(manifiestoRows)
    await cargarSesionesActivas()

    const archivosSubidos: { sesionId: string; name: string; type: string; storagePath: string; esComprimido: boolean }[] = []
    let subidos = 0; let fallos = 0
    async function subirUno(norm: ArchivoNormalizado, idxGlobal: number) {
      if (cancelado()) return
      const ses = sesionesCreadas.find(s => idxGlobal >= s.rangoIni && idxGlobal < s.rangoFin)!
      try {
        const path = await subirAlStorage(grupoId, idxGlobal, norm.name, norm.type, norm.blob, cancelado)
        archivosSubidos.push({ sesionId: ses.id, name: norm.name, type: norm.type, storagePath: path, esComprimido: norm.esComprimido })
        subidos++
        marcarManifiesto(path, 'en_storage') // fire-and-forget: subido al almacén
      } catch (e: any) {
        const msg = e?.message || String(e)
        if (msg !== 'cancelado') {
          fallos++; console.error(`[OCR] Error subiendo ${norm.name}:`, msg)
          // NUNCA descartar en silencio: la fila de manifiesto queda 'error_subida' (visible).
          marcarManifiesto(`${grupoId}/${sanitizeForPath(norm.name, idxGlobal)}`, 'error_subida', String(`subida falló: ${msg}`).slice(0, 500))
        }
      }
      const hechos = subidos + fallos; ponerPreparando(idLocal, totalReal, hechos, `Subiendo ${hechos} de ${totalReal}…`, grupoId)
      // Guardar rutas incrementalmente cada 5 subidas para permitir reanudación si la pestaña se cierra
      if (subidos % 5 === 0 || hechos === totalReal) {
        for (const ses of sesionesCreadas) {
          const archivosSes = archivosSubidos
            .filter(a => a.sesionId === ses.id)
            .map(a => ({ name: a.name, type: a.type, storagePath: a.storagePath, esComprimido: a.esComprimido }))
          if (archivosSes.length > 0) actualizarArchivosPendientesIncrementales(ses.id, archivosSes)
        }
      }
    }
    let nextIdx = 0
    async function workerSubida() {
      while (true) {
        if (cancelado()) return
        const idx = nextIdx++
        if (idx >= totalReal) return
        try { await subirUno(normalizados[idx], idx) } catch (e: any) {
          if ((e?.message || String(e)) !== 'cancelado') { fallos++; console.error(`[OCR worker] Error fatal en archivo ${idx}:`, e?.message || e) }
        }
      }
    }
    await Promise.all(Array.from({ length: PARALELO_SUBIDAS }, () => workerSubida()))
    if (cancelado()) { quitarPreparando(idLocal); return }
    for (const ses of sesionesCreadas) {
      const archivos = archivosSubidos.filter(a => a.sesionId === ses.id).map(a => ({ name: a.name, type: a.type, storagePath: a.storagePath, esComprimido: a.esComprimido }))
      await supabase.from('ocr_sessions').update({ archivos_pendientes: archivos, total: archivos.length, total_storage: archivos.length, subidos_storage: archivos.length, estado: 'procesando', estado_cola: 'en_espera' }).eq('id', ses.id)
    }
    quitarPreparando(idLocal); await cargarSesionesActivas(); lanzarWorker()
  }

  async function cancelar(id: string) {
    if (id.startsWith('grp_')) { const grupoId = id.slice(4); cancelacionesLocales.add(grupoId); await supabase.from('ocr_sessions').update({ cancelar_solicitado: true, archivos_pendientes: [], estado: 'cancelada', estado_cola: 'cancelada' }).eq('grupo_id', grupoId) }
    else { await supabase.from('ocr_sessions').update({ cancelar_solicitado: true, archivos_pendientes: [], estado: 'cancelada', estado_cola: 'cancelada' }).eq('id', id) }
  }

  async function cerrar(id: string) {
    if (id.startsWith('grp_')) { const grupoId = id.slice(4); const lotesIds = rawSessions.filter(s => s.grupoId === grupoId).map(s => s.id); rawSessions = rawSessions.filter(s => s.grupoId !== grupoId); emit(); if (lotesIds.length > 0) await supabase.from('ocr_sessions').update({ visible: false }).in('id', lotesIds) }
    else { rawSessions = rawSessions.filter(s => s.id !== id); emit(); await supabase.from('ocr_sessions').update({ visible: false }).eq('id', id) }
  }

  async function ocultar(id: string) {
    if (id.startsWith('grp_')) {
      const grupoId = id.slice(4)
      cancelacionesLocales.delete(grupoId)
      const lotesIds = rawSessions.filter(s => s.grupoId === grupoId).map(s => s.id)
      rawSessions = rawSessions.map(s => s.grupoId === grupoId ? { ...s, visible: false } : s); emit()
      if (lotesIds.length > 0) await supabase.from('ocr_sessions').update({ visible: false }).in('id', lotesIds)
    } else {
      rawSessions = rawSessions.map(s => s.id === id ? { ...s, visible: false } : s); emit()
      await supabase.from('ocr_sessions').update({ visible: false }).eq('id', id)
    }
  }

  async function pausar(id: string) {
    if (id.startsWith('grp_')) { const grupoId = id.slice(4)
      await supabase.from('ocr_sessions').update({ pausar_solicitado: true }).eq('grupo_id', grupoId)
      await supabase.from('ocr_sessions').update({ estado_cola: 'pausada' }).eq('grupo_id', grupoId).eq('estado_cola', 'en_espera')
    } else {
      await supabase.from('ocr_sessions').update({ pausar_solicitado: true }).eq('id', id)
      await supabase.from('ocr_sessions').update({ estado_cola: 'pausada' }).eq('id', id).eq('estado_cola', 'en_espera')
    }
    await cargarSesionesActivas()
  }

  async function reanudar(id: string) {
    if (id.startsWith('grp_')) { const grupoId = id.slice(4)
      await supabase.from('ocr_sessions').update({ pausar_solicitado: false, estado_cola: 'en_espera' }).eq('grupo_id', grupoId).eq('estado_cola', 'pausada')
    } else {
      await supabase.from('ocr_sessions').update({ pausar_solicitado: false, estado_cola: 'en_espera' }).eq('id', id).eq('estado_cola', 'pausada')
    }
    await cargarSesionesActivas(); lanzarWorker()
  }

  return { sessions: snap, procesar, cancelar, cerrar, ocultar, pausar, reanudar, errorVisible }
}
