/**
 * usePanelGlobalData — Hook de datos para "Panel Global 2" (estilo Lymon).
 *
 * A diferencia de useMockupData (mes en curso fijo), este hook es REACTIVO:
 * acepta fechaDesde / fechaHasta / canalesFiltro desde el header y recalcula.
 *
 * Fuente: Supabase facturacion_diario + marcas (idéntica a PanelGlobal real).
 * Margen real calculado con calcNetoPorCanal.
 * Comparación: periodo equivalente inmediatamente anterior (mismo nº de días).
 */

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { calcNetoPorCanal, loadConfigCanales, loadMarcasPorCanal, type CanalConfig, type MarcasPorCanal } from '@/lib/panel/calcNetoPlataforma'
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

export interface PanelGlobalData {
  loading: boolean
  fechaDesde: Date
  fechaHasta: Date
  marcas: MarcaItem[]
  facturacion: number
  pedidos: number
  ticketMedio: number
  margen: number
  facturacionAnt: number
  pedidosAnt: number
  ticketAnt: number
  margenAnt: number
  deltaFacturacion: number
  deltaPedidos: number
  deltaTicket: number
  deltaMargen: number
  proyeccionMes: number
  objetivoMes: number
  cumplimiento: number
  canales: CanalData[]
  serieDiaria: DiaData[]
  diaMes: number
  totalDiasMes: number
}

const CANAL_IDS = ['uber', 'glovo', 'je', 'web', 'dir'] as const
type CanalId = typeof CANAL_IDS[number]

export function usePanelGlobalData(
  fechaDesde: Date,
  fechaHasta: Date,
  canalesFiltro: string[] = [],
): PanelGlobalData {
  const today = new Date()
  const totalDiasMes = new Date(fechaHasta.getFullYear(), fechaHasta.getMonth() + 1, 0).getDate()
  const diaMes = fechaHasta.getMonth() === today.getMonth() && fechaHasta.getFullYear() === today.getFullYear()
    ? today.getDate()
    : totalDiasMes

  const [marcas, setMarcas] = useState<MarcaItem[]>([])
  const [rowsPeriodo, setRowsPeriodo] = useState<RowFacturacion[]>([])
  const [rowsAnterior, setRowsAnterior] = useState<RowFacturacion[]>([])
  const [loading, setLoading] = useState(true)

  const [cfgCanales, setCfgCanales] = useState<Record<string, CanalConfig>>({})
  const [marcasPorCanalData, setMarcasPorCanalData] = useState<MarcasPorCanal>({ uber: 1, glovo: 1, je: 1, web: 1, dir: 1 })

  // Periodo anterior equivalente (mismo nº de días, justo antes de fechaDesde)
  const msDia = 86400000
  const numDias = Math.round((fechaHasta.getTime() - fechaDesde.getTime()) / msDia) + 1
  const antHasta = new Date(fechaDesde.getTime() - msDia)
  const antDesde = new Date(antHasta.getTime() - (numDias - 1) * msDia)

  useEffect(() => {
    loadConfigCanales().then(c => setCfgCanales(c))
    loadMarcasPorCanal().then(m => setMarcasPorCanalData(m))
  }, [])

  useEffect(() => {
    supabase.from('marcas').select('id,nombre').eq('estado', 'activa').then(({ data }) => {
      if (data) setMarcas(data as MarcaItem[])
    })
  }, [])

  useEffect(() => {
    setLoading(true)
    supabase
      .from('facturacion_diario').select('*')
      .gte('fecha', toLocalDateStr(fechaDesde)).lte('fecha', toLocalDateStr(fechaHasta))
      .order('fecha', { ascending: true })
      .then(({ data }) => { setRowsPeriodo((data ?? []) as RowFacturacion[]); setLoading(false) })
  }, [fechaDesde, fechaHasta])

  useEffect(() => {
    supabase
      .from('facturacion_diario').select('*')
      .gte('fecha', toLocalDateStr(antDesde)).lte('fecha', toLocalDateStr(antHasta))
      .order('fecha', { ascending: true })
      .then(({ data }) => { setRowsAnterior((data ?? []) as RowFacturacion[]) })
  }, [fechaDesde, fechaHasta])

  return useMemo(() => {
    const activos: CanalId[] = canalesFiltro.length === 0
      ? [...CANAL_IDS]
      : (CANAL_IDS.filter(c => canalesFiltro.includes(c)) as CanalId[])
    const incl = (c: CanalId) => activos.includes(c)

    const sumRows = (rows: RowFacturacion[]) => {
      const acc = { uber: 0, uberPed: 0, glovo: 0, glovoPed: 0, je: 0, jePed: 0, web: 0, webPed: 0, dir: 0, dirPed: 0 }
      for (const r of rows) {
        acc.uber += r.uber_bruto || 0;   acc.uberPed += r.uber_pedidos || 0
        acc.glovo += r.glovo_bruto || 0; acc.glovoPed += r.glovo_pedidos || 0
        acc.je += r.je_bruto || 0;       acc.jePed += r.je_pedidos || 0
        acc.web += r.web_bruto || 0;     acc.webPed += r.web_pedidos || 0
        acc.dir += r.directa_bruto || 0; acc.dirPed += r.directa_pedidos || 0
      }
      const bruto = (incl('uber') ? acc.uber : 0) + (incl('glovo') ? acc.glovo : 0) + (incl('je') ? acc.je : 0) + (incl('web') ? acc.web : 0) + (incl('dir') ? acc.dir : 0)
      const pedidos = (incl('uber') ? acc.uberPed : 0) + (incl('glovo') ? acc.glovoPed : 0) + (incl('je') ? acc.jePed : 0) + (incl('web') ? acc.webPed : 0) + (incl('dir') ? acc.dirPed : 0)
      return { ...acc, bruto, pedidos }
    }

    const cur = sumRows(rowsPeriodo)
    const ant = sumRows(rowsAnterior)

    const facturacion = cur.bruto
    const pedidos = cur.pedidos
    const ticketMedio = pedidos > 0 ? facturacion / pedidos : 0

    const netoDe = (s: ReturnType<typeof sumRows>, d1: Date, d2: Date) => {
      const arr = [
        { id: 'uber', bruto: s.uber, pedidos: s.uberPed },
        { id: 'glovo', bruto: s.glovo, pedidos: s.glovoPed },
        { id: 'je', bruto: s.je, pedidos: s.jePed },
        { id: 'web', bruto: s.web, pedidos: s.webPed },
        { id: 'dir', bruto: s.dir, pedidos: s.dirPed },
      ].filter(c => incl(c.id as CanalId))
      return arr.reduce((a, c) => a + calcNetoPorCanal(c.id, c.bruto, c.pedidos, marcasPorCanalData, d1, d2, cfgCanales).neto, 0)
    }

    const netoTotal = netoDe(cur, fechaDesde, fechaHasta)
    const margen = facturacion > 0 ? (netoTotal / facturacion) * 100 : 0

    const facturacionAnt = ant.bruto
    const pedidosAnt = ant.pedidos
    const ticketAnt = pedidosAnt > 0 ? facturacionAnt / pedidosAnt : 0
    const netoAnt = netoDe(ant, antDesde, antHasta)
    const margenAnt = facturacionAnt > 0 ? (netoAnt / facturacionAnt) * 100 : 0

    const deltaFacturacion = facturacionAnt > 0 ? ((facturacion - facturacionAnt) / facturacionAnt) * 100 : 0
    const deltaPedidos = pedidosAnt > 0 ? ((pedidos - pedidosAnt) / pedidosAnt) * 100 : 0
    const deltaTicket = ticketAnt > 0 ? ((ticketMedio - ticketAnt) / ticketAnt) * 100 : 0
    const deltaMargen = margen - margenAnt

    const ritmoDiario = diaMes > 0 ? facturacion / diaMes : 0
    const proyeccionMes = ritmoDiario * totalDiasMes
    const objetivoMes = 40000
    const cumplimiento = objetivoMes > 0 ? (facturacion / objetivoMes) * 100 : 0

    const allCanales = [
      { id: 'uber', label: 'Uber Eats', bruto: cur.uber, pedidos: cur.uberPed },
      { id: 'glovo', label: 'Glovo', bruto: cur.glovo, pedidos: cur.glovoPed },
      { id: 'je', label: 'Just Eat', bruto: cur.je, pedidos: cur.jePed },
      { id: 'web', label: 'Tienda online', bruto: cur.web + cur.dir, pedidos: cur.webPed + cur.dirPed },
    ]
    const canales: CanalData[] = allCanales
      .filter(c => c.id === 'web' ? (incl('web') || incl('dir')) : incl(c.id as CanalId))
      .map(c => ({ ...c, pct: facturacion > 0 ? (c.bruto / facturacion) * 100 : 0 }))

    const serieDiaria: DiaData[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(fechaHasta)
      d.setDate(d.getDate() - i)
      const fechaStr = toLocalDateStr(d)
      const row = rowsPeriodo.find(r => r.fecha === fechaStr) || rowsAnterior.find(r => r.fecha === fechaStr)
      let total = 0
      if (row) {
        total += incl('uber') ? (row.uber_bruto || 0) : 0
        total += incl('glovo') ? (row.glovo_bruto || 0) : 0
        total += incl('je') ? (row.je_bruto || 0) : 0
        total += incl('web') ? (row.web_bruto || 0) : 0
        total += incl('dir') ? (row.directa_bruto || 0) : 0
      }
      const diaSemana = d.getDay()
      serieDiaria.push({ fecha: fechaStr, total, pedidos: row?.total_pedidos || 0, esPico: diaSemana === 5 || diaSemana === 6 })
    }

    return {
      loading, fechaDesde, fechaHasta, marcas,
      facturacion, pedidos, ticketMedio, margen,
      facturacionAnt, pedidosAnt, ticketAnt, margenAnt,
      deltaFacturacion, deltaPedidos, deltaTicket, deltaMargen,
      proyeccionMes, objetivoMes, cumplimiento,
      canales, serieDiaria, diaMes, totalDiasMes,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsPeriodo, rowsAnterior, marcas, loading, diaMes, totalDiasMes, cfgCanales, marcasPorCanalData, canalesFiltro.join(',')])
}

export function fmtEur(n: number, decimals = 0): string {
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n) + ' €'
}
export function fmtPct(n: number, decimals = 1): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}%`
}
export function fmtNum(n: number): string {
  return new Intl.NumberFormat('es-ES').format(n)
}
