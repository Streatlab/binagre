// parserUberResumenMensual — Lee el RESUMEN MENSUAL de Uber Eats (PDF U1).
// Fuente preferida frente al CSV emea (cubre el mes natural completo).
//
// Estructura PDF U1:
//   Sección "Ganancias":        "Ventas (N Pedidos) X €" → bruto + pedidos
//   Sección "Precios de Uber":  "Tasas de mercado X €"   → comision_eur
//   Sección "Gastos marketing": "Promociones en artículos X €" + "Otros cargos de la promoción X €" → promo_eur
//                               "Gastos en anuncios X €" → ads_eur
//   Sección "Modificaciones":   "Cupones X €"            → cupones_eur
//                               "Ajustes X €"            → ajustes_eur
//   "Total neto X €"            → neto
//   "Depósito iniciado"/"Fecha" → fecha_pago
//
// Validación: bruto − comision − promo − ads − cupones − ajustes ≈ neto (±0.02€)
// Marcas: el PDF tiene una sección por marca. Si hay varias, devuelve una entrada por marca.

import type { VentaPlataformaParseada } from './parserJustEatFactura.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

const MESES_ES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
}

function imp(s: string | null | undefined): number {
  if (!s) return 0
  const clean = s.replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  const m = clean.match(/-?\d+\.?\d*/)
  return m ? parseFloat(m[0]) : 0
}

// "Febrero 2026" → { ini: "2026-02-01", fin: "2026-02-28" }
function mesAnioAPeriodo(texto: string): { ini: string; fin: string } | null {
  const m = texto.match(/(\w+)\s+(\d{4})/i)
  if (!m) return null
  const mes = MESES_ES[m[1].toLowerCase()]
  if (!mes) return null
  const anio = parseInt(m[2], 10)
  const fin = new Date(anio, mes, 0).getDate() // último día del mes
  const mm = String(mes).padStart(2, '0')
  return {
    ini: `${anio}-${mm}-01`,
    fin: `${anio}-${mm}-${String(fin).padStart(2, '0')}`,
  }
}

// Extrae número de pedidos de "Ventas (123 Pedidos) 456,78 €"
function extraerPedidos(linea: string): number {
  const m = linea.match(/\((\d+)\s*[Pp]edidos?\)/)
  return m ? parseInt(m[1], 10) : 0
}

// Extrae importe flotando a la derecha de una línea: "Tasas de mercado   -12,34 €" → -12.34
function extraerImporte(linea: string): number {
  const m = linea.match(/([-\d.,]+)\s*€?\s*$/)
  return m ? imp(m[1]) : 0
}

// ── Detección ─────────────────────────────────────────────────────────────────

export function esResumenMensualUber(texto: string): boolean {
  return /uber\s+eats/i.test(texto) && /ganancias/i.test(texto) && /total\s+neto/i.test(texto)
}

// ── Parser principal ──────────────────────────────────────────────────────────

export interface UberResumenParseado extends VentaPlataformaParseada {
  comision_eur: number
  ads_eur:      number
  promo_eur:    number
  cupones_eur:  number
  ajustes_eur:  number
  validado:     boolean   // bruto − costes ≈ neto (±0.02€)
  advertencias: string[]
}

export function parseUberResumenMensual(texto: string): UberResumenParseado[] {
  const advertencias: string[] = []
  const resultados: UberResumenParseado[] = []

  if (!esResumenMensualUber(texto)) return []

  // ── Periodo global (mes natural) ──────────────────────────────────────────
  // "Resumen mensual · Febrero 2026" o "Febrero de 2026"
  const mPer = texto.match(/[Rr]esumen\s+mensual[^\n]*?(\w+\s+\d{4})/i)
    ?? texto.match(/(\w+\s+de\s+\d{4})/i)
    ?? texto.match(/(\w+\s+\d{4})/i)
  const periodo = mPer ? mesAnioAPeriodo(mPer[1]) : null
  if (!periodo) {
    advertencias.push('No se detectó periodo (mes/año) en el resumen Uber.')
  }

  // ── Fecha de pago ──────────────────────────────────────────────────────────
  // "Depósito iniciado el 05/02/2026" o "Fecha 05/02/26"
  let fecha_pago: string | null = null
  const mPago = texto.match(/[Dd]ep[oó]sito\s+iniciado\s+el\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i)
    ?? texto.match(/[Ff]echa\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i)
  if (mPago) {
    const parts = mPago[1].split('/')
    if (parts.length === 3) {
      const [d, mo, y] = parts
      const anio = y.length === 2 ? 2000 + parseInt(y, 10) : parseInt(y, 10)
      fecha_pago = `${anio}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
  }

  // ── Dividir por bloques de marca ───────────────────────────────────────────
  // Cada marca aparece precedida por su nombre antes de "Ganancias".
  // Intentamos separar por "Ganancias" repetido; si solo hay uno, es una sola marca.
  const bloques = separarBloquesMarca(texto)

  for (const bloque of bloques) {
    const marcaRaw = bloque.marca
    const txt = bloque.texto

    // Ventas (bruto + pedidos)
    const mVentas = txt.match(/[Vv]entas?\s*\([^\)]*\)\s*([\d.,]+)\s*€/i)
      ?? txt.match(/[Gg]anancias\s+totales?\s*([\d.,]+)\s*€/i)
    const bruto = mVentas ? imp(mVentas[1]) : 0
    const pedidos = mVentas ? extraerPedidos(mVentas[0]) : 0

    // Comisión
    const mComision = txt.match(/[Tt]asas?\s+de\s+mercado\s+([-\d.,]+)\s*€/i)
    const comision_eur = mComision ? Math.abs(imp(mComision[1])) : 0

    // Promo (artículos + otros cargos promo)
    const mPromo1 = txt.match(/[Pp]romociones?\s+en\s+art[íi]culos?\s+([-\d.,]+)\s*€/i)
    const mPromo2 = txt.match(/[Oo]tros\s+cargos\s+de\s+la\s+promoci[oó]n\s+([-\d.,]+)\s*€/i)
    const promo_eur = Math.abs(imp(mPromo1?.[1])) + Math.abs(imp(mPromo2?.[1]))

    // Ads
    const mAds = txt.match(/[Gg]astos?\s+en\s+anuncios?\s+([-\d.,]+)\s*€/i)
    const ads_eur = mAds ? Math.abs(imp(mAds[1])) : 0

    // Cupones
    const mCupones = txt.match(/[Cc]upones?\s+([-\d.,]+)\s*€/i)
    const cupones_eur = mCupones ? Math.abs(imp(mCupones[1])) : 0

    // Ajustes
    const mAjustes = txt.match(/[Aa]justes?\s+([-\d.,]+)\s*€/i)
    const ajustes_eur = mAjustes ? Math.abs(imp(mAjustes[1])) : 0

    // Neto
    const mNeto = txt.match(/[Tt]otal\s+neto\s+([-\d.,]+)\s*€/i)
    const neto = mNeto ? imp(mNeto[1]) : 0

    if (bruto === 0 && neto === 0) {
      advertencias.push(`Bloque marca "${marcaRaw}": no se extrajeron importes. Revisar PDF.`)
      continue
    }

    // Validación cuadre
    const costes = comision_eur + promo_eur + ads_eur + cupones_eur + ajustes_eur
    const netoCalculado = bruto - costes
    const diff = Math.abs(netoCalculado - neto)
    const validado = diff <= 0.02
    if (!validado) {
      advertencias.push(
        `Cuadre Uber "${marcaRaw}": bruto(${bruto}) − costes(${costes.toFixed(2)}) = ${netoCalculado.toFixed(2)} ≠ neto(${neto}) · diff=${diff.toFixed(2)}€`
      )
    }

    resultados.push({
      plataforma:            'uber',
      marcaRaw:              marcaRaw || 'DESCONOCIDA',
      fecha_inicio_periodo:  periodo?.ini ?? new Date().toISOString().slice(0, 10),
      fecha_fin_periodo:     periodo?.fin ?? new Date().toISOString().slice(0, 10),
      pedidos,
      bruto,
      neto,
      fecha_pago,
      referencia:            null,   // resumen no tiene nº factura único; se llena con referencia de pago si aparece
      pedidos_prime:         undefined,
      pedidos_promo:         undefined,
      comision_eur,
      ads_eur,
      promo_eur,
      cupones_eur,
      ajustes_eur,
      validado,
      advertencias,
    })
  }

  return resultados
}

// ── Separar bloques por marca ─────────────────────────────────────────────────
// El PDF U1 puede tener varias marcas. Cada bloque comienza con el nombre de la
// marca antes del resumen de "Ganancias". Si solo hay un bloque, la marca es la
// única detectada.

interface BloqueMarca { marca: string; texto: string }

function separarBloquesMarca(texto: string): BloqueMarca[] {
  // Intentar split por líneas que preceden inmediatamente a "Ganancias"
  // Patrón: línea de nombre de tienda → "Ganancias" en la siguiente
  const lineas = texto.split('\n')
  const bloques: BloqueMarca[] = []
  const idxGanancias: number[] = []

  for (let i = 0; i < lineas.length; i++) {
    if (/^ganancias\s*$/i.test(lineas[i].trim())) idxGanancias.push(i)
  }

  if (idxGanancias.length === 0) {
    // No encontramos sección "Ganancias" por línea exacta; devolver todo como un bloque
    return [{ marca: detectarNombreMarca(texto), texto }]
  }

  for (let b = 0; b < idxGanancias.length; b++) {
    const ini = idxGanancias[b]
    const fin = idxGanancias[b + 1] ?? lineas.length
    // Nombre de marca: línea no vacía inmediatamente anterior a "Ganancias"
    let marca = ''
    for (let k = ini - 1; k >= Math.max(0, ini - 5); k--) {
      const l = lineas[k].trim()
      if (l && !/resumen|mensual|uber|eats|periodo|fecha|pago/i.test(l)) { marca = l; break }
    }
    bloques.push({ marca: marca || detectarNombreMarca(texto), texto: lineas.slice(ini, fin).join('\n') })
  }

  return bloques.length > 0 ? bloques : [{ marca: detectarNombreMarca(texto), texto }]
}

function detectarNombreMarca(texto: string): string {
  // Buscar línea tipo "Nombre del establecimiento: X" o similar
  const m = texto.match(/establecimiento[:\s]+([^\n]+)/i)
    ?? texto.match(/tienda[:\s]+([^\n]+)/i)
    ?? texto.match(/local[:\s]+([^\n]+)/i)
  return m ? m[1].trim() : 'DESCONOCIDA'
}
