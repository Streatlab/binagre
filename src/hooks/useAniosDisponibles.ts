import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useAniosDisponibles(): number[] {
  const [anios, setAnios] = useState<number[]>([new Date().getFullYear()])

  useEffect(() => {
    let cancel = false
    ;(async () => {
      const { data, error } = await supabase
        .from('conciliacion')
        .select('fecha')
        .range(0, 99999)
      if (cancel || error || !data) return
      const set = new Set<number>()
      for (const r of data as { fecha: string | null }[]) {
        if (r.fecha) set.add(Number(r.fecha.slice(0, 4)))
      }
      set.add(new Date().getFullYear())
      setAnios(Array.from(set).sort((a, b) => b - a))
    })()
    return () => { cancel = true }
  }, [])

  return anios
}
