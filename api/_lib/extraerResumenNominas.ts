// extraerResumenNominas.ts — parser del "Resumen de nóminas" mensual que manda la
// gestoría: una tabla con TODOS los trabajadores del mes (bruto, SS empresa, neto,
// SS total, coste empresa por persona). Distinto de `extraerNomina.ts` (una nómina
// individual de UN trabajador). Vía barata: texto ya extraído del PDF, un único
// aviso a Anthropic para todo el documento (no una llamada por fila).
//
// Reglas verificadas contra PDF reales de junio/julio 2026 (no reinventar):
//  1) Separador de miles = ESPACIO ("1 362,66" es UN número, no "1" y "362,66").
//     El propio texto del PDF puede llegar con ese espacio; nunca se trocea el
//     número en dos por su cuenta.
//  2) La fila "CENTRO: N <razon social>" y la línea "Empresa:" de cabecera son
//     la EMPRESA (Rubén, autónomo), nunca un trabajador — se descartan.
//  3) Estructura real de cada fila: <matrícula> <APELLIDOS, NOMBRE> <BRUTO>
//     <SS.EMP> <NETO> <SS.TOTAL> <CTE.EMPRESA>. No hay columna de IRPF salvo
//     que el documento traiga una explícita con ese rótulo — nunca se deduce
//     de otra cifra (evita que un importe se cuele como IRPF por desplazamiento
//     de columna, el fallo real detectado el 22/07/2026).
//  4) Validación obligatoria: suma de NETO de las filas = TOTAL EMPRESA. Si no
//     cuadra, no se guarda nada (lo hace el llamador, ver subidaDocEquipo.ts).

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_MODEL = 'claude-sonnet-4-5'
const TIMEOUT_MS = 60000

export interface FilaResumenNomina {
  trabajador: string // tal cual aparece en el documento, sin normalizar
  bruto: number | null
  ss_empresa: number | null // columna "SS.EMP" — cotización a cargo de la empresa
  neto: number | null // columna "NETO" — líquido a percibir
  ss_total: number | null // columna "SS.TOTAL" — cotización total (empresa + trabajador)
  irpf: number | null // SOLO si hay columna propia de IRPF; si no, null (nunca deducido)
  coste_empresa: number | null // columna "CTE.EMPRESA"
}

export interface ResultadoResumenNominas {
  estado: 'ok' | 'revisar' | 'error'
  motivo: string
  mes: number | null
  anio: number | null
  total_empresa: number | null // fila "TOTAL EMPRESA" — para validar contra la suma de NETO
  filas: FilaResumenNomina[]
}

const PROMPT = `Eres un extractor del "Resumen de nóminas" mensual que una gestoría española envía a una empresa. Es una tabla con UNA FILA POR TRABAJADOR (no una nómina individual), con columnas BRUTO, SS.EMP (Seguridad Social a cargo de la empresa), NETO (líquido a percibir), SS.TOTAL (cotización total) y CTE.EMPRESA (coste total empresa), y normalmente filas de totales al final ("TOTAL CENTRO", "TOTAL EMPRESA", "TOTAL TRABAJADORES...").

Ejemplo real de una fila: "3 MENDEZ MELO, JUAN RAMON 1 362,66 455,53 1 270,07 548,12 1 820,61" → matrícula 3, trabajador "MENDEZ MELO, JUAN RAMON", bruto 1362.66, ss_empresa 455.53, neto 1270.07, ss_total 548.12, coste_empresa 1820.61.

REGLA CRÍTICA DE FORMATO: el separador de miles en este documento es un ESPACIO, no una coma ni un punto. "1 362,66" es UN SOLO número (mil trescientos sesenta y dos con sesenta y seis), NUNCA lo separes en dos números "1" y "362,66". Si ves un dígito suelto seguido de espacio y luego tres dígitos+coma+dos decimales, son el MISMO importe.

Devuelve SOLO un objeto JSON válido, sin texto alrededor:
{
  "mes": number|null,
  "anio": number|null,
  "total_empresa": number|null,
  "filas": [
    { "trabajador": string, "bruto": number|null, "ss_empresa": number|null, "neto": number|null, "ss_total": number|null, "irpf": number|null, "coste_empresa": number|null }
  ]
}
Reglas:
- "trabajador": el nombre y apellidos tal cual aparecen en la fila (sin la matrícula inicial, sin normalizar ni acortar).
- NUNCA incluyas como trabajador la línea "CENTRO: <numero> <nombre>" ni ninguna línea que empiece por "Empresa:" — esas son la propia empresa/autónomo que envía el documento, no un trabajador. Tampoco incluyas filas de "TOTAL"/"TOTALES".
- Cada columna numérica se lee tal cual está en SU posición de la fila (bruto, ss_empresa, neto, ss_total, coste_empresa, en ese orden). No desplaces columnas.
- "irpf": SOLO si existe una columna separada con ese rótulo explícito en la tabla. Si esta tabla no trae columna de IRPF (lo habitual), devuelve null — JAMÁS uses el valor de otra columna (ss_empresa, ss_total...) como si fuera IRPF.
- "total_empresa": el importe de la fila "TOTAL EMPRESA" (para poder validar que la suma de los NETO cuadra). Si no aparece esa fila, null.
- Si un dato no aparece con claridad para una fila concreta, usa null en ESE campo — nunca inventes un número. No omitas la fila entera solo porque le falte un campo.
- Si el documento NO es un resumen multi-trabajador (por ejemplo es la nómina de una sola persona), devuelve "filas": [] y no intentes forzarlo.
Responde SOLO el objeto JSON.`

function numero(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number' && isFinite(v)) return v
  // Quita TODO lo que no sea dígito/coma/punto/signo (incluye el espacio usado
  // como separador de miles: "1 362,66" -> "1362,66"), luego el punto de miles
  // si quedara alguno, y por último coma decimal -> punto.
  const s = String(v).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')
  const n = parseFloat(s)
  return isFinite(n) ? n : null
}

// Descarta explícitamente cualquier fila que sea la propia empresa/empleador,
// aunque el modelo la haya devuelto como si fuera un trabajador (defensa en
// profundidad además de la instrucción del prompt).
const RE_ES_EMPRESA = /^\s*(centro\s*:|empresa\s*:)/i

function parsearResumen(raw: string): { mes: number | null; anio: number | null; total_empresa: number | null; filas: FilaResumenNomina[] } {
  let j: Record<string, unknown>
  try { j = JSON.parse(raw.replace(/```json|```/g, '').trim()) } catch { return { mes: null, anio: null, total_empresa: null, filas: [] } }

  const filasRaw = Array.isArray(j.filas) ? j.filas : []
  const filas: FilaResumenNomina[] = []
  for (const f of filasRaw) {
    if (!f || typeof f !== 'object') continue
    const o = f as Record<string, unknown>
    const trabajador = String(o.trabajador || '').trim()
    if (!trabajador) continue
    if (RE_ES_EMPRESA.test(trabajador)) continue
    filas.push({
      trabajador,
      bruto: numero(o.bruto),
      ss_empresa: numero(o.ss_empresa),
      neto: numero(o.neto),
      ss_total: numero(o.ss_total),
      irpf: numero(o.irpf),
      coste_empresa: numero(o.coste_empresa),
    })
  }

  return { mes: numero(j.mes), anio: numero(j.anio), total_empresa: numero(j.total_empresa), filas }
}

// Tolerancia de redondeo para la validación suma(NETO) = TOTAL EMPRESA.
const TOLERANCIA_VALIDACION = 0.02

export async function extraerResumenNominasTexto(textoOcr: string): Promise<ResultadoResumenNominas> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { estado: 'error', motivo: 'Falta ANTHROPIC_API_KEY', mes: null, anio: null, total_empresa: null, filas: [] }
  if (!textoOcr || textoOcr.trim().length < 20) {
    return { estado: 'revisar', motivo: 'Sin texto legible en el PDF', mes: null, anio: null, total_empresa: null, filas: [] }
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
      return { estado: 'error', motivo: `HTTP ${resp.status}: ${detalle}`, mes: null, anio: null, total_empresa: null, filas: [] }
    }
    const data = await resp.json() as { content?: Array<{ text?: string }> }
    const raw = (data.content || []).map(c => c.text || '').join('').trim()
    const { mes, anio, total_empresa, filas } = parsearResumen(raw)

    if (filas.length === 0) {
      return { estado: 'revisar', motivo: 'No se detectó tabla multi-trabajador en el documento', mes, anio, total_empresa, filas: [] }
    }
    if (mes == null || anio == null) {
      return { estado: 'revisar', motivo: `${filas.length} filas leídas, pero no se pudo determinar mes/año del periodo`, mes, anio, total_empresa, filas }
    }
    // Validación obligatoria: si hay TOTAL EMPRESA, la suma de NETO debe cuadrar.
    // Si no cuadra, mejor sin datos que con datos falsos — el llamador no guarda nada.
    if (total_empresa != null) {
      const sumaNeto = filas.reduce((s, f) => s + (f.neto ?? 0), 0)
      const faltanNeto = filas.some(f => f.neto == null)
      if (faltanNeto || Math.abs(sumaNeto - total_empresa) > TOLERANCIA_VALIDACION) {
        return {
          estado: 'revisar',
          motivo: `La suma de los netos leídos (${sumaNeto.toFixed(2)} €) no cuadra con TOTAL EMPRESA (${total_empresa.toFixed(2)} €) — no se guarda nada hasta revisar el documento`,
          mes, anio, total_empresa, filas,
        }
      }
    }
    return { estado: 'ok', motivo: `${filas.length} trabajadores leídos`, mes, anio, total_empresa, filas }
  } catch (err) {
    return { estado: 'error', motivo: err instanceof Error ? err.message : String(err), mes: null, anio: null, total_empresa: null, filas: [] }
  } finally {
    clearTimeout(t)
  }
}
