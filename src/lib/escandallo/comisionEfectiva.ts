/**
 * comisionEfectivaCanal — Tanda D2 · divergencias D (fees fijos) + E (comisión real).
 *
 * El waterfall del Escandallo dejaba de usar la comisión BASE de config_canales, sin fees
 * fijos y sin datos reales de liquidación. Rubén cerró: el margen del plato debe salir del
 * mismo sitio que el margen de Panel/Running — `netoResolver` (LEY-NETO-01).
 *
 * `resolverNeto(canal, pvp, 1)` sin fechas ni real manda de periodo:
 *   1) ratio_neto_real calibrado (config_canales) si existe → el más fiable.
 *   2) si no, ratio empírico ponderado por recencia (loadRatiosCalibrados) si es fiable.
 *   3) si no, fórmula teórica (calcNetoPorCanal) SIN fee periódico (no hay fechas) pero
 *      SÍ con fijo_eur/pedido (JE 0,30€, Web 0,50€) y mezcla prime/promo autocalibrada.
 * En los tres casos el fee periódico (Uber semanal, Glovo quincenal) queda fuera: no hay
 * forma de prorratearlo a UN plato sin asumir un volumen de pedidos, y ya vive en el
 * cálculo agregado de Panel/Running. Meterlo aquí sería contarlo dos veces.
 *
 * Requiere que los cachés de netoResolver/calcNetoPlataforma estén precargados (ver
 * useVentasRealesListas/useRatiosCalibrados/useConfigCanales) — si no, cae a la comisión
 * base pasada como fallback, nunca a un 0% silencioso.
 */
import { resolverNeto } from '@/lib/panel/netoResolver'

const CANAL_ID: Record<string, string> = {
  uber: 'uber', glovo: 'glovo', je: 'je', web: 'web', directa: 'dir', dir: 'dir',
}

export function comisionEfectivaCanal(canalId: string, pvp: number, comisionBaseDec: number): number {
  if (!(pvp > 0)) return comisionBaseDec
  const id = CANAL_ID[canalId] ?? canalId
  let neto: number
  try {
    neto = resolverNeto(id, pvp, 1).neto
  } catch {
    return comisionBaseDec
  }
  if (!(neto > 0) || neto >= pvp) return comisionBaseDec
  return (pvp - neto) / pvp
}
