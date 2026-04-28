/**
 * T-F4-08 — margenObjetivoPorMarca
 * Calcula margen objetivo ponderado por marca según recetas vinculadas a platos.
 * Elimina el default fijo 70%.
 */
import { supabase } from '@/lib/supabase'

export interface MargenMarcaResult {
  marca: string
  margen_objetivo_pct: number    // ponderado de recetas
  margen_real_pct: number | null // de ventas_plataforma si disponible
  semaforo: 'verde' | 'amarillo' | 'rojo'
  n_platos: number
}

/** Margen objetivo calculado por marca: promedio simple de (1 - food_cost_pct) por plato con receta */
export async function margenObjetivoPorMarca(marca: string): Promise<number> {
  const { data: platos } = await supabase
    .from('carta_platos')
    .select('pvp, receta_id')
    .eq('marca', marca)
    .eq('activo', true)
    .not('receta_id', 'is', null)

  if (!platos?.length) return 70 // fallback solo si no hay platos

  const receta_ids = platos.map((p: { receta_id: string }) => p.receta_id).filter(Boolean)
  const { data: recetas } = await supabase
    .from('recetas')
    .select('id, coste_rac, pvp_uber, pvp_glovo, pvp_je, pvp_web, pvp_directa')
    .in('id', receta_ids)
  const recetaMap = Object.fromEntries(
    (recetas ?? []).map((r: { id: string; coste_rac: number; pvp_uber: number; pvp_glovo: number; pvp_je: number; pvp_web: number; pvp_directa: number }) => [r.id, r])
  )

  let sumMargen = 0; let count = 0
  for (const p of platos as { pvp: number; receta_id: string }[]) {
    const r = recetaMap[p.receta_id]
    if (!r) continue
    const pvpRef = r.pvp_uber || r.pvp_glovo || r.pvp_je || r.pvp_web || r.pvp_directa || p.pvp
    if (pvpRef <= 0) continue
    sumMargen += (1 - r.coste_rac / pvpRef) * 100
    count++
  }
  return count > 0 ? Math.round((sumMargen / count) * 10) / 10 : 70
}

/** Semáforo: real vs objetivo */
export function calcularSemaforo(
  real_pct: number | null,
  objetivo_pct: number,
): 'verde' | 'amarillo' | 'rojo' {
  if (real_pct == null) return 'amarillo'
  if (real_pct >= objetivo_pct) return 'verde'
  if (real_pct >= objetivo_pct - 5) return 'amarillo'
  return 'rojo'
}

/** Obtiene datos de todas las marcas: objetivo calculado + real de ventas_plataforma */
export async function getMargenTodakMarcas(): Promise<MargenMarcaResult[]> {
  // Marcas activas
  const { data: marcasRows } = await supabase
    .from('marcas')
    .select('nombre')
    .eq('activo', true)
  const marcas: string[] = (marcasRows ?? []).map((m: { nombre: string }) => m.nombre)

  if (!marcas.length) return []

  // Ventas último mes por marca para calcular margen real (aproximado como ingreso neto / bruto)
  const fecha30 = new Date(); fecha30.setDate(fecha30.getDate() - 30)
  const { data: ventas } = await supabase
    .from('ventas_plataforma')
    .select('marca, bruto, neto')
    .gte('fecha_fin_periodo', fecha30.toISOString().slice(0, 10))

  const realByMarca: Record<string, { bruto: number; neto: number }> = {}
  for (const v of (ventas ?? []) as { marca: string; bruto: number | null; neto: number | null }[]) {
    if (!realByMarca[v.marca]) realByMarca[v.marca] = { bruto: 0, neto: 0 }
    realByMarca[v.marca].bruto += v.bruto ?? 0
    realByMarca[v.marca].neto += v.neto ?? 0
  }

  const resultados: MargenMarcaResult[] = []
  for (const marca of marcas) {
    // Platos con receta para contar
    const { data: platos } = await supabase
      .from('carta_platos')
      .select('id, receta_id')
      .eq('marca', marca)
      .eq('activo', true)
    const n_platos = (platos ?? []).length

    const margen_objetivo_pct = await margenObjetivoPorMarca(marca)

    const ventasMarca = realByMarca[marca]
    const margen_real_pct = ventasMarca && ventasMarca.bruto > 0
      ? Math.round((ventasMarca.neto / ventasMarca.bruto) * 1000) / 10
      : null

    resultados.push({
      marca,
      margen_objetivo_pct,
      margen_real_pct,
      semaforo: calcularSemaforo(margen_real_pct, margen_objetivo_pct),
      n_platos,
    })
  }
  return resultados
}
