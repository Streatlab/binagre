// extraerLineasFactura — extracción del detalle línea a línea de una factura de
// proveedor (descripción, cantidad, precio unitario, IVA) a partir del texto ya
// obtenido por el motor de OCR de cabecera. Vía BARATA: texto, no visión, igual
// que el resto de la cascada (ver ocr-anthropic.ts).
//
// Fuente 1 del PROMPT MAESTRO granularidad total: `facturas_lineas`. Si la suma
// de líneas (+IVA) no cuadra con `facturas.total` en ±0.05€, NO se insertan
// líneas a medias: la factura queda marcada `lineas_estado='sin_detalle_lineas'`.

export interface LineaExtraidaFactura {
  descripcion: string
  cantidad: number
  unidad: string | null
  precio_unitario: number | null
  total_linea: number | null
  iva_pct: number | null
  /** Envase (Bolsa/Caja/Bandeja/Bote/Lata/Botella/Paquete/Unidad...). Solo lo rellena la vía PDF de escandallo-auto. */
  formato?: string | null
  /** Contenido del envase (ej. 2 en "MALLA 2 KG"). Solo lo rellena la vía PDF de escandallo-auto. */
  contenido_valor?: number | null
  /** Unidad del contenido: kg|g|l|ml|ud. Solo lo rellena la vía PDF de escandallo-auto. */
  contenido_unidad?: string | null
}

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_MODEL = 'claude-sonnet-4-5'
const TIMEOUT_MS = 60000

function prompt(totalFactura: number, proveedor: string): string {
  return `Eres un extractor de líneas de facturas españolas. Recibes el texto OCR de UNA factura del proveedor "${proveedor}" cuyo TOTAL con IVA es ${totalFactura.toFixed(2)}€.

Devuelve SOLO un array JSON válido, sin texto alrededor, con una entrada por línea/artículo/concepto facturado:
[
  {
    "descripcion": string,
    "cantidad": number,
    "unidad": string|null,
    "precio_unitario": number|null,
    "total_linea": number,
    "iva_pct": number|null
  }
]
Reglas:
- Una entrada por CADA línea de producto/concepto/artículo de la factura. NO agregues ni resumas varias líneas en una.
- "cantidad": si la factura no desglosa cantidad, usa 1.
- "total_linea": importe de esa línea SIN IVA (base imponible de la línea), tal como aparece en la factura.
- "iva_pct": el tipo de IVA de esa línea si se indica (4, 10, 21...). Si no se indica por línea, null.
- NO inventes líneas ni importes. Si la factura es recapitulativa/sin desglose de artículos (solo un total), devuelve un array vacío [].
- No incluyas líneas de "Total", "Base imponible", "IVA" ni subtotales como si fueran artículos.
Responde SOLO el array JSON.`
}

export async function extraerLineasFacturaTexto(
  textoOcr: string,
  totalFactura: number,
  proveedor: string,
): Promise<LineaExtraidaFactura[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || !textoOcr || textoOcr.trim().length < 20) return null

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 4000,
        messages: [{ role: 'user', content: `${prompt(totalFactura, proveedor)}\n\n--- TEXTO DE LA FACTURA ---\n${textoOcr.slice(0, 14000)}` }],
      }),
      signal: ctrl.signal,
    })
    if (!resp.ok) {
      console.error('[extraerLineasFactura] HTTP', resp.status, (await resp.text()).slice(0, 200))
      return null
    }
    const data = await resp.json() as { content?: Array<{ text?: string }> }
    const raw = (data.content || []).map(c => c.text || '').join('').trim()
    return parsearLineas(raw)
  } catch (err) {
    console.error('[extraerLineasFactura] fallo:', err instanceof Error ? err.message : String(err))
    return null
  } finally {
    clearTimeout(t)
  }
}

function parsearLineas(raw: string): LineaExtraidaFactura[] | null {
  let arr: unknown
  try { arr = JSON.parse(raw.replace(/```json|```/g, '').trim()) } catch { return null }
  if (!Array.isArray(arr)) return null

  const out: LineaExtraidaFactura[] = []
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const descripcion = String(o.descripcion || '').trim()
    if (!descripcion) continue
    const totalLinea = numero(o.total_linea)
    out.push({
      descripcion,
      cantidad: numero(o.cantidad) ?? 1,
      unidad: o.unidad ? String(o.unidad).trim() : null,
      precio_unitario: numero(o.precio_unitario),
      total_linea: totalLinea,
      iva_pct: numero(o.iva_pct),
    })
  }
  return out
}

function numero(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number' && isFinite(v)) return v
  const s = String(v).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')
  const n = parseFloat(s)
  return isFinite(n) ? n : null
}

/** Suma de líneas (base + IVA de línea si se conoce) para comparar contra el total de cabecera. */
export function sumaConIva(lineas: LineaExtraidaFactura[]): number {
  let suma = 0
  for (const l of lineas) {
    const base = l.total_linea ?? 0
    const iva = l.iva_pct != null ? base * (l.iva_pct / 100) : 0
    suma += base + iva
  }
  return Math.round(suma * 100) / 100
}
