import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

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

  async function updateCategoria(id: string, codigo_categoria: string | null, tipo: 'ingreso' | 'gasto' | null) {
    const { error } = await supabase.from('conciliacion')
      .update({ categoria: codigo_categoria, tipo })
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
      const { error } = await supabase.from('conciliacion')
        .update({ categoria: cat.codigo, tipo: regla.tipo_categoria })
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
