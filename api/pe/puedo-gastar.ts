import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'
import { toNum } from './_calc.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { importe, categoria } = (req.body || {}) as { importe?: number; categoria?: string }
  const imp = Number(importe || 0)
  const cat = String(categoria || 'OTROS')

  const { data: params } = await supabaseAdmin
    .from('pe_parametros')
    .select('caja_minima_verde, caja_minima_ambar')
    .is('marca_id', null)
    .is('periodo_fin', null)
    .order('periodo_inicio', { ascending: false })
    .limit(1)
    .maybeSingle()

  const umbralVerde = toNum((params as any)?.caja_minima_verde)
  const umbralAmbar = toNum((params as any)?.caja_minima_ambar)

  // Caja real = suma de saldos iniciales de cuentas activas + todos los movimientos conciliacion
  const [cuentasRes, movsRes] = await Promise.all([
    supabaseAdmin.from('cuentas_bancarias').select('saldo_actual, activa').eq('activa', true),
    supabaseAdmin.from('conciliacion').select('importe'),
  ])
  if (movsRes.error) return res.status(500).json({ error: movsRes.error.message })

  const saldoInicial = (cuentasRes.data || []).reduce((a: number, c: any) => a + Number(c.saldo_actual || 0), 0)
  const movimientosAcum = (movsRes.data || []).reduce((a: number, m: any) => a + Number(m.importe || 0), 0)
  const cajaActual = saldoInicial + movimientosAcum

  const hoy = new Date()
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10)
  const { data: gastosCat } = await supabaseAdmin
    .from('conciliacion')
    .select('importe')
    .eq('categoria', cat)
    .lt('importe', 0)
    .gte('fecha', inicioMes)
  const gastadoCategoria = (gastosCat || []).reduce((a: number, g: any) => a + Math.abs(Number(g.importe || 0)), 0)

  const cajaDespues = cajaActual - imp
  const verde = cajaDespues > umbralVerde
  const ambar = !verde && cajaDespues > umbralAmbar
  const estado = verde ? 'verde' : ambar ? 'ambar' : 'rojo'

  const recomendacion = verde
    ? 'Puedes gastarlo sin problema.'
    : ambar
    ? `Cuidado: tras esta compra quedarás por debajo del umbral verde (${umbralVerde.toFixed(0)}€).`
    : `NO recomendado. Te quedarías por debajo del umbral ámbar (${umbralAmbar.toFixed(0)}€).`

  return res.status(200).json({
    puedes_gastar: verde || ambar,
    estado,
    caja_actual: Math.round(cajaActual),
    caja_despues: Math.round(cajaDespues),
    gastado_categoria_mes: Math.round(gastadoCategoria),
    gastado_con_esto: Math.round(gastadoCategoria + imp),
    umbral_verde: Math.round(umbralVerde),
    umbral_ambar: Math.round(umbralAmbar),
    recomendacion,
  })
}
