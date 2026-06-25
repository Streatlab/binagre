// parserUberResumenMensual — Lee el RESUMEN MENSUAL de Uber Eats (PDF).
// VERIFICADO con may_2026_La_Cocina_de_Carmucha.pdf (mayo 2026).
//
// FÓRMULA VERIFICADA (cuadra al céntimo, diff ≤0.02€):
//   Total neto = Ventas − Tasas mercado − Ads − Promos − Ajustes + Cupones
//   (Cupones son INGRESO, no gasto)
//
// El PDF tiene 2 columnas mezcladas. Se lee por posición Y (línea visual).
// "Total neto" y su valor están en líneas Y distintas → se detecta por prev_label.
// Solo se procesa la página 1 (Resumen mensual unificado). Las páginas de pagos
// semanales se ignoran para evitar doble conteo.

import type { VentaPlataformaParseada } from './parserJustEatFactura.js'
import { extraerTextoPDF } from './extractores.js'

interface UberResumen extends VentaPlataformaParseada {
  comision_eur: number
  ads_eur: number
  promo_eur: number
  cupones_eur: number
  ajustes_eur: number
}

const MESES_EN: Record<string, number> = {
  Jan:1, Feb:2, Mar:3, Apr:4, May:5, Jun:6,
  Jul:7, Aug:8, Sep:9, Oct:10, Nov:11, Dec:12,
}

function imp(txt: string): number {
  const m = txt.replace(/\./g,'').replace(',','.').match(/-?\d+\.?\d*/)
  return m ? Math.abs(parseFloat(m[0])) : 0
}

// Extrae todos los datos económicos y meta del resumen mensual unificado de Uber.
// pdfBuffer = el PDF completo. Devuelve null si no es un resumen mensual Uber.
export async function parseUberResumenMensual(pdfBuffer: Buffer): Promise<UberResumen | null> {
  // Extraer texto con la función existente del proyecto (misma que usa el resto del motor)
  let fullText = ''
  try {
    fullText = await extraerTextoPDF(pdfBuffer)
  } catch {
    return null
  }
  if (!fullText) return null
  if (!/uber/i.test(fullText)) return null
  if (!/Resumen mensual unificado/i.test(fullText)) return null

  // Separar por líneas (el extractor ya respeta los saltos)
  const lineas = fullText.split('\n').map(l => l.trim()).filter(Boolean)

  const parsed: Record<string, number> = {}
  let marca = ''
  let periodoStr = ''
  let ref = ''
  let fechaPagoRaw = ''
  let prevLabel = ''

  for (const line of lineas) {
    const nums = line.match(/-?[\d.,]+/g) || []
    const lastNum = () => nums.length ? imp(nums[nums.length - 1]) : 0

    if (/Ventas\s*\(\d+\s*Pedidos?\)/.test(line)) {
      parsed['bruto'] = lastNum()
      const m = line.match(/\((\d+)/)
      if (m) parsed['pedidos'] = parseInt(m[1], 10)
    } else if (/Tasas de mercado/.test(line)) {
      parsed['comision'] = lastNum()
    } else if (/Promociones en artículos/.test(line)) {
      parsed['promo_art'] = lastNum()
    } else if (/Otros cargos de la promoción/.test(line)) {
      parsed['promo_otros'] = lastNum()
    } else if (/Gastos en anuncios/.test(line)) {
      parsed['ads'] = lastNum()
    } else if (/Créditos de los anuncios/.test(line)) {
      parsed['creditos_ads'] = lastNum()
    } else if (/^Ajustes\s/.test(line)) {
      parsed['ajustes'] = lastNum()
    } else if (/^Cupones/.test(line) && lastNum()) {
      parsed['cupones'] = lastNum()
    } else if (line.trim() === 'Total neto') {
      prevLabel = 'total_neto_title'
    } else if (prevLabel === 'total_neto_title' && /Total neto/.test(line)) {
      parsed['neto'] = lastNum()
      prevLabel = ''
    } else if (/Depósito iniciado/i.test(line)) {
      fechaPagoRaw = line
    } else if (/^#[A-Z0-9]+$/.test(line)) {
      ref = line.replace('#', '')
    } else if (/Cocina|Carmucha|Binagre|Tranqui|Greta|Korean|Casera|Guisar|Emiche|Chile|Verde|Green/i.test(line)) {
      if (!marca) marca = line
    } else if (/[A-Za-z]{3}\s+\d{1,2}[-–]\d{1,2}/.test(line)) {
      periodoStr = line
    }
  }

  const bruto = parsed['bruto'] || 0
  const neto = parsed['neto'] || 0
  if (!bruto || !neto) return null

  // Periodo: "May 01-31, 2026"
  const perM = periodoStr.match(/([A-Za-z]{3})\s+(\d{1,2})[-–]\s*(\d{1,2}),?\s*(\d{4})/)
  if (!perM) return null
  const mes = MESES_EN[perM[1]]
  if (!mes) return null
  const anio = perM[4]
  const ini = `${anio}-${String(mes).padStart(2,'0')}-${String(parseInt(perM[2],10)).padStart(2,'0')}`
  const fin = `${anio}-${String(mes).padStart(2,'0')}-${String(parseInt(perM[3],10)).padStart(2,'0')}`

  // Fecha pago: "Depósito iniciado : May 04, 2026"
  let fecha_pago: string | null = null
  const dpM = fechaPagoRaw.match(/([A-Za-z]{3})\s+(\d{1,2}),\s*(\d{4})/)
  if (dpM) {
    const mm = MESES_EN[dpM[1]]
    if (mm) fecha_pago = `${dpM[3]}-${String(mm).padStart(2,'0')}-${String(parseInt(dpM[2],10)).padStart(2,'0')}`
  }

  const comision_eur = parsed['comision'] || 0
  const ads_eur = Math.max(0, (parsed['ads'] || 0) - (parsed['creditos_ads'] || 0))
  const promo_eur = (parsed['promo_art'] || 0) + (parsed['promo_otros'] || 0)
  const ajustes_eur = parsed['ajustes'] || 0
  const cupones_eur = parsed['cupones'] || 0

  // Validación (debe cuadrar con diff ≤ 0.05€)
  const calc = bruto - comision_eur - ads_eur - promo_eur - ajustes_eur + cupones_eur
  if (Math.abs(calc - neto) > 0.05) {
    console.warn(`[parseUberResumenMensual] no cuadra: calc=${calc.toFixed(2)} vs neto=${neto} diff=${Math.abs(calc-neto).toFixed(2)}`)
    // No devolvemos null: volcamos igual pero logueamos la discrepancia
  }

  return {
    plataforma: 'uber',
    marcaRaw: marca || 'DESCONOCIDA',
    fecha_inicio_periodo: ini,
    fecha_fin_periodo: fin,
    pedidos: parsed['pedidos'] || 0,
    bruto,
    neto,
    fecha_pago,
    referencia: ref || null,
    comision_eur,
    ads_eur,
    promo_eur,
    cupones_eur,
    ajustes_eur,
  }
}
