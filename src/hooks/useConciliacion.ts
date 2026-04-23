import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { categoriaToSubcategoria, grupoFromCategoria } from '@/lib/categoriaMapping'
import { normalizarConcepto, matchPatron } from '@/lib/normalizarConcepto'

export interface Movimiento {
  id: string
  fecha: string
  concepto: string
  importe: number
  tipo: 'ingreso' | 'gasto' | null
  categoria: string | null
  proveedor: string | null
  factura: string | null
  mes: string | null
  link_factura: string | null
  notas: string | null
  gasto_id?: string | null
}

export interface Regla {
  id: string
  patron: string
  tipo_categoria: 'ingreso' | 'gasto'
  categoria_id: string | null
  categoria_codigo: string | null
  activa: boolean
  prioridad: number
}

export interface CategoriaRef {
  id: string
  codigo: string
  nombre: string
  grupo?: string | null
  tipo_parent: 'ingreso' | 'gasto'
}

export function useConciliacion() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [reglas, setReglas] = useState<Regla[]>([])
  const [categorias, setCategorias] = useState<CategoriaRef[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancel = false
    ;(async () => {
      setLoading(true); setError(null)
      try {
        const [mov, reg, cIng, cGas] = await Promise.all([
          supabase.from('conciliacion').select('*').order('fecha', { ascending: false }),
          supabase.from('reglas_conciliacion').select('id, patron, tipo_categoria, categoria_id, categoria_codigo, activa, prioridad').order('prioridad', { ascending: false }),
          supabase.from('categorias_contables_ingresos').select('id, codigo, nombre'),
          supabase.from('categorias_contables_gastos').select('id, codigo, nombre, grupo'),
        ])
        if (cancel) return
        if (mov.error) throw mov.error
        if (reg.error) throw reg.error
        if (cIng.error) throw cIng.error
        if (cGas.error) throw cGas.error
        setMovimientos((mov.data ?? []) as Movimiento[])
        setReglas((reg.data ?? []) as Regla[])
        const cats: CategoriaRef[] = [
          ...(cIng.data ?? []).map((c: any) => ({ id: c.id, codigo: c.codigo, nombre: c.nombre, tipo_parent: 'ingreso' as const })),
          ...(cGas.data ?? []).map((c: any) => ({ id: c.id, codigo: c.codigo, nombre: c.nombre, grupo: c.grupo, tipo_parent: 'gasto' as const })),
        ]
        setCategorias(cats)
      } catch (e: any) {
        if (!cancel) setError(e.message ?? 'Error cargando conciliación')
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => { cancel = true }
  }, [tick])

  async function insertMovimientos(
    rows: Omit<Movimiento, 'id'>[],
    onProgress?: (stage: 'saving' | 'rules', current: number, total: number) => void,
  ): Promise<{ insertados: number; autoCategorizados: number; ignorados: number }> {
    if (rows.length === 0) return { insertados: 0, autoCategorizados: 0, ignorados: 0 }

    // 1. Resolver órdenes ya usados en BD para los días del batch
    const fechasUnicas = Array.from(new Set(rows.map(r => r.fecha).filter((f): f is string => !!f)))
    const usedOrders = new Map<string, Set<number>>()
    if (fechasUnicas.length > 0) {
      const { data: existentes, error: exErr } = await supabase
        .from('conciliacion')
        .select('dedup_key')
        .in('fecha', fechasUnicas)
      if (exErr) throw exErr
      for (const e of existentes ?? []) {
        const k = (e as any).dedup_key as string | null
        if (!k) continue
        const parts = k.split('|')
        if (parts.length < 4) continue
        const orden = parseInt(parts[parts.length - 1], 10)
        if (isNaN(orden)) continue
        const prefix = parts.slice(0, -1).join('|')
        if (!usedOrders.has(prefix)) usedOrders.set(prefix, new Set())
        usedOrders.get(prefix)!.add(orden)
      }
    }

    // 2. Asignar dedup_key a cada fila (formato: fecha|importe.00|concepto_lower|orden)
    const rowsConKey = rows.map(r => {
      const f = (r.fecha ?? '').trim()
      const imp = (Number(r.importe) || 0).toFixed(2)
      const c = (r.concepto ?? '').trim().toLowerCase()
      const prefix = `${f}|${imp}|${c}`
      let orden = 0
      const usados = usedOrders.get(prefix) ?? new Set<number>()
      while (usados.has(orden)) orden++
      usados.add(orden)
      usedOrders.set(prefix, usados)
      return { ...r, dedup_key: `${prefix}|${orden}` }
    })

    // 3. Upsert con ignoreDuplicates: si la dedup_key ya existe en BD, salta la fila
    onProgress?.('saving', 0, rowsConKey.length)
    const { data: insertados, error } = await supabase
      .from('conciliacion')
      .upsert(rowsConKey, { onConflict: 'dedup_key', ignoreDuplicates: true })
      .select('*')
    if (error) throw error
    const insertedRows = (insertados ?? []) as Movimiento[]
    const ignorados = rows.length - insertedRows.length
    onProgress?.('saving', rowsConKey.length, rowsConKey.length)

    // Aplicar reglas activas a los recién insertados
    let autoCategorizados = 0
    const candidatosRules = insertedRows.filter(m => !m.categoria)
    if (candidatosRules.length > 0 && reglas.length > 0) {
      const reglasOrdenadas = [...reglas].filter(r => r.activa).sort((a, b) => b.prioridad - a.prioridad)
      onProgress?.('rules', 0, candidatosRules.length)
      let processed = 0
      for (const m of candidatosRules) {
        processed++
        const conceptoNorm = normalizarConcepto(m.concepto ?? '')
        if (conceptoNorm) {
          const regla = reglasOrdenadas.find(r => matchPatron(conceptoNorm, r.patron))
          if (regla && regla.categoria_codigo) {
            try {
              let gastoId: string | null = null
              try {
                gastoId = await syncGasto(m, regla.categoria_codigo, regla.tipo_categoria)
              } catch (e: any) {
                console.error('syncGasto (auto-import) failed:', e?.message ?? e)
              }
              const { error: upErr } = await supabase.from('conciliacion')
                .update({ categoria: regla.categoria_codigo, tipo: regla.tipo_categoria, gasto_id: gastoId })
                .eq('id', m.id)
              if (!upErr) autoCategorizados++
            } catch (e: any) {
              console.error('auto-categorizar failed:', e?.message ?? e)
            }
          }
        }
        if (processed % 25 === 0 || processed === candidatosRules.length) {
          onProgress?.('rules', processed, candidatosRules.length)
        }
      }
    }
    refresh()
    return { insertados: insertedRows.length, autoCategorizados, ignorados }
  }

  /**
   * Sincroniza el gasto asociado a un movimiento bancario:
   * - Si tipo === 'gasto' y codigo_categoria → crea o actualiza gasto
   * - Si tipo !== 'gasto' o codigo_categoria es null → borra el gasto si existía
   * Retorna gasto_id actualizado (o null).
   */
  async function syncGasto(mov: Movimiento, codigo_categoria: string | null, tipo: 'ingreso' | 'gasto' | null): Promise<string | null> {
    const esGasto = tipo === 'gasto' && !!codigo_categoria

    // Caso 1: ya no es gasto → borrar gasto existente
    if (!esGasto) {
      if (mov.gasto_id) {
        await supabase.from('gastos').delete().eq('id', mov.gasto_id)
      }
      return null
    }

    // Caso 2: es gasto → buscar categoria para resolver grupo
    const cat = categorias.find(c => c.tipo_parent === 'gasto' && c.codigo === codigo_categoria)
    const grupo = grupoFromCategoria(codigo_categoria, cat?.grupo ?? null)
    const subcategoria = categoriaToSubcategoria(codigo_categoria)

    const payload = {
      fecha: mov.fecha,
      categoria: codigo_categoria,
      grupo,
      subcategoria,
      proveedor: mov.proveedor,
      concepto: mov.concepto,
      importe: Math.abs(Number(mov.importe) || 0),
      conciliacion_id: mov.id,
    }

    if (mov.gasto_id) {
      // Update existente
      const { error } = await supabase.from('gastos').update(payload).eq('id', mov.gasto_id)
      if (error) throw error
      return mov.gasto_id
    }

    // Insert nuevo
    const { data, error } = await supabase.from('gastos').insert(payload).select('id').single()
    if (error) throw error
    return (data?.id as string) ?? null
  }

  async function updateCategoria(id: string, codigo_categoria: string | null, tipo: 'ingreso' | 'gasto' | null) {
    const mov = movimientos.find(m => m.id === id)
    if (!mov) return

    // 1. Sync gasto (create/update/delete)
    let nuevoGastoId: string | null = null
    try {
      nuevoGastoId = await syncGasto(mov, codigo_categoria, tipo)
    } catch (e: any) {
      // Registrar pero no abortar la categorización; el usuario verá el campo actualizado en Conciliación y puede reintentar.
      console.error('syncGasto failed:', e?.message ?? e)
    }

    // 2. Actualizar la fila de conciliación
    const { error } = await supabase.from('conciliacion')
      .update({ categoria: codigo_categoria, tipo, gasto_id: nuevoGastoId })
      .eq('id', id)
    if (error) throw error

    // 3. Aprender: upsert de regla por patrón normalizado
    if (codigo_categoria && tipo) {
      const patron = normalizarConcepto(mov.concepto ?? '')
      if (patron) {
        try {
          const { error: rErr } = await supabase
            .from('reglas_conciliacion')
            .upsert({
              patron,
              tipo_categoria: tipo,
              asigna_como: tipo,
              categoria_codigo: codigo_categoria,
              categoria_id: null,
              activa: true,
              prioridad: 0,
            }, { onConflict: 'patron' })
          if (rErr) console.error('upsert regla:', rErr.message)
        } catch (e: any) {
          console.error('upsert regla failed:', e?.message ?? e)
        }
      }
    }

    refresh()
  }

  async function createRegla(r: Omit<Regla, 'id'>) {
    const { error } = await supabase.from('reglas_conciliacion').insert(r)
    if (error) throw error
    refresh()
  }

  async function deleteRegla(id: string) {
    const { error } = await supabase.from('reglas_conciliacion').delete().eq('id', id)
    if (error) throw error
    refresh()
  }

  async function aplicarReglas() {
    const sinCat = movimientos.filter(m => !m.categoria)
    const reglasOrdenadas = [...reglas].filter(r => r.activa).sort((a, b) => b.prioridad - a.prioridad)
    let aplicados = 0
    for (const m of sinCat) {
      const conceptoNorm = normalizarConcepto(m.concepto ?? '')
      if (!conceptoNorm) continue
      const regla = reglasOrdenadas.find(r => matchPatron(conceptoNorm, r.patron))
      if (!regla) continue

      // Resolver código: priorizar categoria_codigo (nuevo), fallback a categoria_id legacy
      let codigo = regla.categoria_codigo
      if (!codigo && regla.categoria_id) {
        const cat = categorias.find(c => c.id === regla.categoria_id)
        codigo = cat?.codigo ?? null
      }
      if (!codigo) continue

      let gastoId: string | null = null
      try {
        gastoId = await syncGasto(m, codigo, regla.tipo_categoria)
      } catch (e: any) {
        console.error('syncGasto (aplicarReglas) failed:', e?.message ?? e)
      }

      const { error } = await supabase.from('conciliacion')
        .update({ categoria: codigo, tipo: regla.tipo_categoria, gasto_id: gastoId })
        .eq('id', m.id)
      if (!error) aplicados++
    }
    refresh()
    return aplicados
  }

  return {
    movimientos, reglas, categorias, loading, error,
    refresh, insertMovimientos, updateCategoria, createRegla, deleteRegla, aplicarReglas,
  }
}
