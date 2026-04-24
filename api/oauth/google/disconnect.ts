import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../../_lib/supabase-admin.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const body = (req.body || {}) as { titular_id?: string | null }
  const titularId = body.titular_id || null

  let q = supabaseAdmin.from('google_oauth_tokens').delete()
  q = titularId ? q.eq('titular_id', titularId) : q.is('titular_id', null)
  const { error } = await q
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true })
}
