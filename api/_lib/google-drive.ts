import { google, drive_v3 } from 'googleapis'
import { Readable } from 'stream'
import { mimeTypeParaExtension } from './detectarTipo.js'
import { getOAuthClient } from './google-oauth.js'

type DriveExtracted = {
  proveedor_nombre: string
  numero_factura?: string
  fecha_factura: string
  tipo: 'proveedor' | 'plataforma' | 'otro'
  plataforma?: 'uber' | 'glovo' | 'just_eat' | null
  carpeta_titular?: string
  titular_id?: string | null
}

const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || ''

/**
 * Devuelve un cliente Drive autenticado via OAuth del titular.
 * Si titular_id es null, usa el OAuth unificado. Si nadie ha conectado Drive,
 * propaga el error de getOAuthClient con mensaje accionable.
 */
async function getDriveForTitular(titularId: string | null): Promise<drive_v3.Drive> {
  const auth = await getOAuthClient(titularId)
  return google.drive({ version: 'v3', auth })
}

async function getOrCreateFolder(drive: drive_v3.Drive, name: string, parentId: string | null): Promise<string> {
  const safeName = name.replace(/'/g, "\\'")
  const listQ = parentId
    ? `name='${safeName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    : `name='${safeName}' and 'root' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const { data } = await drive.files.list({
    q: listQ,
    fields: 'files(id)',
  })
  if (data.files?.[0]?.id) return data.files[0].id
  const { data: created } = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    },
    fields: 'id',
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
  const titularId = extracted.titular_id || null
  const drive = await getDriveForTitular(titularId)

  const fecha = new Date(extracted.fecha_factura)
  const año = String(fecha.getFullYear())
  const tri = trimestre(fecha)
  const mes = MESES[fecha.getMonth()]
  const carpetaTipo = extracted.tipo === 'plataforma' ? 'PLATAFORMAS' : 'PROVEEDORES'
  const carpetaTitular = extracted.carpeta_titular || 'SIN_TITULAR'

  // Estructura: {raíz configurable}/STREATLAB_FACTURAS/{TITULAR}/{año}/{trimestre}/{mes}/{tipo}/archivo
  // Si hay ROOT_FOLDER_ID y el user lo comparte, se usa como ancla. Si no, se crea en root.
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
