/**
 * Impresión remota — "Enviar al local" (LEY-IMPRESION-EMAIL, docs/HANDOFF_IMPRESION_CODE.md §2).
 * Recibe el PDF generado en el cliente (base64) y lo manda por Brevo a la Epson
 * de la cocina. El adjunto es OBLIGATORIO: sin PDF la Epson devuelve error.
 * Remitente obligatorio: direccion@streatlab.com. Registra cada intento en
 * impresion_envios. Único punto del backend que habla con Brevo.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'
const REMITENTE = { name: 'Streat Lab ERP', email: 'direccion@streatlab.com' }
const DESTINO_EPSON = 'ellosson@print.epsonconnect.com'

let brevoKeyCache: string | null = null

/** API key de Brevo: env var → Vault (fn_secreto_brevo) → robot_credenciales. */
async function cargarBrevoKey(): Promise<string> {
  if (brevoKeyCache) return brevoKeyCache
  let key = process.env.BREVO_API_KEY || ''
  if (!key) {
    const { data } = await supabaseAdmin.rpc('fn_secreto_brevo')
    key = (data as string | null) || ''
  }
  if (!key) {
    const { data } = await supabaseAdmin
      .from('robot_credenciales')
      .select('password')
      .eq('plataforma', 'brevo')
      .eq('activo', true)
      .limit(1)
      .maybeSingle()
    key = data?.password || ''
  }
  brevoKeyCache = key
  return key
}

async function fetchTimeout(url: string, opts: RequestInit = {}, ms = 20000): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

interface BodyImprimir {
  documentoId?: string
  nombre?: string
  pdfBase64?: string
  nombreArchivo?: string
  copias?: number
  usuario?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' })

  const body = (req.body || {}) as BodyImprimir
  const documentoId = (body.documentoId || '').trim()
  const nombre = (body.nombre || documentoId || 'Documento ERP').trim()
  const pdfBase64 = (body.pdfBase64 || '').replace(/^data:application\/pdf(;filename=[^;]*)?;base64,/, '')
  const nombreArchivo = (body.nombreArchivo || 'documento.pdf').trim()
  const copias = Math.min(Math.max(Number(body.copias) || 1, 1), 10)
  const usuario = (body.usuario || '').trim() || null

  const registrar = async (estado: 'enviado' | 'error', messageId: string | null, error: string | null) => {
    await supabaseAdmin.from('impresion_envios').insert({
      documento_id: documentoId || 'desconocido',
      destino: 'local',
      estado,
      message_id: messageId,
      error,
      usuario,
    })
  }

  if (!documentoId) return res.status(400).json({ ok: false, error: 'Falta documentoId' })
  if (!pdfBase64) {
    // La Epson no imprime sin adjunto: rechazar antes de llamar a Brevo.
    await registrar('error', null, 'Sin PDF adjunto (obligatorio para Epson)')
    return res.status(400).json({ ok: false, error: 'Falta pdfBase64: el adjunto es obligatorio' })
  }

  const apiKey = await cargarBrevoKey()
  if (!apiKey) {
    await registrar('error', null, 'Brevo no configurado (sin key en env, Vault brevo_api_key ni robot_credenciales)')
    return res.status(500).json({ ok: false, error: 'Brevo no configurado: falta la API key (Vault brevo_api_key o env BREVO_API_KEY)' })
  }

  // N copias = mismo PDF adjunto N veces (Epson Connect imprime cada adjunto).
  const base = nombreArchivo.replace(/\.pdf$/i, '')
  const attachment = Array.from({ length: copias }, (_, i) => ({
    content: pdfBase64,
    name: copias === 1 ? `${base}.pdf` : `${base}-copia-${i + 1}.pdf`,
  }))

  try {
    const r = await fetchTimeout(BREVO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({
        sender: REMITENTE,
        to: [{ email: DESTINO_EPSON }],
        subject: nombre,
        textContent: `Impresión ERP Streat Lab · ${nombre}`,
        attachment,
      }),
    })
    const json = (await r.json().catch(() => ({}))) as { messageId?: string; message?: string; code?: string }
    if (r.status === 201 && json.messageId) {
      await registrar('enviado', json.messageId, null)
      return res.status(200).json({ ok: true, messageId: json.messageId })
    }
    const motivo = `Brevo ${r.status}: ${json.message || json.code || 'respuesta inesperada'}`
    await registrar('error', json.messageId || null, motivo)
    return res.status(502).json({ ok: false, error: motivo })
  } catch (err) {
    const e = err as Error
    const motivo = e.name === 'AbortError' ? 'Brevo sin respuesta en 20s' : e.message
    await registrar('error', null, motivo)
    return res.status(502).json({ ok: false, error: motivo })
  }
}
