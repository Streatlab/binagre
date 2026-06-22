// parserGlovoLiquidacion — Lee la LIQUIDACIÓN de Glovo (payout). Glovo la entrega en
// un ZIP con un .xlsx (detalle pedido a pedido) y un .pdf (totales). VERIFICADO con
// liquidación real (Tranqui es Green, 16-31 may 2026): los totales se toman del PDF
// (cuadran al céntimo: Productos − Promoción asumida − Total factura = Ingreso
// colaborador) y los conteos por pedido (Prime/Promo) del XLSX.
import * as XLSX from 'xlsx'
import type { VentaPlataformaParseada } from './parserJustEatFactura.js'

function imp(s: string | null | undefined): number | null {
  if (!s) return null
  const m = s.replace(/\./g, '').replace(',', '.').match(/-?\d+\.?\d*/)
  return m ? parseFloat(m[0]) : null
}

function ddmmyyyy(s: string): string | null {
  const m = s.match(/(\d{2})[.\/](\d{2})[.\/](\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

// xlsxBuffer = detalle por pedido; pdfTexto = factura/liquidación con totales.
export function parseLiquidacionGlovo(
  xlsxBuffer: Buffer,
  pdfTexto: string,
): VentaPlataformaParseada | null {
  if (!/glovoapp/i.test(pdfTexto)) return null

  // ── Totales y periodo desde el PDF (fuente robusta) ──
  const bruto = imp((pdfTexto.match(/Productos\s+([\d.,]+)\s*EUR/i) || [])[1])
  const neto = imp((pdfTexto.match(/Ingreso a cuenta colaborador\s+([\d.,]+)\s*EUR/i) || [])[1])
  if (bruto == null || neto == null) return null

  const per = pdfTexto.match(/entre\s+(\d{2}\.\d{2}\.\d{4})\s*[-–]\s*(\d{2}\.\d{2}\.\d{4})/i)
  const ini = per ? ddmmyyyy(per[1]) : null
  const fin = per ? ddmmyyyy(per[2]) : null
  if (!ini || !fin) return null

  const fecha_pago = ddmmyyyy((pdfTexto.match(/Fecha de Pago:\s*(\d{2}\.\d{2}\.\d{4})/i) || [])[1] || '')
  const referencia = (pdfTexto.match(/Factura N[ºo°]:\s*(\S+)/i) || [])[1] || null

  // ── Conteos por pedido desde el XLSX ──
  let pedidos = 0, pedidos_prime = 0, pedidos_promo = 0
  let marcaRaw = ''
  try {
    const wb = XLSX.read(xlsxBuffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
    const colCodigo = 'Código de Glovo'
    const colPrime = 'Recargo por pedido con Glovo Prime'
    const colPromo = 'Promoción producto asumida por partner'
    const colFlash = 'Promoción de oferta flash a cargo del Partner'
    const colTienda = 'Nombre de la tienda'
    for (const f of filas) {
      const cod = String(f[colCodigo] ?? '').trim()
      if (!/^\d+$/.test(cod)) continue // ajustes "add-..." no son pedidos
      pedidos++
      if (Number(f[colPrime]) > 0) pedidos_prime++
      if (Number(f[colPromo]) > 0 || Number(f[colFlash]) > 0) pedidos_promo++
      if (!marcaRaw && f[colTienda]) marcaRaw = String(f[colTienda])
    }
  } catch {
    return null
  }
  if (pedidos === 0) return null

  return {
    plataforma: 'glovo',
    marcaRaw: marcaRaw || 'DESCONOCIDA',
    fecha_inicio_periodo: ini,
    fecha_fin_periodo: fin,
    pedidos,
    bruto,
    neto,
    fecha_pago,
    referencia,
    pedidos_prime,
    pedidos_promo,
  }
}
