import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'
import { fijosMes, margenPct, type Mix, type Params } from './_calc.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { data: params, error: errP } = await supabaseAdmin
    .from('pe_parametros')
    .select('*')
    .is('marca_id', null)
    .is('periodo_fin', null)
    .order('periodo_inicio', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (errP || !params) return res.status(500).json({ error: errP?.message || 'sin parámetros PE' })

  const p = params as Params & Record<string, any>
  const fijos = fijosMes(p)

  const hoy = new Date()
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10)
  const hoyStr = hoy.toISOString().slice(0, 10)
  const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
  const diaActual = hoy.getDate()

  const { data: ventasMes } = await supabaseAdmin
    .from('facturacion_diario')
    .select('uber_bruto, glovo_bruto, je_bruto, web_bruto, directa_bruto, total_bruto, total_pedidos, fecha')
    .gte('fecha', inicioMes)
    .lte('fecha', hoyStr)

  const mix: Mix = (ventasMes || []).reduce<Mix>((acc, r: any) => ({
    uber: acc.uber + Number(r.uber_bruto || 0),
    glovo: acc.glovo + Number(r.glovo_bruto || 0),
    je: acc.je + Number(r.je_bruto || 0),
    web: acc.web + Number(r.web_bruto || 0),
    directa: acc.directa + Number(r.directa_bruto || 0),
    total: acc.total + Number(r.total_bruto || 0),
    pedidos: acc.pedidos + Number(r.total_pedidos || 0),
  }), { uber: 0, glovo: 0, je: 0, web: 0, directa: 0, total: 0, pedidos: 0 })

  const { varPct, margenPct: margen, comisionPct } = margenPct(mix, p)
  const peMensual = margen > 0 ? fijos / (margen / 100) : null
  const peDiario = peMensual ? peMensual / 30 : 0

  const brutoMes = mix.total
  const proyeccionMes = diaActual > 0 ? brutoMes * diasMes / diaActual : 0
  const brutoDiario = diaActual > 0 ? brutoMes / diaActual : 0
  const diaCubreFijos = brutoDiario > 0 && margen > 0
    ? Math.ceil(fijos / brutoDiario / (margen / 100))
    : null

  const netoTarget = Number(p.objetivo_beneficio_mensual || 3000)
  const brutoParaObjetivo = margen > 0 ? (fijos + netoTarget / 0.75) / (margen / 100) : null

  const fecha90d = new Date(hoy)
  fecha90d.setDate(fecha90d.getDate() - 90)
  const { data: ventasDow } = await supabaseAdmin
    .from('facturacion_diario')
    .select('fecha, total_bruto, total_pedidos')
    .gte('fecha', fecha90d.toISOString().slice(0, 10))
    .lt('fecha', hoyStr)

  const porDow: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] }
  ;(ventasDow || []).forEach((v: any) => {
    const d = new Date(v.fecha + 'T12:00:00')
    const dow = d.getDay() === 0 ? 7 : d.getDay()
    porDow[dow].push(Number(v.total_bruto || 0))
  })

  const nombres = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
  const porDiaSemana = [1, 2, 3, 4, 5, 6, 7].map(k => {
    const arr = porDow[k]
    const media = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
    const estado: 'cubre' | 'ajustado' | 'pierde' =
      media >= peDiario ? 'cubre' : media >= peDiario * 0.85 ? 'ajustado' : 'pierde'
    return {
      dow: k,
      dia: nombres[k],
      bruto_medio: Math.round(media),
      estado,
      delta: Math.round(media - peDiario),
      n_dias: arr.length,
    }
  })

  // Semana actual (lunes → hoy)
  const inicioSemana = new Date(hoy)
  const dow0 = hoy.getDay() === 0 ? 7 : hoy.getDay()
  inicioSemana.setDate(hoy.getDate() - (dow0 - 1))
  const inicioSemanaStr = inicioSemana.toISOString().slice(0, 10)

  const { data: gastosSemana } = await supabaseAdmin
    .from('conciliacion')
    .select('importe, categoria')
    .lt('importe', 0)
    .gte('fecha', inicioSemanaStr)
    .lte('fecha', hoyStr)

  const gastosPorCat = (gastosSemana || []).reduce<Record<string, number>>((acc, g: any) => {
    const cat = g.categoria || 'OTROS'
    acc[cat] = (acc[cat] || 0) + Math.abs(Number(g.importe || 0))
    return acc
  }, {})

  const brutoSemana = brutoDiario * 7
  const presupuestos = {
    comida: {
      target_semana: Math.round(brutoSemana * Number(p.food_cost_pct || 0) / 100),
      gastado: Math.round(gastosPorCat['PRD-ALI'] || 0),
    },
    packaging: {
      target_semana: Math.round(brutoSemana * Number(p.packaging_pct || 0) / 100),
      gastado: Math.round(gastosPorCat['PRD-PKG'] || 0),
    },
  }

  return res.status(200).json({
    fecha: hoyStr,
    dia_actual: diaActual,
    dias_mes: diasMes,
    parametros: params,
    fijos_mes: Math.round(fijos),
    comision_pct: Math.round(comisionPct * 10) / 10,
    variable_pct: Math.round(varPct * 10) / 10,
    margen_pct: Math.round(margen * 10) / 10,
    pe_mensual: peMensual ? Math.round(peMensual) : null,
    pe_diario: peDiario ? Math.round(peDiario) : null,
    pe_semanal: peDiario ? Math.round(peDiario * 7) : null,
    fijo_diario: Math.round(fijos / 30),
    bruto_mes: Math.round(brutoMes),
    pedidos_mes: mix.pedidos,
    bruto_diario_real: Math.round(brutoDiario),
    proyeccion_mes: Math.round(proyeccionMes),
    dia_cubre_fijos: diaCubreFijos,
    bruto_para_objetivo: brutoParaObjetivo ? Math.round(brutoParaObjetivo) : null,
    objetivo_neto: netoTarget,
    por_dia_semana: porDiaSemana,
    mix,
    presupuestos,
  })
}
