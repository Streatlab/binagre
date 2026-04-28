/**
 * Dispatcher consolidado de /api/facturas
 *
 * Rutas soportadas:
 *   GET  /api/facturas                          → lista de facturas (rango)
 *   GET  /api/facturas?action=buscar-cargos     → buscar cargos en conciliación
 *   GET  /api/facturas?action=faltantes         → facturas faltantes
 *   GET  /api/facturas?action=resubir-drive     → listado pdf sin drive_id
 *   POST /api/facturas?action=upload            → subir/procesar archivo
 *   POST /api/facturas?action=limpieza          → borrar facturas zombie
 *
 * Los archivos originales buscar-cargos.ts, faltantes.ts, limpieza.ts,
 * resubir-drive-masivo.ts y upload.ts han sido eliminados y consolidados aquí.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'
import { procesarArchivo } from '../_lib/procesarArchivo.js'

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
  maxDuration: 60,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action || '')

  // ── Dispatcher ────────────────────────────────────────────────────────────
  if (action === 'buscar-cargos') return buscarCargos(req, res)
  if (action === 'faltantes')     return faltantes(res)
  if (action === 'resubir-drive') return resubirDrive(res)
  if (action === 'upload')        return upload(req, res)
  if (action === 'limpieza')      return limpieza(res)

  // ── GET sin action → lista de facturas ───────────────────────────────────
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  return listaFacturas(req, res)
}

// ── Handler: lista facturas ────────────────────────────────────────────────
async function listaFacturas(req: VercelRequest, res: VercelResponse) {
  const rango = String(req.query.rango || '30d')
  const desde = calcDesde(rango)

  let q = supabaseAdmin
    .from('facturas')
    .select(
      'id, proveedor_id, proveedor_nombre, numero_factura, fecha_factura, es_recapitulativa, periodo_inicio, periodo_fin, tipo, plataforma, base_4, iva_4, base_10, iva_10, base_21, iva_21, total_base, total_iva, total, pdf_original_name, pdf_drive_id, pdf_drive_url, pdf_hash, estado, error_mensaje, ocr_confianza, mensaje_matching, created_at, facturas_gastos(id, conciliacion_id, importe_asociado, confianza_match, confirmado, conciliacion(id, fecha, importe, concepto, proveedor))',
    )
    .order('fecha_factura', { ascending: false })
    .limit(500)

  if (desde) q = q.gte('fecha_factura', desde)

  const { data, error } = await q
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ data: data || [] })
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

// ── Handler: upload / procesar archivo ───────────────────────────────────
async function upload(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const body = req.body as { nombre?: string; base64?: string; mimeType?: string | null }
    if (!body?.base64 || !body?.nombre) {
      return res.status(400).json({ error: 'Falta base64 o nombre' })
    }

    const buffer = Buffer.from(body.base64, 'base64')

    const resultados = await procesarArchivo(supabaseAdmin, {
      nombre: body.nombre,
      buffer,
      mimeType: body.mimeType || null,
    })

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
