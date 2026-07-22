// extraerAutonomoCuota.ts — extractor del recibo de cuota de autónomos (RETA/TGSS)
// de un titular concreto (Rubén o Emilio). Mismo patrón barato que
// extraerSegSocialResumen.ts: texto ya extraído del PDF, una llamada de texto a
// Anthropic, NUNCA visión.
//
// Alimenta `autonomos_cuotas`: importe, fecha_cargo, mes, anio.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_MODEL = 'claude-sonnet-4-5'
const TIMEOUT_MS = 60000

export interface ResultadoAutonomoCuota {
  estado: 'ok' | 'revisar' | 'error'
  motivo: string
  importe: number | null
  fecha_cargo: string | null
  mes: number | null
  anio: number | null
}

const PROMPT = `Eres un extractor de datos del recibo de cuota mensual de autónomos (RETA/TGSS) de una persona física española. Recibes el texto OCR de UN documento. Devuelve SOLO un objeto JSON válido, sin texto alrededor, con EXACTAMENTE estas claves:
{
  "importe": number|null,
  "fecha_cargo": string|null,
  "mes": number|null,
  "anio": number|null
}
Reglas:
- "importe": el importe TOTAL de la cuota (busca "Importe", "Total a ingresar", "Cuota a ingresar").
- "fecha_cargo": la fecha en que se pasa el cargo en cuenta, en formato YYYY-MM-DD (busca "Fecha de cargo", "Fecha de cobro", "Vencimiento").
- "mes" y "anio": el periodo de liquidación al que corresponde la cuota (ej. "Periodo: 06/2026" → mes=6, anio=2026; si no hay periodo explícito, usa el mes/año de la fecha de cargo). mes es un entero 1-12.
- Si un campo no aparece con claridad, o el documento no es un recibo de cuota de autónomos reconocible, devuélvelo null. NUNCA inventes un dato.
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
    let [, dd, mo, y] = m
    if (y.length === 2) y = '20' + y
    return `${y}-${mo.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }
  return null
}

function parsearAutonomoCuota(raw: string): Omit<ResultadoAutonomoCuota, 'estado' | 'motivo'> {
  let j: Record<string, unknown> = {}
  try { j = JSON.parse(raw.replace(/```json|```/g, '').trim()) } catch { j = {} }
  return {
    importe: numero(j.importe),
    fecha_cargo: fechaIsoOrNull(j.fecha_cargo),
    mes: entero(j.mes, 1, 12),
    anio: entero(j.anio, 2000, 2100),
  }
}

/** Vía BARATA: extracción de la cuota de autónomos sobre el texto OCR (sin visión). */
export async function extraerAutonomoCuotaTexto(textoOcr: string): Promise<ResultadoAutonomoCuota> {
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
    const parseado = parsearAutonomoCuota(raw)
    const estado: ResultadoAutonomoCuota['estado'] =
      parseado.importe !== null && parseado.fecha_cargo !== null ? 'ok' : 'revisar'
    const faltan: string[] = []
    if (parseado.importe === null) faltan.push('importe')
    if (parseado.fecha_cargo === null) faltan.push('fecha_cargo')
    const motivo = estado === 'ok'
      ? 'Cuota de autónomos leída completa'
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
