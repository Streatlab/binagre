// ocrUploadStore v14 — persistencia BBDD + worker Supabase + Realtime
// Sesiones sobreviven a cierre navegador, visible en cualquier dispositivo
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
  archivosPendientesCount: number
  creadoEn: number
  completadoEn: number | null
}

const emitter = new EventTarget()
let sessions: OcrSession[] = []

function emit() { emitter.dispatchEvent(new CustomEvent('change')) }

function mapDbToSession(row: any): OcrSession {
  return {
    id: row.id,
    total: row.total,
    enviados: row.enviados,
    ok: row.ok,
    pendientes: row.pendientes,
    duplicados: row.duplicados,
    errores: row.errores,
    achtung: row.achtung,
    cancelados: row.cancelados ?? 0,
    achtungMensaje: row.achtung_mensaje,
    achtungTipo: row.achtung_tipo,
    log: Array.isArray(row.log) ? row.log : [],
    visible: row.visible,
    procesando: row.estado === 'procesando',
    cancelado: row.estado === 'cancelada',
    fnName: row.fn_name,
    titular_id: row.titular_id,
    archivosPendientesCount: Array.isArray(row.archivos_pendientes) ? row.archivos_pendientes.length : 0,
    creadoEn: row.creado_en ? new Date(row.creado_en).getTime() : Date.now(),
    completadoEn: row.completado_en ? new Date(row.completado_en).getTime() : null,
  }
}

async function refrescarTodas() {
  const { data } = await supabase
    .from('ocr_sessions')
    .select('*')
    .eq('visible', true)
    .gte('creado_en', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('creado_en', { ascending: false })
  if (data) {
    sessions = data.map(mapDbToSession)
    emit()
  }
}

// Suscripción Realtime: se actualiza en cualquier dispositivo
let realtimeChannel: any = null
function iniciarRealtime() {
  if (realtimeChannel) return
  realtimeChannel = supabase
    .channel('ocr_sessions_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ocr_sessions' }, () => {
      refrescarTodas()
    })
    .subscribe()
}

if (typeof window !== 'undefined') {
  refrescarTodas()
  iniciarRealtime()
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

export function useOcrUpload() {
  const [snap, setSnap] = useState<OcrSession[]>([...sessions])

  useEffect(() => {
    const handler = () => setSnap([...sessions])
    emitter.addEventListener('change', handler)
    refrescarTodas()
    iniciarRealtime()
    return () => emitter.removeEventListener('change', handler)
  }, [])

  async function procesar(
    files: File[],
    fnName: 'ocr-procesar-factura' | 'ocr-procesar-extracto',
    titular_id: string | null
  ) {
    const archivosSerial: { name: string; type: string; base64: string }[] = []
    const fallosLectura: ArchivoLog[] = []

    for (const file of files) {
      try {
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
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        fallosLectura.push({ filename: file.name, status: 'error', detalle: `Error leyendo: ${msg}` })
      }
    }

    const sessionId = `ocr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

    // Crear sesión en BBDD
    const { error: errInsert } = await supabase.from('ocr_sessions').insert({
      id: sessionId,
      total: files.length,
      enviados: fallosLectura.length,
      errores: fallosLectura.length,
      log: fallosLectura,
      archivos_pendientes: archivosSerial,
      fn_name: fnName,
      titular_id,
      estado: 'procesando',
      visible: true,
      ultimo_heartbeat: new Date().toISOString(),
    })
    if (errInsert) { console.error('Error creando sesión OCR:', errInsert); return }

    // Disparar worker en Supabase (corre en background, no bloquea)
    supabase.functions.invoke('ocr-procesar-sesion', { body: { sessionId } }).catch(err => console.error('Error invocando worker:', err))

    await refrescarTodas()
  }

  async function cancelar(id: string) {
    await supabase.from('ocr_sessions').update({ cancelar_solicitado: true }).eq('id', id)
    await refrescarTodas()
  }

  async function cerrar(id: string) {
    await supabase.from('ocr_sessions').delete().eq('id', id)
    await refrescarTodas()
  }

  async function ocultar(id: string) {
    await supabase.from('ocr_sessions').update({ visible: false }).eq('id', id)
    await refrescarTodas()
  }

  return { sessions: snap, procesar, cancelar, cerrar, ocultar }
}
