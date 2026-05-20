// ocrUploadStore v22 — persistencia 100% backend + agrupación visual de lotes
// La BBDD guarda N lotes (técnicamente necesario por tamaño) pero la UI los muestra como UNA sola sesión sumada.
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
  // Si es una sesión virtual agregada de varios lotes
  grupoId?: string | null
  lotesIds?: string[]
}

const emitter = new EventTarget()
let rawSessions: OcrSession[] = []   // lo que viene de BBDD (1 por lote)
let preparandoLocal: OcrSession[] = [] // sesiones locales mientras se preparan los lotes
let inicializado = false
let realtimeChannel: any = null
let pollTimer: number | null = null

const LOTE_MAX_ARCHIVOS = 150

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
    grupoId: s.grupo_id || null,
  }
}

/**
 * Agrupa lotes con el mismo grupo_id en una sola sesión visual con sumas.
 * Los lotes sin grupo aparecen como antes (1 toast por sesión).
 */
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
      total,
      enviados,
      ok, pendientes: pend, duplicados: dup, errores: err, achtung: ach, cancelados: can,
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
        // Si está completada/cancelada/error → la mantenemos un rato y luego se quita
        if (payload.new.estado_cola === 'completada' || payload.new.estado_cola === 'cancelada' || payload.new.estado === 'error') {
          const ya = rawSessions.find(s => s.id === next.id)
          if (ya) {
            rawSessions = rawSessions.map(s => s.id === next.id ? { ...next, procesando: false } : s)
            emit()
            setTimeout(() => {
              rawSessions = rawSessions.filter(s => s.id !== next.id)
              emit()
            }, 10000)
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

function ponerPreparando(idLocal: string, total: number, hechos: number, mensaje: string) {
  const ya = preparandoLocal.find(s => s.id === idLocal)
  const ses: OcrSession = {
    id: idLocal,
    total,
    enviados: hechos,
    ok: 0, pendientes: 0, duplicados: 0, errores: 0, achtung: 0, cancelados: 0,
    achtungMensaje: null, achtungTipo: null,
    log: [],
    visible: true,
    procesando: true,
    cancelado: false,
    fnName: null,
    titular_id: null,
    archivosPendientes: [],
    creadoEn: ya?.creadoEn ?? Date.now(),
    completadoEn: null,
    orden: 0,
    archivoActual: mensaje,
  }
  if (ya) preparandoLocal = preparandoLocal.map(s => s.id === idLocal ? ses : s)
  else preparandoLocal = [...preparandoLocal, ses]
  emit()
}

function quitarPreparando(idLocal: string) {
  preparandoLocal = preparandoLocal.filter(s => s.id !== idLocal)
  emit()
}

export function useOcrUpload() {
  const [snap, setSnap] = useState<OcrSession[]>(snapshot())
  useEffect(() => {
    const h = () => setSnap(snapshot())
    emitter.addEventListener('change', h)
    inicializar()
    return () => emitter.removeEventListener('change', h)
  }, [])

  async function procesar(files: File[], fnName: 'ocr-procesar-factura' | 'ocr-procesar-extracto', titular_id: string | null) {
    const idLocal = `prep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    ponerPreparando(idLocal, files.length, 0, `Preparando 0 de ${files.length}…`)

    // 1) Normalizar todos los archivos en cliente
    const archivos: any[] = []
    const fallos: ArchivoLog[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        const norm = await normalizar(file)
        archivos.push(norm)
      } catch (e: any) {
        fallos.push({ filename: file.name, status: 'error', detalle: `Conversión: ${e?.message || e}` })
      }
      if (i % 10 === 0 || i === files.length - 1) {
        ponerPreparando(idLocal, files.length, i + 1, `Preparando ${i + 1} de ${files.length}…`)
      }
    }

    // 2) Partir en lotes y crear una sesión por lote, todas con el MISMO grupo_id
    const grupoId = `g_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const baseOrden = Math.floor(Date.now() / 1000)
    const totalLotes = Math.max(1, Math.ceil(archivos.length / LOTE_MAX_ARCHIVOS))
    const erroresInsert: string[] = []

    for (let lote = 0; lote < totalLotes; lote++) {
      const inicio = lote * LOTE_MAX_ARCHIVOS
      const fin = Math.min(inicio + LOTE_MAX_ARCHIVOS, archivos.length)
      const slice = archivos.slice(inicio, fin)
      ponerPreparando(idLocal, files.length, files.length, `Subiendo lote ${lote + 1} de ${totalLotes}…`)

      const id = `ocr_${Date.now()}_${lote}_${Math.random().toString(36).slice(2, 5)}`
      const logLote = lote === 0 ? fallos : []
      const erroresLote = lote === 0 ? fallos.length : 0

      const { error } = await supabase.from('ocr_sessions').insert({
        id,
        total: slice.length + (lote === 0 ? fallos.length : 0),
        enviados: erroresLote,
        ok: 0,
        pendientes: 0,
        duplicados: 0,
        errores: erroresLote,
        achtung: 0,
        cancelados: 0,
        achtung_mensaje: null,
        achtung_tipo: null,
        log: logLote,
        visible: true,
        cancelar_solicitado: false,
        fn_name: fnName,
        titular_id: titular_id || null,
        archivos_pendientes: slice,
        estado: 'en_espera',
        estado_cola: 'en_espera',
        orden_cola: baseOrden + lote,
        creado_en: new Date().toISOString(),
        grupo_id: grupoId,
      })

      if (error) {
        erroresInsert.push(`Lote ${lote + 1}/${totalLotes}: ${error.message}`)
      }
    }

    quitarPreparando(idLocal)

    if (erroresInsert.length > 0) {
      throw new Error(`No se pudo crear ${erroresInsert.length} lote(s). Primero: ${erroresInsert[0]}`)
    }

    // Recargar inmediatamente para que aparezca el toast agrupado sin esperar al poll
    await cargarSesionesActivas()
    lanzarWorker()
  }

  async function cancelar(id: string) {
    // Si es virtual (grupo), cancela todos los lotes; si es real, sólo ese
    if (id.startsWith('grp_')) {
      const grupoId = id.slice(4)
      const lotesIds = rawSessions.filter(s => s.grupoId === grupoId).map(s => s.id)
      if (lotesIds.length > 0) {
        await supabase.from('ocr_sessions').update({ cancelar_solicitado: true }).in('id', lotesIds)
      }
    } else {
      await supabase.from('ocr_sessions').update({ cancelar_solicitado: true }).eq('id', id)
    }
  }

  async function cerrar(id: string) {
    if (id.startsWith('grp_')) {
      const grupoId = id.slice(4)
      const lotesIds = rawSessions.filter(s => s.grupoId === grupoId).map(s => s.id)
      rawSessions = rawSessions.filter(s => s.grupoId !== grupoId)
      emit()
      if (lotesIds.length > 0) {
        await supabase.from('ocr_sessions').update({ visible: false }).in('id', lotesIds)
      }
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
      if (lotesIds.length > 0) {
        await supabase.from('ocr_sessions').update({ visible: false }).in('id', lotesIds)
      }
    } else {
      rawSessions = rawSessions.map(s => s.id === id ? { ...s, visible: false } : s)
      emit()
      await supabase.from('ocr_sessions').update({ visible: false }).eq('id', id)
    }
  }

  return { sessions: snap, procesar, cancelar, cerrar, ocultar }
}
