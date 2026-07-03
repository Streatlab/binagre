// Worker v24: RELEVO AUTOMÁTICO (auto-encadenado) — la sesión NUNCA muere a mitad.
//  Causa raíz del parón 03/07/26: el runtime de Edge Functions tiene un límite duro de
//  tiempo por invocación. Con lotes de miles de archivos (auditoría 16k), el worker
//  moría a mitad de sesión y la sesión quedaba en 'procesando' con latido caducado.
//  Nadie volvía a invocar la función (reactivarColgadas solo corre al ser invocada),
//  así que TODO se paraba hasta que un humano lo tocaba.
//  FIX v24: (A) el worker vigila su propio reloj; antes de acercarse al límite,
//  persiste el estado, deja la sesión en 'en_espera' y SE AUTO-REINVOCA (relevo).
//  (B) tras completar o cancelar, encadena la siguiente como siempre. Resultado:
//  una cadena de invocaciones cortas que procesa lotes de cualquier tamaño sin morir.
// Worker v23: CIERRE SOLO AL 100% + manifiesto + estado 'ignorada'.
//  - Cada archivo procesado actualiza su fila de ocr_manifiesto a estado FINAL
//    (leida / lectura_manual / duplicada / ignorada / error) con detalle.
//  - ANTES de marcar la sesión 'completada': verificación contra ocr_manifiesto.
//    Si quedan filas sin estado final → se reencolan (1 vuelta) y, si tras esa vuelta
//    siguen sin procesar, se fuerzan a estado final (error / error_subida). NUNCA se
//    cierra una sesión con filas sin estado final: el cierre es 100% o no es.
//  - Nuevo estado 'ignorada' (CSV de ingresos / resúmenes): NO cuenta como duplicada.
//  - Mantiene v22 (auto-repesca a Drive al cerrar) y v20/v21 (candado + latido + pausa Drive).
// Worker v22: + AUTO-REPESCA al cerrar sesión (dispara archivar-pendientes para subir a
//  Drive lo que quedó en drive_pendiente por fallos transitorios; el usuario no pulsa nada).
// Worker v21: Drive desconectado PAUSA y conserva pendientes (Ruben).
// Worker v20: FIX reproceso en bucle (candado por sesión + latido antes de cada lote).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PARALELO = 4
const LOTE = 5
const LOG_MAX = 100
const RATE_LIMIT_BACKOFF_MS = 30000
const MAX_REINTENTOS = 3
const STORAGE_REINTENTOS = 3
const STORAGE_BACKOFF_MS = 1500
const HEARTBEAT_TIMEOUT_MS = 70 * 1000
const ARCHIVO_TIMEOUT_MS = 45 * 1000
// v24: presupuesto de tiempo por invocación. Muy por debajo del límite del runtime
// para que SIEMPRE dé tiempo a persistir + auto-reinvocarse (relevo limpio).
const MAX_RUN_MS = 4 * 60 * 1000
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VERCEL_BASE = Deno.env.get('VERCEL_PUBLIC_BASE') || 'https://binagre.vercel.app'

const EXT_VALIDAS = new Set(['pdf','png','jpg','jpeg','webp','heic','heif','tif','tiff','gif','bmp','csv','txt','doc','docx','xls','xlsx','html','htm'])
const EXT_MIME: Record<string, string> = {
  pdf:'application/pdf', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg',
  webp:'image/webp', tif:'image/tiff', tiff:'image/tiff', gif:'image/gif', bmp:'image/bmp',
  heic:'image/heic', heif:'image/heif', csv:'text/csv', txt:'text/plain',
  doc:'application/msword', docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls:'application/vnd.ms-excel', xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  html:'text/html', htm:'text/html',
}
function getExt(n: string) { return n.split('.').pop()?.toLowerCase() ?? '' }
function getMime(n: string) { return EXT_MIME[getExt(n)] ?? 'application/octet-stream' }
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }
function str(x: any): string { return typeof x === 'string' ? x : (x == null ? '' : String(x)) }
function conTimeout<T>(p: Promise<T>, ms: number, etiqueta: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timeout ${etiqueta} (${ms}ms)`)), ms))])
}

function esRateLimit(d: any): boolean { const t = str(d).toLowerCase(); return t.includes('429') || t.includes('rate_limit') || t.includes('rate limit') }
function esTransitorioStorage(msg: any): boolean { const t = str(msg).toLowerCase(); return t.includes('service unavailable') || t.includes('503') || t.includes('timeout') || t.includes('timed out') || t.includes('econnreset') || t.includes('fetch failed') }
function esDuplicadoContenido(msg: any): boolean { const t = str(msg).toLowerCase(); return t.includes('duplicate key') || t.includes('pdf_hash') || t.includes('duplicado') || t.includes('duplicada') }
function esYaRetirado(msg: any): boolean { const t = str(msg).toLowerCase(); return t.includes('object not found') || (t.includes('not_found') && t.includes('storage')) }

function detectarAchtung(d: any) {
  const t = str(d).toLowerCase()
  if (t.includes('credit balance')) return { tipo: 'creditos', mensaje: 'SIN CREDITOS ANTHROPIC' }
  if (t.includes('invalid x-api-key') || t.includes('authentication_error')) return { tipo: 'api_key', mensaje: 'API KEY ANTHROPIC INVALIDA' }
  if (t.includes('not_found_error') && t.includes('model')) return { tipo: 'modelo', mensaje: 'MODELO CLAUDE NO DISPONIBLE' }
  if (t.includes('invalid_grant') || t.includes('drive desconectado') || t.includes('reconecta google drive')) return { tipo: 'otro', mensaje: 'GOOGLE DRIVE DESCONECTADO - reconecta en Ajustes' }
  return null
}
function esAchtungGlobal(ach: { tipo: string; mensaje: string } | null): boolean {
  return !!ach && (ach.tipo === 'creditos' || ach.tipo === 'api_key' || ach.tipo === 'modelo' || (ach.tipo === 'otro' && (ach.mensaje || '').includes('DRIVE')))
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) { bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as any) }
  return btoa(bin)
}

async function descargarStorage(sb: any, storagePath: string): Promise<ArrayBuffer> {
  let ultimoErr = ''
  for (let intento = 0; intento < STORAGE_REINTENTOS; intento++) {
    try {
      const { data, error } = await conTimeout(sb.storage.from('ocr-uploads').download(storagePath), 20000, 'download')
      if (!error && data) return await data.arrayBuffer()
      ultimoErr = error?.message || 'sin datos'
    } catch (e) { ultimoErr = e instanceof Error ? e.message : String(e) }
    if (!esTransitorioStorage(ultimoErr) && intento === 0 && !ultimoErr.includes('timeout')) break
    if (intento < STORAGE_REINTENTOS - 1) await sleep(STORAGE_BACKOFF_MS * (intento + 1))
  }
  throw new Error(`storage download: ${ultimoErr}`)
}

async function leerRespuesta(res: Response): Promise<{ json: any | null; texto: string }> {
  const texto = await res.text()
  try { return { json: JSON.parse(texto), texto } } catch { return { json: null, texto } }
}

async function procesarFacturaRemoto(item: { name: string; type: string; base64: string }) {
  try {
    const url = `${VERCEL_BASE}/api/facturas?action=upload`
    const res = await conTimeout(fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: item.name, base64: item.base64, mimeType: item.type })
    }), 40000, 'upload-api')
    const { json: data, texto } = await leerRespuesta(res)
    if (!data) {
      const t = str(texto).toLowerCase()
      if (res.status === 413 || t.includes('too large') || t.includes('request en')) return { filename: item.name, status: 'error', detalle: 'Archivo demasiado grande (>20MB). Divídelo o comprímelo y vuelve a subir.' }
      return { filename: item.name, status: 'error', detalle: `Respuesta no valida del servidor (HTTP ${res.status})` }
    }
    if (!res.ok) {
      if (esDuplicadoContenido(data?.error)) return { filename: item.name, status: 'duplicado', detalle: 'Ya existe (mismo PDF)' }
      const ach = detectarAchtung(data?.error || '')
      return ach ? { filename: item.name, status: 'achtung', detalle: str(data?.error), achtungTipo: ach.tipo } : { filename: item.name, status: 'error', detalle: `HTTP ${res.status}: ${str(data?.error)}` }
    }
    if (data?.estado === 'duplicada') {
      const fe = data?.factura_existente
      let det = data?.motivo || 'Ya existía'
      if (fe) {
        const prov = str(fe.proveedor_nombre) || 'factura'
        const fecha = str(fe.fecha_factura)
        const imp = fe.total != null ? `${fe.total}€` : ''
        det = `ya existe: ${[prov, fecha, imp].filter(Boolean).join(' · ')}`
      }
      return { filename: item.name, status: 'duplicado', detalle: det }
    }
    if (data?.estado === 'ignorada') return { filename: item.name, status: 'ignorada', detalle: data?.motivo || 'no es una factura' }
    if (data?.estado === 'multi' && Array.isArray(data?.resultados)) {
      const subs = data.resultados as any[]
      const total = subs.length
      const huboOk = subs.some(s => s?.estado === 'ok')
      const nErr = subs.filter(s => s?.estado === 'error').length
      if (nErr > 0 && !huboOk) return { filename: item.name, status: 'error', detalle: `Multi-factura: ${nErr}/${total} con error` }
      return { filename: item.name, status: 'ok', detalle: `Multi-factura: ${total} factura(s)` }
    }
    if (data?.estado === 'lectura_manual') return { filename: item.name, status: 'pendiente', detalle: data?.motivo || 'Sin plantilla NIF - pendiente de plantilla (no se gasto API)' }
    if (data?.estado === 'error') {
      if (esDuplicadoContenido(data.error)) return { filename: item.name, status: 'duplicado', detalle: 'Ya existe (mismo PDF)' }
      const ach = detectarAchtung(data.error || '')
      return ach ? { filename: item.name, status: 'achtung', detalle: str(data.error), achtungTipo: ach.tipo } : { filename: item.name, status: 'error', detalle: str(data.error) || 'error' }
    }
    if (data?.estado === 'ok') {
      const fac = data.factura || {}
      const estado = String(fac.estado || '')
      if (estado === 'pendiente_titular_manual') return { filename: item.name, status: 'achtung', detalle: 'Sin titular - revisar manualmente', achtungTipo: 'otro' }
      if (estado === 'drive_pendiente') return { filename: item.name, status: 'achtung', detalle: 'Drive desconectado - reconecta en Ajustes', achtungTipo: 'otro' }
      if (estado === 'pendiente_lectura_manual') return { filename: item.name, status: 'pendiente', detalle: 'Sin plantilla NIF - pendiente de plantilla (no se gasto API)' }
      if (estado === 'pendiente_revision' || estado === 'sin_match') return { filename: item.name, status: 'pendiente', detalle: 'Pendiente de match con banco' }
      if (['asociada','conciliada','solo_drive','no_requiere','historica'].includes(estado)) return { filename: item.name, status: 'ok', detalle: estado }
      return { filename: item.name, status: 'error', detalle: `Estado inesperado: ${estado}` }
    }
    return { filename: item.name, status: 'error', detalle: 'Respuesta inesperada' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (esDuplicadoContenido(msg)) return { filename: item.name, status: 'duplicado', detalle: 'Ya existe (mismo PDF)' }
    return { filename: item.name, status: 'error', detalle: msg }
  }
}

async function procesarConReintentos(item: { name: string; type: string; base64: string }) {
  for (let intento = 0; intento <= MAX_REINTENTOS; intento++) {
    const result = await procesarFacturaRemoto(item)
    if (result.status === 'error' && esRateLimit(result.detalle) && intento < MAX_REINTENTOS) { await sleep(RATE_LIMIT_BACKOFF_MS); continue }
    return result
  }
  return { filename: item.name, status: 'error', detalle: 'Error desconocido' }
}

async function descomprimirZip(buf: ArrayBuffer): Promise<{name: string; type: string; base64: string}[]> {
  const { default: JSZip } = await import('https://esm.sh/jszip@3.10.1')
  const zip = await JSZip.loadAsync(buf)
  const archivos: {name: string; type: string; base64: string}[] = []
  for (const path of Object.keys(zip.files)) {
    const entry = zip.files[path]
    if (entry.dir) continue
    const innerName = path.split('/').pop() || path
    const ext = getExt(innerName)
    if (ext === 'zip') { const innerBuf = await entry.async('arraybuffer'); const nested = await descomprimirZip(innerBuf); archivos.push(...nested); continue }
    if (!EXT_VALIDAS.has(ext)) continue
    const innerBuf = await entry.async('arraybuffer')
    archivos.push({ name: innerName, type: getMime(innerName), base64: toBase64(innerBuf) })
  }
  return archivos
}

async function expandirViaEdgeFunction(storagePath: string, fnName: string, titular_id: string | null): Promise<{name: string; status: string; detalle: string}[]> {
  const ext = getExt(storagePath)
  try {
    const resp = await conTimeout(fetch(`${supabaseUrl}/functions/v1/ocr-expandir-archivo`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({ storagePath, fnName, titular_id }),
    }), 40000, 'expandir')
    if (!resp.ok) return [{ name: storagePath.split('/').pop() || 'archivo', status: 'error', detalle: `Formato .${ext} no soportado. Convierte a ZIP y vuelve a subir.` }]
    const data = await resp.json()
    if (data.error) return [{ name: storagePath.split('/').pop() || 'archivo', status: 'error', detalle: `Formato .${ext} no soportado. Convierte a ZIP y vuelve a subir.` }]
    return (data.resultados || []).map((r: any) => ({ name: r.archivo || 'archivo', status: r.status || 'ok', detalle: r.status === 'ok' ? 'ok' : (r.razon || r.detail || 'procesado') }))
  } catch (err) {
    return [{ name: storagePath.split('/').pop() || 'archivo', status: 'error', detalle: `Formato .${ext} no soportado. Convierte a ZIP y vuelve a subir.` }]
  }
}

async function borrarDelStorage(sb: any, storagePath: string, resultados: any[]) {
  const todosBien = resultados.every(r => r.status === 'ok' || r.status === 'duplicado' || r.status === 'pendiente')
  if (!todosBien) return
  try { await sb.storage.from('ocr-uploads').remove([storagePath]) } catch {}
}

function esComprimidoItem(item: any): boolean { const ext = getExt(item.name || ''); return item.esComprimido || ['zip','rar','7z'].includes(ext) }

async function procesarExtractoRemoto(item: { name: string; type: string; base64: string }, titular_id: string | null) {
  try {
    const resp = await conTimeout(fetch(`${supabaseUrl}/functions/v1/ocr-procesar-extracto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({ fileBase64: item.base64, filename: item.name, mimeType: item.type, titular_id }),
    }), 120000, 'extracto')
    const texto = await resp.text()
    if (!resp.ok) {
      if (esRateLimit(texto)) return { filename: item.name, status: 'error', detalle: `429 rate limit: ${texto.slice(0, 120)}` }
      return { filename: item.name, status: 'error', detalle: texto.slice(0, 200) || `HTTP ${resp.status}` }
    }
    let data: any = {}
    try { data = JSON.parse(texto) } catch { /* respuesta no-JSON */ }
    const ins = Number(data?.insertados ?? 0)
    const tot = Number(data?.total ?? 0)
    const salt = Number(data?.saltados ?? 0)
    if (ins === 0 && tot === 0) return { filename: item.name, status: 'pendiente', detalle: 'No se detectaron movimientos en el extracto' }
    if (ins === 0 && salt > 0) return { filename: item.name, status: 'duplicado', detalle: `Extracto ya importado (${salt} movimiento(s))` }
    return { filename: item.name, status: 'ok', detalle: `Extracto: ${ins} movimiento(s)${salt ? `, ${salt} ya existían` : ''}` }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (esDuplicadoContenido(msg)) return { filename: item.name, status: 'duplicado', detalle: 'Ya existe (mismo contenido)' }
    return { filename: item.name, status: 'error', detalle: msg }
  }
}

async function procesarItemNormal(sb: any, item: any, fnName: string, titular: string | null) {
  try {
    const buf = await descargarStorage(sb, item.storagePath)
    const base64 = toBase64(buf)
    // Enrutado por origen: la pestaña de Extractos bancarios SIEMPRE procesa como extracto,
    // nunca como factura. Cualquier otra pestaña usa el pipeline de factura.
    const result = fnName === 'ocr-procesar-extracto'
      ? await procesarExtractoRemoto({ name: item.name, type: item.type, base64 }, titular)
      : await procesarConReintentos({ name: item.name, type: item.type, base64 })
    if (item.storagePath) await borrarDelStorage(sb, item.storagePath, [result])
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (esDuplicadoContenido(msg)) return { filename: item.name, status: 'duplicado', detalle: 'Ya existe (mismo PDF)' }
    if (esYaRetirado(msg)) return { filename: item.name, status: 'duplicado', detalle: 'Ya procesado (archivo retirado del almacen)' }
    return { filename: item.name, status: 'error', detalle: msg }
  }
}

async function procesarItemComprimido(sb: any, item: any, fnName: string, titular: string | null): Promise<any[]> {
  const ext = getExt(item.name || '')
  const out: any[] = []
  if (ext === 'zip') {
    try {
      const buf = await descargarStorage(sb, item.storagePath)
      const internos = await descomprimirZip(buf)
      for (let i = 0; i < internos.length; i += PARALELO) {
        const blk = internos.slice(i, i + PARALELO)
        const rs = await Promise.all(blk.map(ai => fnName === 'ocr-procesar-extracto' ? procesarExtractoRemoto(ai, titular) : procesarConReintentos(ai)))
        out.push(...rs)
      }
      if (item.storagePath) await borrarDelStorage(sb, item.storagePath, out)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (esDuplicadoContenido(msg)) out.push({ filename: item.name, status: 'duplicado', detalle: 'Ya existe (mismo PDF)' })
      else if (esYaRetirado(msg)) out.push({ filename: item.name, status: 'duplicado', detalle: 'Ya procesado (archivo retirado del almacen)' })
      else out.push({ filename: item.name, status: 'error', detalle: `ZIP: ${msg}` })
    }
  } else {
    const r = await expandirViaEdgeFunction(item.storagePath, fnName, titular)
    for (const e of r) out.push({ filename: e.name, status: e.status === 'ok' ? 'ok' : e.status === 'ignorado' ? 'ok' : 'error', detalle: e.detalle })
  }
  return out
}

async function encadenarSiguiente() {
  const sb = createClient(supabaseUrl, serviceKey)
  const { data: siguiente } = await sb.from('ocr_sessions').select('id').eq('estado_cola', 'en_espera').eq('pausar_solicitado', false).order('orden_cola', { ascending: true }).limit(1).maybeSingle()
  if (siguiente) {
    fetch(`${supabaseUrl}/functions/v1/ocr-procesar-sesion`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({ sessionId: siguiente.id })
    }).catch(() => {})
  }
}

// v24: RELEVO. Persiste el estado actual, deja la sesión lista para retomar
// ('en_espera') y se auto-reinvoca con la MISMA sesión. La nueva invocación
// continúa exactamente por donde iba (archivos_pendientes ya persistidos).
async function pasarRelevo(sessionId: string) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/ocr-procesar-sesion`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({ sessionId })
    })
  } catch { /* si falla, reactivarColgadas o el watchdog del cliente la retomarán */ }
}

// ── MANIFIESTO (cero pérdidas) ─────────────────────────────────────────────
// Estados finales de una fila de manifiesto. Solo con 0 filas NO-finales se cierra.
const MANIFIESTO_FINALES = ['leida', 'lectura_manual', 'duplicada', 'ignorada', 'error', 'error_subida']

// Mapea el status del worker → estado final de manifiesto. 'achtung'/'cancelado'
// devuelven null: NO se marcan finales (achtung global se reintenta al reanudar;
// la reconciliación los cierra si nunca resuelven). Así nada queda como 'error'
// falso (p.ej. una factura guardada en drive_pendiente que la repesca sí archiva).
function estadoManifiesto(status: string): string | null {
  switch (status) {
    case 'ok': return 'leida'
    case 'duplicado': return 'duplicada'
    case 'pendiente': return 'lectura_manual'
    case 'ignorada': return 'ignorada'
    case 'error': return 'error'
    default: return null
  }
}

async function marcarManifiesto(sb: any, sessionId: string, storagePath: string | undefined | null, status: string, detalle: any) {
  const est = estadoManifiesto(status)
  if (!est || !storagePath) return
  try {
    await sb.from('ocr_manifiesto')
      .update({ estado: est, detalle: str(detalle).slice(0, 500), actualizado: new Date().toISOString() })
      .eq('sesion_id', sessionId).eq('storage_path', storagePath)
  } catch { /* el manifiesto nunca rompe el procesado */ }
}

function esComprimidoExt(nombre: string): boolean { return ['zip', 'rar', '7z'].includes(getExt(nombre)) }

// Verificación 100%: ¿quedan filas de manifiesto sin estado final? Devuelve la lista
// de pendientes a REENCOLAR (en_storage no procesados). Cierra como final lo que no se
// puede procesar: 'registrado' sin storage → error_subida; y, si ya se reintentó una
// vez, los en_storage que sigan colgados → error. Garantiza terminación (≤1 reintento).
async function reconciliarManifiesto(sb: any, sessionId: string, yaReconciliado: boolean): Promise<any[]> {
  let noFinal: any[] = []
  try {
    const { data } = await sb.from('ocr_manifiesto')
      .select('id,nombre,storage_path,estado')
      .eq('sesion_id', sessionId)
      .not('estado', 'in', `(${MANIFIESTO_FINALES.join(',')})`)
    noFinal = data || []
  } catch { return [] }
  if (noFinal.length === 0) return []

  // Solo se reencola lo REALMENTE subido (estado 'en_storage' + ruta). Un 'registrado'
  // sin subida confirmada NO se reencola (su archivo no está en el almacén; reprocesarlo
  // lo leería como "retirado" y lo ocultaría): se cierra como 'error_subida' (visible).
  const aReencolar = noFinal.filter(r => r.estado === 'en_storage' && r.storage_path)
  const nuncaSubidos = noFinal.filter(r => r.estado !== 'en_storage')

  for (const r of nuncaSubidos) {
    try { await sb.from('ocr_manifiesto').update({ estado: 'error_subida', detalle: 'no llegó a subirse al almacén — vuelve a arrastrarlo', actualizado: new Date().toISOString() }).eq('id', r.id) } catch {}
  }

  if (aReencolar.length === 0) return []

  if (yaReconciliado) {
    // 2ª pasada: siguen colgados pese al reintento → cerrar como error (terminación dura).
    for (const r of aReencolar) {
      try { await sb.from('ocr_manifiesto').update({ estado: 'error', detalle: 'no se pudo procesar tras reintento', actualizado: new Date().toISOString() }).eq('id', r.id) } catch {}
    }
    return []
  }

  // 1ª pasada: reencolar los en_storage no procesados.
  return aReencolar.map(r => ({ name: r.nombre, type: getMime(r.nombre), storagePath: r.storage_path, esComprimido: esComprimidoExt(r.nombre) }))
}

async function trabajarSesion(sessionId: string) {
  const sb = createClient(supabaseUrl, serviceKey)
  const inicioRun = Date.now() // v24: reloj de la invocación (relevo antes del límite)
  const { data: ses0 } = await sb.from('ocr_sessions').select('*').eq('id', sessionId).single()
  if (!ses0) return
  let pendientes: any[] = [...((ses0.archivos_pendientes as any[]) || [])]
  const log: any[] = [...((ses0.log as any[]) || [])]
  const cont = { enviados: ses0.enviados || 0, ok: ses0.ok || 0, dup: ses0.duplicados || 0, pend: ses0.pendientes || 0, err: ses0.errores || 0, ach: ses0.achtung || 0, canc: ses0.cancelados || 0, ign: ses0.ignorados || 0 }
  const fnName = ses0.fn_name || 'ocr-procesar-factura'
  const titular = ses0.titular_id
  let achMsg: string | null = ses0.achtung_mensaje || null
  let achTipo: string | null = ses0.achtung_tipo || null
  let globalAchtung = false

  await sb.from('ocr_sessions').update({ estado: 'procesando', estado_cola: 'procesando', ultimo_heartbeat: new Date().toISOString() }).eq('id', sessionId)

  async function persistir(extra: Record<string, any> = {}, refrescarLatido = true) {
    const base: Record<string, any> = {
      archivos_pendientes: pendientes,
      enviados: cont.enviados, ok: cont.ok, duplicados: cont.dup, pendientes: cont.pend,
      errores: cont.err, achtung: cont.ach, cancelados: cont.canc, ignorados: cont.ign,
      log: log.slice(-LOG_MAX), achtung_mensaje: achMsg, achtung_tipo: achTipo, ...extra,
    }
    if (refrescarLatido) base.ultimo_heartbeat = new Date().toISOString()
    await sb.from('ocr_sessions').update(base).eq('id', sessionId)
  }

  function aplicar(r: any) {
    log.push(r); cont.enviados++
    if (r.status === 'ok') cont.ok++
    else if (r.status === 'duplicado') cont.dup++
    else if (r.status === 'ignorada') cont.ign++
    else if (r.status === 'pendiente') cont.pend++
    else if (r.status === 'cancelado') cont.canc++
    else if (r.status === 'achtung') {
      cont.ach++
      const ach = detectarAchtung(r.detalle)
      if (ach && !achMsg) { achMsg = ach.mensaje; achTipo = ach.tipo }
      if (esAchtungGlobal(ach)) globalAchtung = true
    } else cont.err++
  }

  // Bucle EXTERNO: tras vaciar la cola, se RECONCILIA contra el manifiesto. Si quedan
  // filas sin estado final (archivos subidos que nunca se procesaron), se reencolan y se
  // da otra vuelta. Solo se sale (y se cierra 'completada') con 0 filas sin estado final.
  let reconciliadoUnaVez = false
  while (true) {
    while (pendientes.length > 0) {
      // v24 RELEVO: si esta invocación se acerca a su límite de tiempo, persistir todo,
      // dejar la sesión 'en_espera' y auto-reinvocarse. La sesión NUNCA muere a mitad.
      if (Date.now() - inicioRun > MAX_RUN_MS) {
        await persistir({ estado: 'procesando', estado_cola: 'en_espera' }, false)
        await pasarRelevo(sessionId)
        return
      }
      const { data: chk } = await sb.from('ocr_sessions').select('cancelar_solicitado, pausar_solicitado').eq('id', sessionId).single()
      if (chk?.cancelar_solicitado) { pendientes = []; await persistir({ estado: 'cancelada', estado_cola: 'cancelada', completado_en: new Date().toISOString() }); return encadenarSiguiente() }
      if (chk?.pausar_solicitado) { await persistir({ estado: 'procesando', estado_cola: 'pausada' }); return }

      const bloque = pendientes.slice(0, LOTE)
      pendientes = pendientes.slice(bloque.length)
      // FIX v20 (A): refrescar el LATIDO al cortar el lote (antes de procesarlo, que puede tardar
      // >70s). Asi reactivarColgadas() no considera 'colgada' una sesion que en realidad esta
      // trabajando, y no la reencola para que un 2o worker reprocese los mismos archivos.
      await persistir({}, true)

      const normales = bloque.filter(it => !esComprimidoItem(it))
      const comprimidos = bloque.filter(it => esComprimidoItem(it))
      const resN = await Promise.all(normales.map(async it => {
        try { return await conTimeout(procesarItemNormal(sb, it, fnName, titular), ARCHIVO_TIMEOUT_MS, 'archivo') }
        catch (e) { const m = e instanceof Error ? e.message : String(e); return { filename: it.name, status: 'error', detalle: m } }
      }))
      // Aplicar + marcar manifiesto FINAL por archivo (orden preservado por Promise.all).
      for (let i = 0; i < resN.length; i++) {
        aplicar(resN[i])
        await marcarManifiesto(sb, sessionId, normales[i].storagePath, resN[i].status, resN[i].detalle)
      }
      for (const it of comprimidos) {
        try {
          const rs = await conTimeout(procesarItemComprimido(sb, it, fnName, titular), ARCHIVO_TIMEOUT_MS * 3, 'zip')
          for (const r of rs) aplicar(r)
          const huboErr = rs.some((r: any) => r.status === 'error' || r.status === 'achtung')
          await marcarManifiesto(sb, sessionId, it.storagePath, huboErr ? 'error' : 'ok', `comprimido: ${rs.length} interno(s)`)
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e)
          aplicar({ filename: it.name, status: 'error', detalle: m })
          await marcarManifiesto(sb, sessionId, it.storagePath, 'error', m)
        }
      }

      if (globalAchtung) {
        const esDrive = (achMsg || '').includes('DRIVE')
        if (esDrive) {
          // FIX v21: Drive desconectado NO descarta los pendientes. Se PAUSA conservando
          // archivos_pendientes (los que faltan) + se pide pausa. En cuanto se reconecte
          // Drive, con "Reanudar" la sesion CONTINUA por donde iba (no se pierde nada).
          // Los ya guardados como drive_pendiente suben a Drive solos por la repesca.
          await persistir({ estado: 'procesando', estado_cola: 'pausada', pausar_solicitado: true })
          return
        }
        // creditos/api_key/modelo: parON global (no tiene sentido seguir gastando/fallando).
        pendientes = []; await persistir({ estado: 'error', estado_cola: 'completada', completado_en: new Date().toISOString() }); return encadenarSiguiente()
      }
      await persistir({}, true)
    }

    // VERIFICACIÓN 100% (cero pérdidas): ¿quedan filas de manifiesto sin estado final?
    const refill = await reconciliarManifiesto(sb, sessionId, reconciliadoUnaVez)
    if (refill.length === 0) break
    reconciliadoUnaVez = true
    pendientes = refill
    await persistir({}, true)
  }

  await persistir({ estado: 'completada', estado_cola: 'completada', completado_en: new Date().toISOString() })
  // AUTO-REPESCA: al cerrar la sesión, dispara el barrido que sube a Drive cualquier
  // factura que quedara en drive_pendiente por un fallo transitorio de Drive durante el
  // lote. Fire-and-forget: no bloquea ni rompe el cierre. El usuario no pulsa nada.
  try { fetch(`${VERCEL_BASE}/api/facturas?action=archivar-pendientes`, { method: 'GET' }).catch(() => {}) } catch { /* noop */ }
  return encadenarSiguiente()
}

async function reactivarColgadas(sb: any) {
  const stuckCutoff = new Date(Date.now() - HEARTBEAT_TIMEOUT_MS).toISOString()
  const { data: colgadas } = await sb.from('ocr_sessions').select('id,archivos_pendientes,pausar_solicitado').eq('estado_cola', 'procesando').lt('ultimo_heartbeat', stuckCutoff)
  for (const c of (colgadas || [])) {
    if (c.pausar_solicitado) { await sb.from('ocr_sessions').update({ estado_cola: 'pausada' }).eq('id', c.id); continue }
    const pend = (c.archivos_pendientes as any[]) || []
    if (pend.length > 0) await sb.from('ocr_sessions').update({ estado_cola: 'en_espera' }).eq('id', c.id)
    else await sb.from('ocr_sessions').update({ estado: 'completada', estado_cola: 'completada', completado_en: new Date().toISOString() }).eq('id', c.id)
  }
}

Deno.serve(async (req) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const sb = createClient(supabaseUrl, serviceKey)
    const body = await req.json().catch(() => ({}))
    let sessionId = body.sessionId
    if (!sessionId) {
      await reactivarColgadas(sb)
      const vivaCutoff = new Date(Date.now() - HEARTBEAT_TIMEOUT_MS).toISOString()
      const { data: enMarcha } = await sb.from('ocr_sessions').select('id').eq('estado_cola', 'procesando').gte('ultimo_heartbeat', vivaCutoff).limit(1).maybeSingle()
      if (enMarcha) return new Response(JSON.stringify({ ok: true, ya_procesando: enMarcha.id }), { headers: { ...cors, 'Content-Type': 'application/json' } })
      const { data: enEspera } = await sb.from('ocr_sessions').select('id').eq('estado_cola', 'en_espera').eq('pausar_solicitado', false).order('orden_cola', { ascending: true }).limit(1).maybeSingle()
      if (!enEspera) return new Response(JSON.stringify({ ok: true, nada_que_hacer: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
      sessionId = enEspera.id
    }
    const vivaCutoff = new Date(Date.now() - HEARTBEAT_TIMEOUT_MS).toISOString()
    // Candado contra OTRA sesion viva (cola en serie: una sesion a la vez).
    const { data: enMarcha } = await sb.from('ocr_sessions').select('id').eq('estado_cola', 'procesando').gte('ultimo_heartbeat', vivaCutoff).neq('id', sessionId).limit(1).maybeSingle()
    if (enMarcha) return new Response(JSON.stringify({ ok: true, en_cola: sessionId, esperando_a: enMarcha.id }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    // FIX v20 (B): candado POR-SESION. Si ESTA misma sesion ya esta viva procesando, no arrancar
    // un 2o worker sobre ella (esa doble entrada era la que releia la lista y reprocesaba).
    const { data: yo } = await sb.from('ocr_sessions').select('estado_cola, ultimo_heartbeat').eq('id', sessionId).maybeSingle()
    if (yo?.estado_cola === 'procesando' && yo.ultimo_heartbeat && yo.ultimo_heartbeat >= vivaCutoff) {
      return new Response(JSON.stringify({ ok: true, ya_procesando: sessionId }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }
    // Marcar procesando + latido ATOMICAMENTE antes de arrancar, para cerrar la ventana en la que
    // dos invocaciones casi simultaneas podrian arrancar dos workers sobre la misma sesion.
    await sb.from('ocr_sessions').update({ estado: 'procesando', estado_cola: 'procesando', ultimo_heartbeat: new Date().toISOString() }).eq('id', sessionId)
    EdgeRuntime.waitUntil(trabajarSesion(sessionId))
    return new Response(JSON.stringify({ ok: true, sessionId }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
