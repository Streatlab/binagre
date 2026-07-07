/**
 * useAnalisisHV — Análisis Horizontal / Vertical sobre el P&G (conciliacion + categorias_pyg).
 *
 * Vertical: % de cada bloque de gasto sobre las ventas de cada mes.
 * Horizontal: variación % del importe de cada bloque mes a mes.
 * Además detecta "el gasto que se come el margen": el bloque cuyo % sobre
 * ventas más ha subido (en puntos porcentuales) en el mes más reciente
 * respecto al mes anterior dentro del mismo año.
 *
 * Criterio de agregación (documentado, ver punto 2 del spec): categorias_pyg
 * trae el campo `bloque` ya denormalizado en TODAS sus filas, incluidas las
 * de nivel 3/4 (hijas). Por eso no hace falta recorrer parent_id: basta con
 * unir conciliacion.categoria contra categorias_pyg.id y sumar por `bloque`.
 * Esto agrupa automáticamente cualquier categoría hija bajo su bloque de
 * nivel más alto, que es justo el nivel "no gigante" pedido para la tabla.
 */
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type BloqueGasto = 'PRODUCTO' | 'EQUIPO' | 'CONTROLABLES' | 'ALQUILER' | 'GASTOS'

/** Orden de presentación de los bloques de gasto (punto 2 del spec). */
export const BLOQUES_ORDEN: BloqueGasto[] = ['PRODUCTO', 'EQUIPO', 'CONTROLABLES', 'ALQUILER', 'GASTOS']

/**
 * Etiqueta legible por bloque. PRODUCTO/EQUIPO/ALQUILER/CONTROLABLES toman
 * el nombre de su categoría de nivel 1 en categorias_pyg (Producto, Equipo,
 * Alquiler, Controlables). GASTOS no tiene categoría de nivel 1 propia en la
 * tabla (es un bloque residual sólo presente en un par de categorías de
 * nivel 3 colgadas de Equipo) — DECISIÓN AUTÓNOMA: se etiqueta "Gastos varios".
 */
export const BLOQUE_LABEL: Record<BloqueGasto, string> = {
  PRODUCTO: 'Producto',
  EQUIPO: 'Equipo',
  CONTROLABLES: 'Controlables',
  ALQUILER: 'Alquiler',
  GASTOS: 'Gastos varios',
}

export interface FilaCategoria {
  bloque: BloqueGasto
  label: string
  /** Importe absoluto de gasto por mes. Índice 1..12 (0 sin usar). */
  importe: number[]
  /** % sobre ventas del mes (análisis vertical). Índice 1..12. */
  pctVertical: number[]
  /** Variación % del importe respecto al mes anterior (análisis horizontal). Índice 1..12; null = sin mes anterior con dato dentro del año. */
  deltaImportePct: (number | null)[]
  /** Variación en puntos porcentuales del %-sobre-ventas respecto al mes anterior. Índice 1..12; null = sin mes anterior con dato dentro del año. */
  deltaPP: (number | null)[]
}

export interface CategoriaAlerta {
  bloque: BloqueGasto
  label: string
  deltaPP: number
}

export interface AnalisisHV {
  loading: boolean
  error: string | null
  año: number
  /** Ventas por mes (suma conciliacion tipo='ingreso'). Índice 1..12. */
  ventas: number[]
  filas: FilaCategoria[]
  gastoTotalImporte: number[]
  gastoTotalPct: number[]
  deltaGastoTotalImportePct: (number | null)[]
  deltaGastoTotalPP: (number | null)[]
  /** Último mes (1..12) con ventas registradas dentro del año, o null si no hay datos. */
  mesReciente: number | null
  /** El bloque que "se come el margen" en el mes más reciente, o null si ninguno subió. */
  categoriaAlerta: CategoriaAlerta | null
}

function mesArray(): number[] {
  return Array(13).fill(0)
}

export function useAnalisisHV(año: number): AnalisisHV {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ventasRaw, setVentasRaw] = useState<number[]>(mesArray())
  const [gastoRaw, setGastoRaw] = useState<Record<BloqueGasto, number[]>>(() => {
    const r = {} as Record<BloqueGasto, number[]>
    BLOQUES_ORDEN.forEach(b => { r[b] = mesArray() })
    return r
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const desde = `${año}-01-01`
        const hasta = `${año}-12-31`

        const [concRes, catsRes] = await Promise.all([
          supabase.from('conciliacion').select('fecha,categoria,importe,tipo').gte('fecha', desde).lte('fecha', hasta),
          supabase.from('categorias_pyg').select('id,nombre,bloque,parent_id,activa').eq('activa', true),
        ])
        if (concRes.error) throw concRes.error
        if (catsRes.error) throw catsRes.error
        if (cancelled) return

        const bloquePorId = new Map<string, string>()
        ;(catsRes.data || []).forEach((c: any) => bloquePorId.set(c.id, c.bloque))

        const vArr = mesArray()
        const gMap: Record<BloqueGasto, number[]> = {} as Record<BloqueGasto, number[]>
        BLOQUES_ORDEN.forEach(b => { gMap[b] = mesArray() })

        ;(concRes.data || []).forEach((r: any) => {
          if (!r.fecha) return
          const mes = new Date(String(r.fecha) + 'T00:00:00').getMonth() + 1
          if (mes < 1 || mes > 12) return
          if (r.tipo === 'ingreso') {
            vArr[mes] += Number(r.importe || 0)
          } else if (r.tipo === 'gasto') {
            const bloque = bloquePorId.get(r.categoria) as BloqueGasto | undefined
            if (bloque && (BLOQUES_ORDEN as string[]).includes(bloque)) {
              gMap[bloque][mes] += Math.abs(Number(r.importe || 0))
            }
          }
        })

        if (!cancelled) {
          setVentasRaw(vArr)
          setGastoRaw(gMap)
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Error cargando análisis horizontal/vertical')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [año])

  return useMemo(() => {
    const ventas = ventasRaw

    const filas: FilaCategoria[] = BLOQUES_ORDEN.map(bloque => {
      const importe = gastoRaw[bloque]
      const pctVertical = mesArray()
      const deltaImportePct: (number | null)[] = mesArray().map(() => null)
      const deltaPP: (number | null)[] = mesArray().map(() => null)

      for (let m = 1; m <= 12; m++) {
        pctVertical[m] = ventas[m] > 0 ? (importe[m] / ventas[m]) * 100 : 0
      }
      for (let m = 2; m <= 12; m++) {
        const prevImporte = importe[m - 1]
        deltaImportePct[m] = prevImporte > 0 ? ((importe[m] - prevImporte) / prevImporte) * 100 : null
        const prevVentas = ventas[m - 1]
        deltaPP[m] = ventas[m] > 0 && prevVentas > 0 ? pctVertical[m] - pctVertical[m - 1] : null
      }

      return { bloque, label: BLOQUE_LABEL[bloque], importe, pctVertical, deltaImportePct, deltaPP }
    })

    const gastoTotalImporte = mesArray()
    const gastoTotalPct = mesArray()
    for (let m = 1; m <= 12; m++) {
      gastoTotalImporte[m] = filas.reduce((s, f) => s + f.importe[m], 0)
      gastoTotalPct[m] = ventas[m] > 0 ? (gastoTotalImporte[m] / ventas[m]) * 100 : 0
    }
    const deltaGastoTotalImportePct: (number | null)[] = mesArray().map(() => null)
    const deltaGastoTotalPP: (number | null)[] = mesArray().map(() => null)
    for (let m = 2; m <= 12; m++) {
      const prevImporte = gastoTotalImporte[m - 1]
      deltaGastoTotalImportePct[m] = prevImporte > 0 ? ((gastoTotalImporte[m] - prevImporte) / prevImporte) * 100 : null
      deltaGastoTotalPP[m] = ventas[m] > 0 && ventas[m - 1] > 0 ? gastoTotalPct[m] - gastoTotalPct[m - 1] : null
    }

    // Mes más reciente con ventas registradas dentro del año.
    let mesReciente: number | null = null
    for (let m = 12; m >= 1; m--) {
      if (ventas[m] > 0) { mesReciente = m; break }
    }

    // "El gasto que se come el margen": el bloque cuyo %-sobre-ventas más ha
    // subido (en puntos porcentuales) en el mes más reciente frente al
    // anterior. Si el mes reciente es enero (o no hay mes anterior con datos
    // dentro del año), no se resalta nada — DECISIÓN AUTÓNOMA documentada en
    // el spec: no se compara contra diciembre del año anterior para no
    // mezclar ejercicios distintos en la misma lectura.
    let categoriaAlerta: CategoriaAlerta | null = null
    if (mesReciente && mesReciente >= 2) {
      let maxDelta = -Infinity
      let ganadora: FilaCategoria | null = null
      for (const f of filas) {
        const d = f.deltaPP[mesReciente]
        if (d != null && d > maxDelta) { maxDelta = d; ganadora = f }
      }
      if (ganadora && maxDelta > 0) {
        categoriaAlerta = { bloque: ganadora.bloque, label: ganadora.label, deltaPP: maxDelta }
      }
    }

    return {
      loading, error, año, ventas, filas,
      gastoTotalImporte, gastoTotalPct, deltaGastoTotalImportePct, deltaGastoTotalPP,
      mesReciente, categoriaAlerta,
    }
  }, [loading, error, año, ventasRaw, gastoRaw])
}
