/**
 * T-F2-05 — Parser Glovo Formato B (resumen sin detalle de pedidos)
 *
 * Detección: ausencia de filas de pedido individual (sin "Order ID", "Fecha pedido", "Plato").
 * Solo bloque de totales: Base + IVA + Total + Ingreso colaborador + Fecha pago.
 *
 * Solo escribe en ventas_plataforma, no en pedidos_plataforma.
 *
 * Casos cubiertos:
 *  - caso 13: 200460955815, periodo 01-15/03/2026, fecha_pago 04/04/2026,
 *             ingreso_colaborador 410,22€, total 260,54€
 *  - caso 14: 200530936327, mismo periodo — se acumula via T-F2-10
 */

import type { ParserOutput, VentaPlataformaInput } from './types.js'
import { parseFechaES, parseImporte } from './types.js'
import { detectarMarca, type MarcaMaestra } from './detectarMarca.js'
import { esGlovoFormatoA } from './glovoFormatoA.js'

export function parseGlovoFormatoB(
  texto: string,
  marcasMaestras: MarcaMaestra[] = [],
  nifFactura?: string,
): ParserOutput {
  const advertencias: string[] = []

  // Advertir si el texto parece ser formato A
  if (esGlovoFormatoA(texto)) {
    advertencias.push('El texto parece formato A pero se forzó formato B. Considerar re-parsear con glovoFormatoA.')
  }

  // ── Periodo ───────────────────────────────────────────────────────────────
  // "Periodo: 01/03/2026 - 15/03/2026"
  // o "01-15/03/2026"
  const rePeriodo = /[Pp]er[ií]odo[:\s]+(\d{1,2}\/\d{1,2}\/\d{2,4})\s*[-–]\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/
  const mPeriodo = texto.match(rePeriodo)
  const rePeriodo2 = /(\d{1,2})\s*[-–]\s*(\d{1,2})\/(\d{2})\/(\d{4})/
  const mPeriodo2 = texto.match(rePeriodo2)

  let fechaInicio: string | null = null
  let fechaFin: string | null = null

  if (mPeriodo) {
    fechaInicio = parseFechaES(mPeriodo[1])
    fechaFin    = parseFechaES(mPeriodo[2])
  } else if (mPeriodo2) {
    const [, d1, d2, mm, yyyy] = mPeriodo2
    fechaInicio = `${yyyy}-${mm.padStart(2,'0')}-${d1.padStart(2,'0')}`
    fechaFin    = `${yyyy}-${mm.padStart(2,'0')}-${d2.padStart(2,'0')}`
  }

  if (!fechaInicio || !fechaFin) {
    advertencias.push('Periodo no detectado en formato B Glovo. Usando fecha de hoy.')
    const hoy = new Date().toISOString().slice(0, 10)
    fechaInicio = hoy
    fechaFin = hoy
  }

  // ── Marca ─────────────────────────────────────────────────────────────────
  // Formato B suele tener cliente sin especificar marca.
  // "Cliente: Rubén Rodríguez Vinagre" — sin marca explícita.
  const reCliente = /(?:[Cc]liente|[Ff]acturar a|[Bb]ill to)[:\s]+([^\n]+)/
  const mCliente = texto.match(reCliente)
  const campoCliente = mCliente?.[1]?.trim() || ''

  const marca = detectarMarca(campoCliente, texto.slice(0, 500), marcasMaestras)
  if (marca === 'SIN_MARCA') {
    advertencias.push(`Marca no detectada en formato B. Cliente="${campoCliente}"`)
  }

  // ── Totales ───────────────────────────────────────────────────────────────
  const reTotal = /[Tt]otal[:\s€]+([0-9.,]+)/
  const mTotal = texto.match(reTotal)
  const total = mTotal ? parseImporte(mTotal[1]) : 0

  const reBase = /[Bb]ase[:\s€]+([0-9.,]+)/
  const mBase = texto.match(reBase)
  const base = mBase ? parseImporte(mBase[1]) : (total / 1.21)

  // Ingreso colaborador
  const reIngreso = /[Ii]ngreso\s+(?:a\s+cuenta\s+)?colaborador[:\s€]+([0-9.,]+)/
  const mIngreso = texto.match(reIngreso)
  const ingresoColaborador = mIngreso ? parseImporte(mIngreso[1]) : 0

  // Fecha pago
  const reFechaPago = /[Ff]echa\s+(?:de\s+)?[Pp]ago[:\s]+(\d{1,2}\/\d{1,2}\/\d{2,4})/
  const mFechaPago = texto.match(reFechaPago)
  const fechaPago = mFechaPago ? parseFechaES(mFechaPago[1]) : null

  // Productos vendidos
  const reProductos = /[Pp]roductos?\s+[Vv]endidos?[:\s€]+([0-9.,]+)/
  const mProductos = texto.match(reProductos)
  const bruto = mProductos ? parseImporte(mProductos[1]) : base

  const neto = ingresoColaborador > 0 ? ingresoColaborador : base

  const venta: VentaPlataformaInput = {
    fecha_inicio_periodo: fechaInicio,
    fecha_fin_periodo: fechaFin,
    plataforma: 'glovo',
    marca,
    bruto,
    neto,
    pedidos: 0,   // formato B no tiene detalle de pedidos
    ticket_medio: 0,
    ingreso_colaborador: ingresoColaborador,
    fecha_pago: fechaPago,
    facturas_origen: nifFactura ? [nifFactura] : [],
  }

  return {
    ok: true,
    ventas: [venta],
    pedidos: [],
    advertencias,
  }
}
