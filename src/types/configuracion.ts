export type EstadoMarca = 'activa' | 'pausada'
export type RolUsuario = 'admin' | 'cocina'
export type CanalAbv = 'UE' | 'GL' | 'JE' | 'WEB' | 'DIR'

export interface Marca {
  id: string
  nombre: string
  cocina: string | null
  responsable_id: string | null
  tm_medio: number
  objetivo_mes: number
  estado: EstadoMarca
  es_anchor: boolean
  created_at?: string
}

export interface MarcaConJoin extends Marca {
  responsable_nombre?: string | null
  responsable_avatar?: string | null
  canales_abvs: CanalAbv[]
}

export interface Canal {
  id: string
  nombre: string
  abv: CanalAbv
  color: string
  comision_pct: number
  tarifa_fija: number
  iva_pct: number
  markup_pct: number
  activo: boolean
}

export interface MarcaCanal {
  marca_id: string
  canal_id: string
  activo: boolean
}

export interface UsuarioResponsable {
  id: string
  nombre: string
  email: string | null
  rol: RolUsuario
  avatar_color: string | null
}
