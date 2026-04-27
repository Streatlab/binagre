/**
 * Tipos compartidos entre todos los parsers de plataforma.
 */

export type PlataformaKey = 'uber' | 'glovo' | 'just_eat' | 'rushour' | 'desconocido'

/**
 * Datos de una venta de plataforma (row en ventas_plataforma).
 * Resultado que devuelve cada parser.
 */
export interface VentaPlataformaInput {
  fecha_inicio_periodo: string   // ISO 'YYYY-MM-DD'
  fecha_fin_periodo: string      // ISO 'YYYY-MM-DD'
  plataforma: PlataformaKey
  marca: string                  // nombre marca o 'SIN_MARCA'
  bruto: number
  neto: number
  pedidos: number
  ticket_medio: number
  ingreso_colaborador: number
  fecha_pago: string | null      // ISO o null
  facturas_origen: string[]      // NIFs / números de factura acumulados
}

/**
 * Datos de un pedido individual (row en pedidos_plataforma).
 * Solo Glovo formato A genera estos.
 */
export interface PedidoPlataformaInput {
  fecha: string           // ISO 'YYYY-MM-DD'
  hora: string | null     // 'HH:MM:SS' o null
  plataforma: PlataformaKey
  marca: string
  plato: string | null
  precio_bruto: number
  promo: number
  courier: string | null
  glovo_id: string | null
  factura_origen: string | null
}

/**
 * Resultado completo de un parser.
 */
export interface ParserResult {
  ok: true
  ventas: VentaPlataformaInput[]
  pedidos: PedidoPlataformaInput[]
  advertencias: string[]
}

export interface ParserResultError {
  ok: false
  mensaje: string
  pendiente?: boolean
}

export type ParserOutput = ParserResult | ParserResultError

/**
 * Convierte fecha "DD/MM/YY" o "DD/MM/YYYY" a ISO 'YYYY-MM-DD'.
 * Devuelve null si el formato no es reconocido.
 */
export function parseFechaES(s: string): string | null {
  if (!s) return null
  const clean = s.trim()
  // DD/MM/YY
  const m1 = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
  if (m1) {
    const [, d, mo, y2] = m1
    const year = 2000 + parseInt(y2, 10)
    return `${year}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  // DD/MM/YYYY
  const m2 = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m2) {
    const [, d, mo, y] = m2
    return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  // YYYY-MM-DD (ya en formato ISO)
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean
  return null
}

/**
 * Parsea un importe en texto con coma o punto decimal.
 * "1.234,56" → 1234.56
 * "1234.56"  → 1234.56
 */
export function parseImporte(s: string | number | null | undefined): number {
  if (s === null || s === undefined || s === '') return 0
  if (typeof s === 'number') return isNaN(s) ? 0 : s
  const clean = String(s).replace(/\s/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.')
  const n = parseFloat(clean)
  return isNaN(n) ? 0 : n
}
