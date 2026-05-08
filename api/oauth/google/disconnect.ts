import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../../_lib/supabase-admin.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { error } = await supabaseAdmin
    .from('google_oauth_tokens')
    .delete()
    .is('titular_id', null)
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true })
}
