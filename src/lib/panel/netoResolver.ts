/**
 * netoResolver.ts · CAPA "REAL MANDA" sobre calcNetoPlataforma
 *
 * Regla única del ERP para el neto de plataforma:
 *   1) DATO REAL primero  → liquidaciones reales en `ventas_plataforma`
 *                           (bruto + neto reales por plataforma/marca/periodo).
 *   2) ESTIMADO si no hay  → fórmula central calcNetoPorCanal (config_canales).
 *
 * AUTOALIMENTACIÓN:
 *   Cada liquidación nueva que entra por Documentación → Ventas y aterriza en
 *   `ventas_plataforma` afina automáticamente:
 *     - El neto real de ese periodo/canal (manda sobre el estimado).
 *     - El ratio neto/bruto empírico por canal (`ratiosCalibrados`), que se usa
 *       para pulir el estimado de los tramos SIN dato real, una vez hay muestra
 *       suficiente. Con poca muestra NO se aplica (evita que 1 liquidación con
 *       promo subvencionada hunda todo el canal).
 *
 * Mismo patrón de caché + realtime que config_canales. Resolver SÍNCRONO:
 * los consumidores precargan el índice (loadVentasReales) y luego resuelven
 * dentro de su useMemo igual que ya hacían con calcNetoPorCanal.
 */

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  calcNetoPorCanal,
  type NetoResult,
  type OpcionesCalcNeto,
  type CanalConfig,
  type MarcasPorCanal,
} from '@/lib/panel/calcNetoPlataforma'

/* ── Config de calibración ──────────────────────────────────────────────── */
// Muestra mínima antes de fiarse del ratio empírico de un canal para el estimado.
const MIN_PEDIDOS_CALIBRACION = 120   // ~pedidos acumulados con liquidación real
const MIN_PERIODOS_CALIBRACION = 3    // ó al menos 3 liquidaciones del canal

/* ── Tipos ──────────────────────────────────────────────────────────────── */
export type FuenteNeto = 'real' | 'mixto' | 'estimado_calibrado' | 'estimado'

export interface NetoResuelto extends NetoResult {
  fuente: FuenteNeto
  brutoReal: number   // parte del bruto cubierta por liquidación real
  netoReal: number    // neto real de esa parte
  brutoEstimado: number
  netoEstimado: number
}

interface LiqReal {
  canal: string        // normalizado: uber|glovo|je|web|dir
  marca: string        // normalizada (lower, trim)
  ini: number          // epoch día inicio periodo
  fin: number          // epoch día fin periodo
  bruto: number
  neto: number
  pedidos: number
}

export interface RatioCanal {
  canal: string
  ratio: number        // neto/bruto empírico
  brutoAcum: number
  netoAcum: number
  pedidosAcum: number
  periodos: number
  fiable: boolean      // cumple muestra mínima
}

/* ── Normalización ──────────────────────────────────────────────────────── */
function normCanal(p: string): string {
  const v = (p || '').toLowerCase().trim()
  if (v === 'just_eat' || v === 'justeat' || v === 'just eat') return 'je'
  if (v === 'directa' || v === 'direct') return 'dir'
  return v
}
function normMarca(m: string): string {
  return (m || '').toLowerCase().trim()
}
function diaEpoch(d: Date): number {
  return Math.floor(d.getTime() / 86400000)
}

/* ── Caché + realtime ───────────────────────────────────────────────────── */
let cacheLiq: LiqReal[] | null = null
let cacheRatios: Record<string, RatioCanal> | null = null
let realtimeInit = false

function ensureRealtime() {
  if (realtimeInit) return
  realtimeInit = true
  supabase
    .channel('ventas_plataforma_changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'ventas_plataforma' },
      async () => {
        cacheLiq = null
        cacheRatios = null
        await loadVentasReales()
        window.dispatchEvent(new CustomEvent('ventas_plataforma:changed'))
        // calcNetoPlataforma escucha este evento para mantener coherencia visual
        window.dispatchEvent(new CustomEvent('config_canales:changed'))
      }
    )
    .subscribe()
}

export async function loadVentasReales(): Promise<LiqReal[]> {
  ensureRealtime()
  if (cacheLiq) return cacheLiq
  const { data, error } = await supabase
    .from('ventas_plataforma')
    .select('plataforma, marca, fecha_inicio_periodo, fecha_fin_periodo, bruto, neto, pedidos')
  if (error || !data) { cacheLiq = []; return cacheLiq }
  const out: LiqReal[] = []
  for (const row of data as any[]) {
    if (row.neto == null || row.bruto == null) continue
    if (!row.fecha_inicio_periodo || !row.fecha_fin_periodo) continue
    out.push({
      canal: normCanal(row.plataforma),
      marca: normMarca(row.marca),
      ini: diaEpoch(new Date(row.fecha_inicio_periodo + 'T00:00:00')),
      fin: diaEpoch(new Date(row.fecha_fin_periodo + 'T00:00:00')),
      bruto: Number(row.bruto) || 0,
      neto: Number(row.neto) || 0,
      pedidos: Number(row.pedidos) || 0,
    })
  }
  cacheLiq = out
  cacheRatios = null
  return cacheLiq
}

/** Ratio neto/bruto empírico acumulado por canal (autoalimentación). */
export async function loadRatiosCalibrados(): Promise<Record<string, RatioCanal>> {
  if (cacheRatios) return cacheRatios
  const liq = await loadVentasReales()
  const acc: Record<string, { b: number; n: number; p: number; per: number }> = {}
  for (const l of liq) {
    if (!acc[l.canal]) acc[l.canal] = { b: 0, n: 0, p: 0, per: 0 }
    acc[l.canal].b += l.bruto
    acc[l.canal].n += l.neto
    acc[l.canal].p += l.pedidos
    acc[l.canal].per += 1
  }
  const out: Record<string, RatioCanal> = {}
  for (const [canal, v] of Object.entries(acc)) {
    const fiable = v.p >= MIN_PEDIDOS_CALIBRACION || v.per >= MIN_PERIODOS_CALIBRACION
    out[canal] = {
      canal,
      ratio: v.b > 0 ? v.n / v.b : 0,
      brutoAcum: v.b, netoAcum: v.n, pedidosAcum: v.p, periodos: v.per,
      fiable,
    }
  }
  cacheRatios = out
  return out
}

export function invalidarCacheVentasReales() {
  cacheLiq = null
  cacheRatios = null
}

/* ── Hooks ──────────────────────────────────────────────────────────────── */
export function useVentasRealesListas(): boolean {
  const [listo, setListo] = useState(cacheLiq != null)
  useEffect(() => {
    let mounted = true
    loadVentasReales().then(() => { if (mounted) setListo(true) })
    loadRatiosCalibrados()
    const onChange = () => {
      invalidarCacheVentasReales()
      loadVentasReales().then(() => loadRatiosCalibrados()).then(() => { if (mounted) setListo(true) })
    }
    window.addEventListener('ventas_plataforma:changed', onChange)
    return () => { mounted = false; window.removeEventListener('ventas_plataforma:changed', onChange) }
  }, [])
  return listo
}

export function useRatiosCalibrados(): Record<string, RatioCanal> {
  const [ratios, setRatios] = useState<Record<string, RatioCanal>>(cacheRatios ?? {})
  useEffect(() => {
    let mounted = true
    loadRatiosCalibrados().then(r => { if (mounted) setRatios({ ...r }) })
    const onChange = () => { invalidarCacheVentasReales(); loadRatiosCalibrados().then(r => { if (mounted) setRatios({ ...r }) }) }
    window.addEventListener('ventas_plataforma:changed', onChange)
    return () => { mounted = false; window.removeEventListener('ventas_plataforma:changed', onChange) }
  }, [])
  return ratios
}

/* ── Extracción de periodo/marca desde args estilo calcNetoPorCanal ─────── */
function extraerOpts(
  opcsOrLegacyMarcas?: OpcionesCalcNeto | number | MarcasPorCanal,
  fechaDesdeLegacy?: Date,
  fechaHastaLegacy?: Date,
): { desde?: Date; hasta?: Date; marca?: string } {
  if (opcsOrLegacyMarcas && typeof opcsOrLegacyMarcas === 'object' && !Array.isArray(opcsOrLegacyMarcas) && (
    'modo' in opcsOrLegacyMarcas || 'fechaDesde' in opcsOrLegacyMarcas || 'configCanales' in opcsOrLegacyMarcas || 'diasConDatos' in opcsOrLegacyMarcas || 'marca' in (opcsOrLegacyMarcas as any)
  )) {
    const o = opcsOrLegacyMarcas as OpcionesCalcNeto & { marca?: string }
    return { desde: o.fechaDesde, hasta: o.fechaHasta, marca: o.marca ? normMarca(o.marca) : undefined }
  }
  return { desde: fechaDesdeLegacy, hasta: fechaHastaLegacy }
}

/** Liquidaciones reales del canal cuyo periodo cae DENTRO de [desde,hasta]. */
function realesContenidas(canal: string, desde?: Date, hasta?: Date, marca?: string): LiqReal[] {
  if (!cacheLiq || !desde || !hasta) return []
  const dIni = diaEpoch(desde)
  const dFin = diaEpoch(hasta)
  const c = normCanal(canal)
  return cacheLiq.filter(l =>
    l.canal === c &&
    l.ini >= dIni && l.fin <= dFin &&
    (marca ? l.marca === marca : true)
  )
}

/* ── RESOLVER PRINCIPAL ─────────────────────────────────────────────────── */
/**
 * Mismo contrato que calcNetoPorCanal, pero aplica REAL MANDA.
 * - Si hay liquidación real para canal(+marca) con periodo dentro del rango:
 *     neto = neto_real (de esa parte del bruto) + estimado del bruto residual.
 * - Si no hay real: estimado por fórmula (calibrado si hay muestra suficiente).
 */
export function resolverNetoCanal(
  canalId: string,
  bruto: number,
  pedidos: number,
  opcsOrLegacyMarcas?: OpcionesCalcNeto | number | MarcasPorCanal,
  fechaDesdeLegacy?: Date,
  fechaHastaLegacy?: Date,
  configOverrideLegacy?: Record<string, CanalConfig>,
  promoSubvencionadaLegacy?: number,
): NetoResuelto {
  const { desde, hasta, marca } = extraerOpts(opcsOrLegacyMarcas, fechaDesdeLegacy, fechaHastaLegacy)
  const reales = realesContenidas(canalId, desde, hasta, marca)

  const brutoReal = reales.reduce((s, l) => s + l.bruto, 0)
  const netoReal = reales.reduce((s, l) => s + l.neto, 0)

  // Bruto que el dato real NO cubre → se estima
  const brutoEstimado = Math.max(0, bruto - brutoReal)
  const pedReal = reales.reduce((s, l) => s + l.pedidos, 0)
  const pedEstimado = Math.max(0, pedidos - pedReal)

  let netoEstimado = 0
  let usadoCalibrado = false
  if (brutoEstimado > 0) {
    const c = normCanal(canalId)
    const ratio = cacheRatios?.[c]
    if (ratio && ratio.fiable && ratio.ratio > 0) {
      // Estimado afinado con histórico real del canal
      netoEstimado = brutoEstimado * ratio.ratio
      usadoCalibrado = true
    } else {
      netoEstimado = calcNetoPorCanal(
        canalId, brutoEstimado, pedEstimado,
        opcsOrLegacyMarcas, fechaDesdeLegacy, fechaHastaLegacy, configOverrideLegacy, promoSubvencionadaLegacy,
      ).neto
    }
  }

  const neto = netoReal + netoEstimado
  let fuente: FuenteNeto
  if (brutoReal > 0 && brutoEstimado <= 0.005) fuente = 'real'
  else if (brutoReal > 0) fuente = 'mixto'
  else if (usadoCalibrado) fuente = 'estimado_calibrado'
  else fuente = 'estimado'

  return {
    neto,
    margenPct: bruto > 0 ? (neto / bruto) * 100 : 0,
    fuente,
    brutoReal, netoReal, brutoEstimado, netoEstimado,
  }
}

/** Versión que solo devuelve {neto,margenPct} para swap directo de calcNetoPorCanal. */
export function resolverNeto(
  canalId: string,
  bruto: number,
  pedidos: number,
  opcsOrLegacyMarcas?: OpcionesCalcNeto | number | MarcasPorCanal,
  fechaDesdeLegacy?: Date,
  fechaHastaLegacy?: Date,
  configOverrideLegacy?: Record<string, CanalConfig>,
  promoSubvencionadaLegacy?: number,
): NetoResult {
  const r = resolverNetoCanal(canalId, bruto, pedidos, opcsOrLegacyMarcas, fechaDesdeLegacy, fechaHastaLegacy, configOverrideLegacy, promoSubvencionadaLegacy)
  return { neto: r.neto, margenPct: r.margenPct }
}
