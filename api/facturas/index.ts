/**
 * Dispatcher consolidado de /api/facturas
 *
 * Rutas soportadas:
 *   GET  /api/facturas                          → lista de facturas (rango)
 *   GET  /api/facturas?action=buscar-cargos     → buscar cargos en conciliación
 *   GET  /api/facturas?action=faltantes         → facturas faltantes
 *   GET  /api/facturas?action=resubir-drive     → listado pdf sin drive_id
 *   GET  /api/facturas?action=reproc            → reprocesado masivo 0 API (lote + auto-encadenado)
 *   GET  /api/facturas?action=cartero           → cartero IMAP: recoge facturas del buzón y las procesa
 *   GET  /api/facturas?action=reconciliar-pendientes → barrido de pendientes: reintenta match con
 *                                                  reglas/plantillas actuales y devuelve informe con
 *                                                  motivo de cada uno que sigue pendiente
 *   POST /api/facturas?action=upload            → subir/procesar archivo
 *   POST /api/facturas?action=limpieza          → borrar facturas zombie
 *
 * El reprocesado vive aquí (no en archivo aparte) para no superar el tope de
 * Serverless Functions del plan. Cada archivo en api/ es una función.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'
import { procesarArchivo } from '../_lib/procesarArchivo.js'
import { descargarArchivoDeDrive } from '../_lib/google-drive.js'
import { matchFactura, aplicarMatching, normalizar } from '../_lib/matching.js'
import { recogerFacturasDelCorreo } from '../_lib/gmail-cartero.js'
import type { ExtractedFactura } from '../_lib/ocr.js'

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
  maxDuration: 300,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action || '')

  // ── Dispatcher ────────────────────────────────────────────────────────────
  if (action === 'buscar-cargos') return buscarCargos(req, res)
  if (action === 'faltantes')     return faltantes(res)
  if (action === 'resubir-drive') return resubirDrive(res)
  if (action === 'reproc')        return reproc(req, res)
  if (action === 'cartero')       return cartero(req, res)
  if (action === 'reconciliar-pendientes') return reconciliarPendientes(req, res)
  if (action === 'upload')        return upload(req, res)
  if (action === 'limpieza')      return limpieza(res)

  // ── GET sin action → lista de facturas ───────────────────────────────────
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  return listaFacturas(req, res)
}

// ── Handler: lista facturas ────────────────────────────────────────────────
// La CIFRA total de la card sale de `total` (count exacto del rango): instantáneo
// y válido aunque haya millones de facturas. La lista de filas se acota con un
// tope alto de seguridad (paginar en el front cuando el histórico crezca).
async function listaFacturas(req: VercelRequest, res: VercelResponse) {
  const rango = String(req.query.rango || '30d')
  const desde = calcDesde(rango)

  // Tope de filas devueltas. Cubre histórico completo (17k+) con margen de años.
  // Para superar el max-rows por defecto de PostgREST (1000) se hace paginación
  // interna por bloques hasta completar el rango.
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

// ── Handler: cartero IMAP ──────────────────────────────────────────────────
// Recoge los adjuntos de factura del buzón facturasstreat@gmail.com por IMAP
// (contraseña de aplicación) y los pasa por el mismo motor que el botón de subir.
// Idempotente: cada mensaje procesado con éxito se MUEVE a la carpeta "Procesadas"
// del propio Gmail, así no se reprocesa. Sin límite (barre todo). 0 €.
// Marca cada factura como origen-correo (para la card y su filtro) y actualiza el
// estado del buzón (cartero_correo_estado). Uso: GET /api/facturas?action=cartero
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
    // Marcar buzón caído para que la card lo refleje.
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
        // Marcar la factura como ORIGEN CORREO (para la card y su filtro).
        // Incluye duplicadas: la factura existe y también llegó por correo.
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

  // Marcar origen-correo (idempotente con upsert por factura_id).
  if (facturasOrigenCorreo.size > 0) {
    const filas = [...facturasOrigenCorreo].map((factura_id) => ({ factura_id, marcado_en: new Date().toISOString() }))
    await supabaseAdmin.from('facturas_origen_correo').upsert(filas, { onConflict: 'factura_id', ignoreDuplicates: true })
  }

  // Mover a "Procesadas" SOLO los mensajes sin ningún fallo (los que fallaron se
  // reintentan en el próximo barrido al seguir en INBOX).
  const moverIds = [...mensajesConExito].filter((id) => !mensajesConFallo.has(id))
  try {
    await _mover(moverIds)
  } catch {
    /* best-effort: el cierre de sesión IMAP no debe tumbar la respuesta */
  }

  // Actualizar estado del buzón (conectado + último barrido).
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
// Recorre TODAS las facturas que NO están conciliadas, reintenta el matching
// contra el estado actual de reglas/plantillas/conciliación y devuelve un informe:
//   - reconciliadas: pasaron a conciliada/asociada en este barrido
//   - con_regla_sin_match: tienen alias/regla pero el importe/fecha no cuadra
//     (típico: falta extracto, importe distinto) → motivo del matching
//   - sin_regla: NO existe alias ni regla ni plantilla → hay que crearla a mano
//   - sin_plantilla: lectura manual sin plantilla de NIF → hay que crear plantilla
// LEY 100%: este informe es la verdad. Si sin_regla + sin_plantilla > 0, NO hay
// conciliación cerrada: cada uno se resuelve creando su regla/plantilla.
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

// ¿Existe alias/regla/plantilla que permita localizar este proveedor?
async function tieneReglaOAlias(proveedorNombre: string | null, nif: string | null): Promise<boolean> {
  // 1) Plantilla/regla por NIF
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
  // 2) Regla por patrón de texto (palabras del nombre)
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
  // 3) Alias de proveedor
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

  // 1) Cargar todas las pendientes del rango (estados no conciliados)
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

    // Lectura manual: no se puede matchear hasta leer la factura → necesita plantilla por NIF.
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

    // Resto de pendientes: reintentar matching con el estado actual.
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

    // Sigue pendiente: clasificar por si hay regla/alias o no.
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
// Coge el job activo de reproc_control, procesa un lote PEQUEÑO, baja cada PDF de
// Drive, lo re-pasa por el motor (reglas + Tesseract + match), guarda informe y
// AVANZA EL CONTADOR FACTURA A FACTURA (no al final del lote), luego se vuelve a
// llamar a sí mismo hasta acabar. Sin cron de Vercel.
//
// SEGURIDAD ANTI-PÉRDIDA (Rubén 03/06/26): para releer un PDF hay que borrar la
// fila (si no, el motor la detecta como duplicada y no la relee). Para que un
// fallo de relectura NO pierda la factura, se guarda la fila ORIGINAL completa
// antes de borrar y, si la relectura NO termina en 'ok'/'duplicada' (error o
// excepción), se RESTAURA la fila original tal cual. Resultado: relectura buena →
// se reemplaza; relectura mala → la factura sigue exactamente como estaba.
//
// Por qué lote pequeño + guardado por factura: algunos PDF escaneados tardan mucho
// en Tesseract. Con lotes grandes la función se quedaba sin tiempo (límite 300 s) y
// no llegaba a guardar NADA → el contador no avanzaba nunca. Con lote pequeño cada
// invocación termina holgada, guarda y encadena. Si una factura se atasca, las ya
// hechas quedan guardadas igual.
//
// MODO solo_sin_leer: solo coge facturas sin importe legible (total 0/null), las
// relee gratis con Tesseract y NO toca las ya leídas/conciliadas. Tope anti-bucle:
// para cuando `procesadas` alcanza `total_objetivo` (las sin-leer al arrancar).
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

  // Marcar arranque del lote desde ya (deja constancia aunque luego se corte).
  await supabaseAdmin.from('reproc_control').update({ ultimo_run: new Date().toISOString() }).eq('id', job.id as string)

  // select('*') para poder RESTAURAR la fila íntegra si la relectura falla.
  let q = supabaseAdmin
    .from('facturas')
    .select('*')
    .not('pdf_drive_id', 'is', null)
    .order('fecha_factura', { ascending: true })

  if (soloSinLeer) {
    // Solo las sin importe legible. Siempre el primer lote (offset 0): a medida
    // que se leen bien, salen del conjunto por sí solas.
    q = q.or('total.is.null,total.eq.0').range(0, LOTE_REPROC - 1)
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
    // Copia íntegra de la fila original para poder restaurarla si algo falla.
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
        // Relectura SIN éxito → restaurar la factura original (no se pierde nada).
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
      // Excepción (p.ej. fallo al bajar de Drive). Si ya se había borrado, restaurar.
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

    // Guardar informe + AVANZAR CONTADOR tras CADA factura (robusto ante cortes).
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

    // Tope anti-bucle en modo sin-leer: parar al alcanzar el objetivo.
    if (soloSinLeer && objetivo > 0 && procesadasAcum >= objetivo) break
  }

  const nuevoOffset = offset + facturas.length
  // Fin del job:
  //  - modo normal: cuando un lote viene incompleto (llegó al final del histórico).
  //  - modo sin-leer: cuando ya se han intentado tantas como había al arrancar.
  //    (sin objetivo válido NO se encadena, para no entrar en bucle).
  const terminado =
    facturas.length < LOTE_REPROC ||
    (soloSinLeer && (objetivo <= 0 || procesadasAcum >= objetivo))

  await supabaseAdmin.from('reproc_control').update({
    activo: !terminado,
    ultimo_run: new Date().toISOString(),
  }).eq('id', job.id as string)

  // Auto-encadenado: si quedan, dispara el siguiente lote en segundo plano.
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
    // sesionId agrupa una tanda de subida en ocr_auditoria. Si el front no lo
    // manda, se genera uno por archivo (igualmente auditable).
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
