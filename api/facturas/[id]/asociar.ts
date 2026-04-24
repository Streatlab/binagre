import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../../_lib/supabase-admin.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const id = String(req.query.id || '')
  if (!id) return res.status(400).json({ error: 'Falta id' })

  const body = (req.body || {}) as { conciliacion_ids?: string[] }
  const ids = Array.isArray(body.conciliacion_ids) ? body.conciliacion_ids : []
  if (ids.length === 0) return res.status(400).json({ error: 'conciliacion_ids vacío' })

  const { data: movs } = await supabaseAdmin
    .from('conciliacion')
    .select('id, importe')
    .in('id', ids)

  if (!movs || movs.length === 0) return res.status(400).json({ error: 'Sin movimientos válidos' })

  const filas = movs.map((m) => ({
    factura_id: id,
    conciliacion_id: m.id as string,
    importe_asociado: Math.abs(Number(m.importe)),
    confirmado: true,
    confianza_match: 100,
  }))
  await supabaseAdmin.from('facturas_gastos').upsert(filas, { onConflict: 'factura_id,conciliacion_id' })
  await supabaseAdmin
    .from('facturas')
    .update({ estado: 'asociada', mensaje_matching: 'Asociada manualmente' })
    .eq('id', id)

  return res.status(200).json({ ok: true })
}
