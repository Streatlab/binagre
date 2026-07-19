/**
 * GET /api/informes/whatsapp-status
 *
 * Devuelve si el canal de WhatsApp (Green API) está conectado y autorizado.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { comprobarWhatsApp } from '../_lib/informes-envio.js'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const r = await comprobarWhatsApp()
  return res.status(200).json(r)
}
