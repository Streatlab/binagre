// parserUberResumenMensual — Lee el RESUMEN MENSUAL de Uber Eats (PDF).
// VERIFICADO con jun_2026_Binagre.pdf y may_2026_Binagre.pdf (texto real de unpdf,
// que llega como UN solo bloque sin saltos de línea → se lee por anclas de texto,
// nunca por líneas).
//
// REGLA CLAVE (ver reglasNetoUber.ts): "Ventas" del documento es un precio
// INFLADO. El BRUTO REAL = Ventas − "Promociones en artículos". El neto se
// calcula con calcularNetoUber() y debe cuadrar con el "Total neto" del PDF.
// Solo se lee la sección "Resumen mensual unificado" (las páginas de pagos
// semanales se ignoran para no contar doble).

import type { VentaPlataformaParseada } from './parserJustEatFactura.js'
import { calcularNetoUber } from './reglasNetoUber.js'

interface UberResumen extends VentaPlataformaParseada {
  comision_eur: number
  ads_eur: number
  promo_eur: number
  cupones_eur: number
  ajustes_eur: number
}

const MESES_EN: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
}

function imp(txt: string | undefined): number {
  if (!txt) return 0
  const m = txt.replace(/\./g, '').replace(',', '.').match(/-?\d+\.?\d*/)
  return m ? Math.abs(parseFloat(m[0])) : 0
}
function impSigno(txt: string | undefined): number {
  if (!txt) return 0
  const m = txt.replace(/\./g, '').replace(',', '.').match(/-?\d+\.?\d*/)
  return m ? parseFloat(m[0]) : 0
}

// pdfTexto = texto ya extraído del PDF (unpdf, bloque continuo).
export function parseUberResumenMensual(pdfTexto: string): UberResumen | null {
  const full = (pdfTexto || '').replace(/\s+/g, ' ')
  if (!full) return null
  if (!/uber/i.test(full) && !/Resumen mensual/i.test(full)) return null
  const iUnif = full.indexOf('Resumen mensual unificado')
  if (iUnif < 0) return null

  // Alcance: desde "Resumen mensual unificado" hasta el primer "Total neto X €"
  // (todo lo posterior son los pagos semanales, que duplicarían cifras).
  const resto = full.slice(iUnif)
  const mNeto = resto.match(/Total neto\s+(-?[\d.,]+)\s*€/)
  if (!mNeto) return null
  const scope = resto.slice(0, (mNeto.index ?? 0) + mNeto[0].length)

  const g = (re: RegExp) => (scope.match(re) || [])[1]

  const mVentas = scope.match(/Ventas\s*\((\d+)\s*Pedidos?\)\s*(-?[\d.,]+)\s*€/)
  if (!mVentas) return null
  const pedidos = parseInt(mVentas[1], 10)
  const ventasInfladas = imp(mVentas[2])
  const neto = impSigno(mNeto[1])

  const promoArt = imp(g(/Promociones en art[ií]culos\s*(-?[\d.,]+)\s*€/))
  const comision = imp(g(/Tasas de mercado\s*(-?[\d.,]+)\s*€/))
  const feePromo = imp(g(/Otros cargos de la promoci[óo]n\s*(-?[\d.,]+)\s*€/))
  const ads = imp(g(/Gastos en anuncios\s*(-?[\d.,]+)\s*€/))
  const creditosAds = imp(g(/Cr[ée]ditos de los anuncios\s*(-?[\d.,]+)\s*€/))
  const ajustes = imp(g(/Ajustes\s*(-?[\d.,]+)\s*€/))
  const cupones = imp(g(/Cupones[^€]*?(-?[\d.,]+)\s*€/))
  // "Otros cargos" de la sección Precios de Uber (ajuste de IVA, conserva signo);
  // no confundir con "Otros cargos de la promoción".
  const otrosCargos = impSigno(g(/Otros cargos(?! de la promoci)\s*(-?[\d.,]+)\s*€/))
  const otrasGanancias = imp(g(/Otras ganancias\s*(-?[\d.,]+)\s*€/))
  const propinas = imp(g(/Propinas\s*(-?[\d.,]+)\s*€/))

  // Marca: "Resumen mensual <Mes> <Año> <MARCA> <dirección Calle…>"
  let marca = ''
  const mMarca = full.match(/Resumen mensual\s+\w+\s+\d{4}\s+(.+?)\s+(?:Calle|C\/|Avenida|Av\.|Plaza)/i)
  if (mMarca) marca = mMarca[1].trim()

  // Periodo: "Fecha Jun 01-30, 2026"
  const perM = full.match(/Fecha\s+([A-Za-z]{3})\w*\s+(\d{1,2})\s*[-–]\s*(\d{1,2}),?\s*(\d{4})/)
  if (!perM) return null
  const mes = MESES_EN[perM[1] as keyof typeof MESES_EN]
  if (!mes) return null
  const ini = `${perM[4]}-${String(mes).padStart(2, '0')}-${String(parseInt(perM[2], 10)).padStart(2, '0')}`
  const fin = `${perM[4]}-${String(mes).padStart(2, '0')}-${String(parseInt(perM[3], 10)).padStart(2, '0')}`

  // Referencia: "Número del resumen #B2F33894"
  const ref = (full.match(/#([A-Z0-9]{6,})/) || [])[1] || null

  // Fecha pago: primer "Depósito iniciado : Jun 15, 2026"
  let fecha_pago: string | null = null
  const dpM = full.match(/Dep[óo]sito iniciado\s*:\s*([A-Za-z]{3})\w*\s+(\d{1,2}),\s*(\d{4})/)
  if (dpM) {
    const mm = MESES_EN[dpM[1] as keyof typeof MESES_EN]
    if (mm) fecha_pago = `${dpM[3]}-${String(mm).padStart(2, '0')}-${String(parseInt(dpM[2], 10)).padStart(2, '0')}`
  }

  const calc = calcularNetoUber({
    ventasInfladas, promoArticulos: promoArt, comision, feePromo,
    ads, creditosAds, ajustes, otrosCargos, cupones,
    otrasGanancias: otrasGanancias + propinas, pedidos,
  })

  const diff = Math.abs(calc.neto - neto)
  if (diff > 0.05) {
    console.warn(`[parseUberResumenMensual] no cuadra: calc=${calc.neto.toFixed(2)} vs doc=${neto} diff=${diff.toFixed(2)}`)
  }

  return {
    plataforma: 'uber',
    marcaRaw: marca || 'DESCONOCIDA',
    fecha_inicio_periodo: ini,
    fecha_fin_periodo: fin,
    pedidos,
    bruto: Math.round(calc.brutoReal * 100) / 100,   // BRUTO REAL (sin inflado)
    neto: Math.round(calc.neto * 100) / 100,
    fecha_pago,
    referencia: ref,
    comision_eur: calc.comision_eur,
    ads_eur: calc.ads_eur,
    promo_eur: calc.promo_eur,
    cupones_eur: calc.cupones_eur,
    ajustes_eur: calc.ajustes_eur,
  }
}
