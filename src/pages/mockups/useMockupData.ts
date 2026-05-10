/**
 * useMockupData — Hook compartido para los mockups del Panel Global.
 *
 * Carga los mismos datos de Supabase que PanelGlobal (facturacion_diario + marcas)
 * y devuelve métricas pre-calculadas listas para pintar en cualquier estilo.
 *
 * Los 8 mockups consumen este hook para garantizar que los números son
 * idénticos a los del Panel Global real.
 */

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { RowFacturacion } from '@/components/panel/resumen/types'

interface MarcaItem { id: string; nombre: string }

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface CanalData {
  id: string
  label: string
  bruto: number
  pedidos: number
  pct: number
}

export interface DiaData {
  fecha: string
  total: number
  pedidos: number
  esPico: boolean
}

export interface MockupData {
  loading: boolean
  // Periodo actual
  fechaDesde: Date
  fechaHasta: Date
  periodoLabel: string
  // Marcas disponibles
  marcas: MarcaItem[]
  // KPIs del periodo
  facturacion: number
  pedidos: number
  ticketMedio: number
  margen: number          // placeholder hasta tener datos reales (62.4%)
  // Comparación con mes anterior
  facturacionAnt: number
  pedidosAnt: number
  ticketAnt: number
  margenAnt: number
  // Variaciones %
  deltaFacturacion: number
  deltaPedidos: number
  deltaTicket: number
  deltaMargen: number
  // Proyección fin de mes
  proyeccionMes: number
  objetivoMes: number
  cumplimiento: number    // %
  // Distribución por canal
  canales: CanalData[]
  // Serie diaria (últimos 14 días)
  serieDiaria: DiaData[]
  // Día del mes / total días
  diaMes: number
  totalDiasMes: number
}

export function useMockupData(): MockupData {
  const today = new Date()
  const fechaDesde = new Date(today.getFullYear(), today.getMonth(), 1)
  const fechaHasta = today
  const totalDiasMes = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const diaMes = today.getDate()

  const periodoLabel = `${today.toLocaleString('es-ES', { month: 'long' })} ${today.getFullYear()}`

  const [marcas, setMarcas] = useState<MarcaItem[]>([])
  const [rowsPeriodo, setRowsPeriodo] = useState<RowFacturacion[]>([])
  const [rowsMesAnterior, setRowsMesAnterior] = useState<RowFacturacion[]>([])
  const [loading, setLoading] = useState(true)

  // Marcas activas
  useEffect(() => {
    supabase
      .from('marcas')
      .select('id,nombre')
      .eq('estado', 'activa')
      .then(({ data }) => {
        if (data) setMarcas(data as MarcaItem[])
      })
  }, [])

  // Facturación del periodo actual (mes en curso)
  useEffect(() => {
    const desde = toLocalDateStr(fechaDesde)
    const hasta = toLocalDateStr(fechaHasta)
    supabase
      .from('facturacion_diario')
      .select('*')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha', { ascending: true })
      .then(({ data }) => {
        setRowsPeriodo((data ?? []) as RowFacturacion[])
        setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Facturación del mes anterior (comparación)
  useEffect(() => {
    const inicioMesAnt = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const finMesAnt = new Date(today.getFullYear(), today.getMonth(), 0)
    supabase
      .from('facturacion_diario')
      .select('*')
      .gte('fecha', toLocalDateStr(inicioMesAnt))
      .lte('fecha', toLocalDateStr(finMesAnt))
      .order('fecha', { ascending: true })
      .then(({ data }) => {
        setRowsMesAnterior((data ?? []) as RowFacturacion[])
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cálculos derivados
  return useMemo(() => {
    const sumRows = (rows: RowFacturacion[]) =>
      rows.reduce(
        (acc, r) => ({
          bruto: acc.bruto + (r.total_bruto || 0),
          pedidos: acc.pedidos + (r.total_pedidos || 0),
          uber: acc.uber + (r.uber_bruto || 0),
          uberPed: acc.uberPed + (r.uber_pedidos || 0),
          glovo: acc.glovo + (r.glovo_bruto || 0),
          glovoPed: acc.glovoPed + (r.glovo_pedidos || 0),
          je: acc.je + (r.je_bruto || 0),
          jePed: acc.jePed + (r.je_pedidos || 0),
          web: acc.web + (r.web_bruto || 0),
          webPed: acc.webPed + (r.web_pedidos || 0),
          dir: acc.dir + (r.directa_bruto || 0),
          dirPed: acc.dirPed + (r.directa_pedidos || 0),
        }),
        { bruto: 0, pedidos: 0, uber: 0, uberPed: 0, glovo: 0, glovoPed: 0, je: 0, jePed: 0, web: 0, webPed: 0, dir: 0, dirPed: 0 }
      )

    const cur = sumRows(rowsPeriodo)
    const ant = sumRows(rowsMesAnterior)

    const facturacion = cur.bruto
    const pedidos = cur.pedidos
    const ticketMedio = pedidos > 0 ? facturacion / pedidos : 0
    const margen = 62.4 // TODO: dato real cuando esté disponible

    const facturacionAnt = ant.bruto
    const pedidosAnt = ant.pedidos
    const ticketAnt = pedidosAnt > 0 ? facturacionAnt / pedidosAnt : 0
    const margenAnt = 65.0

    const deltaFacturacion = facturacionAnt > 0 ? ((facturacion - facturacionAnt) / facturacionAnt) * 100 : 0
    const deltaPedidos = pedidosAnt > 0 ? ((pedidos - pedidosAnt) / pedidosAnt) * 100 : 0
    const deltaTicket = ticketAnt > 0 ? ((ticketMedio - ticketAnt) / ticketAnt) * 100 : 0
    const deltaMargen = margen - margenAnt

    // Proyección: ritmo diario actual × días totales del mes
    const ritmoDiario = diaMes > 0 ? facturacion / diaMes : 0
    const proyeccionMes = ritmoDiario * totalDiasMes
    const objetivoMes = 40000 // TODO: leer de tabla objetivos
    const cumplimiento = objetivoMes > 0 ? (facturacion / objetivoMes) * 100 : 0

    // Canales
    const canales: CanalData[] = [
      { id: 'uber', label: 'Uber Eats', bruto: cur.uber, pedidos: cur.uberPed, pct: facturacion > 0 ? (cur.uber / facturacion) * 100 : 0 },
      { id: 'glovo', label: 'Glovo', bruto: cur.glovo, pedidos: cur.glovoPed, pct: facturacion > 0 ? (cur.glovo / facturacion) * 100 : 0 },
      { id: 'je', label: 'Just Eat', bruto: cur.je, pedidos: cur.jePed, pct: facturacion > 0 ? (cur.je / facturacion) * 100 : 0 },
      { id: 'web', label: 'Tienda online', bruto: cur.web + cur.dir, pedidos: cur.webPed + cur.dirPed, pct: facturacion > 0 ? ((cur.web + cur.dir) / facturacion) * 100 : 0 },
    ]

    // Serie últimos 14 días (rellenar con 0 si no hay datos)
    const serieDiaria: DiaData[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const fechaStr = toLocalDateStr(d)
      const row = rowsPeriodo.find(r => r.fecha === fechaStr) || rowsMesAnterior.find(r => r.fecha === fechaStr)
      const total = row?.total_bruto || 0
      const pedidosDia = row?.total_pedidos || 0
      const diaSemana = d.getDay() // 0=domingo, 6=sábado
      const esPico = diaSemana === 5 || diaSemana === 6 // viernes/sábado
      serieDiaria.push({ fecha: fechaStr, total, pedidos: pedidosDia, esPico })
    }

    return {
      loading,
      fechaDesde,
      fechaHasta,
      periodoLabel,
      marcas,
      facturacion,
      pedidos,
      ticketMedio,
      margen,
      facturacionAnt,
      pedidosAnt,
      ticketAnt,
      margenAnt,
      deltaFacturacion,
      deltaPedidos,
      deltaTicket,
      deltaMargen,
      proyeccionMes,
      objetivoMes,
      cumplimiento,
      canales,
      serieDiaria,
      diaMes,
      totalDiasMes,
    }
  }, [rowsPeriodo, rowsMesAnterior, marcas, loading, diaMes, totalDiasMes, periodoLabel])
}

// Helpers de formato compartidos
export function fmtEur(n: number, decimals = 0): string {
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n) + ' €'
}

export function fmtPct(n: number, decimals = 1): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}%`
}

export function fmtNum(n: number): string {
  return new Intl.NumberFormat('es-ES').format(n)
}
