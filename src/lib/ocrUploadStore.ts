// ocrUploadStore v20 — persistencia 100% backend (ocr_sessions) + worker en edge function
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
  archivosPendientes: any[]
  creadoEn: number
  completadoEn: number | null
  orden: number
  archivoActual?: string | null
}

const emitter = new EventTarget()
let sessions: OcrSession[] = []
let inicializado = false
let realtimeChannel: any = null
let pollTimer: number | null = null

function emit() { emitter.dispatchEvent(new CustomEvent('change')) }

// === Conversores cliente: .doc/.docx/.xlsx/.html → texto ===

function getExt(name: string) { return name.split('.').pop()?.toLowerCase() ?? '' }

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
  // .doc viejo (binario) — mammoth NO lo soporta. Extraemos texto crudo legible.
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let texto = ''
  let buffer = ''
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]
    // ASCII imprimible + saltos
    if ((b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9) {
      buffer += String.fromCharCode(b)
    } else {
      if (buffer.length >= 4) texto += buffer + '\n'
      buffer = ''
    }
  }
  if (buffer.length >= 4) texto += buffer
  // Limpiar caracteres de control y dejar texto razonable
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

function utf8AB64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)))
}

function leerBase64(file: File | Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res((r.result as string).split(',')[1])
    r.onerror = () => rej(new Error('Error leyendo'))
    r.readAsDataURL(file)
  })
}

function getMimeTypeBase(ext: string): string {
  const map: Record<string, string> = {
    pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
    tif: 'image/tiff', tiff: 'image/tiff', gif: 'image/gif', bmp: 'image/bmp',
    csv: 'text/csv', txt: 'text/plain',
  }
  return map[ext] ?? 'application/octet-stream'
}

/**
 * Normaliza un archivo a algo que la edge function pueda procesar:
 * - PDF/imagen: se queda igual (base64)
 * - xlsx/xls: convertido a CSV en cliente
 * - docx: extraído a texto plano
 * - doc (binario viejo): extracción de texto crudo legible
 * - html/htm: extracción de texto plano
 * - csv/txt: texto plano
 */
async function normalizar(file: File): Promise<{ name: string; type: string; base64: string }> {
  const ext = getExt(file.name)

  if (['xlsx', 'xls'].includes(ext)) {
    const csv = await excelACSV(file)
    return { name: file.name.replace(/\.(xlsx|xls)$/i, '.csv'), type: 'text/csv', base64: utf8AB64(csv) }
  }
  if (ext === 'docx') {
    const t = await docxATexto(file)
    return { name: file.name.replace(/\.docx$/i, '.txt'), type: 'text/plain', base64: utf8AB64(t) }
  }
  if (ext === 'doc') {
    const t = await docATexto(file)
    return { name: file.name.replace(/\.doc$/i, '.txt'), type: 'text/plain', base64: utf8AB64(t) }
  }
  if (['html', 'htm'].includes(ext)) {
    const t = await htmlATexto(file)
    return { name: file.name.replace(/\.html?$/i, '.txt'), type: 'text/plain', base64: utf8AB64(t) }
  }
  if (['csv', 'txt'].includes(ext)) {
    const t = await file.text()
    return { name: file.name, type: ext === 'csv' ? 'text/csv' : 'text/plain', base64: utf8AB64(t) }
  }
  // PDF/imagen: como vienen
  const base64 = await leerBase64(file)
  const t = file.type && file.type !== 'application/octet-stream' ? file.type : getMimeTypeBase(ext)
  return { name: file.name, type: t, base64 }
}

// === Persistencia 100% BBDD ===

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
  }
}

async function cargarSesionesActivas() {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('ocr_sessions')
      .select('id,total,enviados,ok,pendientes,duplicados,errores,achtung,cancelados,achtung_mensaje,achtung_tipo,log,estado,estado_cola,fn_name,titular_id,visible,cancelar_solicitado,creado_en,completado_en,orden_cola,archivos_pendientes')
      .gte('creado_en', cutoff)
      .eq('visible', true)
      .in('estado_cola', ['en_espera', 'procesando'])
      .order('orden_cola', { ascending: true })
    if (error) return
    sessions = (data || []).map(dbToSession)
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
          sessions = sessions.filter(s => s.id !== row.id)
          emit()
          return
        }
        const next = dbToSession(payload.new)
        // Si está completada/cancelada/error → mantenemos 10s para que se vea el resultado, luego desaparece
        if (payload.new.estado_cola === 'completada' || payload.new.estado_cola === 'cancelada' || payload.new.estado === 'error') {
          const ya = sessions.find(s => s.id === next.id)
          if (ya) {
            sessions = sessions.map(s => s.id === next.id ? { ...next, procesando: false } : s)
            emit()
            setTimeout(() => {
              sessions = sessions.filter(s => s.id !== next.id)
              emit()
            }, 10000)
          }
          return
        }
        const existe = sessions.find(s => s.id === next.id)
        if (existe) sessions = sessions.map(s => s.id === next.id ? next : s)
        else sessions = [...sessions, next]
        emit()
      })
      .subscribe()
  } catch {}
}

function lanzarPoll() {
  // Polling de respaldo cada 4s por si Realtime falla
  if (pollTimer) return
  pollTimer = window.setInterval(() => { cargarSesionesActivas() }, 4000)
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

export function useOcrUpload() {
  const [snap, setSnap] = useState<OcrSession[]>([...sessions])
  useEffect(() => {
    const h = () => setSnap([...sessions])
    emitter.addEventListener('change', h)
    inicializar()
    return () => emitter.removeEventListener('change', h)
  }, [])

  async function procesar(files: File[], fnName: 'ocr-procesar-factura' | 'ocr-procesar-extracto', titular_id: string | null) {
    // Normalizar todos los archivos en cliente (xlsx→csv, docx→txt, doc→txt, html→txt)
    const archivos: any[] = []
    const fallos: ArchivoLog[] = []
    for (const file of files) {
      try {
        const norm = await normalizar(file)
        archivos.push(norm)
      } catch (e: any) {
        fallos.push({ filename: file.name, status: 'error', detalle: `Conversión: ${e?.message || e}` })
      }
    }

    const id = `ocr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const orden = Math.floor(Date.now() / 1000)

    const { error } = await supabase.from('ocr_sessions').insert({
      id,
      total: files.length,
      enviados: fallos.length,
      ok: 0,
      pendientes: 0,
      duplicados: 0,
      errores: fallos.length,
      achtung: 0,
      cancelados: 0,
      achtung_mensaje: null,
      achtung_tipo: null,
      log: fallos,
      visible: true,
      cancelar_solicitado: false,
      fn_name: fnName,
      titular_id: titular_id || null,
      archivos_pendientes: archivos,
      estado: 'en_espera',
      estado_cola: 'en_espera',
      orden_cola: orden,
      creado_en: new Date().toISOString(),
    })
    if (error) {
      // Si falla la inserción (límite tamaño u otro), informar
      throw new Error(`No se pudo crear la sesión: ${error.message}`)
    }

    // Lanzar worker (no esperamos respuesta — se ejecuta en background del edge)
    lanzarWorker()
  }

  async function cancelar(id: string) {
    await supabase.from('ocr_sessions').update({ cancelar_solicitado: true }).eq('id', id)
  }

  async function cerrar(id: string) {
    sessions = sessions.filter(s => s.id !== id)
    emit()
    await supabase.from('ocr_sessions').update({ visible: false }).eq('id', id)
  }

  async function ocultar(id: string) {
    sessions = sessions.map(s => s.id === id ? { ...s, visible: false } : s)
    emit()
    await supabase.from('ocr_sessions').update({ visible: false }).eq('id', id)
  }

  return { sessions: snap, procesar, cancelar, cerrar, ocultar }
}
