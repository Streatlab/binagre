import { google } from 'googleapis'
import { Readable } from 'stream'
import { mimeTypeParaExtension } from './detectarTipo.js'

type DriveExtracted = {
  proveedor_nombre: string
  numero_factura?: string
  fecha_factura: string
  tipo: 'proveedor' | 'plataforma' | 'otro'
  plataforma?: 'uber' | 'glovo' | 'just_eat' | null
}

const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || ''

function getDrive() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!json) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON no configurado')
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(json),
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
  return google.drive({ version: 'v3', auth })
}

async function getOrCreateFolder(name: string, parentId: string): Promise<string> {
  const drive = getDrive()
  const safeName = name.replace(/'/g, "\\'")
  const { data } = await drive.files.list({
    q: `name='${safeName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  if (data.files?.[0]?.id) return data.files[0].id
  const { data: created } = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
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

function slug(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .trim()
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
  if (!ROOT_FOLDER_ID) throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID no configurado')
  const drive = getDrive()
  const fecha = new Date(extracted.fecha_factura)
  const año = String(fecha.getFullYear())
  const tri = trimestre(fecha)
  const mes = MESES[fecha.getMonth()]
  const carpetaTipo = extracted.tipo === 'plataforma' ? 'PLATAFORMAS' : 'PROVEEDORES'

  let folderId = ROOT_FOLDER_ID
  for (const nivel of [año, tri, mes, carpetaTipo]) {
    folderId = await getOrCreateFolder(nivel, folderId)
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

/**
 * Backwards-compat (upload.ts antiguo llamaba a esto con nombre que ya incluía .pdf).
 */
export async function subirPdfADrive(
  buffer: Buffer,
  nombre: string,
  extracted: DriveExtracted,
): Promise<{ id: string; webViewLink: string | null }> {
  const extMatch = nombre.match(/\.([a-z0-9]+)$/i)
  const ext = extMatch ? extMatch[1] : 'pdf'
  return subirArchivoADrive(buffer, nombre, extracted, ext)
}
