/**
 * calcNetoPlataforma.ts · FUNCIÓN CENTRAL ÚNICA del ERP
 *
 * Fuente de verdad: config_canales + marca_plataforma_acceso (Supabase).
 * Documentación canónica: docs/LEY_NETO.md
 *
 * ⚖️ LEY-NETO-01 (real manda) + LEY-NETO-02 (autoaprendizaje).
 *
 * AUTOAPRENDIZAJE (LEY-NETO-02):
 *   Los porcentajes de comportamiento de cliente/plataforma NO se escriben a mano.
 *   La función de BD fn_recalibrar_calcneto() los recalcula solos cada vez que entra
 *   una liquidación real (trigger en uber_liquidaciones / glovo_liquidaciones), con
 *   ventana de 183 días y muestra mínima (>=120 pedidos o >=3 liquidaciones):
 *     · pct_pedidos_promo_estim        → % de pedidos que llevan promo (cargo de promo / fee unitario)
 *     · pct_pedidos_prime_estim        → % de pedidos de cliente prime (se despeja de la comisión efectiva)
 *     · pct_promo_subvencionada_estim  → % del bruto que nos comemos en promociones
 *     · pct_ads_estim                  → % del bruto que se va en publicidad de plataforma
 *   Historial de cada ajuste en la tabla calcneto_calibracion_log.
 *   PROHIBIDO hardcodear estos valores aquí.
 *
 * Fórmulas base (verificadas may 2026, ajustadas solas desde entonces):
 *
 *   UBER EATS
 *     Por pedido:  comisión = 30% (33% si Uber One) × precio
 *                  pedido con promo → +0,82€
 *     Periodo:     fee = 2,29€ × semanas × marcas activas Uber
 *   GLOVO
 *     Por pedido:  comisión = 30% × precio; cliente Prime → +0,74€
 *     Periodo:     fee = 10€ × quincenas × marcas activas Glovo
 *   JUST EAT
 *     comisión = 30% × (precio − GastosUsuario × 1,21) + 0,30€/pedido
 *   WEB PROPIA
 *     fee = 0,50€/pedido
 *   VENTA DIRECTA
 *     sin fees
 *   IVA 21% sobre comisiones y fees.
 *   Promociones subvencionadas y ads: se restan tal cual (ya vienen con su importe final).
 *
 * NOTA PRORRATEO (02 jun 2026):
 *   El fee periódico se prorratea por DÍAS CON DATOS REALES, no por días del rango.
 *
 * NOTA MARCAS ACTIVAS:
 *   El nº de marcas SIEMPRE sale de marca_plataforma_acceso WHERE activo=true.
 *
 * Funciones expuestas:
 *   - calcNetoPorCanal()      → neto total (fallback del resolver)
 *   - calcDesglosePorCanal()  → cada componente desglosado (Running)
 *   - loadConfigCanales()     → config desde Supabase (caché + realtime)
 *   - loadMarcasPorCanal()    → nº marcas por canal
 */

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const IVA = 0.21

export interface NetoResult { neto: number; margenPct: number }

/**
 * Desglose completo de los componentes que componen el neto de un canal.
 * Comisiones y fees llevan IVA 21%. Promo subvencionada y ads van a importe final.
 */
export interface DesgloseCanal {
  bruto: number                    // Lo pagado por el cliente
  comisionConIva: number           // Comisión variable (30/33% × bruto) + IVA 21%
  feePromoConIva: number           // Uber: 0,82€ × pedidos_promo + IVA
  feePrimeConIva: number           // Glovo: 0,74€ × pedidos_prime + IVA
  feePeriodicoConIva: number       // Uber: 2,29€ × semanas × marcas. Glovo: 10€ × quincenas × marcas
  fijoPedidoConIva: number         // JE: 0,30€/ped + IVA. Web: 0,50€/ped + IVA
  promoSubvencionada: number       // Descuentos que pagamos nosotros (autocalibrado)
  adsPlataforma: number            // Publicidad de plataforma (autocalibrado)
  totalDescuentos: number          // Suma de todo lo anterior (sin bruto)
  neto: number                     // bruto − totalDescuentos
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
  /** Autocalibrados por fn_recalibrar_calcneto (LEY-NETO-02) */
  pct_promo_subvencionada_estim: number
  pct_ads_estim: number
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
  /** Override explícito de promo subvencionada. Si no se pasa, se usa el % autocalibrado. */
  promoSubvencionada?: number
  configCanales?: Record<string, CanalConfig>
  /**
   * Nº de días con datos reales de facturación en el rango. Si se pasa,
   * el fee periódico se prorratea sobre estos días en vez de sobre los
   * días naturales del rango.
   */
  diasConDatos?: number
}

let cacheConfig: Record<string, CanalConfig> | null = null
let cacheMarcasPorCanal: MarcasPorCanal | null = null
let realtimeInit = false

/* ════════════════════════════════════════════════════════════════════════
 * REAL MANDA · liquidaciones reales (ventas_plataforma) + autoalimentación
 * ════════════════════════════════════════════════════════════════════════ */
const MIN_PEDIDOS_CALIBRACION = 120
const MIN_PERIODOS_CALIBRACION = 3

interface LiqRealCanal {
  canal: string; marca: string; ini: number; fin: number
  bruto: number; neto: number; pedidos: number
}
export interface RatioCanalReal {
  canal: string; ratio: number; brutoAcum: number; netoAcum: number
  pedidosAcum: number; periodos: number; fiable: boolean
}

let cacheLiqReal: LiqRealCanal[] | null = null
let cacheRatiosReales: Record<string, RatioCanalReal> | null = null

function normMarcaReal(m: string): string { return (m || '').toLowerCase().trim() }
function diaEpoch(d: Date): number { return Math.floor(d.getTime() / 86400000) }

export async function loadVentasRealesIndex(): Promise<LiqRealCanal[]> {
  if (cacheLiqReal) return cacheLiqReal
  const { data, error } = await supabase
    .from('ventas_plataforma')
    .select('plataforma, marca, fecha_inicio_periodo, fecha_fin_periodo, bruto, neto, pedidos')
  if (error || !data) { cacheLiqReal = []; cacheRatiosReales = null; return cacheLiqReal }
  const out: LiqRealCanal[] = []
  for (const row of data as any[]) {
    if (row.neto == null || row.bruto == null) continue
    if (!row.fecha_inicio_periodo || !row.fecha_fin_periodo) continue
    out.push({
      canal: normalizarCanalId(String(row.plataforma || '').toLowerCase().trim()),
      marca: normMarcaReal(row.marca),
      ini: diaEpoch(new Date(row.fecha_inicio_periodo + 'T00:00:00')),
      fin: diaEpoch(new Date(row.fecha_fin_periodo + 'T00:00:00')),
      bruto: Number(row.bruto) || 0,
      neto: Number(row.neto) || 0,
      pedidos: Number(row.pedidos) || 0,
    })
  }
  cacheLiqReal = out
  cacheRatiosReales = null
  return cacheLiqReal
}

export async function loadRatiosRealesCanal(): Promise<Record<string, RatioCanalReal>> {
  if (cacheRatiosReales) return cacheRatiosReales
  const liq = await loadVentasRealesIndex()
  // RECENCIA: solo liquidaciones de los ultimos 6 meses, ponderando mas lo reciente.
  const VENTANA_DIAS = 183
  const hoyEpoch = Math.floor(Date.now() / 86400000)
  const minEpoch = hoyEpoch - VENTANA_DIAS
  const acc: Record<string, { b: number; n: number; p: number; per: number; bw: number; nw: number }> = {}
  for (const l of liq) {
    if (l.fin < minEpoch) continue
    const w = 1 + Math.max(0, l.fin - minEpoch) / VENTANA_DIAS
    if (!acc[l.canal]) acc[l.canal] = { b: 0, n: 0, p: 0, per: 0, bw: 0, nw: 0 }
    acc[l.canal].b += l.bruto; acc[l.canal].n += l.neto
    acc[l.canal].p += l.pedidos; acc[l.canal].per += 1
    acc[l.canal].bw += l.bruto * w; acc[l.canal].nw += l.neto * w
  }
  const out: Record<string, RatioCanalReal> = {}
  for (const [canal, v] of Object.entries(acc)) {
    out[canal] = {
      canal, ratio: v.bw > 0 ? v.nw / v.bw : 0,
      brutoAcum: v.b, netoAcum: v.n, pedidosAcum: v.p, periodos: v.per,
      fiable: v.p >= MIN_PEDIDOS_CALIBRACION || v.per >= MIN_PERIODOS_CALIBRACION,
    }
  }
  cacheRatiosReales = out
  return out
}

/** Liquidaciones reales del canal cuyo periodo cae DENTRO de [desde,hasta]. */
function realesContenidas(canalId: string, desde?: Date, hasta?: Date, marca?: string): LiqRealCanal[] {
  if (!cacheLiqReal || !desde || !hasta) return []
  const dIni = diaEpoch(desde), dFin = diaEpoch(hasta)
  const c = normalizarCanalId((canalId || '').toLowerCase())
  const m = marca ? normMarcaReal(marca) : undefined
  return cacheLiqReal.filter(l => l.canal === c && l.ini >= dIni && l.fin <= dFin && (m ? l.marca === m : true))
}

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
  supabase
    .channel('ventas_plataforma_neto_changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'ventas_plataforma' },
      async () => {
        cacheLiqReal = null
        cacheRatiosReales = null
        await loadVentasRealesIndex()
        await loadRatiosRealesCanal()
        window.dispatchEvent(new CustomEvent('config_canales:changed'))
      }
    )
    .subscribe()
}

export async function loadConfigCanales(): Promise<Record<string, CanalConfig>> {
  ensureRealtime()
  // Prime índice de liquidaciones reales para que calcNetoPorCanal (síncrono) aplique REAL MANDA
  await Promise.all([loadVentasRealesIndex(), loadRatiosRealesCanal()])
  if (cacheConfig) return cacheConfig
  const { data, error } = await supabase
    .from('config_canales')
    .select('canal, comision_pct, comision_pct_prime, fijo_eur, fee_prime_eur, fee_promo_eur, fee_periodo_eur, fee_periodicidad, pct_pedidos_prime_estim, pct_pedidos_promo_estim, pct_promo_subvencionada_estim, pct_ads_estim')
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
      pct_promo_subvencionada_estim: Number(row.pct_promo_subvencionada_estim ?? 0),
      pct_ads_estim: Number(row.pct_ads_estim ?? 0),
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
  return cacheMarcasPorCanal
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
 * Devuelve el fee periódico PRORRATEADO.
 */
function calcularPeriodosProrrateados(
  periodicidad: string,
  fechaDesde: Date,
  fechaHasta: Date,
  diasConDatos?: number,
): number {
  const diasRango = Math.max(1, Math.round((fechaHasta.getTime() - fechaDesde.getTime()) / 86400000) + 1)
  const dias = (typeof diasConDatos === 'number' && diasConDatos > 0)
    ? Math.min(diasConDatos, diasRango)
    : diasRango
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
  let modo: ModoNeto = 'agregado_canal'
  let desde: Date | undefined = fechaDesdeLegacy
  let hasta: Date | undefined = fechaHastaLegacy
  let marca: string | undefined
  if (opcsOrLegacyMarcas && typeof opcsOrLegacyMarcas === 'object' && !Array.isArray(opcsOrLegacyMarcas) && (
    'modo' in opcsOrLegacyMarcas || 'fechaDesde' in opcsOrLegacyMarcas || 'configCanales' in opcsOrLegacyMarcas || 'diasConDatos' in opcsOrLegacyMarcas || 'marca' in (opcsOrLegacyMarcas as any)
  )) {
    const o = opcsOrLegacyMarcas as OpcionesCalcNeto & { marca?: string }
    modo = o.modo ?? 'agregado_canal'
    desde = o.fechaDesde ?? desde
    hasta = o.fechaHasta ?? hasta
    marca = o.marca
  }

  // REAL MANDA solo a nivel agregado de canal con periodo definido.
  if (modo === 'agregado_canal' && desde && hasta) {
    const reales = realesContenidas(canalId, desde, hasta, marca)
    const brutoReal = reales.reduce((s, l) => s + l.bruto, 0)
    if (brutoReal > 0) {
      const netoReal = reales.reduce((s, l) => s + l.neto, 0)
      const pedReal = reales.reduce((s, l) => s + l.pedidos, 0)
      const brutoResidual = Math.max(0, bruto - brutoReal)
      const pedResidual = Math.max(0, pedidos - pedReal)
      let netoResidual = 0
      if (brutoResidual > 0.005) {
        const c = normalizarCanalId((canalId || '').toLowerCase())
        const ratio = cacheRatiosReales?.[c]
        if (ratio && ratio.fiable && ratio.ratio > 0) {
          netoResidual = brutoResidual * ratio.ratio
        } else {
          netoResidual = calcDesglosePorCanal(canalId, brutoResidual, pedResidual, opcsOrLegacyMarcas, fechaDesdeLegacy, fechaHastaLegacy, configOverrideLegacy, promoSubvencionadaLegacy).neto
        }
      }
      const neto = netoReal + netoResidual
      return { neto, margenPct: bruto > 0 ? (neto / bruto) * 100 : 0 }
    }
    const c = normalizarCanalId((canalId || '').toLowerCase())
    const ratio = cacheRatiosReales?.[c]
    if (ratio && ratio.fiable && ratio.ratio > 0 && bruto > 0) {
      const neto = bruto * ratio.ratio
      return { neto, margenPct: (neto / bruto) * 100 }
    }
  }

  const desg = calcDesglosePorCanal(canalId, bruto, pedidos, opcsOrLegacyMarcas, fechaDesdeLegacy, fechaHastaLegacy, configOverrideLegacy, promoSubvencionadaLegacy)
  return { neto: desg.neto, margenPct: bruto > 0 ? (desg.neto / bruto) * 100 : 0 }
}

/**
 * Cálculo del desglose completo por canal.
 * Comisiones y fees con IVA. Promo subvencionada y ads a importe final.
 * Los % de promo / prime / promo subvencionada / ads salen SIEMPRE de config_canales,
 * que se autocalibra con cada liquidación real (LEY-NETO-02). Nunca se hardcodean.
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
  let opciones: OpcionesCalcNeto
  if (opcsOrLegacyMarcas && typeof opcsOrLegacyMarcas === 'object' && !Array.isArray(opcsOrLegacyMarcas) && (
    'modo' in opcsOrLegacyMarcas || 'fechaDesde' in opcsOrLegacyMarcas || 'configCanales' in opcsOrLegacyMarcas || 'diasConDatos' in opcsOrLegacyMarcas
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
    promoSubvencionada: 0,
    adsPlataforma: 0,
    totalDescuentos: 0,
    neto: bruto,
  }

  if (!cfg) return empty
  if (bruto <= 0) return { ...empty, bruto: 0, neto: 0 }

  /* ── Promo subvencionada: override explícito o % autocalibrado ── */
  const pctPromoSub = Number(cfg.pct_promo_subvencionada_estim ?? 0)
  const promo = opciones.promoSubvencionada != null
    ? opciones.promoSubvencionada
    : (modo === 'plato' ? 0 : bruto * pctPromoSub)

  const factorPromoIva = id === 'je' ? 1.21 : 1.0
  const baseCobrado = Math.max(0, bruto - promo * factorPromoIva)

  // Comisión variable (mezcla normal / prime con el % autocalibrado)
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

  // Fees variables por pedido (Glovo Prime, Uber promo) según % autocalibrados
  let feePrimeTotal = 0
  let feePromoTotal = 0
  if (modo !== 'plato') {
    const nPrime = pedidos * pctPrime
    const nPromo = pedidos * pctPromo
    feePrimeTotal = cfg.fee_prime_eur * nPrime
    feePromoTotal = cfg.fee_promo_eur * nPromo
  }

  // Fee periódico PRORRATEADO por días con datos reales
  let feePeriodoTotal = 0
  if (
    modo === 'agregado_canal' &&
    cfg.fee_periodo_eur > 0 &&
    opciones.fechaDesde &&
    opciones.fechaHasta
  ) {
    const periodosFraccionales = calcularPeriodosProrrateados(cfg.fee_periodicidad, opciones.fechaDesde, opciones.fechaHasta, opciones.diasConDatos)
    const nMarcas = resolveMarcas(id, opciones.marcasPorCanal)
    feePeriodoTotal = cfg.fee_periodo_eur * periodosFraccionales * nMarcas
  }

  // Publicidad de plataforma: % del bruto, autocalibrado. No aplica a economía de plato.
  const adsPlataforma = modo === 'plato' ? 0 : bruto * Number(cfg.pct_ads_estim ?? 0)

  // IVA 21% sobre comisiones y fees
  const comisionConIva     = comisionVariable * (1 + IVA)
  const feePromoConIva     = feePromoTotal    * (1 + IVA)
  const feePrimeConIva     = feePrimeTotal    * (1 + IVA)
  const feePeriodicoConIva = feePeriodoTotal  * (1 + IVA)
  const fijoPedidoConIva   = fijoTotal        * (1 + IVA)

  const totalDescuentos =
    comisionConIva + feePromoConIva + feePrimeConIva + feePeriodicoConIva +
    fijoPedidoConIva + promo + adsPlataforma
  const neto = Math.max(0, bruto - totalDescuentos)

  return {
    bruto,
    comisionConIva,
    feePromoConIva,
    feePrimeConIva,
    feePeriodicoConIva,
    fijoPedidoConIva,
    promoSubvencionada: promo,
    adsPlataforma,
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
