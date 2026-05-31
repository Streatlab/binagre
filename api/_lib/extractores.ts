import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import { simpleParser } from 'mailparser'
import type { ExtractedFactura } from './ocr.js'

export interface AdjuntoExtraido {
  name: string
  data: Buffer
  mimeType: string
}

export interface ContenidoExtraido {
  tipo: 'vision' | 'texto'
  data: Buffer | string
  mediaType?: string
  adjuntos?: AdjuntoExtraido[]
}

// Plantilla de lectura por NIF (viene del diccionario reglas_conciliacion).
// Permite que cada proveedor "raro" indique de qué etiqueta sacar cada dato.
// Todos los campos son opcionales: si no hay plantilla, se usa el lector genérico.
export interface PlantillaNif {
  totalLabel: string | null   // etiqueta que precede al total (ej: "TOTAL FACTURA")
  fechaFormato: string | null // 'dmy' | 'ymd' | null (autodetección por defecto)
  numLabel: string | null     // etiqueta que precede al nº de factura
}

export async function extraerWord(buffer: Buffer): Promise<ContenidoExtraido> {
  const result = await mammoth.extractRawText({ buffer })
  return { tipo: 'texto', data: result.value || '' }
}

export async function extraerExcel(buffer: Buffer): Promise<ContenidoExtraido> {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  let texto = ''
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue
    const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ' | ' })
    texto += `=== Hoja: ${sheetName} ===\n${csv}\n\n`
  }
  return { tipo: 'texto', data: texto }
}

export async function extraerEmail(buffer: Buffer): Promise<ContenidoExtraido> {
  const parsed = await simpleParser(buffer)
  const texto = [
    `De: ${parsed.from?.text || ''}`,
    `Asunto: ${parsed.subject || ''}`,
    `Fecha: ${parsed.date?.toISOString?.() || ''}`,
    '',
    parsed.text || (typeof parsed.html === 'string' ? parsed.html : '') || '',
  ].join('\n')

  const adjuntos: AdjuntoExtraido[] = (parsed.attachments || [])
    .filter((a) => a.content && a.filename)
    .map((a) => ({
      name: a.filename!,
      data: a.content as Buffer,
      mimeType: a.contentType || 'application/octet-stream',
    }))

  return { tipo: 'texto', data: texto, adjuntos }
}

export function extraerTexto(texto: string): ContenidoExtraido {
  return { tipo: 'texto', data: texto }
}

export function prepararVision(buffer: Buffer, mimeType: string): ContenidoExtraido {
  return { tipo: 'vision', data: buffer, mediaType: mimeType }
}

// ──────────────────────────────────────────────────────────────────────────
// LECTURA DE TEXTO DE PDF (gratis, sin IA) — unpdf, compatible serverless
// ──────────────────────────────────────────────────────────────────────────
export async function extraerTextoPDF(buffer: Buffer): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import('unpdf')
    const uint8 = new Uint8Array(buffer)
    const pdf = await getDocumentProxy(uint8)
    const out = await extractText(pdf, { mergePages: true })
    const text: unknown = (out as { text: unknown }).text
    if (typeof text === 'string') return text.trim()
    if (Array.isArray(text)) return (text as unknown[]).map(String).join('\n').trim()
    return ''
  } catch {
    return ''
  }
}

const MIN_CHARS_TEXTO_PDF = 40

export function pdfTieneTexto(texto: string): boolean {
  return texto.replace(/\s/g, '').length >= MIN_CHARS_TEXTO_PDF
}

// ──────────────────────────────────────────────────────────────────────────
// EXTRACTOR POR REGLAS (gratis, sin IA)
// Saca nif_emisor, total, fecha, numero del texto. 0 API.
// Si el NIF emisor tiene plantilla en el diccionario, la usa para localizar el
// total/fecha/nº con la etiqueta concreta de ese proveedor. Si no, lector genérico.
// Plataformas (Uber/Glovo/Just Eat) se etiquetan por NIF emisor y se leen igual.
// ──────────────────────────────────────────────────────────────────────────

const NIF_CLIENTES = new Set(['21669051S', '53484832B'])

const PLATAFORMA_POR_NIF: Record<string, 'uber' | 'glovo' | 'just_eat'> = {
  B88515200: 'uber',
  B67282871: 'glovo',
  B66598764: 'glovo',
  B86008539: 'just_eat',
}

// Frontera flexible: el NIF puede ir pegado a letras/símbolos (ej "CIF/NIF21669051S"
// o "NIF:21669051S"). Se exige que NO esté rodeado de dígitos (para no partir
// números largos) pero sí admite estar pegado a letras. Captura los 3 formatos
// españoles: empresa (letra+7díg+control), persona (8díg+letra), NIE (XYZ+7díg+letra).
const NIF_REGEX = /(?<!\d)([A-Z]\d{7}[0-9A-Z]|\d{8}[A-Z]|[XYZ]\d{7}[A-Z])(?!\d)/g

function buscarNifs(texto: string): string[] {
  const t = texto.toUpperCase()
  const out: string[] = []
  const vistos = new Set<string>()
  let m: RegExpExecArray | null
  NIF_REGEX.lastIndex = 0
  while ((m = NIF_REGEX.exec(t)) !== null) {
    if (!vistos.has(m[1])) { vistos.add(m[1]); out.push(m[1]) }
  }
  return out
}

function parseImporte(s: string): number | null {
  let v = s.trim()
  if (v.includes(',') && v.includes('.')) {
    v = v.replace(/\./g, '').replace(',', '.')
  } else if (v.includes(',')) {
    v = v.replace(',', '.')
  }
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}

const RE_IMPORTE = /(\d{1,3}(?:\.\d{3})*(?:,\d{2})|\d+[.,]\d{2})/g

function importesDeLinea(linea: string): number[] {
  const out: number[] = []
  let m: RegExpExecArray | null
  RE_IMPORTE.lastIndex = 0
  while ((m = RE_IMPORTE.exec(linea)) !== null) {
    const n = parseImporte(m[1])
    if (n !== null && n > 0) out.push(n)
  }
  return out
}

// Escapar texto para usarlo dentro de un regex
function escRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Total preferente: si la plantilla del NIF trae totalLabel, se busca esa
// etiqueta exacta primero. Si no, "total a pagar", luego genérico.
function buscarTotal(texto: string, plantilla?: PlantillaNif | null): number | null {
  const lineas = texto.split(/\n+/)

  // 0) Plantilla del proveedor: etiqueta específica
  if (plantilla?.totalLabel) {
    const re = new RegExp(escRegex(plantilla.totalLabel), 'i')
    const propios: number[] = []
    for (let i = 0; i < lineas.length; i++) {
      if (re.test(lineas[i])) {
        const enLinea = importesDeLinea(lineas[i])
        if (enLinea.length > 0) propios.push(...enLinea)
        else if (i + 1 < lineas.length) {
          const sig = importesDeLinea(lineas[i + 1])
          if (sig.length > 0) propios.push(sig[0])
        }
      }
    }
    if (propios.length > 0) return Math.max(...propios)
  }

  // 1) "total a pagar" / "total amount payable"
  const prioridad: number[] = []
  for (const linea of lineas) {
    if (/(importe\s+)?total\s+a\s+pagar|total\s+amount\s+payable/i.test(linea)) {
      prioridad.push(...importesDeLinea(linea))
    }
  }
  if (prioridad.length > 0) return Math.max(...prioridad)

  // 2) Genérico: total/importe/a pagar (+ línea siguiente si va a secas)
  const candidatos: number[] = []
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i]
    if (/total|importe|a\s*pagar/i.test(linea)) {
      const enLinea = importesDeLinea(linea)
      if (enLinea.length > 0) {
        candidatos.push(...enLinea)
      } else if (i + 1 < lineas.length) {
        const sig = importesDeLinea(lineas[i + 1])
        if (sig.length > 0) candidatos.push(sig[0])
      }
    }
  }
  if (candidatos.length === 0) return null
  return Math.max(...candidatos)
}

function buscarFecha(texto: string, plantilla?: PlantillaNif | null): string | null {
  const formato = plantilla?.fechaFormato || null

  // Si la plantilla fuerza ymd, intentarlo primero
  if (formato === 'ymd') {
    const m = texto.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/)
    if (m) {
      const [, y, mo, d] = m
      return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
  }
  // Si la plantilla fuerza dmy, intentarlo primero
  if (formato === 'dmy') {
    const m = texto.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/)
    if (m) {
      const [, d, mo, y] = m
      return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
  }

  // Autodetección (orden por defecto)
  let m = texto.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/)
  if (m) {
    const [, y, mo, d] = m
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  m = texto.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/)
  if (m) {
    const [, d, mo, y] = m
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  m = texto.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})\b/)
  if (m) {
    const [, d, mo, y] = m
    return `20${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return null
}

function buscarNumeroFactura(texto: string, plantilla?: PlantillaNif | null): string | null {
  if (plantilla?.numLabel) {
    const re = new RegExp(`${escRegex(plantilla.numLabel)}\\s*[:#]?\\s*([A-Z0-9][A-Z0-9\\-/]{3,40})`, 'i')
    const m = texto.match(re)
    if (m) return m[1].trim()
  }
  let m = texto.match(/(?:n[úu]mero\s+de\s+factura|invoice\s+number)\s*[:#]?\s*([A-Z0-9][A-Z0-9\-/]{3,40})/i)
  if (m) return m[1].trim()
  m = texto.match(/(?:factura|invoice|n[ºo.]\s*factura|n[úu]mero)\s*[:#]?\s*([A-Z0-9][A-Z0-9\-/]{3,30})/i)
  return m ? m[1].trim() : null
}

function esFechaValida(f: string | null): boolean {
  if (!f) return false
  const d = new Date(f)
  if (isNaN(d.getTime())) return false
  const y = d.getFullYear()
  return y >= 2020 && y <= 2030
}

// plantillaResolver: función opcional que, dado el NIF emisor, devuelve su
// plantilla del diccionario (o null). Permite leer cada proveedor a su manera.
export function extraerPorReglas(
  texto: string,
  plantillaResolver?: (nifEmisor: string) => PlantillaNif | null,
): ExtractedFactura | null {
  if (!texto || texto.length < 30) return null

  const nifs = buscarNifs(texto)
  if (nifs.length === 0) return null

  // NIF cliente: prioriza siempre los conocidos (Rubén/Emilio) estén donde estén
  // en el documento. NIF emisor: el primero que NO sea cliente conocido.
  const nifCliente = nifs.find((n) => NIF_CLIENTES.has(n)) || null
  const nifEmisor = nifs.find((n) => !NIF_CLIENTES.has(n)) || null
  if (!nifEmisor) return null

  const plantilla = plantillaResolver ? plantillaResolver(nifEmisor) : null

  const plataforma = PLATAFORMA_POR_NIF[nifEmisor] || null
  const tipo: 'proveedor' | 'plataforma' = plataforma ? 'plataforma' : 'proveedor'

  const total = buscarTotal(texto, plantilla)
  const fecha = buscarFecha(texto, plantilla)
  if (total === null || total <= 0) return null
  if (!esFechaValida(fecha)) return null

  return {
    proveedor_nombre: '',
    numero_factura: buscarNumeroFactura(texto, plantilla) || '',
    fecha_factura: fecha as string,
    es_recapitulativa: false,
    periodo_inicio: null,
    periodo_fin: null,
    tipo,
    plataforma,
    nif_cliente: nifCliente,
    nif_emisor: nifEmisor,
    nombre_cliente: null,
    base_4: 0,
    iva_4: 0,
    base_10: 0,
    iva_10: 0,
    base_21: 0,
    iva_21: 0,
    total,
    confianza: 92,
  }
}
