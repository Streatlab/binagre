import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { id } = req.body as { id: string }
  if (!id) return res.status(400).json({ error: 'Falta id' })

  await supabaseAdmin
    .from('facturas')
    .update({ estado: 'procesando', error_mensaje: null })
    .eq('id', id)

  return res.status(200).json({ ok: true })
}
