// _puertas/equipo-reintentar-drive.ts — recorre nominas / seguridad_social_resumen /
// seguridad_social_rnt con drive_pendiente=true (el dato ya se guardó cuando se
// subió, pero Drive falló o no estaba configurado) y reintenta el archivado desde
// la copia de respaldo en Storage (drive_niveles + drive_nombre_archivo, guardados
// en el momento de la subida). GET manual — no está en el cron de vercel.json
// todavía; se dispara a mano tras conectar/arreglar Drive.
// (vive en _puertas: se sirve a través de la puerta /api/operaciones)
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'
import { descargarRespaldoStorage, subirArchivoACarpetaExacta } from '../_lib/google-drive.js'

const LIMITE_POR_TABLA = 25

interface FilaPendiente {
  id: string
  drive_niveles: string[] | null
  drive_nombre_archivo: string | null
}

async function reintentarTabla(tabla: string): Promise<{ ok: number; sigue_pendiente: number; sin_datos: number }> {
  const { data, error } = await supabaseAdmin
    .from(tabla)
    .select('id, drive_niveles, drive_nombre_archivo')
    .eq('drive_pendiente', true)
    .limit(LIMITE_POR_TABLA)
  if (error || !data) return { ok: 0, sigue_pendiente: 0, sin_datos: 0 }

  let ok = 0, sigue = 0, sinDatos = 0
  for (const fila of data as FilaPendiente[]) {
    if (!fila.drive_niveles || !fila.drive_nombre_archivo) { sinDatos++; continue }
    const storagePath = [...fila.drive_niveles, fila.drive_nombre_archivo].join('/')
    const buffer = await descargarRespaldoStorage(storagePath)
    if (!buffer) { sinDatos++; continue }

    const ext = (fila.drive_nombre_archivo.split('.').pop() || 'pdf').toLowerCase()
    const drive = await subirArchivoACarpetaExacta(buffer, fila.drive_nombre_archivo, fila.drive_niveles, ext)

    if (drive.driveOk) {
      const update: Record<string, unknown> = { drive_pendiente: false, drive_error: null }
      if (tabla === 'nominas') { update.pdf_url = drive.webViewLink || null; update.pdf_drive_url = drive.webViewLink || null }
      else if (tabla === 'seguridad_social_resumen') { update.pdf_url = drive.webViewLink || null }
      else { update.drive_url = drive.webViewLink || null } // seguridad_social_rnt
      await supabaseAdmin.from(tabla).update(update).eq('id', fila.id)
      ok++
    } else {
      await supabaseAdmin.from(tabla).update({ drive_error: 'Reintento fallido: Drive sigue sin disponible' }).eq('id', fila.id)
      sigue++
    }
  }
  return { ok, sigue_pendiente: sigue, sin_datos: sinDatos }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const [nominas, seguridadSocial, rnt] = await Promise.all([
    reintentarTabla('nominas'),
    reintentarTabla('seguridad_social_resumen'),
    reintentarTabla('seguridad_social_rnt'),
  ])

  return res.status(200).json({ ok: true, nominas, seguridad_social_resumen: seguridadSocial, seguridad_social_rnt: rnt })
}
