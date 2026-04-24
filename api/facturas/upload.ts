import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'
import { procesarArchivo } from '../_lib/procesarArchivo.js'

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
  maxDuration: 60,
}

type UploadBody = {
  nombre: string
  base64: string
  mimeType?: string | null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = req.body as UploadBody
    if (!body?.base64 || !body?.nombre) {
      return res.status(400).json({ error: 'Falta base64 o nombre' })
    }

    const buffer = Buffer.from(body.base64, 'base64')

    const resultados = await procesarArchivo(supabaseAdmin, {
      nombre: body.nombre,
      buffer,
      mimeType: body.mimeType || null,
    })

    // Compat: si solo 1 resultado (caso normal sin adjuntos), devolver plano
    if (resultados.length === 1) {
      return res.status(200).json(resultados[0])
    }
    return res.status(200).json({ estado: 'multi', resultados })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return res.status(500).json({ error: msg })
  }
}
