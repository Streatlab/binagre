import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface ConfigCanal {
  id: string
  canal: string
  comision_pct: number
  coste_fijo: number
  margen_deseado_pct: number
  activo: boolean
}

export interface ConfigProveedor {
  id: string
  abv: string
  nombre_completo: string
  marca_asociada?: string | null
  categoria?: string | null
  activo: boolean
}

export interface AppConfig {
  canales: ConfigCanal[]
  proveedores: ConfigProveedor[]
  estructura_pct: number
  margen_deseado_pct: number // default global (fallback)
  categorias: string[]
  unidades: string[]
  unidades_std: string[]
  unidades_min: string[]
  formatos: string[]
  loading: boolean
  refresh: () => void
}

const DEFAULT_CANALES: ConfigCanal[] = [
  { id: '', canal: 'Uber Eats', comision_pct: 30, coste_fijo: 0.82, margen_deseado_pct: 15, activo: true },
  { id: '', canal: 'Glovo', comision_pct: 30, coste_fijo: 0, margen_deseado_pct: 15, activo: true },
  { id: '', canal: 'Just Eat', comision_pct: 30, coste_fijo: 0, margen_deseado_pct: 15, activo: true },
  { id: '', canal: 'Web Propia', comision_pct: 7, coste_fijo: 0, margen_deseado_pct: 15, activo: true },
  { id: '', canal: 'Venta Directa', comision_pct: 0, coste_fijo: 0, margen_deseado_pct: 15, activo: true },
]

const DEFAULT_PROVEEDORES: ConfigProveedor[] = [
  { id: '', abv: 'MER', nombre_completo: 'Hacendado', marca_asociada: 'Hacendado', categoria: 'Supermercado', activo: true },
  { id: '', abv: 'ALC', nombre_completo: 'Auchan', marca_asociada: 'Auchan', categoria: 'Supermercado', activo: true },
  { id: '', abv: 'MRM', nombre_completo: 'Cocina Interna', marca_asociada: 'Cocina Interna', categoria: 'Interno', activo: true },
  { id: '', abv: 'EPS', nombre_completo: 'Cocina Interna', marca_asociada: 'Cocina Interna', categoria: 'Interno', activo: true },
  { id: '', abv: 'CHI', nombre_completo: 'Gruñona', marca_asociada: 'Gruñona', categoria: 'Mayorista', activo: true },
  { id: '', abv: 'JAS', nombre_completo: 'Jaserba', marca_asociada: 'Jaserba', categoria: 'Mayorista', activo: true },
  { id: '', abv: 'PAM', nombre_completo: 'Pamesa', marca_asociada: 'Pamesa', categoria: 'Cárnico', activo: true },
  { id: '', abv: 'ENV', nombre_completo: 'Envases Garcia', marca_asociada: 'Envases Garcia', categoria: 'Packaging', activo: true },
  { id: '', abv: 'EMB', nombre_completo: 'Embutidos', marca_asociada: 'Embutidos', categoria: 'Cárnico', activo: true },
  { id: '', abv: 'TGT', nombre_completo: 'Target', marca_asociada: 'Target', categoria: 'Mayorista', activo: true },
  { id: '', abv: 'PAS', nombre_completo: 'Pastas', marca_asociada: 'Pastas', categoria: 'Especialista', activo: true },
  { id: '', abv: 'LID', nombre_completo: 'Lidl', marca_asociada: 'Lidl', categoria: 'Supermercado', activo: true },
]

const DEFAULT_CATS = ['Aves/Carnes', 'Lácteos y Huevos', 'Cereales/Legumbres', 'Frutas/Verduras', 'Conservas/Quinta', 'Aceites/Grasas', 'Condimentos/Salsas', 'Packaging', 'Bebidas', 'Vacío', 'Mermas', 'Pescado/Marisco', 'Congelados', 'EPS', 'MRM']
const DEFAULT_UNS = ['Kg.', 'gr.', 'L.', 'ml.', 'Ud.', 'ud.', 'Docena', 'Caja', 'Sobre', 'Bote', 'Ración', 'Rc.']
const DEFAULT_UNS_STD = ['Kg.', 'L.', 'Ud.', 'Docena']
const DEFAULT_UNS_MIN = ['gr.', 'ml.', 'ud.']
const DEFAULT_FORMATS = ['Garrafa', 'Caja', 'Bandeja', 'Bolsa/Malla', 'Bote', 'EP/Receta', 'Unidad', 'Lata', 'Litro', 'Paquete', 'Botella', 'Kg.', 'Ración']

export function useConfig(): AppConfig {
  const [canales, setCanales] = useState<ConfigCanal[]>(DEFAULT_CANALES)
  const [proveedores, setProveedores] = useState<ConfigProveedor[]>(DEFAULT_PROVEEDORES)
  const [estructuraPct, setEstructuraPct] = useState(30)
  const [margenPct, setMargenPct] = useState(15)
  const [categorias, setCategorias] = useState<string[]>(DEFAULT_CATS)
  const [unidades, setUnidades] = useState<string[]>(DEFAULT_UNS)
  const [unidadesStd, setUnidadesStd] = useState<string[]>(DEFAULT_UNS_STD)
  const [unidadesMin, setUnidadesMin] = useState<string[]>(DEFAULT_UNS_MIN)
  const [formatos, setFormatos] = useState<string[]>(DEFAULT_FORMATS)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [canalRes, provRes, confRes] = await Promise.all([
          supabase.from('config_canales').select('*').order('canal'),
          supabase.from('config_proveedores').select('*').order('abv'),
          supabase.from('configuracion').select('*'),
        ])
        if (cancelled) return

        if (canalRes.data && canalRes.data.length > 0) {
          setCanales(canalRes.data.map((c: any) => ({
            id: c.id, canal: c.canal,
            comision_pct: c.comision_pct ?? 0,
            coste_fijo: c.coste_fijo ?? 0,
            margen_deseado_pct: c.margen_deseado_pct ?? 15,
            activo: c.activo ?? true,
          })))
        }

        if (provRes.data && provRes.data.length > 0) {
          setProveedores(provRes.data as ConfigProveedor[])
        }

        if (confRes.data) {
          const map = new Map<string, string>()
          for (const r of confRes.data as { clave: string; valor: string }[]) {
            map.set(r.clave, r.valor)
          }
          const e = map.get('estructura_pct')
          if (e) setEstructuraPct(parseFloat(e))
          const m = map.get('margen_deseado_pct')
          if (m) setMargenPct(parseFloat(m))
          try {
            const cats = JSON.parse(map.get('categorias') || '[]')
            if (Array.isArray(cats) && cats.length) setCategorias(cats)
          } catch { /* ignore */ }
          try {
            const uns = JSON.parse(map.get('unidades') || '[]')
            if (Array.isArray(uns) && uns.length) setUnidades(uns)
          } catch { /* ignore */ }
          try {
            const unsStd = JSON.parse(map.get('unidades_estandar') || '[]')
            if (Array.isArray(unsStd) && unsStd.length) setUnidadesStd(unsStd)
          } catch { /* ignore */ }
          try {
            const unsMin = JSON.parse(map.get('unidades_minimas') || '[]')
            if (Array.isArray(unsMin) && unsMin.length) setUnidadesMin(unsMin)
          } catch { /* ignore */ }
          try {
            const fs = JSON.parse(map.get('formatos_compra') || '[]')
            if (Array.isArray(fs) && fs.length) setFormatos(fs)
          } catch { /* ignore */ }
        }
      } catch (err) {
        console.warn('useConfig: error cargando config, usando defaults', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [tick])

  const refresh = useCallback(() => setTick(t => t + 1), [])

  return {
    canales,
    proveedores,
    estructura_pct: estructuraPct,
    margen_deseado_pct: margenPct,
    categorias,
    unidades,
    unidades_std: unidadesStd,
    unidades_min: unidadesMin,
    formatos,
    loading,
    refresh,
  }
}

/** Calcula waterfall para un canal concreto. margen_deseado viene del canal (no global) */
export function calcWaterfall(
  costeRac: number,
  pvp: number,
  comisionPct: number,
  costeFijo: number,
  estructuraPct: number,
  margenDeseadoPct: number,
) {
  // Normaliza: acepta tanto 30 (%) como 0.30 (decimal)
  const com = comisionPct > 1 ? comisionPct / 100 : comisionPct
  const estr = estructuraPct > 1 ? estructuraPct / 100 : estructuraPct
  const margenD = margenDeseadoPct > 1 ? margenDeseadoPct / 100 : margenDeseadoPct

  const neto = pvp > 0 ? pvp / 1.1 : 0
  const costeMP = costeRac
  const costeEstructura = estr * neto
  const costePlatR = pvp * com + costeFijo
  const costePlatC = pvp * com * 1.21 + costeFijo
  const costeTotalR = costeMP + costeEstructura + costePlatR
  const costeTotalC = costeMP + costeEstructura + costePlatC

  const denomR = 1 - estr - com - margenD
  const denomC = 1 - estr - com * 1.21 - margenD
  const pvpRecR = denomR > 0 ? (costeMP * 1.1) / denomR : 0
  const pvpRecC = denomC > 0 ? (costeMP * 1.1) / denomC : 0

  const k = costeMP > 0 && pvp > 0 ? pvp / costeMP : 0

  const margenR = neto - costeTotalR
  const margenC = neto - costeTotalC
  const pctMargenR = neto > 0 ? (margenR / neto) * 100 : 0
  const pctMargenC = neto > 0 ? (margenC / neto) * 100 : 0

  // IVA neto = (PVP - PVP×comision%×1.21)/1.1 × 0.10 - PVP×comision%×0.21
  const ivaNeto = pvp > 0 ? ((pvp - pvp * com * 1.21) / 1.1) * 0.1 - pvp * com * 0.21 : 0
  const provIva = pvp * com * 0.21
  const ivaRepercutido = pvp > 0 ? ((pvp - pvp * com * 1.21) / 1.1) * 0.1 : 0
  const ivaSoportado = provIva

  // Margen deseado en € (objetivo): pvp × margenD (mismo target para Real y Cash)
  const margenDeseadoR = pvp * margenD
  const margenDeseadoC = pvp * margenD

  return {
    neto, costeMP, costeEstructura,
    costePlatR, costePlatC,
    costeTotalR, costeTotalC,
    pvpRecR, pvpRecC,
    k,
    margenR, margenC,
    pctMargenR, pctMargenC,
    ivaNeto, provIva,
    ivaRepercutido, ivaSoportado,
    margenDeseadoR, margenDeseadoC,
    margenDeseadoPct,
  }
}
