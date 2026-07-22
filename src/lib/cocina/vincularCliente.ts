/**
 * Cliente del vínculo plato↔receta (LEY-PLATO-01). El vínculo se hace UNA vez
 * sobre el plato maestro y la RPC lo refleja en mapeo (análisis/Pareto/Coste) y
 * en carta_platos (Carta). Único punto de escritura: aquí lo llaman el hub, la
 * pestaña Hoy y —redirigidos— Coste por plato y Carta.
 */
import { supabase } from '@/lib/supabase'

export async function vincularPlato(maestroId: number, recetaId: string): Promise<void> {
  const { error } = await supabase.rpc('vincular_plato_maestro', { p_maestro: maestroId, p_receta: recetaId })
  if (error) throw error
}

export async function desvincularPlato(maestroId: number): Promise<void> {
  const { error } = await supabase.rpc('desvincular_plato_maestro', { p_maestro: maestroId })
  if (error) throw error
}
