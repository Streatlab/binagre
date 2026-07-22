// _puertas/equipo-pdf-firmado.ts — signed URL de un documento de EQUIPO en el
// bucket propio 'facturas' (Storage), a partir de su pdf_storage_path. Así el
// visor sirve el PDF SIN depender de permisos de Google Drive (nunca un iframe
// de Drive: eso pedía "necesitas acceso" aunque el documento fuera público en
// nuestro Storage). Vive en _puertas: se sirve por la puerta /api/operaciones.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'

const BUCKET = 'facturas'
const EXPIRA_SEGUNDOS = 300 // 5 minutos: de sobra para ver/embeber el PDF, sin dejar el link vivo mucho rato

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const path = String(req.query.path || '')
  if (!path) return res.status(400).json({ error: 'Falta path' })

  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, EXPIRA_SEGUNDOS)
  if (error || !data?.signedUrl) return res.status(404).json({ error: error?.message || 'No se pudo generar el enlace del PDF' })

  return res.status(200).json({ ok: true, url: data.signedUrl })
}
