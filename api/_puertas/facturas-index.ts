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
 *   GET  /api/facturas?action=purgar[&lote=NN]  → borra facturas NO resueltas + Drive a papelera (lote)
 *   GET  /api/facturas?action=papelera-info[&horas=NN] → cuenta archivos en papelera reciente
 *   GET  /api/facturas?action=recuperar-papelera[&lote=NN&horas=NN] → recupera borrados (lote)
 *   GET  /api/facturas?action=archivar-pendientes[&lote=NN] → repesca: sube a Drive lo que falte (lote + auto-encadenado)
 *   GET  /api/facturas?action=extraer-lineas     → detalle de líneas por factura (lote + presupuesto de tiempo)
 *   POST /api/facturas?action=upload            → subir/procesar archivo
 *   POST /api/facturas?action=limpieza          → borrar facturas zombie
 *   GET  /api/facturas?action=resolver-inventario → contadores reales de pendientes (botón Resolver)
 *   GET  /api/facturas?action=agenda-tick        → motor de tareas: procesa la más antigua elegible de papeleo_tareas
 *
 * Vive en _puertas: se sirve a través de la puerta /api/papeleo (límite de
 * Serverless Functions del plan). Cada archivo suelto en api/ es una función.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'
import { procesarArchivo } from '../_lib/procesarArchivo.js'
import { descargarArchivoDeDrive, borrarArchivoDeDrive, restaurarArchivoDeDrive, borrarArchivoPermanente, listarPapeleraReciente, subirRespaldoADrive } from '../_lib/google-drive.js'
import { matchFactura, aplicarMatching, normalizar } from '../_lib/matching.js'
import { recogerFacturasDelCorreo } from '../_lib/gmail-cartero.js'
import { extraerTextoPDF, pdfTieneTexto } from '../_lib/extractores.js'
import { extraerTextoOCRGratis } from '../_lib/ocr-tesseract.js'
import { clasificarPorContenido, reglaCasa } from '../_lib/clasificadorCorreo.js'
import type { DestinoCorreo } from '../_lib/clasificadorCorreo.js'
import { parsearBBVA } from '../_lib/parserBBVA.js'
import type { ExtractedFactura } from '../_lib/ocr-types.js'
import { descargarRespaldoStorage } from '../_lib/google-drive.js'
import { extraerLineasFacturaTexto, sumaConIva } from '../_lib/extraerLineasFactura.js'

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
  if (action === 'upload')        return upload(req, res)
  if (action === 'limpieza')      return limpieza(res)
  if (action === 'purgar')        return purgar(req, res)
  if (action === 'papelera-info') return papeleraInfo(req, res)
  if (action === 'recuperar-papelera') return recuperarPapelera(req, res)
  if (action === 'archivar-pendientes') return archivarPendientes(req, res)
  if (action === 'encolar-reproc')     return encolarReproc(res)
  if (action === 'extraer-lineas')     return extraerLineasBatch(req, res)
  if (action === 'resolver-inventario') return resolverInventario(res)
  if (action === 'agenda-tick')        return agendaTick(req, res)

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

// ── Handler: reasignar titulares (no destructivo) ──────────────────────────
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

// Clasifica un adjunto del cartero ANTES del motor de facturas (task 7).
// Orden: (1) regla aprendida por remitente/asunto; (2) extracto bancario si
// parsearBBVA lo parsea; (3) documento de equipo por contenido; (4) factura.
async function clasificarAdjuntoCartero(adj: {
  nombre: string; buffer: Buffer; mimeType?: string | null; remitente?: string | null; asunto?: string | null
}): Promise<{ destino: DestinoCorreo; subtipo: string | null; motivo: string; porRegla: boolean }> {
  try {
    const { data: reglas } = await supabaseAdmin.from('reglas_correo_ocr')
      .select('remitente, asunto_contiene, destino').eq('activa', true)
    for (const r of reglas || []) {
      if (reglaCasa(r as { remitente?: string | null; asunto_contiene?: string | null }, adj.remitente, adj.asunto) && r.destino) {
        const dest: DestinoCorreo = (r.destino === 'doc_equipo' || r.destino === 'extracto') ? r.destino : 'factura'
        return { destino: dest, subtipo: null, motivo: `regla de correo aprendida (${r.destino})`, porRegla: true }
      }
    }
  } catch (e) { console.error('[clasificarAdjuntoCartero] reglas', e instanceof Error ? e.message : String(e)) }

  let texto = ''
  const esPdf = /\.pdf$/i.test(adj.nombre) || (adj.mimeType || '').includes('pdf')
  if (esPdf) { try { texto = await extraerTextoPDF(adj.buffer) } catch { texto = '' } }

  const pareceBanco = /extracto|bbva|movimient/i.test(adj.nombre) || /excel|spreadsheet|csv/i.test(adj.mimeType || '')
  if (pareceBanco) {
    try {
      const movs = parsearBBVA(adj.buffer)
      if (movs && movs.length >= 1) return { destino: 'extracto', subtipo: 'bbva', motivo: `extracto bancario (${movs.length} movimientos)`, porRegla: false }
    } catch { /* no es un extracto parseable */ }
  }

  const c = clasificarPorContenido(adj.nombre, texto)
  return { ...c, porRegla: false }
}

// Aprendizaje por remitente (reglas_correo_ocr): crea o incrementa la regla para
// que la próxima vez ese remitente se clasifique a la primera.
async function aprenderReglaCorreo(remitente: string, destino: DestinoCorreo): Promise<void> {
  try {
    const rem = remitente.toLowerCase().trim()
    if (!rem) return
    const { data: ya } = await supabaseAdmin.from('reglas_correo_ocr')
      .select('id, veces_confirmada').eq('remitente', rem).eq('destino', destino).maybeSingle()
    if (ya?.id) {
      await supabaseAdmin.from('reglas_correo_ocr').update({ veces_confirmada: (Number(ya.veces_confirmada) || 0) + 1 }).eq('id', ya.id as string)
    } else {
      await supabaseAdmin.from('reglas_correo_ocr').insert({ remitente: rem, destino, veces_confirmada: 1, activa: true })
    }
  } catch (e) { console.error('[aprenderReglaCorreo]', e instanceof Error ? e.message : String(e)) }
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

  let ok = 0, manual = 0, duplicadas = 0, errores = 0, clasificados = 0
  const resultados: Record<string, unknown>[] = []
  const mensajesConExito = new Set<string>()
  const mensajesConFallo = new Set<string>()
  const facturasOrigenCorreo = new Set<string>()

  for (const adj of adjuntos) {
    try {
      // Clasificador universal: desviar nóminas / Seg. Social / extractos del motor
      // de facturas (task 7). No se ingesta a ciegas: se deja aviso + aprendizaje.
      const cls = await clasificarAdjuntoCartero(adj)
      if (cls.destino !== 'factura') {
        clasificados++
        await supabaseAdmin.from('avisos_papeleo').insert({
          tipo: cls.destino === 'extracto' ? 'extracto_recibido' : 'doc_equipo_recibido',
          titulo: `${cls.destino === 'extracto' ? 'Extracto bancario' : 'Documento de equipo'} recibido · ${adj.nombre}`,
          detalle: `Clasificado como ${cls.motivo}. Remitente: ${adj.remitente || '—'}. No se procesa como factura; requiere ingesta específica.`,
          estado: 'abierto',
          payload: { archivo: adj.nombre, remitente: adj.remitente, asunto: adj.asunto, subtipo: cls.subtipo, destino: cls.destino },
        })
        if (!cls.porRegla && adj.remitente) await aprenderReglaCorreo(adj.remitente, cls.destino)
        mensajesConExito.add(adj.messageId)
        resultados.push({ archivo: adj.nombre, remitente: adj.remitente, asunto: adj.asunto, estado: 'clasificado', motivo: cls.motivo })
        continue
      }

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
    clasificados,
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

// ── Handler: reprocesado masivo 0 API (por presupuesto de tiempo) ──────────
// Una sola invocación procesa tantas facturas como quepan en PRESUPUESTO_MS,
// SIN cadenas fire-and-forget (el runtime las mata al responder). Así un único
// disparo avanza mucho y basta una red de seguridad ESPACIADA (cada 10 min, no
// cada minuto) para reanudar si el proceso se corta. Lee de BD en tandas de
// LOTE_DB para no cargar miles de filas de golpe.
//
// MODO solo_lectura_manual (04/07/26): reprocesa SOLO las facturas en estado
// 'pendiente_lectura_manual' por la cascada completa (plantilla → Tesseract →
// bootstrap de pago 1 vez por NIF, regla 3 bis). La primera lectura de pago de
// cada NIF nuevo APRENDE su plantilla; el resto de facturas de ese proveedor se
// leen gratis. Cursor: las leídas SALEN del conjunto (cambian de estado), así
// que con progreso real se vuelve al inicio; una tanda entera sin progreso
// avanza el offset y salta el bloque atascado. Termina cuando la consulta no
// devuelve filas. El candado vision_usada impide gastar API dos veces en el
// mismo NIF aunque siga fallando.
const LOTE_DB = 4
const PRESUPUESTO_MS = 250_000

interface ResultadoReproc {
  ok: boolean; job: string; ok_tanda: number; errores_tanda: number
  procesadas: number; terminado: boolean; motivo_fin: string; modo: string
}

async function reproc(req: VercelRequest, res: VercelResponse) {
  try {
    const resultado = await reprocInterno()
    return res.status(200).json(resultado)
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
  }
}

async function reprocInterno(): Promise<ResultadoReproc> {
  const arranque = Date.now()

  const { data: job } = await supabaseAdmin
    .from('reproc_control')
    .select('*')
    .eq('activo', true)
    .order('creado', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!job) return { ok: true, job: '', ok_tanda: 0, errores_tanda: 0, procesadas: 0, terminado: true, motivo_fin: 'sin_jobs_activos', modo: 'ninguno' }

  const soloSinLeer = !!job.solo_sin_leer
  const soloLM = !!job.solo_lectura_manual
  const sesionId = (job.sesion_id as string) || `reproc-${job.id}`
  const objetivo = Number(job.total_objetivo || 0)

  let offset = Number(job.offset_actual || 0)
  let procesadasAcum = Number(job.procesadas || 0)
  let okTotal = Number(job.ok || 0)
  let errTotal = Number(job.errores || 0)
  let concTotal = Number(job.conciliadas || 0)

  let okTanda = 0, errTanda = 0
  let agotadas = false
  let sinProgreso = false

  while (Date.now() - arranque < PRESUPUESTO_MS) {
    let q = supabaseAdmin
      .from('facturas')
      .select('*')
      .not('pdf_drive_id', 'is', null)
      .order('fecha_factura', { ascending: true })

    if (soloLM) {
      q = q.eq('estado', 'pendiente_lectura_manual').range(offset, offset + LOTE_DB - 1)
    } else if (soloSinLeer) {
      q = q.neq('estado', 'pendiente_lectura_manual').or('total.is.null,total.eq.0,nif_emisor.is.null').range(0, LOTE_DB - 1)
    } else {
      q = q.range(offset, offset + LOTE_DB - 1)
    }
    if (job.desde) q = q.gte('fecha_factura', job.desde as string)
    if (job.hasta) q = q.lte('fecha_factura', job.hasta as string)

    const { data: facturas, error } = await q
    if (error) throw new Error(error.message)

    if (!facturas || facturas.length === 0) { agotadas = true; break }

    let okEstaTanda = 0
    let progresoLM = 0
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
        await supabaseAdmin.from('facturas_lineas').delete().eq('factura_id', f.id as string)
        await supabaseAdmin.from('facturas').delete().eq('id', f.id as string)
        borrada = true

        const resultados = await procesarArchivo(supabaseAdmin, { nombre, buffer }, sesionId)
        const r = resultados[0]

        if (!r || r.estado === 'error') {
          await supabaseAdmin.from('facturas').insert(original)
          borrada = false
          errTanda++; errTotal++
          lineaInforme = {
            control_id: job.id, factura_id: f.id as string, archivo: nombre,
            proveedor: (f.proveedor_nombre as string) || null,
            total: f.total != null ? Number(f.total) : null,
            resultado: 'error', estado_final: (original.estado as string) || null,
            conciliada: false, en_drive: !!driveId,
            motivo: `${r?.error || 'relectura sin resultado'} · factura original restaurada`,
          }
        } else {
          const fac = (r.factura || r.factura_existente) as Record<string, unknown> | undefined
          const estadoFinal = (fac?.estado as string) || null
          const conc = ['conciliada', 'asociada'].includes(estadoFinal || '')
          const resultado = r.estado === 'duplicada' ? 'duplicada' : 'ok'
          okTanda++; okTotal++; okEstaTanda++
          if (r.estado !== 'lectura_manual') progresoLM++
          if (conc) concTotal++
          const facNif = (fac?.nif_emisor as string) || null
          const facTotal = fac?.total != null ? Number(fac.total) : null
          if (facNif && facTotal && facTotal > 0) {
            await supabaseAdmin.rpc('fn_propagar_aprendizaje_nif', {
              p_nif: facNif, p_total: facTotal,
              p_proveedor_nombre: (fac?.proveedor_nombre as string) ?? null,
              p_categoria: (fac?.categoria_factura as string) ?? null,
            })
          }
          lineaInforme = {
            control_id: job.id,
            factura_id: (r.factura_id as string) || (f.id as string),
            archivo: nombre,
            proveedor: (fac?.proveedor_nombre as string) || (f.proveedor_nombre as string) || null,
            total: fac?.total != null ? Number(fac.total) : (f.total != null ? Number(f.total) : null),
            resultado, estado_final: estadoFinal, conciliada: conc,
            en_drive: !!(fac?.pdf_drive_id), motivo: r.motivo || null,
          }
        }
      } catch (e) {
        if (borrada) { try { await supabaseAdmin.from('facturas').insert(original) } catch { /* noop */ } }
        errTanda++; errTotal++
        lineaInforme = {
          control_id: job.id, factura_id: f.id as string, archivo: nombre,
          proveedor: (f.proveedor_nombre as string) || null,
          total: f.total != null ? Number(f.total) : null,
          resultado: 'error', estado_final: (original.estado as string) || null,
          conciliada: false, en_drive: false,
          motivo: `${e instanceof Error ? e.message : String(e)} · factura original restaurada`,
        }
      }

      procesadasAcum++
      offset++
      await supabaseAdmin.from('reproc_informe').insert(lineaInforme)
      if (soloSinLeer && objetivo > 0 && procesadasAcum >= objetivo) break
    }

    // Modo lectura_manual: si la tanda logró progreso real (leídas/duplicadas que
    // SALEN del conjunto), el cursor vuelve al inicio; sin progreso, el offset ya
    // avanzó y salta el bloque atascado.
    if (soloLM && progresoLM > 0) offset = 0

    await supabaseAdmin.from('reproc_control').update({
      offset_actual: offset, procesadas: procesadasAcum,
      ok: okTotal, errores: errTotal, conciliadas: concTotal,
      ultimo_run: new Date().toISOString(),
    }).eq('id', job.id as string)

    if (soloSinLeer && objetivo > 0 && procesadasAcum >= objetivo) break
    // En soloSinLeer el filtro se consume solo (las leídas salen del conjunto).
    // Si una tanda entera no leyó ninguna, son ilegibles reales: cortar para no
    // girar sobre las mismas.
    if (soloSinLeer && okEstaTanda === 0) { sinProgreso = true; break }
    if (facturas.length < LOTE_DB) { agotadas = true; break }
  }

  const terminado =
    agotadas || sinProgreso ||
    (soloSinLeer && objetivo > 0 && procesadasAcum >= objetivo)

  await supabaseAdmin.from('reproc_control').update({
    activo: !terminado, ultimo_run: new Date().toISOString(),
  }).eq('id', job.id as string)

  return {
    ok: true, job: job.id as string,
    ok_tanda: okTanda, errores_tanda: errTanda,
    procesadas: procesadasAcum, terminado,
    motivo_fin: terminado ? (agotadas ? 'agotadas' : sinProgreso ? 'sin_progreso' : 'objetivo') : 'tiempo',
    modo: soloLM ? 'solo_lectura_manual' : soloSinLeer ? 'solo_sin_leer' : 'completo',
  }
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
async function papeleraInfo(req: VercelRequest, res: VercelResponse) {
  const horas = Math.min(Math.max(Number(req.query.horas) || 6, 1), 720)
  const desde = new Date(Date.now() - horas * 3600 * 1000).toISOString()
  const archivos = await listarPapeleraReciente(desde, 2000)
  return res.status(200).json({
    desde,
    total_en_papelera: archivos.length,
    muestra: archivos.slice(0, 6).map((a) => a.name),
  })
}

// ── Handler: recuperar documentos de la papelera ──────────────────────────
async function recuperarPapelera(req: VercelRequest, res: VercelResponse) {
  const horas = Math.min(Math.max(Number(req.query.horas) || 6, 1), 720)
  const desde = new Date(Date.now() - horas * 3600 * 1000).toISOString()
  const lote = Math.min(Math.max(Number(req.query.lote) || 8, 1), 20)

  const archivos = await listarPapeleraReciente(desde, lote)
  if (archivos.length === 0) {
    return res.status(200).json({ terminado: true, recuperadas: 0, duplicadas: 0, errores: 0, lote: 0 })
  }

  let recuperadas = 0, duplicadas = 0, errores = 0
  for (const a of archivos) {
    try {
      await restaurarArchivoDeDrive(a.id)
      const buffer = await descargarArchivoDeDrive(a.id)
      const resultados = await procesarArchivo(supabaseAdmin, { nombre: a.name, buffer }, `recup-${Date.now().toString(36)}`)
      const r = resultados[0]
      if (!r || r.estado === 'error') { errores++; continue }
      if (r.estado === 'duplicada') duplicadas++
      else recuperadas++
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
interface ResultadoArchivarPendientes { terminado: boolean; subidas: number; errores: number; restantes: number }

async function archivarPendientesInterno(lote: number): Promise<ResultadoArchivarPendientes> {
  const { data: filas, error } = await supabaseAdmin
    .from('archivo_respaldo')
    .select('id, hash, storage_path')
    .is('drive_id', null)
    .order('creado', { ascending: true })
    .limit(lote)
  if (error) throw new Error(error.message)

  const pendientes = filas || []
  if (pendientes.length === 0) {
    return { terminado: true, subidas: 0, errores: 0, restantes: 0 }
  }

  let subidas = 0, errores = 0
  for (const f of pendientes) {
    try {
      const r = await subirRespaldoADrive(f.storage_path as string)
      if (!r) { errores++; continue }
      await supabaseAdmin.from('archivo_respaldo')
        .update({ drive_id: r.id, actualizado: new Date().toISOString() })
        .eq('id', f.id as string)
      if (f.hash) {
        const hashBase = f.hash as string
        const orHash = `pdf_hash.eq.${hashBase},pdf_hash.like.${hashBase}#%`
        await supabaseAdmin.from('facturas')
          .update({ pdf_drive_id: r.id, pdf_drive_url: r.webViewLink, error_mensaje: null })
          .or(orHash)
          .is('pdf_drive_id', null)
        await supabaseAdmin.from('facturas')
          .update({ estado: 'solo_drive' })
          .or(orHash)
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

  return { terminado: restantes === 0, subidas, errores, restantes }
}

async function archivarPendientes(req: VercelRequest, res: VercelResponse) {
  const lote = Math.min(Math.max(Number(req.query.lote) || 10, 1), 30)

  let resultado: ResultadoArchivarPendientes
  try {
    resultado = await archivarPendientesInterno(lote)
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
  }

  if (resultado.restantes > 0 && resultado.subidas > 0) {
    const host = req.headers.host
    const proto = (req.headers['x-forwarded-proto'] as string) || 'https'
    if (host) {
      fetch(`${proto}://${host}/api/facturas?action=archivar-pendientes&lote=${lote}`, { method: 'GET' }).catch(() => {})
    }
  }

  return res.status(200).json(resultado)
}

// ── Handler: encolar reprocesado de facturas pendientes ───────────────────
async function encolarReprocInterno(): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc('fn_encolar_reproc_pendientes')
  if (error) throw new Error(error.message)
  return Number(data) || 0
}

async function encolarReproc(res: VercelResponse) {
  try {
    const encoladas = await encolarReprocInterno()
    return res.json({ encoladas })
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
  }
}

// ── Handler: extraer líneas de detalle de facturas de proveedor ───────────
// Fuente 1 del PROMPT MAESTRO granularidad total. Reprocesa histórico por
// tandas: cada invocación toma un lote de facturas con lineas_estado IS NULL,
// recupera el PDF original desde el respaldo de Storage (nunca pide a Rubén
// que resuba nada), extrae texto (nativo del PDF o Tesseract si hace falta),
// pide a Anthropic las líneas y solo las inserta si la suma (+IVA de línea)
// cuadra con el total de cabecera en ±0.05€. Si no cuadra o no hay texto
// suficiente, la factura queda marcada 'sin_detalle_lineas' — nunca a medias.
const LOTE_LINEAS = 30
const PRESUPUESTO_LINEAS_MS = 240_000

async function extraerLineasBatch(req: VercelRequest, res: VercelResponse) {
  const arranque = Date.now()
  const limiteParam = Number(req.query.limite || 0)
  const limiteTotal = limiteParam > 0 ? limiteParam : Infinity

  let procesadas = 0, ok = 0, sinDetalle = 0, errores = 0
  const detalle: Array<{ id: string; proveedor: string | null; resultado: string; motivo?: string }> = []

  while (Date.now() - arranque < PRESUPUESTO_LINEAS_MS && procesadas < limiteTotal) {
    const restLote = Math.min(LOTE_LINEAS, limiteTotal - procesadas)
    const { data: facturas, error } = await supabaseAdmin
      .from('facturas')
      .select('id, pdf_hash, proveedor_nombre, total, fecha_factura')
      .eq('tipo', 'proveedor')
      .is('lineas_estado', null)
      .not('total', 'is', null)
      .gt('total', 0)
      .order('fecha_factura', { ascending: true })
      .limit(restLote)

    if (error) return res.status(500).json({ error: error.message })
    if (!facturas || facturas.length === 0) break

    for (const f of facturas) {
      const facturaId = f.id as string
      const total = Number(f.total)
      const proveedor = (f.proveedor_nombre as string) || 'PROVEEDOR'
      const hash = f.pdf_hash as string | null
      procesadas++

      const marcarSinDetalle = async (motivo: string, diff?: number) => {
        await supabaseAdmin.from('facturas').update({
          lineas_estado: 'sin_detalle_lineas',
          notas_error: `[lineas] ${motivo}`,
          ...(diff !== undefined ? { detalle_lineas_diff: diff } : {}),
        }).eq('id', facturaId)
        sinDetalle++
        detalle.push({ id: facturaId, proveedor, resultado: 'sin_detalle_lineas', motivo })
      }

      try {
        if (!hash) { await marcarSinDetalle('sin pdf_hash (sin respaldo localizable)'); continue }

        // BUG encontrado en producción (10-jul): archivo_respaldo tiene hashes duplicados
        // en ~3.052 casos (reintentos de subida del mismo archivo). `.maybeSingle()` lanza
        // error silencioso cuando hay >1 fila para ese hash — el código solo desestructuraba
        // `data` (ignoraba `error`), así que `respaldo` quedaba `null` y la factura se
        // marcaba "sin fila en archivo_respaldo" AUNQUE SÍ existiera respaldo. Esto hacía
        // fallar ~70% de las facturas de golpe. Fix: pedir varias filas ordenadas por
        // `actualizado` desc y quedarse con la más reciente, sin usar maybeSingle().
        const { data: respaldos } = await supabaseAdmin
          .from('archivo_respaldo')
          .select('storage_path')
          .eq('hash', hash)
          .order('actualizado', { ascending: false })
          .limit(1)
        const respaldo = respaldos?.[0]
        if (!respaldo?.storage_path) { await marcarSinDetalle('sin fila en archivo_respaldo'); continue }

        const buffer = await descargarRespaldoStorage(respaldo.storage_path as string)
        if (!buffer) { await marcarSinDetalle('descarga de Storage fallida'); continue }

        let texto = await extraerTextoPDF(buffer)
        if (!pdfTieneTexto(texto)) {
          texto = await extraerTextoOCRGratis(buffer, 'pdf')
        }
        if (!texto || texto.trim().length < 20) { await marcarSinDetalle('sin texto extraíble del PDF'); continue }

        const lineas = await extraerLineasFacturaTexto(texto, total, proveedor)
        if (!lineas || lineas.length === 0) { await marcarSinDetalle('IA no devolvió líneas (posible factura recapitulativa sin desglose)'); continue }

        const suma = sumaConIva(lineas)
        const diff = Math.round(Math.abs(suma - total) * 100) / 100
        if (diff > 0.05) {
          await marcarSinDetalle(`descuadre ${diff.toFixed(2)}€ (líneas ${suma.toFixed(2)} vs total ${total.toFixed(2)})`, diff)
          continue
        }

        const filas = lineas.map(l => {
          let precioUnit = l.precio_unitario
          if (precioUnit == null && l.total_linea != null && l.cantidad > 0) precioUnit = Math.round((l.total_linea / l.cantidad) * 10000) / 10000
          return {
            factura_id: facturaId,
            descripcion: l.descripcion,
            cantidad: l.cantidad,
            unidad: l.unidad,
            precio_unitario: precioUnit,
            total_linea: l.total_linea,
            proveedor_nombre: proveedor,
            fecha: f.fecha_factura,
            origen: 'ocr_anthropic',
          }
        })
        const { error: insErr } = await supabaseAdmin.from('facturas_lineas').insert(filas)
        if (insErr) { await marcarSinDetalle(`insert fallido: ${insErr.message}`); continue }

        await supabaseAdmin.from('facturas').update({ lineas_estado: 'ok', detalle_lineas_diff: diff }).eq('id', facturaId)
        ok++
        detalle.push({ id: facturaId, proveedor, resultado: 'ok' })
      } catch (err) {
        errores++
        const motivo = err instanceof Error ? err.message : String(err)
        await supabaseAdmin.from('facturas').update({ lineas_estado: 'sin_detalle_lineas', notas_error: `[lineas] error: ${motivo}` }).eq('id', facturaId)
        detalle.push({ id: facturaId, proveedor, resultado: 'error', motivo })
      }
    }
  }

  const { count: restantes } = await supabaseAdmin
    .from('facturas')
    .select('id', { count: 'exact', head: true })
    .eq('tipo', 'proveedor')
    .is('lineas_estado', null)
    .not('total', 'is', null)
    .gt('total', 0)

  return res.status(200).json({ procesadas, ok, sin_detalle_lineas: sinDetalle, errores, restantes: restantes ?? 0, detalle })
}

// ── Motor de tareas de papeleo_tareas (Fase 1 · PROMPT MAESTRO PAPELEO) ────
// Único punto de entrada del trabajo pesado: el botón "Resolver pendientes"
// crea filas en papeleo_tareas; este tick (llamado cada 5 min por el cron
// papeleo-agenda-tick, SOLO cuando hay algo programada/en_curso cortada) toma
// la más antigua elegible y avanza un presupuesto de tiempo. Nunca se lanza
// solo — sin tareas, el cron ni siquiera llama a este endpoint (WHERE EXISTS).
const PRESUPUESTO_TICK_MS = 250_000
const LOTE_CONCILIAR = 50

function getExtManifiesto(nombre: string): string {
  return nombre.split('.').pop()?.toLowerCase() ?? ''
}

function getMimeTypeManifiesto(ext: string): string {
  const map: Record<string, string> = {
    pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', tif: 'image/tiff',
    tiff: 'image/tiff', gif: 'image/gif', bmp: 'image/bmp', csv: 'text/csv',
    txt: 'text/plain', rar: 'application/x-rar-compressed', '7z': 'application/x-7z-compressed',
    zip: 'application/zip', eml: 'message/rfc822', msg: 'application/vnd.ms-outlook',
  }
  return map[ext] ?? 'application/octet-stream'
}

interface ResultadoTick {
  procesados: number; ok: number; errores: number; terminado: boolean
  cursor: Record<string, unknown>; detalle: string | null
}

// ── Handler: contadores reales de pendientes (botón "Resolver pendientes") ─
async function resolverInventario(res: VercelResponse) {
  const [enStorage, relectura, archivoDrive, zombie] = await Promise.all([
    supabaseAdmin.from('v_ocr_dormidos_reales').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('facturas').select('id', { count: 'exact', head: true })
      .or('total.is.null,total.eq.0').not('pdf_drive_id', 'is', null)
      .not('estado', 'in', '(conciliada,asociada,pendiente_lectura_manual)'),
    supabaseAdmin.from('archivo_respaldo').select('id', { count: 'exact', head: true }).is('drive_id', null),
    supabaseAdmin.from('facturas').select('id', { count: 'exact', head: true })
      .eq('proveedor_nombre', 'Procesando...').lt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()),
  ])

  const en_storage = enStorage.count ?? 0
  const releer_ocr = relectura.count ?? 0
  const archivar_drive = archivoDrive.count ?? 0
  const limpieza_zombies = zombie.count ?? 0

  return res.status(200).json({
    en_storage,
    releer_ocr,
    archivar_drive,
    limpieza: limpieza_zombies,
    total: en_storage + releer_ocr + archivar_drive + limpieza_zombies,
  })
}

// ── Handler: tick del motor (llamado por el cron papeleo-agenda-tick) ──────
async function agendaTick(req: VercelRequest, res: VercelResponse) {
  // Claim atómico (FOR UPDATE SKIP LOCKED en el RPC): el tick inmediato del
  // botón y el del cron pueden solaparse; el claim garantiza que dos
  // invocaciones concurrentes nunca cogen la misma tarea. Devuelve la tarea ya
  // marcada en_curso, o null si no hay ninguna elegible / otra la tomó primero.
  const { data: tarea, error: errSel } = await supabaseAdmin
    .rpc('fn_papeleo_claim_tarea')
    .maybeSingle<Record<string, unknown>>()

  if (errSel) return res.status(500).json({ error: errSel.message })
  if (!tarea || !tarea.id) return res.status(200).json({ ok: true, mensaje: 'sin tareas pendientes' })

  // Guardarraíl: despertar_dormidos nunca compite con una subida real en curso
  // por el worker OCR. Si hay una sesión viva que NO es de despertar_ (grupo_id
  // propio de una subida real de Rubén), se pospone 15 min sin marcarla error
  // (vuelve a 'programada', liberando el claim). El resto de tipos no espera.
  if (tarea.tipo === 'despertar_dormidos') {
    const { count: subidaViva } = await supabaseAdmin
      .from('ocr_sessions')
      .select('id', { count: 'exact', head: true })
      .in('estado_cola', ['en_espera', 'procesando'])
      .not('grupo_id', 'like', 'despertar_%')
    if ((subidaViva ?? 0) > 0) {
      const pospuestaPara = new Date(Date.now() + 15 * 60 * 1000).toISOString()
      await supabaseAdmin.from('papeleo_tareas')
        .update({ estado: 'programada', programada_para: pospuestaPara, ultimo_latido: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', tarea.id as string)
      return res.status(200).json({ ok: true, pospuesta: true, tarea: tarea.id, motivo: 'subida en curso', programada_para: pospuestaPara })
    }
  }

  const arranque = Date.now()
  let resultado: ResultadoTick

  try {
    switch (tarea.tipo as string) {
      case 'despertar_dormidos': resultado = await tickDespertarDormidos(tarea, arranque); break
      case 'releer_ocr':         resultado = await tickReleerOcr(tarea); break
      case 'archivar_drive':     resultado = await tickArchivarDrive(tarea, arranque); break
      case 'limpieza':           resultado = await tickLimpieza(req); break
      case 'conciliar':          resultado = await tickConciliar(tarea, arranque); break
      default:
        resultado = { procesados: 0, ok: 0, errores: 0, terminado: true, cursor: (tarea.cursor as Record<string, unknown>) || {}, detalle: `tipo desconocido: ${String(tarea.tipo)}` }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await supabaseAdmin.from('papeleo_tareas')
      .update({ estado: 'error', detalle: msg, ultimo_latido: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', tarea.id as string)
    return res.status(200).json({ ok: false, tarea: tarea.id, tipo: tarea.tipo, error: msg })
  }

  const nuevoEstado = resultado.terminado ? 'completada' : 'en_curso'
  await supabaseAdmin.from('papeleo_tareas').update({
    estado: nuevoEstado,
    procesados: (Number(tarea.procesados) || 0) + resultado.procesados,
    ok: (Number(tarea.ok) || 0) + resultado.ok,
    errores: (Number(tarea.errores) || 0) + resultado.errores,
    cursor: resultado.cursor,
    detalle: resultado.detalle ?? (tarea.detalle as string | null),
    ultimo_latido: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', tarea.id as string)

  if (resultado.terminado && tarea.tipo !== 'conciliar') {
    const { data: yaHayConciliar } = await supabaseAdmin
      .from('papeleo_tareas').select('id')
      .eq('tipo', 'conciliar').in('estado', ['pendiente', 'programada', 'en_curso'])
      .limit(1).maybeSingle()
    if (!yaHayConciliar) {
      await supabaseAdmin.from('papeleo_tareas').insert({
        tipo: 'conciliar', estado: 'programada', programada_para: new Date().toISOString(),
        cursor: { desde: tarea.created_at },
      })
    }
  }

  return res.status(200).json({
    ok: true, tarea: tarea.id, tipo: tarea.tipo, terminado: resultado.terminado,
    procesados: resultado.procesados, ok_tick: resultado.ok, errores: resultado.errores,
  })
}

// tipo despertar_dormidos: huérfanos DE VERDAD (v_ocr_dormidos_reales — excluye
// cualquier storage_path que ya esté en la cola de una sesión de subida viva,
// FIX 21-jul) → se reconstruyen en tandas de ≤200 archivos como ocr_sessions
// nuevas y se deja que el worker Edge ocr-procesar-sesion las procese. Cursor
// por id (orden estable, no hace falta que sea cronológico) para no repetir
// ni saltar filas.
async function tickDespertarDormidos(tarea: Record<string, unknown>, arranque: number): Promise<ResultadoTick> {
  const lote = Math.min(Math.max(Number(tarea.lote_tamano) || 30, 1), 200)
  const cursor = (tarea.cursor as { ultimo_id?: string }) || {}
  let ultimoId = cursor.ultimo_id ?? null

  let procesados = 0, ok = 0, errores = 0
  let terminado = false

  while (Date.now() - arranque < PRESUPUESTO_TICK_MS) {
    let q = supabaseAdmin
      .from('v_ocr_dormidos_reales')
      .select('id, nombre, storage_path')
      .order('id', { ascending: true })
      .limit(lote)
    if (ultimoId) q = q.gt('id', ultimoId)

    const { data: filas, error } = await q
    if (error) throw new Error(error.message)
    if (!filas || filas.length === 0) { terminado = true; break }

    // Comprobación de existencia por LOTE, no por archivo: listamos cada carpeta
    // implicada UNA vez (paginando) y comprobamos pertenencia en memoria. Con el
    // bucket vacío (objetos ya purgados) esto es 1 llamada por carpeta en vez de
    // una por archivo. El presupuesto de tiempo del tick acota el paginado.
    const carpetas = new Set<string>()
    for (const f of filas) {
      const sp = f.storage_path as string | null
      if (sp) carpetas.add(sp.split('/').slice(0, -1).join('/'))
    }
    const existentes = new Set<string>()
    for (const carpeta of carpetas) {
      let offset = 0
      const PAG = 1000
      for (let pagina = 0; pagina < 50; pagina++) {
        let listado: { name: string }[] | null = null
        try {
          const r = await supabaseAdmin.storage.from('ocr-uploads').list(carpeta, { limit: PAG, offset })
          listado = r.data as { name: string }[] | null
        } catch { listado = null }
        if (!listado || listado.length === 0) break
        for (const o of listado) existentes.add(`${carpeta}/${o.name}`)
        if (listado.length < PAG) break
        offset += PAG
      }
    }

    const archivos: { name: string; type: string; storagePath: string; esComprimido: boolean }[] = []
    const ausentes: string[] = []
    for (const f of filas) {
      const storagePath = f.storage_path as string | null
      const nombre = f.nombre as string
      const existe = !!storagePath && existentes.has(storagePath)

      if (!existe) {
        ausentes.push(f.id as string)
        errores++
      } else {
        const ext = getExtManifiesto(nombre)
        archivos.push({ name: nombre, type: getMimeTypeManifiesto(ext), storagePath: storagePath as string, esComprimido: ['zip', 'rar', '7z'].includes(ext) })
        ok++
      }
      procesados++
      ultimoId = f.id as string
    }

    if (ausentes.length > 0) {
      await supabaseAdmin.from('ocr_manifiesto')
        .update({ estado: 'error', detalle: 'objeto ausente en storage', actualizado: new Date().toISOString() })
        .in('id', ausentes)
    }

    if (archivos.length > 0) {
      const sesionId = `despertar_${tarea.id}_${ultimoId}`
      await supabaseAdmin.from('ocr_sessions').insert({
        id: sesionId, total: archivos.length, enviados: 0, ok: 0, pendientes: 0, duplicados: 0,
        ignorados: 0, errores: 0, achtung: 0, cancelados: 0, achtung_mensaje: null, achtung_tipo: null,
        log: [], archivos_pendientes: archivos, estado: 'procesando', fn_name: 'ocr-procesar-factura',
        titular_id: null, visible: true, cancelar_solicitado: false, estado_cola: 'en_espera',
        grupo_id: `despertar_${tarea.id}`, subidos_storage: archivos.length, total_storage: archivos.length,
        pausar_solicitado: false,
      })
      try { await supabaseAdmin.functions.invoke('ocr-procesar-sesion', { body: {} }) } catch { /* red de seguridad ocr-worker-trigger ya existente lo reintenta */ }
    }

    if (filas.length < lote) { terminado = true; break }
  }

  return { procesados, ok, errores, terminado, cursor: { ultimo_id: ultimoId }, detalle: null }
}

// tipo releer_ocr: exactamente el flujo actual encolar-reproc + reproc, sin
// duplicar lógica (llama a las mismas funciones internas que usan las
// actions HTTP existentes).
async function tickReleerOcr(tarea: Record<string, unknown>): Promise<ResultadoTick> {
  const cursor = (tarea.cursor as { encolado?: boolean }) || {}
  if (!cursor.encolado) await encolarReprocInterno()

  const resultado = await reprocInterno()
  return {
    procesados: resultado.procesadas, ok: resultado.ok_tanda, errores: resultado.errores_tanda,
    terminado: resultado.terminado, cursor: { encolado: true }, detalle: resultado.motivo_fin,
  }
}

// tipo archivar_drive: handler archivarPendientes existente, en bucle por presupuesto.
async function tickArchivarDrive(tarea: Record<string, unknown>, arranque: number): Promise<ResultadoTick> {
  const lote = Math.min(Math.max(Number(tarea.lote_tamano) || 10, 1), 30)
  let subidasAcum = 0, erroresAcum = 0, terminado = false

  while (Date.now() - arranque < PRESUPUESTO_TICK_MS) {
    const r = await archivarPendientesInterno(lote)
    subidasAcum += r.subidas
    erroresAcum += r.errores
    if (r.terminado) { terminado = true; break }
    if (r.subidas === 0 && r.errores === 0) break
  }

  return { procesados: subidasAcum + erroresAcum, ok: subidasAcum, errores: erroresAcum, terminado, cursor: (tarea.cursor as Record<string, unknown>) || {}, detalle: null }
}

// tipo limpieza: handler ocr-cleanup existente (archivo propio bajo la
// puerta), un único disparo interno que ya recorre todo el storage huérfano.
async function tickLimpieza(req: VercelRequest): Promise<ResultadoTick> {
  const host = req.headers.host
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https'
  if (!host) return { procesados: 0, ok: 0, errores: 0, terminado: true, cursor: {}, detalle: 'sin host en la petición' }

  const r = await fetch(`${proto}://${host}/api/ocr-cleanup`, { method: 'GET' })
  const j = (await r.json().catch(() => ({}))) as { borrados?: number; errores?: number }
  const borrados = Number(j.borrados) || 0
  const errores = Number(j.errores) || 0
  return { procesados: borrados + errores, ok: borrados, errores, terminado: true, cursor: {}, detalle: null }
}

// tipo conciliar: auto_match_factura fila a fila (LEY-MATCH-04, nunca UPDATE
// masivo). Paginación por keyset (created_at, id): el cursor avanza monótono y
// cada factura se intenta exactamente una vez por tarea, sin acumular una lista
// de ids en el cursor ni un IN (...) que crezca sin techo. `desde` es el suelo
// (arranque de la tarea madre); `pos` es la posición de avance dentro de él.
async function tickConciliar(tarea: Record<string, unknown>, arranque: number): Promise<ResultadoTick> {
  const cursor = (tarea.cursor as { desde?: string; pos_ca?: string; pos_id?: string }) || {}
  const desde = cursor.desde || (tarea.created_at as string)
  let posCa = cursor.pos_ca ?? null
  let posId = cursor.pos_id ?? null

  let procesados = 0, ok = 0, errores = 0, terminado = false

  while (Date.now() - arranque < PRESUPUESTO_TICK_MS) {
    let q = supabaseAdmin
      .from('facturas')
      .select('id, created_at')
      .in('estado', ['sin_match', 'pendiente_revision'])
      .or('no_conciliable.is.null,no_conciliable.eq.false')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(LOTE_CONCILIAR)
    // Keyset: created_at > pos_ca OR (created_at = pos_ca AND id > pos_id).
    // Sin posición previa, el suelo es `desde` (arranque de la tarea madre).
    if (posCa) q = q.or(`created_at.gt.${posCa},and(created_at.eq.${posCa},id.gt.${posId})`)
    else q = q.gt('created_at', desde)

    const { data: filas, error } = await q
    if (error) throw new Error(error.message)
    if (!filas || filas.length === 0) { terminado = true; break }

    for (const f of filas) {
      const id = f.id as string
      try {
        const { data: matched } = await supabaseAdmin.rpc('auto_match_factura', { p_factura_id: id })
        if (matched) ok++
      } catch {
        errores++
      }
      procesados++
      posCa = f.created_at as string
      posId = id
    }

    if (filas.length < LOTE_CONCILIAR) { terminado = true; break }
  }

  return { procesados, ok, errores, terminado, cursor: { desde, pos_ca: posCa, pos_id: posId }, detalle: null }
}
