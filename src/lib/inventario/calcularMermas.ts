import { supabase } from '@/lib/supabase'

export interface MermaIngrediente {
  ingrediente_id: string
  nombre: string
  unidad: string
  consumo_real: number
  consumo_teorico: number | null
  merma: number | null
  merma_pct: number | null
  precio_unitario: number | null
  merma_eur: number | null
  sin_datos: boolean
}

export async function calcularMermas(desde: string, hasta: string): Promise<MermaIngrediente[]> {
  // 1. Consumo real por ingrediente (sumar conteos del periodo)
  const { data: conteos } = await supabase
    .from('conteos_inventario')
    .select('ingrediente_id, consumo, ingrediente:ingredientes(nombre,unidad)')
    .gte('fecha', desde)
    .lte('fecha', hasta)

  if (!conteos || conteos.length === 0) return []

  // Agrupar consumo real por ingrediente
  // Supabase join returns array; normalise
  type ConsumoMap = Record<string, { consumo: number; nombre: string; unidad: string }>
  const consumoReal: ConsumoMap = {}
  for (const raw of conteos as unknown[]) {
    const c = raw as Record<string, unknown>
    const ingRaw = Array.isArray(c.ingrediente) ? (c.ingrediente as Array<{ nombre: string; unidad: string }>)[0] ?? null : (c.ingrediente as { nombre: string; unidad: string } | null) ?? null
    const ing_id = c.ingrediente_id as string
    if (!consumoReal[ing_id]) {
      consumoReal[ing_id] = {
        consumo: 0,
        nombre: ingRaw?.nombre ?? ing_id,
        unidad: ingRaw?.unidad ?? '',
      }
    }
    consumoReal[ing_id].consumo += Number(c.consumo ?? 0)
  }

  // 2. Cargar recetas_lineas con join a recetas
  const { data: recetasLineas } = await supabase
    .from('recetas_lineas')
    .select('ingrediente_id, cantidad, receta:recetas(id, nombre)')

  // 3. Cargar carta_platos (si existe) para vincular receta → plato
  const { data: cartaPlatos } = await supabase
    .from('carta_platos')
    .select('id, nombre, receta_id')
    .eq('activo', true)

  // 4. Cargar facturacion_diario del periodo (pedidos totales)
  const { data: facturacion } = await supabase
    .from('facturacion_diario')
    .select('fecha, uber_pedidos, glovo_pedidos, je_pedidos, web_pedidos, directa_pedidos')
    .gte('fecha', desde)
    .lte('fecha', hasta)

  // Calcular total pedidos por dia
  type PedidosPorDia = Record<string, number>
  const pedidosDia: PedidosPorDia = {}
  let totalPedidos = 0
  if (facturacion) {
    for (const f of facturacion as Array<{
      fecha: string
      uber_pedidos: number | null
      glovo_pedidos: number | null
      je_pedidos: number | null
      web_pedidos: number | null
      directa_pedidos: number | null
    }>) {
      const p = (f.uber_pedidos ?? 0) + (f.glovo_pedidos ?? 0) + (f.je_pedidos ?? 0) + (f.web_pedidos ?? 0) + (f.directa_pedidos ?? 0)
      pedidosDia[f.fecha] = p
      totalPedidos += p
    }
  }

  const hayVentas = totalPedidos > 0

  // 5. Calcular consumo_teorico por ingrediente
  // Simplificación: asumimos que todos los platos se reparten equitativamente los pedidos
  // Si hay carta_platos con receta_id: consumo_teorico[ing] = SUM(cantidad_por_racion × pedidos_totales / nplatos_con_receta)
  const consumoTeorico: Record<string, number> = {}

  if (hayVentas && recetasLineas && cartaPlatos) {
    const platosConReceta = (cartaPlatos as Array<{ id: string; nombre: string; receta_id: string | null }>).filter(p => p.receta_id)
    const nPlatosConReceta = platosConReceta.length || 1

    // peso uniforme por plato si no hay desglose
    const pedidosPorPlato = totalPedidos / nPlatosConReceta

    for (const raw of recetasLineas as unknown[]) {
      const rl = raw as Record<string, unknown>
      const recetaRaw = Array.isArray(rl.receta) ? (rl.receta as Array<{ id: string }>)[0] ?? null : (rl.receta as { id: string } | null) ?? null
      const recetaId = recetaRaw?.id
      if (!recetaId) continue
      const ingredienteId = rl.ingrediente_id as string
      const cantidad = Number(rl.cantidad ?? 0)
      // cuántos platos usan esta receta
      const platosConEstaReceta = platosConReceta.filter(p => p.receta_id === recetaId).length
      if (platosConEstaReceta === 0) continue

      const consumo = cantidad * pedidosPorPlato * platosConEstaReceta
      consumoTeorico[ingredienteId] = (consumoTeorico[ingredienteId] ?? 0) + consumo
    }
  }

  // 6. Precios actuales por ingrediente (último precio)
  const ingredienteIds = Object.keys(consumoReal)
  const precioMap: Record<string, number> = {}

  if (ingredienteIds.length > 0) {
    const { data: precios } = await supabase
      .from('precios_ingredientes')
      .select('ingrediente_id, precio_unitario')
      .in('ingrediente_id', ingredienteIds)
      .order('fecha', { ascending: false })

    if (precios) {
      for (const p of precios as Array<{ ingrediente_id: string; precio_unitario: number }>) {
        if (!precioMap[p.ingrediente_id]) {
          precioMap[p.ingrediente_id] = Number(p.precio_unitario)
        }
      }
    }
  }

  // 7. Construir resultado
  return Object.entries(consumoReal).map(([ing_id, data]) => {
    const cr = data.consumo
    const ct = hayVentas && consumoTeorico[ing_id] !== undefined ? consumoTeorico[ing_id] : null
    const tieneRecetaVinculada = hayVentas && ct !== null
    const merma = tieneRecetaVinculada ? cr - (ct ?? 0) : null
    const merma_pct = tieneRecetaVinculada && ct && ct > 0 ? (merma! / ct) * 100 : null
    const precio = precioMap[ing_id] ?? null
    const merma_eur = merma !== null && precio !== null ? merma * precio : null

    return {
      ingrediente_id: ing_id,
      nombre: data.nombre,
      unidad: data.unidad,
      consumo_real: cr,
      consumo_teorico: ct,
      merma,
      merma_pct,
      precio_unitario: precio,
      merma_eur,
      sin_datos: !tieneRecetaVinculada,
    }
  }).sort((a, b) => (b.merma_eur ?? 0) - (a.merma_eur ?? 0))
}
