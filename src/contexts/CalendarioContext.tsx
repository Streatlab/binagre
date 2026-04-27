import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

/* ── Types ──────────────────────────────────────────────────────────────────── */

export type TipoDia =
  | 'operativo'
  | 'solo_comida'
  | 'solo_cena'
  | 'cerrado'
  | 'festivo'
  | 'vacaciones'

export const TIPOS_NO_OPERATIVOS: TipoDia[] = ['cerrado', 'festivo', 'vacaciones']

export const TIPO_LABEL: Record<TipoDia, string> = {
  operativo:   'Operativo',
  solo_comida: 'Solo comida',
  solo_cena:   'Solo cena',
  cerrado:     'Cerrado',
  festivo:     'Festivo',
  vacaciones:  'Vacaciones',
}

function toKey(fecha: Date | string): string {
  if (typeof fecha === 'string') return fecha.slice(0, 10)
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/* ── Context interface ──────────────────────────────────────────────────────── */

interface CalendarioCtx {
  diasMap: Map<string, TipoDia>
  loading: boolean
  refetch: () => Promise<void>
  tipoDia: (fecha: Date | string) => TipoDia
  esDiaOperativo: (fecha: Date | string) => boolean
  diasOperativosEnRango: (inicio: Date | string, fin: Date | string) => number
  diasCerradosSemana: (lunes: Date | string) => number
}

const CalendarioContext = createContext<CalendarioCtx>({
  diasMap: new Map(),
  loading: true,
  refetch: async () => {},
  tipoDia: () => 'operativo',
  esDiaOperativo: () => true,
  diasOperativosEnRango: () => 0,
  diasCerradosSemana: () => 0,
})

/* ── Provider ───────────────────────────────────────────────────────────────── */

export function CalendarioProvider({ children }: { children: ReactNode }) {
  const [diasMap, setDiasMap] = useState<Map<string, TipoDia>>(new Map())
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('calendario_operativo')
      .select('fecha, tipo')
    if (data) {
      const m = new Map<string, TipoDia>()
      for (const row of data as { fecha: string; tipo: TipoDia }[]) {
        m.set(row.fecha.slice(0, 10), row.tipo)
      }
      setDiasMap(m)
    }
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  /* Helpers */
  const tipoDia = useCallback(
    (fecha: Date | string): TipoDia => diasMap.get(toKey(fecha)) ?? 'operativo',
    [diasMap]
  )

  const esDiaOperativo = useCallback(
    (fecha: Date | string): boolean => !TIPOS_NO_OPERATIVOS.includes(tipoDia(fecha)),
    [tipoDia]
  )

  const diasOperativosEnRango = useCallback(
    (inicio: Date | string, fin: Date | string): number => {
      const start = typeof inicio === 'string' ? new Date(inicio + 'T12:00:00') : new Date(inicio)
      const end   = typeof fin   === 'string' ? new Date(fin   + 'T12:00:00') : new Date(fin)
      let count = 0
      const cur = new Date(start)
      while (cur <= end) {
        if (esDiaOperativo(cur)) count++
        cur.setDate(cur.getDate() + 1)
      }
      return count
    },
    [esDiaOperativo]
  )

  const diasCerradosSemana = useCallback(
    (lunes: Date | string): number => {
      const start = typeof lunes === 'string' ? new Date(lunes + 'T12:00:00') : new Date(lunes)
      let count = 0
      for (let i = 0; i < 7; i++) {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        if (TIPOS_NO_OPERATIVOS.includes(tipoDia(d))) count++
      }
      return count
    },
    [tipoDia]
  )

  return (
    <CalendarioContext.Provider
      value={{ diasMap, loading, refetch: cargar, tipoDia, esDiaOperativo, diasOperativosEnRango, diasCerradosSemana }}
    >
      {children}
    </CalendarioContext.Provider>
  )
}

export const useCalendario = () => useContext(CalendarioContext)
