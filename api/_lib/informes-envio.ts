/**
 * Despachador de envíos — WhatsApp (Green API) y Email (Resend).
 *
 * Toma destinatarios y contenido, envía por los canales activos,
 * y registra cada envío en notif_envios.
 *
 * NOTA (18 jul 2026): WhatsApp migrado de WAHA (requería servidor Railway de pago)
 * a Green API plan Developer (gratis, HTTP directo, máx 3 chats/mes — suficiente:
 * Rubén + Emilio). Los exports mantienen sus nombres (despacharInforme,
 * comprobarWAHA) para no tocar puertas ni UI.
 */
import { supabaseAdmin } from './supabase-admin.js'

const GREEN_API_URL = (process.env.GREEN_API_URL || 'https://api.green-api.com').replace(/\/$/, '')
const GREEN_API_ID_INSTANCE = process.env.GREEN_API_ID_INSTANCE || ''
const GREEN_API_TOKEN = process.env.GREEN_API_TOKEN || ''
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const RESEND_FROM = process.env.RESEND_FROM || 'Streat Lab <informes@streatlab.com>'

export interface EnvioResultado {
  enviados: number
  fallidos: number
  detalle: Array<{ destinatario: string; canal: string; ok: boolean; error?: string }>
}

/**
 * Limpia número WhatsApp y devuelve formato chatId: 34647651051@c.us
 * (mismo formato que usa Green API).
 */
function whatsappAChatId(numero: string): string {
  const limpio = numero.replace(/\D/g, '')
  return `${limpio}@c.us`
}

function greenApiBase(): string {
  return `${GREEN_API_URL}/waInstance${GREEN_API_ID_INSTANCE}`
}

/**
 * Envía un mensaje de WhatsApp vía Green API.
 */
async function enviarWhatsApp(numero: string, texto: string): Promise<{ ok: boolean; error?: string }> {
  if (!GREEN_API_ID_INSTANCE || !GREEN_API_TOKEN) {
    return { ok: false, error: 'Green API no configurado (faltan GREEN_API_ID_INSTANCE / GREEN_API_TOKEN)' }
  }
  try {
    const res = await fetch(`${greenApiBase()}/sendMessage/${GREEN_API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: whatsappAChatId(numero),
        message: texto,
      }),
    })
    if (!res.ok) {
      const txt = await res.text()
      // 466 = cuota del plan Developer superada (más de 3 chats en el mes)
      if (res.status === 466) {
        return { ok: false, error: `Green API 466: cuota mensual de chats superada (plan Developer, máx 3 chats). ${txt.slice(0, 150)}` }
      }
      return { ok: false, error: `Green API ${res.status}: ${txt.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: 'Green API fetch error: ' + (err as Error).message }
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
 * Estado del canal WhatsApp (Green API) — útil para mostrar OK/KO en UI configuración.
 * Mantiene el nombre comprobarWAHA para no tocar la puerta /api/informes/waha-status ni la UI.
 */
export async function comprobarWAHA(): Promise<{ conectado: boolean; mensaje?: string }> {
  if (!GREEN_API_ID_INSTANCE || !GREEN_API_TOKEN) {
    return { conectado: false, mensaje: 'Green API no configurado (faltan GREEN_API_ID_INSTANCE / GREEN_API_TOKEN)' }
  }
  try {
    const res = await fetch(`${greenApiBase()}/getStateInstance/${GREEN_API_TOKEN}`)
    if (!res.ok) return { conectado: false, mensaje: `Green API ${res.status}` }
    const json: any = await res.json()
    const estado = json.stateInstance || 'unknown'
    // 'authorized' = instancia vinculada al WhatsApp del bar y lista para enviar
    return { conectado: estado === 'authorized', mensaje: estado }
  } catch (err) {
    return { conectado: false, mensaje: (err as Error).message }
  }
}
