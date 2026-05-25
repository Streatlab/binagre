// ocrUploadStore v32 — Upload-first: persistencia total en Storage+BBDD
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface ArchivoLog { filename: string; status: 'ok' | 'duplicado' | 'pendiente' | 'error' | 'achtung' | 'cancelado'; detalle: string; achtungTipo?: 'creditos' | 'api_key' | 'modelo' | 'otro' }
export interface OcrSession { id: string; total: number; enviados: number; ok: number; pendientes: number; duplicados: number; errores: number; achtung: number; cancelados: number; achtungMensaje: string | null; achtungTipo: 'creditos' | 'api_key' | 'modelo' | 'otro' | null; log: ArchivoLog[]; visible: boolean; procesando: boolean; cancelado: boolean; fnName: 'ocr-procesar-factura' | 'ocr-procesar-extracto' | null; titular_id: string | null; archivosPendientes: any[]; creadoEn: number; completadoEn: number | null; orden: number; archivoActual?: string | null; grupoId?: string | null; lotesIds?: string[]; subidosStorage?: number; totalStorage?: number }

const emitter = new EventTarget()
let rawSessions: OcrSession[] = []
let preparandoLocal: OcrSession[] = []
let inicializado = false
let realtimeChannel: any = null
let pollTimer: number | null = null
let cancelacionesLocales: Set<string> = new Set()
const SESION_MAX_ARCHIVOS = 500
const PARALELO_SUBIDAS = 6
const TOAST_COMPLETADO_MS = 20000
const RETRY_BASE_MS = 2000
const RETRY_CAP_MS = 30000
const ERRORES_PERMANENTES = ['Bucket not found', 'ya existe']

function emit() { emitter.dispatchEvent(new CustomEvent('change')) }
function getExt(name: string) { return name.split('.').pop()?.toLowerCase() ?? '' }
function esErrorPermanente(msg: string): boolean { return ERRORES_PERMANENTES.some(p => msg.includes(p)) }
function esperar(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)) }

async function conReintentos<T>(fn: () => Promise<T>, label: string, cancelado: () => boolean): Promise<T> {
  let intento = 0
  while (true) {
    if (cancelado()) throw new Error('cancelado')
    try { return await fn() } catch (e: any) {
      const msg = e?.message || String(e)
      if (msg === 'cancelado') throw e
      if (esErrorPermanente(msg)) throw e
      const wait = Math.min(RETRY_BASE_MS * Math.pow(2, Math.min(intento, 10)), RETRY_CAP_MS)
      console.warn(`[OCR retry] ${label} intento ${intento + 1} falló: ${msg}. Reintentando en ${wait}ms…`)
      await esperar(wait); intento++
    }
  }
}

async function cargarSheetJS(): Promise<any> { if ((window as any).XLSX) return (window as any).XLSX; await new Promise<void>((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = () => res(); s.onerror = () => rej(new Error('SheetJS')); document.head.appendChild(s) }); return (window as any).XLSX }
async function cargarMammoth(): Promise<any> { if ((window as any).mammoth) return (window as any).mammoth; await new Promise<void>((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'; s.onload = () => res(); s.onerror = () => rej(new Error('Mammoth')); document.head.appendChild(s) }); return (window as any).mammoth }

async function excelACSV(file: File | Blob): Promise<string> {
  const XLSX = await cargarSheetJS(); const buf = await file.arrayBuffer(); const wb = XLSX.read(buf, { type: 'array', cellDates: true }); const partes: string[] = []
  for (const sheetName of wb.SheetNames) { const ws = wb.Sheets[sheetName]; const ref = ws['!ref']; if (ref) { const range = XLSX.utils.decode_range(ref); for (let R = range.s.r; R <= range.e.r; R++) { for (let C = range.s.c; C <= range.e.c; C++) { const addr = XLSX.utils.encode_cell({ r: R, c: C }); const cell = ws[addr]; if (!cell) continue; if (cell.t === 'd' && cell.v instanceof Date) { const d = cell.v as Date; cell.t = 's'; cell.v = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; cell.w = cell.v } } } }; const csv = XLSX.utils.sheet_to_csv(ws, { FS: ';', blankrows: false }); if (csv.trim()) partes.push(`=== ${sheetName} ===\n${csv}`) }
  return partes.join('\n\n')
}
async function docxATexto(file: File | Blob): Promise<string> { const mammoth = await cargarMammoth(); const buf = await file.arrayBuffer(); const r = await mammoth.extractRawText({ arrayBuffer: buf }); return r.value || '' }
async function docATexto(file: File | Blob): Promise<string> { const buf = await file.arrayBuffer(); const bytes = new Uint8Array(buf); let texto = ''; let buffer = ''; for (let i = 0; i < bytes.length; i++) { const b = bytes[i]; if ((b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9) { buffer += String.fromCharCode(b) } else { if (buffer.length >= 4) texto += buffer + '\n'; buffer = '' } }; if (buffer.length >= 4) texto += buffer; texto = texto.replace(/[\x00-\x1F\x7F]+/g, ' ').replace(/\s+/g, ' ').trim(); return texto }
async function htmlATexto(file: File | Blob): Promise<string> { const html = await file.text(); const div = document.createElement('div'); div.innerHTML = html; div.querySelectorAll('script,style,noscript').forEach(s => s.remove()); return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim() }

function getMimeTypeBase(ext: string): string { const map: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', tif: 'image/tiff', tiff: 'image/tiff', gif: 'image/gif', bmp: 'image/bmp', csv: 'text/csv', txt: 'text/plain', rar: 'application/x-rar-compressed', '7z': 'application/x-7z-compressed', zip: 'application/zip' }; return map[ext] ?? 'application/octet-stream' }

async function normalizar(file: File): Promise<{ name: string; type: string; blob: Blob; esComprimido: boolean }> {
  const ext = getExt(file.name)
  if (['zip', 'rar', '7z'].includes(ext)) { const t = file.type && file.type !== 'application/octet-stream' ? file.type : getMimeTypeBase(ext); return { name: file.name, type: t, blob: file, esComprimido: true } }
  if (['xlsx', 'xls'].includes(ext)) { const csv = await excelACSV(file); return { name: file.name.replace(/\.(xlsx|xls)$/i, '.csv'), type: 'text/csv', blob: new Blob([csv], { type: 'text/csv' }), esComprimido: false } }
  if (ext === 'docx') { const t = await docxATexto(file); return { name: file.name.replace(/\.docx$/i, '.txt'), type: 'text/plain', blob: new Blob([t], { type: 'text/plain' }), esComprimido: false } }
  if (ext === 'doc') { const t = await docATexto(file); return { name: file.name.replace(/\.doc$/i, '.txt'), type: 'text/plain', blob: new Blob([t], { type: 'text/plain' }), esComprimido: false } }
  if (['html', 'htm'].includes(ext)) { const t = await htmlATexto(file); return { name: file.name.replace(/\.html?$/i, '.txt'), type: 'text/plain', blob: new Blob([t], { type: 'text/plain' }), esComprimido: false } }
  const t = file.type && file.type !== 'application/octet-stream' ? file.type : getMimeTypeBase(ext); return { name: file.name, type: t, blob: file, esComprimido: false }
}

function sanitizeForPath(name: string, idx: number): string { const clean = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80); return `${String(idx).padStart(5, '0')}_${clean}` }

function dbToSession(s: any): OcrSession {
  return { id: s.id, total: s.total || 0, enviados: s.enviados || 0, ok: s.ok || 0, pendientes: s.pendientes || 0, duplicados: s.duplicados || 0, errores: s.errores || 0, achtung: s.achtung || 0, cancelados: s.cancelados || 0, achtungMensaje: s.achtung_mensaje || null, achtungTipo: s.achtung_tipo || null, log: (s.log as any[]) || [], visible: s.visible !== false, procesando: s.estado_cola === 'procesando' || s.estado_cola === 'en_espera' || s.estado_cola === 'staging', cancelado: s.estado === 'cancelada' || s.cancelar_solicitado, fnName: s.fn_name || null, titular_id: s.titular_id || null, archivosPendientes: (s.archivos_pendientes as any[]) || [], creadoEn: s.creado_en ? new Date(s.creado_en).getTime() : Date.now(), completadoEn: s.completado_en ? new Date(s.completado_en).getTime() : null, orden: s.orden_cola || 0, grupoId: s.grupo_id || null, subidosStorage: s.subidos_storage || 0, totalStorage: s.total_storage || 0 }
}

function colapsarPorGrupo(raw: OcrSession[]): OcrSession[] {
  const sueltas: OcrSession[] = []; const porGrupo: Record<string, OcrSession[]> = {}
  for (const s of raw) { if (s.grupoId) { if (!porGrupo[s.grupoId]) porGrupo[s.grupoId] = []; porGrupo[s.grupoId].push(s) } else sueltas.push(s) }
  const agregadas: OcrSession[] = Object.entries(porGrupo).map(([grupoId, lotes]) => {
    lotes.sort((a, b) => a.orden - b.orden); const algunoProcesando = lotes.some(l => l.procesando); const todosCompletados = lotes.every(l => !l.procesando && !l.cancelado); const todosCancelados = lotes.every(l => l.cancelado); const achtungL = lotes.find(l => l.achtungMensaje); const total = lotes.reduce((acc, l) => acc + l.total, 0); const enviados = lotes.reduce((acc, l) => acc + l.enviados, 0); const subidosStorage = lotes.reduce((acc, l) => acc + (l.subidosStorage || 0), 0); const totalStorage = lotes.reduce((acc, l) => acc + (l.totalStorage || 0), 0); const logAcumulado: ArchivoLog[] = []; for (const l of lotes) logAcumulado.push(...(l.log || [])); const primerLote = lotes[0]
    let archivoActual: string | null = null; if (algunoProcesando) { if (totalStorage > 0 && subidosStorage < totalStorage) { archivoActual = `Subiendo ${subidosStorage} de ${totalStorage} al servidor…` } else { archivoActual = `Procesando ${enviados} de ${total}…` } }
    return { id: `grp_${grupoId}`, total, enviados, ok: lotes.reduce((a, l) => a + l.ok, 0), pendientes: lotes.reduce((a, l) => a + l.pendientes, 0), duplicados: lotes.reduce((a, l) => a + l.duplicados, 0), errores: lotes.reduce((a, l) => a + l.errores, 0), achtung: lotes.reduce((a, l) => a + l.achtung, 0), cancelados: lotes.reduce((a, l) => a + l.cancelados, 0), achtungMensaje: achtungL?.achtungMensaje || null, achtungTipo: achtungL?.achtungTipo || null, log: logAcumulado, visible: lotes.some(l => l.visible), procesando: algunoProcesando, cancelado: todosCancelados, fnName: primerLote.fnName, titular_id: primerLote.titular_id, archivosPendientes: [], creadoEn: Math.min(...lotes.map(l => l.creadoEn)), completadoEn: todosCompletados ? Math.max(...lotes.map(l => l.completadoEn || 0)) || null : null, orden: primerLote.orden, archivoActual, grupoId, lotesIds: lotes.map(l => l.id), subidosStorage, totalStorage }
  })
  return [...agregadas, ...sueltas].sort((a, b) => a.orden - b.orden)
}

function snapshot(): OcrSession[] { return [...preparandoLocal, ...colapsarPorGrupo(rawSessions)] }

async function cargarSesionesActivas() {
  try { const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); const { data, error } = await supabase.from('ocr_sessions').select('id,total,enviados,ok,pendientes,duplicados,errores,achtung,cancelados,achtung_mensaje,achtung_tipo,log,estado,estado_cola,fn_name,titular_id,visible,cancelar_solicitado,creado_en,completado_en,orden_cola,archivos_pendientes,grupo_id,subidos_storage,total_storage').gte('creado_en', cutoff).eq('visible', true).in('estado_cola', ['staging', 'en_espera', 'procesando']).order('orden_cola', { ascending: true }); if (error) return; rawSessions = (data || []).map(dbToSession); emit() } catch {}
}

function suscribirRealtime() {
  try { if (realtimeChannel) return; realtimeChannel = supabase.channel('ocr_sessions_live').on('postgres_changes', { event: '*', schema: 'public', table: 'ocr_sessions' }, (payload: any) => { const row = payload.new || payload.old; if (!row) return; if (payload.eventType === 'DELETE') { rawSessions = rawSessions.filter(s => s.id !== row.id); emit(); return }; const next = dbToSession(payload.new); if (['completada', 'cancelada'].includes(payload.new.estado_cola) || payload.new.estado === 'error') { const ya = rawSessions.find(s => s.id === next.id); if (ya) { rawSessions = rawSessions.map(s => s.id === next.id ? { ...next, procesando: false } : s); emit(); setTimeout(() => { rawSessions = rawSessions.filter(s => s.id !== next.id); emit() }, TOAST_COMPLETADO_MS) }; return }; const existe = rawSessions.find(s => s.id === next.id); if (existe) rawSessions = rawSessions.map(s => s.id === next.id ? next : s); else rawSessions = [...rawSessions, next]; emit() }).subscribe() } catch {}
}

function lanzarPoll() { if (pollTimer) return; pollTimer = window.setInterval(() => { cargarSesionesActivas() }, 3000) }
function inicializar() { if (inicializado) return; inicializado = true; cargarSesionesActivas(); suscribirRealtime(); lanzarPoll() }
if (typeof window !== 'undefined') inicializar()
async function lanzarWorker() { try { await supabase.functions.invoke('ocr-procesar-sesion', { body: {} }) } catch {} }

function ponerPreparando(idLocal: string, total: number, hechos: number, mensaje: string) {
  const ya = preparandoLocal.find(s => s.id === idLocal); const ses: OcrSession = { id: idLocal, total, enviados: hechos, ok: 0, pendientes: 0, duplicados: 0, errores: 0, achtung: 0, cancelados: 0, achtungMensaje: null, achtungTipo: null, log: [], visible: true, procesando: true, cancelado: false, fnName: null, titular_id: null, archivosPendientes: [], creadoEn: ya?.creadoEn ?? Date.now(), completadoEn: null, orden: 0, archivoActual: mensaje }
  if (ya) preparandoLocal = preparandoLocal.map(s => s.id === idLocal ? ses : s); else preparandoLocal = [...preparandoLocal, ses]; emit()
}
function quitarPreparando(idLocal: string) { preparandoLocal = preparandoLocal.filter(s => s.id !== idLocal); emit() }

async function subirAlStorage(grupoId: string, idx: number, name: string, type: string, blob: Blob, cancelado: () => boolean): Promise<string> {
  const path = `${grupoId}/${sanitizeForPath(name, idx)}`
  return conReintentos(async () => { if (cancelado()) throw new Error('cancelado'); const { error } = await supabase.storage.from('ocr-uploads').upload(path, blob, { contentType: type, upsert: true }); if (error) throw new Error(`storage: ${error.message}`); return path }, `upload ${name}`, cancelado)
}

async function crearSesionBBDD(sesionId: string, grupoId: string, total: number, fnName: string, titular_id: string | null, ordenCola: number, totalStorage: number): Promise<string | null> {
  const { error } = await supabase.from('ocr_sessions').insert({ id: sesionId, total, enviados: 0, ok: 0, pendientes: 0, duplicados: 0, errores: 0, achtung: 0, cancelados: 0, achtung_mensaje: null, achtung_tipo: null, log: [], visible: true, cancelar_solicitado: false, fn_name: fnName, titular_id: titular_id || null, archivos_pendientes: [], estado: 'staging', estado_cola: 'staging', orden_cola: ordenCola, creado_en: new Date().toISOString(), grupo_id: grupoId, subidos_storage: 0, total_storage: totalStorage }); if (error) return error.message; return null
}

async function actualizarProgresoStorage(sesionId: string, subidos: number) {
  try { await supabase.from('ocr_sessions').update({ subidos_storage: subidos }).eq('id', sesionId) } catch {}
}

export function useOcrUpload() {
  const [snap, setSnap] = useState<OcrSession[]>(snapshot())
  const [errorVisible, setErrorVisible] = useState<string | null>(null)
  useEffect(() => { const h = () => setSnap(snapshot()); emitter.addEventListener('change', h); inicializar(); return () => emitter.removeEventListener('change', h) }, [])

  async function procesar(files: File[], fnName: 'ocr-procesar-factura' | 'ocr-procesar-extracto', titular_id: string | null) {
    setErrorVisible(null); const idLocal = `prep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; const grupoId = `g_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; const totalLotes = Math.max(1, Math.ceil(files.length / SESION_MAX_ARCHIVOS)); const baseOrden = Math.floor(Date.now() / 1000); const sesionesCreadas: { id: string; rangoIni: number; rangoFin: number }[] = []
    ponerPreparando(idLocal, files.length, 0, `Preparando subida…`)
    for (let lote = 0; lote < totalLotes; lote++) { const ini = lote * SESION_MAX_ARCHIVOS; const fin = Math.min(ini + SESION_MAX_ARCHIVOS, files.length); const sesionId = `ocr_${Date.now()}_${lote}_${Math.random().toString(36).slice(2, 5)}`; const err = await crearSesionBBDD(sesionId, grupoId, fin - ini, fnName, titular_id, baseOrden + lote, fin - ini); if (err) { setErrorVisible(`Error creando sesión: ${err}`); quitarPreparando(idLocal); return }; sesionesCreadas.push({ id: sesionId, rangoIni: ini, rangoFin: fin }) }
    await cargarSesionesActivas()
    const archivosSubidos: { sesionId: string; name: string; type: string; storagePath: string; esComprimido: boolean }[] = []; let subidos = 0; let fallos = 0; const cancelado = () => cancelacionesLocales.has(grupoId)
    async function subirUno(file: File, idxGlobal: number) { if (cancelado()) return; const ses = sesionesCreadas.find(s => idxGlobal >= s.rangoIni && idxGlobal < s.rangoFin)!; try { const norm = await normalizar(file); const path = await subirAlStorage(grupoId, idxGlobal, norm.name, norm.type, norm.blob, cancelado); archivosSubidos.push({ sesionId: ses.id, name: norm.name, type: norm.type, storagePath: path, esComprimido: norm.esComprimido }); subidos++ } catch (e: any) { const msg = e?.message || String(e); if (msg !== 'cancelado') fallos++ }; const hechos = subidos + fallos; ponerPreparando(idLocal, files.length, hechos, `Subiendo ${hechos} de ${files.length}…`); if (subidos % 10 === 0) { const porSesion: Record<string, number> = {}; for (const a of archivosSubidos) { porSesion[a.sesionId] = (porSesion[a.sesionId] || 0) + 1 }; for (const [sid, count] of Object.entries(porSesion)) { actualizarProgresoStorage(sid, count) } } }
    let nextIdx = 0; async function workerSubida() { while (true) { if (cancelado()) return; const idx = nextIdx++; if (idx >= files.length) return; await subirUno(files[idx], idx) } }
    await Promise.all(Array.from({ length: PARALELO_SUBIDAS }, () => workerSubida()))
    if (cancelado()) { quitarPreparando(idLocal); return }
    for (const ses of sesionesCreadas) { const archivos = archivosSubidos.filter(a => a.sesionId === ses.id).map(a => ({ name: a.name, type: a.type, storagePath: a.storagePath, esComprimido: a.esComprimido })); await supabase.from('ocr_sessions').update({ archivos_pendientes: archivos, total: archivos.length, total_storage: archivos.length, subidos_storage: archivos.length, estado: 'procesando', estado_cola: 'en_espera' }).eq('id', ses.id) }
    quitarPreparando(idLocal); await cargarSesionesActivas(); lanzarWorker()
  }

  async function cancelar(id: string) { if (id.startsWith('grp_')) { const grupoId = id.slice(4); cancelacionesLocales.add(grupoId); await supabase.from('ocr_sessions').update({ cancelar_solicitado: true, archivos_pendientes: [], estado: 'cancelada', estado_cola: 'cancelada' }).eq('grupo_id', grupoId) } else { await supabase.from('ocr_sessions').update({ cancelar_solicitado: true, archivos_pendientes: [], estado: 'cancelada', estado_cola: 'cancelada' }).eq('id', id) } }
  async function cerrar(id: string) { if (id.startsWith('grp_')) { const grupoId = id.slice(4); const lotesIds = rawSessions.filter(s => s.grupoId === grupoId).map(s => s.id); rawSessions = rawSessions.filter(s => s.grupoId !== grupoId); emit(); if (lotesIds.length > 0) await supabase.from('ocr_sessions').update({ visible: false }).in('id', lotesIds) } else { rawSessions = rawSessions.filter(s => s.id !== id); emit(); await supabase.from('ocr_sessions').update({ visible: false }).eq('id', id) } }
  async function ocultar(id: string) { if (id.startsWith('grp_')) { const grupoId = id.slice(4); const lotesIds = rawSessions.filter(s => s.grupoId === grupoId).map(s => s.id); rawSessions = rawSessions.map(s => s.grupoId === grupoId ? { ...s, visible: false } : s); emit(); if (lotesIds.length > 0) await supabase.from('ocr_sessions').update({ visible: false }).in('id', lotesIds) } else { rawSessions = rawSessions.map(s => s.id === id ? { ...s, visible: false } : s); emit(); await supabase.from('ocr_sessions').update({ visible: false }).eq('id', id) } }

  return { sessions: snap, procesar, cancelar, cerrar, ocultar, errorVisible }
}
