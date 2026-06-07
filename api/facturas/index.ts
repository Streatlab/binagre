/**
 * Dispatcher consolidado de /api/facturas
 *
 * Rutas soportadas:
 *   GET  /api/facturas                          → lista de facturas (rango)
 *   GET  /api/facturas?action=buscar-cargos     → buscar cargos en conciliación
 *   GET  /api/facturas?action=faltantes         → facturas faltantes
 *   GET  /api/facturas?action=resubir-drive     → listado pdf sin drive_id
 *   GET  /api/facturas?action=reproc            → reprocesado masivo 0 API (lote + auto-encadenado)
 *   GET  /api/facturas?action=reasignar-titulares[&n=NN] → relee PDFs y asigna titular por NIF
 *   GET  /api/facturas?action=cartero           → cartero IMAP
 *   GET  /api/facturas?action=reconciliar-pendientes → barrido de pendientes
 *   GET  /api/facturas?action=health-ocr        → diagnóstico claves OCR de pago (Anthropic + Mistral)
 *   GET  /api/facturas?action=purgar[&lote=NN]  → borra facturas NO resueltas + Drive a papelera (lote)
 *   GET  /api/facturas?action=papelera-info[&horas=NN] → cuenta archivos en papelera reciente
 *   GET  /api/facturas?action=recuperar-papelera[&lote=NN&horas=NN] → recupera borrados (lote)
 *   GET  /api/facturas?action=archivar-pendientes[&lote=NN] → repesca: sube a Drive lo que falte (lote + auto-encadenado)
 *   POST /api/facturas?action=upload            → subir/procesar archivo
 *   POST /api/facturas?action=limpieza          → borrar facturas zombie
 *
 * El reprocesado vive aquí (no en archivo aparte) para no superar el tope de
 * Serverless Functions del plan. Cada archivo en api/ es una función.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'
import { procesarArchivo } from '../_lib/procesarArchivo.js'
import { descargarArchivoDeDrive, borrarArchivoDeDrive, restaurarArchivoDeDrive, borrarArchivoPermanente, listarPapeleraReciente, subirRespaldoADrive } from '../_lib/google-drive.js'
import { matchFactura, aplicarMatching, normalizar } from '../_lib/matching.js'
import { recogerFacturasDelCorreo } from '../_lib/gmail-cartero.js'
import { extraerTextoPDF, pdfTieneTexto } from '../_lib/extractores.js'
import { extraerTextoOCRGratis } from '../_lib/ocr-tesseract.js'
import type { ExtractedFactura } from '../_lib/ocr.js'

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
  maxDuration: 300,
}

// ── Titular por NIF (Rubén/Emilio) ─────────────────────────────────────────
const NIF_RUBEN = '21669051S'
const NIF_EMILIO = '53484832B'
const RUBEN_ID = '6ce69d55-60d0-423c-b68b-eb795a0f32fe'
const EMILIO_ID = 'c5358d43-a9cc-4f4c-b0b3-99895bdf4354'

function titularPorNifEnTexto(texto: string | null | undefined): { titularId: string; nif: string } | null {
  if (!texto) return null
  const t = texto.replace(/[\s\-.]/g, '').toUpperCase()
  if (t.includes(NIF_RUBEN)) return { titularId: RUBEN_ID, nif: NIF_RUBEN }
  if (t.includes(NIF_EMILIO)) return { titularId: EMILIO_ID, nif: NIF_EMILIO }
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action || '')

  // ── Dispatcher ────────────────────────────────────────────────────────────
  if (action === 'buscar-cargos') return buscarCargos(req, res)
  if (action === 'faltantes')     return faltantes(res)
  if (action === 'resubir-drive') return resubirDrive(res)
  if (action === 'reproc')        return reproc(req, res)
  if (action === 'reasignar-titulares') return reasignarTitulares(req, res)
  if (action === 'cartero')       return cartero(req, res)
  if (action === 'reconciliar-pendientes') return reconciliarPendientes(req, res)
  if (action === 'health-ocr')    return healthOcr(res)
  if (action === 'upload')        return upload(req, res)
  if (action === 'limpieza')      return limpieza(res)
  if (action === 'purgar')        return purgar(req, res)
  if (action === 'papelera-info') return papeleraInfo(req, res)
  if (action === 'recuperar-papelera') return recuperarPapelera(req, res)
  if (action === 'archivar-pendientes') return archivarPendientes(req, res)

  // ── GET sin action → lista de facturas ───────────────────────────────────
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  return listaFacturas(req, res)
}

// ── Handler: lista facturas ────────────────────────────────────────────────
async function listaFacturas(req: VercelRequest, res: VercelResponse) {
  const rango = String(req.query.rango || '30d')
  const desde = calcDesde(rango)

  const TOPE_FILAS = 100000
  const BLOQUE = 1000

  const columnas =
    'id, proveedor_id, proveedor_nombre, numero_factura, fecha_factura, es_recapitulativa, periodo_inicio, periodo_fin, tipo, plataforma, base_4, iva_4, base_10, iva_10, base_21, iva_21, total_base, total_iva, total, pdf_original_name, pdf_drive_id, pdf_drive_url, pdf_hash, estado, error_mensaje, ocr_confianza, mensaje_matching, created_at, facturas_gastos(id, conciliacion_id, importe_asociado, confianza_match, confirmado, conciliacion(id, fecha, importe, concepto, proveedor))'

  const filas: unknown[] = []
  let total = 0
  let offset = 0

  while (offset < TOPE_FILAS) {
    let q = supabaseAdmin
      .from('facturas')
      .select(columnas, { count: 'exact' })
      .order('fecha_factura', { ascending: false })
      .range(offset, offset + BLOQUE - 1)

    if (desde) q = q.gte('fecha_factura', desde)

    const { data, error, count } = await q
    if (error) return res.status(500).json({ error: error.message })
    if (count !== null && count !== undefined) total = count

    const lote = data || []
    filas.push(...lote)
    if (lote.length < BLOQUE) break
    offset += BLOQUE
  }

  return res.status(200).json({ data: filas, total })
}

function calcDesde(rango: string): string | null {
  const hoy = new Date()
  const d = new Date(hoy)
  switch (rango) {
    case '7d':
      d.setDate(d.getDate() - 7)
      return d.toISOString().slice(0, 10)
    case '30d':
      d.setDate(d.getDate() - 30)
      return d.toISOString().slice(0, 10)
    case 'mes':
      return new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10)
    case 'trimestre': {
      const tri = Math.floor(hoy.getMonth() / 3) * 3
      return new Date(hoy.getFullYear(), tri, 1).toISOString().slice(0, 10)
    }
    case 'anio':
      return new Date(hoy.getFullYear(), 0, 1).toISOString().slice(0, 10)
    case 'todo':
    default:
      return null
  }
}

// ── Handler: buscar cargos en conciliación ────────────────────────────────
async function buscarCargos(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const q = String(req.query.q || '').trim()

  let qb = supabaseAdmin
    .from('conciliacion')
    .select('id, fecha, concepto, importe, proveedor, categoria')
    .lt('importe', 0)
    .order('fecha', { ascending: false })
    .limit(50)

  if (q) {
    qb = qb.or(`concepto.ilike.%${q}%,proveedor.ilike.%${q}%`)
  }

  const { data, error } = await qb
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ data: data || [] })
}

// ── Handler: facturas faltantes ───────────────────────────────────────────
async function faltantes(res: VercelResponse) {
  const { data, error } = await supabaseAdmin
    .from('facturas_faltantes')
    .select('*')
    .order('periodo_ref', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })

  const faltan = data?.filter((r) => r.estado === 'falta').length ?? 0
  return res.status(200).json({ faltantes: data ?? [], count_falta: faltan })
}

// ── Handler: listado facturas sin pdf_drive_id ────────────────────────────
async function resubirDrive(res: VercelResponse) {
  const { data } = await supabaseAdmin
    .from('facturas')
    .select('id, proveedor_nombre, fecha_factura, total, titular_id, error_mensaje, estado, created_at')
    .is('pdf_drive_id', null)
    .in('estado', ['asociada', 'pendiente_revision'])
    .order('created_at', { ascending: false })

  return res.status(200).json({
    pendientes: data || [],
    total: data?.length || 0,
    instrucciones: 'Abre cada factura del listado y usa "Re-subir a Drive" desde el modal (Tab Resumen).',
  })
}

// ── Handler: diagnóstico de claves OCR de pago (Anthropic + Mistral) ───────
// Hace una llamada mínima a cada proveedor para confirmar EN VIVO que la clave
// responde y que hay saldo. No procesa ninguna factura. Coste ~0.
async function healthOcr(res: VercelResponse) {
  async function pingAnthropic() {
    const key = process.env.ANTHROPIC_API_KEY
    if (!key) return { configurada: false, estado: 'sin_clave' }
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }),
      })
      const txt = (await r.text()).toLowerCase()
      if (r.ok) return { configurada: true, estado: 'ok' }
      if (txt.includes('credit balance')) return { configurada: true, estado: 'sin_saldo' }
      if (txt.includes('authentication') || txt.includes('invalid x-api-key')) return { configurada: true, estado: 'clave_invalida' }
      return { configurada: true, estado: `error_${r.status}` }
    } catch {
      return { configurada: true, estado: 'error_red' }
    }
  }
  async function pingMistral() {
    const key = process.env.MISTRAL_API_KEY || process.env.mistral_api_key
    if (!key) return { configurada: false, estado: 'sin_clave' }
    try {
      const r = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: 'mistral-small-latest', max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }),
      })
      const txt = (await r.text()).toLowerCase()
      if (r.ok) return { configurada: true, estado: 'ok' }
      if (r.status === 402 || txt.includes('payment')) return { configurada: true, estado: 'sin_saldo' }
      if (r.status === 401 || txt.includes('unauthorized')) return { configurada: true, estado: 'clave_invalida' }
      return { configurada: true, estado: `error_${r.status}` }
    } catch {
      return { configurada: true, estado: 'error_red' }
    }
  }
  const [anthropic, mistral] = await Promise.all([pingAnthropic(), pingMistral()])
  const algunoOperativo = anthropic.estado === 'ok' || mistral.estado === 'ok'
  return res.status(200).json({ ok: true, alguno_operativo: algunoOperativo, anthropic, mistral })
}

// ── Handler: reasignar titulares (no destructivo) ──────────────────────────
// Para las facturas viejas SIN nif_cliente leído (titular puesto por defecto),
// relee el PDF de Drive, busca el NIF de Rubén/Emilio en el texto y asigna el
// titular EXACTO. NO toca facturas_gastos ni conciliacion (solo actualiza
// facturas.titular_id + nif_cliente), por lo que NO dispara el trigger de
// conciliación ni colisiona con el re-match. Lote configurable por ?n (1..60,
// def 25) + auto-encadenado. La columna titular_revisado evita reprocesar dos
// veces y evita bucles: cada factura procesada (se identifique o no) queda
// marcada y sale del conjunto.
async function reasignarTitulares(req: VercelRequest, res: VercelResponse) {
  const LOTE_REASIG_TITULAR = Math.min(Math.max(Number(req.query.n) || 25, 1), 60)

  const { data: facturas, error } = await supabaseAdmin
    .from('facturas')
    .select('id, pdf_drive_id, pdf_original_name')
    .not('pdf_drive_id', 'is', null)
    .is('nif_cliente', null)
    .eq('titular_revisado', false)
    .order('fecha_factura', { ascending: true })
    .limit(LOTE_REASIG_TITULAR)

  if (error) return res.status(500).json({ error: error.message })

  if (!facturas || facturas.length === 0) {
    const { count: identificadas } = await supabaseAdmin
      .from('facturas').select('id', { count: 'exact', head: true })
      .eq('titular_revisado', true).not('nif_cliente', 'is', null)
    const { count: sinPista } = await supabaseAdmin
      .from('facturas').select('id', { count: 'exact', head: true })
      .eq('titular_revisado', true).is('nif_cliente', null)
    return res.status(200).json({
      ok: true, terminado: true, mensaje: 'Reasignación de titulares completada',
      identificadas: identificadas ?? 0, sin_pista: sinPista ?? 0,
    })
  }

  let aRuben = 0, aEmilio = 0, sinPista = 0, errores = 0

  for (const f of facturas) {
    try {
      const buffer = await descargarArchivoDeDrive(f.pdf_drive_id as string)
      let texto = ''
      try { texto = await extraerTextoPDF(buffer) } catch { texto = '' }
      if (!pdfTieneTexto(texto)) {
        try { texto = await extraerTextoOCRGratis(buffer, 'pdf') } catch { /* noop */ }
      }
      const t = titularPorNifEnTexto(texto)
      if (t) {
        await supabaseAdmin.from('facturas')
          .update({ titular_id: t.titularId, nif_cliente: t.nif, titular_revisado: true })
          .eq('id', f.id as string)
        if (t.titularId === RUBEN_ID) aRuben++; else aEmilio++
      } else {
        await supabaseAdmin.from('facturas')
          .update({ titular_revisado: true })
          .eq('id', f.id as string)
        sinPista++
      }
    } catch {
      await supabaseAdmin.from('facturas')
        .update({ titular_revisado: true })
        .eq('id', f.id as string)
      errores++
    }
  }

  // Auto-encadenado: dispara el siguiente lote en segundo plano.
  const host = req.headers.host
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https'
  if (host) {
    fetch(`${proto}://${host}/api/facturas?action=reasignar-titulares&n=${LOTE_REASIG_TITULAR}`, { method: 'GET' }).catch(() => {})
  }

  return res.status(200).json({
    ok: true, lote: facturas.length, a_ruben: aRuben, a_emilio: aEmilio,
    sin_pista: sinPista, errores, terminado: false,
  })
}

// ── Handler: cartero IMAP ──────────────────────────────────────────────────
async function cartero(req: VercelRequest, res: VercelResponse) {
  const sesionId = `cartero-${Date.now().toString(36)}`

  let recogida
  try {
    recogida = await recogerFacturasDelCorreo()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const ayuda = /auth|login|credenciales|password|invalid/i.test(msg)
      ? 'Revisa la contraseña de aplicación de facturasstreat@gmail.com en la configuración del cartero.'
      : null
    await supabaseAdmin.from('cartero_correo_estado').update({ buzon_conectado: false }).eq('id', 1)
    return res.status(200).json({ ok: false, error: msg, ayuda, procesadas: 0 })
  }

  const { adjuntos, mensajesRevisados, _mover } = recogida

  let ok = 0, manual = 0, duplicadas = 0, errores = 0
  const resultados: Record<string, unknown>[] = []
  const mensajesConExito = new Set<string>()
  const mensajesConFallo = new Set<string>()
  const facturasOrigenCorreo = new Set<string>()

  for (const adj of adjuntos) {
    try {
      const procesados = await procesarArchivo(
        supabaseAdmin,
        { nombre: adj.nombre, buffer: adj.buffer, mimeType: adj.mimeType },
        sesionId,
      )
      for (const r of procesados) {
        if (r.estado === 'ok') ok++
        else if (r.estado === 'lectura_manual') manual++
        else if (r.estado === 'duplicada') duplicadas++
        else errores++
        if (r.estado === 'error') mensajesConFallo.add(adj.messageId)
        else mensajesConExito.add(adj.messageId)
        const fid = (r.factura_id as string) || ((r.factura_existente as Record<string, unknown> | undefined)?.id as string)
        if (fid && r.estado !== 'error') facturasOrigenCorreo.add(fid)
        resultados.push({
          archivo: adj.nombre,
          remitente: adj.remitente,
          asunto: adj.asunto,
          estado: r.estado,
          motivo: r.motivo || r.error || null,
        })
      }
    } catch (err) {
      errores++
      mensajesConFallo.add(adj.messageId)
      resultados.push({
        archivo: adj.nombre,
        remitente: adj.remitente,
        asunto: adj.asunto,
        estado: 'error',
        motivo: err instanceof Error ? err.message : String(err),
      })
    }
  }

  if (facturasOrigenCorreo.size > 0) {
    const filas = [...facturasOrigenCorreo].map((factura_id) => ({ factura_id, marcado_en: new Date().toISOString() }))
    await supabaseAdmin.from('facturas_origen_correo').upsert(filas, { onConflict: 'factura_id', ignoreDuplicates: true })
  }

  const moverIds = [...mensajesConExito].filter((id) => !mensajesConFallo.has(id))
  try {
    await _mover(moverIds)
  } catch {
    /* best-effort */
  }

  await supabaseAdmin.from('cartero_correo_estado').update({
    buzon_conectado: true,
    ultimo_barrido: new Date().toISOString(),
    procesados_hoy: ok + duplicadas + manual,
  }).eq('id', 1)

  return res.status(200).json({
    ok: true,
    mensajes_revisados: mensajesRevisados,
    adjuntos_procesados: adjuntos.length,
    nuevas: ok,
    lectura_manual: manual,
    duplicadas,
    errores,
    movidos_a_procesadas: moverIds.length,
    origen_correo_marcadas: facturasOrigenCorreo.size,
    resultados,
  })
}

// ── Handler: barrido re-conciliación de pendientes ─────────────────────────
const ESTADOS_CONCILIADA_BARRIDO = ['conciliada', 'asociada', 'solo_drive']
const ESTADOS_PENDIENTE_MATCH = ['sin_match', 'pendiente_revision', 'pendiente_titular_manual', 'drive_pendiente']

interface InformePendiente {
  factura_id: string
  proveedor: string | null
  nif: string | null
  total: number | null
  fecha: string | null
  archivo: string | null
  motivo: string
}

async function tieneReglaOAlias(proveedorNombre: string | null, nif: string | null): Promise<boolean> {
  if (nif) {
    const { data } = await supabaseAdmin
      .from('reglas_conciliacion')
      .select('id')
      .eq('patron_nif', nif.toUpperCase())
      .eq('activa', true)
      .limit(1)
      .maybeSingle()
    if (data?.id) return true
  }
  const norm = normalizar(proveedorNombre || '')
  const palabras = norm.split(' ').filter((p) => p.length >= 3)
  for (const palabra of palabras) {
    const esc = palabra.replace(/\\/g, '\\\\').replace(/[%_]/g, '\\$&')
    const { data } = await supabaseAdmin
      .from('reglas_conciliacion')
      .select('id')
      .ilike('patron', `%${esc}%`)
      .eq('activa', true)
      .limit(1)
      .maybeSingle()
    if (data?.id) return true
  }
  if (palabras.length > 0) {
    const esc = palabras[0].replace(/\\/g, '\\\\').replace(/[%_]/g, '\\$&')
    const { data } = await supabaseAdmin
      .from('proveedor_alias')
      .select('id')
      .or(`alias.ilike.%${esc}%,proveedor_canonico.ilike.%${esc}%`)
      .limit(1)
      .maybeSingle()
    if (data?.id) return true
  }
  return false
}

async function reconciliarPendientes(req: VercelRequest, res: VercelResponse) {
  const desde = req.query.desde ? String(req.query.desde) : null
  const hasta = req.query.hasta ? String(req.query.hasta) : null

  const cols = 'id, proveedor_nombre, total, fecha_factura, tipo, plataforma, es_recapitulativa, periodo_inicio, periodo_fin, nif_emisor, titular_id, numero_factura, estado, pdf_original_name'
  const pendientes: Record<string, unknown>[] = []
  const BLOQUE = 1000
  let off = 0
  while (true) {
    let q = supabaseAdmin
      .from('facturas')
      .select(cols)
      .not('estado', 'in', `(${ESTADOS_CONCILIADA_BARRIDO.join(',')})`)
      .order('fecha_factura', { ascending: true })
      .range(off, off + BLOQUE - 1)
    if (desde) q = q.gte('fecha_factura', desde)
    if (hasta) q = q.lte('fecha_factura', hasta)
    const { data, error } = await q
    if (error) return res.status(500).json({ error: error.message })
    const lote = data || []
    pendientes.push(...lote)
    if (lote.length < BLOQUE) break
    off += BLOQUE
  }

  let reconciliadas = 0
  const conReglaSinMatch: InformePendiente[] = []
  const sinRegla: InformePendiente[] = []
  const sinPlantilla: InformePendiente[] = []

  for (const f of pendientes) {
    const estado = String(f.estado || '')
    const proveedor = (f.proveedor_nombre as string) || null
    const nif = (f.nif_emisor as string) || null
    const total = f.total != null ? Number(f.total) : null
    const fecha = (f.fecha_factura as string) || null
    const archivo = (f.pdf_original_name as string) || null
    const base: Omit<InformePendiente, 'motivo'> = { factura_id: f.id as string, proveedor, nif, total, fecha, archivo }

    if (estado === 'pendiente_lectura_manual') {
      const tienePlantilla = nif
        ? !!(await supabaseAdmin.from('reglas_conciliacion').select('id').eq('patron_nif', nif.toUpperCase()).eq('activa', true).limit(1).maybeSingle()).data
        : false
      if (tienePlantilla) {
        conReglaSinMatch.push({ ...base, motivo: 'Ya tiene plantilla de NIF: pendiente de reprocesar el PDF (botón Reprocesar).' })
      } else {
        sinPlantilla.push({ ...base, motivo: nif ? `Sin plantilla para el NIF ${nif}. Crea la plantilla en Configuración → Reglas → OCR/Plantillas.` : 'Sin NIF legible. Necesita lectura/plantilla manual.' })
      }
      continue
    }

    const facturaInput = {
      proveedor_nombre: proveedor || '',
      total: total ?? 0,
      fecha_factura: fecha || new Date().toISOString().slice(0, 10),
      tipo: (f.tipo as string) || 'proveedor',
      plataforma: (f.plataforma as string) || null,
      es_recapitulativa: !!f.es_recapitulativa,
      periodo_inicio: (f.periodo_inicio as string) || null,
      periodo_fin: (f.periodo_fin as string) || null,
      numero_factura: (f.numero_factura as string) || null,
      nif_emisor: nif,
      id: f.id as string,
      titular_id: (f.titular_id as string | null) ?? null,
    } as unknown as ExtractedFactura & { id: string; total: number; titular_id: string | null }

    let nuevoEstado = estado
    let mensaje = ''
    try {
      const result = await matchFactura(supabaseAdmin, facturaInput)
      await aplicarMatching(supabaseAdmin, f.id as string, result, { proveedor_nombre: proveedor || undefined, nif_emisor: nif })
      nuevoEstado = result.estado
      mensaje = result.mensaje
    } catch (e) {
      mensaje = e instanceof Error ? e.message : String(e)
    }

    if (ESTADOS_CONCILIADA_BARRIDO.includes(nuevoEstado)) {
      reconciliadas++
      continue
    }

    const tiene = await tieneReglaOAlias(proveedor, nif)
    if (tiene) {
      conReglaSinMatch.push({ ...base, motivo: mensaje || 'Proveedor localizado pero el movimiento bancario no cuadra (importe/fecha o falta extracto).' })
    } else {
      sinRegla.push({ ...base, motivo: 'No existe alias/regla/plantilla para este proveedor. Crea la regla en Configuración → Reglas → OCR/Conciliación (o la plantilla por NIF).' })
    }
  }

  const totalPendientes = pendientes.length
  const siguenPendientes = conReglaSinMatch.length + sinRegla.length + sinPlantilla.length
  const cien = totalPendientes === 0 || siguenPendientes === 0

  return res.status(200).json({
    ok: true,
    cien_por_cien: cien,
    total_pendientes_revisados: totalPendientes,
    reconciliadas,
    siguen_pendientes: siguenPendientes,
    con_regla_sin_match: conReglaSinMatch,
    sin_regla: sinRegla,
    sin_plantilla: sinPlantilla,
  })
}

// ── Handler: reprocesado masivo 0 API (auto-encadenado) ───────────────────
const LOTE_REPROC = 4

async function reproc(req: VercelRequest, res: VercelResponse) {
  const { data: job } = await supabaseAdmin
    .from('reproc_control')
    .select('*')
    .eq('activo', true)
    .order('creado', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!job) return res.status(200).json({ ok: true, mensaje: 'Sin jobs activos' })

  const soloSinLeer = !!job.solo_sin_leer
  const offset = Number(job.offset_actual || 0)
  const sesionId = (job.sesion_id as string) || `reproc-${job.id}`

  await supabaseAdmin.from('reproc_control').update({ ultimo_run: new Date().toISOString() }).eq('id', job.id as string)

  let q = supabaseAdmin
    .from('facturas')
    .select('*')
    .not('pdf_drive_id', 'is', null)
    .order('fecha_factura', { ascending: true })

  if (soloSinLeer) {
    q = q.or('total.is.null,total.eq.0,nif_emisor.is.null').range(0, LOTE_REPROC - 1)
  } else {
    q = q.range(offset, offset + LOTE_REPROC - 1)
  }

  if (job.desde) q = q.gte('fecha_factura', job.desde as string)
  if (job.hasta) q = q.lte('fecha_factura', job.hasta as string)

  const { data: facturas, error } = await q
  if (error) return res.status(500).json({ error: error.message })

  if (!facturas || facturas.length === 0) {
    await supabaseAdmin.from('reproc_control').update({ activo: false, ultimo_run: new Date().toISOString() }).eq('id', job.id as string)
    return res.status(200).json({ ok: true, job: job.id, mensaje: 'Job completado', offset })
  }

  let ok = 0, errores = 0, conciliadas = 0
  let procesadasAcum = Number(job.procesadas || 0)
  const objetivo = Number(job.total_objetivo || 0)

  for (const f of facturas) {
    const driveId = f.pdf_drive_id as string
    const nombre = (f.pdf_original_name as string) || `${f.id}.pdf`
    const original = { ...(f as Record<string, unknown>) }
    let borrada = false
    let lineaInforme: Record<string, unknown>
    try {
      const buffer = await descargarArchivoDeDrive(driveId)
      await supabaseAdmin.from('facturas_gastos').delete().eq('factura_id', f.id as string)
      await supabaseAdmin.from('facturas_plataforma_detalle').delete().eq('factura_id', f.id as string)
      await supabaseAdmin.from('facturas').delete().eq('id', f.id as string)
      borrada = true

      const resultados = await procesarArchivo(supabaseAdmin, { nombre, buffer }, sesionId)
      const r = resultados[0]

      if (!r || r.estado === 'error') {
        await supabaseAdmin.from('facturas').insert(original)
        borrada = false
        errores++
        lineaInforme = {
          control_id: job.id,
          factura_id: f.id as string,
          archivo: nombre,
          proveedor: (f.proveedor_nombre as string) || null,
          total: f.total != null ? Number(f.total) : null,
          resultado: 'error',
          estado_final: (original.estado as string) || null,
          conciliada: false,
          en_drive: !!driveId,
          motivo: `${r?.error || 'relectura sin resultado'} · factura original restaurada`,
        }
      } else {
        const fac = (r.factura || r.factura_existente) as Record<string, unknown> | undefined
        const estadoFinal = (fac?.estado as string) || null
        const conc = ['conciliada', 'asociada'].includes(estadoFinal || '')
        const resultado = r.estado === 'duplicada' ? 'duplicada' : 'ok'
        ok++
        if (conc) conciliadas++
        lineaInforme = {
          control_id: job.id,
          factura_id: (r.factura_id as string) || (f.id as string),
          archivo: nombre,
          proveedor: (fac?.proveedor_nombre as string) || (f.proveedor_nombre as string) || null,
          total: fac?.total != null ? Number(fac.total) : (f.total != null ? Number(f.total) : null),
          resultado,
          estado_final: estadoFinal,
          conciliada: conc,
          en_drive: !!(fac?.pdf_drive_id),
          motivo: r.motivo || null,
        }
      }
    } catch (e) {
      if (borrada) {
        try { await supabaseAdmin.from('facturas').insert(original) } catch { /* noop */ }
      }
      errores++
      lineaInforme = {
        control_id: job.id,
        factura_id: f.id as string,
        archivo: nombre,
        proveedor: (f.proveedor_nombre as string) || null,
        total: f.total != null ? Number(f.total) : null,
        resultado: 'error',
        estado_final: (original.estado as string) || null,
        conciliada: false,
        en_drive: false,
        motivo: `${e instanceof Error ? e.message : String(e)} · factura original restaurada`,
      }
    }

    procesadasAcum++
    await supabaseAdmin.from('reproc_informe').insert(lineaInforme)
    await supabaseAdmin.from('reproc_control').update({
      offset_actual: offset + (procesadasAcum - Number(job.procesadas || 0)),
      procesadas: procesadasAcum,
      ok: Number(job.ok || 0) + ok,
      errores: Number(job.errores || 0) + errores,
      conciliadas: Number(job.conciliadas || 0) + conciliadas,
      ultimo_run: new Date().toISOString(),
    }).eq('id', job.id as string)

    if (soloSinLeer && objetivo > 0 && procesadasAcum >= objetivo) break
  }

  const nuevoOffset = offset + facturas.length
  const terminado =
    facturas.length < LOTE_REPROC ||
    (soloSinLeer && (objetivo <= 0 || procesadasAcum >= objetivo))

  await supabaseAdmin.from('reproc_control').update({
    activo: !terminado,
    ultimo_run: new Date().toISOString(),
  }).eq('id', job.id as string)

  if (!terminado) {
    const host = req.headers.host
    const proto = (req.headers['x-forwarded-proto'] as string) || 'https'
    if (host) {
      fetch(`${proto}://${host}/api/facturas?action=reproc`, { method: 'GET' }).catch(() => {})
    }
  }

  return res.status(200).json({
    ok: true, job: job.id, lote: facturas.length,
    ok_lote: ok, errores_lote: errores, conciliadas_lote: conciliadas,
    nuevo_offset: nuevoOffset, terminado, modo: soloSinLeer ? 'solo_sin_leer' : 'completo',
  })
}

// ── Handler: upload / procesar archivo ───────────────────────────────────
async function upload(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const body = req.body as { nombre?: string; base64?: string; mimeType?: string | null; sesionId?: string | null }
    if (!body?.base64 || !body?.nombre) {
      return res.status(400).json({ error: 'Falta base64 o nombre' })
    }

    const buffer = Buffer.from(body.base64, 'base64')
    const sesionId = body.sesionId || `up-${Date.now().toString(36)}`

    const resultados = await procesarArchivo(supabaseAdmin, {
      nombre: body.nombre,
      buffer,
      mimeType: body.mimeType || null,
    }, sesionId)

    if (resultados.length === 1) {
      return res.status(200).json(resultados[0])
    }
    return res.status(200).json({ estado: 'multi', resultados })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return res.status(500).json({ error: msg })
  }
}

// ── Handler: limpieza de facturas zombie ──────────────────────────────────
async function limpieza(res: VercelResponse) {
  const umbral = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  const { data: zombies, error: errSel } = await supabaseAdmin
    .from('facturas')
    .select('id, proveedor_nombre, created_at, estado, total')
    .eq('proveedor_nombre', 'Procesando...')
    .lt('created_at', umbral)

  if (errSel) return res.status(500).json({ error: errSel.message })

  const ids = (zombies || []).map(z => z.id)
  if (ids.length === 0) {
    return res.status(200).json({ borradas: 0, ids: [] })
  }

  await supabaseAdmin.from('facturas_gastos').delete().in('factura_id', ids)
  await supabaseAdmin.from('facturas_plataforma_detalle').delete().in('factura_id', ids)
  const { error: errDel } = await supabaseAdmin.from('facturas').delete().in('id', ids)
  if (errDel) return res.status(500).json({ error: errDel.message, ids })

  return res.status(200).json({ borradas: ids.length, ids })
}

// ── Handler: purga de facturas NO resueltas (no conciliadas) ───────────────
// Borra en lotes las facturas cuyo estado no es conciliada/asociada/solo_drive:
// manda su archivo de Drive a la papelera (recuperable 30 dias), borra las
// conexiones (gastos y detalle de plataforma) y la propia factura. Se invoca
// en bucle (action=purgar&lote=N) hasta que devuelve terminado:true. El borrado
// de Drive del lote se hace en paralelo para caber en el tiempo de la funcion.
async function purgar(req: VercelRequest, res: VercelResponse) {
  const RESUELTAS = '(conciliada,asociada,solo_drive)'
  const lote = Math.min(Math.max(Number(req.query.lote) || 40, 1), 80)

  const { data: filas, error } = await supabaseAdmin
    .from('facturas')
    .select('id, pdf_drive_id')
    .not('estado', 'in', RESUELTAS)
    .order('id', { ascending: true })
    .limit(lote)
  if (error) return res.status(500).json({ error: error.message })

  const ids = (filas || []).map(f => f.id as string)
  if (ids.length === 0) {
    return res.status(200).json({ terminado: true, borradas: 0, restantes: 0 })
  }

  const driveIds = (filas || [])
    .map(f => f.pdf_drive_id as string | null)
    .filter((d): d is string => !!d)
  const resultados = await Promise.allSettled(driveIds.map(d => borrarArchivoDeDrive(d)))
  const driveOk = resultados.filter(r => r.status === 'fulfilled' && r.value.ok).length
  const driveFail = resultados.length - driveOk

  await supabaseAdmin.from('facturas_plataforma_detalle').delete().in('factura_id', ids)
  await supabaseAdmin.from('facturas_gastos').delete().in('factura_id', ids)
  const { error: errDel } = await supabaseAdmin.from('facturas').delete().in('id', ids)
  if (errDel) return res.status(500).json({ error: errDel.message })

  const { count } = await supabaseAdmin
    .from('facturas')
    .select('id', { count: 'exact', head: true })
    .not('estado', 'in', RESUELTAS)
  const restantes = count ?? 0
  return res.status(200).json({
    terminado: restantes === 0,
    borradas: ids.length,
    drive_ok: driveOk,
    drive_fail: driveFail,
    restantes,
  })
}

// ── Handler: info de la papelera (solo lectura) ───────────────────────────
// Cuenta los archivos que fueron enviados a la papelera de Drive en las últimas
// N horas (para ver qué se puede recuperar de un borrado reciente).
async function papeleraInfo(req: VercelRequest, res: VercelResponse) {
  const horas = Math.min(Math.max(Number(req.query.horas) || 6, 1), 72)
  const desde = new Date(Date.now() - horas * 3600 * 1000).toISOString()
  const archivos = await listarPapeleraReciente(desde, 1000)
  return res.status(200).json({
    desde,
    total_en_papelera: archivos.length,
    muestra: archivos.slice(0, 6).map((a) => a.name),
  })
}

// ── Handler: recuperar documentos de la papelera ──────────────────────────
// Para cada archivo enviado a la papelera en las últimas N horas: lo saca de la
// papelera, lo relee y recrea su factura (con la red de seguridad: queda en
// Storage + copia en Drive). El duplicado de la papelera se elimina para no
// dejar copias sueltas. El de-duplicado evita recrear lo que ya existe. Se
// invoca en bucle (recuperar-papelera&lote=N) hasta terminado:true.
async function recuperarPapelera(req: VercelRequest, res: VercelResponse) {
  const horas = Math.min(Math.max(Number(req.query.horas) || 6, 1), 72)
  const desde = new Date(Date.now() - horas * 3600 * 1000).toISOString()
  const lote = Math.min(Math.max(Number(req.query.lote) || 8, 1), 20)

  const archivos = await listarPapeleraReciente(desde, lote)
  if (archivos.length === 0) {
    return res.status(200).json({ terminado: true, recuperadas: 0, duplicadas: 0, errores: 0, lote: 0 })
  }

  let recuperadas = 0, duplicadas = 0, errores = 0
  for (const a of archivos) {
    try {
      // Sacar de la papelera primero: aunque luego falle, ya no reaparece en el
      // listado, de modo que el barrido siempre avanza (no se queda en bucle).
      await restaurarArchivoDeDrive(a.id)
      const buffer = await descargarArchivoDeDrive(a.id)
      const resultados = await procesarArchivo(supabaseAdmin, { nombre: a.name, buffer }, `recup-${Date.now().toString(36)}`)
      const r = resultados[0]
      if (!r || r.estado === 'error') { errores++; continue }
      if (r.estado === 'duplicada') duplicadas++
      else recuperadas++
      // Recreada (o ya existía): hay factura + copia nueva archivada.
      // El original de la papelera ya no hace falta: se elimina (no duplicar).
      await borrarArchivoPermanente(a.id)
    } catch {
      errores++
    }
  }

  const quedan = await listarPapeleraReciente(desde, 1)
  return res.status(200).json({
    terminado: quedan.length === 0,
    recuperadas, duplicadas, errores, lote: archivos.length,
  })
}

// ── Handler: repesca — sube a Drive lo que aún no esté ─────────────────────
// Recorre archivo_respaldo (registro de cada documento respaldado en Storage) y
// sube a Drive todo lo que aún no tenga drive_id. Vincula la factura por hash.
// Auto-encadenado: se vuelve a llamar mientras queden pendientes, de modo que
// TODO documento acaba en Drive sí o sí (el "infinito hasta lograrlo").
async function archivarPendientes(req: VercelRequest, res: VercelResponse) {
  const lote = Math.min(Math.max(Number(req.query.lote) || 10, 1), 30)

  const { data: filas, error } = await supabaseAdmin
    .from('archivo_respaldo')
    .select('id, hash, storage_path')
    .is('drive_id', null)
    .order('creado', { ascending: true })
    .limit(lote)
  if (error) return res.status(500).json({ error: error.message })

  const pendientes = filas || []
  if (pendientes.length === 0) {
    return res.status(200).json({ terminado: true, subidas: 0, errores: 0, restantes: 0 })
  }

  let subidas = 0, errores = 0
  for (const f of pendientes) {
    try {
      const r = await subirRespaldoADrive(f.storage_path as string)
      if (!r) { errores++; continue }
      await supabaseAdmin.from('archivo_respaldo')
        .update({ drive_id: r.id, actualizado: new Date().toISOString() })
        .eq('id', f.id as string)
      // Vincular la factura por hash (si la tiene y aún no tiene Drive).
      if (f.hash) {
        await supabaseAdmin.from('facturas')
          .update({ pdf_drive_id: r.id, pdf_drive_url: r.webViewLink, error_mensaje: null })
          .eq('pdf_hash', f.hash as string)
          .is('pdf_drive_id', null)
        await supabaseAdmin.from('facturas')
          .update({ estado: 'solo_drive' })
          .eq('pdf_hash', f.hash as string)
          .eq('estado', 'drive_pendiente')
      }
      subidas++
    } catch {
      errores++
    }
  }

  const { count } = await supabaseAdmin
    .from('archivo_respaldo')
    .select('id', { count: 'exact', head: true })
    .is('drive_id', null)
  const restantes = count ?? 0

  // Auto-encadena mientras queden pendientes: la repesca insiste hasta lograrlo.
  if (restantes > 0) {
    const host = req.headers.host
    const proto = (req.headers['x-forwarded-proto'] as string) || 'https'
    if (host) {
      fetch(`${proto}://${host}/api/facturas?action=archivar-pendientes&lote=${lote}`, { method: 'GET' }).catch(() => {})
    }
  }

  return res.status(200).json({ terminado: restantes === 0, subidas, errores, restantes })
}
