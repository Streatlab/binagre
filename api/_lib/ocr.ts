import Anthropic from '@anthropic-ai/sdk'

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
- Si la factura es de Uber/Glovo/Just Eat, rellena plataforma_detalle con una entrada por marca facturada. Si solo hay una marca, 1 entrada.
- Todos los importes en euros con punto decimal. NO uses coma.
- confianza entre 0 y 1, cómo de seguro estás de la extracción.

Devuelve SOLO el JSON, nada más.`

export type ExtractedFactura = {
  proveedor_nombre: string
  numero_factura: string
  fecha_factura: string
  es_recapitulativa: boolean
  periodo_inicio: string | null
  periodo_fin: string | null
  tipo: 'proveedor' | 'plataforma' | 'otro'
  plataforma: 'uber' | 'glovo' | 'just_eat' | null
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

export async function extraerDatosFactura(pdfBase64: string): Promise<ExtractedFactura> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurado')
  const anthropic = new Anthropic({ apiKey })

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
          },
          { type: 'text', text: PROMPT_OCR_FACTURA },
        ],
      },
    ],
  })

  const textBlock = msg.content.find((c) => c.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Respuesta Claude sin texto')
  }
  const jsonStr = textBlock.text.replace(/```json|```/g, '').trim()
  return JSON.parse(jsonStr) as ExtractedFactura
}
