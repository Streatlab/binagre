// Parser CSV resumen Uber Eats (common_template_for_europe_middle_east_africa)
// Soporta: BOM, cabeceras en español, "Pago total" con espacio trailing

function fmtFechaCSV(v: string): string {
  if (!v) return ''
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/)
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2]}-${m[1]}`
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10)
  return v
}

function numES(v: string): number {
  return parseFloat((v || '0').replace(/\./g, '').replace(',', '.')) || 0
}

export function parseUberResumenCSV(texto: string): { items: any[]; errores: string[] } {
  const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean)
  if (lineas.length < 2) return { items: [], errores: ['CSV vacío'] }

  const rawCab = lineas[0].replace(/^\uFEFF/, '')
  const colsRaw = rawCab.split(',').map(h => h.trim().replace(/\s+/g, ' '))
  const cab = colsRaw.map(h => h.toLowerCase())

  const find = (...candidates: string[]) => {
    for (const c of candidates) {
      const x = cab.indexOf(c.toLowerCase())
      if (x !== -1) return x
    }
    return -1
  }

  const iMarca  = find('nombre del restaurante', 'store name', 'nombre de la tienda', 'restaurant name')
  const iRef    = find('id. de referencia de ganancias', 'id de referencia de ganancias', 'payment reference', 'earnings reference id')
  const iPago   = find('pago total', 'net payout', 'pago neto', 'total payout', 'payment total')
  const iFecha  = find('fecha de pago', 'payment date')
  const iVentas = find('ventas (con iva)', 'sales (incl. vat)')
  const iComis  = find('tasas de servicio', 'tasa de servicio después del descuento (con iva)', 'service fee (incl. vat)')
  const iOtros  = find('tarifa por canje de la oferta', 'offer redemption fee')

  if (iMarca === -1 || iRef === -1 || iPago === -1) {
    return { items: [], errores: [`Formato CSV resumen no reconocido. Cabeceras: ${colsRaw.slice(0, 6).join(' | ')}`] }
  }

  const items: any[] = []
  for (let li = 1; li < lineas.length; li++) {
    const cols = lineas[li].split(',')
    if (cols.length < 3) continue
    const ref = cols[iRef]?.trim(), marca = cols[iMarca]?.trim()
    if (!ref || !marca) continue
    items.push({
      referencia_pago: ref,
      marca,
      pago_neto:         numES(cols[iPago]?.trim()  || '0'),
      fecha_deposito:    iFecha  !== -1 ? fmtFechaCSV(cols[iFecha]?.trim()  || '') : '',
      ventas_bruto:      iVentas !== -1 ? numES(cols[iVentas]?.trim() || '0') : 0,
      comision_uber:     iComis  !== -1 ? numES(cols[iComis]?.trim()  || '0') : 0,
      otros_cargos_promo: iOtros !== -1 ? numES(cols[iOtros]?.trim()  || '0') : 0,
    })
  }
  return { items, errores: [] }
}

export function esCSVResumenUber(cab0: string): boolean {
  const c = cab0.toLowerCase()
  return (
    c.includes('nombre del restaurante') ||
    c.includes('store name') ||
    c.includes('nombre de la tienda') ||
    c.includes('id. de referencia de ganancias') ||
    c.includes('payment reference') ||
    c.includes('pago total') ||
    c.includes('net payout')
  )
}
