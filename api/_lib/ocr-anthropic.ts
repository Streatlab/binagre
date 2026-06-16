// ocr-anthropic.ts — ÚLTIMO escalón de la cascada de lectura (regla 3 bis).
//
// Orden de la cascada en procesarArchivo:
//   1) Reglas / plantilla por NIF (gratis)
//   2) OCR Tesseract (gratis) + reglas
//   3) Mistral bootstrap (pago acotado) — texto + reglas / extracción estructurada
//   4) Anthropic (este archivo) — ÚLTIMO recurso, máxima capacidad de lectura
//
// Solo se invoca cuando 1-3 NO han leído una factura de un proveedor que aún no
// tiene plantilla por NIF. Una pasada puntual por proveedor nuevo; tras leerla se
// aprende la plantilla y el resto del proveedor se lee gratis (candado por NIF).
//
// A diferencia de Mistral, Anthropic devuelve también el DESGLOSE de IVA español
// (bases y cuotas 4/10/21), con lo que la extracción queda completa (punto 4).
//
// Kill-switch por entorno (OCR_BOOTSTRAP_API) + candado natural por NIF, igual que
// Mistral. Requiere ANTHROPIC_API_KEY (la misma que usa el procesado de extractos).

import type { ExtractedFactura } from './ocr-types.js'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_MODEL = 'claude-sonnet-4-5'
const TIMEOUT_MS = 90000

// NIF de los clientes (Rubén / Emilio). NUNCA pueden ser el emisor: son quienes
// reciben la factura. Si la IA los devuelve como emisor (error que generó 140
// facturas mal marcadas como "tu DNI como emisor"), se descarta ese NIF.
const NIF_CLIENTES = new Set(['21669051S', '53484832B'])

// ¿Está permitido usar Anthropic como escalón de bootstrap?
export function anthropicBootstrapActivo(): boolean {
  return process.env.OCR_BOOTSTRAP_API === 'true' && !!process.env.ANTHROPIC_API_KEY
}

const PROMPT = `Eres un extractor de datos de facturas españolas. Recibes el documento (PDF o imagen) de UNA factura. Devuelve SOLO un objeto JSON válido, sin texto alrededor, con EXACTAMENTE estas claves:
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

// Extracción estructurada con Claude directamente sobre el PDF/imagen (vision).
// Devuelve un ExtractedFactura con desglose de IVA o null si no hay total fiable.
export async function extraerFacturaAnthropic(
  buffer: Buffer,
  tipo: 'pdf' | 'imagen',
  mimeType: string,
): Promise<ExtractedFactura | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const b64 = buffer.toString('base64')
  const bloqueDoc = tipo === 'pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
    : { type: 'image', source: { type: 'base64', media_type: mimeType || 'image/jpeg', data: b64 } }

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1500,
        messages: [{ role: 'user', content: [bloqueDoc, { type: 'text', text: PROMPT }] }],
      }),
      signal: ctrl.signal,
    })
    if (!resp.ok) {
      console.error('[extraerFacturaAnthropic] HTTP', resp.status, (await resp.text()).slice(0, 200))
      return null
    }
    const data = await resp.json() as { content?: Array<{ text?: string }> }
    const raw = (data.content || []).map((c) => c.text || '').join('').trim()
    let j: Record<string, unknown>
    try { j = JSON.parse(raw.replace(/```json|```/g, '').trim()) } catch { return null }

    const total = numero(j.total)
    if (total === null || total <= 0) return null

    let nifEmisor = limpiarNif(j.nif_emisor)
    let nifCliente = limpiarNif(j.nif_cliente)
    // BLINDAJE: el emisor jamás puede ser un cliente (Rubén/Emilio). Si la IA lo
    // confunde, se descarta como emisor y, si no estaba ya, se registra como cliente.
    if (nifEmisor && NIF_CLIENTES.has(nifEmisor)) {
      if (!nifCliente) nifCliente = nifEmisor
      nifEmisor = null
    }

    const fac: ExtractedFactura = {
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
    return fac
  } catch (err) {
    console.error('[extraerFacturaAnthropic] fallo:', err instanceof Error ? err.message : String(err))
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
