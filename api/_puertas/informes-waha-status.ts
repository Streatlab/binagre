/**
 * GET /api/informes/waha-status
 *
 * Devuelve si el servidor WAHA está conectado y la sesión activa.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { comprobarWAHA } from '../_lib/informes-envio.js'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const r = await comprobarWAHA()
  return res.status(200).json(r)
}
