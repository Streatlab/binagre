import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { categoriaToSubcategoria, grupoFromCategoria } from '@/lib/categoriaMapping'
import { normalizarConcepto, matchPatron } from '@/lib/normalizarConcepto'
import { loadAliases, matchProveedor } from '@/lib/matchProveedor'
import { calcularDedupKey } from '@/lib/normalizar'
import { cargarReglas, aplicarReglas as aplicarReglasMDim } from '@/lib/aplicarReglas'
import { fetchAllPaginated } from '@/lib/supabasePaginated'

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
  titular_id?: string | null
  dedup_key?: string
  ordenante?: string | null
  beneficiario?: string | null
  factura_id?: string | null
  factura_data?: { pdf_drive_url: string | null; pdf_filename: string | null } | null
  doc_estado?: 'tiene' | 'falta' | 'no_requiere' | null
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
        const [movData, reg, cIng, cGas] = await Promise.all([
          fetchAllPaginated<Movimiento>(() =>
            supabase.from('conciliacion')
              .select('*, factura_data:facturas(pdf_drive_url, pdf_filename)')
              .order('fecha', { ascending: false })
          ),
          supabase.from('reglas_conciliacion').select('id, patron, tipo_categoria, categoria_id, categoria_codigo, activa, prioridad').order('prioridad', { ascending: false }),
          supabase.from('categorias_contables_ingresos').select('id, codigo, nombre'),
          supabase.from('categorias_contables_gastos').select('id, codigo, nombre, grupo'),
        ])
        if (cancel) return
        if (reg.error) throw reg.error
        if (cIng.error) throw cIng.error
        if (cGas.error) throw cGas.error
        setMovimientos(movData)
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
  ): Promise<{ insertados: number; duplicados: number; omitidos: number }> {
    if (rows.length === 0) return { insertados: 0, duplicados: 0, omitidos: 0 }

    const [reglasActivas, aliases] = await Promise.all([cargarReglas(), loadAliases()])

    let workRows: Omit<Movimiento, 'id'>[] = rows.map(r => ({
      ...r,
      proveedor: r.proveedor && r.proveedor.trim() !== ''
        ? r.proveedor
        : matchProveedor(r.concepto ?? '', aliases),
    }))

    let omitidos = 0
    const rowsPostReglas: Omit<Movimiento, 'id'>[] = []
    for (const r of workRows) {
      const { mov, borrar } = aplicarReglasMDim(
        {
          titular_id: r.titular_id ?? null,
          concepto: r.concepto ?? null,
          ordenante: r.ordenante ?? null,
          beneficiario: r.beneficiario ?? null,
          importe: r.importe,
          proveedor: r.proveedor,
          categoria: r.categoria,
        },
        reglasActivas,
      )
      if (borrar) {
        omitidos++
        continue
      }
      rowsPostReglas.push({
        ...r,
        proveedor: mov.proveedor ?? r.proveedor,
        categoria: mov.categoria ?? r.categoria,
      })
    }

    onProgress?.('saving', 0, rowsPostReglas.length)
    const rowsConKey = await Promise.all(rowsPostReglas.map(async r => ({
      ...r,
      dedup_key: await calcularDedupKey(
        r.titular_id ?? '',
        r.fecha ?? '',
        r.importe,
        r.concepto ?? '',
      ),
    })))

    const { data, error } = await supabase
      .from('conciliacion')
      .upsert(rowsConKey, { ignoreDuplicates: true, onConflict: 'titular_id,dedup_key' })
      .select()
    if (error) throw error

    onProgress?.('saving', rowsConKey.length, rowsConKey.length)

    const insertados = data?.length ?? 0
    const duplicados = rowsConKey.length - insertados

    refresh()
    return { insertados, duplicados, omitidos }
  }

  async function syncGasto(mov: Movimiento, codigo_categoria: string | null, tipo: 'ingreso' | 'gasto' | null): Promise<string | null> {
    const esGasto = tipo === 'gasto' && !!codigo_categoria

    if (!esGasto) {
      if (mov.gasto_id) {
        await supabase.from('gastos').delete().eq('id', mov.gasto_id)
      }
      return null
    }

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
      const { error } = await supabase.from('gastos').update(payload).eq('id', mov.gasto_id)
      if (error) throw error
      return mov.gasto_id
    }

    const { data, error } = await supabase.from('gastos').insert(payload).select('id').single()
    if (error) throw error
    return (data?.id as string) ?? null
  }

  async function updateCategoria(id: string, codigo_categoria: string | null, tipo: 'ingreso' | 'gasto' | null) {
    const mov = movimientos.find(m => m.id === id)
    if (!mov) return

    let nuevoGastoId: string | null = null
    try {
      nuevoGastoId = await syncGasto(mov, codigo_categoria, tipo)
    } catch (e: any) {
      console.error('syncGasto failed:', e?.message ?? e)
    }

    const { error } = await supabase.from('conciliacion')
      .update({ categoria: codigo_categoria, tipo, gasto_id: nuevoGastoId })
      .eq('id', id)
    if (error) throw error

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
