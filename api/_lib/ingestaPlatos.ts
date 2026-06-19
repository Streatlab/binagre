// ingestaPlatos — motor de ingesta de PEDIDOS/PLATOS a la tabla pedidos_plataforma.
//
// Convierte los exports de pedidos de cada plataforma (Glovo / Uber / Sincro→Just Eat)
// en filas plato-a-plato con su fecha, hora, importe y marca. Esas filas alimentan
// las vistas v_ventas_plato / v_ventas_franja y el módulo "Ventas por plato y franja".
//
// Principios:
//   · Lee por NOMBRE de columna (no por posición): tolerante a reordenaciones.
//   · Defensivo: si no encuentra plato o fecha en una fila, la salta (no inventa).
//   · Limpia el nombre del plato: corta modificadores en MAYÚSCULAS y en "[",
//     y excluye bebidas/pan/extras para que el ranking de platos salga limpio.
//   · Idempotente: re-subir el mismo archivo REEMPLAZA sus ventas (no las suma).
//   · No crea facturas: esto es exclusivamente ventas por plato/franja.

import * as XLSX from 'xlsx'

export interface FilaPedido {
  fecha: string            // YYYY-MM-DD (obligatorio)
  hora: string | null      // HH:MM:SS
  plataforma: string
  marca: string
  plato: string
  precio_bruto: number | null
  promo: number | null
  glovo_id: string | null
  factura_origen: string | null
}

// ── Normalización de texto para comparar cabeceras y nombres ────────────────
function norm(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Parseo de importe español/inglés ("1.234,56" | "1,234.56" | "12,34" | "12.34") ─
function parseImporte(s: string | undefined | null): number | null {
  if (s == null) return null
  let v = String(s).replace(/[^\d.,-]/g, '').trim()
  if (!v) return null
  if (v.includes(',') && v.includes('.')) {
    // El último separador es el decimal
    if (v.lastIndexOf(',') > v.lastIndexOf('.')) v = v.replace(/\./g, '').replace(',', '.')
    else v = v.replace(/,/g, '')
  } else if (v.includes(',')) {
    v = v.replace(',', '.')
  }
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}

// ── Fecha/hora desde una celda ("2026-06-03 18:59", "03/06/2026 18:59", etc.) ──
function parseFechaHora(s: string | undefined | null): { fecha: string | null; hora: string | null } {
  if (!s) return { fecha: null, hora: null }
  const txt = String(s).trim()
  let fecha: string | null = null
  let m = txt.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/)        // YYYY-MM-DD
  if (m) fecha = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  if (!fecha) {
    m = txt.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/)          // DD-MM-YYYY
    if (m) fecha = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  let hora: string | null = null
  const h = txt.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/)
  if (h) hora = `${h[1].padStart(2, '0')}:${h[2]}:${h[3] || '00'}`
  return { fecha, hora }
}

// ── Limpieza del nombre de plato ────────────────────────────────────────────
// Reglas: los modificadores van SIEMPRE en MAYÚSCULAS → se cortan. También se
// corta en "[" (opciones). Y se descartan bebidas/pan/extras (no son plato).
const EXCLUIR = [
  'coca cola', 'cocacola', 'coca-cola', 'fanta', 'sprite', 'nestea', 'aquarius',
  'agua', 'refresco', 'bebida', 'cerveza', 'mahou', 'estrella',
  'pan para', 'pan de', 'cubiertos', 'servilleta', 'bolsa', 'palillos',
]

export function limpiarPlato(raw: string): string | null {
  if (!raw) return null
  let s = String(raw).trim()
  // Cortar opciones entre corchetes y todo lo que les siga
  const corch = s.indexOf('[')
  if (corch >= 0) s = s.slice(0, corch)
  // Cortar en el primer bloque de MAYÚSCULAS (modificadores). Se exige ≥3 letras
  // mayúsculas seguidas para no cortar siglas cortas dentro del nombre.
  const mayus = s.match(/[A-ZÁÉÍÓÚÑ]{3,}/)
  if (mayus && mayus.index !== undefined && mayus.index > 2) s = s.slice(0, mayus.index)
  // Quitar separadores colgantes y espacios
  s = s.replace(/[\s|·•\-–—:,;]+$/g, '').trim()
  // Quitar cantidad inicial tipo "1x ", "2 x ", "x1 "
  s = s.replace(/^\s*\d+\s*[x×]\s*/i, '').replace(/^\s*[x×]\s*\d+\s*/i, '').trim()
  if (s.length < 2) return null
  const n = norm(s)
  if (EXCLUIR.some(e => n.includes(e)) || n === 'pan') return null
  return s
}

// ── Lectura genérica de tabla (CSV con , ; o ' | ', o texto de xlsx) ─────────
interface Tabla { header: string[]; filas: string[][] }

function detectarSep(linea: string): string {
  if (linea.includes(' | ')) return ' | '
  const c = (linea.match(/,/g) || []).length
  const p = (linea.match(/;/g) || []).length
  const t = (linea.match(/\t/g) || []).length
  if (t >= c && t >= p) return '\t'
  return p > c ? ';' : ','
}

function partirLinea(linea: string, sep: string): string[] {
  if (sep === ' | ') return linea.split(' | ').map(c => c.trim())
  // CSV con comillas
  const out: string[] = []
  let cur = '', dentro = false
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i]
    if (ch === '"') { if (dentro && linea[i + 1] === '"') { cur += '"'; i++ } else dentro = !dentro }
    else if (ch === sep && !dentro) { out.push(cur.trim()); cur = '' }
    else cur += ch
  }
  out.push(cur.trim())
  return out
}

// Construye la tabla a partir del texto, saltando líneas de cabecera de hoja
// ("=== Hoja: X ===") que añade el extractor de Excel.
function leerTabla(texto: string): Tabla | null {
  const lineas = texto.split(/\r?\n/).filter(l => l.trim() && !/^===\s*Hoja:/i.test(l))
  if (lineas.length < 2) return null
  const sep = detectarSep(lineas[0])
  const header = partirLinea(lineas[0], sep)
  const filas = lineas.slice(1).map(l => partirLinea(l, sep)).filter(f => f.some(c => c))
  return { header, filas }
}

// Índice de la primera columna cuyo nombre contiene alguno de los términos dados.
function col(header: string[], ...terminos: string[]): number {
  const H = header.map(norm)
  for (const term of terminos) {
    const t = norm(term)
    const i = H.findIndex(h => h.includes(t))
    if (i >= 0) return i
  }
  return -1
}
function val(fila: string[], i: number): string { return i >= 0 && i < fila.length ? (fila[i] || '').trim() : '' }

// Texto plano de un xlsx (para Sincro Sold Products). Reusa SheetJS.
function xlsxATexto(buffer: Buffer): string {
  try {
    const wb = XLSX.read(buffer, { type: 'buffer' })
    let out = ''
    for (const name of wb.SheetNames) {
      const sh = wb.Sheets[name]
      if (sh) out += XLSX.utils.sheet_to_csv(sh, { FS: ' | ' }) + '\n'
    }
    return out
  } catch { return '' }
}

// ── PARSERS POR FORMATO ─────────────────────────────────────────────────────

// Glovo bill CSV (acompaña a la factura, una línea por producto): cuadra exacto.
function parseGlovoBill(texto: string, origen: string): FilaPedido[] {
  const t = leerTabla(texto); if (!t) return []
  const iPlato = col(t.header, 'product name', 'name of product', 'producto', 'item name')
  const iPrecio = col(t.header, 'price of products', 'product price', 'price', 'importe')
  const iPromo = col(t.header, 'promotion', 'discount', 'descuento')
  const iFecha = col(t.header, 'date', 'created', 'fecha')
  const iHora = col(t.header, 'time', 'hora')
  const iMarca = col(t.header, 'store name', 'store', 'partner', 'local', 'brand')
  const iId = col(t.header, 'glovo code', 'order code', 'order id', 'codigo')
  const out: FilaPedido[] = []
  for (const f of t.filas) {
    const plato = limpiarPlato(val(f, iPlato)); if (!plato) continue
    const fh = parseFechaHora(val(f, iFecha) + ' ' + val(f, iHora))
    if (!fh.fecha) continue
    out.push({
      fecha: fh.fecha, hora: fh.hora, plataforma: 'glovo',
      marca: val(f, iMarca) || 'Sin marca', plato,
      precio_bruto: parseImporte(val(f, iPrecio)), promo: parseImporte(val(f, iPromo)),
      glovo_id: val(f, iId) || null, factura_origen: origen,
    })
  }
  return out
}

// Glovo export del portal (orderDetails): una fila por PEDIDO, varios platos en
// una celda. Se reparten el bruto/promo del pedido a partes iguales entre platos.
function parseGlovoOrderDetails(texto: string, origen: string): FilaPedido[] {
  const t = leerTabla(texto); if (!t) return []
  const iMarca = col(t.header, 'nombre del local', 'local', 'store')
  const iFecha = col(t.header, 'fecha', 'creado', 'date')
  const iBruto = col(t.header, 'total parcial', 'subtotal', 'importe')
  const iPromo = col(t.header, 'descuento financiado por usted', 'descuento', 'promo')
  const iArt = col(t.header, 'articulos', 'productos', 'items')
  const iId = col(t.header, 'numero de pedido', 'pedido', 'codigo', 'order')
  const out: FilaPedido[] = []
  for (const f of t.filas) {
    const fh = parseFechaHora(val(f, iFecha))
    if (!fh.fecha) continue
    const marca = val(f, iMarca) || 'Sin marca'
    const bruto = parseImporte(val(f, iBruto))
    const promo = parseImporte(val(f, iPromo))
    const idPedido = val(f, iId) || null
    const crudo = val(f, iArt)
    const items = crudo.split(/\n|\s\|\s|;/).map(x => x.trim()).filter(Boolean)
    const limpios = items.map(limpiarPlato).filter((x): x is string => !!x)
    const n = limpios.length || 0
    for (const plato of limpios) {
      out.push({
        fecha: fh.fecha, hora: fh.hora, plataforma: 'glovo', marca, plato,
        precio_bruto: bruto != null && n > 0 ? Math.round((bruto / n) * 100) / 100 : null,
        promo: promo != null && n > 0 ? Math.round((promo / n) * 100) / 100 : null,
        glovo_id: idPedido, factura_origen: origen,
      })
    }
  }
  return out
}

// Uber "Detalle de ganancias nivel artículo": una fila por artículo.
function parseUberArticulo(texto: string, origen: string): FilaPedido[] {
  const t = leerTabla(texto); if (!t) return []
  const iPlato = col(t.header, 'nombre del articulo', 'articulo', 'item')
  const iMarca = col(t.header, 'nombre del restaurante', 'restaurante', 'tienda', 'marca')
  const iPrecio = col(t.header, 'precio de venta', 'precio del articulo', 'ventas', 'precio', 'importe', 'total')
  const iFecha = col(t.header, 'fecha del pedido', 'fecha', 'hora a la que se acepto')
  const iHora = col(t.header, 'hora a la que se acepto el pedido', 'hora del pedido', 'hora')
  const iId = col(t.header, 'id del pedido', 'numero de pedido', 'pedido')
  const out: FilaPedido[] = []
  for (const f of t.filas) {
    const plato = limpiarPlato(val(f, iPlato)); if (!plato) continue
    const fh = parseFechaHora(val(f, iFecha) + ' ' + val(f, iHora))
    if (!fh.fecha) continue
    out.push({
      fecha: fh.fecha, hora: fh.hora, plataforma: 'uber',
      marca: val(f, iMarca) || 'Sin marca', plato,
      precio_bruto: parseImporte(val(f, iPrecio)), promo: null,
      glovo_id: val(f, iId) || null, factura_origen: origen,
    })
  }
  return out
}

// Sincro "Sold Products" (Just Eat y otras): una fila por producto vendido.
function parseSincroSold(texto: string, origen: string): FilaPedido[] {
  const t = leerTabla(texto); if (!t) return []
  const iPlato = col(t.header, 'description', 'descripcion', 'product', 'producto')
  const iMarca = col(t.header, 'market', 'brand', 'marca', 'selling point', 'punto de venta')
  const iPrecio = col(t.header, 'total line price', 'line price', 'price', 'importe', 'total')
  const iFecha = col(t.header, 'date', 'fecha', 'order date')
  const iCant = col(t.header, 'quantity', 'qty', 'cantidad', 'units')
  const iPlat = col(t.header, 'channel', 'platform', 'plataforma')
  const out: FilaPedido[] = []
  for (const f of t.filas) {
    const plato = limpiarPlato(val(f, iPlato)); if (!plato) continue
    const fh = parseFechaHora(val(f, iFecha))
    if (!fh.fecha) continue
    // Plataforma real del canal Sincro: si la fila dice glovo/uber, respétalo; por defecto just_eat.
    const canal = norm(val(f, iPlat))
    const plataforma = canal.includes('glovo') ? 'glovo' : canal.includes('uber') ? 'uber' : 'just_eat'
    const cant = Math.max(1, Math.min(50, parseInt(val(f, iCant) || '1', 10) || 1))
    const precioTotal = parseImporte(val(f, iPrecio))
    const precioUnit = precioTotal != null ? Math.round((precioTotal / cant) * 100) / 100 : null
    for (let k = 0; k < cant; k++) {
      out.push({
        fecha: fh.fecha, hora: fh.hora, plataforma,
        marca: val(f, iMarca) || 'Sin marca', plato,
        precio_bruto: precioUnit, promo: null, glovo_id: null, factura_origen: origen,
      })
    }
  }
  return out
}

// ── PUNTO DE ENTRADA ────────────────────────────────────────────────────────
// Dado el tipo de documento detectado, el texto ya extraído (o el buffer para
// xlsx) y el nombre del archivo, vuelca las filas a pedidos_plataforma.
export async function ingestarPedidosPlataforma(
  supabase: any,
  tipo: string,
  texto: string,
  buffer: Buffer | null,
  nombreArchivo: string,
): Promise<{ insertados: number }> {
  let filas: FilaPedido[] = []
  switch (tipo) {
    case 'glovo_bill_csv':         filas = parseGlovoBill(texto, nombreArchivo); break
    case 'glovo_orderdetails_csv': filas = parseGlovoOrderDetails(texto, nombreArchivo); break
    case 'uber_articulo_csv':      filas = parseUberArticulo(texto, nombreArchivo); break
    case 'sincro_sold_products': {
      // Si el texto venía vacío (xlsx puro) lo releemos desde el buffer.
      const txt = (texto && texto.length > 40) ? texto : (buffer ? xlsxATexto(buffer) : '')
      filas = parseSincroSold(txt, nombreArchivo); break
    }
    default: return { insertados: 0 }
  }
  if (filas.length === 0) return { insertados: 0 }

  // CANDADO DE DUPLICADOS (idempotencia): re-subir el mismo archivo REEMPLAZA sus
  // ventas en vez de sumarlas. Se borra lo previo de este mismo archivo y se reinserta.
  // Solo se borra si el re-parseo SÍ produjo filas (arriba ya cortamos si vino vacío),
  // así un parseo fallido nunca destruye los datos buenos que ya había.
  try {
    await supabase.from('pedidos_plataforma').delete().eq('factura_origen', nombreArchivo)
  } catch { /* best-effort: si falla el borrado, se sigue insertando */ }

  let insertados = 0
  for (let i = 0; i < filas.length; i += 500) {
    const lote = filas.slice(i, i + 500)
    const { error } = await supabase.from('pedidos_plataforma').insert(lote)
    if (!error) insertados += lote.length
  }
  return { insertados }
}
