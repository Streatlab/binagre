import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const EMILIO_ID = 'c5358d43-a9cc-4f4c-b0b3-99895bdf4354'
const RUBEN_ID  = '6ce69d55-60d0-423c-b68b-eb795a0f32fe'

function fechaISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export interface SueldosData {
  loading: boolean
  error: string | null
  emilio: {
    plataformas: number
    complementoSL: number
    total: number
  }
  ruben: {
    ingresosNetos: number
    gastosNetos: number
    resultado: number
  }
  ultimos90d: {
    emilio_mensual_real: number
  }
}

export function useSueldos(desde: Date, hasta: Date): SueldosData {
  const [data, setData] = useState<SueldosData>({
    loading: true,
    error: null,
    emilio: { plataformas: 0, complementoSL: 0, total: 0 },
    ruben: { ingresosNetos: 0, gastosNetos: 0, resultado: 0 },
    ultimos90d: { emilio_mensual_real: 0 },
  })

  useEffect(() => {
    let cancel = false

    const desdeFecha = fechaISO(desde)
    const hastaFecha = fechaISO(hasta)

    const hasta90 = new Date(hasta)
    const desde90 = new Date(hasta)
    desde90.setDate(desde90.getDate() - 89)
    const desde90Fecha = fechaISO(desde90)
    const hasta90Fecha = fechaISO(hasta90)

    setData(d => ({ ...d, loading: true, error: null }))

    Promise.all([
      // emilio.plataformas: ingresos de plataforma en cuenta de Emilio
      supabase
        .from('conciliacion')
        .select('importe')
        .eq('titular_id', EMILIO_ID)
        .gt('importe', 0)
        .like('categoria', '1.%')
        .gte('fecha', desdeFecha)
        .lte('fecha', hastaFecha),

      // emilio.complementoSL: lo que paga la empresa a Emilio (2.21.3)
      supabase
        .from('conciliacion')
        .select('importe')
        .eq('categoria', '2.21.3')
        .gte('fecha', desdeFecha)
        .lte('fecha', hastaFecha),

      // ruben.ingresos: ingresos en cuenta de Rubén excl. traspasos internos
      supabase
        .from('conciliacion')
        .select('importe')
        .eq('titular_id', RUBEN_ID)
        .gt('importe', 0)
        .not('categoria', 'like', '3.%')
        .gte('fecha', desdeFecha)
        .lte('fecha', hastaFecha),

      // ruben.gastos: gastos en cuenta de Rubén excl. traspasos internos
      supabase
        .from('conciliacion')
        .select('importe')
        .eq('titular_id', RUBEN_ID)
        .lt('importe', 0)
        .not('categoria', 'like', '3.%')
        .gte('fecha', desdeFecha)
        .lte('fecha', hastaFecha),

      // ultimos90d: emilio plataformas
      supabase
        .from('conciliacion')
        .select('importe')
        .eq('titular_id', EMILIO_ID)
        .gt('importe', 0)
        .like('categoria', '1.%')
        .gte('fecha', desde90Fecha)
        .lte('fecha', hasta90Fecha),

      // ultimos90d: emilio complementoSL
      supabase
        .from('conciliacion')
        .select('importe')
        .eq('categoria', '2.21.3')
        .gte('fecha', desde90Fecha)
        .lte('fecha', hasta90Fecha),
    ])
      .then(([resPlat, resComp, resRubIng, resRubGas, res90Plat, res90Comp]) => {
        if (cancel) return
        if (resPlat.error) throw resPlat.error
        if (resComp.error) throw resComp.error
        if (resRubIng.error) throw resRubIng.error
        if (resRubGas.error) throw resRubGas.error
        if (res90Plat.error) throw res90Plat.error
        if (res90Comp.error) throw res90Comp.error

        const sum = (rows: { importe: number }[]) =>
          (rows ?? []).reduce((acc, r) => acc + Number(r.importe || 0), 0)
        const sumAbs = (rows: { importe: number }[]) =>
          (rows ?? []).reduce((acc, r) => acc + Math.abs(Number(r.importe || 0)), 0)

        const plataformas   = sum(resPlat.data ?? [])
        const complementoSL = sumAbs(resComp.data ?? [])
        const emilioTotal   = plataformas + complementoSL

        const ingresosNetos = sum(resRubIng.data ?? [])
        const gastosNetos   = sumAbs(resRubGas.data ?? [])
        const resultado     = ingresosNetos - gastosNetos

        const plat90  = sum(res90Plat.data ?? [])
        const comp90  = sumAbs(res90Comp.data ?? [])
        const total90 = plat90 + comp90
        const emilio_mensual_real = total90 / 3

        setData({
          loading: false,
          error: null,
          emilio: { plataformas, complementoSL, total: emilioTotal },
          ruben: { ingresosNetos, gastosNetos, resultado },
          ultimos90d: { emilio_mensual_real },
        })
      })
      .catch((err: unknown) => {
        if (cancel) return
        setData(d => ({ ...d, loading: false, error: (err as Error)?.message ?? 'Error cargando sueldos' }))
      })

    return () => { cancel = true }
  }, [desde.getTime(), hasta.getTime()])

  return data
}
