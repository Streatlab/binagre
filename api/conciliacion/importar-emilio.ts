import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'
import { parsearBBVA } from '../_lib/parserBBVA.js'

export const config = {
  api: { bodyParser: { sizeLimit: '15mb' } },
  maxDuration: 60,
}

interface ReqBody {
  base64: string
  nombre?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = (req.body || {}) as ReqBody
  if (!body.base64) return res.status(400).json({ error: 'Falta base64' })

  let movs
  try {
    const buffer = Buffer.from(body.base64, 'base64')
    movs = parsearBBVA(buffer)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error parseando'
    return res.status(400).json({ error: msg })
  }

  const { data: titular } = await supabaseAdmin
    .from('titulares')
    .select('id')
    .eq('carpeta_drive', 'EMILIO')
    .maybeSingle()
  if (!titular?.id) return res.status(500).json({ error: 'Titular Emilio no existe' })

  let insertados = 0
  for (const m of movs) {
    const dedupKey = `emilio_${m.fecha}_${m.importe}_${m.concepto.substring(0, 30)}`
      .toLowerCase()
      .replace(/\s+/g, '_')
    const { error } = await supabaseAdmin.from('conciliacion').upsert(
      {
        titular_id: titular.id,
        fecha: m.fecha,
        concepto: m.concepto,
        importe: m.importe,
        tipo: m.importe > 0 ? 'ingreso' : 'gasto',
        dedup_key: dedupKey,
        notas: m.observaciones,
      },
      { onConflict: 'dedup_key', ignoreDuplicates: true },
    )
    if (!error) insertados++
  }

  // Aplicar reglas de conciliación existentes sobre movimientos sin categoría
  const { data: reglas } = await supabaseAdmin
    .from('reglas_conciliacion')
    .select('*')
    .eq('activa', true)
    .order('prioridad', { ascending: false })

  const { data: nuevos } = await supabaseAdmin
    .from('conciliacion')
    .select('id, concepto')
    .eq('titular_id', titular.id)
    .is('categoria', null)

  for (const mov of nuevos || []) {
    const concepto = (mov.concepto as string | null) || ''
    for (const regla of reglas || []) {
      const patron = (regla.patron as string | null) || ''
      if (!patron) continue
      if (concepto.toLowerCase().includes(patron.toLowerCase())) {
        await supabaseAdmin
          .from('conciliacion')
          .update({ categoria: regla.categoria_codigo, iva_pct: 10 })
          .eq('id', mov.id)
        break
      }
    }
  }

  return res.status(200).json({ total: movs.length, insertados })
}
