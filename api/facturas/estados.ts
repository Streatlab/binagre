import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'

// Endpoint: GET /api/facturas/estados?id=xxx&id=yyy&id=zzz
// Devuelve estados de un lote de facturas para alimentar toasts persistentes.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const ids = req.query.id
  let lista: string[] = []
  if (Array.isArray(ids)) lista = ids.filter(Boolean) as string[]
  else if (typeof ids === 'string' && ids.length > 0) lista = ids.split(',').filter(Boolean)

  if (lista.length === 0) return res.status(200).json({ facturas: [] })

  const { data, error } = await supabaseAdmin
    .from('facturas')
    .select('id, estado')
    .in('id', lista)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ facturas: data || [] })
}
