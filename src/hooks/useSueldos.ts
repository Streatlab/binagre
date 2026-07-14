import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const EMILIO_ID = 'c5358d43-a9cc-4f4c-b0b3-99895bdf4354'
const RUBEN_ID  = '6ce69d55-60d0-423c-b68b-eb795a0f32fe'

// Tras la unificacion de categorias (11-jul-2026), Ruben y Emilio comparten la categoria
// 2.21.2 "Sueldo direccion". La categoria 2.21.3 ("Sueldo Emilio") ESTA DESACTIVADA y no
// tiene ni un solo movimiento: cualquier consulta contra ella devuelve cero.
//
// El unico criterio real para separar a los socios es lo que dice el CONCEPTO del extracto
// bancario ("sueldo de ruben", "emilio bbva"). El extracto del BBVA no trae beneficiario,
// asi que no hay otra forma. Esa logica vive en la vista `v_sueldos_socios` de Supabase,
// que clasifica cada movimiento en RUBEN / EMILIO / SIN_IDENTIFICAR.
//
// Los movimientos SIN_IDENTIFICAR se exponen aparte a proposito: no se reparten a ojo entre
// los socios. Si el banco no dice a quien fue la transferencia, el ERP tampoco se lo inventa.

function fechaISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

interface FilaSueldo {
  importe: number
  socio: 'RUBEN' | 'EMILIO' | 'SIN_IDENTIFICAR'
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
  /** Transferencias de sueldo que el banco no permite atribuir a ningun socio. */
  sinIdentificar: {
    importe: number
    n: number
  }
  ultimos90d: {
    emilio_mensual_real: number
  }
}

const VACIO: SueldosData = {
  loading: true,
  error: null,
  emilio: { plataformas: 0, complementoSL: 0, total: 0 },
  ruben: { ingresosNetos: 0, gastosNetos: 0, resultado: 0 },
  sinIdentificar: { importe: 0, n: 0 },
  ultimos90d: { emilio_mensual_real: 0 },
}

export function useSueldos(desde: Date, hasta: Date): SueldosData {
  const [data, setData] = useState<SueldosData>(VACIO)

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
      // emilio.plataformas: ingresos de plataforma que entran en la cuenta de Emilio
      supabase
        .from('conciliacion')
        .select('importe')
        .eq('titular_id', EMILIO_ID)
        .gt('importe', 0)
        .like('categoria', '1.1.%')
        .gte('fecha', desdeFecha)
        .lte('fecha', hastaFecha),

      // sueldos de direccion del periodo, ya clasificados por socio en la vista
      supabase
        .from('v_sueldos_socios')
        .select('importe, socio')
        .gte('fecha', desdeFecha)
        .lte('fecha', hastaFecha),

      // ruben.ingresos: entradas en la cuenta de Ruben, excluyendo movimientos internos
      supabase
        .from('conciliacion')
        .select('importe')
        .eq('titular_id', RUBEN_ID)
        .gt('importe', 0)
        .not('categoria', 'like', '3.%')
        .gte('fecha', desdeFecha)
        .lte('fecha', hastaFecha),

      // ruben.gastos: salidas de la cuenta de Ruben, excluyendo movimientos internos
      supabase
        .from('conciliacion')
        .select('importe')
        .eq('titular_id', RUBEN_ID)
        .lt('importe', 0)
        .not('categoria', 'like', '3.%')
        .gte('fecha', desdeFecha)
        .lte('fecha', hastaFecha),

      // ultimos 90 dias: plataformas de Emilio
      supabase
        .from('conciliacion')
        .select('importe')
        .eq('titular_id', EMILIO_ID)
        .gt('importe', 0)
        .like('categoria', '1.1.%')
        .gte('fecha', desde90Fecha)
        .lte('fecha', hasta90Fecha),

      // ultimos 90 dias: sueldos de direccion por socio
      supabase
        .from('v_sueldos_socios')
        .select('importe, socio')
        .gte('fecha', desde90Fecha)
        .lte('fecha', hasta90Fecha),
    ])
      .then(([resPlat, resSueldos, resRubIng, resRubGas, res90Plat, res90Sueldos]) => {
        if (cancel) return
        if (resPlat.error) throw resPlat.error
        if (resSueldos.error) throw resSueldos.error
        if (resRubIng.error) throw resRubIng.error
        if (resRubGas.error) throw resRubGas.error
        if (res90Plat.error) throw res90Plat.error
        if (res90Sueldos.error) throw res90Sueldos.error

        const sum = (rows: { importe: number }[] | null) =>
          (rows ?? []).reduce((acc, r) => acc + Number(r.importe || 0), 0)

        const porSocio = (rows: FilaSueldo[] | null, socio: FilaSueldo['socio']) =>
          (rows ?? []).filter(r => r.socio === socio).reduce((acc, r) => acc + Math.abs(Number(r.importe || 0)), 0)

        const sueldos = (resSueldos.data ?? []) as FilaSueldo[]
        const sueldos90 = (res90Sueldos.data ?? []) as FilaSueldo[]

        const plataformas   = sum(resPlat.data)
        const complementoSL = porSocio(sueldos, 'EMILIO')
        const emilioTotal   = plataformas + complementoSL

        const ingresosNetos = sum(resRubIng.data)
        const gastosNetos   = Math.abs(sum(resRubGas.data))
        const resultado     = ingresosNetos - gastosNetos

        const noIdentificados = sueldos.filter(r => r.socio === 'SIN_IDENTIFICAR')
        const sinIdentificar = {
          importe: noIdentificados.reduce((acc, r) => acc + Math.abs(Number(r.importe || 0)), 0),
          n: noIdentificados.length,
        }

        const plat90  = sum(res90Plat.data)
        const comp90  = porSocio(sueldos90, 'EMILIO')
        const emilio_mensual_real = (plat90 + comp90) / 3

        setData({
          loading: false,
          error: null,
          emilio: { plataformas, complementoSL, total: emilioTotal },
          ruben: { ingresosNetos, gastosNetos, resultado },
          sinIdentificar,
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
