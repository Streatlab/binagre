/**
 * T-F2-04 — Parser Glovo Formato A (con detalle de pedidos en pág 2)
 *
 * Detección formato A (H1):
 *  - Presencia de cabecera/columnas de pedido individual DESPUÉS del bloque de totales.
 *  - Indicadores: "Order ID", "Fecha pedido", o columna "Plato" en el cuerpo.
 *  - Si ≥1 fila coincide con patrón → formato A.
 *  - Si OCR falla o hay <3 columnas detectables → fallback a formato B con advertencia.
 *
 * Extrae:
 *  - Cabecera: NIF, marca por nombre local ("Los Menús de Carmiña")
 *  - Totales: base + IVA + total + ingreso_colaborador + fecha_pago
 *  - Detalle pág 2: fecha, hora, plato, precio_bruto, promo por pedido
 *  - Inserta N filas en pedidos_plataforma + 1 fila agregada en ventas_plataforma
 *
 * Caso 12: I26LRCX31X000005, periodo 16-28/02/2026, marca "Los Menús de Carmiña",
 *   total 126,46€, ingreso_colaborador 195,24€
 */

import type {
  ParserOutput, VentaPlataformaInput, PedidoPlataformaInput,
} from './types.js'
import { parseFechaES, parseImporte } from './types.js'
import { detectarMarca, type MarcaMaestra } from './detectarMarca.js'

/**
 * Detecta si el texto corresponde a formato A (con detalle de pedidos).
 * Criterio H1: buscar al menos una fila de pedido individual tras los totales.
 */
export function esGlovoFormatoA(texto: string): boolean {
  // Buscar indicadores de la sección de pedidos individuales
  const indicadores = [
    /order\s+id/i,
    /fecha\s+pedido/i,
    /\bplato\b/i,
    /\bproducts?\b.*\bprice\b/i,
    /\bitem\b.*\bquantity\b/i,
  ]
  return indicadores.some(re => re.test(texto))
}

export function parseGlovoFormatoA(
  texto: string,
  marcasMaestras: MarcaMaestra[] = [],
  nifFactura?: string,
): ParserOutput {
  const advertencias: string[] = []

  // ── Verificar que es formato A ────────────────────────────────────────────
  if (!esGlovoFormatoA(texto)) {
    advertencias.push('Texto no contiene indicadores de formato A. Usando resultados parciales.')
  }

  // ── Periodo ───────────────────────────────────────────────────────────────
  // "Periodo: 16/02/2026 - 28/02/2026"  o  "16-28/02/2026"
  const rePeriodo = /[Pp]er[ií]odo[:\s]+(\d{1,2}\/\d{1,2}\/\d{2,4})\s*[-–]\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/
  const mPeriodo = texto.match(rePeriodo)
  // Alternativa sin año en el primer tramo: "16-28/02/2026"
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
    advertencias.push('Periodo no detectado en formato A Glovo. Usando fecha de hoy.')
    const hoy = new Date().toISOString().slice(0, 10)
    fechaInicio = hoy
    fechaFin = hoy
  }

  // ── Marca por nombre local en cabecera ────────────────────────────────────
  // Glovo pone el nombre del local en la cabecera: "Los Menús de Carmiña (Pico de la Maliciosa)"
  const reNombreLocal = /(?:[Ll]ocal|[Rr]estaurante|[Ee]stablecimiento|[Ss]tore)[:\s]+([^\n]+)/
  const mNombreLocal = texto.match(reNombreLocal)
  // Fallback: buscar línea entre NIF Glovo y "Período"
  const reLocalFallback = /B67282871[^\n]*\n([^\n]+)/
  const mLocalFallback = texto.match(reLocalFallback)

  const campoCliente =
    mNombreLocal?.[1]?.trim() ||
    mLocalFallback?.[1]?.trim() ||
    ''

  const marca = detectarMarca(campoCliente, texto.slice(0, 500), marcasMaestras)
  if (marca === 'SIN_MARCA') {
    advertencias.push(`Marca no detectada. NombreLocal="${campoCliente}"`)
  }

  // ── Totales ───────────────────────────────────────────────────────────────
  const reTotal = /[Tt]otal[:\s€]+([0-9.,]+)/
  const mTotal = texto.match(reTotal)
  const total = mTotal ? parseImporte(mTotal[1]) : 0

  const reBase = /[Bb]ase[:\s€]+([0-9.,]+)/
  const mBase = texto.match(reBase)
  const base = mBase ? parseImporte(mBase[1]) : (total / 1.21)

  // Ingreso colaborador: "Ingreso a cuenta colaborador" o "Ingreso colaborador"
  const reIngreso = /[Ii]ngreso\s+(?:a\s+cuenta\s+)?colaborador[:\s€]+([0-9.,]+)/
  const mIngreso = texto.match(reIngreso)
  const ingresoColaborador = mIngreso ? parseImporte(mIngreso[1]) : 0

  // Fecha pago
  const reFechaPago = /[Ff]echa\s+(?:de\s+)?[Pp]ago[:\s]+(\d{1,2}\/\d{1,2}\/\d{2,4})/
  const mFechaPago = texto.match(reFechaPago)
  const fechaPago = mFechaPago ? parseFechaES(mFechaPago[1]) : null

  // Productos vendidos (ventas brutas antes de comisión)
  const reProductos = /[Pp]roductos?\s+[Vv]endidos?[:\s€]+([0-9.,]+)/
  const mProductos = texto.match(reProductos)
  const bruto = mProductos ? parseImporte(mProductos[1]) : base

  const neto = ingresoColaborador > 0 ? ingresoColaborador : base

  // ── Detalle de pedidos (pág 2) ────────────────────────────────────────────
  const pedidosDetalle: PedidoPlataformaInput[] = []

  // Extraer sección de pedidos: todo lo que hay tras el bloque de totales
  // Patrón de fila: fecha + hora + plato/producto + precio
  // "12/02/2026  14:32  Katsu Curry  12,90  0,00"
  const reFilaPedido = /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{2}:\d{2}(?::\d{2})?)\s+([^\t\n0-9][^\t\n]*?)\s+([\d.,]+)\s+([\d.,]+)/g
  let mFilas: RegExpExecArray | null
  while ((mFilas = reFilaPedido.exec(texto)) !== null) {
    const [, fechaStr, horaStr, plato, precioStr, promoStr] = mFilas
    const fechaPedido = parseFechaES(fechaStr)
    if (!fechaPedido) continue
    pedidosDetalle.push({
      fecha: fechaPedido,
      hora: horaStr || null,
      plataforma: 'glovo',
      marca,
      plato: plato.trim(),
      precio_bruto: parseImporte(precioStr),
      promo: parseImporte(promoStr),
      courier: null,
      glovo_id: null,
      factura_origen: nifFactura || null,
    })
  }

  // Alternativa: buscar "Order ID" + valores en líneas
  if (pedidosDetalle.length === 0) {
    const reOrderLine = /([A-Z0-9\-]{8,})\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{2}:\d{2})\s+([^\n]+?)\s+([\d.,]+)/g
    while ((mFilas = reOrderLine.exec(texto)) !== null) {
      const [, orderId, fechaStr, horaStr, plato, precioStr] = mFilas
      const fechaPedido = parseFechaES(fechaStr)
      if (!fechaPedido) continue
      pedidosDetalle.push({
        fecha: fechaPedido,
        hora: horaStr || null,
        plataforma: 'glovo',
        marca,
        plato: plato.trim(),
        precio_bruto: parseImporte(precioStr),
        promo: 0,
        courier: null,
        glovo_id: orderId,
        factura_origen: nifFactura || null,
      })
    }
  }

  if (pedidosDetalle.length === 0) {
    advertencias.push('No se extrajeron pedidos individuales del formato A. Verificar estructura PDF.')
  }

  // ── Calcular pedidos y ticket medio ──────────────────────────────────────
  const numPedidos = pedidosDetalle.length > 0 ? pedidosDetalle.length : 0
  const ticketMedio = numPedidos > 0 ? bruto / numPedidos : 0

  const venta: VentaPlataformaInput = {
    fecha_inicio_periodo: fechaInicio,
    fecha_fin_periodo: fechaFin,
    plataforma: 'glovo',
    marca,
    bruto,
    neto,
    pedidos: numPedidos,
    ticket_medio: ticketMedio,
    ingreso_colaborador: ingresoColaborador,
    fecha_pago: fechaPago,
    facturas_origen: nifFactura ? [nifFactura] : [],
  }

  return {
    ok: true,
    ventas: [venta],
    pedidos: pedidosDetalle,
    advertencias,
  }
}
