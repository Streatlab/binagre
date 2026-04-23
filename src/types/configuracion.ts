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

export type TipoProveedor = 'externo' | 'interno'
export type FrecuenciaCompra = 'diario' | 'semanal' | '2x_semana' | 'quincenal' | 'mensual'
export type GrupoFormato = 'solido' | 'liquido' | 'pieza'
export type UnidadBase = 'g' | 'ml' | 'ud'

export interface Proveedor {
  id: string
  abv: string
  nombre: string
  tipo: string | null
  tipo_proveedor: TipoProveedor
  frecuencia: FrecuenciaCompra | null
}

export interface FormatoCompra {
  id: string
  nombre: string
  grupo: GrupoFormato
  unidad_base: UnidadBase
  factor_conversion: number | null
  ejemplo: string | null
  orden: number
}

export interface CategoriaIngrediente { id: string; nombre: string; orden: number }
export interface CategoriaPlato { id: string; nombre: string; orden: number }
export interface SeccionCarta { id: string; nombre: string; marca_id: string; orden: number }

export interface UsuarioErp {
  id: string
  nombre: string
  email: string | null
  rol: 'admin' | 'cocina' | null
  avatar_color: string | null
  activo: boolean
  ultima_conexion: string | null
}

export interface PermisoRol {
  rol: 'admin' | 'cocina'
  modulo: string
  permitido: boolean
  orden: number
}

export type PlataformaAbv = 'UE' | 'GL' | 'JE'

export interface MarcaPlataformaAcceso {
  id: string
  marca_id: string
  plataforma: PlataformaAbv
  email_acceso: string | null
  activo: boolean
}

export interface CategoriaContableIngreso {
  id: string
  codigo: string
  nombre: string
  canal_abv: string | null
  orden: number
}

export interface CategoriaContableGasto {
  id: string
  codigo: string
  nombre: string
  tipo: 'fijo' | 'var' | 'pers' | 'mkt'
  orden: number
}

export interface ReglaConciliacion {
  id: string
  patron: string
  tipo_categoria: 'ingreso' | 'gasto'
  categoria_id: string
  prioridad: number
  activa: boolean
}

export interface TipoCocina {
  id: string
  nombre: string
  orden: number
}

export interface CategoriaContable {
  id: string
  nombre: string
  tipo: 'ingreso' | 'gasto'
  orden: number
}

export interface ReglaConciliacionNueva {
  id: string
  patron: string
  tipo_categoria: 'ingreso' | 'gasto'
  categoria_id: string
}

export interface CategoriaReceta {
  id: string
  nombre: string
  orden: number
}

export interface UnidadRelacion {
  id: string
  unidad_estandar: string
  unidad_minima: string
  factor: number
  orden: number
}

export interface FacturacionMarcaAgregada {
  marca_id: string
  marca_nombre: string
  ue_bruto: number
  gl_bruto: number
  je_bruto: number
  web_bruto: number
  dir_bruto: number
  total_bruto: number
  total_pedidos: number
  ue_pedidos: number
  gl_pedidos: number
  je_pedidos: number
}
