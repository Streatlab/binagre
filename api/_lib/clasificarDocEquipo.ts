// clasificarDocEquipo.ts — clasificador del buzón único EQUIPO en Papeleo. Mismo
// patrón barato que el resto de la cascada (texto ya extraído del PDF, una sola
// llamada de texto a Anthropic, nunca visión): decide a qué tipo de documento de
// personal corresponde un PDF suelto para poder encaminarlo solo.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_MODEL = 'claude-sonnet-4-5'
const TIMEOUT_MS = 60000

export interface ClasificacionDocEquipo {
  tipo: 'nomina' | 'resumen_nominas' | 'rlc' | 'rnt' | 'desconocido'
  mes: number | null
  anio: number | null
  empleado_nombre: string | null
  confianza: number
  motivo: string
}

const TIPOS_VALIDOS = new Set(['nomina', 'resumen_nominas', 'rlc', 'rnt', 'desconocido'])

const PROMPT = `Eres un clasificador de documentos de personal de una empresa española (nóminas y Seguridad Social). Recibes el texto OCR de UN documento. Devuelve SOLO un objeto JSON válido, sin texto alrededor, con EXACTAMENTE estas claves:
{
  "tipo": "nomina" | "resumen_nominas" | "rlc" | "rnt" | "desconocido",
  "mes": number|null,
  "anio": number|null,
  "empleado_nombre": string|null,
  "confianza": number,
  "motivo": string
}
Tipos posibles:
- "nomina": recibo individual de salarios de UNA persona (Recibo de Salarios / Recibo Individual de Salarios): nombre y NIF de UN trabajador, devengos y deducciones, líquido a percibir de esa única persona.
- "resumen_nominas": listado/tabla con VARIOS trabajadores y sus importes en la misma tabla (el resumen mensual que envía la gestoría, una fila por trabajador).
- "rlc": Recibo de Liquidación de Cotizaciones a la Seguridad Social — cargo mensual de la EMPRESA, un único importe total a ingresar/pagar.
- "rnt": Relación Nominal de Trabajadores de la Seguridad Social — detalle de cotización por trabajador emitido por la Seguridad Social (distinto del resumen de nóminas de la gestoría).
- "desconocido": cualquier otro documento, o si no hay texto suficiente para decidir con seguridad.
Reglas:
- "empleado_nombre": SOLO si tipo="nomina", el nombre del trabajador tal cual aparece en el documento (nunca el de la empresa). En cualquier otro tipo, null.
- "mes"/"anio": el periodo de liquidación al que corresponde el documento. mes es un entero 1-12.
- "confianza": número entre 0 y 1 que refleje tu seguridad en el "tipo" elegido. Usa menos de 0.6 si dudas entre dos tipos, el documento es ambiguo, o el texto es pobre/incompleto.
- "motivo": explica en pocas palabras por qué elegiste ese tipo (o por qué queda dudoso).
- NUNCA inventes datos que no aparezcan en el texto.
Responde SOLO el JSON.`

function numero(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number' && isFinite(v)) return v
  const n = parseFloat(String(v).replace(',', '.'))
  return isFinite(n) ? n : null
}

function entero(v: unknown, min: number, max: number): number | null {
  const n = numero(v)
  if (n === null) return null
  const i = Math.round(n)
  return i >= min && i <= max ? i : null
}

function parsear(raw: string): ClasificacionDocEquipo {
  let j: Record<string, unknown> = {}
  try { j = JSON.parse(raw.replace(/```json|```/g, '').trim()) } catch { j = {} }

  const tipoRaw = String(j.tipo || '').trim()
  const tipo = (TIPOS_VALIDOS.has(tipoRaw) ? tipoRaw : 'desconocido') as ClasificacionDocEquipo['tipo']

  let confianza = numero(j.confianza)
  if (confianza === null) confianza = 0
  confianza = Math.max(0, Math.min(1, confianza))

  return {
    tipo,
    mes: entero(j.mes, 1, 12),
    anio: entero(j.anio, 2000, 2100),
    empleado_nombre: tipo === 'nomina' && j.empleado_nombre ? String(j.empleado_nombre).trim() : null,
    confianza,
    motivo: j.motivo ? String(j.motivo).trim() : 'Sin motivo indicado por la IA',
  }
}

export async function clasificarDocEquipoTexto(textoOcr: string): Promise<ClasificacionDocEquipo> {
  const vacio: Omit<ClasificacionDocEquipo, 'motivo'> = { tipo: 'desconocido', mes: null, anio: null, empleado_nombre: null, confianza: 0 }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { ...vacio, motivo: 'Falta ANTHROPIC_API_KEY' }
  if (!textoOcr || textoOcr.trim().length < 20) return { ...vacio, motivo: 'Sin texto legible en el documento' }

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 500,
        messages: [{ role: 'user', content: `${PROMPT}\n\n--- TEXTO DEL DOCUMENTO ---\n${textoOcr.slice(0, 12000)}` }],
      }),
      signal: ctrl.signal,
    })
    if (!resp.ok) {
      const detalle = (await resp.text()).slice(0, 200)
      return { ...vacio, motivo: `HTTP ${resp.status}: ${detalle}` }
    }
    const data = await resp.json() as { content?: Array<{ text?: string }> }
    const raw = (data.content || []).map(c => c.text || '').join('').trim()
    return parsear(raw)
  } catch (err) {
    return { ...vacio, motivo: err instanceof Error ? err.message : String(err) }
  } finally {
    clearTimeout(t)
  }
}
