// mistral-ocr.ts — Lector de facturas con Mistral (Document AI / visión).
// Devuelve el MISMO formato ExtractedFactura que el lector anterior, así que el
// resto del motor no cambia. Entra solo como red de seguridad de alta calidad
// cuando las reglas + Tesseract no resuelven (PDFs/fotos raras, plataformas).
// Coste ~0,002 €/factura. Tolera la clave en mayúsculas o minúsculas.
import type { ContenidoExtraido } from './extractores.js'
import type { ExtractedFactura } from './ocr.js'

const PROMPT_OCR_FACTURA = `Eres un extractor de datos de facturas espanolas. Analiza la factura adjunta y devuelve SOLO un JSON valido con este esquema exacto (sin texto adicional, sin markdown):

{
  "proveedor_nombre": "string",
  "numero_factura": "string",
  "fecha_factura": "YYYY-MM-DD",
  "es_recapitulativa": boolean,
  "periodo_inicio": "YYYY-MM-DD" | null,
  "periodo_fin": "YYYY-MM-DD" | null,
  "tipo": "proveedor" | "plataforma",
  "plataforma": "uber" | "glovo" | "just_eat" | null,
  "nif_cliente": "string" | null,
  "nif_emisor": "string" | null,
  "nombre_cliente": "string" | null,
  "base_4": number,
  "iva_4": number,
  "base_10": number,
  "iva_10": number,
  "base_21": number,
  "iva_21": number,
  "total": number,
  "confianza": number,
  "plataforma_detalle": [
    {
      "marca_nombre": "string",
      "pedidos": number,
      "ventas_brutas": number,
      "comision": number,
      "comision_iva": number,
      "fee_fijo": number,
      "ads": number,
      "promos_cubiertas": number,
      "neto_liquidado": number,
      "periodo_inicio": "YYYY-MM-DD",
      "periodo_fin": "YYYY-MM-DD"
    }
  ]
}

Reglas:
- TIPO: solo dos valores posibles. "plataforma" si es Uber/Glovo/Just Eat/Portier Eats/Glovo App. En cualquier otro caso, "proveedor". Toda factura tiene un proveedor que la emite, por tanto siempre es proveedor salvo plataformas delivery.
- Si no hay base al 4%/10%/21% usa 0.
- Si es ticket de supermercado recapitulativo de Mercadona/Lidl/Alcampo, es_recapitulativa=true y extrae periodo.
- Si no detectas numero factura, usa la referencia mas unica que encuentres.
- "ventas_brutas" en plataformas = PVP con IVA (lo que pago el cliente).
- Si la factura es de Uber/Glovo/Just Eat (o "Portier Eats"), rellena plataforma_detalle con una entrada por marca facturada.
- "Portier Eats" tipo=plataforma, plataforma=uber.
- "Glovo App" o "Glovoapp" tipo=plataforma, plataforma=glovo.
- "Just Eat" tipo=plataforma, plataforma=just_eat.
- Todos los importes en euros con punto decimal. NO uses coma.
- confianza entre 0 y 100 (porcentaje entero).
- nif_cliente: NIF/CIF del CLIENTE (destinatario). Si no aparece null.
- nif_emisor: NIF/CIF de quien EMITE. Si no aparece null.
- nombre_cliente: razon social del cliente. Si no aparece null.

IMPORTANTE: NUNCA confundas el NIF/DNI con el número de factura. El número de factura suele tener formato A-2026/000123, INV-2026-001, B26/0001283, FAC-2026-12345, etc. El NIF/DNI tiene 8 dígitos + letra (formato 12345678X) o letra + 8 dígitos (B26309096). Si el documento solo tiene NIFs y ningún identificador único de factura, devuelve null en numero_factura.

Devuelve SOLO el JSON, nada mas.`

// Modelo con visión, barato. Soporta imagen y PDF (document_url) y JSON forzado.
const MODELO = process.env.MISTRAL_MODEL || 'mistral-small-latest'
const TIMEOUT_MS = 25000

function getKey(): string | null {
  return (
    process.env.MISTRAL_API_KEY ||
    process.env.mistral_api_key ||
    process.env.Mistral_Api_Key ||
    null
  )
}

export function mistralDisponible(): boolean {
  return !!getKey()
}

function normalizarConfianza(valor: number | undefined | null): number {
  if (valor === undefined || valor === null) return 0
  if (valor > 0 && valor <= 1) return Math.round(valor * 100)
  return Math.round(valor)
}

function errorLegible(status: number, body: string): string {
  const txt = (body || '').toLowerCase()
  if (status === 401 || txt.includes('unauthorized')) return 'CLAVE MISTRAL INVÁLIDA · revisa MISTRAL_API_KEY en Vercel'
  if (status === 402 || txt.includes('payment')) return 'MISTRAL SIN PLAN/CRÉDITO · elige plan en console.mistral.ai'
  if (status === 429 || txt.includes('rate')) return 'MISTRAL LÍMITE DE PETICIONES · reintenta en 1 min'
  return `ERROR MISTRAL (${status}): ${body.slice(0, 200)}`
}

// Candado de cuadre: las bases + IVAs deben aproximarse al total (±1 € o ±2%).
// Si no cuadra, la lectura es sospechosa y se marca confianza baja para revisión.
export function cuadraImportes(f: ExtractedFactura): boolean {
  const suma =
    (f.base_4 || 0) + (f.iva_4 || 0) +
    (f.base_10 || 0) + (f.iva_10 || 0) +
    (f.base_21 || 0) + (f.iva_21 || 0)
  if (!f.total) return false
  const dif = Math.abs(suma - f.total)
  // Solo aplica el candado si hay desglose de bases (suma > 0); muchas facturas
  // simples no traen desglose y eso no debe invalidarlas.
  if (suma === 0) return true
  return dif <= 1 || dif <= Math.abs(f.total) * 0.02
}

export async function leerFacturaMistral(contenido: ContenidoExtraido): Promise<ExtractedFactura> {
  const key = getKey()
  if (!key) throw new Error('CONFIG: clave de Mistral no configurada en Vercel')

  const userContent: Array<Record<string, unknown>> = []
  if (contenido.tipo === 'vision') {
    const buffer = contenido.data as Buffer
    const b64 = buffer.toString('base64')
    const media = contenido.mediaType || 'application/pdf'
    if (media === 'application/pdf') {
      userContent.push({ type: 'document_url', document_url: `data:application/pdf;base64,${b64}` })
    } else {
      userContent.push({ type: 'image_url', image_url: `data:${media};base64,${b64}` })
    }
    userContent.push({ type: 'text', text: PROMPT_OCR_FACTURA })
  } else {
    const texto = typeof contenido.data === 'string' ? contenido.data : contenido.data.toString('utf-8')
    userContent.push({ type: 'text', text: `${PROMPT_OCR_FACTURA}\n\n=== CONTENIDO FACTURA ===\n${texto}` })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let r: Response
  try {
    r = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: userContent }],
      }),
      signal: controller.signal,
    })
  } catch (err) {
    throw new Error(err instanceof Error && err.name === 'AbortError'
      ? 'TIMEOUT · Mistral tardó demasiado'
      : `ERROR red Mistral: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    clearTimeout(timer)
  }

  const body = await r.text()
  if (!r.ok) throw new Error(errorLegible(r.status, body))

  let j: Record<string, unknown>
  try {
    j = JSON.parse(body)
  } catch {
    throw new Error('Mistral devolvió una respuesta no-JSON')
  }
  const choices = j.choices as Array<{ message?: { content?: string } }> | undefined
  const raw = choices?.[0]?.message?.content
  if (!raw) throw new Error('Mistral devolvió respuesta vacía')

  let parsed: ExtractedFactura & { tipo: string }
  try {
    parsed = JSON.parse(String(raw).replace(/```json|```/g, '').trim())
  } catch {
    throw new Error(`JSON inválido de Mistral. Preview: ${String(raw).slice(0, 60)}`)
  }
  if (parsed.tipo !== 'plataforma') parsed.tipo = 'proveedor'
  parsed.confianza = normalizarConfianza(parsed.confianza)
  return parsed as ExtractedFactura
}
