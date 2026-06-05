import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface PropuestaCuadre {
  id: string
  confirmado: boolean
  importe_asociado: number | null
  // factura
  factura_id: string
  factura_proveedor: string | null
  factura_nif: string | null
  factura_fecha: string | null
  factura_total: number | null
  factura_numero: string | null
  // movimiento bancario
  conciliacion_id: string
  mov_fecha: string | null
  mov_concepto: string | null
  mov_importe: number | null
  mov_proveedor: string | null
}

export function usePropuestasCuadre() {
  const [propuestas, setPropuestas] = useState<PropuestaCuadre[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('facturas_gastos')
      .select(`
        id, confirmado, importe_asociado,
        factura_id,
        facturas!facturas_gastos_factura_id_fkey(
          id, proveedor, nif, fecha_factura, total, numero_factura
        ),
        conciliacion_id,
        conciliacion!facturas_gastos_conciliacion_id_fkey(
          id, fecha, concepto, importe, proveedor
        )
      `)
      .eq('confirmado', false)
      .order('created_at', { ascending: false })

    if (err) { setError(err.message); setLoading(false); return }

    const rows: PropuestaCuadre[] = (data ?? []).map((r: any) => ({
      id: r.id,
      confirmado: r.confirmado,
      importe_asociado: r.importe_asociado != null ? Number(r.importe_asociado) : null,
      factura_id: r.factura_id,
      factura_proveedor: r.facturas?.proveedor ?? null,
      factura_nif: r.facturas?.nif ?? null,
      factura_fecha: r.facturas?.fecha_factura ?? null,
      factura_total: r.facturas?.total != null ? Number(r.facturas.total) : null,
      factura_numero: r.facturas?.numero_factura ?? null,
      conciliacion_id: r.conciliacion_id,
      mov_fecha: r.conciliacion?.fecha ?? null,
      mov_concepto: r.conciliacion?.concepto ?? null,
      mov_importe: r.conciliacion?.importe != null ? Number(r.conciliacion.importe) : null,
      mov_proveedor: r.conciliacion?.proveedor ?? null,
    }))

    setPropuestas(rows)
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const confirmar = useCallback(async (id: string) => {
    const { error: err } = await supabase
      .from('facturas_gastos')
      .update({ confirmado: true })
      .eq('id', id)
    if (err) throw new Error(err.message)
    setPropuestas(prev => prev.filter(p => p.id !== id))
  }, [])

  const rechazar = useCallback(async (id: string) => {
    const { error: err } = await supabase
      .from('facturas_gastos')
      .delete()
      .eq('id', id)
    if (err) throw new Error(err.message)
    setPropuestas(prev => prev.filter(p => p.id !== id))
  }, [])

  const deshacerConfirmar = useCallback(async (id: string) => {
    const { error: err } = await supabase
      .from('facturas_gastos')
      .update({ confirmado: false })
      .eq('id', id)
    if (err) throw new Error(err.message)
    await cargar()
  }, [cargar])

  const deshacerRechazar = useCallback(async (
    id: string,
    conciliacion_id: string,
    factura_id: string,
    importe_asociado: number | null
  ) => {
    const { error: err } = await supabase
      .from('facturas_gastos')
      .insert({ id, conciliacion_id, factura_id, importe_asociado, confirmado: false })
    if (err) throw new Error(err.message)
    await cargar()
  }, [cargar])

  return { propuestas, loading, error, cargar, confirmar, rechazar, deshacerConfirmar, deshacerRechazar }
}
