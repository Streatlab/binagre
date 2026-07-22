import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { setDecimalesNum } from '@/utils/format'

export interface MarcaConfig {
  id: string
  nombre: string
  activa?: boolean
  estado?: 'activa' | 'pausada' | string
  archivada_at?: string | null
}

export interface CategoriaConfig {
  codigo: string
  nombre: string
  grupo: string
  activa: boolean
  signo: number
}

export interface CanalConfig {
  id: number
  canal: string
  comision_pct: number
  fijo_eur: number
  fee_periodo_eur: number
  activo: boolean
}

interface ConfigCtx {
  marcasActivas: MarcaConfig[]
  categoriasActivas: CategoriaConfig[]
  canalesActivos: CanalConfig[]
  loading: boolean
  reload: () => Promise<void>
}

const Ctx = createContext<ConfigCtx>({
  marcasActivas: [],
  categoriasActivas: [],
  canalesActivos: [],
  loading: true,
  reload: async () => {},
})

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [marcasActivas, setMarcasActivas] = useState<MarcaConfig[]>([])
  const [categoriasActivas, setCategoriasActivas] = useState<CategoriaConfig[]>([])
  const [canalesActivos, setCanalesActivos] = useState<CanalConfig[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [marcasRes, catRes, canalesRes, formatoRes] = await Promise.allSettled([
      supabase.from('marcas').select('id,nombre,estado,archivada_at').order('nombre'),
      supabase.from('categorias_maestras').select('codigo,nombre,grupo,activa,signo').order('orden_grupo').order('orden_sub'),
      supabase.from('config_canales').select('id,canal,comision_pct,fijo_eur,fee_periodo_eur,activo').order('canal'),
      supabase.from('configuracion').select('valor').eq('clave', 'formato_numeros').maybeSingle(),
    ])

    if (marcasRes.status === 'fulfilled' && marcasRes.value.data) {
      const all = marcasRes.value.data as MarcaConfig[]
      setMarcasActivas(all.filter(m => !m.archivada_at && m.estado !== 'pausada'))
    }

    if (catRes.status === 'fulfilled' && catRes.value.data) {
      const all = catRes.value.data as CategoriaConfig[]
      setCategoriasActivas(all.filter(c => c.activa))
    }

    if (canalesRes.status === 'fulfilled' && canalesRes.value.data) {
      const all = canalesRes.value.data as CanalConfig[]
      setCanalesActivos(all.filter(c => c.activo))
    }

    if (formatoRes.status === 'fulfilled' && formatoRes.value.data?.valor) {
      const n = parseFloat(String(formatoRes.value.data.valor))
      if (Number.isFinite(n)) setDecimalesNum(n)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <Ctx.Provider value={{ marcasActivas, categoriasActivas, canalesActivos, loading, reload: load }}>
      {children}
    </Ctx.Provider>
  )
}

export function useConfig() { return useContext(Ctx) }
