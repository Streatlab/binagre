/**
 * useTesoreria13Semanas — previsión de caja semana a semana, 13 semanas
 * hacia delante desde el próximo lunes.
 *
 * Fuentes:
 *  - configuracion (clave='saldo_banco_actual')  → saldo inicial
 *  - facturacion_diario (90 días)                → ventas previstas por canal
 *  - gastos_fijos (activo=true)                  → salidas fijas normalizadas a semanal
 *  - conciliacion (tipo='gasto', 90 días)         → gasto operativo semanal estimado
 *  - nominas (últimos meses por empleado)         → salida de nóminas normalizada a semanal
 *  - seguridad_social_resumen (últimos meses)     → salida de SS normalizada a semanal
 *
 * Nóminas y SS son salidas reales que antes NO estaban modeladas aquí (solo
 * `gastos_fijos`, que no las incluye para no duplicar con esta fuente más
 * precisa). Mientras esas tablas estén vacías, su aportación es 0 — no se
 * inventa un importe, se ve reflejado en cuanto Rubén suba la primera nómina
 * o el primer resumen de SS.
 *
 * Todo el cálculo vive aquí; la página solo pinta.
 */
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCajaAutomatica } from './cajaExtracto'
import { fmtDate } from '@/lib/format'

/* ────────────────────────────────────────────────────────────
   Constantes de negocio (documentadas aquí, no mágicas en el código)
   ──────────────────────────────────────────────────────────── */
export const N_SEMANAS = 13

/** Semáforo sobre el saldo acumulado de cada semana. */
export const UMBRAL_VERDE = 3000 // >= este importe → verde
export const UMBRAL_ROJO = 0     // < este importe → rojo (el resto, ámbar)

/** Semanas históricas completas usadas para promediar ventas y gasto operativo. */
const SEMANAS_HISTORICO = 8
/** Ventana de datos históricos que se consulta a Supabase. */
const DIAS_HISTORICO = 90

/** Semanas-equivalentes por periodicidad al normalizar gastos_fijos a importe semanal. */
const SEMANAS_POR_PERIODO: Record<string, number> = {
  semanal: 1,
  quincenal: 2,
  mensual: 52 / 12,       // 4,3333…
  trimestral: 52 / 4,     // 13
  anual: 52,
}
/** Periodicidad usada cuando el valor de BD no es una de las reconocidas arriba. */
const PERIODICIDAD_FALLBACK = 'mensual'

export type Estado = 'verde' | 'ambar' | 'rojo'

export interface SemanaTesoreria {
  index: number
  semana: string // 'Sem N · DD/MM–DD/MM'
  inicio: string // ISO yyyy-mm-dd
  fin: string    // ISO yyyy-mm-dd
  entradas: number
  salidas: number
  saldoSemana: number
  saldoAcumulado: number
  estado: Estado
}

export interface Tesoreria13SemanasResult {
  loading: boolean
  error: string | null
  saldoInicial: number
  saldoInicialFuente: 'extracto' | 'manual' | 'sin_datos'
  semanas: SemanaTesoreria[]
  semanaCritica: SemanaTesoreria | null
  saldoMinimo: number
  gastosFijosCount: number
  gastoFijoSemanal: number
  gastoOperativoSemanal: number
  nominaSemanal: number
  segSocialSemanal: number
  nominasCount: number
  segSocialCount: number
}

/** Semanas-equivalentes por mes (52/12 semanas ≈ 4,333), usado para normalizar
 *  importes mensuales de nóminas/SS a una salida semanal, igual criterio que
 *  `SEMANAS_POR_PERIODO.mensual` de gastos_fijos. */
const SEMANAS_POR_MES = 52 / 12

/* ────────────────────────────────────────────────────────────
   Helpers de fecha (sin dependencias externas)
   ──────────────────────────────────────────────────────────── */
function toLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function parseLocal(s: string): Date {
  return new Date(s.slice(0, 10) + 'T12:00:00')
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}
/** Índice de día de semana con Lunes=0 … Domingo=6 (JS nativo trae Domingo=0). */
function dowIndex(d: Date): number {
  return (d.getDay() + 6) % 7
}
/** Lunes de la semana que contiene `d`. */
function mondayOf(d: Date): Date {
  const r = new Date(d)
  r.setHours(12, 0, 0, 0)
  r.setDate(r.getDate() - dowIndex(r))
  return r
}
/**
 * Próximo lunes desde `hoy`: si hoy ya es lunes, es el lunes de esta misma
 * semana (arranca la previsión "ya"); si no, el lunes de la semana siguiente.
 */
function proximoLunes(hoy: Date): Date {
  const r = new Date(hoy)
  r.setHours(12, 0, 0, 0)
  const dow = dowIndex(r) // 0=lunes … 6=domingo
  if (dow === 0) return r
  return addDays(r, 7 - dow)
}

type Canal = 'uber' | 'glovo' | 'je' | 'web' | 'directa'
const CANALES: Canal[] = ['uber', 'glovo', 'je', 'web', 'directa']

/* ────────────────────────────────────────────────────────────
   Desfase de cobro por plataforma (simplificado, sin réplica de
   festivos — documentado explícitamente aquí).
   ──────────────────────────────────────────────────────────── */

/** Uber Eats: liquida ~7 días después de generarse la venta. */
function pagoUber(fechaVenta: Date): Date {
  return addDays(fechaVenta, 7)
}

/**
 * Glovo y Just Eat: dos liquidaciones mensuales (día 5 y día 20), cada una
 * cubre la quincena inmediatamente anterior a la fecha de pago:
 *  - venta en días 1–15  → se cobra el día 20 de ese mismo mes
 *  - venta en días 16–fin → se cobra el día 5 del mes siguiente
 */
function pagoQuincenal(fechaVenta: Date): Date {
  const y = fechaVenta.getFullYear()
  const m = fechaVenta.getMonth()
  const day = fechaVenta.getDate()
  if (day <= 15) return new Date(y, m, 20, 12)
  return new Date(y, m + 1, 5, 12)
}

/** Web y Directa: caja inmediata, sin desfase de plataforma. */
function pagoInmediato(fechaVenta: Date): Date {
  return fechaVenta
}

function fechaPago(canal: Canal, fechaVenta: Date): Date {
  if (canal === 'uber') return pagoUber(fechaVenta)
  if (canal === 'glovo' || canal === 'je') return pagoQuincenal(fechaVenta)
  return pagoInmediato(fechaVenta)
}

function estadoDe(saldoAcumulado: number): Estado {
  if (saldoAcumulado < UMBRAL_ROJO) return 'rojo'
  if (saldoAcumulado < UMBRAL_VERDE) return 'ambar'
  return 'verde'
}

/* ────────────────────────────────────────────────────────────
   Filas de Supabase
   ──────────────────────────────────────────────────────────── */
interface FacturacionRow {
  fecha: string
  uber_bruto: number | null
  glovo_bruto: number | null
  je_bruto: number | null
  web_bruto: number | null
  directa_bruto: number | null
}
interface GastoFijoRow {
  concepto: string
  importe: number | null
  periodicidad: string | null
  activo: boolean
}
interface ConciliacionGastoRow {
  fecha: string
  importe: number | null
  tipo: string
}
interface NominaRow {
  empleado_id: string
  mes: number
  anio: number
  importe_bruto: number | null
  ss_empresa: number | null
  coste_empresa: number | null
}
interface SegSocialRow {
  mes: number
  anio: number
  importe: number | null
}

export function useTesoreria13Semanas(): Tesoreria13SemanasResult {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [saldoInicial, setSaldoInicial] = useState(0)
  const [saldoInicialFuente, setSaldoInicialFuente] = useState<'extracto' | 'manual' | 'sin_datos'>('sin_datos')
  const [facturacion, setFacturacion] = useState<FacturacionRow[]>([])
  const [gastosFijos, setGastosFijos] = useState<GastoFijoRow[]>([])
  const [gastosConciliacion, setGastosConciliacion] = useState<ConciliacionGastoRow[]>([])
  const [nominas, setNominas] = useState<NominaRow[]>([])
  const [segSocial, setSegSocial] = useState<SegSocialRow[]>([])

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      setLoading(true)
      setError(null)
      try {
        const hoy = new Date()
        const desdeHistorico = toLocal(addDays(hoy, -DIAS_HISTORICO))

        const [cajaAuto, facRes, gfRes, concRes, nomRes, segRes] = await Promise.all([
          // Saldo inicial: último saldo real del extracto bancario (ver cajaExtracto.ts),
          // con respaldo a la clave manual configuracion.saldo_banco_actual si no hay extracto.
          getCajaAutomatica(),
          supabase
            .from('facturacion_diario')
            .select('fecha,uber_bruto,glovo_bruto,je_bruto,web_bruto,directa_bruto')
            .gte('fecha', desdeHistorico)
            .order('fecha'),
          supabase.from('gastos_fijos').select('concepto,importe,periodicidad,activo').eq('activo', true),
          supabase
            .from('conciliacion')
            .select('fecha,importe,tipo')
            .eq('tipo', 'gasto')
            .gte('fecha', desdeHistorico),
          // Nóminas: salida real por empleado (bruto + SS empresa), ver módulo Equipo → Nóminas.
          supabase.from('nominas').select('empleado_id,mes,anio,importe_bruto,ss_empresa,coste_empresa').order('anio', { ascending: false }).order('mes', { ascending: false }),
          // Resumen mensual de Seguridad Social, ver módulo Equipo → Seguridad Social.
          supabase.from('seguridad_social_resumen').select('mes,anio,importe').order('anio', { ascending: false }).order('mes', { ascending: false }).limit(6),
        ])

        if (cancelado) return

        if (facRes.error) throw facRes.error
        if (gfRes.error) throw gfRes.error
        if (concRes.error) throw concRes.error
        if (nomRes.error) throw nomRes.error
        if (segRes.error) throw segRes.error

        setSaldoInicial(cajaAuto.caja)
        setSaldoInicialFuente(cajaAuto.origen)

        setFacturacion((facRes.data ?? []) as FacturacionRow[])
        setGastosFijos((gfRes.data ?? []) as GastoFijoRow[])
        setGastosConciliacion((concRes.data ?? []) as ConciliacionGastoRow[])
        setNominas((nomRes.data ?? []) as NominaRow[])
        setSegSocial((segRes.data ?? []) as SegSocialRow[])
      } catch (e) {
        if (!cancelado) setError(e instanceof Error ? e.message : 'Error cargando tesorería')
      } finally {
        if (!cancelado) setLoading(false)
      }
    }
    cargar()
    return () => { cancelado = true }
  }, [])

  const gastoFijoSemanal = useMemo(() => {
    let total = 0
    for (const g of gastosFijos) {
      const importe = Number(g.importe) || 0
      if (importe <= 0) continue
      const periodicidad = (g.periodicidad || '').toLowerCase().trim()
      const semanasPeriodo = SEMANAS_POR_PERIODO[periodicidad] ?? SEMANAS_POR_PERIODO[PERIODICIDAD_FALLBACK]
      total += importe / semanasPeriodo
    }
    return total
  }, [gastosFijos])

  const gastoOperativoSemanal = useMemo(() => {
    const hoy = new Date()
    const inicioSemanaActual = mondayOf(hoy)
    const inicioVentana = addDays(inicioSemanaActual, -SEMANAS_HISTORICO * 7)

    // Agrupa por lunes de la semana ISO a la que pertenece cada movimiento.
    const porSemana = new Map<string, number>()
    for (const r of gastosConciliacion) {
      const f = parseLocal(r.fecha)
      if (f < inicioVentana || f >= inicioSemanaActual) continue // solo semanas completas y pasadas
      const key = toLocal(mondayOf(f))
      porSemana.set(key, (porSemana.get(key) ?? 0) + (Number(r.importe) || 0))
    }
    if (porSemana.size === 0) return 0
    const total = [...porSemana.values()].reduce((s, v) => s + v, 0)
    return total / porSemana.size
  }, [gastosConciliacion])

  // Salida semanal de nóminas: por cada empleado activo en la tabla, coste
  // mensual = coste_empresa si se leyó (bruto+SS empresa), si no bruto+ss_empresa
  // sumados manualmente, si no solo bruto (mejor una estimación parcial real que
  // omitir la salida por completo). Se usa la nómina MÁS RECIENTE de cada
  // empleado como estimación del mes siguiente (no se promedia con meses muy
  // antiguos, que pueden no reflejar bajas/altas recientes).
  const nominaSemanal = useMemo(() => {
    const masRecientePorEmpleado = new Map<string, NominaRow>()
    for (const n of nominas) {
      const actual = masRecientePorEmpleado.get(n.empleado_id)
      if (!actual || n.anio > actual.anio || (n.anio === actual.anio && n.mes > actual.mes)) {
        masRecientePorEmpleado.set(n.empleado_id, n)
      }
    }
    let totalMensual = 0
    for (const n of masRecientePorEmpleado.values()) {
      const bruto = Number(n.importe_bruto) || 0
      const ssEmpresa = Number(n.ss_empresa) || 0
      const coste = n.coste_empresa != null ? Number(n.coste_empresa) : bruto + ssEmpresa
      totalMensual += coste
    }
    return totalMensual / SEMANAS_POR_MES
  }, [nominas])

  // Salida semanal de Seguridad Social: promedio de los últimos importes
  // conocidos del resumen mensual (hasta 3), normalizado a semanal.
  const segSocialSemanal = useMemo(() => {
    const importes = segSocial.map(s => Number(s.importe) || 0).filter(v => v > 0).slice(0, 3)
    if (importes.length === 0) return 0
    const media = importes.reduce((s, v) => s + v, 0) / importes.length
    return media / SEMANAS_POR_MES
  }, [segSocial])

  const promedioVentasPorDia = useMemo(() => {
    // promedio[diaSemana][canal] con diaSemana Lunes=0…Domingo=6
    const sumas: Record<Canal, number>[] = Array.from({ length: 7 }, () => ({ uber: 0, glovo: 0, je: 0, web: 0, directa: 0 }))
    const counts = Array(7).fill(0)

    const hoy = new Date()
    const inicioSemanaActual = mondayOf(hoy)
    const inicioVentana = addDays(inicioSemanaActual, -SEMANAS_HISTORICO * 7)

    for (const r of facturacion) {
      const f = parseLocal(r.fecha)
      if (f < inicioVentana || f >= inicioSemanaActual) continue
      const dow = dowIndex(f)
      sumas[dow].uber += Number(r.uber_bruto) || 0
      sumas[dow].glovo += Number(r.glovo_bruto) || 0
      sumas[dow].je += Number(r.je_bruto) || 0
      sumas[dow].web += Number(r.web_bruto) || 0
      sumas[dow].directa += Number(r.directa_bruto) || 0
      counts[dow] += 1
    }

    return sumas.map((s, i) => {
      const n = counts[i] || 0
      if (n === 0) return { uber: 0, glovo: 0, je: 0, web: 0, directa: 0 }
      return { uber: s.uber / n, glovo: s.glovo / n, je: s.je / n, web: s.web / n, directa: s.directa / n }
    })
  }, [facturacion])

  const semanas = useMemo<SemanaTesoreria[]>(() => {
    const hoy = new Date()
    const inicio = proximoLunes(hoy)

    const base: Omit<SemanaTesoreria, 'saldoAcumulado' | 'estado'>[] = Array.from({ length: N_SEMANAS }, (_, i) => {
      const ini = addDays(inicio, i * 7)
      const fin = addDays(ini, 6)
      return {
        index: i,
        semana: `Sem ${i + 1} · ${fmtDate(ini).slice(0, 5)}–${fmtDate(fin).slice(0, 5)}`,
        inicio: toLocal(ini),
        fin: toLocal(fin),
        entradas: 0,
        salidas: gastoFijoSemanal + gastoOperativoSemanal + nominaSemanal + segSocialSemanal,
        saldoSemana: 0,
      }
    })

    // Reparte cada "venta prevista" (día × canal) en la semana en la que
    // realmente entra el dinero, según el desfase de cobro de su plataforma.
    // Nota: solo se proyectan ventas futuras (desde el próximo lunes); no
    // incluye cobros pendientes de ventas reales ya generadas antes del
    // inicio de la previsión.
    for (let dia = 0; dia < N_SEMANAS * 7; dia++) {
      const fechaVenta = addDays(inicio, dia)
      const prom = promedioVentasPorDia[dowIndex(fechaVenta)]
      for (const canal of CANALES) {
        const importe = prom[canal]
        if (importe <= 0) continue
        const pago = fechaPago(canal, fechaVenta)
        const idxSemana = Math.floor((pago.getTime() - inicio.getTime()) / (7 * 86400000))
        if (idxSemana >= 0 && idxSemana < N_SEMANAS) {
          base[idxSemana].entradas += importe
        }
      }
    }

    let acumulado = saldoInicial
    return base.map(s => {
      const saldoSemana = s.entradas - s.salidas
      acumulado += saldoSemana
      return { ...s, saldoSemana, saldoAcumulado: acumulado, estado: estadoDe(acumulado) }
    })
  }, [promedioVentasPorDia, gastoFijoSemanal, gastoOperativoSemanal, nominaSemanal, segSocialSemanal, saldoInicial])

  const semanaCritica = useMemo(() => {
    if (semanas.length === 0) return null
    return semanas.reduce((min, s) => (s.saldoAcumulado < min.saldoAcumulado ? s : min), semanas[0])
  }, [semanas])

  const saldoMinimo = semanaCritica ? semanaCritica.saldoAcumulado : saldoInicial

  return {
    loading,
    error,
    saldoInicial,
    saldoInicialFuente,
    semanas,
    semanaCritica,
    saldoMinimo,
    gastosFijosCount: gastosFijos.length,
    gastoFijoSemanal,
    gastoOperativoSemanal,
    nominaSemanal,
    segSocialSemanal,
    nominasCount: nominas.length,
    segSocialCount: segSocial.length,
  }
}
