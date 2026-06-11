export type ExtractedFactura = {
  proveedor_nombre: string
  numero_factura: string
  fecha_factura: string
  es_recapitulativa: boolean
  periodo_inicio: string | null
  periodo_fin: string | null
  tipo: 'proveedor' | 'plataforma'
  plataforma: 'uber' | 'glovo' | 'just_eat' | null
  nif_cliente: string | null
  nif_emisor: string | null
  nombre_cliente: string | null
  base_4: number
  iva_4: number
  base_10: number
  iva_10: number
  base_21: number
  iva_21: number
  total: number
  confianza: number
  plataforma_detalle?: Array<{
    marca_nombre: string
    pedidos: number
    ventas_brutas: number
    comision: number
    comision_iva: number
    fee_fijo: number
    ads: number
    promos_cubiertas: number
    neto_liquidado: number
    periodo_inicio: string
    periodo_fin: string
  }>
}
