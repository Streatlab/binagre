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
  "tipo": "proveedor" | "plataforma" | "otro",
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
- Si no hay base al 4%/10%/21% usa 0.
- Si es ticket de supermercado recapitulativo de Mercadona/Lidl/Alcampo, es_recapitulativa=true y extrae periodo.
- Si no detectas numero factura, usa la referencia mas unica que encuentres.
- "ventas_brutas" en plataformas = PVP con IVA (lo que pago el cliente).
- Si la factura es de Uber/Glovo/Just Eat (o "Portier Eats"), rellena plataforma_detalle con una entrada por marca facturada.
- "Portier Eats" tipo=plataforma, plataforma=uber.
- "Glovo App" o "Glovoapp" tipo=plataforma, plataforma=glovo.
- "Just Eat" tipo=plataforma, plataforma=just_eat.
- Todos los importes en euros con punto decimal. NO uses coma.
- confianza entre 0 y 1.
- nif_cliente: NIF/CIF del CLIENTE (destinatario). Si no aparece null.
- nif_emisor: NIF/CIF de quien EMITE. Si no aparece null.
- nombre_cliente: razon social del cliente. Si no aparece null.

Devuelve SOLO el JSON, nada mas.`

export type ExtractedFactura = {
  proveedor_nombre: string
  numero_factura: string
  fecha_factura: string
  es_recapitulativa: boolean
  periodo_inicio: string | null
  periodo_fin: string | null
  tipo: 'proveedor' | 'plataforma' | 'otro'
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

// Modelo activo en producción a 08/05/2026.
// Haiku 4.5 es óptimo para OCR de facturas: ~3x más barato que Sonnet, soporta vision (PDF + imagen),
// suficiente calidad para extracción estructurada. Confirmado vivo en https://platform.claude.com/docs/en/about-claude/models/overview
const MODELO_OCR_DEFAULT = 'claude-haiku-4-5-20251001'

// Whitelist de modelos conocidos válidos. Si ANTHROPIC_MODEL en env contiene un valor que no está aquí,
// se ignora y usa el default. Esto evita que un typo (ej: claude-sonnet-4-5-20251022, no existe)
// rompa todo el OCR.
const MODELOS_VALIDOS = new Set([
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-5-20250929',
  'claude-sonnet-4-6',
  'claude-opus-4-6',
  'claude-opus-4-7',
])

function clienteAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('CONFIG: ANTHROPIC_API_KEY no configurada en Vercel')
  return new Anthropic({ apiKey })
}

function modeloOcr(): string {
  const env = process.env.ANTHROPIC_MODEL?.trim()
  if (env && MODELOS_VALIDOS.has(env)) return env
  // Si la variable de entorno está mal puesta o vacía, usamos el default conocido bueno.
  return MODELO_OCR_DEFAULT
}

// Convierte errores crípticos del SDK Anthropic en mensajes legibles para el toast.
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
  if (txt.includes('timeout') || txt.includes('etimedout')) {
    return 'TIMEOUT · Anthropic tardó demasiado. Reintenta'
  }
  // Fallback: devolver el raw recortado para que al menos se vea algo útil
  return `ERROR ANTHROPIC: ${raw.slice(0, 200)}`
}

async function llamarClaude(content: ContentBlock[]): Promise<ExtractedFactura> {
  const anthropic = clienteAnthropic()
  const modelo = modeloOcr()
  let msg
  try {
    msg = await anthropic.messages.create({
      model: modelo,
      max_tokens: 2000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [{ role: 'user', content: content as any }],
    })
  } catch (err) {
    throw new Error(errorAnthropicLegible(err, modelo))
  }
  const textBlock = msg.content.find((c) => c.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Anthropic devolvió respuesta sin texto')
  }
  const jsonStr = textBlock.text.replace(/```json|```/g, '').trim()
  try {
    return JSON.parse(jsonStr) as ExtractedFactura
  } catch (err) {
    const preview = jsonStr.slice(0, 120)
    throw new Error(`JSON inválido devuelto por modelo (modelo=${modelo}). Preview: ${preview}`)
  }
}

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
    content.push({
      type: 'text',
      text: `${PROMPT_OCR_FACTURA}\n\n=== CONTENIDO FACTURA ===\n${texto}`,
    })
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
