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
// Devuelve el texto del PDF. Si el PDF es escaneado (sin capa de texto),
// devuelve cadena corta/vacía y el flujo decide ir a vision (modelo).
// ──────────────────────────────────────────────────────────────────────────
export async function extraerTextoPDF(buffer: Buffer): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import('unpdf')
    const uint8 = new Uint8Array(buffer)
    const pdf = await getDocumentProxy(uint8)
    const { text } = await extractText(pdf, { mergePages: true })
    return (typeof text === 'string' ? text : Array.isArray(text) ? text.join('\n') : '').trim()
  } catch {
    return ''
  }
}

// Umbral mínimo de caracteres para considerar que el PDF tiene texto real.
// Por debajo de esto se asume escaneado → vision.
const MIN_CHARS_TEXTO_PDF = 40

export function pdfTieneTexto(texto: string): boolean {
  return texto.replace(/\s/g, '').length >= MIN_CHARS_TEXTO_PDF
}

// ──────────────────────────────────────────────────────────────────────────
// EXTRACTOR POR REGLAS (gratis, sin IA)
// Saca nif_emisor, total, fecha, numero, tipo/plataforma del texto.
// Devuelve ExtractedFactura SOLO si alcanza el mínimo (nif_emisor + total + fecha).
// Si no, devuelve null → el flujo llamará al modelo.
// Las facturas de plataforma (Uber/Glovo/Just Eat) devuelven null a propósito:
// necesitan desglose por marca, que se resuelve con el modelo.
// ──────────────────────────────────────────────────────────────────────────

// NIF de clientes conocidos (para distinguir emisor de destinatario)
const NIF_CLIENTES = new Set(['21669051S', '53484832B'])

// NIF de plataformas → fuerzan ir al modelo (necesitan desglose por marca)
const NIF_PLATAFORMA = new Set([
  'B88515200', // Uber / Portier Eats
  'B67282871', // Glovo
  'B66598764', // Glovoapp / Sinqro-Glovo
  'B86008539', // Just Eat
])

const NIF_REGEX = /\b([A-Z]\d{7}[0-9A-Z]|\d{8}[A-Z]|[XYZ]\d{7}[A-Z])\b/g

function buscarNifs(texto: string): string[] {
  const t = texto.toUpperCase()
  const out = new Set<string>()
  let m: RegExpExecArray | null
  NIF_REGEX.lastIndex = 0
  while ((m = NIF_REGEX.exec(t)) !== null) {
    out.add(m[1])
  }
  return [...out]
}

// Importe español: 1.234,56 / 1234,56 / 1234.56
function parseImporte(s: string): number | null {
  let v = s.trim()
  if (v.includes(',') && v.includes('.')) {
    // formato 1.234,56 → quitar puntos de millar, coma decimal
    v = v.replace(/\./g, '').replace(',', '.')
  } else if (v.includes(',')) {
    v = v.replace(',', '.')
  }
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}

function buscarTotal(texto: string): number | null {
  const lineas = texto.split(/\n+/)
  const candidatos: number[] = []
  const reImporte = /(\d{1,3}(?:\.\d{3})*(?:,\d{2})|\d+[.,]\d{2})/g
  for (const linea of lineas) {
    if (/total|importe|a\s*pagar/i.test(linea)) {
      let m: RegExpExecArray | null
      reImporte.lastIndex = 0
      while ((m = reImporte.exec(linea)) !== null) {
        const n = parseImporte(m[1])
        if (n !== null && n > 0) candidatos.push(n)
      }
    }
  }
  if (candidatos.length === 0) return null
  // el total suele ser el mayor de la línea de totales
  return Math.max(...candidatos)
}

function buscarFecha(texto: string): string | null {
  // yyyy-mm-dd
  let m = texto.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/)
  if (m) {
    const [, y, mo, d] = m
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // dd/mm/yyyy o dd-mm-yyyy o dd.mm.yyyy
  m = texto.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/)
  if (m) {
    const [, d, mo, y] = m
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // dd/mm/yy
  m = texto.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})\b/)
  if (m) {
    const [, d, mo, y] = m
    return `20${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return null
}

function buscarNumeroFactura(texto: string): string | null {
  const m = texto.match(/(?:factura|invoice|n[ºo.]\s*factura|n[úu]mero)\s*[:#]?\s*([A-Z0-9][A-Z0-9\-/]{3,30})/i)
  return m ? m[1].trim() : null
}

function esFechaValida(f: string | null): boolean {
  if (!f) return false
  const d = new Date(f)
  if (isNaN(d.getTime())) return false
  const y = d.getFullYear()
  return y >= 2020 && y <= 2030
}

export function extraerPorReglas(texto: string): ExtractedFactura | null {
  if (!texto || texto.length < 30) return null

  const nifs = buscarNifs(texto)
  if (nifs.length === 0) return null

  // Si aparece un NIF de plataforma → al modelo (desglose por marca)
  if (nifs.some((n) => NIF_PLATAFORMA.has(n))) return null

  // emisor = primer NIF que no sea cliente conocido
  const nifEmisor = nifs.find((n) => !NIF_CLIENTES.has(n)) || null
  const nifCliente = nifs.find((n) => NIF_CLIENTES.has(n)) || null
  if (!nifEmisor) return null

  const total = buscarTotal(texto)
  const fecha = buscarFecha(texto)
  if (total === null || total <= 0) return null
  if (!esFechaValida(fecha)) return null

  // Proveedor: primera línea no vacía con letras (heurística simple).
  // El nombre canónico real lo resuelve procesarArchivo por NIF en tabla proveedores.
  const primeraLinea =
    texto.split(/\n+/).map((l) => l.trim()).find((l) => /[a-zA-Z]{3,}/.test(l)) || 'PROVEEDOR'

  return {
    proveedor_nombre: primeraLinea.slice(0, 80),
    numero_factura: buscarNumeroFactura(texto) || '',
    fecha_factura: fecha as string,
    es_recapitulativa: false,
    periodo_inicio: null,
    periodo_fin: null,
    tipo: 'proveedor',
    plataforma: null,
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
