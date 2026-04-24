import type { VercelRequest, VercelResponse } from '@vercel/node'
import { tieneDriveConectado } from '../../_lib/google-oauth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const status = await tieneDriveConectado()
  return res.status(200).json(status)
}
