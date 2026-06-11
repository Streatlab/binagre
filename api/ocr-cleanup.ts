// ocr-cleanup.ts — Cron semanal (domingos 03:00): borra archivos huérfanos de storage
// Un huérfano es un archivo en ocr-uploads que no tiene factura activa asociada
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
)

const BUCKET = 'ocr-uploads'
const BATCH = 100

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  // Obtener todos los storage_path activos en facturas
  const { data: facturas, error: e1 } = await supabase
    .from('facturas')
    .select('storage_path')
    .not('storage_path', 'is', null)

  if (e1) return res.status(500).json({ error: e1.message })

  const activos = new Set((facturas ?? []).map(f => f.storage_path as string))

  // Listar archivos en storage (paginado)
  let offset = 0
  let borrados = 0
  let errores = 0

  while (true) {
    const { data: files, error: e2 } = await supabase.storage
      .from(BUCKET)
      .list('', { limit: BATCH, offset })

    if (e2 || !files?.length) break

    const huerfanos = files
      .filter(f => !activos.has(f.name))
      .map(f => f.name)

    if (huerfanos.length > 0) {
      const { error: e3 } = await supabase.storage.from(BUCKET).remove(huerfanos)
      if (e3) errores += huerfanos.length
      else borrados += huerfanos.length
    }

    if (files.length < BATCH) break
    offset += BATCH
  }

  return res.status(200).json({ borrados, errores })
}
