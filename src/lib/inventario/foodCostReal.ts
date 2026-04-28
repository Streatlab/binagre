import { supabase } from '@/lib/supabase'

export interface FoodCostDataPoint {
  mes: string   // 'YYYY-MM'
  fecha: string // primer dia del mes, para recharts
  teorico: number | null
  real: number | null
}

export interface FoodCostResumen {
  teorico: number | null
  real: number | null
  desviacion: number | null
  evolucion: FoodCostDataPoint[]
  sinDatos: boolean
}

export async function calcularFoodCostReal(desde: string, hasta: string): Promise<FoodCostResumen> {
  // 1. Consumo real × precio → coste real total
  const { data: conteos } = await supabase
    .from('conteos_inventario')
    .select('ingrediente_id, consumo, fecha')
    .gte('fecha', desde)
    .lte('fecha', hasta)

  if (!conteos || conteos.length === 0) {
    return { teorico: null, real: null, desviacion: null, evolucion: [], sinDatos: true }
  }

  const ingredienteIds = [...new Set((conteos as Array<{ ingrediente_id: string }>).map(c => c.ingrediente_id))]

  // Precio actual por ingrediente (último precio disponible)
  const { data: precios } = await supabase
    .from('precios_ingredientes')
    .select('ingrediente_id, precio_unitario, fecha')
    .in('ingrediente_id', ingredienteIds)
    .order('fecha', { ascending: false })

  const precioMap: Record<string, number> = {}
  if (precios) {
    for (const p of precios as Array<{ ingrediente_id: string; precio_unitario: number }>) {
      if (!precioMap[p.ingrediente_id]) {
        precioMap[p.ingrediente_id] = Number(p.precio_unitario)
      }
    }
  }

  // 2. Ventas netas del periodo
  const { data: ventas } = await supabase
    .from('facturacion_diario')
    .select('uber_bruto, glovo_bruto, je_bruto, web_bruto, directa_bruto')
    .gte('fecha', desde)
    .lte('fecha', hasta)

  let ventasNetas = 0
  if (ventas) {
    for (const v of ventas as Array<{
      uber_bruto: number | null
      glovo_bruto: number | null
      je_bruto: number | null
      web_bruto: number | null
      directa_bruto: number | null
    }>) {
      ventasNetas += (v.uber_bruto ?? 0) + (v.glovo_bruto ?? 0) + (v.je_bruto ?? 0) + (v.web_bruto ?? 0) + (v.directa_bruto ?? 0)
    }
  }

  // 3. Coste real total
  let costeReal = 0
  for (const c of conteos as Array<{ ingrediente_id: string; consumo: number; fecha: string }>) {
    const precio = precioMap[c.ingrediente_id]
    if (precio) costeReal += Number(c.consumo) * precio
  }

  const foodCostReal = ventasNetas > 0 ? (costeReal / ventasNetas) * 100 : null

  // 4. Food cost teórico: buscar en configuracion (clave 'food_cost_teorico_pct') o usar 28% por defecto
  let foodCostTeorico: number | null = null
  const { data: cfg } = await supabase
    .from('configuracion')
    .select('valor')
    .eq('clave', 'food_cost_teorico_pct')
    .maybeSingle()

  if (cfg && cfg.valor) {
    foodCostTeorico = Number(cfg.valor)
  } else {
    // DECISIÓN AUTÓNOMA: usar 28% por defecto (benchmark hostelería)
    foodCostTeorico = 28
  }

  const desviacion = foodCostReal !== null ? foodCostReal - foodCostTeorico : null

  // 5. Evolución mensual: agrupar conteos por mes
  const mesMap: Record<string, { coste: number; ventas: number }> = {}

  for (const c of conteos as Array<{ ingrediente_id: string; consumo: number; fecha: string }>) {
    const mes = c.fecha.slice(0, 7) // 'YYYY-MM'
    if (!mesMap[mes]) mesMap[mes] = { coste: 0, ventas: 0 }
    const precio = precioMap[c.ingrediente_id]
    if (precio) mesMap[mes].coste += Number(c.consumo) * precio
  }

  if (ventas) {
    const { data: ventasMes } = await supabase
      .from('facturacion_diario')
      .select('fecha, uber_bruto, glovo_bruto, je_bruto, web_bruto, directa_bruto')
      .gte('fecha', desde)
      .lte('fecha', hasta)

    if (ventasMes) {
      for (const v of ventasMes as Array<{
        fecha: string
        uber_bruto: number | null
        glovo_bruto: number | null
        je_bruto: number | null
        web_bruto: number | null
        directa_bruto: number | null
      }>) {
        const mes = v.fecha.slice(0, 7)
        if (!mesMap[mes]) mesMap[mes] = { coste: 0, ventas: 0 }
        mesMap[mes].ventas += (v.uber_bruto ?? 0) + (v.glovo_bruto ?? 0) + (v.je_bruto ?? 0) + (v.web_bruto ?? 0) + (v.directa_bruto ?? 0)
      }
    }
  }

  const evolucion: FoodCostDataPoint[] = Object.entries(mesMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, d]) => ({
      mes,
      fecha: mes + '-01',
      teorico: foodCostTeorico,
      real: d.ventas > 0 ? (d.coste / d.ventas) * 100 : null,
    }))

  return {
    teorico: foodCostTeorico,
    real: foodCostReal,
    desviacion,
    evolucion,
    sinDatos: !foodCostReal,
  }
}
