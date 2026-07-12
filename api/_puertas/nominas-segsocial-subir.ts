// _puertas/nominas-segsocial-subir.ts — sube el PDF del resumen mensual de Seguridad
// Social de la empresa (RLC). Delega el núcleo (extracción, Drive, upsert en
// `seguridad_social_resumen`) a api/_lib/subidaDocEquipo.ts, compartido con el
// buzón único EQUIPO de Papeleo — misma lógica, sin duplicar.
// (vive en _puertas: se sirve a través de la puerta /api/operaciones)
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { procesarSegSocialResumen, enteroValido } from '../_lib/subidaDocEquipo.js'

interface BodySubirSegSocial {
  base64?: string
  nombre_archivo?: string
  mes?: number
  anio?: number
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = (req.body || {}) as BodySubirSegSocial
  if (!body.base64) return res.status(400).json({ error: 'Falta base64' })

  const buffer = Buffer.from(body.base64, 'base64')
  const mesBody = enteroValido(body.mes, 1, 12)
  const anioBody = enteroValido(body.anio, 2000, 2100)

  const { status, body: out } = await procesarSegSocialResumen(
    buffer, body.nombre_archivo || 'segsocial.pdf', mesBody, anioBody,
  )
  return res.status(status).json(out)
}
