export type TipoArchivo = 'pdf' | 'imagen' | 'word' | 'excel' | 'email' | 'texto'

const EXT_IMAGEN = ['jpg', 'jpeg', 'png', 'webp', 'heic']
const EXT_WORD = ['docx', 'doc']
const EXT_EXCEL = ['xlsx', 'xls']
const EXT_EMAIL = ['eml', 'msg']

const MIME_IMAGENES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
])

export function detectarTipoArchivo(filename: string, mimeType?: string | null): TipoArchivo {
  const ext = (filename.toLowerCase().split('.').pop() || '').trim()
  const mt = (mimeType || '').toLowerCase()

  if (ext === 'pdf' || mt === 'application/pdf') return 'pdf'
  if (EXT_IMAGEN.includes(ext) || MIME_IMAGENES.has(mt)) return 'imagen'
  if (EXT_WORD.includes(ext) || mt.includes('wordprocessingml') || mt === 'application/msword')
    return 'word'
  if (EXT_EXCEL.includes(ext) || mt.includes('spreadsheetml') || mt === 'application/vnd.ms-excel')
    return 'excel'
  if (EXT_EMAIL.includes(ext) || mt === 'message/rfc822' || mt === 'application/vnd.ms-outlook')
    return 'email'
  return 'texto'
}

export function mimeTypeParaExtension(ext: string): string {
  const e = ext.toLowerCase().replace(/^\./, '')
  const MAP: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    heic: 'image/heic',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    eml: 'message/rfc822',
    msg: 'application/vnd.ms-outlook',
    txt: 'text/plain',
  }
  return MAP[e] || 'application/octet-stream'
}

export function extensionDeNombre(filename: string): string {
  const part = filename.toLowerCase().split('.').pop() || ''
  return part || 'bin'
}
