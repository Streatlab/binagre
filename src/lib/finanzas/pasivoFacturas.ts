/**
 * pasivoFacturas — pasivo corriente "vivo" a partir de la tabla `facturas`.
 *
 * `facturas.estado` describe el estado del PIPELINE de lectura/conciliación
 * OCR (pendiente_revision, sin_match, pendiente_lectura_manual,
 * pendiente_titular_manual), no si la factura está pagada o no: la tabla no
 * tiene columna de fecha de vencimiento ni de pago. La inmensa mayoría de
 * las ~980 facturas en esos estados son backlog histórico (2023-2025) ya
 * pagado en su día, sin conciliar en el ERP — no deuda real pendiente.
 *
 * Criterio ajustado: solo cuentan como pasivo vivo las facturas SIN
 * conciliar cuya `fecha_factura` cae dentro de los últimos 60 días (proxy
 * de plazo de pago habitual a proveedor, a falta de fecha de vencimiento en
 * BD), excluyendo posibles duplicados y facturas ya marcadas no
 * conciliables.
 */
import { supabase } from '@/lib/supabase'

export const ESTADOS_PENDIENTES_OCR = [
  'pendiente_revision',
  'pendiente_lectura_manual',
  'sin_match',
  'pendiente_titular_manual',
]

// Proxy de plazo de pago a proveedor: no existe fecha_vencimiento en `facturas`.
const DIAS_VENTANA_PASIVO_VIVO = 60

export interface PasivoFacturasResult {
  total: number
  count: number
  countHistoricoDescartado: number
}

export async function getPasivoFacturasVivas(): Promise<PasivoFacturasResult> {
  const desde = new Date()
  desde.setDate(desde.getDate() - DIAS_VENTANA_PASIVO_VIVO)
  const desdeISO = desde.toISOString().slice(0, 10)

  const [vivasRes, totalRes] = await Promise.all([
    supabase
      .from('facturas')
      .select('total,estado,fecha_factura')
      .in('estado', ESTADOS_PENDIENTES_OCR)
      .gte('fecha_factura', desdeISO)
      .or('posible_duplicado.is.null,posible_duplicado.eq.false')
      .or('no_conciliable.is.null,no_conciliable.eq.false'),
    supabase
      .from('facturas')
      .select('id', { count: 'exact', head: true })
      .in('estado', ESTADOS_PENDIENTES_OCR),
  ])
  if (vivasRes.error) throw vivasRes.error
  if (totalRes.error) throw totalRes.error

  const rows = (vivasRes.data || []) as { total: number | null }[]
  const total = rows.reduce((s, r) => s + Number(r.total ?? 0), 0)
  const countTotalHistorico = totalRes.count ?? rows.length

  return { total, count: rows.length, countHistoricoDescartado: countTotalHistorico - rows.length }
}
