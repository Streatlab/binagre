// parsers-plataforma.ts — Lectura de "resúmenes de pago" de plataformas que
// llegan al buzón facturasstreat@gmail.com en el CUERPO del correo (no adjunto).
// v2: Uber Eats reactivado 20-jul-2026 con formato real verificado por Rubén
// (captura de pantalla del correo "restaurantes.es@uber.com" con asunto
// "Resumen de pagos de Uber Eats de <marca> del <inicio> al <fin>"). Glovo y
// Just Eat siguen pendientes de un ejemplo real (no se inventan patrones).
//
// ⚠️ HISTORIAL 22-jun-2026: el parser anterior generaba datos FALSOS
//     (referencias inventadas, ads/promos sin fuente real) → se bloqueó tras
//     33 filas falsas en uber_liquidaciones. Este parser v2 solo extrae
//     campos que aparecen literalmente en el correo real de ejemplo; si
//     cualquiera de los campos obligatorios no aparece, devuelve null en vez
//     de rellenar con 0 o inventar.

export interface LiquidacionPlataforma {
  plataforma: 'uber' | 'glovo' | 'justeat'
  tabla: 'uber_liquidaciones' | 'glovo_liquidaciones' | 'justeat_liquidaciones'
  marca: string
  referencia_pago: string
  fecha_deposito: string       // YYYY-MM-DD (estimada por reglas de cobro)
  fecha_inicio_periodo: string // YYYY-MM-DD
  fecha_fin_periodo: string    // YYYY-MM-DD
  num_pedidos: number | null
  ventas_bruto: number | null
  comision_uber: number | null
  promociones: number | null
  otros_cargos_promo: number | null
  ads: number | null
  ajustes: number | null
  pago_neto: number | null
  estado: string
}

// "1.234,56 €" / "-42,30 €" → 1234.56 / 42.30 (siempre valor absoluto)
function num(s: string | null | undefined): number | null {
  if (!s) return null
  const limpio = s.replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.')
  const n = Number(limpio)
  return Number.isFinite(n) ? Math.abs(n) : null
}

// "6/8/26" (M/D/YY) → "2026-06-08"
function fechaUS(s: string): string | null {
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (!m) return null
  const mes = m[1].padStart(2, '0')
  const dia = m[2].padStart(2, '0')
  let anio = m[3]
  if (anio.length === 2) anio = '20' + anio
  return `${anio}-${mes}-${dia}`
}

// Próximo lunes posterior a una fecha (regla de cobro Uber: periodo lun-dom,
// pago el lunes siguiente). Si la fecha ya es lunes, devuelve el lunes siguiente.
function lunesSiguiente(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = d.getUTCDay() // 0=domingo … 1=lunes
  const sumar = ((8 - dow) % 7) || 7
  d.setUTCDate(d.getUTCDate() + sumar)
  return d.toISOString().slice(0, 10)
}

// Slug de marca para referencia_pago: minúsculas, sin acentos, solo a-z0-9.
// Coincide con el formato ya existente en uber_liquidaciones (p.ej.
// "Milanesas VIP" → "milanesasvip").
function slugMarca(marca: string): string {
  return marca
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '')
}

// HTML → texto plano simple (conserva labels y números).
function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&euro;/gi, '€')
    .replace(/&amp;/gi, '&')
    .replace(/&aacute;/gi, 'á').replace(/&iacute;/gi, 'í').replace(/&oacute;/gi, 'ó')
    .replace(/\s+/g, ' ')
    .trim()
}

function buscar(txt: string, re: RegExp): string | null {
  const m = txt.match(re)
  return m ? m[1] : null
}

// Correo real "Resumen de pagos" de Uber Eats (restaurantes.es@uber.com /
// Uber Eats <...>), formato verificado 20-jul-2026. Campos EXACTOS del correo:
//   "Hola <marca> ,"                                     → marca
//   "Resumen de pagos para 7/13/26 - 7/19/26"             → periodo
//   "Ventas totales Pedidos 17 Pago total 376,20 €"       → num_pedidos, pago_neto
//   "Total 17 875,15 €"  (fila Total de la tabla diaria)  → ventas_bruto
//   "Precio de Uber Eats -207,67 €"                       → comisión base
//   "IVA sobre el precio de Uber Eats -43,64 €"           → IVA de la comisión
//   "Gasto total en publicidad (IVA incluido) -50,73 €"   → ads
//   "Varios -0,02 €"                                      → ajustes
//   "Promociones de artículos -183,03 €"                  → promociones
//   "Comisión por canje de ofertas (impuestos incluidos) -13,86 €" → otros_cargos_promo
// Si falta cualquier campo obligatorio (marca, periodo, pedidos o pago_neto),
// devuelve null: mejor no capturar la fila que capturarla a medias/inventada.
function parseUber(texto: string, asunto: string): LiquidacionPlataforma | null {
  const esResumenUber = /uber\s*eats/i.test(texto) && /resumen de pagos?/i.test(texto) && /pago total/i.test(texto)
  if (!esResumenUber) return null

  const marca =
    buscar(texto, /Hola\s+([^,]+?)\s*,/i) ||
    buscar(asunto, /Resumen de pagos de Uber Eats de\s+(.+?)\s+del\s+\d/i)
  const inicioStr = buscar(texto, /Resumen de pagos para\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i)
  const finStr = buscar(texto, /Resumen de pagos para\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s*-\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i)
  const pedidosStr = buscar(texto, /Ventas totales\s+Pedidos\s+(\d+)/i)
  const pagoNetoStr = buscar(texto, /Pago total\s+([\d.,]+)\s*€/i)

  if (!marca || !inicioStr || !finStr || !pedidosStr || !pagoNetoStr) return null

  const fechaInicio = fechaUS(inicioStr)
  const fechaFin = fechaUS(finStr)
  if (!fechaInicio || !fechaFin) return null

  const ventasBrutoStr = buscar(texto, /Total\s+\d+\s+([\d.,]+)\s*€/i)
  const precioUberStr = buscar(texto, /Precio de Uber Eats\s+-?\s*([\d.,]+)\s*€/i)
  const ivaComisionStr = buscar(texto, /IVA sobre el precio de Uber Eats\s+-?\s*([\d.,]+)\s*€/i)
  const adsStr = buscar(texto, /Gasto total en publicidad \(IVA incluido\)\s+-?\s*([\d.,]+)\s*€/i)
  const ajustesStr = buscar(texto, /Varios\s+-?\s*([\d.,]+)\s*€/i)
  const promocionesStr = buscar(texto, /Promociones de art[ií]culos\s+-?\s*([\d.,]+)\s*€/i)
  const canjeStr = buscar(texto, /Comisi[oó]n por canje de ofertas \(impuestos incluidos\)\s+-?\s*([\d.,]+)\s*€/i)

  const precioUber = num(precioUberStr)
  const ivaComision = num(ivaComisionStr)
  const comisionUber = precioUber !== null && ivaComision !== null
    ? Math.round((precioUber + ivaComision) * 100) / 100
    : precioUber

  const fechaDeposito = lunesSiguiente(fechaFin)

  return {
    plataforma: 'uber',
    tabla: 'uber_liquidaciones',
    marca: marca.trim(),
    referencia_pago: `uber_${slugMarca(marca)}_${fechaInicio}_${fechaFin}`,
    fecha_deposito: fechaDeposito,
    fecha_inicio_periodo: fechaInicio,
    fecha_fin_periodo: fechaFin,
    num_pedidos: Number(pedidosStr),
    ventas_bruto: num(ventasBrutoStr),
    comision_uber: comisionUber,
    promociones: num(promocionesStr),
    otros_cargos_promo: num(canjeStr),
    ads: num(adsStr),
    ajustes: num(ajustesStr),
    pago_neto: num(pagoNetoStr),
    estado: 'pendiente',
  }
}

/**
 * Intenta interpretar un correo como liquidación de plataforma.
 * Devuelve null si no lo es (factura normal, newsletter, etc.).
 */
export function parseLiquidacionPlataforma(
  textoPlano: string | null | undefined,
  html: string | null | undefined,
  asunto: string | null | undefined,
): LiquidacionPlataforma | null {
  const texto = `${textoPlano || ''}\n${stripHtml(html || '')}`.trim()
  const subj = asunto || ''
  if (!texto) return null
  return parseUber(texto, subj)
}
