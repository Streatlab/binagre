// extraerResumenNominas.ts — parser del "Resumen de nóminas" mensual que manda la
// gestoría: una tabla con TODOS los trabajadores del mes (bruto, neto, IRPF, SS,
// coste empresa por persona). Distinto de `extraerNomina.ts` (una nómina individual
// de UN trabajador). Vía barata: texto ya extraído del PDF, un único aviso a
// Anthropic para todo el documento (no una llamada por fila).

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_MODEL = 'claude-sonnet-4-5'
const TIMEOUT_MS = 60000

export interface FilaResumenNomina {
  trabajador: string // tal cual aparece en el documento, sin normalizar
  bruto: number | null
  neto: number | null
  irpf: number | null
  ss_total: number | null // Seguridad Social total de esa fila (trabajador + empresa, o solo la que traiga la tabla — ver `motivo` si es ambiguo)
  coste_empresa: number | null
}

export interface ResultadoResumenNominas {
  estado: 'ok' | 'revisar' | 'error'
  motivo: string
  mes: number | null
  anio: number | null
  filas: FilaResumenNomina[]
}

const PROMPT = `Eres un extractor del "Resumen de nóminas" mensual que una gestoría española envía a una empresa. Es una tabla con UNA FILA POR TRABAJADOR (no una nómina individual) y normalmente una fila de totales al final.

Devuelve SOLO un objeto JSON válido, sin texto alrededor:
{
  "mes": number|null,
  "anio": number|null,
  "filas": [
    { "trabajador": string, "bruto": number|null, "neto": number|null, "irpf": number|null, "ss_total": number|null, "coste_empresa": number|null }
  ]
}
Reglas:
- "trabajador": el nombre tal cual aparece en la tabla (nombre y apellidos, sin normalizar ni acortar).
- Una entrada por CADA trabajador. NO incluyas la fila de "TOTAL"/"TOTALES" de la empresa como si fuera un trabajador más.
- "bruto": total devengado del trabajador ese mes. "neto": líquido a percibir.
- "irpf": importe retenido de IRPF de ese trabajador (no el %).
- "ss_total": cotización de Seguridad Social de esa fila tal como venga en la tabla (puede ser solo la del trabajador, o la suma trabajador+empresa según el formato de la gestoría — si la tabla trae columnas separadas de SS trabajador y SS empresa, súmalas aquí).
- "coste_empresa": coste total para la empresa de ese trabajador (bruto + SS empresa), si el documento lo trae explícito o es calculable con las columnas presentes; si no, null.
- "mes"/"anio": el periodo que cubre el resumen (mira cabecera/título del documento).
- Si un dato no aparece con claridad para una fila concreta, usa null en ESE campo — nunca inventes un número. No omitas la fila entera solo porque le falte un campo.
- Si el documento NO es un resumen multi-trabajador (por ejemplo es la nómina de una sola persona), devuelve "filas": [] y no intentes forzarlo.
Responde SOLO el objeto JSON.`

function numero(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number' && isFinite(v)) return v
  const s = String(v).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')
  const n = parseFloat(s)
  return isFinite(n) ? n : null
}

function parsearResumen(raw: string): { mes: number | null; anio: number | null; filas: FilaResumenNomina[] } {
  let j: Record<string, unknown>
  try { j = JSON.parse(raw.replace(/```json|```/g, '').trim()) } catch { return { mes: null, anio: null, filas: [] } }

  const filasRaw = Array.isArray(j.filas) ? j.filas : []
  const filas: FilaResumenNomina[] = []
  for (const f of filasRaw) {
    if (!f || typeof f !== 'object') continue
    const o = f as Record<string, unknown>
    const trabajador = String(o.trabajador || '').trim()
    if (!trabajador) continue
    filas.push({
      trabajador,
      bruto: numero(o.bruto),
      neto: numero(o.neto),
      irpf: numero(o.irpf),
      ss_total: numero(o.ss_total),
      coste_empresa: numero(o.coste_empresa),
    })
  }

  return { mes: numero(j.mes), anio: numero(j.anio), filas }
}

export async function extraerResumenNominasTexto(textoOcr: string): Promise<ResultadoResumenNominas> {
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
    const { mes, anio, filas } = parsearResumen(raw)

    if (filas.length === 0) {
      return { estado: 'revisar', motivo: 'No se detectó tabla multi-trabajador en el documento', mes, anio, filas: [] }
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
