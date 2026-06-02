// gmail-cartero.ts — Cartero de facturas por correo.
// Lee el buzón de la cuenta Google conectada (mismo token OAuth que Drive, con
// scope gmail.readonly/modify) y devuelve los adjuntos de facturas listos para
// pasar por el motor de OCR (procesarArchivo).
//
// Estrategia de barrido: mensajes con adjunto, no procesados todavía. Para no
// reprocesar, tras procesar cada mensaje se le pone la etiqueta FACTURA_OCR_OK
// (se crea si no existe) y se quita UNREAD. Así el barrido es idempotente aunque
// se lance varias veces.
//
// 0 coste: Gmail API es gratis. El coste (si lo hay) es el del OCR posterior,
// que solo se invoca si el lector por reglas no resuelve.
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
 * Recoge adjuntos de factura del buzón.
 * @param query  Filtro Gmail. Por defecto: con adjunto, no etiquetados como OK.
 * @param maxMensajes  Tope por barrido (evita timeouts).
 */
export async function recogerFacturasDelCorreo(
  query = `has:attachment -label:${LABEL_OK}`,
  maxMensajes = 25,
): Promise<CarteroResultado> {
  const auth = (await getOAuthClient()) as OAuth2Client
  const gmail = google.gmail({ version: 'v1', auth })

  const labelId = await asegurarLabel(gmail)

  const lista = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: maxMensajes,
  })

  const mensajes = lista.data.messages || []
  const adjuntos: AdjuntoCorreo[] = []

  for (const m of mensajes) {
    if (!m.id) continue
    const full = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'full' })
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
          messageId: m.id,
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
          messageId: m.id,
          remitente,
          asunto,
        })
      } catch {
        // adjunto que falla: se ignora, el mensaje no se marca OK y se reintenta
      }
    }
  }

  return { adjuntos, mensajesRevisados: mensajes.length, labelId, gmail }
}

/**
 * Marca un mensaje como procesado: pone la etiqueta OK y quita UNREAD.
 * Best-effort: si falla, no rompe nada (se reintentará en el próximo barrido).
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
        removeLabelIds: ['UNREAD'],
      },
    })
  } catch {
    /* best-effort */
  }
}
