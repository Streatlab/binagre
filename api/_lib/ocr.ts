import Anthropic from '@anthropic-ai/sdk'
import type { ContenidoExtraido } from './extractores.js'

const PROMPT_OCR_FACTURA = `Eres un extractor de datos de facturas españolas. Analiza la factura adjunta y devuelve SOLO un JSON válido con este esquema exacto (sin texto adicional, sin markdown):

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
- Si no detectas número factura, usa la referencia más única que encuentres.
- "ventas_brutas" en plataformas = PVP con IVA (lo que pagó el cliente).
- Si la factura es de Uber/Glovo/Just Eat (o "Portier Eats"), rellena plataforma_detalle con una entrada por marca facturada.
- "Portier Eats" tipo=plataforma, plataforma=uber.
- "Glovo App" o "Glovoapp" tipo=plataforma, plataforma=glovo.
- "Just Eat" tipo=plataforma, plataforma=just_eat.
- Todos los importes en euros con punto decimal. NO uses coma.
- confianza entre 0 y 1, como de seguro estas de la extraccion.
- nif_cliente: NIF/CIF del CLIENTE (destinatario de la factura), NO del emisor. Buscalo tras Razon Social, Datos Fiscales, Cliente, NIF, CIF, DNI. Si no aparece null.
- nif_emisor: NIF/CIF de quien EMITE la factura. Buscalo cerca del nombre del proveedor. Si no aparece null.
- nombre_cliente: razon social o nombre del cliente. Si no aparece null.

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

function clienteAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurado')
  return new Anthropic({ apiKey })
}

async function llamarClaude(content: ContentBlock[]): Promise<ExtractedFactura> {
  const anthropic = clienteAnthropic()
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: [{ role: 'user', content: content as any }],
  })
  const textBlock = msg.content.find((c) => c.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Respuesta Claude sin texto')
  }
  const jsonStr = textBlock.text.replace(/```json|```/g, '').trim()
  return JSON.parse(jsonStr) as ExtractedFactura
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
