import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from './_lib/supabase-admin.js'

const CAMPOS_EDITABLES = [
  'nombre',
  'nif',
  'color',
  'carpeta_drive',
  'cuenta_iban',
  'cuenta_banco_nombre',
  'activo',
  'orden',
]

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('titulares')
      .select('*')
      .eq('activo', true)
      .order('orden')
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ data: data || [] })
  }

  if (req.method === 'PUT') {
    const body = (req.body || {}) as Record<string, unknown>
    const id = body.id as string | undefined
    if (!id) return res.status(400).json({ error: 'Falta id' })
    const update: Record<string, unknown> = {}
    for (const k of CAMPOS_EDITABLES) {
      if (k in body) update[k] = body[k]
    }
    const { data, error } = await supabaseAdmin
      .from('titulares')
      .update(update)
      .eq('id', id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
