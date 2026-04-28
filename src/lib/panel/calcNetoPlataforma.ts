/**
 * calcNetoPlataforma.ts
 * Cálculo de neto cobrado por canal según spec FASE 5, sección 5.4.1
 *
 * Fórmulas literales del spec. ADS NO se restan al neto (informativo aparte).
 * Comisiones % leídas de tabla canales (config_canales); defaults = valores spec.
 */

export interface CanalesConfig {
  uber_comision_pct?: number   // default 0.30 (Portier)
  uber_fees_total?: number     // fees por periodo (suma de fees del resumen mensual)
  uber_cargos_promo?: number   // cargos promoción del periodo
  glovo_comision_pct?: number  // default 0.25
  glovo_comision_fija?: number // default 0.75 por pedido
}

export interface NetoResult {
  neto: number
  margenPct: number
}

const IVA = 0.21

/**
 * Uber / Portier
 * neto = bruto - comision_pct*bruto - fees - cargos_promo - 0.21*(comision_pct*bruto + fees + cargos_promo)
 */
export function calcNetoUber(
  bruto: number,
  pedidos: number,
  cfg: Pick<CanalesConfig, 'uber_comision_pct' | 'uber_fees_total' | 'uber_cargos_promo'> = {}
): NetoResult {
  const comPct = cfg.uber_comision_pct ?? 0.30
  const fees = cfg.uber_fees_total ?? 0
  const promo = cfg.uber_cargos_promo ?? 0
  // pedidos param unused for Uber (fee total already in fees), kept for interface consistency
  void pedidos
  const baseComision = comPct * bruto + fees + promo
  const ivaComision = IVA * baseComision
  const neto = Math.max(0, bruto - baseComision - ivaComision)
  const margenPct = bruto > 0 ? (neto / bruto) * 100 : 0
  return { neto, margenPct }
}

/**
 * Glovo
 * neto = bruto - comPct*bruto - comFija*pedidos - 0.21*(comPct*bruto + comFija*pedidos)
 */
export function calcNetoGlovo(
  bruto: number,
  pedidos: number,
  cfg: Pick<CanalesConfig, 'glovo_comision_pct' | 'glovo_comision_fija'> = {}
): NetoResult {
  const comPct = cfg.glovo_comision_pct ?? 0.25
  const comFija = cfg.glovo_comision_fija ?? 0.75
  const baseComision = comPct * bruto + comFija * pedidos
  const ivaComision = IVA * baseComision
  const neto = Math.max(0, bruto - baseComision - ivaComision)
  const margenPct = bruto > 0 ? (neto / bruto) * 100 : 0
  return { neto, margenPct }
}

/**
 * Just Eat
 * neto = bruto - 0.20*bruto - 0.75*pedidos - 0.21*(0.20*bruto + 0.75*pedidos)
 */
export function calcNetoJustEat(
  bruto: number,
  pedidos: number
): NetoResult {
  const baseComision = 0.20 * bruto + 0.75 * pedidos
  const ivaComision = IVA * baseComision
  const neto = Math.max(0, bruto - baseComision - ivaComision)
  const margenPct = bruto > 0 ? (neto / bruto) * 100 : 0
  return { neto, margenPct }
}

/**
 * Web (Stripe / Redsys)
 * neto = bruto - 0.07*bruto - 0.50*pedidos - 0.21*(0.07*bruto + 0.50*pedidos)
 */
export function calcNetoWeb(
  bruto: number,
  pedidos: number
): NetoResult {
  const baseComision = 0.07 * bruto + 0.50 * pedidos
  const ivaComision = IVA * baseComision
  const neto = Math.max(0, bruto - baseComision - ivaComision)
  const margenPct = bruto > 0 ? (neto / bruto) * 100 : 0
  return { neto, margenPct }
}

/**
 * Directa (sin comisión)
 * neto = bruto
 */
export function calcNetoDirecta(bruto: number): NetoResult {
  return { neto: bruto, margenPct: 100 }
}

/**
 * Dispatcher por canalId
 * canalId: 'uber' | 'glovo' | 'je' | 'web' | 'dir'
 */
export function calcNetoPorCanal(
  canalId: string,
  bruto: number,
  pedidos: number,
  cfg: CanalesConfig = {}
): NetoResult {
  switch (canalId) {
    case 'uber':  return calcNetoUber(bruto, pedidos, cfg)
    case 'glovo': return calcNetoGlovo(bruto, pedidos, cfg)
    case 'je':    return calcNetoJustEat(bruto, pedidos)
    case 'web':   return calcNetoWeb(bruto, pedidos)
    case 'dir':   return calcNetoDirecta(bruto)
    default:      return calcNetoDirecta(bruto)
  }
}

/**
 * Identificación de plataforma desde concepto bancario
 * Retorna: 'uber' | 'glovo' | 'just_eat' | 'web' | null
 */
export function identificarPlataformaBancaria(concepto: string): string | null {
  const upper = concepto.toUpperCase()
  if (upper.includes('UBER') || upper.includes('PORTIER')) return 'uber'
  if (upper.includes('GLOVO') || upper.includes('GLOVOAPP')) return 'glovo'
  if (upper.includes('JUST EAT') || upper.includes('TAKEAWAY')) return 'just_eat'
  if (upper.includes('STRIPE') || upper.includes('REDSYS') || upper.includes('ADYEN')) return 'web'
  return null
}

/**
 * Estado validación banca vs calculado
 */
export type EstadoValidacion = 'OK' | 'ALERTA' | 'ERROR'

export function calcEstadoValidacion(diferenciaAbsPct: number): EstadoValidacion {
  if (diferenciaAbsPct <= 1) return 'OK'
  if (diferenciaAbsPct <= 5) return 'ALERTA'
  return 'ERROR'
}
