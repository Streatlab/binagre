import Anthropic from '@anthropic-ai/sdk'
import type { ContenidoExtraido } from './extractores.js'

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

export type ExtractedFactura = {
  proveedor_nombre: string
  numero_factura: string
  fecha_factura: string
  es_recapitulativa: boolean
  periodo_inicio: string | null
  periodo_fin: string | null
  tipo: 'proveedor' | 'plataforma'
  plataforma: 'uber' | 'glovo' | 'just_eat' | null
  nif_cliente: string | null
  nif_emisor: string | null
  nombre_cliente: string | null
  base_4: number
  iva_4: number
  base_10: number
  iva_10: number
  base_21: number
  iva_21: number
  total: number
  confianza: number
  plataforma_detalle?: Array<{
    marca_nombre: string
    pedidos: number
    ventas_brutas: number
    comision: number
    comision_iva: number
    fee_fijo: number
    ads: number
    promos_cubiertas: number
    neto_liquidado: number
    periodo_inicio: string
    periodo_fin: string
  }>
}

type ContentBlock =
  | { type: 'document'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'text'; text: string }

// BLINDAJE COSTE: Haiku es el unico modelo permitido para OCR.
// No se permite override a Sonnet/Opus por env (evita gasto accidental).
const MODELO_OCR = 'claude-haiku-4-5-20251001'

// H04: timeout 25s para no exceder Vercel 30s
const OCR_TIMEOUT_MS = 25000

function clienteAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('CONFIG: ANTHROPIC_API_KEY no configurada en Vercel')
  return new Anthropic({ apiKey })
}

function modeloOcr(): string {
  // Forzado a Haiku siempre. Override por env deshabilitado a proposito.
  return MODELO_OCR
}

function errorAnthropicLegible(err: unknown, modelo: string): string {
  const raw = err instanceof Error ? err.message : String(err)
  const txt = raw.toLowerCase()
  if (txt.includes('credit balance is too low') || txt.includes('credit balance')) {
    return 'SIN CRÉDITOS · Recarga en console.anthropic.com/settings/billing'
  }
  if (txt.includes('invalid x-api-key') || txt.includes('authentication_error')) {
    return 'API KEY INVÁLIDA · Renueva ANTHROPIC_API_KEY en Vercel'
  }
  if (txt.includes('not_found_error') && txt.includes('model')) {
    return `MODELO NO DISPONIBLE · "${modelo}" no existe. Comprueba ANTHROPIC_MODEL en Vercel o avisa en chat`
  }
  if (txt.includes('429') || txt.includes('rate_limit')) {
    return 'LÍMITE DE PETICIONES · Espera 1 min y vuelve a probar'
  }
  if (txt.includes('overloaded')) {
    return 'API ANTHROPIC SATURADA · Reintenta en unos segundos'
  }
  if (txt.includes('timeout') || txt.includes('etimedout') || txt.includes('aborted')) {
    return 'TIMEOUT · Anthropic tardó demasiado. Reintenta'
  }
  return `ERROR ANTHROPIC: ${raw.slice(0, 200)}`
}

// H03: normalizar confianza (si <1 → ×100)
function normalizarConfianza(valor: number | undefined | null): number {
  if (valor === undefined || valor === null) return 0
  if (valor > 0 && valor <= 1) return Math.round(valor * 100)
  return Math.round(valor)
}

async function llamarClaude(content: ContentBlock[]): Promise<ExtractedFactura> {
  const anthropic = clienteAnthropic()
  const modelo = modeloOcr()

  // H04: AbortController con timeout
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS)

  let msg
  try {
    msg = await anthropic.messages.create({
      model: modelo,
      max_tokens: 4000, // H02: 2000 → 4000 para facturas con 10+ marcas
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [{ role: 'user', content: content as any }],
    }, { signal: controller.signal })
  } catch (err) {
    throw new Error(errorAnthropicLegible(err, modelo))
  } finally {
    clearTimeout(timer)
  }
  const textBlock = msg.content.find((c) => c.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Anthropic devolvió respuesta sin texto')
  }
  const jsonStr = textBlock.text.replace(/```json|```/g, '').trim()
  try {
    const parsed = JSON.parse(jsonStr) as ExtractedFactura & { tipo: string }
    if (parsed.tipo !== 'plataforma') {
      parsed.tipo = 'proveedor'
    }
    // H03: normalizar confianza
    parsed.confianza = normalizarConfianza(parsed.confianza)
    return parsed as ExtractedFactura
  } catch (err) {
    // H06: preview recortada a 60 chars
    const preview = jsonStr.slice(0, 60)
    throw new Error(`JSON inválido devuelto por modelo (modelo=${modelo}). Preview: ${preview}`)
  }
}

// H08: separar prompt y contenido en 2 bloques para texto
export async function extraerDatosDesdeContenido(
  contenido: ContenidoExtraido,
): Promise<ExtractedFactura> {
  const content: ContentBlock[] = []

  if (contenido.tipo === 'vision') {
    const buffer = contenido.data as Buffer
    const base64 = buffer.toString('base64')
    const mediaType = contenido.mediaType || 'application/pdf'

    if (mediaType === 'application/pdf') {
      content.push({
        type: 'document',
        source: { type: 'base64', media_type: mediaType, data: base64 },
      })
    } else {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: base64 },
      })
    }
    content.push({ type: 'text', text: PROMPT_OCR_FACTURA })
  } else {
    const texto = typeof contenido.data === 'string' ? contenido.data : contenido.data.toString('utf-8')
    // H08: prompt y contenido en bloques separados
    content.push({ type: 'text', text: PROMPT_OCR_FACTURA })
    content.push({ type: 'text', text: `=== CONTENIDO FACTURA ===\n${texto}` })
  }

  return llamarClaude(content)
}

export async function extraerDatosFactura(pdfBase64: string): Promise<ExtractedFactura> {
  const buffer = Buffer.from(pdfBase64, 'base64')
  return extraerDatosDesdeContenido({
    tipo: 'vision',
    data: buffer,
    mediaType: 'application/pdf',
  })
}
