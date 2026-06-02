// gmail-cartero.ts — Cartero de facturas por correo.
// Lee el buzón de la cuenta Google conectada (mismo token OAuth que Drive, con
// scope gmail.readonly/modify) y devuelve los adjuntos de facturas listos para
// pasar por el motor de OCR (procesarArchivo).
//
// Estrategia de barrido (definida con Rubén):
//   - SIN LÍMITE: recorre TODO el buzón por páginas hasta vaciarlo (los lunes de
//     Uber pueden llegar 100-200 facturas; no se deja ninguna).
//   - NO RELEE lo ya hecho: el filtro excluye lo etiquetado FACTURA_OCR_OK, y
//     cada mensaje procesado se etiqueta Y se saca de INBOX (equivale a moverlo
//     a "Procesadas"), así no se vuelve a coger aunque siga en la cuenta.
//   - NO DUPLICA EN ORIGEN: el motor de facturas deduplica por hash de archivo
//     (mismo PDF exacto) y marca posible_duplicado lógico (mismo nº+NIF+total),
//     así un adjunto que llega por Uber y además reenviado no se cuenta dos veces.
//
// 0 coste: Gmail API es gratis. El OCR posterior es local (reglas + Tesseract).
import { google } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'
import { getOAuthClient } from './google-oauth.js'

export interface AdjuntoCorreo {
  nombre: string
  buffer: Buffer
  mimeType: string | null
  messageId: string
  remitente: string | null
  asunto: string | null
}

const LABEL_OK = 'FACTURA_OCR_OK'

// Tope de seguridad para no exceder el tiempo de la función (maxDuration 300s).
// Es alto: cubre de sobra un lunes de Uber. Si se alcanzara, el resto se recoge
// en el siguiente barrido (los ya procesados quedan etiquetados y fuera de INBOX).
const TOPE_SEGURIDAD_MENSAJES = 1000
const PAGINA = 100

// Tipos de adjunto que tienen sentido como factura.
const EXT_FACTURA = /\.(pdf|jpg|jpeg|png|webp|heic|tif|tiff|gif|bmp|eml|doc|docx|xls|xlsx)$/i
const MIME_FACTURA = /^(application\/pdf|image\/|message\/rfc822|application\/vnd|application\/msword)/i

function esAdjuntoFactura(nombre: string, mime: string): boolean {
  if (EXT_FACTURA.test(nombre)) return true
  if (MIME_FACTURA.test(mime)) return true
  return false
}

interface GmailPart {
  filename?: string
  mimeType?: string
  body?: { attachmentId?: string; data?: string; size?: number }
  parts?: GmailPart[]
}

// Recorre el árbol de partes y recoge todas las que sean adjuntos de factura.
function recogerPartes(part: GmailPart | undefined, out: GmailPart[]): void {
  if (!part) return
  if (part.filename && part.body?.attachmentId && esAdjuntoFactura(part.filename, part.mimeType || '')) {
    out.push(part)
  }
  if (part.parts) {
    for (const p of part.parts) recogerPartes(p, out)
  }
}

function leerCabecera(headers: { name?: string; value?: string }[] | undefined, nombre: string): string | null {
  if (!headers) return null
  const h = headers.find((x) => (x.name || '').toLowerCase() === nombre.toLowerCase())
  return h?.value || null
}

async function asegurarLabel(gmail: ReturnType<typeof google.gmail>): Promise<string | null> {
  try {
    const { data } = await gmail.users.labels.list({ userId: 'me' })
    const existente = (data.labels || []).find((l) => l.name === LABEL_OK)
    if (existente?.id) return existente.id
    const creada = await gmail.users.labels.create({
      userId: 'me',
      requestBody: { name: LABEL_OK, labelListVisibility: 'labelShow', messageListVisibility: 'show' },
    })
    return creada.data.id || null
  } catch {
    return null
  }
}

export interface CarteroResultado {
  adjuntos: AdjuntoCorreo[]
  mensajesRevisados: number
  labelId: string | null
  gmail: ReturnType<typeof google.gmail>
}

/**
 * Recoge adjuntos de factura del buzón, recorriendo TODO el buzón por páginas.
 * @param query  Filtro Gmail. Por defecto: con adjunto, no etiquetados como OK.
 * @param _maxIgnorado  Compat: se ignora; el barrido es completo (con tope de seguridad).
 */
export async function recogerFacturasDelCorreo(
  query = `has:attachment -label:${LABEL_OK}`,
  _maxIgnorado?: number,
): Promise<CarteroResultado> {
  const auth = (await getOAuthClient()) as OAuth2Client
  const gmail = google.gmail({ version: 'v1', auth })

  const labelId = await asegurarLabel(gmail)

  // 1) Listar TODOS los mensajes que cumplen el filtro, paginando con pageToken.
  const idsMensajes: string[] = []
  let pageToken: string | undefined = undefined
  do {
    const lista = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: PAGINA,
      pageToken,
    })
    for (const m of lista.data.messages || []) {
      if (m.id) idsMensajes.push(m.id)
    }
    pageToken = lista.data.nextPageToken || undefined
    if (idsMensajes.length >= TOPE_SEGURIDAD_MENSAJES) break
  } while (pageToken)

  // 2) Descargar adjuntos de cada mensaje.
  const adjuntos: AdjuntoCorreo[] = []
  for (const id of idsMensajes) {
    const full = await gmail.users.messages.get({ userId: 'me', id, format: 'full' })
    const payload = full.data.payload as GmailPart | undefined
    const headers = (full.data.payload?.headers || []) as { name?: string; value?: string }[]
    const remitente = leerCabecera(headers, 'From')
    const asunto = leerCabecera(headers, 'Subject')

    const partes: GmailPart[] = []
    recogerPartes(payload, partes)

    for (const p of partes) {
      if (!p.body?.attachmentId || !p.filename) continue
      try {
        const att = await gmail.users.messages.attachments.get({
          userId: 'me',
          messageId: id,
          id: p.body.attachmentId,
        })
        const dataB64 = att.data.data
        if (!dataB64) continue
        // Gmail devuelve base64url
        const buffer = Buffer.from(dataB64, 'base64url')
        adjuntos.push({
          nombre: p.filename,
          buffer,
          mimeType: p.mimeType || null,
          messageId: id,
          remitente,
          asunto,
        })
      } catch {
        // adjunto que falla: se ignora, el mensaje no se marca OK y se reintenta
      }
    }
  }

  return { adjuntos, mensajesRevisados: idsMensajes.length, labelId, gmail }
}

/**
 * Marca un mensaje como procesado: pone la etiqueta OK y lo saca de INBOX y de
 * UNREAD (equivale a moverlo a "Procesadas"). Así no se vuelve a barrer aunque
 * el correo siga en la cuenta. Best-effort: si falla, se reintenta en el próximo
 * barrido (no queda etiquetado).
 */
export async function marcarMensajeProcesado(
  gmail: ReturnType<typeof google.gmail>,
  messageId: string,
  labelId: string | null,
): Promise<void> {
  try {
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: labelId ? [labelId] : [],
        removeLabelIds: ['UNREAD', 'INBOX'],
      },
    })
  } catch {
    /* best-effort */
  }
}
