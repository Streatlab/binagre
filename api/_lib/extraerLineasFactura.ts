// extraerLineasFactura.ts — extractor de líneas de compra (detalle producto a producto)
// de una factura de proveedor. Mismo patrón barato que ocr-anthropic.ts: trabaja sobre
// el TEXTO ya extraído del PDF (unpdf), una llamada de texto a Anthropic, nunca visión
// (evita el gasto que ya vació saldo una vez — ver comentario en ocr-anthropic.ts).
//
// Alimenta `facturas_lineas` (detalle por producto → luego se vincula a `ingredientes`
// para el stock) y dos columnas de estado en `facturas`:
//   - lineas_estado: 'con_lineas' | 'sin_detalle_lineas' | 'no_aplica' | 'error'
//   - estado_detalle_lineas: motivo corto legible (nº de líneas, o por qué no se pudo)
//   - detalle_lineas_diff: suma(total_linea) − factura.total (0 si cuadra; sirve de QA)
//
// SOLO se ejecuta sobre facturas tipo='proveedor'. Las de plataforma (Uber/Glovo/Just
// Eat) no tienen líneas de compra — se marcan 'no_aplica' sin gastar ninguna llamada.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_MODEL = 'claude-sonnet-4-5'
const TIMEOUT_MS = 60000

export interface LineaExtraida {
  descripcion: string
  cantidad: number | null
  unidad: string | null
  precio_unitario: number | null
  total_linea: number
  iva_pct: number | null
}

export interface ResultadoLineas {
  estado: 'con_lineas' | 'sin_detalle_lineas' | 'error'
  motivo: string
  lineas: LineaExtraida[]
  diff: number
}

const PROMPT = `Eres un extractor de líneas de compra de facturas españolas de proveedor (materia prima, envases, suministros, servicios). Recibes el texto OCR de UNA factura y su TOTAL ya conocido (con IVA). Devuelve SOLO un array JSON válido, sin texto alrededor, con una entrada por CADA línea/producto distinto de la factura:
[
  { "descripcion": string, "cantidad": number|null, "unidad": string|null, "precio_unitario": number|null, "total_linea": number, "iva_pct": number|null }
]
Reglas:
- Una entrada por línea de producto/concepto real. NUNCA repitas subtotales, bases de IVA, portes o el total general como si fueran una línea de producto.
- "descripcion" tal cual aparece en la factura (no traduzcas ni resumas).
- "cantidad" y "unidad" solo si aparecen explícitos (ej. "12 kg", "3 uds"); si no, null.
- "total_linea" es el importe de esa línea (con IVA si la factura lo desglosa así línea a línea; si no, el importe base de la línea).
- "iva_pct" el tipo de IVA de esa línea si se indica (4, 10 o 21); si no, null.
- Si el texto NO permite distinguir líneas individuales (factura resumen sin desglose, imagen sin texto útil, solo aparece el total), responde exactamente: []
- NO inventes líneas ni importes. Si tienes dudas de una línea concreta, omítela antes que inventarla.
Responde SOLO el array JSON (o [] si no hay líneas distinguibles).`

function numero(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number' && isFinite(v)) return v
  const s = String(v).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')
  const n = parseFloat(s)
  return isFinite(n) ? n : null
}

function parsearLineas(raw: string): LineaExtraida[] {
  let arr: unknown
  try { arr = JSON.parse(raw.replace(/```json|```/g, '').trim()) } catch { return [] }
  if (!Array.isArray(arr)) return []
  const out: LineaExtraida[] = []
  for (const it of arr) {
    if (!it || typeof it !== 'object') continue
    const o = it as Record<string, unknown>
    const totalLinea = numero(o.total_linea)
    const descripcion = String(o.descripcion || '').trim()
    if (!descripcion || totalLinea === null || totalLinea <= 0) continue
    out.push({
      descripcion,
      cantidad: numero(o.cantidad),
      unidad: o.unidad ? String(o.unidad).trim() : null,
      precio_unitario: numero(o.precio_unitario),
      total_linea: totalLinea,
      iva_pct: numero(o.iva_pct),
    })
  }
  return out
}

/** Vía BARATA: extracción de líneas sobre el texto OCR ya disponible (sin visión). */
export async function extraerLineasAnthropicTexto(textoOcr: string, totalFactura: number): Promise<ResultadoLineas> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { estado: 'error', motivo: 'Falta ANTHROPIC_API_KEY', lineas: [], diff: 0 }
  if (!textoOcr || textoOcr.trim().length < 20) {
    return { estado: 'sin_detalle_lineas', motivo: 'Sin texto legible en el PDF', lineas: [], diff: 0 }
  }

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `${PROMPT}\n\nTOTAL FACTURA: ${totalFactura}\n\n--- TEXTO DE LA FACTURA ---\n${textoOcr.slice(0, 16000)}`,
        }],
      }),
      signal: ctrl.signal,
    })
    if (!resp.ok) {
      const detalle = (await resp.text()).slice(0, 200)
      return { estado: 'error', motivo: `HTTP ${resp.status}: ${detalle}`, lineas: [], diff: 0 }
    }
    const data = await resp.json() as { content?: Array<{ text?: string }> }
    const raw = (data.content || []).map((c) => c.text || '').join('').trim()
    const lineas = parsearLineas(raw)
    if (lineas.length === 0) {
      return { estado: 'sin_detalle_lineas', motivo: 'Factura sin desglose de líneas distinguible', lineas: [], diff: 0 }
    }
    const sumaLineas = lineas.reduce((s, l) => s + l.total_linea, 0)
    const diff = Math.round((sumaLineas - totalFactura) * 100) / 100
    return { estado: 'con_lineas', motivo: `${lineas.length} líneas extraídas`, lineas, diff }
  } catch (err) {
    return { estado: 'error', motivo: err instanceof Error ? err.message : String(err), lineas: [], diff: 0 }
  } finally {
    clearTimeout(t)
  }
}
