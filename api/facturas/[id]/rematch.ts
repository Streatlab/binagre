import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../../_lib/supabase-admin.js'
import { aplicarMatching, matchFactura } from '../../_lib/matching.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const id = String(req.query.id || '')
  if (!id) return res.status(400).json({ error: 'Falta id' })

  const { data: factura, error } = await supabaseAdmin
    .from('facturas')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !factura) return res.status(404).json({ error: 'Factura no encontrada' })

  const resultado = await matchFactura(supabaseAdmin, {
    ...factura,
    total: Number(factura.total),
  })
  await aplicarMatching(supabaseAdmin, id, resultado)
  return res.status(200).json({ ok: true, estado: resultado.estado, mensaje: resultado.mensaje })
}
