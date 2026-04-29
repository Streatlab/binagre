/**
 * Tipos compartidos del módulo Tab Resumen v2
 */

export interface RowFacturacion {
  fecha: string
  uber_pedidos: number; uber_bruto: number
  glovo_pedidos: number; glovo_bruto: number
  je_pedidos: number; je_bruto: number
  web_pedidos: number; web_bruto: number
  directa_pedidos: number; directa_bruto: number
  total_pedidos: number; total_bruto: number
}

export interface CanalStat {
  id: 'uber' | 'glovo' | 'je' | 'web' | 'dir'
  label: string
  color: string
  bruto: number
  neto: number
  pedidos: number
  pct: number      // % sobre bruto total
  ticket: number
  margen: number   // margen % (neto/bruto*100)
}

export interface ObjetivosVentas {
  diario: number
  semanal: number
  mensual: number
  anual: number
}

export interface TareaPendienteItem {
  id: string
  concepto: string
  fechaEsperada: string
  diasOffset: number     // negativo = atrasado, 0 = hoy, positivo = futuro
}

export interface PagoProximoItem {
  concepto: string
  fecha: string
  importe: number
}

export interface TopVentaItem {
  ranking: number
  producto: string
  canal: 'uber' | 'glovo' | 'je' | 'web' | 'dir'
  pedidos: number
  importe: number
}

export interface ToastFn {
  (msg: string, type: 'success' | 'warning'): void
}
