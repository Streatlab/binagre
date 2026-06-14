// ocr-mistral.ts — BOOTSTRAP de pago ACOTADO (regla 3 bis del procedimiento).
//
// NO es el motor de lectura gratis. Es el "molde de arranque": solo se invoca cuando
// reglas/plantilla + Tesseract NO han podido leer una factura de un proveedor que aún
// no tiene plantilla por NIF. Dos funciones:
//   - ocrMistralTexto(): OCR puro → texto markdown (para el parser español si aplica).
//   - extraerFacturaMistral(): EXTRACCIÓN ESTRUCTURADA → devuelve los campos de la
//     factura ya parseados (proveedor, NIF, total, fecha…), válido para facturas en
//     cualquier idioma/formato (portuguesas tipo Kitch, etc.) donde el parser español
//     falla. De ahí se aprende la plantilla y el resto del proveedor se lee gratis.
//
// Coste: una pasada puntual por proveedor nuevo (céntimos). Kill-switch por entorno
// (OCR_BOOTSTRAP_API) y candado natural por NIF.

import type { ExtractedFactura } from './ocr-types.js'

const MISTRAL_OCR_URL = 'https://api.mistral.ai/v1/ocr'
const MISTRAL_CHAT_URL = 'https://api.mistral.ai/v1/chat/completions'
const MISTRAL_OCR_MODEL = 'mistral-ocr-latest'
const MISTRAL_CHAT_MODEL = 'mistral-small-latest'
const TIMEOUT_MS = 90000

export function bootstrapApiActivo(): boolean {
  return process.env.OCR_BOOTSTRAP_API === 'true' && !!process.env.MISTRAL_API_KEY
}

// OCR puro: PDF/imagen → texto markdown de todas las páginas. '' ante cualquier fallo.
export async function ocrMistralTexto(buffer: Buffer, tipo: 'pdf' | 'imagen'): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) return ''

  const b64 = buffer.toString('base64')
  const document = tipo === 'imagen'
    ? { type: 'image_url', image_url: `data:image/jpeg;base64,${b64}` }
    : { type: 'document_url', document_url: `data:application/pdf;base64,${b64}` }

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const resp = await fetch(MISTRAL_OCR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: MISTRAL_OCR_MODEL, document, include_image_base64: false }),
      signal: ctrl.signal,
    })
    if (!resp.ok) {
      console.error('[ocrMistral] HTTP', resp.status, (await resp.text()).slice(0, 200))
      return ''
    }
    const data = await resp.json() as { pages?: Array<{ markdown?: string }> }
    return (data.pages || []).map((p) => p.markdown || '').join('\n').trim()
  } catch (err) {
    console.error('[ocrMistral] fallo:', err instanceof Error ? err.message : String(err))
    return ''
  } finally {
    clearTimeout(t)
  }
}

const PROMPT_EXTRACCION = `Eres un extractor de datos de facturas. Recibes el texto OCR de UNA factura (puede estar en español, portugués, inglés u otro idioma). Devuelve SOLO un objeto JSON válido, sin texto alrededor, con EXACTAMENTE estas claves:
{
  "proveedor_nombre": string,        // razón social del EMISOR (quien cobra)
  "nif_emisor": string|null,         // NIF/CIF/NIPC/VAT del EMISOR (no del cliente). Solo dígitos y letras, sin espacios. null si no aparece
  "numero_factura": string|null,
  "fecha_factura": string|null,      // formato YYYY-MM-DD
  "total": number|null,              // importe TOTAL a pagar, con IVA incluido, como número (punto decimal)
  "base_imponible": number|null,     // suma de bases sin IVA, si aparece
  "iva_total": number|null,          // suma de cuotas de IVA, si aparece
  "moneda": string|null              // EUR, etc.
}
Reglas: el EMISOR es quien emite/cobra la factura, normalmente arriba con su NIF; el CLIENTE (Rubén Rodriguez Vinagre / Emilio Dorca / Streat Lab) NO es el emisor. Si un dato no está, pon null. NO inventes. Responde SOLO el JSON.`

// Extracción estructurada vía chat sobre el texto OCR. Devuelve un ExtractedFactura
// parcial (con total y nif_emisor si los hay) o null. Válido para cualquier idioma.
export async function extraerFacturaMistral(textoOcr: string): Promise<ExtractedFactura | null> {
  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey || !textoOcr || textoOcr.trim().length < 20) return null

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const resp = await fetch(MISTRAL_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MISTRAL_CHAT_MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: PROMPT_EXTRACCION },
          { role: 'user', content: textoOcr.slice(0, 12000) },
        ],
      }),
      signal: ctrl.signal,
    })
    if (!resp.ok) {
      console.error('[extraerFacturaMistral] HTTP', resp.status, (await resp.text()).slice(0, 200))
      return null
    }
    const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> }
    const raw = data.choices?.[0]?.message?.content || ''
    let j: Record<string, unknown>
    try { j = JSON.parse(raw) } catch { return null }

    const total = numero(j.total)
    if (total === null || total <= 0) return null  // sin total no sirve

    const nifEmisor = limpiarNif(j.nif_emisor)
    const base = numero(j.base_imponible)
    const iva = numero(j.iva_total)

    // Mapeo a ExtractedFactura. Para facturas foráneas no desglosamos por tipo de IVA
    // (4/10/21 es español): se vuelca todo a base_21/iva_21 si hay desglose, o se deja
    // el total como única fuente fiable para conciliar. La conciliación usa el TOTAL.
    const fac: ExtractedFactura = {
      proveedor_nombre: String(j.proveedor_nombre || '').trim() || (nifEmisor ? `NIF ${nifEmisor}` : 'PROVEEDOR'),
      numero_factura: j.numero_factura ? String(j.numero_factura) : '',
      fecha_factura: fechaIso(j.fecha_factura),
      es_recapitulativa: false,
      periodo_inicio: null,
      periodo_fin: null,
      tipo: 'proveedor',
      plataforma: null,
      nif_cliente: null,
      nif_emisor: nifEmisor,
      nombre_cliente: null,
      base_4: 0, iva_4: 0,
      base_10: 0, iva_10: 0,
      base_21: base ?? 0, iva_21: iva ?? 0,
      total,
      confianza: 0.85,
    }
    return fac
  } catch (err) {
    console.error('[extraerFacturaMistral] fallo:', err instanceof Error ? err.message : String(err))
    return null
  } finally {
    clearTimeout(t)
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
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
  if (m) {
    let [, d, mo, y] = m
    if (y.length === 2) y = '20' + y
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return hoy
}
