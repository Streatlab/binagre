import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import { simpleParser } from 'mailparser'

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
