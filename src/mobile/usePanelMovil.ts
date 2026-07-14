import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { resolverNetoCanal, useVentasRealesListas } from '@/lib/panel/netoResolver'

export interface CanalPanel {
  id: string
  nombre: string
  color: string
  bruto: number
  neto: number
  pedidos: number
}

export interface PanelData {
  loading: boolean
  error: string | null
  brutoMes: number
  netoMes: number
  pedidosMes: number
  ticketMedio: number
  gastoMes: number
  resultadoMes: number
  canales: CanalPanel[]
  serieDias: { fecha: string; bruto: number }[]
  facturasSinConciliar: number
  reclamacionesPendientes: number
  tareasPendientes: number
}

const CANALES = [
  { id: 'uber', nombre: 'Uber Eats', color: '#06C167', bruto: 'uber_bruto', ped: 'uber_pedidos' },
  { id: 'glovo', nombre: 'Glovo', color: '#e8f442', bruto: 'glovo_bruto', ped: 'glovo_pedidos' },
  { id: 'je', nombre: 'Just Eat', color: '#f5a623', bruto: 'je_bruto', ped: 'je_pedidos' },
  { id: 'web', nombre: 'Web propia', color: '#B01D23', bruto: 'web_bruto', ped: 'web_pedidos' },
  { id: 'directa', nombre: 'Venta directa', color: '#484f66', bruto: 'directa_bruto', ped: 'directa_pedidos' },
] as const

/** Datos reales del Panel móvil: mes en curso. */
export function usePanelMovil(): PanelData {
  const netosListos = useVentasRealesListas()
  const [d, setD] = useState<PanelData>({
    loading: true, error: null,
    brutoMes: 0, netoMes: 0, pedidosMes: 0, ticketMedio: 0, gastoMes: 0, resultadoMes: 0,
    canales: [], serieDias: [],
    facturasSinConciliar: 0, reclamacionesPendientes: 0, tareasPendientes: 0,
  })

  useEffect(() => {
    if (!netosListos) return
    let cancel = false

    ;(async () => {
      try {
        const hoy = new Date()
        const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
        const iso = (x: Date) => x.toISOString().slice(0, 10)

        const [fact, gastos, sinConc, reclam, tareas] = await Promise.all([
          supabase.from('facturacion_diario')
            .select('fecha,total_bruto,total_pedidos,uber_bruto,uber_pedidos,glovo_bruto,glovo_pedidos,je_bruto,je_pedidos,web_bruto,web_pedidos,directa_bruto,directa_pedidos')
            .gte('fecha', iso(desde)).lte('fecha', iso(hoy)),
          supabase.from('gastos').select('importe').gte('fecha', iso(desde)).lte('fecha', iso(hoy)),
          supabase.from('facturas').select('id', { count: 'exact', head: true })
            .eq('no_conciliable', false).gte('fecha_factura', '2023-07-03'),
          supabase.from('v_reembolsos_pendientes').select('*', { count: 'exact', head: true }),
          supabase.from('tareas_pendientes').select('*', { count: 'exact', head: true }),
        ])

        if (cancel) return
        const filas = (fact.data || []) as any[]

        const sumar = (k: string) => filas.reduce((s, f) => s + (Number(f[k]) || 0), 0)
        const brutoMes = sumar('total_bruto')
        const pedidosMes = sumar('total_pedidos')

        const canales: CanalPanel[] = CANALES.map(c => {
          const bruto = sumar(c.bruto)
          const pedidos = sumar(c.ped)
          const neto = bruto > 0
            ? resolverNetoCanal(c.id, bruto, pedidos, { fechaDesde: desde, fechaHasta: hoy } as any).neto
            : 0
          return { id: c.id, nombre: c.nombre, color: c.color, bruto, neto, pedidos }
        }).filter(c => c.bruto > 0)

        const netoMes = canales.reduce((s, c) => s + c.neto, 0)
        const gastoMes = ((gastos.data || []) as any[]).reduce((s, g) => s + (Number(g.importe) || 0), 0)

        const serieDias = filas
          .map(f => ({ fecha: String(f.fecha), bruto: Number(f.total_bruto) || 0 }))
          .sort((a, b) => a.fecha.localeCompare(b.fecha))
          .slice(-14)

        setD({
          loading: false, error: null,
          brutoMes, netoMes, pedidosMes,
          ticketMedio: pedidosMes > 0 ? brutoMes / pedidosMes : 0,
          gastoMes,
          resultadoMes: netoMes - gastoMes,
          canales,
          serieDias,
          facturasSinConciliar: sinConc.count || 0,
          reclamacionesPendientes: reclam.count || 0,
          tareasPendientes: tareas.count || 0,
        })
      } catch (e: any) {
        if (!cancel) setD(s => ({ ...s, loading: false, error: e?.message || 'Error' }))
      }
    })()

    return () => { cancel = true }
  }, [netosListos])

  return d
}
