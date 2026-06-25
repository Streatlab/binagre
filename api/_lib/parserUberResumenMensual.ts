// parserUberResumenMensual — Lee el RESUMEN MENSUAL de Uber Eats (PDF, 2 columnas).
// VERIFICADO con documento real: La Cocina de Carmucha, mayo 2026.
// Fuente: solo página 1 (Resumen mensual unificado). Las páginas 2-N (semanales) se ignoran.
import type { VentaPlataformaParseada } from './parserJustEatFactura.js'

function imp(s: string): number {
  return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
}

function lineas(txt: string): string[] {
  return txt.split('\n').map(l => l.trim()).filter(Boolean)
}

// Busca "Etiqueta [-]X.XXX,XX €" en las líneas — maneja el layout a 2 columnas.
function buscar(ls: string[], etiqueta: string): number | null {
  const re = new RegExp(etiqueta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
    '[^\\d\\-]*([\\-]?[\\d]{1,3}(?:\\.\\d{3})*,\\d{2})\\s*€', 'i')
  for (const l of ls) {
    const m = l.match(re)
    if (m) return imp(m[1])
  }
  return null
}

function extraerMarca(ls: string[]): string {
  // La marca es la línea inmediatamente anterior a "Calle ..."
  for (let i = 1; i < ls.length; i++) {
    if (/^calle\s/i.test(ls[i])) return ls[i - 1]
  }
  return ''
}

export interface UberResumenParseado extends VentaPlataformaParseada {
  comision_eur: number
  promo_eur: number
  ads_eur: number
  cupones_eur: number
  ajustes_eur: number
}

export function parseUberResumenMensual(pdfTexto: string): UberResumenParseado | null {
  if (!/uber/i.test(pdfTexto) || !/Resumen\s+mensual/i.test(pdfTexto)) return null

  // Solo la sección unificada (pág 1 del PDF)
  const seccion = pdfTexto.split(/Pagos recibidos en el mes/i)[0]
  const ls = lineas(seccion)

  // Bruto y pedidos
  const ventasLine = ls.find(l => /Ventas\s*\(\d+\s*Pedidos?\)/i.test(l))
  if (!ventasLine) return null
  const mVentas = ventasLine.match(/Ventas\s*\((\d+)\s*Pedidos?\)\s+([\d.,]+)\s*€/i)
  if (!mVentas) return null
  const pedidos = parseInt(mVentas[1], 10)
  const bruto = imp(mVentas[2])

  // Periodo: "May 01-31, 2026"
  const MESES: Record<string, number> = {
    jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12
  }
  const mPer = seccion.match(/(\w{3})\s+(\d{1,2})-(\d{1,2}),\s*(\d{4})/i)
  if (!mPer) return null
  const mes = String(MESES[mPer[1].toLowerCase()] || 1).padStart(2, '0')
  const ini = `${mPer[4]}-${mes}-${mPer[2].padStart(2,'0')}`
  const fin = `${mPer[4]}-${mes}-${mPer[3].padStart(2,'0')}`

  // Neto: "Total neto 1.232,68 €*" (con asterisco opcional)
  const mNeto = seccion.match(/Total neto\s+([\d.,]+)\s*€\*?/i)
  const neto = mNeto ? imp(mNeto[1]) : 0
  if (!neto) return null

  const comision = Math.abs(buscar(ls, 'Tasas de mercado') ?? 0)
  const promoProd = Math.abs(buscar(ls, 'Promociones en artículos') ?? 0)
  const promoOtros = Math.abs(buscar(ls, 'Otros cargos de la promoción') ?? 0)
  const ads = Math.abs(buscar(ls, 'Gastos en anuncios') ?? 0)
  const cupones = Math.abs(buscar(ls, 'Cupones') ?? 0)
  const ajustes = buscar(ls, 'Ajustes') ?? 0
  const marcaRaw = extraerMarca(ls)
  const ref = (seccion.match(/#([A-Z0-9]{6,})/i) || [])[1] || null

  // Validación: neto ≈ bruto - comision - marketing - modificaciones + cupones
  const marketing = Math.abs(buscar(ls, 'Gastos totales de marketing') ?? 0)
  const modifs = Math.abs(buscar(ls, 'Modificaciones totales') ?? 0)
  const netoCalc = bruto - comision - marketing - modifs + cupones
  if (Math.abs(netoCalc - neto) > 0.10) {
    console.warn('[parseUberResumenMensual] neto no cuadra:', netoCalc, 'vs', neto, '→ abortar')
    return null
  }

  return {
    plataforma: 'uber',
    marcaRaw: marcaRaw || 'DESCONOCIDA',
    fecha_inicio_periodo: ini,
    fecha_fin_periodo: fin,
    pedidos,
    bruto,
    neto,
    fecha_pago: null,
    referencia: ref,
    comision_eur: comision,
    promo_eur: promoProd + promoOtros,
    ads_eur: ads,
    cupones_eur: cupones,
    ajustes_eur: ajustes,
  }
}
