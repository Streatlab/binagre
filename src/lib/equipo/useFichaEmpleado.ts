/**
 * useFichaEmpleado — acumulados anuales de un empleado (bruto, neto realmente
 * pagado según banco, IRPF a reservar para Hacienda, SS empresa y coste real).
 *
 * Consulta propia (no reutiliza useNominasCompletas): filtra directamente por
 * empleado_id + año, más simple que filtrar en cliente un listado ya cargado de
 * todos los empleados.
 *
 * Aislamiento: este módulo es 100% Binagre/Streat Lab. Usa únicamente el cliente
 * `supabase` de `@/lib/supabase` (proyecto eryauogxcpbgdryeimdq). No toca ninguna
 * tabla, credencial ni lógica del proyecto satélite de David.
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface FichaEmpleado {
  brutoAcumulado: number
  netoPagadoReal: number // lo que de verdad ha cobrado (suma de pagos CONFIRMADOS)
  irpfAcumulado: number // cuánto hay que guardar para Hacienda
  ssEmpresaAcumulada: number
  costeRealTotal: number // suma de coste_empresa, o bruto+ss_empresa si coste_empresa es null
  diferenciasAcumuladas: number // pagado de más/menos acumulado (con signo)
}

interface NominaFichaRow {
  id: string
  importe_bruto: number | null
  importe_neto: number | null
  irpf_retenido: number | null
  ss_empresa: number | null
  coste_empresa: number | null
}

interface PagoFichaRow {
  nomina_id: string
  importe_asociado: number
  confirmado: boolean
}

export function useFichaEmpleado(empleadoId: string, anio: number): { loading: boolean; error: string | null; ficha: FichaEmpleado | null } {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ficha, setFicha] = useState<FichaEmpleado | null>(null)

  useEffect(() => {
    if (!empleadoId) {
      setLoading(false)
      setFicha(null)
      return
    }
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data: nominasData, error: errN } = await supabase
          .from('nominas')
          .select('id, importe_bruto, importe_neto, irpf_retenido, ss_empresa, coste_empresa')
          .eq('empleado_id', empleadoId)
          .eq('anio', anio)
        if (errN) throw errN
        const filas = (nominasData ?? []) as NominaFichaRow[]
        const nominaIds = filas.map(n => n.id)

        const totalPagadoPorNomina = new Map<string, number>()
        if (nominaIds.length > 0) {
          const { data: pagosData, error: errP } = await supabase
            .from('nominas_pagos')
            .select('nomina_id, importe_asociado, confirmado')
            .in('nomina_id', nominaIds)
            .eq('confirmado', true)
          if (errP) throw errP
          for (const p of (pagosData ?? []) as PagoFichaRow[]) {
            totalPagadoPorNomina.set(p.nomina_id, (totalPagadoPorNomina.get(p.nomina_id) ?? 0) + Number(p.importe_asociado))
          }
        }

        let brutoAcumulado = 0
        let netoPagadoReal = 0
        let irpfAcumulado = 0
        let ssEmpresaAcumulada = 0
        let costeRealTotal = 0
        let diferenciasAcumuladas = 0

        for (const n of filas) {
          const bruto = n.importe_bruto != null ? Number(n.importe_bruto) : 0
          const neto = n.importe_neto != null ? Number(n.importe_neto) : 0
          const irpf = n.irpf_retenido != null ? Number(n.irpf_retenido) : 0
          const ssEmpresa = n.ss_empresa != null ? Number(n.ss_empresa) : 0
          const coste = n.coste_empresa != null ? Number(n.coste_empresa) : bruto + ssEmpresa
          const totalPagado = totalPagadoPorNomina.get(n.id) ?? 0

          brutoAcumulado += bruto
          netoPagadoReal += totalPagado
          irpfAcumulado += irpf
          ssEmpresaAcumulada += ssEmpresa
          costeRealTotal += coste
          diferenciasAcumuladas += totalPagado - neto
        }

        if (!cancelled) {
          setFicha({
            brutoAcumulado,
            netoPagadoReal,
            irpfAcumulado,
            ssEmpresaAcumulada,
            costeRealTotal,
            diferenciasAcumuladas,
          })
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar ficha de empleado')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [empleadoId, anio])

  return { loading, error, ficha }
}
