import type { VercelRequest, VercelResponse } from '@vercel/node'
import { dashboardHandler, simularHandler, puedoGastarHandler } from './_handlers.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action || '')
  switch (action) {
    case 'dashboard':     return dashboardHandler(req, res)
    case 'simular':       return simularHandler(req, res)
    case 'puedo-gastar':  return puedoGastarHandler(req, res)
    default:              return res.status(404).json({ error: `unknown action: ${action}` })
  }
}
