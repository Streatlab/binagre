/**
 * useEstadosFinancieros — datos para el módulo Estados Financieros
 * (P&G · Balance · Cash Flow) del ERP Binagre / Streat Lab.
 *
 * Fuentes: conciliacion, categorias_pyg, configuracion,
 * ventas_plataforma, facturas. Ver comentarios TODO junto a cada
 * cálculo que depende de una fuente de datos aún incompleta.
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/* ── Tipos de dominio ────────────────────────────────────────── */

interface CategoriaPyg {
  id: string
  nivel: number
  parent_id: string | null
  nombre: string
  bloque: string | null
  computa_pyg: boolean
}

export interface PygMes {
  mes: number // 1-12
  ingresos: number
  producto: number
  equipo: number
  controlables: number
  alquiler: number
  otrosGastos: number
  totalGastos: number
  resultado: number
}

export interface PygAnual {
  año: number
  meses: PygMes[] // longitud 12, índice 0 = enero
  totalIngresos: number
  totalGastos: number
  resultadoEjercicio: number
}

export interface BalanceEstado {
  fecha: string // YYYY-MM-DD (hoy)
  caja: number
  cajaDisponible: boolean // false si no hay fila configuracion.saldo_banco_actual
  cobrosPendientesPlataformas: number
  activo: number
  pasivoFacturasPendientes: number
  pasivo: number
  patrimonioNeto: number
}

export interface CashFlowMes {
  mes: number
  operativo: number
  inversion: number
  financiacion: number
  flujoNeto: number
}

export interface CashFlowAnual {
  año: number
  meses: CashFlowMes[]
  flujoNetoAcumulado: number
}

export interface EstadosFinancierosData {
  loading: boolean
  error: string | null
  pyg: PygAnual | null
  pygAnterior: PygAnual | null
  balance: BalanceEstado | null
  cashFlow: CashFlowAnual | null
  cashFlowAnterior: CashFlowAnual | null
  reload: () => void
}

/* ── Helpers internos ────────────────────────────────────────── */

const mesesVaciosPyg = (): PygMes[] =>
  Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1, ingresos: 0, producto: 0, equipo: 0, controlables: 0,
    alquiler: 0, otrosGastos: 0, totalGastos: 0, resultado: 0,
  }))

const mesesVaciosCf = (): CashFlowMes[] =>
  Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, operativo: 0, inversion: 0, financiacion: 0, flujoNeto: 0 }))

/** Sube por parent_id hasta encontrar un bloque no nulo. Categoría desconocida → null. */
function resolverBloque(catId: string | null | undefined, catMap: Map<string, CategoriaPyg>): string | null {
  let cur = catId ?? null
  let guard = 0
  while (cur && guard < 12) {
    const c = catMap.get(cur)
    if (!c) return null
    if (c.bloque) return c.bloque
    cur = c.parent_id
    guard++
  }
  return null
}

/** Categoría desconocida (no está en categorias_pyg activas) → se deja pasar, no se descarta el movimiento. */
function computaPygActivo(catId: string | null | undefined, catMap: Map<string, CategoriaPyg>): boolean {
  const c = catId ? catMap.get(catId) : undefined
  if (!c) return true
  return c.computa_pyg !== false
}

async function fetchCategorias(): Promise<Map<string, CategoriaPyg>> {
  const { data, error } = await supabase
    .from('categorias_pyg')
    .select('id,nivel,parent_id,nombre,bloque,computa_pyg')
    .eq('activa', true)
  if (error) throw error
  const map = new Map<string, CategoriaPyg>()
  ;(data || []).forEach((c: any) => map.set(c.id, c as CategoriaPyg))
  return map
}

async function fetchConciliacionAño(año: number): Promise<{ fecha: string; categoria: string | null; importe: number; tipo: string }[]> {
  const { data, error } = await supabase
    .from('conciliacion')
    .select('fecha,categoria,importe,tipo')
    .gte('fecha', `${año}-01-01`)
    .lte('fecha', `${año}-12-31`)
  if (error) throw error
  return (data || []) as any
}

function buildPyg(año: number, filas: { fecha: string; categoria: string | null; importe: number; tipo: string }[], catMap: Map<string, CategoriaPyg>): PygAnual {
  const meses = mesesVaciosPyg()
  filas.forEach(r => {
    const mIdx = new Date(r.fecha + 'T00:00:00').getMonth()
    const m = meses[mIdx]
    if (!m) return
    if (!computaPygActivo(r.categoria, catMap)) return
    const importe = Math.abs(Number(r.importe || 0))
    const bloque = resolverBloque(r.categoria, catMap)
    if (r.tipo === 'ingreso') {
      if (bloque === 'INGRESOS') m.ingresos += importe
      // ingresos fuera del bloque INGRESOS (p.ej. financiación) no computan en P&G
    } else if (r.tipo === 'gasto') {
      switch (bloque) {
        case 'PRODUCTO': m.producto += importe; break
        case 'EQUIPO': m.equipo += importe; break
        case 'CONTROLABLES': m.controlables += importe; break
        case 'ALQUILER': m.alquiler += importe; break
        case 'GASTOS': m.otrosGastos += importe; break
        default: break // PASIVO, INTERNO u otros: no computan en el P&G
      }
    }
  })
  meses.forEach(m => {
    m.totalGastos = m.producto + m.equipo + m.controlables + m.alquiler + m.otrosGastos
    m.resultado = m.ingresos - m.totalGastos
  })
  const totalIngresos = meses.reduce((s, m) => s + m.ingresos, 0)
  const totalGastos = meses.reduce((s, m) => s + m.totalGastos, 0)
  return { año, meses, totalIngresos, totalGastos, resultadoEjercicio: totalIngresos - totalGastos }
}

function buildCashFlow(año: number, filas: { fecha: string; categoria: string | null; importe: number; tipo: string }[], catMap: Map<string, CategoriaPyg>): CashFlowAnual {
  const meses = mesesVaciosCf()
  filas.forEach(r => {
    const mIdx = new Date(r.fecha + 'T00:00:00').getMonth()
    const m = meses[mIdx]
    if (!m) return
    const importe = Math.abs(Number(r.importe || 0))
    const bloque = resolverBloque(r.categoria, catMap)
    if (bloque === 'INTERNO') return // movimientos internos: no computan en cash flow
    if (bloque === 'PASIVO') {
      if (r.tipo === 'gasto') m.financiacion -= importe
      return
    }
    if (r.tipo === 'ingreso') m.operativo += importe
    else if (r.tipo === 'gasto') m.operativo -= importe
  })
  // TODO fuente de datos: no hay una categoría "inversión/capex" distinguible de forma fiable
  // en la taxonomía actual de categorias_pyg; revisar cuando exista un bloque CAPEX. Columna en 0.
  meses.forEach(m => { m.flujoNeto = m.operativo + m.inversion + m.financiacion })
  const flujoNetoAcumulado = meses.reduce((s, m) => s + m.flujoNeto, 0)
  return { año, meses, flujoNetoAcumulado }
}

async function fetchBalance(): Promise<BalanceEstado> {
  const fecha = new Date().toISOString().slice(0, 10)

  // TODO fuente de datos: la clave 'saldo_banco_actual' en configuracion se asume actualizada
  // manualmente; si no existe la fila, la caja se muestra en 0 y se marca como no disponible.
  const { data: dConf } = await supabase.from('configuracion').select('valor').eq('clave', 'saldo_banco_actual').maybeSingle()
  const cajaDisponible = dConf?.valor != null && dConf.valor !== ''
  const caja = cajaDisponible ? Number(dConf!.valor) || 0 : 0

  const { data: dVentas } = await supabase.from('ventas_plataforma').select('neto').is('fecha_pago', null)
  const cobrosPendientesPlataformas = (dVentas || []).reduce((s: number, r: any) => s + Number(r.neto || 0), 0)

  const activo = caja + cobrosPendientesPlataformas

  // TODO fuente de datos: no existe tabla de saldo vivo de préstamos en BD; el pasivo mostrado
  // es solo el operativo de facturas de proveedor sin conciliar/procesar.
  const ESTADOS_PASIVO = ['pendiente_revision', 'pendiente_lectura_manual', 'sin_match', 'pendiente_titular_manual']
  const { data: dFacturas } = await supabase.from('facturas').select('total,estado').in('estado', ESTADOS_PASIVO)
  const pasivoFacturasPendientes = (dFacturas || []).reduce((s: number, r: any) => s + Number(r.total || 0), 0)
  const pasivo = pasivoFacturasPendientes

  return {
    fecha, caja, cajaDisponible, cobrosPendientesPlataformas, activo,
    pasivoFacturasPendientes, pasivo, patrimonioNeto: activo - pasivo,
  }
}

/* ── Hook principal ──────────────────────────────────────────── */

export function useEstadosFinancieros(año: number): EstadosFinancierosData {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pyg, setPyg] = useState<PygAnual | null>(null)
  const [pygAnterior, setPygAnterior] = useState<PygAnual | null>(null)
  const [balance, setBalance] = useState<BalanceEstado | null>(null)
  const [cashFlow, setCashFlow] = useState<CashFlowAnual | null>(null)
  const [cashFlowAnterior, setCashFlowAnterior] = useState<CashFlowAnual | null>(null)
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const catMap = await fetchCategorias()
        const [filasActual, filasAnterior, bal] = await Promise.all([
          fetchConciliacionAño(año),
          fetchConciliacionAño(año - 1),
          fetchBalance(),
        ])
        if (cancelled) return
        setPyg(buildPyg(año, filasActual, catMap))
        setPygAnterior(buildPyg(año - 1, filasAnterior, catMap))
        setCashFlow(buildCashFlow(año, filasActual, catMap))
        setCashFlowAnterior(buildCashFlow(año - 1, filasAnterior, catMap))
        setBalance(bal)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar estados financieros')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [año, tick])

  return { loading, error, pyg, pygAnterior, balance, cashFlow, cashFlowAnterior, reload }
}

/* ── Utilidades compartidas con la vista ─────────────────────── */

/** % de variación actual vs anterior. null si no hay base de comparación. */
export function deltaPct(actual: number, anterior: number): number | null {
  if (!anterior) return null
  return ((actual - anterior) / Math.abs(anterior)) * 100
}

/** Construye un CSV con separador ';' (Excel es_ES) a partir de cabeceras y filas. */
export function csvFromRows(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v)
    return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const lineas = [headers.map(esc).join(';'), ...rows.map(r => r.map(esc).join(';'))]
  return lineas.join('\n')
}

/** Descarga un CSV en cliente mediante Blob + link temporal (sin librerías externas). */
export function descargarCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
