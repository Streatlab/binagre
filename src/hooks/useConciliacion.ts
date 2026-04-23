import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { categoriaToSubcategoria, grupoFromCategoria } from '@/lib/categoriaMapping'

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
  categoria_id: string
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
          supabase.from('reglas_conciliacion').select('*').order('prioridad', { ascending: false }),
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

  async function insertMovimientos(rows: Omit<Movimiento, 'id'>[]) {
    if (rows.length === 0) return
    const { error } = await supabase.from('conciliacion').insert(rows)
    if (error) throw error
    refresh()
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
    let aplicados = 0
    for (const m of sinCat) {
      const concepto = (m.concepto ?? '').toLowerCase()
      const regla = reglas.find(r => r.activa && concepto.includes(r.patron.toLowerCase()))
      if (!regla) continue
      const cat = categorias.find(c => c.id === regla.categoria_id)
      if (!cat) continue

      // Sync gasto si procede
      let gastoId: string | null = null
      try {
        gastoId = await syncGasto(m, cat.codigo, regla.tipo_categoria)
      } catch (e: any) {
        console.error('syncGasto (aplicarReglas) failed:', e?.message ?? e)
      }

      const { error } = await supabase.from('conciliacion')
        .update({ categoria: cat.codigo, tipo: regla.tipo_categoria, gasto_id: gastoId })
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
