import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface KpiCobertura {
  total_movimientos: number
  movimientos_con_factura: number
  pct_cobertura: number
  facturas_sin_categoria: number
  posibles_duplicados: number
  avisos_aritmetica: number
}

export function useKpiCobertura() {
  const [kpi, setKpi] = useState<KpiCobertura | null>(null)
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('v_kpi_cobertura_conciliacion')
      .select('*')
      .single()
    if (data) {
      setKpi({
        total_movimientos:    Number(data.movimientos_total ?? 0),
        movimientos_con_factura: Number(data.movimientos_con_factura ?? 0),
        pct_cobertura:        Number(data.pct_cobertura ?? 0),
        facturas_sin_categoria: Number(data.facturas_sin_categoria ?? 0),
        posibles_duplicados:  Number(data.facturas_posible_duplicado ?? 0),
        avisos_aritmetica:    Number(data.facturas_aviso_aritmetica ?? 0),
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  return { kpi, loading, refetch: cargar }
}
