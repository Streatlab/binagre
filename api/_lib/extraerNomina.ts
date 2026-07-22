// extraerNomina.ts — extractor de nóminas (Recibo de Salarios) de empleados.
// Mismo patrón barato que ocr-anthropic.ts / extraerLineasFactura.ts: trabaja
// sobre el TEXTO ya extraído del PDF (unpdf), una llamada de texto a Anthropic,
// NUNCA visión (evita el gasto que ya vació saldo una vez).
//
// Alimenta la tabla `nominas`: importe_bruto, importe_neto, irpf_retenido,
// ss_trabajador, ss_empresa, coste_empresa, mes, anio.
//
// CRITERIO DE ESTADO (documentado aquí, no en otro sitio):
//   - 'error'   → fallo técnico: sin ANTHROPIC_API_KEY, texto <20 chars, o la
//                 llamada HTTP/parseo falla. NO es un juicio sobre el contenido.
//   - 'ok'      → los 6 importes (bruto, neto, irpf, ss_trabajador, ss_empresa,
//                 coste_empresa) se leyeron con seguridad (todos no-null). Es el
//                 criterio estricto recomendado: una nómina con cualquier campo
//                 dudoso queda para revisión humana antes de darse por buena.
//   - 'revisar' → se pudo llamar a Anthropic y el documento parece una nómina,
//                 pero falta AL MENOS UNO de los 6 importes. Casi siempre será
//                 el caso real (SS empresa no siempre aparece en el recibo del
//                 trabajador) — es el estado más común y ESPERADO, no un error.
// `campos_dudosos` siempre lista los nombres de los campos que quedaron null,
// tanto en 'ok' (lista vacía) como en 'revisar' (para saber qué completar a mano).

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_MODEL = 'claude-sonnet-4-5'
const TIMEOUT_MS = 60000

export interface ResultadoNomina {
  estado: 'ok' | 'revisar' | 'error'
  motivo: string
  empleado_nombre_detectado: string | null
  mes: number | null
  anio: number | null
  importe_bruto: number | null
  importe_neto: number | null
  irpf_retenido: number | null
  ss_trabajador: number | null
  ss_empresa: number | null
  coste_empresa: number | null
  campos_dudosos: string[]
}

const PROMPT = `Eres un extractor de datos de nóminas españolas (Recibo de Salarios / Recibo Individual de Salarios). Recibes el texto OCR de UNA nómina. Devuelve SOLO un objeto JSON válido, sin texto alrededor, con EXACTAMENTE estas claves:
{
  "empleado_nombre_detectado": string|null,
  "mes": number|null,
  "anio": number|null,
  "importe_bruto": number|null,
  "importe_neto": number|null,
  "irpf_retenido": number|null,
  "ss_trabajador": number|null,
  "ss_empresa": number|null,
  "coste_empresa": number|null
}
Reglas — etiquetas literales reales de este tipo de documento, verificadas contra PDF reales (úsalas tal cual, no busques sinónimos si el literal aparece):
- "importe_neto": la etiqueta literal es "LIQUIDO A PERCIBIR" (lo que realmente cobra el trabajador).
- "importe_bruto": la etiqueta literal es "REM. TOTAL" (remuneración total, suma de devengos). NO es lo mismo que el líquido a percibir.
- "irpf_retenido": busca "IRPF", "Retención IRPF", "% IRPF" — el IMPORTE retenido en euros, NUNCA el porcentaje.
- "ss_trabajador": cotización de Seguridad Social a cargo del TRABAJADOR. La etiqueta "T. A DEDUCIR" (total a deducir) es el conjunto de TODAS las deducciones del trabajador — puede incluir, además de la Seguridad Social, otros conceptos como un anticipo salarial (ej. línea "791 Anticipo Salarial"). Si el documento desglosa la Seguridad Social por separado dentro de "T. A DEDUCIR", usa solo esa parte; si "T. A DEDUCIR" es un único importe sin desglose y no hay ningún anticipo/otro concepto visible, puedes usarlo directamente. Nunca metas un anticipo salarial dentro de ss_trabajador.
- "ss_empresa": cotización de Seguridad Social a cargo de la EMPRESA — es la suma de la tabla "DETERMINACIÓN DE LAS BASES..." (bases y tipos de cotización de la empresa). Este importe NO se descuenta del bruto: es un coste adicional para la empresa, no lo paga el trabajador.
- "coste_empresa": busca literalmente "COSTE EMPRESA:" en el bloque de Observaciones del documento — si aparece, usa ese valor directo. Si no aparece, y SOLO si bruto y ss_empresa están ambos disponibles, puedes usar bruto + ss_empresa; si falta algún dato, devuelve null.
- "mes" y "anio": del periodo de liquidación de la nómina, formato "01 JUN 2026 A 30 JUN 2026" (admite tramos parciales del mes, ej. "01 JUN 2026 A 16 JUN 2026" — el mes/año sigue siendo el de ese tramo).
- "empleado_nombre_detectado": el nombre del trabajador, que aparece en la línea bajo la cabecera "TRABAJADOR/A CATEGORIA..." — NUNCA la línea "EMPRESA DOMICILIO Nº INS. S.S." (esa es la empresa/empleador, no el trabajador), y nunca la propia cabecera de la tabla ("TRABAJADOR/A CATEGORIA Nº MATRIC...") como si fuera el nombre.
- Si un campo no aparece con claridad en el documento, o el documento no es una nómina reconocible, devuélvelo null. NUNCA inventes un número ni lo deduzcas de fuera del texto.
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

function parsearNomina(raw: string): Omit<ResultadoNomina, 'estado' | 'motivo' | 'campos_dudosos'> {
  let j: Record<string, unknown> = {}
  try { j = JSON.parse(raw.replace(/```json|```/g, '').trim()) } catch { j = {} }

  const bruto = numero(j.importe_bruto)
  const ssEmpresa = numero(j.ss_empresa)
  let costeEmpresa = numero(j.coste_empresa)
  if (costeEmpresa === null && bruto !== null && ssEmpresa !== null) {
    costeEmpresa = Math.round((bruto + ssEmpresa) * 100) / 100
  }

  return {
    empleado_nombre_detectado: j.empleado_nombre_detectado ? String(j.empleado_nombre_detectado).trim() : null,
    mes: entero(j.mes, 1, 12),
    anio: entero(j.anio, 2000, 2100),
    importe_bruto: bruto,
    importe_neto: numero(j.importe_neto),
    irpf_retenido: numero(j.irpf_retenido),
    ss_trabajador: numero(j.ss_trabajador),
    ss_empresa: ssEmpresa,
    coste_empresa: costeEmpresa,
  }
}

const NOMBRES_CAMPOS: Record<string, string> = {
  importe_bruto: 'importe_bruto',
  importe_neto: 'importe_neto',
  irpf_retenido: 'irpf_retenido',
  ss_trabajador: 'ss_trabajador',
  ss_empresa: 'ss_empresa',
  coste_empresa: 'coste_empresa',
}

function calcularCamposDudosos(r: Omit<ResultadoNomina, 'estado' | 'motivo' | 'campos_dudosos'>): string[] {
  const dudosos: string[] = []
  for (const campo of Object.keys(NOMBRES_CAMPOS) as Array<keyof typeof NOMBRES_CAMPOS>) {
    const valor = (r as unknown as Record<string, unknown>)[campo]
    if (valor === null || valor === undefined) dudosos.push(NOMBRES_CAMPOS[campo])
  }
  return dudosos
}

/** Vía BARATA: extracción de nómina sobre el texto OCR ya disponible (sin visión). */
export async function extraerNominaAnthropicTexto(textoOcr: string): Promise<ResultadoNomina> {
  const vacio = {
    empleado_nombre_detectado: null, mes: null, anio: null,
    importe_bruto: null, importe_neto: null, irpf_retenido: null,
    ss_trabajador: null, ss_empresa: null, coste_empresa: null,
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { estado: 'error', motivo: 'Falta ANTHROPIC_API_KEY', ...vacio, campos_dudosos: Object.values(NOMBRES_CAMPOS) }
  }
  if (!textoOcr || textoOcr.trim().length < 20) {
    return { estado: 'error', motivo: 'Sin texto legible en el PDF', ...vacio, campos_dudosos: Object.values(NOMBRES_CAMPOS) }
  }

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1200,
        messages: [{
          role: 'user',
          content: `${PROMPT}\n\n--- TEXTO DE LA NÓMINA ---\n${textoOcr.slice(0, 12000)}`,
        }],
      }),
      signal: ctrl.signal,
    })
    if (!resp.ok) {
      const detalle = (await resp.text()).slice(0, 200)
      return { estado: 'error', motivo: `HTTP ${resp.status}: ${detalle}`, ...vacio, campos_dudosos: Object.values(NOMBRES_CAMPOS) }
    }
    const data = await resp.json() as { content?: Array<{ text?: string }> }
    const raw = (data.content || []).map((c) => c.text || '').join('').trim()
    const parseado = parsearNomina(raw)
    const camposDudosos = calcularCamposDudosos(parseado)
    const estado: ResultadoNomina['estado'] = camposDudosos.length === 0 ? 'ok' : 'revisar'
    const motivo = estado === 'ok'
      ? 'Nómina leída completa (6/6 importes)'
      : `Faltan campos por confirmar: ${camposDudosos.join(', ')}`
    return { estado, motivo, ...parseado, campos_dudosos: camposDudosos }
  } catch (err) {
    return {
      estado: 'error',
      motivo: err instanceof Error ? err.message : String(err),
      ...vacio,
      campos_dudosos: Object.values(NOMBRES_CAMPOS),
    }
  } finally {
    clearTimeout(t)
  }
}
