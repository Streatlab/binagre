/**
 * T-F4-02 — actualizarPreciosDesdeFactura
 * Lógica frontend post-import: inserta filas en precios_ingredientes y
 * recalcula food cost de recetas afectadas. Decisión autónoma F4-H3.
 */
import { supabase } from '@/lib/supabase'

export interface LineaFacturaIngrediente {
  ingrediente_id: string
  precio_unitario: number
  proveedor: string
  fecha: string // ISO date YYYY-MM-DD
}

export interface AlertaFoodCost {
  receta_id: string
  receta_nombre: string
  food_cost_pct: number
  umbral: number
}

/** INSERT batch en precios_ingredientes desde una factura conciliada */
export async function actualizarPreciosDesdeFactura(
  factura_id: string | null,
  lineas: LineaFacturaIngrediente[],
): Promise<string[]> {
  if (!lineas.length) return []

  const rows = lineas.map(l => ({
    ingrediente_id: l.ingrediente_id,
    fecha: l.fecha,
    precio_unitario: l.precio_unitario,
    proveedor: l.proveedor,
    factura_id: factura_id ?? null,
  }))

  const { error } = await supabase.from('precios_ingredientes').insert(rows)
  if (error) {
    // eslint-disable-next-line no-console
    void Promise.reject(new Error(`precios_ingredientes insert: ${error.message}`))
    return []
  }

  return lineas.map(l => l.ingrediente_id)
}

/** Recalcula food cost de recetas que usen alguno de los ingredientes indicados.
 *  Devuelve alertas para ingredientes con food_cost > umbral.
 *  Cálculo en memoria (sin persistir). Decisión autónoma F4-H6. */
export async function recalcularFoodCostRecetas(
  ingrediente_ids: string[],
): Promise<AlertaFoodCost[]> {
  if (!ingrediente_ids.length) return []

  // Leer umbral desde configuracion
  const { data: cfgRow } = await supabase
    .from('configuracion')
    .select('valor')
    .eq('clave', 'config_food_cost_umbral')
    .maybeSingle()
  const umbral = cfgRow ? parseFloat(String(cfgRow.valor)) || 32 : 32

  // Recetas que usen alguno de los ingredientes modificados (vía recetas_lineas)
  const { data: lineas } = await supabase
    .from('recetas_lineas')
    .select('receta_id')
    .in('ingrediente_id', ingrediente_ids)
  if (!lineas?.length) return []

  const receta_ids = [...new Set(lineas.map((l: { receta_id: string }) => l.receta_id))]

  // Leer coste actual de recetas
  const { data: recetas } = await supabase
    .from('recetas')
    .select('id, nombre, coste_rac, pvp_uber, pvp_glovo, pvp_je, pvp_web, pvp_directa')
    .in('id', receta_ids)
  if (!recetas?.length) return []

  const alertas: AlertaFoodCost[] = []
  for (const r of recetas as {
    id: string; nombre: string; coste_rac: number;
    pvp_uber: number; pvp_glovo: number; pvp_je: number; pvp_web: number; pvp_directa: number
  }[]) {
    // Usar pvp_uber como PVP de referencia para % food cost
    const pvpRef = r.pvp_uber || r.pvp_glovo || r.pvp_je || r.pvp_web || r.pvp_directa || 0
    if (pvpRef <= 0) continue
    const food_cost_pct = (r.coste_rac / pvpRef) * 100
    if (food_cost_pct > umbral) {
      alertas.push({
        receta_id: r.id,
        receta_nombre: r.nombre,
        food_cost_pct: Math.round(food_cost_pct * 10) / 10,
        umbral,
      })
    }
  }
  return alertas
}
