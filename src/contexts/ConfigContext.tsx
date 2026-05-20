import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

/* ═══════════════════════════════════════════════════════════
   ConfigContext: proveedor global de listas de marcas, categorías y canales activos.

   NOTA: Las comisiones REALES por canal se gestionan vía calcNetoPlataforma.ts
   (función calcNetoPorCanal y hook useConfigCanales). Este contexto solo expone
   la lista plana de canales activos para checks de UI ("¿hay canal Glovo activo?").

   Verificado mayo 2026: fórmulas reales en Notion 366c8b1f-6139-8145-b854-da4b1a107f08
   ═══════════════════════════════════════════════════════════ */

export interface MarcaConfig {
  id: string
  nombre: string
  activa: boolean
  estado: string | null
  margen_objetivo_pct: number | null
}

export interface CategoriaConfig {
  codigo: string
  nombre: string
  grupo: string
  activa: boolean
  signo: string
}

export interface CanalConfig {
  id: string
  canal: string
  comision_pct: number | null
  fijo_eur: number | null
  fee_periodo_eur: number | null
  activo: boolean
}

interface ConfigCtx {
  marcasActivas: MarcaConfig[]
  categoriasActivas: CategoriaConfig[]
  canalesActivos: CanalConfig[]
  loading: boolean
  refetch: () => Promise<void>
}

const ConfigContext = createContext<ConfigCtx>({
  marcasActivas: [],
  categoriasActivas: [],
  canalesActivos: [],
  loading: true,
  refetch: async () => {},
})

export function useConfig(): ConfigCtx {
  return useContext(ConfigContext)
}

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [marcasActivas, setMarcasActivas] = useState<MarcaConfig[]>([])
  const [categoriasActivas, setCategoriasActivas] = useState<CategoriaConfig[]>([])
  const [canalesActivos, setCanalesActivos] = useState<CanalConfig[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [marcasRes, catRes, canalesRes] = await Promise.allSettled([
      supabase.from('marcas').select('id,nombre,activa,estado,margen_objetivo_pct').order('nombre'),
      supabase.from('categorias_maestras').select('codigo,nombre,grupo,activa,signo').order('orden_grupo').order('orden_sub'),
      // Columnas reales de config_canales (verificadas mayo 2026): canal, comision_pct, fijo_eur, fee_periodo_eur, activo
      supabase.from('config_canales').select('id,canal,comision_pct,fijo_eur,fee_periodo_eur,activo').order('canal'),
    ])

    if (marcasRes.status === 'fulfilled' && marcasRes.value.data) {
      const all = marcasRes.value.data as MarcaConfig[]
      setMarcasActivas(all.filter(m => m.activa !== false && m.estado !== 'pausada'))
    }

    if (catRes.status === 'fulfilled' && catRes.value.data) {
      const all = catRes.value.data as CategoriaConfig[]
      setCategoriasActivas(all.filter(c => c.activa !== false))
    }

    if (canalesRes.status === 'fulfilled' && canalesRes.value.data) {
      const all = canalesRes.value.data as CanalConfig[]
      setCanalesActivos(all.filter(c => c.activo !== false))
    }

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <ConfigContext.Provider value={{ marcasActivas, categoriasActivas, canalesActivos, loading, refetch: load }}>
      {children}
    </ConfigContext.Provider>
  )
}
