// ocr-anthropic.ts — ÚLTIMO escalón de la cascada (regla 3 bis), versión BARATA.
//
// CAMBIO IMPORTANTE (16/06): antes mandaba el PDF entero por VISIÓN a Claude, lo
// que renderiza todas las páginas a imágenes y consume muchísimos tokens de entrada
// (vació el saldo durante el reproceso masivo). Ahora trabaja sobre el TEXTO que el
// motor YA ha extraído (Tesseract/Mistral OCR), igual que hace el escalón Mistral:
// una llamada de texto cuesta 10-50× menos que una de visión.
//
//   - extraerFacturaAnthropicTexto(textoOcr): extrae sobre texto (BARATO). Es la vía
//     normal: el motor siempre tiene texto antes de llegar aquí.
//   - extraerFacturaAnthropic(buffer, tipo, mime, textoOcr?): compatibilidad. Si hay
//     texto suficiente usa la vía barata. La VISIÓN sobre el PDF queda APAGADA por
//     defecto y solo se activa con OCR_ANTHROPIC_VISION='true' (kill-switch explícito),
//     para no volver a vaciar saldo sin querer.
//
// Candado natural por NIF: tras leer, el motor aprende la plantilla y el resto del
// proveedor se lee gratis; Anthropic no se vuelve a tocar para ese NIF.

import type { ExtractedFactura } from './ocr-types.js'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_MODEL = 'claude-sonnet-4-5'
const TIMEOUT_MS = 60000

const NIF_CLIENTES = new Set(['21669051S', '53484832B'])

// ¿Permitido usar Anthropic como escalón de bootstrap (vía texto, barata)?
export function anthropicBootstrapActivo(): boolean {
  return process.env.OCR_BOOTSTRAP_API === 'true' && !!process.env.ANTHROPIC_API_KEY
}

// ¿Permitida la VISIÓN sobre PDF/imagen? APAGADA por defecto: es cara y fue la causa
// del gasto. Solo se enciende a propósito con OCR_ANTHROPIC_VISION='true'.
function anthropicVisionActivo(): boolean {
  return process.env.OCR_ANTHROPIC_VISION === 'true' && !!process.env.ANTHROPIC_API_KEY
}

const PROMPT = `Eres un extractor de datos de facturas españolas. Recibes el texto OCR de UNA factura (puede estar en español, portugués, inglés u otro idioma). Devuelve SOLO un objeto JSON válido, sin texto alrededor, con EXACTAMENTE estas claves:
{
  "proveedor_nombre": string,
  "nif_emisor": string|null,
  "nif_cliente": string|null,
  "numero_factura": string|null,
  "fecha_factura": string|null,
  "base_4": number, "iva_4": number,
  "base_10": number, "iva_10": number,
  "base_21": number, "iva_21": number,
  "total": number|null,
  "moneda": string|null
}
Reglas:
- El EMISOR es quien emite/cobra la factura (su NIF suele ir arriba). El CLIENTE (Rubén Rodriguez Vinagre 21669051S / Emilio Dorca 53484832B / Streat Lab) NO es el emisor.
- nif_emisor y nif_cliente: solo dígitos y letras, sin espacios ni guiones.
- Desglosa el IVA por tipo (4%, 10%, 21%). Si un tipo no aparece, su base y cuota van a 0.
- total = importe total a pagar con IVA incluido.
- fecha_factura en formato YYYY-MM-DD.
- Si un dato no aparece, usa null (o 0 en las bases/cuotas). NO inventes.
Responde SOLO el JSON.`

// Vía BARATA: extracción sobre el texto OCR ya disponible (sin visión).
export async function extraerFacturaAnthropicTexto(textoOcr: string): Promise<ExtractedFactura | null> {
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
        max_tokens: 1200,
        messages: [{ role: 'user', content: `${PROMPT}\n\n--- TEXTO DE LA FACTURA ---\n${textoOcr.slice(0, 12000)}` }],
      }),
      signal: ctrl.signal,
    })
    if (!resp.ok) {
      console.error('[anthropicTexto] HTTP', resp.status, (await resp.text()).slice(0, 200))
      return null
    }
    const data = await resp.json() as { content?: Array<{ text?: string }> }
    const raw = (data.content || []).map((c) => c.text || '').join('').trim()
    return parsearFactura(raw)
  } catch (err) {
    console.error('[anthropicTexto] fallo:', err instanceof Error ? err.message : String(err))
    return null
  } finally {
    clearTimeout(t)
  }
}

// Compatibilidad con el motor: usa texto si lo hay; visión solo si está activada.
export async function extraerFacturaAnthropic(
  buffer: Buffer,
  tipo: 'pdf' | 'imagen',
  mimeType: string,
  textoOcr?: string | null,
): Promise<ExtractedFactura | null> {
  // Vía normal y barata: si el motor ya tiene texto, se usa ese.
  if (textoOcr && textoOcr.trim().length >= 20) {
    return extraerFacturaAnthropicTexto(textoOcr)
  }
  // Sin texto (imagen pura sin OCR): solo si la visión está explícitamente activada.
  if (!anthropicVisionActivo()) return null

  const apiKey = process.env.ANTHROPIC_API_KEY!
  const b64 = buffer.toString('base64')
  const bloqueDoc = tipo === 'pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
    : { type: 'image', source: { type: 'base64', media_type: mimeType || 'image/jpeg', data: b64 } }
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1200,
        messages: [{ role: 'user', content: [bloqueDoc, { type: 'text', text: PROMPT }] }],
      }),
      signal: ctrl.signal,
    })
    if (!resp.ok) { console.error('[anthropicVision] HTTP', resp.status); return null }
    const data = await resp.json() as { content?: Array<{ text?: string }> }
    const raw = (data.content || []).map((c) => c.text || '').join('').trim()
    return parsearFactura(raw)
  } catch (err) {
    console.error('[anthropicVision] fallo:', err instanceof Error ? err.message : String(err))
    return null
  } finally {
    clearTimeout(t)
  }
}

// VISIÓN de ÚLTIMO RECURSO (rasteriza el PDF/imagen con el modelo). Solo la invoca
// procesarArchivo cuando plantilla + Tesseract + Mistral + Anthropic-texto fallaron
// Y el NIF aún no ha gastado su visión (candado vision_usada por NIF en
// reglas_conciliacion). El control de coste es ese candado: MÁX 1 visión por
// proveedor. Kill-switch: OCR_VISION_ULTIMO_RECURSO='false' lo apaga del todo.
export async function extraerFacturaAnthropicVisionUltimoRecurso(
  buffer: Buffer,
  tipo: 'pdf' | 'imagen',
  mimeType: string,
): Promise<ExtractedFactura | null> {
  if (process.env.OCR_VISION_ULTIMO_RECURSO === 'false') return null
  if (!process.env.ANTHROPIC_API_KEY) return null
  const apiKey = process.env.ANTHROPIC_API_KEY
  const b64 = buffer.toString('base64')
  const bloqueDoc = tipo === 'pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
    : { type: 'image', source: { type: 'base64', media_type: mimeType || 'image/jpeg', data: b64 } }
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1200,
        messages: [{ role: 'user', content: [bloqueDoc, { type: 'text', text: PROMPT }] }],
      }),
      signal: ctrl.signal,
    })
    if (!resp.ok) { console.error('[anthropicVisionUR] HTTP', resp.status); return null }
    const data = await resp.json() as { content?: Array<{ text?: string }> }
    const raw = (data.content || []).map((c) => c.text || '').join('').trim()
    return parsearFactura(raw)
  } catch (err) {
    console.error('[anthropicVisionUR] fallo:', err instanceof Error ? err.message : String(err))
    return null
  } finally {
    clearTimeout(t)
  }
}

function parsearFactura(raw: string): ExtractedFactura | null {
  let j: Record<string, unknown>
  try { j = JSON.parse(raw.replace(/```json|```/g, '').trim()) } catch { return null }

  const total = numero(j.total)
  if (total === null || total <= 0) return null

  let nifEmisor = limpiarNif(j.nif_emisor)
  if (nifEmisor && NIF_CLIENTES.has(nifEmisor)) nifEmisor = null // el cliente nunca es emisor
  const nifCliente = limpiarNif(j.nif_cliente)

  return {
    proveedor_nombre: String(j.proveedor_nombre || '').trim() || (nifEmisor ? `NIF ${nifEmisor}` : 'PROVEEDOR'),
    numero_factura: j.numero_factura ? String(j.numero_factura) : '',
    fecha_factura: fechaIso(j.fecha_factura),
    es_recapitulativa: false,
    periodo_inicio: null,
    periodo_fin: null,
    tipo: 'proveedor',
    plataforma: null,
    nif_cliente: nifCliente,
    nif_emisor: nifEmisor,
    nombre_cliente: null,
    base_4: numero(j.base_4) ?? 0, iva_4: numero(j.iva_4) ?? 0,
    base_10: numero(j.base_10) ?? 0, iva_10: numero(j.iva_10) ?? 0,
    base_21: numero(j.base_21) ?? 0, iva_21: numero(j.iva_21) ?? 0,
    total,
    confianza: 0.9,
  }
}

function numero(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number' && isFinite(v)) return v
  const s = String(v).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')
  const n = parseFloat(s)
  return isFinite(n) ? n : null
}
function limpiarNif(v: unknown): string | null {
  if (!v) return null
  const s = String(v).replace(/[\s\-.]/g, '').toUpperCase()
  return s.length >= 6 ? s : null
}
function fechaIso(v: unknown): string {
  const hoy = new Date().toISOString().slice(0, 10)
  if (!v) return hoy
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})[\/\-.]( \d{1,2})[\/\-.]( \d{2,4})$/)
  if (m) { let [, d, mo, y] = m; if (y.length === 2) y = '20' + y; return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}` }
  return hoy
}
