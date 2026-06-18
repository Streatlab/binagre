// detectarDocumentoPlataforma — fingerprint de los documentos de plataforma delivery
// que se suben a Bandeja de entrada. Su único trabajo es decir QUÉ es cada archivo
// para que un CSV/Excel de pedidos NO acabe creándose como factura basura.
//
// Reconoce, por su cabecera/contenido (no por confiar en el nombre):
//   - Glovo: factura (PDF), CSV de la factura (bill_*.csv), export del portal (orderDetails).
//   - Uber:  detalle nivel artículo (CSV), resumen de ganancias (CSV), factura (PDF).
//   - Sincro: Sold Products (xlsx), selling_point (csv).
//   - Just Eat: factura (PDF).

export type DocPlataforma =
  | 'glovo_factura'
  | 'glovo_bill_csv'
  | 'glovo_orderdetails_csv'
  | 'uber_articulo_csv'
  | 'uber_resumen_csv'
  | 'uber_factura'
  | 'sincro_sold_products'
  | 'sincro_selling_point'
  | 'justeat_factura'
  | null

export interface DeteccionPlataforma {
  tipo: DocPlataforma
  plataforma: 'glovo' | 'uber' | 'just_eat' | 'sincro' | null
  destino: 'facturacion' | 'ventas_pedidos' | 'ventas_resumen' | null
  // esPedidos=true → es un export de pedidos/platos: NO es factura, NO debe crear factura.
  esPedidos: boolean
}

const NADA: DeteccionPlataforma = { tipo: null, plataforma: null, destino: null, esPedidos: false }

// `texto` = cabecera/primeras líneas del CSV o texto extraído del PDF/Excel.
export function detectarDocumentoPlataforma(
  nombre: string,
  texto: string | null | undefined,
): DeteccionPlataforma {
  const n = (nombre || '').toLowerCase()
  const t = (texto || '').slice(0, 6000)
  const ext = (n.split('.').pop() || '').trim()

  // ── GLOVO ────────────────────────────────────────────────────────────────
  // CSV que acompaña a la factura (bill_*.csv): cabecera inglesa inconfundible.
  if (/glovo code/i.test(t) && /price of products/i.test(t)) {
    return { tipo: 'glovo_bill_csv', plataforma: 'glovo', destino: 'ventas_pedidos', esPedidos: true }
  }
  // Export del portal (PedidosYa): cabecera española con estas columnas.
  if (/nombre del local/i.test(t) && /total parcial/i.test(t) && /descuento financiado por usted/i.test(t)) {
    return { tipo: 'glovo_orderdetails_csv', plataforma: 'glovo', destino: 'ventas_pedidos', esPedidos: true }
  }
  // Factura Glovo (PDF): emisor Glovoapp + liquidación.
  if (/glovoapp spain/i.test(t) && /ingreso a cuenta colaborador/i.test(t)) {
    return { tipo: 'glovo_factura', plataforma: 'glovo', destino: 'facturacion', esPedidos: false }
  }

  // ── UBER EATS ────────────────────────────────────────────────────────────
  const esUber = /uber eats|membres[ií]a de uber|administrador de uber/i.test(t)
  if (esUber && /nombre del art[ií]culo/i.test(t)) {
    return { tipo: 'uber_articulo_csv', plataforma: 'uber', destino: 'ventas_pedidos', esPedidos: true }
  }
  if (esUber && /nombre del restaurante/i.test(t) && /cantidad de pedidos/i.test(t)) {
    return { tipo: 'uber_resumen_csv', plataforma: 'uber', destino: 'ventas_resumen', esPedidos: true }
  }

  // ── SINCRO ───────────────────────────────────────────────────────────────
  // Sold Products (xlsx): cabecera con MARKET + DESCRIPTION + TOTAL LINE PRICE.
  if (/\bmarket\b/i.test(t) && /\bdescription\b/i.test(t) && /total line price/i.test(t)) {
    return { tipo: 'sincro_sold_products', plataforma: 'sincro', destino: 'ventas_pedidos', esPedidos: true }
  }
  // selling_point (csv sin cabecera, separado por ';'): por nombre o por marcadores.
  if (/selling_point_orders_with_brand/i.test(n) ||
      (ext === 'csv' && /(justeat|glovo)/i.test(t) && /finished/i.test(t))) {
    return { tipo: 'sincro_selling_point', plataforma: 'sincro', destino: 'ventas_resumen', esPedidos: true }
  }

  // ── FACTURAS Uber / Just Eat (PDF) ───────────────────────────────────────
  if (ext === 'pdf' && /portier eats|uber eats/i.test(t) && /(factura|invoice)/i.test(t)) {
    return { tipo: 'uber_factura', plataforma: 'uber', destino: 'facturacion', esPedidos: false }
  }
  if (ext === 'pdf' && /just\s*eat/i.test(t) && /(factura|invoice)/i.test(t)) {
    return { tipo: 'justeat_factura', plataforma: 'just_eat', destino: 'facturacion', esPedidos: false }
  }

  return NADA
}
