import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'
import { fijosMes, margenPct, netearIVA, toNum, type Mix, type Params } from './_calc.js'

export async function dashboardHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const modoIVA = (req.query.iva as string) === 'con' ? 'con' : 'sin'

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
  const ivaPct = toNum(p.iva_pct)
  const tasaFiscalPct = toNum(p.tasa_fiscal_pct)
  const factorFiscal = 1 - tasaFiscalPct / 100

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

  const neto = (n: number) => (modoIVA === 'sin' ? netearIVA(n, ivaPct) : n)

  const mix: Mix = (ventasMes || []).reduce<Mix>((acc, r: any) => ({
    uber:    acc.uber    + neto(Number(r.uber_bruto || 0)),
    glovo:   acc.glovo   + neto(Number(r.glovo_bruto || 0)),
    je:      acc.je      + neto(Number(r.je_bruto || 0)),
    web:     acc.web     + neto(Number(r.web_bruto || 0)),
    directa: acc.directa + neto(Number(r.directa_bruto || 0)),
    total:   acc.total   + neto(Number(r.total_bruto || 0)),
    pedidos: acc.pedidos + Number(r.total_pedidos || 0),
  }), { uber: 0, glovo: 0, je: 0, web: 0, directa: 0, total: 0, pedidos: 0 })

  const { varPct, margenPct: margen, comisionPct } = margenPct(mix, p)
  const peMensual = margen > 0 ? fijos / (margen / 100) : null
  const peDiario = peMensual ? peMensual / diasMes : 0
  const peSemanal = peDiario * 7

  const brutoMes = mix.total
  const brutoDiario = diaActual > 0 ? brutoMes / diaActual : 0

  const netoTarget = toNum(p.objetivo_beneficio_mensual)
  const brutoParaObjetivo = margen > 0 && factorFiscal > 0
    ? (fijos + netoTarget / factorFiscal) / (margen / 100)
    : null

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
    porDow[dow].push(neto(Number(v.total_bruto || 0)))
  })

  const nombres = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
  const mediaPorDow: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 }
  const porDiaSemana = [1, 2, 3, 4, 5, 6, 7].map(k => {
    const arr = porDow[k]
    const media = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
    mediaPorDow[k] = media
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

  let proyeccionRestante = 0
  for (let d = diaActual + 1; d <= diasMes; d++) {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth(), d)
    const dow = fecha.getDay() === 0 ? 7 : fecha.getDay()
    proyeccionRestante += mediaPorDow[dow] || brutoDiario
  }
  const proyeccionMes = brutoMes + proyeccionRestante

  const diaCubreFijos = brutoDiario > 0 && margen > 0
    ? Math.ceil(fijos / brutoDiario / (margen / 100))
    : null

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
      target_semana: Math.round(brutoSemana * toNum(p.food_cost_pct) / 100),
      gastado: Math.round(gastosPorCat['PRD-ALI'] || 0),
    },
    packaging: {
      target_semana: Math.round(brutoSemana * toNum(p.packaging_pct) / 100),
      gastado: Math.round(gastosPorCat['PRD-PKG'] || 0),
    },
  }

  const ventasOrdenadas = [...(ventasMes || [])].sort((a: any, b: any) => a.fecha.localeCompare(b.fecha))
  let acumulado = 0
  const acumuladoPorDia = ventasOrdenadas.map((r: any) => {
    acumulado += neto(Number(r.total_bruto || 0))
    const d = new Date(r.fecha + 'T12:00:00')
    return {
      fecha: r.fecha,
      dia: d.getDate(),
      acumulado: Math.round(acumulado),
    }
  })

  return res.status(200).json({
    fecha: hoyStr,
    dia_actual: diaActual,
    dias_mes: diasMes,
    modo_iva: modoIVA,
    iva_pct: ivaPct,
    tasa_fiscal_pct: tasaFiscalPct,
    parametros: params,
    fijos_mes: Math.round(fijos),
    comision_pct: Math.round(comisionPct * 10) / 10,
    variable_pct: Math.round(varPct * 10) / 10,
    margen_pct: Math.round(margen * 10) / 10,
    pe_mensual: peMensual ? Math.round(peMensual) : null,
    pe_diario: peDiario ? Math.round(peDiario) : null,
    pe_semanal: peDiario ? Math.round(peSemanal) : null,
    fijo_diario: Math.round(fijos / diasMes),
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
    acumulado_vs_pe: acumuladoPorDia,
  })
}

export async function simularHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = (req.body || {}) as Params & { modo_iva?: 'con' | 'sin' }
  const p = body
  const modoIVA = body.modo_iva === 'con' ? 'con' : 'sin'
  const ivaPct = toNum(p.iva_pct)
  const tasaFiscalPct = toNum(p.tasa_fiscal_pct)
  const factorFiscal = 1 - tasaFiscalPct / 100

  const hoy = new Date()
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10)
  const hoyStr = hoy.toISOString().slice(0, 10)
  const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()

  const { data: ventasMes } = await supabaseAdmin
    .from('facturacion_diario')
    .select('uber_bruto, glovo_bruto, je_bruto, web_bruto, directa_bruto, total_bruto')
    .gte('fecha', inicioMes)
    .lte('fecha', hoyStr)

  const neto = (n: number) => (modoIVA === 'sin' ? netearIVA(n, ivaPct) : n)

  const mix: Mix = (ventasMes || []).reduce<Mix>((acc, r: any) => ({
    uber:    acc.uber    + neto(Number(r.uber_bruto || 0)),
    glovo:   acc.glovo   + neto(Number(r.glovo_bruto || 0)),
    je:      acc.je      + neto(Number(r.je_bruto || 0)),
    web:     acc.web     + neto(Number(r.web_bruto || 0)),
    directa: acc.directa + neto(Number(r.directa_bruto || 0)),
    total:   acc.total   + neto(Number(r.total_bruto || 0)),
    pedidos: 0,
  }), { uber: 0, glovo: 0, je: 0, web: 0, directa: 0, total: 0, pedidos: 0 })

  const fijos = fijosMes(p)
  const { varPct, margenPct: margen } = margenPct(mix, p)
  const peMensual = margen > 0 ? fijos / (margen / 100) : 0
  const peDiario = peMensual / diasMes
  const netoTarget = toNum(p.objetivo_beneficio_mensual)
  const brutoParaObjetivo = margen > 0 && factorFiscal > 0
    ? (fijos + netoTarget / factorFiscal) / (margen / 100)
    : 0

  return res.status(200).json({
    fijos_mes: Math.round(fijos),
    variable_pct: Math.round(varPct * 10) / 10,
    margen_pct: Math.round(margen * 10) / 10,
    pe_mensual: Math.round(peMensual),
    pe_diario: Math.round(peDiario),
    pe_semanal: Math.round(peDiario * 7),
    bruto_para_objetivo: Math.round(brutoParaObjetivo),
    objetivo_neto: netoTarget,
  })
}

export async function puedoGastarHandler(req: VercelRequest, res: VercelResponse) {
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
