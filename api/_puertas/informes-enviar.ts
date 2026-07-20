/**
 * POST /api/informes/enviar
 *
 * Body: { tipo: 'cierre_diario' | 'cierre_semanal' | 'resumen_manana' | 'pulso' | 'cobros_lunes' | 'cierre_mensual' }
 *
 * Desde 20-jul-2026 los informes viven en Edge Functions de Supabase (fuente
 * única fn_informe_cierre = mismos números que Pulso en Vivo y Facturación,
 * envío por Green API). Este endpoint queda como PROXY para el botón "forzar"
 * del módulo Informes:
 *   - cierre_diario / cierre_semanal → whatsapp-vivo-2329 (con fecha de hoy)
 *   - pulso                          → whatsapp-pulso-1630 ({forzar:true})
 *   - resumen_manana                 → resumen-facturacion-diario (fecha = ayer)
 *   - cobros_lunes / cierre_mensual  → van incluidos en resumen_manana (lunes / día 1)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

const SB_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://eryauogxcpbgdryeimdq.supabase.co'
const SB_ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

const TIPOS_VALIDOS = ['cierre_diario', 'cierre_semanal', 'resumen_manana', 'pulso', 'cobros_lunes', 'cierre_mensual']

function fechaMadrid(diasAtras = 0): string {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
  d.setDate(d.getDate() - diasAtras)
  return d.toISOString().slice(0, 10)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const tipo = String((req.body || {}).tipo || '')
  if (!TIPOS_VALIDOS.includes(tipo)) {
    return res.status(400).json({ error: 'Tipo de informe inválido', validos: TIPOS_VALIDOS })
  }

  let slug = ''
  let body: Record<string, unknown> = {}
  if (tipo === 'cierre_diario' || tipo === 'cierre_semanal') {
    slug = 'whatsapp-vivo-2329'
    body = { fecha: fechaMadrid(0) }
  } else if (tipo === 'pulso') {
    slug = 'whatsapp-pulso-1630'
    body = { forzar: true }
  } else {
    // resumen_manana (y sus variantes cobros_lunes / cierre_mensual, que ya van dentro)
    slug = 'resumen-facturacion-diario'
    body = { fecha: fechaMadrid(1) }
  }

  try {
    const r = await fetch(`${SB_URL}/functions/v1/${slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SB_ANON}` },
      body: JSON.stringify(body),
    })
    const detalle = await r.json().catch(() => ({}))
    return res.status(r.ok ? 200 : 500).json({ tipo, via: slug, ok: r.ok, detalle })
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message })
  }
}
