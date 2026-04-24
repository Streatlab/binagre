import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = String(req.query.id || '')
  if (!id) return res.status(400).json({ error: 'Falta id' })

  if (req.method === 'PUT') {
    const body = (req.body || {}) as Record<string, unknown>
    const update: Record<string, unknown> = {}
    const camposPermitidos = [
      'proveedor_nombre',
      'numero_factura',
      'fecha_factura',
      'total_base',
      'total_iva',
      'total',
      'es_recapitulativa',
      'periodo_inicio',
      'periodo_fin',
      'tipo',
      'plataforma',
      'estado',
      'mensaje_matching',
    ]
    for (const k of camposPermitidos) {
      if (k in body) update[k] = body[k]
    }
    const { error } = await supabaseAdmin.from('facturas').update(update).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  if (req.method === 'DELETE') {
    await supabaseAdmin.from('facturas_gastos').delete().eq('factura_id', id)
    const { error } = await supabaseAdmin.from('facturas').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
