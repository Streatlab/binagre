// extraerRnt.ts — parser de la Relación Nominal de Trabajadores (RNT) de la
// Seguridad Social: detalle de cotización por trabajador del mismo envío mensual
// que el RLC. Mismo patrón barato que extraerResumenNominas.ts: texto ya extraído
// del PDF, un único aviso a Anthropic para todo el documento.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_MODEL = 'claude-sonnet-4-5'
const TIMEOUT_MS = 60000

export interface FilaRnt {
  nombre: string // tal cual aparece en el documento, sin normalizar
  naf: string | null // número de afiliación a la Seguridad Social
  base_cotizacion: number | null
  importe_empresa: number | null
  importe_trabajador: number | null
}

export interface ResultadoRnt {
  estado: 'ok' | 'revisar' | 'error'
  motivo: string
  mes: number | null
  anio: number | null
  filas: FilaRnt[]
}

const PROMPT = `Eres un extractor de la Relación Nominal de Trabajadores (RNT) de la Seguridad Social española: un documento con UNA FILA POR TRABAJADOR detallando su cotización del mes.

Devuelve SOLO un objeto JSON válido, sin texto alrededor:
{
  "mes": number|null,
  "anio": number|null,
  "filas": [
    { "nombre": string, "naf": string|null, "base_cotizacion": number|null, "importe_empresa": number|null, "importe_trabajador": number|null }
  ]
}
Reglas:
- "nombre": nombre y apellidos del trabajador tal cual aparece en la tabla.
- "naf": número de afiliación a la Seguridad Social del trabajador (NAF/N.A.F.), si aparece.
- "base_cotizacion": base de cotización de ese trabajador ese mes.
- "importe_empresa": cuota/aportación a cargo de la EMPRESA de ese trabajador.
- "importe_trabajador": cuota/aportación a cargo del TRABAJADOR de ese trabajador.
- Una entrada por CADA trabajador. NO incluyas la fila de "TOTAL"/"TOTALES" como si fuera un trabajador.
- "mes"/"anio": el periodo de liquidación del documento (cabecera/título).
- Si un dato no aparece con claridad para una fila, usa null en ESE campo — nunca inventes un número. No omitas la fila entera solo porque le falte un campo.
- Si el documento NO es una RNT (p.ej. es un RLC sin detalle por trabajador), devuelve "filas": [].
Responde SOLO el objeto JSON.`

function numero(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number' && isFinite(v)) return v
  const s = String(v).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')
  const n = parseFloat(s)
  return isFinite(n) ? n : null
}

function parsearRnt(raw: string): { mes: number | null; anio: number | null; filas: FilaRnt[] } {
  let j: Record<string, unknown>
  try { j = JSON.parse(raw.replace(/```json|```/g, '').trim()) } catch { return { mes: null, anio: null, filas: [] } }

  const filasRaw = Array.isArray(j.filas) ? j.filas : []
  const filas: FilaRnt[] = []
  for (const f of filasRaw) {
    if (!f || typeof f !== 'object') continue
    const o = f as Record<string, unknown>
    const nombre = String(o.nombre || '').trim()
    if (!nombre) continue
    filas.push({
      nombre,
      naf: o.naf ? String(o.naf).trim() : null,
      base_cotizacion: numero(o.base_cotizacion),
      importe_empresa: numero(o.importe_empresa),
      importe_trabajador: numero(o.importe_trabajador),
    })
  }

  return { mes: numero(j.mes), anio: numero(j.anio), filas }
}

export async function extraerRntTexto(textoOcr: string): Promise<ResultadoRnt> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { estado: 'error', motivo: 'Falta ANTHROPIC_API_KEY', mes: null, anio: null, filas: [] }
  if (!textoOcr || textoOcr.trim().length < 20) {
    return { estado: 'revisar', motivo: 'Sin texto legible en el PDF', mes: null, anio: null, filas: [] }
  }

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 4000,
        messages: [{ role: 'user', content: `${PROMPT}\n\n--- TEXTO DEL DOCUMENTO ---\n${textoOcr.slice(0, 18000)}` }],
      }),
      signal: ctrl.signal,
    })
    if (!resp.ok) {
      const detalle = (await resp.text()).slice(0, 200)
      return { estado: 'error', motivo: `HTTP ${resp.status}: ${detalle}`, mes: null, anio: null, filas: [] }
    }
    const data = await resp.json() as { content?: Array<{ text?: string }> }
    const raw = (data.content || []).map(c => c.text || '').join('').trim()
    const { mes, anio, filas } = parsearRnt(raw)

    if (filas.length === 0) {
      return { estado: 'revisar', motivo: 'No se detectó tabla de trabajadores en el documento', mes, anio, filas: [] }
    }
    if (mes == null || anio == null) {
      return { estado: 'revisar', motivo: `${filas.length} filas leídas, pero no se pudo determinar mes/año del periodo`, mes, anio, filas }
    }
    return { estado: 'ok', motivo: `${filas.length} trabajadores leídos`, mes, anio, filas }
  } catch (err) {
    return { estado: 'error', motivo: err instanceof Error ? err.message : String(err), mes: null, anio: null, filas: [] }
  } finally {
    clearTimeout(t)
  }
}
