// clasificarDocEquipo.ts — clasificador del buzón único EQUIPO en Papeleo.
// Son documentos oficiales: la clasificación es DETERMINISTA por marcadores en el
// texto, no un score de IA. Los marcadores son los que traen DE VERDAD los
// documentos de la gestoría (Gestorum) y de la Seguridad Social:
//   · RLC → "Recibo de Liquidación de Cotizaciones" / RLC / TC1
//   · RNT → "Relación Nominal de Trabajadores" / RNT / TC2
//   · Resumen de nóminas → título "Resumen de nómina", o tabla con varios
//     trabajadores e importes
//   · Nómina individual → un único "Líquido a percibir" (o "recibo de salarios")
// Solo cuando no hay ningún marcador se pide una pista a Claude, y esa pista NUNCA
// archiva sola: `cierto` queda en false y el documento va a la cola de revisión.
export interface ClasificacionDocEquipo {
  tipo: 'nomina' | 'resumen_nominas' | 'rlc' | 'rnt' | 'cuota_autonomos' | 'desconocido'
  empleado_nombre: string | null
  nif_trabajador: string | null
  /** Solo relevante para tipo='cuota_autonomos': NIF del titular (Rubén/Emilio) que paga la cuota. */
  nif_titular: string | null
  cierto: boolean
  motivo: string
}

function normalizar(texto: string): string {
  return texto
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[ \t]+/g, ' ')
}

// DNI/NIE de persona física: 8 dígitos + letra (o X/Y/Z + 7 dígitos + letra).
// No colisiona con el CIF de empresa (letra + 7 dígitos + control), que es lo
// que suele aparecer también en estos documentos como emisor.
const RE_NIF_PERSONA = /\b(\d{8}[A-Z]|[XYZ]\d{7}[A-Z])\b/g

function nifsPersona(textoNorm: string): string[] {
  const vistos = new Set<string>()
  let m: RegExpExecArray | null
  RE_NIF_PERSONA.lastIndex = 0
  while ((m = RE_NIF_PERSONA.exec(textoNorm)) !== null) vistos.add(m[1])
  return [...vistos]
}

function extraerNombreTrabajador(textoOriginal: string): string | null {
  const lineas = textoOriginal.split(/\n+/)
  const patrones = [
    /(?:apellidos\s+y\s+nombre|nombre\s+del\s+trabajador|trabajador|empleado)\s*[:\-]?\s*(.+)/i,
  ]
  for (const linea of lineas) {
    for (const re of patrones) {
      const m = linea.match(re)
      if (m && m[1] && m[1].trim().length >= 4) {
        return m[1].trim().replace(/\s{2,}/g, ' ').slice(0, 80)
      }
    }
  }
  return null
}

interface Marcador { tipo: ClasificacionDocEquipo['tipo']; motivo: string }

function detectarPorMarcadores(textoNorm: string): Marcador | null {
  // Seguridad Social primero: sus cabeceras no llevan "liquido a percibir".
  if (/RECIBO DE LIQUIDACION DE COTIZACIONES/.test(textoNorm) || /\bRLC\b/.test(textoNorm) || /\bTC\s?1\b/.test(textoNorm)) {
    return { tipo: 'rlc', motivo: 'Recibo de Liquidación de Cotizaciones (RLC)' }
  }
  if (/RELACION NOMINAL DE TRABAJADORES/.test(textoNorm) || /\bRNT\b/.test(textoNorm) || /\bTC\s?2\b/.test(textoNorm)) {
    return { tipo: 'rnt', motivo: 'Relación Nominal de Trabajadores (RNT)' }
  }
  // Cuota de autónomos (RETA) de un titular concreto (Rubén o Emilio), no de la
  // empresa: recibo TGSS individual, distinto del RLC (que es de la plantilla).
  if (/REGIMEN ESPECIAL (DE )?TRABAJADORES AUTONOMOS/.test(textoNorm) || /\bRETA\b/.test(textoNorm)) {
    if (/CUOTA/.test(textoNorm)) {
      return { tipo: 'cuota_autonomos', motivo: 'Recibo de cuota de autónomos (RETA/TGSS)' }
    }
  }

  const nifs = nifsPersona(textoNorm)
  const recibosIndividuales = (textoNorm.match(/LIQUIDO A PERCIBIR/g) || []).length

  // Resumen de nóminas de la gestoría: título literal, o tabla con varios
  // trabajadores y columnas de importes.
  if (/RESUMEN DE NOMINAS?/.test(textoNorm) || /RESUMEN DE LA NOMINA/.test(textoNorm)) {
    return { tipo: 'resumen_nominas', motivo: 'Título "Resumen de nómina"' }
  }
  if (nifs.length >= 2 && recibosIndividuales === 0 && /(BRUTO|DEVENGADO|TOTAL DEVENGOS)/.test(textoNorm) && /(NETO|LIQUIDO|A PERCIBIR)/.test(textoNorm)) {
    return { tipo: 'resumen_nominas', motivo: `Tabla con ${nifs.length} trabajadores e importes` }
  }

  // Varias nóminas completas dentro del mismo PDF: no es un resumen, son recibos
  // sueltos pegados. No se archiva a ciegas: va a revisión con el motivo claro.
  if (recibosIndividuales >= 2) {
    return { tipo: 'desconocido', motivo: `El PDF contiene ${recibosIndividuales} nóminas completas juntas: súbelas por separado o reasigna el tipo a mano` }
  }

  // Nómina individual: un único recibo de salarios.
  if (recibosIndividuales === 1
    || /RECIBO INDIVIDUAL (JUSTIFICATIVO DEL PAGO DE SALARIOS|DE SALARIOS)/.test(textoNorm)
    || /RECIBO DE SALARIOS/.test(textoNorm)) {
    return { tipo: 'nomina', motivo: 'Recibo individual de salarios (un solo "líquido a percibir")' }
  }

  return null
}

export async function clasificarDocEquipoTexto(textoOcr: string): Promise<ClasificacionDocEquipo> {
  if (!textoOcr || textoOcr.trim().length < 20) {
    return { tipo: 'desconocido', empleado_nombre: null, nif_trabajador: null, nif_titular: null, cierto: false, motivo: 'Sin texto legible en el documento' }
  }

  const textoNorm = normalizar(textoOcr)
  const marcador = detectarPorMarcadores(textoNorm)

  if (marcador) {
    if (marcador.tipo === 'desconocido') {
      return { tipo: 'desconocido', empleado_nombre: null, nif_trabajador: null, nif_titular: null, cierto: false, motivo: marcador.motivo }
    }
    const esNomina = marcador.tipo === 'nomina'
    const esCuotaAutonomos = marcador.tipo === 'cuota_autonomos'
    const nifs = (esNomina || esCuotaAutonomos) ? nifsPersona(textoNorm) : []
    return {
      tipo: marcador.tipo,
      empleado_nombre: esNomina ? extraerNombreTrabajador(textoOcr) : null,
      nif_trabajador: esNomina && nifs.length === 1 ? nifs[0] : null,
      nif_titular: esCuotaAutonomos && nifs.length === 1 ? nifs[0] : null,
      cierto: esCuotaAutonomos ? nifs.length === 1 : true,
      motivo: esCuotaAutonomos && nifs.length !== 1
        ? `${marcador.motivo}, pero no se identificó un único NIF de titular en el documento`
        : marcador.motivo,
    }
  }

  // Sin marcador determinista: pista de Claude como último recurso. El
  // resultado SIEMPRE va a revisión (cierto=false) — nunca se archiva a
  // ciegas contra una tabla solo porque la IA "cree" que sabe el tipo.
  return clasificarConIAComoPista(textoOcr)
}

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_MODEL = 'claude-sonnet-4-5'
const TIMEOUT_MS = 60000

const PROMPT_PISTA = `Eres un clasificador de documentos de personal de una empresa española (nóminas y Seguridad Social). El texto que recibes NO trajo ningún marcador oficial reconocible, así que tu respuesta es solo una PISTA para que una persona lo revise — no se usará para archivar el documento automáticamente. Devuelve SOLO un objeto JSON válido, sin texto alrededor:
{
  "tipo": "nomina" | "resumen_nominas" | "rlc" | "rnt" | "cuota_autonomos" | "desconocido",
  "empleado_nombre": string|null,
  "motivo": string
}
"empleado_nombre" solo si tipo="nomina" (nombre del trabajador tal cual aparece, nunca el de la empresa). "motivo": por qué crees que es ese tipo, en pocas palabras. NUNCA inventes datos que no aparezcan en el texto. Responde SOLO el JSON.`

const TIPOS_VALIDOS = new Set(['nomina', 'resumen_nominas', 'rlc', 'rnt', 'cuota_autonomos', 'desconocido'])

function parsearPista(raw: string): { tipo: ClasificacionDocEquipo['tipo']; empleado_nombre: string | null; motivo: string } {
  let j: Record<string, unknown> = {}
  try { j = JSON.parse(raw.replace(/```json|```/g, '').trim()) } catch { j = {} }
  const tipoRaw = String(j.tipo || '').trim()
  const tipo = (TIPOS_VALIDOS.has(tipoRaw) ? tipoRaw : 'desconocido') as ClasificacionDocEquipo['tipo']
  return {
    tipo,
    empleado_nombre: tipo === 'nomina' && j.empleado_nombre ? String(j.empleado_nombre).trim() : null,
    motivo: j.motivo ? String(j.motivo).trim() : 'Sin marcador oficial reconocible; pista de IA sin confirmar',
  }
}

async function clasificarConIAComoPista(textoOcr: string): Promise<ClasificacionDocEquipo> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { tipo: 'desconocido', empleado_nombre: null, nif_trabajador: null, nif_titular: null, cierto: false, motivo: 'Sin marcador oficial reconocible y falta ANTHROPIC_API_KEY para la pista de respaldo' }
  }
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 300,
        messages: [{ role: 'user', content: `${PROMPT_PISTA}\n\n--- TEXTO DEL DOCUMENTO ---\n${textoOcr.slice(0, 12000)}` }],
      }),
      signal: ctrl.signal,
    })
    if (!resp.ok) {
      const detalle = (await resp.text()).slice(0, 200)
      return { tipo: 'desconocido', empleado_nombre: null, nif_trabajador: null, nif_titular: null, cierto: false, motivo: `Sin marcador oficial; pista de IA falló (HTTP ${resp.status}: ${detalle})` }
    }
    const data = await resp.json() as { content?: Array<{ text?: string }> }
    const raw = (data.content || []).map(c => c.text || '').join('').trim()
    const pista = parsearPista(raw)
    return { tipo: pista.tipo, empleado_nombre: pista.empleado_nombre, nif_trabajador: null, nif_titular: null, cierto: false, motivo: `Sin marcador oficial; pista de IA: ${pista.motivo}` }
  } catch (err) {
    return { tipo: 'desconocido', empleado_nombre: null, nif_trabajador: null, nif_titular: null, cierto: false, motivo: `Sin marcador oficial; pista de IA falló (${err instanceof Error ? err.message : String(err)})` }
  } finally {
    clearTimeout(t)
  }
}
