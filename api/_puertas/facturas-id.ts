import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'
import { borrarArchivoDeDrive } from '../_lib/google-drive.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = String(req.query.id || '')
  if (!id) return res.status(400).json({ error: 'Falta id' })

  if (req.method === 'PUT') {
    const body = (req.body || {}) as Record<string, unknown>
    const update: Record<string, unknown> = {}
    const camposPermitidos = [
      'proveedor_nombre',
      'numero_factura',
      'fecha_factura',
      'total_base',
      'total_iva',
      'total',
      'es_recapitulativa',
      'periodo_inicio',
      'periodo_fin',
      'tipo',
      'plataforma',
      'estado',
      'mensaje_matching',
    ]
    for (const k of camposPermitidos) {
      if (k in body) update[k] = body[k]
    }
    const { error } = await supabaseAdmin.from('facturas').update(update).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  if (req.method === 'DELETE') {
    // ¿Borrar también el archivo en Google Drive?
    // El front pregunta al usuario y, si confirma, llama con ?drive=1 (o body.borrar_drive).
    const body = (req.body || {}) as Record<string, unknown>
    const borrarDrive =
      String(req.query.drive || '') === '1' ||
      req.query.drive === 'true' ||
      body.borrar_drive === true

    // Recuperar el drive_id ANTES de borrar la fila (después ya no se puede).
    let driveId: string | null = null
    if (borrarDrive) {
      const { data } = await supabaseAdmin
        .from('facturas')
        .select('pdf_drive_id')
        .eq('id', id)
        .maybeSingle()
      driveId = (data?.pdf_drive_id as string) || null
    }

    await supabaseAdmin.from('facturas_gastos').delete().eq('factura_id', id)
    const { error } = await supabaseAdmin.from('facturas').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })

    // Borrado en Drive (a papelera). Best-effort: si falla, la factura ya se
    // borró de la base de datos; se informa del resultado del borrado en Drive.
    let drive_borrado: boolean | null = null
    let drive_error: string | null = null
    if (borrarDrive) {
      if (driveId) {
        const r = await borrarArchivoDeDrive(driveId)
        drive_borrado = r.ok
        drive_error = r.ok ? null : (r.error || 'no se pudo borrar en Drive')
      } else {
        drive_borrado = false
        drive_error = 'la factura no tenía copia en Drive'
      }
    }

    return res.status(200).json({ ok: true, drive_borrado, drive_error })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
