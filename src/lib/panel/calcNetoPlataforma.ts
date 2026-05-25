/**
 * calcNetoPlataforma.ts · FUNCIÓN CENTRAL ÚNICA del ERP
 *
 * Fuente de verdad: config_canales + marca_plataforma_acceso (Supabase).
 * Documentación canónica: Notion 366c8b1f-6139-81a8-95a7-dd0abdf63a91
 * Procedimiento: Notion 366c8b1f-6139-81c1-8451-fbef75dd3aa2
 *
 * Fórmulas reales verificadas (64 pedidos + 10 facturas, may 2026):
 *
 *   UBER EATS
 *     Por pedido:
 *       Si Uber One        → comisión = 33% × precio
 *       Si NO Uber One     → comisión = 30% × precio
 *       Si pedido con promo → +0,82€ extra (sea Prime o no)
 *     Periodo:
 *       fee_periódico = 2,29€ × semanas × marcas activas Uber
 *       IVA 21% sobre TODO
 *
 *   GLOVO
 *     Por pedido:
 *       comisión = 30% × precio
 *       Si cliente Prime → +0,74€ extra
 *     Periodo:
 *       fee_periódico = 10€ × quincenas × marcas activas Glovo
 *       IVA 21% sobre TODO
 *
 *   JUST EAT
 *     Por pedido:
 *       comisión = 30% × (precio − GastosUsuario × 1,21)
 *       fee_pedido = 0,30€
 *     IVA 21% sobre TODO
 *
 *   WEB PROPIA
 *     fee_pedido = 0,50€ + IVA21%
 *
 *   VENTA DIRECTA
 *     Sin fees, Neto = Bruto
 *
 * NOTA PRORRATEO (24 may 2026):
 *   El fee periódico se prorratea por días reales del rango, NO por
 *   ciclos completos. Filtrar 1 día de Glovo ya no carga 10€ entero,
 *   sino 10€/15 ≈ 0,67€/día × marcas. Igual con Uber semanal.
 *
 * Funciones expuestas:
 *   - calcNetoPorCanal()      → devuelve solo el neto total (para conciliación)
 *   - calcDesglosePorCanal()  → devuelve cada componente desglosado (para Running)
 *   - loadConfigCanales()     → carga config desde Supabase (con caché y realtime)
 *   - loadMarcasPorCanal()    → carga nº marcas por canal
 */

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const IVA = 0.21

export interface NetoResult { neto: number; margenPct: number }

/**
 * Desglose completo de los componentes que componen el neto de un canal.
 * Cada importe ya lleva IVA del 21% (excepto bruto que es el cobrado por el cliente).
 * Útil para mostrar línea a línea en el Running.
 */
export interface DesgloseCanal {
  bruto: number              // Lo pagado por el cliente
  comisionConIva: number     // Comisión variable (30/33% × bruto) + IVA 21%
  feePromoConIva: number     // Uber: 0,82€ × pedidos_promo + IVA. Glovo: 0
  feePrimeConIva: number     // Glovo: 0,74€ × pedidos_prime + IVA. Uber: 0
  feePeriodicoConIva: number // Uber: 2,29€ × semanas × marcas + IVA. Glovo: 10€ × quincenas × marcas + IVA
  fijoPedidoConIva: number   // JE: 0,30€/ped + IVA. Web: 0,50€/ped + IVA
  totalDescuentos: number    // Suma de todos los anteriores (sin bruto)
  neto: number               // bruto − totalDescuentos
}

export interface CanalConfig {
  canal: string
  comision_pct: number
  comision_pct_prime: number | null
  fijo_eur: number
  fee_prime_eur: number
  fee_promo_eur: number
  fee_periodo_eur: number
  fee_periodicidad: string
  pct_pedidos_prime_estim: number
  pct_pedidos_promo_estim: number
}

/** Marcas activas reales por canal (de marca_plataforma_acceso) */
export interface MarcasPorCanal {
  uber: number
  glovo: number
  je: number
  web?: number
  dir?: number
}

/** Modo de cálculo */
export type ModoNeto = 'agregado_canal' | 'subset_marca' | 'plato'

export interface OpcionesCalcNeto {
  modo?: ModoNeto
  fechaDesde?: Date
  fechaHasta?: Date
  marcasPorCanal?: MarcasPorCanal | number
  promoSubvencionada?: number
  configCanales?: Record<string, CanalConfig>
}

let cacheConfig: Record<string, CanalConfig> | null = null
let cacheMarcasPorCanal: MarcasPorCanal | null = null
let realtimeInit = false

const MAP_ID_CANAL: Record<string, string> = {
  uber: 'Uber Eats', glovo: 'Glovo', je: 'Just Eat',
  web: 'Web Propia', dir: 'Venta Directa',
}

function normalizarCanalId(id: string): string {
  const v = (id || '').toLowerCase()
  if (v === 'directa') return 'dir'
  if (v === 'just_eat') return 'je'
  return v
}

const MAP_PLAT_ACCESO: Record<string, keyof MarcasPorCanal> = {
  UE: 'uber', GL: 'glovo', JE: 'je',
}

function ensureRealtime() {
  if (realtimeInit) return
  realtimeInit = true
  supabase
    .channel('config_canales_changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'config_canales' },
      async () => {
        cacheConfig = null
        await loadConfigCanales()
        window.dispatchEvent(new CustomEvent('config_canales:changed'))
        window.dispatchEvent(new CustomEvent('config_canales_updated'))
      }
    )
    .subscribe()
  supabase
    .channel('marca_plataforma_acceso_changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'marca_plataforma_acceso' },
      async () => {
        cacheMarcasPorCanal = null
        await loadMarcasPorCanal()
        window.dispatchEvent(new CustomEvent('config_canales:changed'))
      }
    )
    .subscribe()
}

export async function loadConfigCanales(): Promise<Record<string, CanalConfig>> {
  ensureRealtime()
  if (cacheConfig) return cacheConfig
  const { data, error } = await supabase
    .from('config_canales')
    .select('canal, comision_pct, comision_pct_prime, fijo_eur, fee_prime_eur, fee_promo_eur, fee_periodo_eur, fee_periodicidad, pct_pedidos_prime_estim, pct_pedidos_promo_estim')
    .eq('activo', true)
  if (error || !data) { cacheConfig = {}; return cacheConfig }
  const out: Record<string, CanalConfig> = {}
  for (const row of data as any[]) {
    out[row.canal] = {
      canal: row.canal,
      comision_pct: Number(row.comision_pct ?? 0),
      comision_pct_prime: row.comision_pct_prime != null ? Number(row.comision_pct_prime) : null,
      fijo_eur: Number(row.fijo_eur ?? 0),
      fee_prime_eur: Number(row.fee_prime_eur ?? 0),
      fee_promo_eur: Number(row.fee_promo_eur ?? 0),
      fee_periodo_eur: Number(row.fee_periodo_eur ?? 0),
      fee_periodicidad: String(row.fee_periodicidad ?? 'mensual'),
      pct_pedidos_prime_estim: Number(row.pct_pedidos_prime_estim ?? 0),
      pct_pedidos_promo_estim: Number(row.pct_pedidos_promo_estim ?? 0),
    }
  }
  cacheConfig = out
  return cacheConfig
}

export async function loadMarcasPorCanal(): Promise<MarcasPorCanal> {
  ensureRealtime()
  if (cacheMarcasPorCanal) return cacheMarcasPorCanal
  const out: MarcasPorCanal = { uber: 0, glovo: 0, je: 0, web: 1, dir: 1 }
  const { data, error } = await supabase
    .from('marca_plataforma_acceso')
    .select('plataforma, activo')
    .eq('activo', true)
  if (error || !data) { cacheMarcasPorCanal = out; return out }
  const counter: Record<string, number> = {}
  for (const row of data as { plataforma: string }[]) {
    const k = (row.plataforma || '').toUpperCase()
    counter[k] = (counter[k] ?? 0) + 1
  }
  for (const [k, key] of Object.entries(MAP_PLAT_ACCESO)) {
    if (counter[k]) out[key] = counter[k]
  }
  cacheMarcasPorCanal = out
  return out
}

export function invalidarCacheConfigCanales() {
  cacheConfig = null
  cacheMarcasPorCanal = null
}

export async function recargarConfigCanales(): Promise<Record<string, CanalConfig>> {
  cacheConfig = null
  return loadConfigCanales()
}

export function useConfigCanales(): Record<string, CanalConfig> {
  const [config, setConfig] = useState<Record<string, CanalConfig>>({})
  useEffect(() => {
    let mounted = true
    loadConfigCanales().then(c => { if (mounted) setConfig({ ...c }) })
    const onChange = () => {
      recargarConfigCanales().then(c => { if (mounted) setConfig({ ...c }) })
    }
    window.addEventListener('config_canales:changed', onChange)
    window.addEventListener('config_canales_updated', onChange)
    return () => {
      mounted = false
      window.removeEventListener('config_canales:changed', onChange)
      window.removeEventListener('config_canales_updated', onChange)
    }
  }, [])
  return config
}

export function useMarcasPorCanal(): MarcasPorCanal {
  const [marcas, setMarcas] = useState<MarcasPorCanal>({ uber: 0, glovo: 0, je: 0, web: 1, dir: 1 })
  useEffect(() => {
    let mounted = true
    loadMarcasPorCanal().then(m => { if (mounted) setMarcas({ ...m }) })
    const onChange = () => {
      cacheMarcasPorCanal = null
      loadMarcasPorCanal().then(m => { if (mounted) setMarcas({ ...m }) })
    }
    window.addEventListener('config_canales:changed', onChange)
    return () => {
      mounted = false
      window.removeEventListener('config_canales:changed', onChange)
    }
  }, [])
  return marcas
}

/**
 * Devuelve el fee periódico PRORRATEADO por días del rango.
 * Antes devolvía nº ciclos enteros (Math.ceil) → cargaba ciclo entero a 1 día.
 * Ahora devuelve fracción decimal exacta por día.
 */
function calcularPeriodosProrrateados(periodicidad: string, fechaDesde: Date, fechaHasta: Date): number {
  const dias = Math.max(1, Math.round((fechaHasta.getTime() - fechaDesde.getTime()) / 86400000) + 1)
  switch (periodicidad) {
    case 'semanal_por_marca':    return dias / 7
    case 'quincenal_por_marca':  return dias / 15
    case 'mensual':              return dias / 30
    default:                     return 1
  }
}

function resolveMarcas(canalId: string, marcas: number | MarcasPorCanal | undefined): number {
  if (typeof marcas === 'number') return Math.max(0, marcas)
  if (marcas && typeof marcas === 'object') {
    const v = (marcas as any)[canalId]
    if (typeof v === 'number' && v >= 0) return v
    return 0
  }
  if (cacheMarcasPorCanal) {
    const v = (cacheMarcasPorCanal as any)[canalId]
    if (typeof v === 'number' && v >= 0) return v
  }
  return 0
}

/**
 * Cálculo neto por canal · FUNCIÓN CENTRAL ÚNICA del ERP.
 * Devuelve solo el neto total. Para desglosar componentes, ver calcDesglosePorCanal.
 */
export function calcNetoPorCanal(
  canalId: string,
  bruto: number,
  pedidos: number,
  opcsOrLegacyMarcas?: OpcionesCalcNeto | number | MarcasPorCanal,
  fechaDesdeLegacy?: Date,
  fechaHastaLegacy?: Date,
  configOverrideLegacy?: Record<string, CanalConfig>,
  promoSubvencionadaLegacy?: number,
): NetoResult {
  const desg = calcDesglosePorCanal(canalId, bruto, pedidos, opcsOrLegacyMarcas, fechaDesdeLegacy, fechaHastaLegacy, configOverrideLegacy, promoSubvencionadaLegacy)
  return { neto: desg.neto, margenPct: bruto > 0 ? (desg.neto / bruto) * 100 : 0 }
}

/**
 * Cálculo del desglose completo por canal.
 * Devuelve cada componente (comisión, fees, tasas) con IVA incluido.
 * Usado por Running para mostrar línea a línea el coste de cada plataforma.
 *
 * Misma firma que calcNetoPorCanal — usa fórmulas idénticas, solo expone los componentes.
 */
export function calcDesglosePorCanal(
  canalId: string,
  bruto: number,
  pedidos: number,
  opcsOrLegacyMarcas?: OpcionesCalcNeto | number | MarcasPorCanal,
  fechaDesdeLegacy?: Date,
  fechaHastaLegacy?: Date,
  configOverrideLegacy?: Record<string, CanalConfig>,
  promoSubvencionadaLegacy?: number,
): DesgloseCanal {
  // Normalizar argumentos
  let opciones: OpcionesCalcNeto
  if (opcsOrLegacyMarcas && typeof opcsOrLegacyMarcas === 'object' && !Array.isArray(opcsOrLegacyMarcas) && (
    'modo' in opcsOrLegacyMarcas || 'fechaDesde' in opcsOrLegacyMarcas || 'configCanales' in opcsOrLegacyMarcas
  )) {
    opciones = opcsOrLegacyMarcas as OpcionesCalcNeto
  } else {
    opciones = {
      modo: 'agregado_canal',
      marcasPorCanal: opcsOrLegacyMarcas as number | MarcasPorCanal | undefined,
      fechaDesde: fechaDesdeLegacy,
      fechaHasta: fechaHastaLegacy,
      configCanales: configOverrideLegacy,
      promoSubvencionada: promoSubvencionadaLegacy,
    }
  }

  const modo: ModoNeto = opciones.modo ?? 'agregado_canal'
  const config = opciones.configCanales ?? cacheConfig ?? {}
  const id = normalizarCanalId(canalId)
  const nombreCanal = MAP_ID_CANAL[id] ?? canalId
  const cfg = config[nombreCanal]

  const empty: DesgloseCanal = {
    bruto,
    comisionConIva: 0,
    feePromoConIva: 0,
    feePrimeConIva: 0,
    feePeriodicoConIva: 0,
    fijoPedidoConIva: 0,
    totalDescuentos: 0,
    neto: bruto,
  }

  if (!cfg) return empty
  if (bruto <= 0) return { ...empty, bruto: 0, neto: 0 }

  const promo = opciones.promoSubvencionada ?? 0
  const factorPromoIva = id === 'je' ? 1.21 : 1.0
  const baseCobrado = Math.max(0, bruto - promo * factorPromoIva)

  // Comisión variable
  const pctPrime = cfg.pct_pedidos_prime_estim
  const pctPromo = cfg.pct_pedidos_promo_estim
  let comisionVariable = 0
  if (modo === 'plato') {
    comisionVariable = cfg.comision_pct * baseCobrado
  } else if (cfg.comision_pct_prime != null && cfg.comision_pct_prime > 0) {
    const baseNormal = baseCobrado * (1 - pctPrime)
    const basePrime  = baseCobrado * pctPrime
    comisionVariable = cfg.comision_pct * baseNormal + cfg.comision_pct_prime * basePrime
  } else {
    comisionVariable = cfg.comision_pct * baseCobrado
  }

  // Fee fijo por pedido (JE 0,30€, Web 0,50€)
  const fijoTotal = cfg.fijo_eur * pedidos

  // Fees variables por pedido (Glovo Prime, Uber promo)
  let feePrimeTotal = 0
  let feePromoTotal = 0
  if (modo !== 'plato') {
    const nPrime = pedidos * pctPrime
    const nPromo = pedidos * pctPromo
    feePrimeTotal = cfg.fee_prime_eur * nPrime
    feePromoTotal = cfg.fee_promo_eur * nPromo
  }

  // Fee periódico PRORRATEADO por días reales del rango
  // (solo modo agregado_canal con fechas)
  let feePeriodoTotal = 0
  if (
    modo === 'agregado_canal' &&
    cfg.fee_periodo_eur > 0 &&
    opciones.fechaDesde &&
    opciones.fechaHasta
  ) {
    const periodosFraccionales = calcularPeriodosProrrateados(cfg.fee_periodicidad, opciones.fechaDesde, opciones.fechaHasta)
    const nMarcas = resolveMarcas(id, opciones.marcasPorCanal)
    feePeriodoTotal = cfg.fee_periodo_eur * periodosFraccionales * nMarcas
  }

  // Aplicar IVA 21% sobre cada componente
  const comisionConIva     = comisionVariable * (1 + IVA)
  const feePromoConIva     = feePromoTotal    * (1 + IVA)
  const feePrimeConIva     = feePrimeTotal    * (1 + IVA)
  const feePeriodicoConIva = feePeriodoTotal  * (1 + IVA)
  const fijoPedidoConIva   = fijoTotal        * (1 + IVA)

  const totalDescuentos = comisionConIva + feePromoConIva + feePrimeConIva + feePeriodicoConIva + fijoPedidoConIva
  const neto = Math.max(0, bruto - promo - totalDescuentos)

  return {
    bruto,
    comisionConIva,
    feePromoConIva,
    feePrimeConIva,
    feePeriodicoConIva,
    fijoPedidoConIva,
    totalDescuentos,
    neto,
  }
}

export function identificarPlataformaBancaria(concepto: string): string | null {
  const upper = concepto.toUpperCase()
  if (upper.includes('UBER') || upper.includes('PORTIER')) return 'uber'
  if (upper.includes('GLOVO') || upper.includes('GLOVOAPP')) return 'glovo'
  if (upper.includes('JUST EAT') || upper.includes('TAKEAWAY')) return 'just_eat'
  if (upper.includes('STRIPE') || upper.includes('REDSYS') || upper.includes('ADYEN')) return 'web'
  return null
}

export type EstadoValidacion = 'OK' | 'ALERTA' | 'ERROR'
export function calcEstadoValidacion(diferenciaAbsPct: number): EstadoValidacion {
  if (diferenciaAbsPct <= 1) return 'OK'
  if (diferenciaAbsPct <= 5) return 'ALERTA'
  return 'ERROR'
}
