import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface FacturaPendiente {
  id: string
  proveedor: string | null
  nif: string | null
  fecha_factura: string | null
  total: number | null
  numero_factura: string | null
  categoria_factura: string | null
  posible_duplicado: boolean
  aviso_aritmetica: boolean
  titular: string | null
}

export function useFacturasPendientes() {
  const [facturas, setFacturas] = useState<FacturaPendiente[]>([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('facturas')
      .select('id, proveedor, nif, fecha_factura, total, numero_factura, categoria_factura, posible_duplicado, aviso_aritmetica, titular')
      .or('posible_duplicado.eq.true,aviso_aritmetica.eq.true,categoria_factura.is.null')
      .order('fecha_factura', { ascending: false })
    setFacturas(
      (data ?? []).map((r: any) => ({
        id: r.id,
        proveedor: r.proveedor ?? null,
        nif: r.nif ?? null,
        fecha_factura: r.fecha_factura ?? null,
        total: r.total != null ? Number(r.total) : null,
        numero_factura: r.numero_factura ?? null,
        categoria_factura: r.categoria_factura ?? null,
        posible_duplicado: !!r.posible_duplicado,
        aviso_aritmetica: !!r.aviso_aritmetica,
        titular: r.titular ?? null,
      }))
    )
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const setCategoria = useCallback(async (id: string, categoria: string) => {
    await supabase.from('facturas').update({ categoria_factura: categoria }).eq('id', id)
    await cargar()
  }, [cargar])

  const resolverDuplicado = useCallback(async (id: string) => {
    await supabase.from('facturas').update({ posible_duplicado: false }).eq('id', id)
    await cargar()
  }, [cargar])

  const resolverAritmetica = useCallback(async (id: string, nuevoTotal: number) => {
    await supabase.from('facturas').update({ total: nuevoTotal, aviso_aritmetica: false }).eq('id', id)
    await cargar()
  }, [cargar])

  return { facturas, loading, setCategoria, resolverDuplicado, resolverAritmetica, refetch: cargar }
}
