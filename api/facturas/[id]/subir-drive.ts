import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../../_lib/supabase-admin.js'
import { generarNombreArchivo, subirArchivoADrive } from '../../_lib/google-drive.js'
import { extensionDeNombre } from '../../_lib/detectarTipo.js'

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
  maxDuration: 60,
}

type Body = { base64: string; nombre?: string }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const id = String(req.query.id || '')
  if (!id) return res.status(400).json({ error: 'Falta id' })

  const body = (req.body || {}) as Body
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
      titular_id: factura.titular_id,
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
