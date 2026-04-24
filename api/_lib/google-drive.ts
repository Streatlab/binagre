import { google } from 'googleapis'
import { Readable } from 'stream'

type DriveExtracted = {
  proveedor_nombre: string
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

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export async function generarNombreArchivo(
  extracted: DriveExtracted,
  countMesProveedor: number,
): Promise<string> {
  const proveedor = (extracted.proveedor_nombre || 'Factura')
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
  const fecha = new Date(extracted.fecha_factura)

  if (extracted.tipo === 'plataforma') {
    const año = fecha.getFullYear()
    const mes = String(fecha.getMonth() + 1).padStart(2, '0')
    if (extracted.plataforma === 'uber') {
      const semana = getISOWeek(fecha)
      return `Uber_${año}-${mes}-W${String(semana).padStart(2, '0')}.pdf`
    }
    return `${proveedor}_${año}-${mes}.pdf`
  }

  const seq = String(countMesProveedor + 1).padStart(3, '0')
  return `${proveedor}_${seq}.pdf`
}

export async function subirPdfADrive(
  buffer: Buffer,
  nombre: string,
  extracted: DriveExtracted,
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

  const { data: uploaded } = await drive.files.create({
    requestBody: {
      name: nombre,
      parents: [folderId],
    },
    media: {
      mimeType: 'application/pdf',
      body: Readable.from(buffer),
    },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  })

  return { id: uploaded.id!, webViewLink: uploaded.webViewLink || null }
}
