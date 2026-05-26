// google-drive v2 — F10: slug preserva legibilidad con separadores
import { google, drive_v3 } from 'googleapis'
import { Readable } from 'stream'
import { mimeTypeParaExtension } from './detectarTipo.js'
import { getOAuthClient, tieneDriveConectado } from './google-oauth.js'

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
// Las tildes se quitan solo para el path/carpeta, no para el nombre legible
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

export async function subirArchivoADrive(
  buffer: Buffer,
  nombre: string,
  extracted: DriveExtracted,
  ext: string,
): Promise<{ id: string; webViewLink: string | null }> {
  const drive = await getDriveGlobal()

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

export async function subirPdfADrive(
  buffer: Buffer,
  nombre: string,
  extracted: DriveExtracted,
): Promise<{ id: string; webViewLink: string | null }> {
  const extMatch = nombre.match(/\.([a-z0-9]+)$/i)
  const ext = extMatch ? extMatch[1] : 'pdf'
  return subirArchivoADrive(buffer, nombre, extracted, ext)
}
