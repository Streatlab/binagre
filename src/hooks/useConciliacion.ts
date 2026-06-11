import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { categoriaToSubcategoria, grupoFromCategoria } from '@/lib/categoriaMapping'
import { normalizarConcepto, matchPatron } from '@/lib/normalizarConcepto'
import { toast } from '@/lib/toastStore'
import { loadAliases, matchProveedor } from '@/lib/matchProveedor'
import { calcularDedupKey } from '@/lib/normalizar'
import { cargarReglas, invalidarCacheReglas, aplicarReglas as aplicarReglasMDim } from '@/lib/aplicarReglas'
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
        const [movData, reg, cPyg] = await Promise.all([
          fetchAllPaginated<Movimiento>(() =>
            supabase.from('conciliacion')
              .select('*, factura_data:facturas(pdf_drive_url, pdf_filename)')
              .order('fecha', { ascending: false })
          ),
          supabase.from('reglas_conciliacion').select('id, patron, tipo_categoria, categoria_id, categoria_codigo, activa, prioridad').order('prioridad', { ascending: false }),
          supabase.from('categorias_pyg').select('id, codigo, nombre, nivel, parent_id').eq('nivel', 3),
        ])
        if (cancel) return
        if (reg.error) throw reg.error
        if (cPyg.error) throw cPyg.error
        setMovimientos(movData)
        setReglas((reg.data ?? []) as Regla[])
        // categorias_pyg nivel 3: tipo_parent por prefijo de cuenta contable PGC
        // Cuentas 7xx = ingresos (grupo 7 PGC); resto = gastos
        const cats: CategoriaRef[] = (cPyg.data ?? []).map((c: any) => ({
          id: c.id,
          codigo: c.codigo,
          nombre: c.nombre,
          tipo_parent: String(c.codigo ?? '').startsWith('7') ? ('ingreso' as const) : ('gasto' as const),
        }))
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
  ): Promise<{ insertados: number; duplicados_bd: number; duplicados_lote: number; descartados: number; duplicados: number; omitidos: number }> {
    if (rows.length === 0) return { insertados: 0, duplicados_bd: 0, duplicados_lote: 0, descartados: 0, duplicados: 0, omitidos: 0 }

    // Invalidar caché para no usar reglas obsoletas (B-04)
    invalidarCacheReglas()
    const [reglasActivas, aliases] = await Promise.all([cargarReglas(), loadAliases()])

    const workRows = rows.map(r => ({
      ...r,
      proveedor: r.proveedor && r.proveedor.trim() !== ''
        ? r.proveedor
        : matchProveedor(r.concepto ?? '', aliases),
    }))

    // Paso 1: aplicar reglas; los borrados van a la bandeja movimientos_descartados (B-02)
    let descartados = 0
    type RowConLinea = Omit<Movimiento, 'id'> & { _line: number }
    const rowsPostReglas: RowConLinea[] = []

    for (let i = 0; i < workRows.length; i++) {
      const r = workRows[i]
      const { mov, borrar, reglaAplicada } = aplicarReglasMDim(
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
        descartados++
        // Guardar en bandeja para revisión en lugar de eliminar
        const dedupKey = await calcularDedupKey(r.titular_id ?? '', r.fecha ?? '', r.importe, r.concepto ?? '', i)
        supabase.from('movimientos_descartados').insert({
          fecha: r.fecha ?? null,
          concepto: r.concepto ?? null,
          importe: r.importe,
          titular_id: r.titular_id ?? null,
          proveedor: r.proveedor ?? null,
          ordenante: r.ordenante ?? null,
          beneficiario: r.beneficiario ?? null,
          regla_aplicada: reglaAplicada,
          dedup_key: dedupKey,
          motivo: 'regla_borrar',
        }).then(({ error }) => { if (error) console.error('movimientos_descartados:', error.message) })
        continue
      }
      rowsPostReglas.push({
        ...r,
        proveedor: mov.proveedor ?? r.proveedor,
        categoria: mov.categoria ?? r.categoria,
        _line: i,
      })
    }

    onProgress?.('saving', 0, rowsPostReglas.length)

    // Paso 2: calcular dedup_key con índice de línea (B-01, B-05)
    const rowsConKey = await Promise.all(rowsPostReglas.map(async ({ _line, ...r }) => ({
      ...r,
      dedup_key: await calcularDedupKey(r.titular_id ?? '', r.fecha ?? '', r.importe, r.concepto ?? '', _line),
    })))

    // Paso 3: dedup dentro del mismo lote (B-05)
    let duplicados_lote = 0
    const keysetLote = new Set<string>()
    const rowsLoteUnicos = rowsConKey.filter(r => {
      if (keysetLote.has(r.dedup_key)) { duplicados_lote++; return false }
      keysetLote.add(r.dedup_key)
      return true
    })

    // Paso 4: separar filas con/sin titular para dedup correcto (B-03)
    // PostgreSQL: NULL != NULL en índice único → filas sin titular no se deduplicarán por upsert
    const rowsConTitular = rowsLoteUnicos.filter(r => r.titular_id != null)
    const rowsSinTitular = rowsLoteUnicos.filter(r => r.titular_id == null)

    let duplicados_bd = 0
    let insertados = 0

    // Upsert filas CON titular (el índice unique funciona correctamente)
    if (rowsConTitular.length > 0) {
      const { data, error } = await supabase
        .from('conciliacion')
        .upsert(rowsConTitular, { ignoreDuplicates: true, onConflict: 'titular_id,dedup_key' })
        .select()
      if (error) throw error
      const ins = data?.length ?? 0
      insertados += ins
      duplicados_bd += rowsConTitular.length - ins
    }

    // Insert filas SIN titular con dedup manual contra BD (B-03)
    if (rowsSinTitular.length > 0) {
      const keys = rowsSinTitular.map(r => r.dedup_key)
      const { data: existentes } = await supabase
        .from('conciliacion')
        .select('dedup_key')
        .is('titular_id', null)
        .in('dedup_key', keys)
      const existentesSet = new Set((existentes ?? []).map((r: { dedup_key: string }) => r.dedup_key))
      const sinTitularNuevas = rowsSinTitular.filter(r => {
        if (existentesSet.has(r.dedup_key)) { duplicados_bd++; return false }
        return true
      })
      if (sinTitularNuevas.length > 0) {
        const { data, error } = await supabase
          .from('conciliacion')
          .insert(sinTitularNuevas)
          .select()
        if (error) throw error
        insertados += data?.length ?? 0
      }
    }

    onProgress?.('saving', rowsLoteUnicos.length, rowsLoteUnicos.length)
    refresh()

    return {
      insertados,
      duplicados_bd,
      duplicados_lote,
      descartados,
      // aliases de compatibilidad para código que aún use los nombres viejos
      duplicados: duplicados_bd + duplicados_lote,
      omitidos: descartados,
    }
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

    try {
      if (mov.gasto_id) {
        const { error } = await supabase.from('gastos').update(payload).eq('id', mov.gasto_id)
        if (error) throw error
        return mov.gasto_id
      }
      const { data, error } = await supabase.from('gastos').insert(payload).select('id').single()
      if (error) throw error
      return (data?.id as string) ?? null
    } catch (e: unknown) {
      // F-10: error visible al usuario; el movimiento queda categorizado pero sin fila en gastos
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      toast.error(`Categorizado pero sin fila en gastos (reintentar): ${msg}`)
      console.error('syncGasto failed:', msg)
      return null
    }
  }

  async function updateCategoria(id: string, codigo_categoria: string | null, tipo: 'ingreso' | 'gasto' | null) {
    const mov = movimientos.find(m => m.id === id)
    if (!mov) return

    // C-01: tipo SIEMPRE desde el tipo_parent de la categoría real, nunca del signo del importe
    const tipoReal: 'ingreso' | 'gasto' | null = !codigo_categoria
      ? null
      : (categorias.find(c => c.codigo === codigo_categoria)?.tipo_parent ?? tipo ?? null)

    const nuevoGastoId = await syncGasto(mov, codigo_categoria, tipoReal)

    const { error } = await supabase.from('conciliacion')
      .update({ categoria: codigo_categoria, tipo: tipoReal, gasto_id: nuevoGastoId, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error

    if (codigo_categoria && tipoReal) {
      const patron = normalizarConcepto(mov.concepto ?? '')
      if (patron) {
        try {
          const { error: rErr } = await supabase
            .from('reglas_conciliacion')
            .upsert({
              patron,
              tipo_categoria: tipoReal,
              asigna_como: tipoReal,
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
        .update({ categoria: codigo, tipo: regla.tipo_categoria, gasto_id: gastoId, updated_at: new Date().toISOString() })
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
