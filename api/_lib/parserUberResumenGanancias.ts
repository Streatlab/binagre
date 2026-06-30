// parserUberResumenGanancias — Parser del CSV "emea" de 48 filas (U2).
// Usado como FALLBACK cuando no hay PDF U1 (resumen mensual).
// Columnas verificadas (CSV export Uber Eats):
//   Cantidad de pedidos | Ventas (sin IVA) | Ventas (con IVA) |
//   Tarifa por canje de la oferta | Ajuste de marketing |
//   Tasa de servicio | Pago total | Fecha de pago
//
// Una fila = un periodo de pago (típicamente semanal).
// Si se importa el mensual (U1) para el mismo periodo, este NO se inserta (anti-duplicado en volcar).

import * as XLSX from 'xlsx'
import type { VentaPlataformaParseada } from './parserJustEatFactura.js'

function imp(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const s = String(v).replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

function isoFecha(v: unknown): string | null {
  if (!v) return null
  const s = String(v).trim()
  // DD/MM/YYYY
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // Excel serial
  if (/^\d{5}$/.test(s)) {
    const d = XLSX.SSF.parse_date_code(parseInt(s, 10))
    if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`
  }
  return null
}

export interface UberEmeaFila {
  fecha_inicio:  string
  fecha_fin:     string
  pedidos:       number
  bruto:         number   // Ventas (con IVA)
  promo_eur:     number   // Tarifa por canje de la oferta (negativo en CSV → guardamos positivo)
  ads_eur:       number   // Ajuste de marketing
  comision_eur:  number   // Tasa de servicio
  neto:          number   // Pago total
  fecha_pago:    string | null
}

export function parseUberResumenGanancias(buffer: Buffer): UberEmeaFila[] | null {
  let filas: Record<string, unknown>[]
  try {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false })
    const ws = wb.Sheets[wb.SheetNames[0]]
    filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
  } catch { return null }

  if (!filas || filas.length === 0) return null

  // Detectar columnas (los nombres pueden variar ligeramente por locale)
  const firstRow = filas[0]
  const keys = Object.keys(firstRow)
  const find = (pat: RegExp) => keys.find((k) => pat.test(k)) ?? ''

  const COL_PED   = find(/cantidad.*pedidos?/i)
  const COL_BRUTO = find(/ventas?\s*\(con\s*iva\)/i) || find(/ventas?\s*\(incl/i)
  const COL_PROMO = find(/tarifa.*canje/i) || find(/canje.*oferta/i)
  const COL_ADS   = find(/ajuste.*marketing/i) || find(/marketing.*ajuste/i)
  const COL_COM   = find(/tasa.*servicio/i) || find(/servicio.*tasa/i)
  const COL_NETO  = find(/pago total/i)
  const COL_FPAGO = find(/fecha.*pago/i)
  // Para periodo de inicio/fin no hay columna directa; usamos Fecha de pago como fin
  // y calculamos inicio = fin - 6 días (semanas lun-dom típicas de Uber)

  const resultado: UberEmeaFila[] = []
  for (const fila of filas) {
    const neto = imp(fila[COL_NETO])
    if (neto === 0) continue // saltar filas de cabecera o totales

    const fpago = isoFecha(fila[COL_FPAGO])
    // Periodo: si no hay columna explícita, deducir lun anterior como inicio
    let fecha_fin = fpago ?? new Date().toISOString().slice(0, 10)
    let fecha_inicio = fecha_fin
    if (fpago) {
      const d = new Date(fpago)
      // Uber paga los miércoles; el periodo cierra el domingo anterior (6 días antes aprox)
      const ini = new Date(d)
      ini.setDate(ini.getDate() - 6)
      fecha_inicio = ini.toISOString().slice(0, 10)
    }

    resultado.push({
      fecha_inicio,
      fecha_fin,
      pedidos:      imp(fila[COL_PED]),
      bruto:        imp(fila[COL_BRUTO]),
      promo_eur:    Math.abs(imp(fila[COL_PROMO])),
      ads_eur:      Math.abs(imp(fila[COL_ADS])),
      comision_eur: Math.abs(imp(fila[COL_COM])),
      neto,
      fecha_pago:   fpago,
    })
  }

  return resultado.length > 0 ? resultado : null
}

// Convierte filas emea a VentaPlataformaParseada[]
export function emeaAVentas(
  filas: UberEmeaFila[],
  marcaRaw: string,
): VentaPlataformaParseada[] {
  return filas.map((f) => ({
    plataforma:           'uber' as const,
    marcaRaw,
    fecha_inicio_periodo: f.fecha_inicio,
    fecha_fin_periodo:    f.fecha_fin,
    pedidos:              f.pedidos,
    bruto:                f.bruto,
    neto:                 f.neto,
    fecha_pago:           f.fecha_pago,
    referencia:           null,
    pedidos_prime:        undefined,
    pedidos_promo:        undefined,
  }))
}
