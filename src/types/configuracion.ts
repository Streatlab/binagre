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

export type TipoMovimiento =
  | 'ingresos'
  | 'gastos_fijos'
  | 'gastos_variables'
  | 'personal'
  | 'marketing'
  | 'impuestos'

export type TipoGasto = 'fijo' | 'var' | 'pers' | 'mkt'

export interface CuentaBancaria {
  id: string
  alias: string
  banco: string
  iban_mask: string
  uso_principal: string | null
  saldo: number
  activa: boolean
  es_principal: boolean
}

export interface CategoriaIngreso {
  id: string
  codigo: string
  nombre: string
  canal_abv: CanalAbv | null
  importe_mes: number
  pct_mes: number
}

export interface CategoriaGasto {
  id: string
  codigo: string
  nombre: string
  tipo: TipoGasto
  importe_mes: number
}

export interface CuentaCategoria {
  cuenta_id: string
  tipo_movimiento: TipoMovimiento
  categoria_codigo: string
}

export interface ParametrosEscandallo {
  id: string
  margen_deseado_pct: number
  estructura_pct: number
  merma_default_pct: number
  semaforo_verde_pct: number
  semaforo_amarillo_pct: number
}
