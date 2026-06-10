import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import { simpleParser } from 'mailparser'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeFile, unlink } from 'node:fs/promises'
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
  // HTML disfrazado de .doc (Just Eat y otros exportan la factura como HTML con
  // extensión .doc). word-extractor/mammoth fallan con esto, así que se detecta y
  // se extrae el texto quitando etiquetas. Es lo que permite leer las Just Eat .doc.
  if (pareceHtmlBuffer(buffer)) {
    const t = htmlBufferATexto(buffer)
    if (t && t.replace(/\s/g, '').length >= 20) return { tipo: 'texto', data: t }
  }
  // .docx (OOXML, cabecera 'PK'): mammoth lee bien
  const esDocx = buffer.length > 3 && buffer[0] === 0x50 && buffer[1] === 0x4b
  if (esDocx) {
    try {
      const result = await mammoth.extractRawText({ buffer })
      if ((result.value || '').trim()) return { tipo: 'texto', data: result.value }
    } catch { /* cae a word-extractor */ }
  }
  // .doc binario antiguo (OLE2 D0 CF 11 E0) o fallback: word-extractor (lee .doc y .docx)
  const tmp = join(tmpdir(), `w-${Date.now()}-${Math.random().toString(36).slice(2)}.doc`)
  try {
    await writeFile(tmp, buffer)
    const mod: any = await import('word-extractor')
    const WordExtractor = mod.default || mod
    const extractor = new WordExtractor()
    const doc = await extractor.extract(tmp)
    const texto = [doc.getBody?.(), doc.getHeaders?.(), doc.getFootnotes?.()]
      .filter(Boolean).join('\n').trim()
    if (texto) return { tipo: 'texto', data: texto }
  } catch { /* ultimo recurso abajo */ } finally {
    await unlink(tmp).catch(() => {})
  }
  // ultimo recurso: si el contenido tenía pinta de HTML, intentar el strip aunque
  // pareceHtmlBuffer no lo detectara en la cabecera.
  const crudo = buffer.toString('utf-8')
  if (/<\/?(table|td|tr|div|p|html|body)\b/i.test(crudo)) {
    const t = htmlBufferATexto(buffer)
    if (t.trim()) return { tipo: 'texto', data: t }
  }
  try {
    const result = await mammoth.extractRawText({ buffer })
    return { tipo: 'texto', data: result.value || '' }
  } catch {
    return { tipo: 'texto', data: '' }
  }
}

// ¿El buffer es HTML? Mira la cabecera en busca de marcadores típicos.
function pareceHtmlBuffer(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 4096).toString('utf-8').toLowerCase()
  return head.includes('<html') || head.includes('<!doctype html') ||
         head.includes('<table') || head.includes('<body') || head.includes('<td')
}

// Convierte HTML en texto plano legible para las reglas: separa celdas/filas con
// espacios y saltos para que etiqueta y valor (p.ej. "Total a pagar" … "30,81€")
// queden en la misma línea y el lector genérico/plantilla los encuentre.
function htmlBufferATexto(buffer: Buffer): string {
  let s = buffer.toString('utf-8')
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  s = s.replace(/<\/(td|th)>/gi, ' ').replace(/<\/(tr|p|div|h[1-6]|li)>/gi, '\n')
  s = s.replace(/<[^>]+>/g, ' ')
  s = s.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&euro;/gi, '€')
       .replace(/&aacute;/gi, 'á').replace(/&eacute;/gi, 'é').replace(/&iacute;/gi, 'í')
       .replace(/&oacute;/gi, 'ó').replace(/&uacute;/gi, 'ú').replace(/&ntilde;/gi, 'ñ')
       .replace(/&#?\w+;/g, ' ')
  s = s.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim()
  return s
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
  const cuerpo = parsed.text || (typeof parsed.html === 'string' ? htmlATexto(parsed.html) : '') || ''
  const texto = [
    `De: ${parsed.from?.text || ''}`,
    `Asunto: ${parsed.subject || ''}`,
    `Fecha: ${parsed.date?.toISOString?.() || ''}`,
    '',
    cuerpo,
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

// ──────────────────────────────────────────────────────────────────────────
// LIMPIEZA HTML → TEXTO PLANO (gratis, sin IA)
// Muchas facturas llegan como .txt/.html (ej. Just Eat manda la factura en una
// tabla HTML). Sin limpiar, las etiquetas ("Total a pagar") y el importe quedan
// envueltos en <td>/<tr> y el lector por reglas saca 0 o un importe equivocado.
// Conversión clave para que las reglas lean:
//   - Cada celda </td>/</th> → " | " (mantiene etiqueta + importe en la MISMA
//     línea, que es lo que buscarTotal espera).
//   - Fin de fila/párrafo/salto </tr>,<br>,</p>,</div> → salto de línea real.
//   - Se quitan los demás tags y <script>/<style> enteros.
//   - Se decodifican las entidades (&euro; &nbsp; &amp; &#xE9; &#243; …).
// ──────────────────────────────────────────────────────────────────────────
const ENTIDADES_NOMBRE: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  euro: '€', eacute: 'é', aacute: 'á', iacute: 'í', oacute: 'ó',
  uacute: 'ú', ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', ordf: 'ª',
  ordm: 'º', deg: '°', middot: '·', hellip: '…', mdash: '—', ndash: '–',
}

function decodificarEntidades(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
      try { return String.fromCodePoint(parseInt(h, 16)) } catch { return _ }
    })
    .replace(/&#(\d+);/g, (_, d) => {
      try { return String.fromCodePoint(parseInt(d, 10)) } catch { return _ }
    })
    .replace(/&([a-zA-Z]+);/g, (m, name) => (name in ENTIDADES_NOMBRE ? ENTIDADES_NOMBRE[name] : m))
}

export function pareceHtml(s: string): boolean {
  if (!s) return false
  const t = s.slice(0, 4000).toLowerCase()
  return /<!doctype html|<html[\s>]|<table[\s>]|<td[\s>]|<div[\s>]|<body[\s>]/.test(t)
}

export function htmlATexto(html: string): string {
  let t = html
  // Fuera bloques no visibles enteros
  t = t.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  t = t.replace(/<style[\s\S]*?<\/style>/gi, ' ')
  t = t.replace(/<head[\s\S]*?<\/head>/gi, ' ')
  // Celdas dentro de la misma fila → separador en línea (etiqueta | valor)
  t = t.replace(/<\/(td|th)>/gi, ' | ')
  // Fin de fila / saltos / bloques → salto de línea real
  t = t.replace(/<\/(tr|p|div|h\d|li)>/gi, '\n')
  t = t.replace(/<br\s*\/?>/gi, '\n')
  // Resto de tags fuera
  t = t.replace(/<[^>]+>/g, ' ')
  // Entidades
  t = decodificarEntidades(t)
  // Normalizar espacios y líneas
  t = t.replace(/[ \t\f\v]+/g, ' ')
  t = t.replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n')
  return t.trim()
}

export function extraerTexto(texto: string): ContenidoExtraido {
  const limpio = pareceHtml(texto) ? htmlATexto(texto) : texto
  return { tipo: 'texto', data: limpio }
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

// Igual que extraerTextoPDF pero devuelve el texto SEPARADO por páginas.
// Se usa para el partido multi-factura cuando cada página es una factura.
export async function extraerTextoPDFPorPaginas(buffer: Buffer): Promise<string[]> {
  try {
    const { extractText, getDocumentProxy } = await import('unpdf')
    const uint8 = new Uint8Array(buffer)
    const pdf = await getDocumentProxy(uint8)
    const out = await extractText(pdf, { mergePages: false })
    const text: unknown = (out as { text: unknown }).text
    if (Array.isArray(text)) return (text as unknown[]).map((p) => String(p).trim())
    if (typeof text === 'string') return [text.trim()]
    return []
  } catch {
    return []
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

// NIFs de plataforma cuyos PDF traen UNA sola factura aunque luego incluyan una
// tabla de detalle de pedidos (Glovo pág. 2). Estos NUNCA deben pasar por el
// partido multi-factura: si no, el separador cree que cada línea de pedido es
// una factura y lee mal (número "courier", importe de la línea "Productos", etc.).
const NIF_PLATAFORMA_NO_PARTIR = new Set(['B67282871', 'B66598764', 'B88515200', 'B86008539'])

function textoEsPlataformaNoPartir(texto: string): boolean {
  const t = (texto || '').toUpperCase().replace(/[\s\-.]/g, '')
  for (const nif of NIF_PLATAFORMA_NO_PARTIR) {
    if (t.includes(nif)) return true
  }
  return false
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

// Saca SOLO el NIF emisor del texto (el primero que no sea cliente conocido),
// aunque no haya total ni fecha legibles. Se usa en lectura manual para poder
// identificar el proveedor y crear su plantilla automáticamente.
export function extraerNifEmisorLibre(texto: string): string | null {
  if (!texto) return null
  const nifs = buscarNifs(texto)
  if (nifs.length === 0) return null
  return nifs.find((n) => !NIF_CLIENTES.has(n)) || null
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
  // Fecha en texto: "31 enero 2026" (común en Just Eat / facturas españolas)
  const fTxt = buscarFechaTextual(texto)
  if (fTxt) return fTxt
  return null
}

// Fecha escrita con el mes en palabra: "31 enero 2026", "5 de marzo de 2026".
const MESES_ES: Record<string, string> = {
  enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
  julio: '07', agosto: '08', septiembre: '09', setiembre: '09', octubre: '10',
  noviembre: '11', diciembre: '12',
}
function buscarFechaTextual(texto: string): string | null {
  const re = /\b(\d{1,2})\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(20\d{2})\b/i
  const m = texto.match(re)
  if (!m) return null
  const d = m[1].padStart(2, '0')
  const mo = MESES_ES[m[2].toLowerCase()]
  const y = m[3]
  if (!mo) return null
  return `${y}-${mo}-${d}`
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
  // requireFecha=true (def): solo devuelve factura si hay fecha válida. Lo usa el
  // partido multi-factura (conservador: una página sin fecha NO cuenta como factura).
  // requireFecha=false: si hay TOTAL legible pero la fecha no se reconoce, NO se
  // descarta la factura; se devuelve con fecha vacía (el llamador aplica hoy como
  // fallback) y confianza menor. Evita tirar a lectura manual una factura cuyo
  // importe sí se leyó bien solo porque la fecha venía en un formato raro.
  requireFecha = true,
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

  const fechaOk = esFechaValida(fecha)
  if (!fechaOk && requireFecha) return null

  return {
    proveedor_nombre: '',
    numero_factura: buscarNumeroFactura(texto, plantilla) || '',
    // Si no hay fecha válida (solo posible con requireFecha=false) se deja vacía:
    // procesarArchivo aplica la fecha de hoy como fallback.
    fecha_factura: fechaOk ? (fecha as string) : '',
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
    // Confianza menor cuando la fecha quedó por defecto: queda marcada como menos
    // fiable para una posible revisión, pero la factura se procesa (no va a manual).
    confianza: fechaOk ? 92 : 70,
  }
}

// Deriva una plantilla de lectura (etiqueta de total + formato de fecha) a partir
// del texto del documento y de los valores ya leídos por la capa de pago. Sirve
// para que la PRÓXIMA factura del mismo proveedor se lea GRATIS por reglas, con la
// etiqueta correcta. Best-effort y conservador: solo fija un campo si lo encuentra
// con seguridad; si no, lo deja null (el lector genérico sigue funcionando).
export function derivarPlantilla(
  texto: string | null | undefined,
  extracted: { total?: number | null; fecha_factura?: string | null },
): PlantillaNif {
  const out: PlantillaNif = { totalLabel: null, fechaFormato: null, numLabel: null }
  if (!texto) return out

  // 1) Etiqueta del total: línea cuyo importe coincide con el total leído.
  const total = extracted.total
  if (typeof total === 'number' && total > 0) {
    const lineas = texto.split(/\n+/)
    for (let i = 0; i < lineas.length; i++) {
      const imps = importesDeLinea(lineas[i])
      const coincide = imps.some((v) => Math.abs(v - total) < 0.005)
      if (!coincide) continue
      // Etiqueta = texto antes del importe en la misma línea; si la línea es solo
      // el importe, se mira la línea anterior.
      let label = limpiarLabel(lineas[i])
      if (!label && i > 0) label = limpiarLabel(lineas[i - 1])
      // Solo se acepta como plantilla si parece una etiqueta de total real.
      if (label && /total|importe|pagar|amount|due/i.test(label)) {
        out.totalLabel = label
        break
      }
    }
  }

  // 2) Formato de fecha: detectar si el documento usa ymd o dmy.
  if (extracted.fecha_factura) {
    if (/\b20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b/.test(texto)) out.fechaFormato = 'ymd'
    else if (/\b\d{1,2}[-/.]\d{1,2}[-/.]20\d{2}\b/.test(texto)) out.fechaFormato = 'dmy'
  }

  return out
}

// Limpia una línea para usarla como etiqueta: quita importes/símbolos, colapsa
// espacios y recorta. Devuelve null si no queda una etiqueta corta y plausible.
function limpiarLabel(linea: string): string | null {
  const label = linea
    .replace(RE_IMPORTE, ' ')
    .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (label.length < 3 || label.length > 40) return null
  return label
}

// ──────────────────────────────────────────────────────────────────────────
// PARTIDO MULTI-FACTURA (gratis, sin IA)
// Un mismo PDF puede contener VARIAS facturas (caso Rubén: mismo proveedor,
// varios albaranes/facturas en un documento), o una factura por página.
// Esta función intenta detectar y separar esos bloques. Es CONSERVADORA:
//   - Solo parte si encuentra ≥2 facturas válidas y distintas.
//   - Si encuentra 0 o 1, devuelve [] y el flujo normal sigue leyendo 1 factura
//     (cero cambio de comportamiento para el PDF de una sola factura).
// Estrategia en dos pasadas:
//   A) Por páginas: si el PDF trae varias páginas y cada una da una factura
//      válida con número/total propios → una factura por página.
//   B) Por marcadores de "Factura nº" dentro del texto combinado: se corta el
//      texto en los puntos donde aparece un nuevo número de factura y se lee
//      cada segmento por separado.
// Devuelve las facturas válidas (con número distinto). El llamador decide.
// ──────────────────────────────────────────────────────────────────────────

// Marca de inicio de una factura nueva dentro del texto: "factura nº/n.º/no/número …"
const RE_INICIO_FACTURA = /(?:factura|invoice)\s*(?:n[ºo.]|n\.?º|n[úu]mero|number|#)?\s*[:#]?\s*([A-Z0-9][A-Z0-9\-/]{2,40})/gi

function dedupeFacturas(facturas: ExtractedFactura[]): ExtractedFactura[] {
  const vistas = new Set<string>()
  const out: ExtractedFactura[] = []
  for (const f of facturas) {
    // Clave por número + total (mismo número y total = misma factura repetida en el corte).
    const clave = `${(f.numero_factura || '').toUpperCase()}|${f.total}`
    if (vistas.has(clave)) continue
    vistas.add(clave)
    out.push(f)
  }
  return out
}

// Intenta partir por páginas. Cada página que dé una factura válida cuenta.
function partirPorPaginas(
  paginas: string[],
  plantillaResolver?: (nifEmisor: string) => PlantillaNif | null,
): ExtractedFactura[] {
  if (paginas.length < 2) return []
  const out: ExtractedFactura[] = []
  for (const pag of paginas) {
    if (!pdfTieneTexto(pag)) continue
    const f = extraerPorReglas(pag, plantillaResolver)
    if (f && f.total > 0) out.push(f)
  }
  return dedupeFacturas(out)
}

// Intenta partir por marcadores de número de factura dentro del texto combinado.
function partirPorMarcadores(
  texto: string,
  plantillaResolver?: (nifEmisor: string) => PlantillaNif | null,
): ExtractedFactura[] {
  // Localizar todas las posiciones donde empieza un "Factura nº ..."
  const indices: number[] = []
  let m: RegExpExecArray | null
  RE_INICIO_FACTURA.lastIndex = 0
  while ((m = RE_INICIO_FACTURA.exec(texto)) !== null) {
    indices.push(m.index)
    if (indices.length > 200) break // tope de seguridad
  }
  // Menos de 2 marcadores → no hay multi-factura por esta vía.
  if (indices.length < 2) return []

  const out: ExtractedFactura[] = []
  for (let i = 0; i < indices.length; i++) {
    const ini = indices[i]
    const fin = i + 1 < indices.length ? indices[i + 1] : texto.length
    const segmento = texto.slice(ini, fin)
    if (!pdfTieneTexto(segmento)) continue
    const f = extraerPorReglas(segmento, plantillaResolver)
    if (f && f.total > 0) out.push(f)
  }
  return dedupeFacturas(out)
}

// ¿El número de factura leído es PLAUSIBLE (un ref real) y no basura de una página
// de continuación? Un recibo multipágina (p.ej. Octopus) hace que las páginas 2..n
// se lean como facturas falsas con número "Periodo", "Fecha", vacío, etc. Exigir un
// número plausible evita trocear una única factura en varias.
const PALABRAS_CABECERA_NO_NUMERO = new Set([
  'periodo', 'fecha', 'total', 'factura', 'cliente', 'importe', 'base', 'iva',
  'numero', 'número', 'num', 'nº', 'serie', 'pagina', 'página', 'subtotal',
])
function numeroFacturaPlausible(numero: string | null | undefined): boolean {
  if (!numero) return false
  const n = numero.trim()
  if (n.length < 4) return false
  if (!/\d/.test(n)) return false // un ref de factura real lleva al menos un dígito
  if (PALABRAS_CABECERA_NO_NUMERO.has(n.toLowerCase())) return false
  return true
}

// Punto de entrada del partido multi-factura.
// Devuelve [] si no detecta multi (0 o 1 factura) → el flujo normal sigue igual.
// Devuelve ≥2 ExtractedFactura si detecta varias facturas distintas en el PDF.
export function partirEnFacturas(
  textoCombinado: string,
  paginas: string[],
  plantillaResolver?: (nifEmisor: string) => PlantillaNif | null,
): ExtractedFactura[] {
  // EXCEPCIÓN PLATAFORMAS: los PDF de Glovo/Uber/Just Eat traen UNA sola factura
  // aunque incluyan después una tabla de detalle de pedidos (Glovo pág. 2). NUNCA
  // se parten: si no, el separador cree que cada línea de pedido es una factura y
  // lee mal (número "courier", importe de la línea "Productos", sin NIF). Se deja
  // que el flujo normal lea la factura completa (reglas o Mistral).
  if (textoEsPlataformaNoPartir(textoCombinado)) return []

  // A) Por páginas (una factura por página).
  const porPaginas = partirPorPaginas(paginas, plantillaResolver)
  // B) Por marcadores dentro del texto combinado.
  const porMarcadores = partirPorMarcadores(textoCombinado, plantillaResolver)

  // Elegir la pasada que más facturas distintas válidas haya encontrado.
  const mejor = porPaginas.length >= porMarcadores.length ? porPaginas : porMarcadores

  // CONSERVADOR: solo se considera multi-factura si hay ≥2 facturas con número
  // PLAUSIBLE y distinto entre sí. Esto:
  //  - evita partir una recapitulativa con subtotales repetidos, y
  //  - evita trocear una única factura multipágina (Octopus, etc.) donde las
  //    páginas de continuación se leen como facturas falsas con número
  //    "Periodo"/vacío.
  if (mejor.length < 2) return []
  const plausibles = mejor.filter((f) => numeroFacturaPlausible(f.numero_factura))
  const numerosPlausibles = new Set(plausibles.map((f) => (f.numero_factura || '').toUpperCase()))
  if (plausibles.length < 2 || numerosPlausibles.size < 2) return []

  // Devolver SOLO las sub-facturas con número plausible: nunca se crean entradas
  // basura de páginas de continuación.
  return plausibles
}
