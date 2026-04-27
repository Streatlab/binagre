/**
 * T-F2-03 — Parser Uber/Portier
 *
 * NIF emisor: B88515200 (Portier Eats Spain SL — entidad facturadora Uber España)
 *
 * Extrae:
 *  - Periodo semanal lun-dom ("Periodo: 02/02/26 - 08/02/26")
 *  - Base + IVA + Total
 *  - Conceptos: Tasa servicio, Comisión canje ofertas, Tarifa publicitaria
 *  - Marca por nombre comercial en campo cliente ("Rubén / Mister Katsu")
 *
 * Casos cubiertos:
 *  - caso 8: B88515200-2026-F1-316810, periodo 02/02-08/02, marca Mister Katsu, total 100,25€
 */

import type { ParserOutput, VentaPlataformaInput } from './types.js'
import { parseFechaES, parseImporte } from './types.js'
import { detectarMarca, type MarcaMaestra } from './detectarMarca.js'

export function parseUberFactura(
  texto: string,
  marcasMaestras: MarcaMaestra[] = [],
  nifFactura?: string,
): ParserOutput {
  const advertencias: string[] = []

  // ── Periodo ──────────────────────────────────────────────────────────────
  // "Periodo: 02/02/26 - 08/02/26"  o  "Período: 02/02/2026 - 08/02/2026"
  const rePeriodo = /[Pp]er[ií]odo[:\s]+(\d{1,2}\/\d{1,2}\/\d{2,4})\s*[-–]\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/
  const mPeriodo = texto.match(rePeriodo)
  let fechaInicio: string | null = null
  let fechaFin: string | null = null
  if (mPeriodo) {
    fechaInicio = parseFechaES(mPeriodo[1])
    fechaFin    = parseFechaES(mPeriodo[2])
  }
  if (!fechaInicio || !fechaFin) {
    advertencias.push('No se pudo extraer el periodo de la factura Uber. Usando fecha de hoy.')
    const hoy = new Date().toISOString().slice(0, 10)
    fechaInicio = hoy
    fechaFin = hoy
  }

  // ── Totales ───────────────────────────────────────────────────────────────
  // Buscar "Total: 100,25" o "Total  100.25" o línea "TOTAL 100,25 €"
  const reTotal = /[Tt]otal[:\s€]+([0-9.,]+)/
  const mTotal = texto.match(reTotal)
  const total = mTotal ? parseImporte(mTotal[1]) : 0

  // Base imponible
  const reBase = /[Bb]ase\s+[Ii]mponible[:\s€]+([0-9.,]+)/
  const mBase = texto.match(reBase)
  const base = mBase ? parseImporte(mBase[1]) : 0

  // IVA
  const reIva = /IVA\s+21[%\s:€]+([0-9.,]+)/i
  const mIva = texto.match(reIva)
  const iva = mIva ? parseImporte(mIva[1]) : (total - base > 0 ? total - base : 0)

  // Calcular neto (comisión Uber es el importe de esta factura — es un gasto de comisión)
  // neto = bruto vendido - importe factura comisión; aquí solo tenemos la comisión,
  // así que bruto = base (sin IVA) y neto queda como negativo respecto a ventas.
  // Guardamos base como "bruto" para estadísticas de coste de plataforma.
  const bruto = base > 0 ? base : (total / 1.21)
  const neto = bruto  // en facturas de comisión el "neto" es el importe sin IVA

  // ── Marca ─────────────────────────────────────────────────────────────────
  // Campo cliente típico: "Rubén Rodríguez Vinagre / Mister Katsu"
  // Buscar línea que contenga "Nombre" o el nombre del titular
  const reCliente = /(?:[Cc]liente|[Nn]ombre del [Cc]liente|[Ff]actura a)[:\s]+([^\n]+)/
  const mCliente = texto.match(reCliente)
  const campoCliente = mCliente ? mCliente[1].trim() : ''

  // Concepto: líneas de detalle
  const reConcepto = /(?:[Cc]oncepto|[Dd]escripci[oó]n)[:\s]+([^\n]+)/
  const mConcepto = texto.match(reConcepto)
  const concepto = mConcepto ? mConcepto[1].trim() : ''

  const marca = detectarMarca(campoCliente, concepto, marcasMaestras)

  if (marca === 'SIN_MARCA') {
    advertencias.push(`Marca no detectada para factura Uber. Cliente="${campoCliente}"`)
  }

  const venta: VentaPlataformaInput = {
    fecha_inicio_periodo: fechaInicio,
    fecha_fin_periodo: fechaFin,
    plataforma: 'uber',
    marca,
    bruto,
    neto,
    pedidos: 0,   // Facturas Uber no incluyen recuento de pedidos en el PDF
    ticket_medio: 0,
    ingreso_colaborador: 0,
    fecha_pago: null,
    facturas_origen: nifFactura ? [nifFactura] : [],
  }

  return {
    ok: true,
    ventas: [venta],
    pedidos: [],
    advertencias,
  }
}
