// google-drive v3 — + descarga por ID para reprocesador (0 API) + borrado por ID
// + archivado legible: las facturas que llegan como HTML/.txt (Just Eat) se
//   convierten a un PDF legible antes de archivarlas, para que el clip muestre
//   la factura y no el código crudo.
// + RED DE SEGURIDAD (cero pérdida): cada documento se copia SIEMPRE al bucket
//   de Storage 'facturas' (infra propia) antes de subirse a Drive, y la subida
//   a Drive se reintenta. Así ningún documento puede perderse aunque Drive falle.
//   Además se registra en archivo_respaldo para que el barrido de repesca lo
//   suba a Drive una y otra vez hasta lograrlo (siempre acaba en Drive).
// + restaurar/listar papelera, para recuperar documentos borrados.
import { google, drive_v3 } from 'googleapis'
import { Readable } from 'stream'
import { createHash } from 'crypto'
import { mimeTypeParaExtension } from './detectarTipo.js'
import { getOAuthClient, tieneDriveConectado } from './google-oauth.js'
import { pareceHtml, htmlATexto } from './extractores.js'
import { supabaseAdmin } from './supabase-admin.js'
import { jsPDF } from 'jspdf'

const STORAGE_BUCKET = 'facturas'

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

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

// Niveles de carpeta (TITULAR/AÑO/T/MES/TIPO) que comparten Drive y Storage.
function nivelesCarpeta(extracted: DriveExtracted): string[] {
  const fecha = new Date(extracted.fecha_factura)
  const año = String(fecha.getFullYear())
  const tri = trimestre(fecha)
  const mes = MESES[fecha.getMonth()]
  const carpetaTipo = extracted.tipo === 'plataforma' ? 'PLATAFORMAS' : 'PROVEEDORES'
  const carpetaTitular = (extracted.carpeta_titular || 'SIN_TITULAR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
  return [carpetaTitular, año, tri, mes, carpetaTipo]
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

// Copia de seguridad en Storage propio. Es la garantía de "cero pérdida":
// pase lo que pase con Drive, el original queda guardado aquí al instante.
async function guardarRespaldoStorage(path: string, buffer: Buffer, mimeType: string): Promise<boolean> {
  // 6 intentos con espera creciente: el respaldo en Storage es la garantía de
  // "cero pérdida" (de él tira la repesca). En lotes grandes el Storage puede dar
  // errores transitorios (503/timeout); insistir evita que un documento se quede
  // sin respaldo y, por tanto, sin vía de recuperación.
  for (let intento = 1; intento <= 6; intento++) {
    try {
      const { error } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .upload(path, buffer, { contentType: mimeType, upsert: true })
      if (!error) return true
    } catch { /* reintentar */ }
    await sleep(Math.min(400 * intento, 2000))
  }
  return false
}

// Sube un buffer a Drive (con reintentos) dentro de la carpeta indicada.
async function subirBufferAFolder(
  drive: drive_v3.Drive,
  folderId: string,
  nombre: string,
  mimeType: string,
  buffer: Buffer,
): Promise<{ id: string | null; webViewLink: string | null }> {
  let driveId: string | null = null
  let webViewLink: string | null = null
  for (let intento = 1; intento <= 6; intento++) {
    try {
      const { data: uploaded } = await drive.files.create({
        requestBody: { name: nombre, parents: [folderId] },
        media: { mimeType, body: Readable.from(buffer) },
        fields: 'id, webViewLink',
        supportsAllDrives: true,
      })
      driveId = uploaded.id || null
      webViewLink = uploaded.webViewLink || null
      if (driveId) break
    } catch {
      if (intento < 6) await sleep(intento * 800)
    }
  }
  return { id: driveId, webViewLink }
}

// Crea (si hace falta) la cadena de carpetas dada por 'niveles' bajo la raíz.
async function carpetaDestino(drive: drive_v3.Drive, niveles: string[]): Promise<string> {
  let folderId: string = ROOT_FOLDER_ID
    ? ROOT_FOLDER_ID
    : await getOrCreateFolder(drive, 'STREATLAB_FACTURAS', null)
  for (const nivel of niveles) {
    if (!nivel) continue
    folderId = await getOrCreateFolder(drive, nivel, folderId)
  }
  return folderId
}

export async function subirArchivoADrive(
  buffer: Buffer,
  nombre: string,
  extracted: DriveExtracted,
  ext: string,
): Promise<{ id: string; webViewLink: string | null; storagePath: string; driveOk: boolean }> {
  // Hash del documento TAL Y COMO LLEGA (antes de cualquier conversión). Coincide
  // con el pdf_hash que calcula procesarArchivo, para poder vincular la repesca
  // con su factura.
  const hashEntrada = createHash('sha256').update(buffer).digest('hex')

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

  const niveles = nivelesCarpeta(extracted)
  const mimeType = mimeTypeParaExtension(ext)
  const storagePath = [...niveles, nombre].join('/')

  // ── RED DE SEGURIDAD: respaldo en Storage propio ANTES de tocar Drive ──────
  // Si esto falla, no damos el documento por archivado: se lanza error para que
  // el flujo lo marque y se reintente, nunca se pierde en silencio.
  const respaldoOk = await guardarRespaldoStorage(storagePath, buffer, mimeType)
  if (!respaldoOk) {
    throw new Error('No se pudo respaldar el documento en Storage (no se archiva sin copia segura).')
  }

  // Registro de repesca INMEDIATO (drive_id=null), ANTES de tocar Drive. Clave para
  // "cero pérdida": si Drive está desconectado (getDriveGlobal/upload lanza), la fila
  // ya existe y el barrido archivar-pendientes encontrará el documento y lo subirá.
  // Antes el registro iba después de subir a Drive: si Drive fallaba, no quedaba
  // constancia y la repesca nunca veía el documento.
  try {
    await supabaseAdmin
      .from('archivo_respaldo')
      .upsert(
        {
          hash: hashEntrada,
          storage_path: storagePath,
          drive_id: null,
          nombre,
          actualizado: new Date().toISOString(),
        },
        { onConflict: 'storage_path' },
      )
  } catch { /* el registro de repesca nunca rompe el archivado */ }

  // ── Drive con reintentos (hasta 6 en el momento, con espera creciente) ─────
  // getDriveGlobal() va AQUÍ (no al principio): si Drive está caído lanza, pero el
  // documento ya está respaldado y registrado arriba, así que la repesca lo recupera.
  const drive = await getDriveGlobal()
  const folderId = await carpetaDestino(drive, niveles)
  const { id: driveId, webViewLink } = await subirBufferAFolder(drive, folderId, nombre, mimeType, buffer)

  // Drive OK: completar la fila de repesca con el drive_id real.
  if (driveId) {
    try {
      await supabaseAdmin
        .from('archivo_respaldo')
        .update({ drive_id: driveId, actualizado: new Date().toISOString() })
        .eq('storage_path', storagePath)
    } catch { /* el registro de repesca nunca rompe el archivado */ }
  }

  // Aunque Drive haya fallado los 6 intentos, el original está a salvo en
  // Storage y registrado en archivo_respaldo. La repesca lo subirá a Drive. El
  // documento NO se pierde y acaba SIEMPRE en Drive (en el momento o por repesca).
  return { id: driveId || '', webViewLink, storagePath, driveOk: !!driveId }
}

// Repesca: sube a Drive un documento que está en el respaldo de Storage (porque
// en su momento Drive falló). Reconstruye la carpeta a partir de la ruta de
// Storage. Devuelve el id de Drive o null si no se pudo (se reintentará luego).
export async function subirRespaldoADrive(
  storagePath: string,
): Promise<{ id: string; webViewLink: string | null } | null> {
  const buffer = await descargarRespaldoStorage(storagePath)
  if (!buffer) return null
  const drive = await getDriveGlobal()
  const partes = storagePath.split('/')
  const nombre = partes[partes.length - 1] || 'documento'
  const niveles = partes.slice(0, -1)
  const extMatch = nombre.match(/\.([a-z0-9]+)$/i)
  const mimeType = mimeTypeParaExtension(extMatch ? extMatch[1] : 'pdf')
  const folderId = await carpetaDestino(drive, niveles)
  const { id, webViewLink } = await subirBufferAFolder(drive, folderId, nombre, mimeType, buffer)
  if (!id) return null
  return { id, webViewLink }
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

// Descarga el contenido de un objeto del respaldo de Storage por su ruta.
export async function descargarRespaldoStorage(path: string): Promise<Buffer | null> {
  try {
    const { data, error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).download(path)
    if (error || !data) return null
    const ab = await data.arrayBuffer()
    return Buffer.from(ab)
  } catch {
    return null
  }
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

// Restaura un archivo de la papelera de Drive (trashed=false). Para recuperar
// documentos borrados por error.
export async function restaurarArchivoDeDrive(fileId: string): Promise<{ ok: boolean; error?: string }> {
  if (!fileId) return { ok: false, error: 'sin fileId' }
  try {
    const drive = await getDriveGlobal()
    await drive.files.update({ fileId, requestBody: { trashed: false }, supportsAllDrives: true })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// Borra PERMANENTEMENTE un archivo de Drive (no recuperable). Se usa tras
// recrear una factura desde un original de la papelera: el contenido ya quedó
// archivado de nuevo (Storage + copia en Drive), así que el original duplicado
// de la papelera ya no hace falta y se elimina para no dejar duplicados.
export async function borrarArchivoPermanente(fileId: string): Promise<{ ok: boolean; error?: string }> {
  if (!fileId) return { ok: false, error: 'sin fileId' }
  try {
    const drive = await getDriveGlobal()
    await drive.files.delete({ fileId, supportsAllDrives: true })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// Lista archivos que están en la papelera de Drive y fueron ENVIADOS A LA
// PAPELERA después de 'desdeISO'. Importante: se filtra por trashedTime (cuándo
// se mandó a la papelera), NO por modifiedTime, porque borrar un archivo no
// cambia su fecha de modificación. Pagina la papelera y filtra en memoria.
export async function listarPapeleraReciente(
  desdeISO: string,
  limit = 100,
): Promise<{ id: string; name: string; size: number }[]> {
  const drive = await getDriveGlobal()
  const desdeMs = Date.parse(desdeISO) || 0
  const out: { id: string; name: string; size: number }[] = []
  let pageToken: string | undefined = undefined

  for (let pagina = 0; pagina < 30 && out.length < limit; pagina++) {
    const { data }: { data: drive_v3.Schema$FileList } = await drive.files.list({
      q: `trashed=true and mimeType!='application/vnd.google-apps.folder'`,
      fields: 'nextPageToken, files(id,name,size,trashedTime)',
      pageSize: 1000,
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageToken,
    })
    for (const f of data.files || []) {
      const tt = f.trashedTime ? Date.parse(f.trashedTime) : 0
      if (tt >= desdeMs) {
        out.push({ id: f.id as string, name: (f.name as string) || '', size: Number(f.size || 0) })
        if (out.length >= limit) break
      }
    }
    pageToken = data.nextPageToken || undefined
    if (!pageToken) break
  }
  return out
}

export async function subirPdfADrive(
  buffer: Buffer,
  nombre: string,
  extracted: DriveExtracted,
): Promise<{ id: string; webViewLink: string | null }> {
  const extMatch = nombre.match(/\.([a-z0-9]+)$/i)
  const ext = extMatch ? extMatch[1] : 'pdf'
  const r = await subirArchivoADrive(buffer, nombre, extracted, ext)
  return { id: r.id, webViewLink: r.webViewLink }
}
