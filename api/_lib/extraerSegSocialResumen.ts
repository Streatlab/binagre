// extraerSegSocialResumen.ts — extractor del Recibo de Liquidación de
// Cotizaciones (RLC) / resumen mensual de Seguridad Social de la empresa.
// Mismo patrón barato que extraerNomina.ts: texto ya extraído del PDF, una
// llamada de texto a Anthropic, NUNCA visión.
//
// Alimenta `seguridad_social_resumen`: importe, fecha_cargo, mes, anio.
//
// CRITERIO DE ESTADO:
//   - 'error'   → fallo técnico: sin ANTHROPIC_API_KEY, texto <20 chars, o la
//                 llamada HTTP/parseo falla.
//   - 'ok'      → importe Y fecha_cargo están presentes.
//   - 'revisar' → falta importe o fecha_cargo (o ambos).

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_MODEL = 'claude-sonnet-4-5'
const TIMEOUT_MS = 60000

export interface ResultadoSegSocial {
  estado: 'ok' | 'revisar' | 'error'
  motivo: string
  importe: number | null
  fecha_cargo: string | null
  mes: number | null
  anio: number | null
}

const PROMPT = `Eres un extractor de datos del Recibo de Liquidación de Cotizaciones (RLC) de la Seguridad Social de una empresa española. Recibes el texto OCR de UN documento. Devuelve SOLO un objeto JSON válido, sin texto alrededor, con EXACTAMENTE estas claves:
{
  "importe": number|null,
  "fecha_cargo": string|null,
  "mes": number|null,
  "anio": number|null
}
Reglas — etiquetas literales reales de este documento, verificadas contra PDF reales:
- "importe": la etiqueta literal es "LIQUIDO DE TOTALES" — el importe EXACTO a pagar de este RLC. Úsala tal cual si aparece; si no, busca alternativas como "Total a ingresar"/"Importe a pagar".
- "fecha_cargo": la fecha en que se pasa el cargo en cuenta / fecha de vencimiento del pago, en formato YYYY-MM-DD (busca "Fecha de cargo", "Fecha límite de ingreso", "Vencimiento", "Modalidad Pago: Cargo en Cuenta" suele ir junto a la fecha).
- "mes" y "anio": el "Período de Liquidación" del documento, que suele venir como un RANGO del mismo mes, ej. "Período de Liquidación: 05/2026 - 05/2026" → mes=5, anio=2026 (toma cualquiera de los dos extremos, normalmente coinciden). mes es un entero 1-12.
- Pistas adicionales que pueden aparecer y ayudan a confirmar que es el documento correcto (no hace falta extraerlas): "Número de trabajadores confirmados", "Número de liquidación".
- Si un campo no aparece con claridad, o el documento no es un RLC reconocible, devuélvelo null. NUNCA inventes un dato.
Responde SOLO el JSON.`

function numero(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number' && isFinite(v)) return v
  const s = String(v).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')
  const n = parseFloat(s)
  return isFinite(n) ? n : null
}

function entero(v: unknown, min: number, max: number): number | null {
  const n = numero(v)
  if (n === null) return null
  const i = Math.round(n)
  return i >= min && i <= max ? i : null
}

function fechaIsoOrNull(v: unknown): string | null {
  if (!v) return null
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
  if (m) {
    let [, d, mo, y] = m
    if (y.length === 2) y = '20' + y
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return null
}

function parsearSegSocial(raw: string): Omit<ResultadoSegSocial, 'estado' | 'motivo'> {
  let j: Record<string, unknown> = {}
  try { j = JSON.parse(raw.replace(/```json|```/g, '').trim()) } catch { j = {} }
  return {
    importe: numero(j.importe),
    fecha_cargo: fechaIsoOrNull(j.fecha_cargo),
    mes: entero(j.mes, 1, 12),
    anio: entero(j.anio, 2000, 2100),
  }
}

/** Vía BARATA: extracción del resumen mensual de SS sobre el texto OCR (sin visión). */
export async function extraerSegSocialAnthropicTexto(textoOcr: string): Promise<ResultadoSegSocial> {
  const vacio = { importe: null, fecha_cargo: null, mes: null, anio: null }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { estado: 'error', motivo: 'Falta ANTHROPIC_API_KEY', ...vacio }
  }
  if (!textoOcr || textoOcr.trim().length < 20) {
    return { estado: 'error', motivo: 'Sin texto legible en el PDF', ...vacio }
  }

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: `${PROMPT}\n\n--- TEXTO DEL DOCUMENTO ---\n${textoOcr.slice(0, 12000)}`,
        }],
      }),
      signal: ctrl.signal,
    })
    if (!resp.ok) {
      const detalle = (await resp.text()).slice(0, 200)
      return { estado: 'error', motivo: `HTTP ${resp.status}: ${detalle}`, ...vacio }
    }
    const data = await resp.json() as { content?: Array<{ text?: string }> }
    const raw = (data.content || []).map((c) => c.text || '').join('').trim()
    const parseado = parsearSegSocial(raw)
    const estado: ResultadoSegSocial['estado'] =
      parseado.importe !== null && parseado.fecha_cargo !== null ? 'ok' : 'revisar'
    const faltan: string[] = []
    if (parseado.importe === null) faltan.push('importe')
    if (parseado.fecha_cargo === null) faltan.push('fecha_cargo')
    const motivo = estado === 'ok'
      ? 'Resumen SS leído completo'
      : `Faltan campos por confirmar: ${faltan.join(', ')}`
    return { estado, motivo, ...parseado }
  } catch (err) {
    return {
      estado: 'error',
      motivo: err instanceof Error ? err.message : String(err),
      ...vacio,
    }
  } finally {
    clearTimeout(t)
  }
}
