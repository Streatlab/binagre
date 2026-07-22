/**
 * useNominasCompletas — nóminas de un año, ensambladas con sus pagos de banco
 * asociados (tabla `nominas_pagos`, cruce nómina ↔ conciliacion) y clasificadas por
 * si el pago real cuadra con el neto de la nómina.
 *
 * Aislamiento: este módulo es 100% Binagre/Streat Lab. Usa únicamente el cliente
 * `supabase` de `@/lib/supabase` (proyecto eryauogxcpbgdryeimdq). No toca ninguna
 * tabla, credencial ni lógica del proyecto satélite de David.
 */
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export type Clasificacion = 'cuadra' | 'pagado_de_mas' | 'pagado_de_menos' | 'sin_pago'

export interface PagoAsociado {
  id: string
  conciliacion_id: string
  importe_asociado: number
  confirmado: boolean
  fecha: string
  concepto: string | null
}

export interface NominaCompleta {
  id: string
  empleado_id: string
  empleado_nombre: string
  mes: number
  anio: number
  importe_bruto: number | null
  importe_neto: number | null
  irpf_retenido: number | null
  ss_trabajador: number | null
  ss_empresa: number | null
  coste_empresa: number | null
  estado: string
  pdf_url: string | null
  pdf_storage_path: string | null
  origen_extraccion: string
  pagos: PagoAsociado[]
  totalPagado: number
  diferencia: number
  clasificacion: Clasificacion
}

// Tolerancia de cuadre (€) — mismo valor que usa el motor de cruce (api/_lib/matchNomina.ts).
const TOLERANCIA_CUADRE = 2

interface NominaRow {
  id: string
  empleado_id: string
  mes: number
  anio: number
  importe_bruto: number | null
  importe_neto: number | null
  irpf_retenido: number | null
  ss_trabajador: number | null
  ss_empresa: number | null
  coste_empresa: number | null
  estado: string | null
  pdf_url: string | null
  pdf_storage_path: string | null
  origen_extraccion: string | null
  empleados: { nombre: string } | { nombre: string }[] | null
}

interface PagoRow {
  id: string
  nomina_id: string
  conciliacion_id: string
  importe_asociado: number
  confirmado: boolean
  conciliacion: { fecha: string; concepto: string | null } | { fecha: string; concepto: string | null }[] | null
}

function nombreDeEmpleadoJoin(v: NominaRow['empleados']): string {
  if (!v) return ''
  if (Array.isArray(v)) return v[0]?.nombre ?? ''
  return v.nombre ?? ''
}

function conciliacionDeJoin(v: PagoRow['conciliacion']): { fecha: string; concepto: string | null } | null {
  if (!v) return null
  if (Array.isArray(v)) return v[0] ?? null
  return v
}

export function useNominasCompletas(anio: number): { loading: boolean; error: string | null; nominas: NominaCompleta[]; reload: () => void } {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nominas, setNominas] = useState<NominaCompleta[]>([])
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data: nominasData, error: errN } = await supabase
          .from('nominas')
          .select('id, empleado_id, mes, anio, importe_bruto, importe_neto, irpf_retenido, ss_trabajador, ss_empresa, coste_empresa, estado, pdf_url, pdf_storage_path, origen_extraccion, empleados(nombre)')
          .eq('anio', anio)
          .order('mes', { ascending: true })
        if (errN) throw errN
        const filasNominas = (nominasData ?? []) as unknown as NominaRow[]
        const nominaIds = filasNominas.map(n => n.id)

        const pagosPorNomina = new Map<string, PagoAsociado[]>()
        if (nominaIds.length > 0) {
          const { data: pagosData, error: errP } = await supabase
            .from('nominas_pagos')
            .select('id, nomina_id, conciliacion_id, importe_asociado, confirmado, conciliacion:conciliacion_id(fecha, concepto)')
            .in('nomina_id', nominaIds)
          if (errP) throw errP
          const filasPagos = (pagosData ?? []) as unknown as PagoRow[]
          for (const p of filasPagos) {
            const conc = conciliacionDeJoin(p.conciliacion)
            const pago: PagoAsociado = {
              id: p.id,
              conciliacion_id: p.conciliacion_id,
              importe_asociado: Number(p.importe_asociado),
              confirmado: Boolean(p.confirmado),
              fecha: conc?.fecha ?? '',
              concepto: conc?.concepto ?? null,
            }
            const lista = pagosPorNomina.get(p.nomina_id) ?? []
            lista.push(pago)
            pagosPorNomina.set(p.nomina_id, lista)
          }
        }

        const ensambladas: NominaCompleta[] = filasNominas.map(n => {
          const pagos = pagosPorNomina.get(n.id) ?? []
          // Criterio elegido: totalPagado solo suma pagos CONFIRMADOS. Una sugerencia
          // de cruce guardada con asociar-pago pero sin confirmar por el usuario no
          // debe hacer creer que la nómina ya está cobrada/cuadrada.
          const totalPagado = pagos.filter(p => p.confirmado).reduce((s, p) => s + p.importe_asociado, 0)
          const neto = n.importe_neto != null ? Number(n.importe_neto) : null
          const diferencia = neto != null ? totalPagado - neto : totalPagado

          let clasificacion: Clasificacion
          if (pagos.length === 0) clasificacion = 'sin_pago'
          else if (Math.abs(diferencia) <= TOLERANCIA_CUADRE) clasificacion = 'cuadra'
          else if (diferencia > TOLERANCIA_CUADRE) clasificacion = 'pagado_de_mas'
          else clasificacion = 'pagado_de_menos'

          return {
            id: n.id,
            empleado_id: n.empleado_id,
            empleado_nombre: nombreDeEmpleadoJoin(n.empleados),
            mes: n.mes,
            anio: n.anio,
            importe_bruto: n.importe_bruto != null ? Number(n.importe_bruto) : null,
            importe_neto: neto,
            irpf_retenido: n.irpf_retenido != null ? Number(n.irpf_retenido) : null,
            ss_trabajador: n.ss_trabajador != null ? Number(n.ss_trabajador) : null,
            ss_empresa: n.ss_empresa != null ? Number(n.ss_empresa) : null,
            coste_empresa: n.coste_empresa != null ? Number(n.coste_empresa) : null,
            estado: n.estado ?? '',
            pdf_url: n.pdf_url,
            pdf_storage_path: n.pdf_storage_path,
            origen_extraccion: n.origen_extraccion ?? '',
            pagos,
            totalPagado,
            diferencia,
            clasificacion,
          }
        })

        if (!cancelled) setNominas(ensambladas)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar nóminas')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [anio, tick])

  return { loading, error, nominas, reload }
}
