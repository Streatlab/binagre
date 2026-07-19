// PUERTA 2/4 — /api/informes/*  (informes WhatsApp: cron, envío manual, estado del canal)
// Única Serverless Function para Informes. Los handlers reales viven en
// api/_puertas/*. La puerta vive en la misma carpeta que las URLs antiguas
// (/api/informes/cron, /api/informes/enviar, /api/informes/whatsapp-status), así que
// no hace falta rewrite.
// REGLA PERMANENTE: ninguna función API nueva como archivo suelto — siempre un
// handler en _puertas + una rama aquí.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import informesCron from '../_puertas/informes-cron.js'
import informesEnviar from '../_puertas/informes-enviar.js'
import informesWhatsappStatus from '../_puertas/informes-whatsapp-status.js'

export const config = { maxDuration: 60 }

function segmentos(req: VercelRequest): string[] {
  const pathname = (req.url || '').split('?')[0]
  return pathname.replace(/^\/api\/informes\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const [a] = segmentos(req)

  if (a === 'cron') return informesCron(req, res)
  if (a === 'enviar') return informesEnviar(req, res)
  if (a === 'whatsapp-status') return informesWhatsappStatus(req, res)

  return res.status(404).json({ error: `Ruta no encontrada en puerta informes: ${a || '(vacía)'}` })
}
