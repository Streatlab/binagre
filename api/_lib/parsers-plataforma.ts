// parsers-plataforma.ts — Lectura de "resúmenes de pago" de plataformas que
// llegan al buzón facturasstreat@gmail.com en el CUERPO del correo (no adjunto).
// v1: Uber Eats. Glovo y Just Eat se añaden con un ejemplo real de cada uno.
//
// Salida normalizada al esquema de *_liquidaciones (uber/glovo/justeat).

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

function parseUber(texto: string, asunto: string): LiquidacionPlataforma | null {
  const esUber = /uber\s*eats/i.test(texto) || /uber/i.test(asunto)
  const esResumen = /resumen de pagos?/i.test(asunto) || /resumen de pagos?/i.test(texto)
  if (!esUber || !esResumen) return null

  // Periodo: del asunto preferentemente, si no del cuerpo.
  const periodoSrc = /\d{1,2}\/\d{1,2}\/\d{2,4}\s*[-–]\s*\d{1,2}\/\d{1,2}\/\d{2,4}/.test(asunto)
    ? asunto
    : texto
  const periodos = periodoSrc.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})\s*[-–]\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/)
  if (!periodos) return null
  const ini = fechaUS(periodos[1])
  const fin = fechaUS(periodos[2])
  if (!ini || !fin) return null

  const totalLinea = texto.match(/Total\s+(\d+)\s+([\d.,]+)\s*€/i)
  const num_pedidos = totalLinea ? parseInt(totalLinea[1], 10) : null
  const ventas_bruto = totalLinea ? num(totalLinea[2]) : null

  const precioUber = num(buscar(texto, /Precio de Uber Eats\s*-?\s*([\d.,]+)/i))
  const ivaPrecio = num(buscar(texto, /IVA sobre el precio de Uber Eats\s*-?\s*([\d.,]+)/i))
  const suscripcion = num(buscar(texto, /Precio de suscripci[oó]n\s*-?\s*([\d.,]+)/i))
  const varios = num(buscar(texto, /Varios\s*-?\s*([\d.,]+)/i))
  const ads = num(buscar(texto, /publicidad[^\d-]*-?\s*([\d.,]+)/i))
  const promo = num(buscar(texto, /Promociones de art[ií]culos\s*-?\s*([\d.,]+)/i))
  const canje = num(buscar(texto, /canje de ofertas[^\d-]*-?\s*([\d.,]+)/i))

  const pagos = [...texto.matchAll(/Pago total\s*-?\s*([\d.,]+)\s*€/gi)]
  const pago_neto = pagos.length ? num(pagos[pagos.length - 1][1]) : null

  // Sin pago neto el resumen no sirve (campo obligatorio).
  if (pago_neto == null) return null

  // Marca: del saludo "Hola <marca> ,". Fallback obligatorio (columna NOT NULL).
  const marcaDetectada = (buscar(texto, /Hola\s+(.+?)\s*,/i) || '').trim()
  const marca = marcaDetectada || 'Streat Lab'

  const comision_uber = (precioUber || 0) + (ivaPrecio || 0) || null
  const ajustes = (suscripcion || 0) + (varios || 0) || null

  // Referencia única determinista (sirve de clave anti-duplicado).
  const referencia_pago = `uber_${marca}_${ini}_${fin}`.replace(/\s+/g, '').toLowerCase()
  // Cobro Uber: periodo lun-dom → pago el lunes siguiente (estimado).
  const fecha_deposito = lunesSiguiente(fin)

  return {
    plataforma: 'uber',
    tabla: 'uber_liquidaciones',
    marca,
    referencia_pago,
    fecha_deposito,
    fecha_inicio_periodo: ini,
    fecha_fin_periodo: fin,
    num_pedidos,
    ventas_bruto,
    comision_uber,
    promociones: promo,
    otros_cargos_promo: canje,
    ads,
    ajustes,
    pago_neto,
    estado: 'pendiente_conciliar',
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
