// parserUberResumenMensual — Lee el RESUMEN MENSUAL de Uber Eats (PDF).
// VERIFICADO con may_2026_La_Cocina_de_Carmucha.pdf (mayo 2026): ratio 55,1%.
//
// REGLA CLAVE (ver reglasNetoUber.ts): "Ventas" del documento es un precio
// INFLADO. El BRUTO REAL = Ventas − "Promociones en artículos". El neto se
// calcula con calcularNetoUber() y cuadra al céntimo con el "Total neto" del PDF.
//
// El PDF tiene 2 columnas mezcladas. Se lee por posición Y (línea visual).
// "Total neto" y su valor están en líneas Y distintas → se detecta por prev_label.
// Solo se procesa la página 1 (Resumen mensual unificado). Las páginas de pagos
// semanales se ignoran para evitar doble conteo.

import type { VentaPlataformaParseada } from './parserJustEatFactura.js'
import { extraerTextoPDF } from './extractores.js'
import { calcularNetoUber } from './reglasNetoUber.js'

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
  let fullText = ''
  try {
    fullText = await extraerTextoPDF(pdfBuffer)
  } catch {
    return null
  }
  if (!fullText) return null
  if (!/uber/i.test(fullText)) return null
  if (!/Resumen mensual unificado/i.test(fullText)) return null

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
    } else if (/^Otros cargos\b/.test(line) && !/promoción/.test(line)) {
      // Ajuste de IVA: puede ser + o − (conservar signo)
      const m = line.match(/(-?[\d.,]+)\s*€?\s*$/)
      parsed['otros_cargos'] = m ? (parseFloat(m[1].replace(/\./g,'').replace(',','.')) || 0) : 0
    } else if (/Otras ganancias/.test(line)) {
      parsed['otras_ganancias'] = lastNum()
    } else if (/^Propinas/.test(line)) {
      parsed['propinas'] = lastNum()
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

  // ── REGLAS CANÓNICAS (reglasNetoUber.ts) ──────────────────────────────
  // R1: bruto real = ventas infladas − promo en artículos (el inflado).
  const calc = calcularNetoUber({
    ventasInfladas: bruto,                          // "Ventas" del documento (inflado)
    promoArticulos: parsed['promo_art'] || 0,       // descuento del inflado (NO gasto)
    comision: parsed['comision'] || 0,
    feePromo: parsed['promo_otros'] || 0,           // "Otros cargos de la promoción"
    ads: parsed['ads'] || 0,
    creditosAds: parsed['creditos_ads'] || 0,
    ajustes: parsed['ajustes'] || 0,
    otrosCargos: parsed['otros_cargos'] || 0,       // ajuste IVA (+/−)
    cupones: parsed['cupones'] || 0,
    otrasGanancias: (parsed['otras_ganancias'] || 0) + (parsed['propinas'] || 0),
    pedidos: parsed['pedidos'] || 0,
  })

  // Validación: el neto calculado debe cuadrar con el "Total neto" del documento.
  const diff = Math.abs(calc.neto - neto)
  if (diff > 0.05) {
    console.warn(`[parseUberResumenMensual] no cuadra: calc=${calc.neto.toFixed(2)} vs doc=${neto} diff=${diff.toFixed(2)}`)
  }

  return {
    plataforma: 'uber',
    marcaRaw: marca || 'DESCONOCIDA',
    fecha_inicio_periodo: ini,
    fecha_fin_periodo: fin,
    pedidos: parsed['pedidos'] || 0,
    bruto: calc.brutoReal,        // ← BRUTO REAL (sin el inflado), no las ventas infladas
    neto: calc.neto,              // ← neto por reglas (cuadra con el documento)
    fecha_pago,
    referencia: ref || null,
    comision_eur: calc.comision_eur,
    ads_eur: calc.ads_eur,
    promo_eur: calc.promo_eur,    // fee promo real (NO la promo en artículos)
    cupones_eur: calc.cupones_eur,
    ajustes_eur: calc.ajustes_eur,
  }
}
