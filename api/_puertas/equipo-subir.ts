// _puertas/equipo-subir.ts — buzón único EQUIPO de Papeleo: recibe un documento
// suelto (nómina, resumen de nóminas, RLC/RNT de Seguridad Social, o cualquier
// otra cosa) y lo delega íntegro a procesarDocEquipo.ts — el mismo motor que usa
// el cartero de correo (facturas-index.ts), para que un documento se procese
// exactamente igual sin importar por dónde entró.
// (vive en _puertas: se sirve a través de la puerta /api/operaciones)
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { procesarDocumentoEquipo } from '../_lib/procesarDocEquipo.js'

interface BodySubirEquipo {
  base64?: string
  nombre_archivo?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = (req.body || {}) as BodySubirEquipo
  if (!body.base64) return res.status(400).json({ error: 'Falta base64' })

  const buffer = Buffer.from(body.base64, 'base64')
  const nombreOriginal = body.nombre_archivo || 'documento.pdf'

  const { status, body: out } = await procesarDocumentoEquipo(buffer, nombreOriginal)
  return res.status(status).json(out)
}
