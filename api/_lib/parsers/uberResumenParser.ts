/**
 * Parser del CSV "resumen de ganancias" de Uber Eats (liquidaciones por marca y semana).
 *
 * Este CSV NO trae NIF ni cabeceras Rushour/JustEat, así que detectarPlataforma
 * no lo reconoce. Se identifica por sus cabeceras propias y se encamina a
 * uber_liquidaciones (mismo destino que la antigua pestaña Ventas).
 *
 * Formato numérico: inglés (EMEA export) → "1,234.56" / "306.57".
 */

export interface UberResumenItem {
  referencia_pago: string
  ref_uber: string
  marca: string
  fecha_deposito: string
  fecha_inicio_periodo: string
  fecha_fin_periodo: string
  num_pedidos: number
  ventas_bruto: number
  promociones: number
  comision_uber: number
  pago_neto: number
  ads: number
}

// "DD/MM/YY" o "DD/MM/YYYY" o "YYYY-MM-DD" → "YYYY-MM-DD"
function fmtFechaCSV(v: string): string {
  if (!v) return ''
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/)
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2]}-${m[1]}`
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10)
  return v
}

// Formato inglés: "1,234.56" / "306.57" → 1234.56
function numEN(v: string): number {
  const s = (v || '0').replace(/"/g, '').replace(/€/g, '').replace(/,/g, '').trim()
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

function normalizarMarca(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').trim()
}

// CSV que respeta comillas, soporta \r\n y "" escapado
function parseCSVQuoted(text: string): string[][] {
  const rows: string[][] = []
  let current = ''
  let inQuotes = false
  let row: string[] = []
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { current += '"'; i++ }
      else if (ch === '"') { inQuotes = false }
      else { current += ch }
    } else {
      if (ch === '"') { inQuotes = true }
      else if (ch === ',') { row.push(current); current = '' }
      else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
        row.push(current); current = ''
        if (row.some(c => c.trim() !== '')) rows.push(row)
        row = []
        if (ch === '\r') i++
      } else { current += ch }
    }
  }
  if (current !== '' || row.length) { row.push(current); if (row.some(c => c.trim() !== '')) rows.push(row) }
  return rows
}

/**
 * ¿Es el CSV "resumen de ganancias" de Uber? Se reconoce por sus cabeceras
 * propias (nombre del restaurante + pago total + id de referencia de ganancias).
 */
export function esCSVResumenUber(texto: string): boolean {
  if (!texto) return false
  const cab = texto.slice(0, 2000).toLowerCase()
  const tieneMarca = cab.includes('nombre del restaurante') || cab.includes('store name') || cab.includes('restaurant name')
  const tienePago = cab.includes('pago total') || cab.includes('net payout') || cab.includes('total payout')
  const tieneRef = cab.includes('referencia de ganancias') || cab.includes('earnings reference') || cab.includes('payment reference')
  return tieneMarca && (tienePago || tieneRef)
}

export function parseUberResumenLiquidaciones(texto: string): { items: UberResumenItem[]; errores: string[] } {
  const rows = parseCSVQuoted(texto)
  if (rows.length < 2) return { items: [], errores: ['CSV vacío'] }
  const cab = rows[0].map(h => h.replace(/^\uFEFF/, '').trim().replace(/\s+/g, ' ').toLowerCase())
  const find = (...candidates: string[]) => {
    for (const c of candidates) {
      const idx = cab.findIndex(h => h.includes(c.toLowerCase()))
      if (idx !== -1) return idx
    }
    return -1
  }
  const iMarca  = find('nombre del restaurante', 'store name', 'nombre de la tienda', 'restaurant name')
  const iRef    = find('id. de referencia de ganancias', 'id de referencia de ganancias', 'payment reference', 'earnings reference id')
  const iPago   = find('pago total', 'net payout', 'pago neto', 'total payout', 'payment total')
  const iFecha  = find('fecha de pago', 'payment date')
  const iVentas = find('ventas (con iva', 'ventas con iva', 'sales (incl')
  const iPromo  = find('promociones en artículos', 'promociones en articulos', 'item promotions')
  const iComis  = find('tasa de servicio después del descuento', 'tasa de servicio despues del descuento', 'tasas de servicio', 'service fee')
  const iPed    = find('cantidad de pedidos', 'número de pedidos', 'numero de pedidos', 'order count')
  // Gasto en anuncios: columna opcional, no confirmada en un CSV real de esta plantilla
  // (detección tolerante, inerte si no aparece). Ads = marketing, no comisión.
  const iAds    = find('gasto en anuncios', 'gasto publicidad', 'advertising spend', 'ads spend')

  if (iMarca === -1 || iPago === -1 || iFecha === -1) {
    return { items: [], errores: [`Formato CSV resumen Uber no reconocido. Columnas: ${cab.slice(0, 6).join(' | ')}`] }
  }

  const items: UberResumenItem[] = []
  for (let li = 1; li < rows.length; li++) {
    const cols = rows[li]
    const marca = (cols[iMarca] || '').trim()
    if (!marca) continue
    const fechaPago = fmtFechaCSV((cols[iFecha] || '').trim())
    if (!fechaPago || !/^\d{4}-\d{2}-\d{2}$/.test(fechaPago)) continue

    const d = new Date(fechaPago + 'T12:00:00')
    const fin = new Date(d); fin.setDate(d.getDate() - 1)
    const ini = new Date(d); ini.setDate(d.getDate() - 7)
    const iniStr = ini.toISOString().slice(0, 10)
    const finStr = fin.toISOString().slice(0, 10)

    const ventas = iVentas !== -1 ? numEN(cols[iVentas]) : 0
    const promo  = iPromo  !== -1 ? Math.abs(numEN(cols[iPromo])) : 0
    const brutoReal = Math.round((ventas - promo) * 100) / 100
    const pagoNeto = numEN(cols[iPago])
    const comision = iComis !== -1 ? Math.abs(numEN(cols[iComis])) : 0
    const pedidos  = iPed   !== -1 ? Math.round(numEN(cols[iPed])) : 0
    const refUber  = iRef   !== -1 ? (cols[iRef] || '').trim() : ''
    const ads      = iAds   !== -1 ? Math.abs(numEN(cols[iAds])) : 0

    items.push({
      referencia_pago: `uber_${normalizarMarca(marca)}_${iniStr}_${finStr}`,
      ref_uber: refUber,
      marca,
      fecha_deposito: fechaPago,
      fecha_inicio_periodo: iniStr,
      fecha_fin_periodo: finStr,
      num_pedidos: pedidos,
      ventas_bruto: brutoReal,
      promociones: promo,
      comision_uber: comision,
      pago_neto: pagoNeto,
      ads,
    })
  }
  return { items, errores: [] }
}
