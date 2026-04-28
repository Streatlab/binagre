/**
 * T-F4-09 — onPrecioInsertado
 * Wrapper que combina actualizarPreciosDesdeFactura + recalcularFoodCostRecetas
 * y emite alertas UI. Sin persistencia en BD (F4-H6).
 */
import {
  actualizarPreciosDesdeFactura,
  recalcularFoodCostRecetas,
  type LineaFacturaIngrediente,
  type AlertaFoodCost,
} from './actualizarPreciosDesdeFactura'
import { toast } from '@/lib/toastStore'

export type { AlertaFoodCost }

/** Ejecutar tras vincular/importar facturas producto.
 *  Retorna alertas para que la UI las muestre (banner amarillo T-F4-10). */
export async function onPrecioInsertado(
  factura_id: string | null,
  lineas: LineaFacturaIngrediente[],
): Promise<AlertaFoodCost[]> {
  const ids = await actualizarPreciosDesdeFactura(factura_id, lineas)
  const alertas = await recalcularFoodCostRecetas(ids)

  if (alertas.length > 0) {
    // Emitir toast para notificar en sesión activa
    toast.error(
      `${alertas.length} receta${alertas.length > 1 ? 's' : ''} con food cost > umbral tras actualizar precios`,
    )
  }

  return alertas
}
