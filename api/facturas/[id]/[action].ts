import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../../_lib/supabase-admin.js'
import { aplicarMatching, matchFactura } from '../../_lib/matching.js'
import { generarNombreArchivo, subirArchivoADrive, descargarArchivoDeDrive } from '../../_lib/google-drive.js'
import { extensionDeNombre } from '../../_lib/detectarTipo.js'
import { extraerTextoPDF } from '../../_lib/extractores.js'
import { extraerLineasAnthropicTexto } from '../../_lib/extraerLineasFactura.js'

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
  maxDuration: 60,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const id = String(req.query.id || '')
  const action = String(req.query.action || '')
  if (!id) return res.status(400).json({ error: 'Falta id' })

  switch (action) {
    case 'asociar':
      return asociar(req, res, id)
    case 'confirmar':
      return confirmar(res, id)
    case 'rechazar':
      return rechazar(res, id)
    case 'reintentar':
      return reintentar(res, id)
    case 'rematch':
      return rematch(res, id)
    case 'subir-drive':
      return subirDrive(req, res, id)
    case 'extraer-lineas':
      return extraerLineas(res, id)
    default:
      return res.status(404).json({ error: `Acción desconocida: ${action}` })
  }
}

async function asociar(req: VercelRequest, res: VercelResponse, id: string) {
  const body = (req.body || {}) as { conciliacion_ids?: string[] }
  const ids = Array.isArray(body.conciliacion_ids) ? body.conciliacion_ids : []
  if (ids.length === 0) return res.status(400).json({ error: 'conciliacion_ids vacío' })

  const { data: movs } = await supabaseAdmin
    .from('conciliacion')
    .select('id, importe')
    .in('id', ids)

  if (!movs || movs.length === 0) return res.status(400).json({ error: 'Sin movimientos válidos' })

  const filas = movs.map((m) => ({
    factura_id: id,
    conciliacion_id: m.id as string,
    importe_asociado: Math.abs(Number(m.importe)),
    confirmado: true,
    confianza_match: 100,
  }))
  await supabaseAdmin.from('facturas_gastos').upsert(filas, { onConflict: 'factura_id,conciliacion_id' })
  await supabaseAdmin
    .from('facturas')
    .update({ estado: 'asociada', mensaje_matching: 'Asociada manualmente' })
    .eq('id', id)

  return res.status(200).json({ ok: true })
}

async function confirmar(res: VercelResponse, id: string) {
  await supabaseAdmin.from('facturas_gastos').update({ confirmado: true }).eq('factura_id', id)
  await supabaseAdmin.from('facturas').update({ estado: 'asociada' }).eq('id', id)
  return res.status(200).json({ ok: true })
}

async function rechazar(res: VercelResponse, id: string) {
  await supabaseAdmin.from('facturas_gastos').delete().eq('factura_id', id)
  await supabaseAdmin
    .from('facturas')
    .update({ estado: 'error', mensaje_matching: 'Descartada manualmente' })
    .eq('id', id)
  return res.status(200).json({ ok: true })
}

async function reintentar(res: VercelResponse, id: string) {
  await supabaseAdmin
    .from('facturas')
    .update({ estado: 'procesando', error_mensaje: null })
    .eq('id', id)
  return res.status(200).json({ ok: true, info: 'Marcada para reprocesar. Vuelve a subir el archivo.' })
}

async function rematch(res: VercelResponse, id: string) {
  const { data: factura, error } = await supabaseAdmin
    .from('facturas')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !factura) return res.status(404).json({ error: 'Factura no encontrada' })

  const resultado = await matchFactura(supabaseAdmin, {
    ...factura,
    total: Number(factura.total),
  })
  await aplicarMatching(supabaseAdmin, id, resultado)
  return res.status(200).json({ ok: true, estado: resultado.estado, mensaje: resultado.mensaje })
}

// Extrae las líneas de compra (detalle producto a producto) de una factura de
// proveedor ya archivada en Drive. Reutilizable tanto desde la UI (botón
// "Extraer líneas") como desde el script de reproceso histórico.
async function extraerLineas(res: VercelResponse, id: string) {
  const { data: factura, error } = await supabaseAdmin
    .from('facturas')
    .select('id,tipo,total,pdf_drive_id,proveedor_nombre,fecha_factura')
    .eq('id', id)
    .maybeSingle()
  if (error || !factura) return res.status(404).json({ error: error?.message || 'Factura no encontrada' })

  // Solo facturas de proveedor tienen líneas de compra: las de plataforma
  // (Uber/Glovo/Just Eat) son comisiones, sin desglose de producto.
  if (factura.tipo !== 'proveedor') {
    await supabaseAdmin.from('facturas')
      .update({ lineas_estado: 'no_aplica', estado_detalle_lineas: 'Factura de plataforma: no aplica', detalle_lineas_diff: 0 })
      .eq('id', id)
    return res.status(200).json({ ok: true, estado: 'no_aplica' })
  }
  if (!factura.pdf_drive_id) {
    await supabaseAdmin.from('facturas')
      .update({ lineas_estado: 'sin_detalle_lineas', estado_detalle_lineas: 'Sin PDF en Drive' })
      .eq('id', id)
    return res.status(200).json({ ok: true, estado: 'sin_detalle_lineas' })
  }

  let resultado
  try {
    const buffer = await descargarArchivoDeDrive(factura.pdf_drive_id)
    const texto = await extraerTextoPDF(buffer)
    resultado = await extraerLineasAnthropicTexto(texto, Number(factura.total) || 0)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await supabaseAdmin.from('facturas')
      .update({ lineas_estado: 'error', estado_detalle_lineas: `Descarga/lectura: ${msg}` })
      .eq('id', id)
    return res.status(500).json({ error: msg })
  }

  if (resultado.estado === 'con_lineas' && resultado.lineas.length > 0) {
    // Reproceso limpio: fuera las líneas de origen 'ocr_auto' anteriores de esta factura.
    await supabaseAdmin.from('facturas_lineas').delete().eq('factura_id', id).eq('origen', 'ocr_auto')
    const filas = resultado.lineas.map((l) => ({
      factura_id: id,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      unidad: l.unidad,
      precio_unitario: l.precio_unitario,
      total_linea: l.total_linea,
      iva_pct: l.iva_pct,
      origen: 'ocr_auto',
      proveedor_nombre: factura.proveedor_nombre,
      fecha: factura.fecha_factura,
    }))
    await supabaseAdmin.from('facturas_lineas').insert(filas)
  }

  await supabaseAdmin.from('facturas')
    .update({
      lineas_estado: resultado.estado,
      estado_detalle_lineas: resultado.motivo,
      detalle_lineas_diff: resultado.diff,
    })
    .eq('id', id)

  return res.status(200).json({ ok: true, estado: resultado.estado, motivo: resultado.motivo, n_lineas: resultado.lineas.length })
}

async function subirDrive(req: VercelRequest, res: VercelResponse, id: string) {
  const body = (req.body || {}) as { base64?: string; nombre?: string }
  if (!body.base64) return res.status(400).json({ error: 'Falta base64' })

  const { data: factura, error: errF } = await supabaseAdmin
    .from('facturas')
    .select('id, proveedor_nombre, numero_factura, fecha_factura, tipo, plataforma, titular_id, pdf_original_name')
    .eq('id', id)
    .maybeSingle()
  if (errF || !factura) return res.status(404).json({ error: errF?.message || 'Factura no encontrada' })

  let carpetaTitular = 'SIN_TITULAR'
  if (factura.titular_id) {
    const { data: t } = await supabaseAdmin
      .from('titulares')
      .select('carpeta_drive')
      .eq('id', factura.titular_id)
      .maybeSingle()
    if (t?.carpeta_drive) carpetaTitular = t.carpeta_drive as string
  }

  const nombreOriginal = body.nombre || factura.pdf_original_name || 'factura.pdf'
  const ext = extensionDeNombre(nombreOriginal)
  const buffer = Buffer.from(body.base64, 'base64')
  const nombreArchivo = generarNombreArchivo(
    {
      proveedor_nombre: factura.proveedor_nombre,
      numero_factura: factura.numero_factura,
      fecha_factura: factura.fecha_factura,
      tipo: factura.tipo,
      plataforma: factura.plataforma,
    },
    ext,
  )

  try {
    const drive = await subirArchivoADrive(buffer, nombreArchivo, {
      proveedor_nombre: factura.proveedor_nombre,
      numero_factura: factura.numero_factura,
      fecha_factura: factura.fecha_factura,
      tipo: factura.tipo,
      plataforma: factura.plataforma,
      carpeta_titular: carpetaTitular,
    }, ext)
    await supabaseAdmin
      .from('facturas')
      .update({
        pdf_drive_id: drive.id,
        pdf_drive_url: drive.webViewLink,
        error_mensaje: null,
      })
      .eq('id', id)
    return res.status(200).json({ ok: true, pdf_drive_id: drive.id, pdf_drive_url: drive.webViewLink })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await supabaseAdmin
      .from('facturas')
      .update({ error_mensaje: `Drive: ${msg}` })
      .eq('id', id)
    return res.status(500).json({ error: msg })
  }
}
