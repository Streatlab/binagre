// ocr-queue.ts — Cron horario: reencola facturas con total=0 para re-procesar
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
)

export default async function handler(_req: VercelRequest, res: VercelResponse) {
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
