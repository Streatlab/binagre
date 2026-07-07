/**
 * useFondoManiobra — Fondo de Maniobra (FM) y NOF (Necesidades Operativas de Fondos).
 *
 * FM = Activo corriente − Pasivo corriente
 *   Activo corriente  = caja (automática desde el último saldo del extracto bancario,
 *                        ver `cajaExtracto.ts`; respaldo: configuracion.saldo_banco_actual)
 *                        + cobros pendientes de plataformas (ventas_plataforma sin fecha_pago)
 *   Pasivo corriente   = facturas de proveedor vivas sin conciliar (últimos 60 días,
 *                        ver `pasivoFacturas.ts`), no todo el histórico sin procesar
 *
 * NOF = versión operativa sin caja: cobros pendientes − pasivo corriente.
 *
 * Además calcula una alerta de "mes de riesgo": primer mes proyectado (próximos 6 meses)
 * en que las ventas crecen respecto al mes anterior pero la caja proyectada es negativa.
 *
 * Aislamiento: este módulo es 100% Binagre/Streat Lab. Usa únicamente el cliente
 * `supabase` de `@/lib/supabase` (proyecto eryauogxcpbgdryeimdq). No toca ninguna
 * tabla, credencial ni lógica del proyecto satélite de David.
 */
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getCajaAutomatica } from './cajaExtracto'
import { getPasivoFacturasVivas } from './pasivoFacturas'

/* ── Tipos ────────────────────────────────────────── */

export interface DeudaCuota {
  fecha: string
  importe: number
  categoria: string
}

export interface MesRiesgo {
  mes: string // "YYYY-MM"
  ventasMes: number
  ventasMesAnterior: number
  cajaProyectada: number
}

export interface FondoManiobraData {
  loading: boolean
  error: string | null

  // Activo corriente
  caja: number
  cajaOrigen: 'extracto' | 'manual' | 'sin_datos'
  cobrosPendientes: number
  cobrosPendientesCount: number
  activoCorriente: number

  // Pasivo corriente (proxy)
  pasivoCorrienteFacturas: number
  pasivoCorrienteFacturasCount: number

  // Resultado
  fondoManiobra: number
  nof: number

  // Deuda financiera (referencia, no forma parte del pasivo corriente)
  deudaCuotasUltimos12Meses: number
  deudaCuotas: DeudaCuota[]

  // Alerta de mes de riesgo
  mesRiesgo: MesRiesgo | null
  flujoNetoMedioMensual: number
}

// Categorías de categorias_pyg, bloque='PASIVO' (Préstamo Ben Menjat / Préstamo ING).
const CATEGORIAS_DEUDA = ['4', '4.2', '4.2.1', '4.2.2']

function mesKey(fechaISO: string): string {
  return fechaISO.slice(0, 7) // "YYYY-MM"
}

function addMonths(base: Date, n: number): Date {
  return new Date(base.getFullYear(), base.getMonth() + n, 1)
}

function toMesKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function useFondoManiobra(): FondoManiobraData & { refetch: () => void } {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [caja, setCaja] = useState(0)
  const [cajaOrigen, setCajaOrigen] = useState<'extracto' | 'manual' | 'sin_datos'>('sin_datos')
  const [cobrosPendientes, setCobrosPendientes] = useState(0)
  const [cobrosPendientesCount, setCobrosPendientesCount] = useState(0)
  const [pasivoCorrienteFacturas, setPasivoCorrienteFacturas] = useState(0)
  const [pasivoCorrienteFacturasCount, setPasivoCorrienteFacturasCount] = useState(0)
  const [deudaCuotas, setDeudaCuotas] = useState<DeudaCuota[]>([])
  const [mesRiesgo, setMesRiesgo] = useState<MesRiesgo | null>(null)
  const [flujoNetoMedioMensual, setFlujoNetoMedioMensual] = useState(0)
  const [tick, setTick] = useState(0)

  const refetch = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const hoy = new Date()
        const hace6meses = new Date(hoy.getFullYear(), hoy.getMonth() - 6, 1).toISOString().slice(0, 10)

        const [cajaAuto, ventasRes, pasivoVivo, deudaRes, facturacionDiarioRes, conciliacionRes] = await Promise.all([
          // 1. Caja: último saldo real del extracto bancario por titular (con respaldo
          // a la clave manual configuracion.saldo_banco_actual si no hay extracto).
          getCajaAutomatica(),
          // 2. Cobros pendientes de plataformas
          supabase.from('ventas_plataforma').select('neto,fecha_pago,plataforma,marca,fecha_fin_periodo').is('fecha_pago', null),
          // 3. Pasivo corriente: solo facturas de proveedor sin conciliar y realmente
          // vivas (últimos 60 días, no duplicadas ni marcadas no-conciliables).
          getPasivoFacturasVivas(),
          // 4. Deuda financiera (referencia informativa, no forma parte del FM/NOF)
          supabase.from('conciliacion').select('fecha,importe,categoria').eq('tipo', 'gasto').in('categoria', CATEGORIAS_DEUDA).order('fecha', { ascending: false }).limit(24),
          // 5. Ventas para detectar meses crecientes (últimos 6 meses)
          supabase.from('facturacion_diario').select('fecha,total_bruto').gte('fecha', hace6meses).order('fecha', { ascending: true }),
          // 6. Flujo neto (ingreso/gasto) últimos 6 meses para proyectar caja
          supabase.from('conciliacion').select('fecha,importe,tipo').gte('fecha', hace6meses),
        ])

        if (cancelled) return

        // ── 1. Caja (automática desde extracto) ──
        setCaja(cajaAuto.caja)
        setCajaOrigen(cajaAuto.origen)

        // ── 2. Cobros pendientes de plataformas ──
        const ventasRows = (ventasRes.data ?? []) as { neto: number | null }[]
        const sumaCobrosPendientes = ventasRows.reduce((s, r) => s + Number(r.neto ?? 0), 0)
        setCobrosPendientes(sumaCobrosPendientes)
        setCobrosPendientesCount(ventasRows.length)

        // ── 3. Pasivo corriente (facturas vivas, no todo el histórico sin procesar) ──
        setPasivoCorrienteFacturas(pasivoVivo.total)
        setPasivoCorrienteFacturasCount(pasivoVivo.count)

        // ── 4. Deuda financiera (referencia) ──
        // TODO fuente de datos: no hay tabla de saldo vivo de deuda en BD; solo se
        // muestran las cuotas pagadas (conciliacion, categorías de préstamo) como
        // referencia informativa, sin saldo pendiente total.
        const deudaRows = (deudaRes.data ?? []) as DeudaCuota[]
        setDeudaCuotas(deudaRows)

        // ── 5 y 6. Mes de riesgo proyectado ──
        // Ventas mensuales (últimos 6 meses reales)
        const ventasMensuales = new Map<string, number>()
        for (const r of (facturacionDiarioRes.data ?? []) as { fecha: string; total_bruto: number | null }[]) {
          const k = mesKey(r.fecha)
          ventasMensuales.set(k, (ventasMensuales.get(k) ?? 0) + Number(r.total_bruto ?? 0))
        }

        // Flujo neto mensual (ingreso - gasto) últimos 6 meses reales
        const flujoMensual = new Map<string, number>()
        for (const r of (conciliacionRes.data ?? []) as { fecha: string; importe: number | null; tipo: string }[]) {
          const k = mesKey(r.fecha)
          const signo = r.tipo === 'ingreso' ? 1 : r.tipo === 'gasto' ? -1 : 0
          flujoMensual.set(k, (flujoMensual.get(k) ?? 0) + signo * Number(r.importe ?? 0))
        }

        // Flujo neto medio de los últimos 3 meses con datos
        const mesesFlujoOrdenados = Array.from(flujoMensual.keys()).sort()
        const ultimos3 = mesesFlujoOrdenados.slice(-3)
        const flujoMedio = ultimos3.length > 0
          ? ultimos3.reduce((s, k) => s + (flujoMensual.get(k) ?? 0), 0) / ultimos3.length
          : 0
        setFlujoNetoMedioMensual(flujoMedio)

        // Ventas del último mes real conocido, para comparar contra el primer mes proyectado
        const mesesVentasOrdenados = Array.from(ventasMensuales.keys()).sort()
        const ventasMesAnteriorProyeccion = mesesVentasOrdenados.length > 0
          ? ventasMensuales.get(mesesVentasOrdenados[mesesVentasOrdenados.length - 1]) ?? 0
          : 0

        // Proyección de caja para los próximos 6 meses: caja + flujoNetoMedio*n
        let riesgoDetectado: MesRiesgo | null = null
        // Sin serie de proyección de ventas propia en BD: usamos la última venta mensual
        // real conocida como estimación plana de "ventas del mes" para todos los meses
        // proyectados (no inventamos crecimiento no soportado por datos). Con una
        // estimación plana, "ventas crecientes" solo puede darse si comparamos contra
        // un mes anterior con ventas reales menores — se deja la lógica genérica por si
        // en el futuro se conecta una proyección de ventas real por mes.
        let ventasProyeccionAnterior = ventasMesAnteriorProyeccion
        for (let n = 1; n <= 6; n++) {
          const fechaProyeccion = addMonths(hoy, n)
          const k = toMesKey(fechaProyeccion)
          const cajaProyectada = caja + flujoMedio * n
          const ventasMesProyectado = ventasMesAnteriorProyeccion
          const ventasCrecen = ventasMesProyectado > ventasProyeccionAnterior
          if (ventasCrecen && cajaProyectada < 0) {
            riesgoDetectado = {
              mes: k,
              ventasMes: ventasMesProyectado,
              ventasMesAnterior: ventasProyeccionAnterior,
              cajaProyectada,
            }
            break
          }
          ventasProyeccionAnterior = ventasMesProyectado
        }
        setMesRiesgo(riesgoDetectado)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar Fondo de Maniobra')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [tick])

  const activoCorriente = caja + cobrosPendientes
  const fondoManiobra = activoCorriente - pasivoCorrienteFacturas
  // NOF (versión operativa, sin caja): cobros pendientes − pasivo corriente.
  // TODO fuente de datos: no se incluye valoración de inventario/stock en el cálculo de
  // NOF porque no existe una tabla de valoración de existencias disponible en Supabase.
  const nof = cobrosPendientes - pasivoCorrienteFacturas
  const deudaCuotasUltimos12Meses = deudaCuotas.reduce((s, r) => s + Number(r.importe ?? 0), 0)

  return {
    loading, error,
    caja, cajaOrigen,
    cobrosPendientes, cobrosPendientesCount,
    activoCorriente,
    pasivoCorrienteFacturas, pasivoCorrienteFacturasCount,
    fondoManiobra, nof,
    deudaCuotasUltimos12Meses, deudaCuotas,
    mesRiesgo, flujoNetoMedioMensual,
    refetch,
  }
}
