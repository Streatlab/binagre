import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

const LS_KEY = 'erp_filtro_titular'

export interface Titular {
  id: string
  nombre: string
  nif: string
  color: string
  carpeta_drive: string
  cuenta_iban: string | null
  cuenta_banco_nombre: string | null
  activo: boolean
  orden: number
}

export type FiltroTitular = 'unificado' | string

interface TitularCtx {
  filtro: FiltroTitular
  setFiltro: (f: FiltroTitular) => void
  titulares: Titular[]
  recargar: () => Promise<void>
}

const TitularContext = createContext<TitularCtx>({
  filtro: 'unificado',
  setFiltro: () => {},
  titulares: [],
  recargar: async () => {},
})

export function TitularProvider({ children }: { children: ReactNode }) {
  const [filtro, setFiltroRaw] = useState<FiltroTitular>(() => {
    if (typeof window === 'undefined') return 'unificado'
    return (localStorage.getItem(LS_KEY) as FiltroTitular) || 'unificado'
  })
  const [titulares, setTitulares] = useState<Titular[]>([])

  const recargar = async () => {
    const { data } = await supabase
      .from('titulares')
      .select('*')
      .eq('activo', true)
      .order('orden')
    if (data) setTitulares(data as Titular[])
  }

  useEffect(() => {
    recargar()
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem(LS_KEY, filtro)
  }, [filtro])

  const setFiltro = (f: FiltroTitular) => setFiltroRaw(f)

  return (
    <TitularContext.Provider value={{ filtro, setFiltro, titulares, recargar }}>
      {children}
    </TitularContext.Provider>
  )
}

export const useTitular = () => useContext(TitularContext)
