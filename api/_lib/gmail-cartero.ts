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
//
// 0 coste: IMAP de Gmail es gratis; el OCR posterior es local.
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
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

function esAdjuntoFactura(nombre: string, mime: string): boolean {
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
          if (!esAdjuntoFactura(nombre, mime)) continue
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
