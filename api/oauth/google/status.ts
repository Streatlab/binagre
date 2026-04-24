import type { VercelRequest, VercelResponse } from '@vercel/node'
import { tieneDriveConectado } from '../../_lib/google-oauth.js'
import { supabaseAdmin } from '../../_lib/supabase-admin.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  // Si se pasa titular_id específico → status de ese
  const titularQ = req.query.titular_id
  if (typeof titularQ === 'string' && titularQ) {
    const s = await tieneDriveConectado(titularQ)
    return res.status(200).json(s)
  }

  // Sin parámetro → devuelve status por cada titular + unificado
  const { data: titulares } = await supabaseAdmin
    .from('titulares')
    .select('id, nombre, color')
    .order('nombre')

  const { data: tokens } = await supabaseAdmin
    .from('google_oauth_tokens')
    .select('titular_id, email')

  const mapa = new Map<string, string>()
  let unifiedEmail: string | null = null
  for (const t of (tokens || []) as Array<{ titular_id: string | null; email: string | null }>) {
    if (t.titular_id) mapa.set(t.titular_id, t.email || '')
    else unifiedEmail = t.email
  }

  return res.status(200).json({
    unified: { conectado: unifiedEmail !== null, email: unifiedEmail },
    titulares: (titulares || []).map((t: any) => ({
      id: t.id,
      nombre: t.nombre,
      color: t.color,
      conectado: mapa.has(t.id),
      email: mapa.get(t.id) || null,
    })),
  })
}
