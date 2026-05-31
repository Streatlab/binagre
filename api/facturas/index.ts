/**
 * Dispatcher consolidado de /api/facturas
 *
 * Rutas soportadas:
 *   GET  /api/facturas                          → lista de facturas (rango)
 *   GET  /api/facturas?action=buscar-cargos     → buscar cargos en conciliación
 *   GET  /api/facturas?action=faltantes         → facturas faltantes
 *   GET  /api/facturas?action=resubir-drive     → listado pdf sin drive_id
 *   GET  /api/facturas?action=reproc            → reprocesado masivo 0 API (lote + auto-encadenado)
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

// ── Handler: reprocesado masivo 0 API (auto-encadenado) ───────────────────
// Coge el job activo de reproc_control, procesa un lote, baja cada PDF de Drive,
// lo re-pasa por el motor nuevo (reglas + diccionario + match + categoría/
// contraparte + auditoría 1-a-1), guarda informe en reproc_informe, avanza el
// offset y se vuelve a llamar a sí mismo hasta acabar. Sin cron de Vercel.
const LOTE_REPROC = 20

async function reproc(req: VercelRequest, res: VercelResponse) {
  const { data: job } = await supabaseAdmin
    .from('reproc_control')
    .select('*')
    .eq('activo', true)
    .order('creado', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!job) return res.status(200).json({ ok: true, mensaje: 'Sin jobs activos' })

  const offset = Number(job.offset_actual || 0)
  const sesionId = (job.sesion_id as string) || `reproc-${job.id}`

  let q = supabaseAdmin
    .from('facturas')
    .select('id, pdf_drive_id, pdf_original_name, proveedor_nombre, fecha_factura, total')
    .not('pdf_drive_id', 'is', null)
    .order('fecha_factura', { ascending: true })
    .range(offset, offset + LOTE_REPROC - 1)

  if (job.desde) q = q.gte('fecha_factura', job.desde as string)
  if (job.hasta) q = q.lte('fecha_factura', job.hasta as string)

  const { data: facturas, error } = await q
  if (error) return res.status(500).json({ error: error.message })

  if (!facturas || facturas.length === 0) {
    await supabaseAdmin.from('reproc_control').update({ activo: false, ultimo_run: new Date().toISOString() }).eq('id', job.id as string)
    return res.status(200).json({ ok: true, job: job.id, mensaje: 'Job completado', offset })
  }

  let ok = 0, errores = 0, conciliadas = 0
  const lineas: Record<string, unknown>[] = []

  for (const f of facturas) {
    const driveId = f.pdf_drive_id as string
    const nombre = (f.pdf_original_name as string) || `${f.id}.pdf`
    try {
      const buffer = await descargarArchivoDeDrive(driveId)
      await supabaseAdmin.from('facturas_gastos').delete().eq('factura_id', f.id as string)
      await supabaseAdmin.from('facturas_plataforma_detalle').delete().eq('factura_id', f.id as string)
      await supabaseAdmin.from('facturas').delete().eq('id', f.id as string)

      const resultados = await procesarArchivo(supabaseAdmin, { nombre, buffer }, sesionId)
      const r = resultados[0]
      const fac = (r.factura || r.factura_existente) as Record<string, unknown> | undefined
      const estadoFinal = (fac?.estado as string) || null
      const conc = ['conciliada', 'asociada'].includes(estadoFinal || '')
      const resultado = r.estado === 'ok' ? 'ok' : r.estado === 'duplicada' ? 'duplicada' : 'error'
      if (resultado === 'error') errores++; else ok++
      if (conc) conciliadas++
      lineas.push({
        control_id: job.id,
        factura_id: (r.factura_id as string) || (f.id as string),
        archivo: nombre,
        proveedor: (fac?.proveedor_nombre as string) || (f.proveedor_nombre as string) || null,
        total: fac?.total != null ? Number(fac.total) : (f.total != null ? Number(f.total) : null),
        resultado,
        estado_final: estadoFinal,
        conciliada: conc,
        en_drive: !!(fac?.pdf_drive_id),
        motivo: r.motivo || r.error || null,
      })
    } catch (e) {
      errores++
      lineas.push({
        control_id: job.id,
        factura_id: f.id as string,
        archivo: nombre,
        proveedor: (f.proveedor_nombre as string) || null,
        total: f.total != null ? Number(f.total) : null,
        resultado: 'error',
        estado_final: null,
        conciliada: false,
        en_drive: false,
        motivo: e instanceof Error ? e.message : String(e),
      })
    }
  }

  if (lineas.length > 0) await supabaseAdmin.from('reproc_informe').insert(lineas)

  const nuevoOffset = offset + facturas.length
  const terminado = facturas.length < LOTE_REPROC
  await supabaseAdmin.from('reproc_control').update({
    offset_actual: nuevoOffset,
    procesadas: Number(job.procesadas || 0) + facturas.length,
    ok: Number(job.ok || 0) + ok,
    errores: Number(job.errores || 0) + errores,
    conciliadas: Number(job.conciliadas || 0) + conciliadas,
    ultimo_run: new Date().toISOString(),
    activo: !terminado,
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
    nuevo_offset: nuevoOffset, terminado,
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
