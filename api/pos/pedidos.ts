import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'

/**
 * API pública del POS Binagre.
 *
 * POST /api/pos/pedidos  → recibe un pedido de un integrador (Rushour, Sinqro,
 *                          tienda online...). Auth por cabecera x-api-key
 *                          contra pos_api_keys.
 * GET  /api/pos/pedidos  → lista pedidos (query: estado, desde). Misma auth.
 *
 * Formato de pedido esperado (normalizado):
 * {
 *   "pedido_ref": "UE-12345",          // ref externa (obligatoria para dedupe)
 *   "canal": "uber|glovo|je|web|dir",
 *   "marca": "Binagre",
 *   "cliente_nombre": "...",
 *   "items": [{ "nombre": "...", "cantidad": 2, "precio": 12.5, "notas": "" }],
 *   "total": 25.0,
 *   "metodo_pago": "plataforma|efectivo|tarjeta|bizum",
 *   "notas": ""
 * }
 */

const CANALES = ['uber', 'glovo', 'je', 'web', 'dir']

async function validarApiKey(req: VercelRequest): Promise<string | null> {
  const key = (req.headers['x-api-key'] || '') as string
  if (!key) return null
  const { data } = await supabaseAdmin
    .from('pos_api_keys')
    .select('nombre, activo')
    .eq('api_key', key)
    .eq('activo', true)
    .maybeSingle()
  return data ? (data.nombre as string) : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origen = await validarApiKey(req)
  if (!origen) return res.status(401).json({ error: 'API key inválida o ausente (cabecera x-api-key)' })

  if (req.method === 'POST') {
    const b = (req.body || {}) as Record<string, unknown>
    const pedido_ref = typeof b.pedido_ref === 'string' ? b.pedido_ref.trim() : ''
    if (!pedido_ref) return res.status(400).json({ error: 'Falta pedido_ref' })

    const canal = CANALES.includes(b.canal as string) ? (b.canal as string) : null
    const items = Array.isArray(b.items) ? b.items : []
    const total = typeof b.total === 'number' ? b.total : Number(b.total) || 0

    const { data, error } = await supabaseAdmin
      .from('pos_pedidos')
      .upsert(
        {
          origen,
          pedido_ref,
          canal,
          marca: typeof b.marca === 'string' ? b.marca : null,
          cliente_nombre: typeof b.cliente_nombre === 'string' ? b.cliente_nombre : null,
          items,
          total,
          metodo_pago: typeof b.metodo_pago === 'string' ? b.metodo_pago : 'plataforma',
          notas: typeof b.notas === 'string' ? b.notas : null,
          estado: 'nuevo',
        },
        { onConflict: 'origen,pedido_ref', ignoreDuplicates: true }
      )
      .select()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ ok: true, pedido: data?.[0] ?? null, duplicado: !data?.length })
  }

  if (req.method === 'GET') {
    const estado = typeof req.query.estado === 'string' ? req.query.estado : null
    const desde = typeof req.query.desde === 'string' ? req.query.desde : null
    let q = supabaseAdmin.from('pos_pedidos').select('*').order('created_at', { ascending: false }).limit(200)
    if (estado) q = q.eq('estado', estado)
    if (desde) q = q.gte('created_at', desde)
    const { data, error } = await q
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ data: data || [] })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
