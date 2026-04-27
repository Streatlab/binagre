/**
 * T-F2-07 — Parser Rushour
 *
 * Rushour = empresa francesa, IVA 20% francés, plan fijo mensual "PLATINIUM".
 * NO es una plataforma de venta directa → categoría CTR-SW (software/agregador).
 * NO insertar en ventas_plataforma (es un gasto, no una venta).
 * Enrutar a tabla facturas con categoría CTR-SW.
 *
 * Caso 15: B4101477-0035, total 99€, "Balance Due €0" (ya pagado).
 *
 * Este parser devuelve un resultado especial con tipo 'gasto_ctr_sw'
 * para que el endpoint de importación lo enrute correctamente.
 */

import type { ParserOutput } from './types.js'
import { parseFechaES, parseImporte } from './types.js'

export interface RushourFactura {
  tipo: 'gasto_ctr_sw'
  numero_factura: string
  fecha_factura: string
  total: number
  base: number
  iva_pct: number
  iva_importe: number
  ya_pagado: boolean
  descripcion: string
  titular: string
}

export interface RushourParserOutput {
  ok: true
  rushour: RushourFactura
  advertencias: string[]
}

export function parseRushourFactura(
  texto: string,
): RushourParserOutput | ParserOutput {
  const advertencias: string[] = []

  // ── Número de factura ─────────────────────────────────────────────────────
  // "Invoice #B4101477-0035" o "Factura B4101477-0035"
  const reNumero = /[Ii]nvoice\s*#?\s*([A-Z0-9\-]+)/
  const mNumero = texto.match(reNumero)
  const numeroFactura = mNumero?.[1]?.trim() || `RUSHOUR-${Date.now().toString(36)}`

  // ── Fecha ─────────────────────────────────────────────────────────────────
  const reFecha = /[Dd]ate[:\s]+([^\n]+)/
  const mFecha = texto.match(reFecha)
  const fechaRaw = mFecha?.[1]?.trim() || ''
  // Rushour usa "March 1, 2026" o "01/03/2026"
  let fechaFactura = parseFechaES(fechaRaw)
  if (!fechaFactura) {
    // Intentar formato "Month D, YYYY"
    const mFechaTxt = fechaRaw.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/)
    if (mFechaTxt) {
      const MESES: Record<string, string> = {
        january:'01', february:'02', march:'03', april:'04',
        may:'05', june:'06', july:'07', august:'08',
        september:'09', october:'10', november:'11', december:'12',
      }
      const mes = MESES[mFechaTxt[1].toLowerCase()]
      if (mes) {
        fechaFactura = `${mFechaTxt[3]}-${mes}-${mFechaTxt[2].padStart(2,'0')}`
      }
    }
    if (!fechaFactura) {
      fechaFactura = new Date().toISOString().slice(0, 10)
      advertencias.push('Fecha no detectada en factura Rushour. Usando fecha de hoy.')
    }
  }

  // ── Total ─────────────────────────────────────────────────────────────────
  // "PLATINIUM at €99/month" o "Total  €99.00" o "Amount Due  €99.00"
  const reTotal = /(?:[Tt]otal|[Aa]mount\s+[Dd]ue|PLATINIUM[^€]*)[€$\s]+([0-9.,]+)/
  const mTotal = texto.match(reTotal)
  const total = mTotal ? parseImporte(mTotal[1]) : 99  // default plan Platinium

  // ── IVA francés 20% ──────────────────────────────────────────────────────
  // Rushour es empresa francesa; si hay IVA es 20%
  const reIva = /(?:TVA|VAT|IVA)[:\s]+20%?[:\s€]+([0-9.,]+)/i
  const mIva = texto.match(reIva)
  const ivaImporte = mIva ? parseImporte(mIva[1]) : 0
  const base = ivaImporte > 0 ? total - ivaImporte : total
  const ivaPct = ivaImporte > 0 ? 20 : 0

  // ── ¿Ya pagado? ───────────────────────────────────────────────────────────
  const yaPagado =
    /[Bb]alance\s+[Dd]ue[:\s€]+0/i.test(texto) ||
    /[Pp]aid/i.test(texto)

  // ── Titular ───────────────────────────────────────────────────────────────
  // Rushour factura a "Streat Lab" según caso 15
  const reTitular = /(?:[Bb]ill\s+to|[Cc]liente)[:\s]+([^\n]+)/
  const mTitular = texto.match(reTitular)
  const titular = mTitular?.[1]?.trim() || 'Streat Lab'

  return {
    ok: true,
    rushour: {
      tipo: 'gasto_ctr_sw',
      numero_factura: numeroFactura,
      fecha_factura: fechaFactura,
      total,
      base,
      iva_pct: ivaPct,
      iva_importe: ivaImporte,
      ya_pagado: yaPagado,
      descripcion: `Rushour PLATINIUM plan mensual — ${fechaFactura.slice(0, 7)}`,
      titular,
    },
    advertencias,
  }
}
