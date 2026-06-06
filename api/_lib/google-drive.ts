// google-drive v3 — + descarga por ID para reprocesador (0 API) + borrado por ID
// + archivado legible: las facturas que llegan como HTML/.txt (Just Eat) se
//   convierten a un PDF legible antes de archivarlas, para que el clip muestre
//   la factura y no el código crudo.
import { google, drive_v3 } from 'googleapis'
import { Readable } from 'stream'
import { mimeTypeParaExtension } from './detectarTipo.js'
import { getOAuthClient, tieneDriveConectado } from './google-oauth.js'
import { pareceHtml, htmlATexto } from './extractores.js'
import { jsPDF } from 'jspdf'

type DriveExtracted = {
  proveedor_nombre: string
  numero_factura?: string
  fecha_factura: string
  tipo: 'proveedor' | 'plataforma'
  plataforma?: 'uber' | 'glovo' | 'just_eat' | null
  carpeta_titular?: string
}

const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '1dB6REknvNI8JxGGuv8MXloUCJ3_evd7H'
const SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || ''

async function getDriveGlobal(): Promise<drive_v3.Drive> {
  const oauthStatus = await tieneDriveConectado()
  if (oauthStatus.conectado) {
    const auth = await getOAuthClient()
    return google.drive({ version: 'v3', auth })
  }

  if (SERVICE_ACCOUNT_JSON) {
    let credentials: { client_email: string; private_key: string }
    try {
      credentials = JSON.parse(SERVICE_ACCOUNT_JSON)
    } catch {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON no es JSON válido')
    }
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/drive'],
    })
    await auth.authorize()
    return google.drive({ version: 'v3', auth })
  }

  throw new Error('Drive no configurado. Conecta Google Drive en Integraciones.')
}

async function getOrCreateFolder(drive: drive_v3.Drive, name: string, parentId: string | null): Promise<string> {
  const safeName = name.replace(/'/g, "\\'")
  const listQ = parentId
    ? `name='${safeName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    : `name='${safeName}' and 'root' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const { data } = await drive.files.list({
    q: listQ,
    fields: 'files(id)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  if (data.files?.[0]?.id) return data.files[0].id
  const { data: created } = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    },
    fields: 'id',
    supportsAllDrives: true,
  })
  return created.id!
}

function trimestre(fecha: Date): string {
  const m = fecha.getMonth()
  if (m < 3) return '1T'
  if (m < 6) return '2T'
  if (m < 9) return '3T'
  return '4T'
}

const MESES = [
  '01 ENERO', '02 FEBRERO', '03 MARZO', '04 ABRIL', '05 MAYO', '06 JUNIO',
  '07 JULIO', '08 AGOSTO', '09 SEPTIEMBRE', '10 OCTUBRE', '11 NOVIEMBRE', '12 DICIEMBRE',
]

// F10: slug preserva espacios como guiones bajos y NO elimina tildes del texto
function slug(s: string): string {
  return (s || '')
    .replace(/[^a-zA-Z0-9\u00C0-\u024F\s]+/g, '')
    .replace(/\s+/g, '_')
    .trim()
    || 'SinNombre'
}

export function generarNombreArchivo(extracted: DriveExtracted, ext: string): string {
  const proveedor = slug(extracted.proveedor_nombre || 'Factura') || 'Factura'
  const numero = slug(extracted.numero_factura || '').slice(0, 40) || 'SN'
  const fecha = (extracted.fecha_factura || '').slice(0, 10) || 'sin-fecha'
  const extClean = ext.replace(/^\./, '').toLowerCase() || 'bin'
  return `${proveedor}_${numero}_${fecha}.${extClean}`
}

// Genera un PDF A4 legible (multipágina) a partir de texto plano. Se usa para
// archivar como documento legible las facturas que llegan en HTML/.txt (Just
// Eat), de modo que al pinchar el clip se vea la factura y no el código crudo.
function textoLegibleAPdf(texto: string, datos: DriveExtracted): Buffer {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 40
  const ancho = doc.internal.pageSize.getWidth() - margin * 2
  const alto = doc.internal.pageSize.getHeight() - margin
  let y = margin
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  const cab = [datos.proveedor_nombre, datos.numero_factura, datos.fecha_factura]
    .filter(Boolean).join('   ·   ') || 'Factura'
  for (const l of doc.splitTextToSize(cab, ancho)) { doc.text(l, margin, y); y += 16 }
  y += 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  for (const l of doc.splitTextToSize(texto, ancho)) {
    if (y > alto) { doc.addPage(); y = margin }
    doc.text(l, margin, y)
    y += 13
  }
  return Buffer.from(doc.output('arraybuffer'))
}

export async function subirArchivoADrive(
  buffer: Buffer,
  nombre: string,
  extracted: DriveExtracted,
  ext: string,
): Promise<{ id: string; webViewLink: string | null }> {
  const drive = await getDriveGlobal()

  // Just Eat y similares llegan como .txt/.html/.eml con el HTML de la factura
  // dentro. Se convierte a un PDF legible y se archiva el PDF (no el crudo).
  // Si la conversión falla, se sube el archivo original sin romper el flujo.
  const extBaja = (ext || '').replace(/^\./, '').toLowerCase()
  if (['txt', 'html', 'htm', 'eml'].includes(extBaja)) {
    try {
      const crudo = buffer.toString('utf-8')
      const legible = pareceHtml(crudo) ? htmlATexto(crudo) : crudo
      if (legible && legible.trim().length > 0) {
        buffer = textoLegibleAPdf(legible, extracted)
        nombre = nombre.replace(/\.[a-z0-9]+$/i, '') + '.pdf'
        ext = 'pdf'
      }
    } catch { /* se sube el original */ }
  }

  const fecha = new Date(extracted.fecha_factura)
  const año = String(fecha.getFullYear())
  const tri = trimestre(fecha)
  const mes = MESES[fecha.getMonth()]
  const carpetaTipo = extracted.tipo === 'plataforma' ? 'PLATAFORMAS' : 'PROVEEDORES'
  const rawTitular = extracted.carpeta_titular || 'SIN_TITULAR'
  const carpetaTitular = rawTitular
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()

  const anclaId: string | null = ROOT_FOLDER_ID || null
  let folderId: string
  if (anclaId) {
    folderId = anclaId
  } else {
    folderId = await getOrCreateFolder(drive, 'STREATLAB_FACTURAS', null)
  }
  for (const nivel of [carpetaTitular, año, tri, mes, carpetaTipo]) {
    folderId = await getOrCreateFolder(drive, nivel, folderId)
  }

  const mimeType = mimeTypeParaExtension(ext)
  const { data: uploaded } = await drive.files.create({
    requestBody: {
      name: nombre,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  })

  return { id: uploaded.id!, webViewLink: uploaded.webViewLink || null }
}

// Descarga el contenido de un archivo de Drive por su ID. Usado por el
// reprocesador para re-leer PDFs ya subidos sin pedir nada al usuario. 0 API.
export async function descargarArchivoDeDrive(fileId: string): Promise<Buffer> {
  const drive = await getDriveGlobal()
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' },
  )
  return Buffer.from(res.data as ArrayBuffer)
}

// Borra (envía a la papelera) un archivo de Drive por su ID. Usado al eliminar
// una factura desde el ERP cuando el usuario confirma que quiere borrar también
// la copia en Drive. Best-effort: si el archivo ya no existe, no lanza error.
export async function borrarArchivoDeDrive(fileId: string): Promise<{ ok: boolean; error?: string }> {
  if (!fileId) return { ok: false, error: 'sin fileId' }
  try {
    const drive = await getDriveGlobal()
    // trashed=true envía a la papelera de Drive (recuperable 30 días),
    // más seguro que el borrado permanente.
    await drive.files.update({ fileId, requestBody: { trashed: true }, supportsAllDrives: true })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function subirPdfADrive(
  buffer: Buffer,
  nombre: string,
  extracted: DriveExtracted,
): Promise<{ id: string; webViewLink: string | null }> {
  const extMatch = nombre.match(/\.([a-z0-9]+)$/i)
  const ext = extMatch ? extMatch[1] : 'pdf'
  return subirArchivoADrive(buffer, nombre, extracted, ext)
}
