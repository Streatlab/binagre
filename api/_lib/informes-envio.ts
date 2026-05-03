/**
 * Despachador de envíos — WhatsApp (WAHA) y Email (Resend).
 *
 * Toma destinatarios y contenido, envía por los canales activos,
 * y registra cada envío en notif_envios.
 */
import { supabaseAdmin } from './supabase-admin.js'

const WAHA_URL = process.env.WAHA_URL || ''
const WAHA_API_KEY = process.env.WAHA_API_KEY || ''
const WAHA_SESSION = process.env.WAHA_SESSION || 'default'
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const RESEND_FROM = process.env.RESEND_FROM || 'Streat Lab <informes@streatlab.com>'

export interface EnvioResultado {
  enviados: number
  fallidos: number
  detalle: Array<{ destinatario: string; canal: string; ok: boolean; error?: string }>
}

/**
 * Limpia número WhatsApp y devuelve formato chatId WAHA: 34647651051@c.us
 */
function whatsappAChatId(numero: string): string {
  const limpio = numero.replace(/\D/g, '')
  return `${limpio}@c.us`
}

/**
 * Envía un mensaje de WhatsApp vía WAHA.
 */
async function enviarWhatsApp(numero: string, texto: string): Promise<{ ok: boolean; error?: string }> {
  if (!WAHA_URL) {
    return { ok: false, error: 'WAHA no configurado (falta WAHA_URL)' }
  }
  try {
    const res = await fetch(`${WAHA_URL}/api/sendText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(WAHA_API_KEY ? { 'X-Api-Key': WAHA_API_KEY } : {}),
      },
      body: JSON.stringify({
        session: WAHA_SESSION,
        chatId: whatsappAChatId(numero),
        text: texto,
      }),
    })
    if (!res.ok) {
      const txt = await res.text()
      return { ok: false, error: `WAHA ${res.status}: ${txt.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: 'WAHA fetch error: ' + (err as Error).message }
  }
}

/**
 * Envía un email vía Resend.
 */
async function enviarEmail(to: string, asunto: string, contenido: string): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    return { ok: false, error: 'Resend no configurado (falta RESEND_API_KEY)' }
  }
  try {
    // Convertir saltos de línea a HTML manteniendo el formato
    const htmlContenido = contenido
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>')

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1e2233;">
        <div style="background: #B01D23; color: #fff; padding: 12px 18px; border-radius: 8px 8px 0 0; font-weight: 600; letter-spacing: 0.05em;">
          STREAT LAB · INFORMES
        </div>
        <div style="background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; line-height: 1.6; font-size: 14px;">
          ${htmlContenido}
        </div>
        <div style="margin-top: 16px; font-size: 11px; color: #888; text-align: center;">
          Generado automáticamente por el ERP Streat Lab.
        </div>
      </div>
    `
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [to],
        subject: asunto,
        html,
        text: contenido,
      }),
    })
    if (!res.ok) {
      const txt = await res.text()
      return { ok: false, error: `Resend ${res.status}: ${txt.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: 'Resend fetch error: ' + (err as Error).message }
  }
}

/**
 * Devuelve el campo de la tabla destinatarios para saber si recibe X informe.
 */
const FLAG_INFORME: Record<string, string> = {
  cierre_diario: 'recibe_cierre_diario',
  cobros_lunes: 'recibe_cobros_lunes',
  cierre_semanal: 'recibe_cierre_semanal',
  cierre_mensual: 'recibe_cierre_mensual',
}

/**
 * Despacha un informe a todos los destinatarios activos que lo reciben.
 */
export async function despacharInforme(
  tipo: 'cierre_diario' | 'cobros_lunes' | 'cierre_semanal' | 'cierre_mensual',
  contenido: { asunto: string; contenido_whatsapp: string; contenido_email: string },
): Promise<EnvioResultado> {
  // Cargar config para saber qué canales están activos
  const { data: config } = await supabaseAdmin
    .from('notif_config')
    .select('enviar_whatsapp, enviar_email')
    .eq('tipo', tipo)
    .single()

  const enviarWA = config?.enviar_whatsapp ?? true
  const enviarMail = config?.enviar_email ?? true

  // Cargar destinatarios activos que reciben este tipo de informe
  const flag = FLAG_INFORME[tipo]
  const { data: destinatarios } = await supabaseAdmin
    .from('notif_destinatarios')
    .select('id, nombre, whatsapp, email, canal_whatsapp, canal_email')
    .eq('activo', true)
    .eq(flag, true)

  const detalle: EnvioResultado['detalle'] = []
  let enviados = 0
  let fallidos = 0

  for (const d of destinatarios || []) {
    // WhatsApp
    if (enviarWA && d.canal_whatsapp && d.whatsapp) {
      const r = await enviarWhatsApp(d.whatsapp, contenido.contenido_whatsapp)
      await supabaseAdmin.from('notif_envios').insert({
        tipo,
        destinatario_id: d.id,
        destinatario_nombre: d.nombre,
        canal: 'whatsapp',
        destino: d.whatsapp,
        asunto: contenido.asunto,
        contenido: contenido.contenido_whatsapp,
        estado: r.ok ? 'enviado' : 'fallido',
        error_mensaje: r.error || null,
        enviado_at: r.ok ? new Date().toISOString() : null,
      })
      detalle.push({ destinatario: d.nombre, canal: 'whatsapp', ok: r.ok, error: r.error })
      r.ok ? enviados++ : fallidos++
    }

    // Email
    if (enviarMail && d.canal_email && d.email) {
      const r = await enviarEmail(d.email, contenido.asunto, contenido.contenido_email)
      await supabaseAdmin.from('notif_envios').insert({
        tipo,
        destinatario_id: d.id,
        destinatario_nombre: d.nombre,
        canal: 'email',
        destino: d.email,
        asunto: contenido.asunto,
        contenido: contenido.contenido_email,
        estado: r.ok ? 'enviado' : 'fallido',
        error_mensaje: r.error || null,
        enviado_at: r.ok ? new Date().toISOString() : null,
      })
      detalle.push({ destinatario: d.nombre, canal: 'email', ok: r.ok, error: r.error })
      r.ok ? enviados++ : fallidos++
    }
  }

  // Actualizar última ejecución
  await supabaseAdmin
    .from('notif_config')
    .update({ ultima_ejecucion: new Date().toISOString() })
    .eq('tipo', tipo)

  return { enviados, fallidos, detalle }
}

/**
 * Estado del WAHA — útil para mostrar OK/KO en UI configuración.
 */
export async function comprobarWAHA(): Promise<{ conectado: boolean; mensaje?: string }> {
  if (!WAHA_URL) return { conectado: false, mensaje: 'WAHA_URL no configurado' }
  try {
    const res = await fetch(`${WAHA_URL}/api/sessions/${WAHA_SESSION}`, {
      headers: WAHA_API_KEY ? { 'X-Api-Key': WAHA_API_KEY } : {},
    })
    if (!res.ok) return { conectado: false, mensaje: `WAHA ${res.status}` }
    const json = await res.json()
    const status = json.status || json.engine?.status || 'unknown'
    return { conectado: status === 'WORKING' || status === 'CONNECTED', mensaje: status }
  } catch (err) {
    return { conectado: false, mensaje: (err as Error).message }
  }
}
