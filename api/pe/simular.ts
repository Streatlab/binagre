import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'
import { fijosMes, margenPct, type Mix, type Params } from './_calc.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const p = (req.body || {}) as Params

  const hoy = new Date()
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10)
  const hoyStr = hoy.toISOString().slice(0, 10)

  const { data: ventasMes } = await supabaseAdmin
    .from('facturacion_diario')
    .select('uber_bruto, glovo_bruto, je_bruto, web_bruto, directa_bruto, total_bruto')
    .gte('fecha', inicioMes)
    .lte('fecha', hoyStr)

  const mix: Mix = (ventasMes || []).reduce<Mix>((acc, r: any) => ({
    uber: acc.uber + Number(r.uber_bruto || 0),
    glovo: acc.glovo + Number(r.glovo_bruto || 0),
    je: acc.je + Number(r.je_bruto || 0),
    web: acc.web + Number(r.web_bruto || 0),
    directa: acc.directa + Number(r.directa_bruto || 0),
    total: acc.total + Number(r.total_bruto || 0),
    pedidos: 0,
  }), { uber: 0, glovo: 0, je: 0, web: 0, directa: 0, total: 0, pedidos: 0 })

  const fijos = fijosMes(p)
  const { varPct, margenPct: margen } = margenPct(mix, p)
  const peMensual = margen > 0 ? fijos / (margen / 100) : 0
  const netoTarget = Number(p.objetivo_beneficio_mensual || 3000)
  const brutoParaObjetivo = margen > 0 ? (fijos + netoTarget / 0.75) / (margen / 100) : 0

  return res.status(200).json({
    fijos_mes: Math.round(fijos),
    variable_pct: Math.round(varPct * 10) / 10,
    margen_pct: Math.round(margen * 10) / 10,
    pe_mensual: Math.round(peMensual),
    pe_diario: Math.round(peMensual / 30),
    pe_semanal: Math.round(peMensual / 30 * 7),
    bruto_para_objetivo: Math.round(brutoParaObjetivo),
    objetivo_neto: netoTarget,
  })
}
