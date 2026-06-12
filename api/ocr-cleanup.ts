// ocr-cleanup.ts — Mantenimiento OCR (1 sola función Vercel, límite Hobby 12 fns)
// ?fn=cleanup (default) → borra archivos huérfanos de storage (cron semanal)
// ?fn=queue             → reencola facturas con total=0 para re-procesar (antes api/ocr-queue.ts)
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
)

const BUCKET = 'ocr-uploads'
const BATCH = 100

async function queue(res: VercelResponse) {
  const { data: pendientes, error } = await supabase
    .from('facturas')
    .select('id, storage_path')
    .eq('total', 0)
    .neq('doc_estado', 'DUPLICADA')
    .neq('doc_estado', 'DESCARTADA')
    .not('storage_path', 'is', null)
    .limit(50)

  if (error) return res.status(500).json({ error: error.message })
  if (!pendientes?.length) return res.status(200).json({ reencoladas: 0 })

  const rows = pendientes.map(f => ({
    factura_id: f.id,
    storage_path: f.storage_path,
    estado: 'pendiente',
    intentos: 0,
  }))

  const { error: e2 } = await supabase
    .from('ocr_cola')
    .upsert(rows, { onConflict: 'factura_id', ignoreDuplicates: true })

  if (e2) return res.status(500).json({ error: e2.message })
  return res.status(200).json({ reencoladas: rows.length })
}

async function cleanup(res: VercelResponse) {
  const { data: facturas, error: e1 } = await supabase
    .from('facturas')
    .select('storage_path')
    .not('storage_path', 'is', null)

  if (e1) return res.status(500).json({ error: e1.message })

  const activos = new Set((facturas ?? []).map(f => f.storage_path as string))

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const fn = String(req.query.fn ?? 'cleanup')
  if (fn === 'queue') return queue(res)
  return cleanup(res)
}
