// gmail-cartero.ts — Cartero de facturas por correo (IMAP).
// Lee el buzón facturasstreat@gmail.com por IMAP con contraseña de aplicación
// (tabla cartero_credenciales). Independiente del conector OAuth de Drive.
//
// Estrategia (definida con Rubén):
//   - SIN LÍMITE: recorre TODO lo no procesado.
//   - NO RELEE: cada mensaje tratado se marca \Seen y se MUEVE a la carpeta
//     "Procesadas" del propio Gmail, así nunca se vuelve a coger.
//   - NO DUPLICA EN ORIGEN: el motor de facturas deduplica por hash de archivo
//     y marca posible_duplicado lógico (nº+NIF+total) en base de datos.
//   - NO METE FIRMAS: las imágenes embebidas del cuerpo/firma (logos, banners,
//     image001.png de Outlook) se descartan; nunca se procesan como factura.
//
// 0 coste: IMAP de Gmail es gratis; el OCR posterior es local.
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import type { Attachment } from 'mailparser'
import { supabaseAdmin } from './supabase-admin.js'

export interface AdjuntoCorreo {
  nombre: string
  buffer: Buffer
  mimeType: string | null
  messageId: string
  remitente: string | null
  asunto: string | null
}

const CARPETA_PROCESADAS = 'Procesadas'
const EXT_FACTURA = /\.(pdf|jpg|jpeg|png|webp|heic|tif|tiff|gif|bmp|eml|doc|docx|xls|xlsx)$/i
const MIME_FACTURA = /^(application\/pdf|image\/|message\/rfc822|application\/vnd|application\/msword)/i

// Imágenes embebidas de firma de correo (Outlook/Gmail) que NO son facturas.
const NOMBRE_FIRMA = /^(image|imagen|logo|icon|signature|firma|banner)[-_]?\d*\.(png|jpe?g|gif|bmp|webp)$/i
// Por debajo de este tamaño una imagen es casi siempre un logo/icono de firma.
const TAM_MIN_IMAGEN_FACTURA = 20000 // 20 KB

function esImagen(mime: string, nombre: string): boolean {
  if (mime && mime.toLowerCase().startsWith('image/')) return true
  return /\.(png|jpe?g|gif|bmp|webp|heic|tif|tiff)$/i.test(nombre || '')
}

// Devuelve true si el adjunto es una imagen de firma/decorativa (a ignorar).
function esImagenDeFirma(att: Attachment, nombre: string, mime: string): boolean {
  if (!esImagen(mime, nombre)) return false
  // 1) Embebida en el cuerpo (inline / related con Content-ID): firma o logo.
  const disp = (att.contentDisposition || '').toLowerCase()
  if (disp === 'inline') return true
  if (att.related === true) return true
  if (att.cid) return true
  // 2) Nombre típico de firma (image001.png, logo.png, banner.jpg…).
  if (NOMBRE_FIRMA.test(nombre)) return true
  // 3) Imagen diminuta: logo/icono, no una foto de factura.
  const size = typeof att.size === 'number' ? att.size : (att.content ? (att.content as Buffer).length : 0)
  if (size > 0 && size < TAM_MIN_IMAGEN_FACTURA) return true
  return false
}

function esAdjuntoFactura(att: Attachment, nombre: string, mime: string): boolean {
  // Las imágenes de firma nunca son facturas.
  if (esImagenDeFirma(att, nombre, mime)) return false
  if (nombre && EXT_FACTURA.test(nombre)) return true
  if (mime && MIME_FACTURA.test(mime)) return true
  return false
}

async function cargarCredenciales(): Promise<{ email: string; appPassword: string }> {
  const { data, error } = await supabaseAdmin
    .from('cartero_credenciales')
    .select('email, app_password')
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`No se pudieron leer las credenciales del cartero: ${error.message}`)
  if (!data?.email || !data?.app_password) {
    throw new Error('Faltan credenciales del cartero (email o contraseña de aplicación).')
  }
  // La contraseña de aplicación de Google se muestra con espacios; IMAP la quiere sin ellos.
  return { email: data.email as string, appPassword: (data.app_password as string).replace(/\s+/g, '') }
}

export interface CarteroResultado {
  adjuntos: AdjuntoCorreo[]
  mensajesRevisados: number
  // En IMAP el "marcar procesado" se hace dentro del barrido (mover a Procesadas).
  // Estos campos se mantienen por compatibilidad con el handler.
  labelId: null
  gmail: null
  // UIDs procesados con éxito, para moverlos tras el OCR.
  _mover: (messageIds: string[]) => Promise<void>
}

/**
 * Recoge adjuntos de factura del buzón por IMAP (todo lo no procesado).
 * Devuelve también un closure `_mover` para archivar los mensajes ya procesados.
 */
export async function recogerFacturasDelCorreo(
  _query?: string,
  _maxIgnorado?: number,
): Promise<CarteroResultado> {
  const { email, appPassword } = await cargarCredenciales()

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: email, pass: appPassword },
    logger: false,
  })

  await client.connect()

  // Asegurar carpeta Procesadas
  try { await client.mailboxCreate(CARPETA_PROCESADAS) } catch { /* ya existe */ }

  const adjuntos: AdjuntoCorreo[] = []
  const uidConAdjunto: number[] = []
  let revisados = 0

  const lock = await client.getMailboxLock('INBOX')
  try {
    // Todo lo de la bandeja de entrada (lo procesado ya no está aquí: se movió).
    for await (const msg of client.fetch('1:*', { uid: true, source: true, envelope: true })) {
      revisados++
      try {
        const parsed = await simpleParser(msg.source as Buffer)
        const remitente = parsed.from?.text || null
        const asunto = parsed.subject || null
        let tieneFactura = false
        for (const att of parsed.attachments || []) {
          const nombre = att.filename || 'adjunto'
          const mime = att.contentType || ''
          if (!esAdjuntoFactura(att, nombre, mime)) continue
          tieneFactura = true
          adjuntos.push({
            nombre,
            buffer: att.content as Buffer,
            mimeType: mime || null,
            messageId: String(msg.uid),
            remitente,
            asunto,
          })
        }
        if (tieneFactura) uidConAdjunto.push(msg.uid)
      } catch {
        // mensaje que no parsea: se ignora y se deja en INBOX para reintento
      }
    }
  } finally {
    lock.release()
  }

  // Closure para mover a Procesadas los UIDs procesados con éxito.
  const _mover = async (messageIds: string[]): Promise<void> => {
    const uids = messageIds.map(Number).filter((n) => Number.isFinite(n))
    if (uids.length === 0) { await client.logout(); return }
    const lock2 = await client.getMailboxLock('INBOX')
    try {
      await client.messageFlagsAdd(uids, ['\\Seen'], { uid: true })
      await client.messageMove(uids, CARPETA_PROCESADAS, { uid: true })
    } catch {
      /* best-effort: si falla, se reintenta en el próximo barrido */
    } finally {
      lock2.release()
      await client.logout()
    }
  }

  return { adjuntos, mensajesRevisados: revisados, labelId: null, gmail: null, _mover }
}

/**
 * Compat con el handler antiguo (OAuth). En IMAP no se usa: el archivado se hace
 * con el closure `_mover`. Se deja como no-op para no romper imports.
 */
export async function marcarMensajeProcesado(): Promise<void> {
  /* no-op en IMAP */
}
