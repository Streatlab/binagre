import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { importe, categoria } = (req.body || {}) as { importe?: number; categoria?: string }
  const imp = Number(importe || 0)
  const cat = String(categoria || 'OTROS')

  // Saldo aproximado = suma acumulada de movimientos (conciliacion no tiene saldo)
  const { data: movs, error: errMov } = await supabaseAdmin
    .from('conciliacion')
    .select('importe')
  if (errMov) return res.status(500).json({ error: errMov.message })
  const cajaActual = (movs || []).reduce((a, m: any) => a + Number(m.importe || 0), 0)

  // Gastado mes en categoría
  const hoy = new Date()
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10)
  const { data: gastosCat } = await supabaseAdmin
    .from('conciliacion')
    .select('importe')
    .eq('categoria', cat)
    .lt('importe', 0)
    .gte('fecha', inicioMes)
  const gastadoCategoria = (gastosCat || []).reduce((a, g: any) => a + Math.abs(Number(g.importe || 0)), 0)

  const cajaDespues = cajaActual - imp
  const verde = cajaDespues > 3000
  const ambar = !verde && cajaDespues > 500
  const estado = verde ? 'verde' : ambar ? 'ambar' : 'rojo'

  const recomendacion = verde
    ? 'Puedes gastarlo sin problema.'
    : ambar
    ? 'Cuidado: tras esta compra quedarás justo de liquidez. Espera unos días si puedes.'
    : 'NO recomendado. Sin liquidez suficiente para esta compra.'

  return res.status(200).json({
    puedes_gastar: verde || ambar,
    estado,
    caja_actual: Math.round(cajaActual),
    caja_despues: Math.round(cajaDespues),
    gastado_categoria_mes: Math.round(gastadoCategoria),
    gastado_con_esto: Math.round(gastadoCategoria + imp),
    recomendacion,
  })
}
