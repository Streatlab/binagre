export interface Movimiento {
  id: string
  fecha: string
  concepto: string
  importe: number
  categoria_id: string | null
  contraparte: string
  auto_categorizado?: boolean
  gasto_id?: string | null
}

export interface Categoria {
  id: string
  nombre: string
  tipo: 'ingreso' | 'gasto' | 'mixto'
  color?: string
}

export interface Regla {
  patron: string
  categoria_id: string
}
