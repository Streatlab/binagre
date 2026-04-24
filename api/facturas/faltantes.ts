import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { data, error } = await supabaseAdmin
    .from('facturas_faltantes')
    .select('*')
    .order('periodo_ref', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })

  const faltan = data?.filter((r) => r.estado === 'falta').length ?? 0
  return res.status(200).json({ faltantes: data ?? [], count_falta: faltan })
}
