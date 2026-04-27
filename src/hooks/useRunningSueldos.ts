import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const EMILIO_ID = 'c5358d43-a9cc-4f4c-b0b3-99895bdf4354'
const RUBEN_ID  = '6ce69d55-60d0-423c-b68b-eb795a0f32fe'

export interface RunningSueldos {
  ruben: number
  emilio: number
  desgloseEmilio: {
    plataformas: number
    complementoSL: number
  }
  loading: boolean
  error: string | null
}

export function useRunningSueldos(mes: string): RunningSueldos {
  const [ruben, setRuben]         = useState(0)
  const [emilio, setEmilio]       = useState(0)
  const [plataformas, setPlataformas]   = useState(0)
  const [complementoSL, setComplementoSL] = useState(0)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    if (!mes) return
    let cancel = false

    // Derivar inicio y fin del mes (formato YYYY-MM-DD)
    const [year, month] = mes.split('-').map(Number)
    const inicioDia = `${mes}-01`
    const lastDay   = new Date(year, month, 0).getDate()
    const finDia    = `${mes}-${String(lastDay).padStart(2, '0')}`

    setLoading(true)
    setError(null)

    Promise.all([
      // Ingresos plataforma Emilio: SUM(importe) WHERE titular_id = EMILIO AND importe > 0 AND fecha BETWEEN
      supabase
        .from('conciliacion')
        .select('importe')
        .eq('titular_id', EMILIO_ID)
        .gt('importe', 0)
        .gte('fecha', inicioDia)
        .lte('fecha', finDia),

      // Complemento SL: SUM(ABS(importe)) WHERE titular_id = RUBEN AND categoria = 'RRH-NOM-EMI' AND fecha BETWEEN
      supabase
        .from('conciliacion')
        .select('importe')
        .eq('titular_id', RUBEN_ID)
        .eq('categoria', 'RRH-NOM-EMI')
        .gte('fecha', inicioDia)
        .lte('fecha', finDia),
    ])
      .then(([resPlat, resComp]) => {
        if (cancel) return
        if (resPlat.error) throw resPlat.error
        if (resComp.error) throw resComp.error

        const sumPlat = (resPlat.data ?? []).reduce(
          (acc: number, r: { importe: number }) => acc + Number(r.importe || 0),
          0,
        )
        const sumComp = (resComp.data ?? []).reduce(
          (acc: number, r: { importe: number }) => acc + Math.abs(Number(r.importe || 0)),
          0,
        )

        setPlataformas(sumPlat)
        setComplementoSL(sumComp)
        setEmilio(sumPlat + sumComp)
        // TODO: definir lógica de sueldo Rubén (autosueldo por definir)
        setRuben(0)
        setLoading(false)
      })
      .catch((err: any) => {
        if (cancel) return
        setError(err?.message ?? 'Error cargando sueldos')
        setLoading(false)
      })

    return () => { cancel = true }
  }, [mes])

  return {
    ruben,
    emilio,
    desgloseEmilio: { plataformas, complementoSL },
    loading,
    error,
  }
}
