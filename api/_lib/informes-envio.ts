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
 *
 * NOTA 2 (18 jul 2026): credenciales Green API se leen de la tabla
 * robot_credenciales (plataforma='green_api': usuario=idInstance,
 * password=apiToken, url_base=apiUrl). Las variables de entorno
 * GREEN_API_* siguen funcionando como override si existen.
 */
import { supabaseAdmin } from './supabase-admin.js'
import type { TipoInforme } from './informes-calculo.js'

// streatlab.com NO está verificado en Resend (el DNS actual no admite los
// registros TXT/DKIM). Con el remitente onboarding@resend.dev, Resend solo
// entrega a la dirección dueña de la cuenta (ruben@streatlab.com) — decisión
// 18-jul-2026: el email es solo para Rubén; Emilio recibe por WhatsApp.
// Si algún día se verifica el dominio: poner RESEND_FROM en Vercel y listo.
const RESEND_FROM = process.env.RESEND_FROM || 'Streat Lab <onboarding@resend.dev>'

let resendKeyCache: string | null = null

/** API key de Resend: env var si existe, si no, del vault de Supabase (fn_secreto_resend). */
async function cargarResendKey(): Promise<string> {
  if (resendKeyCache) return resendKeyCache
  let key = process.env.RESEND_API_KEY || ''
  if (!key) {
    const { data } = await supabaseAdmin.rpc('fn_secreto_resend')
    key = (data as string | null) || ''
  }
  resendKeyCache = key
  return key
}

export interface EnvioResultado {
  enviados: number
  fallidos: number
  detalle: Array<{ destinatario: string; canal: string; ok: boolean; error?: string }>
}

interface GreenApiCfg {
  url: string
  idInstance: string
  token: string
}

let greenCfgCache: GreenApiCfg | null = null

/**
 * Carga la config de Green API: primero variables de entorno, si faltan,
 * tabla robot_credenciales (plataforma='green_api'). Cachea en memoria
 * durante la vida de la función serverless.
 */
async function cargarGreenApi(): Promise<GreenApiCfg> {
  if (greenCfgCache) return greenCfgCache

  let url = (process.env.GREEN_API_URL || '').replace(/\/$/, '')
  let idInstance = process.env.GREEN_API_ID_INSTANCE || ''
  let token = process.env.GREEN_API_TOKEN || ''

  if (!idInstance || !token || !url) {
    const { data } = await supabaseAdmin
      .from('robot_credenciales')
      .select('usuario, password, url_base')
      .eq('plataforma', 'green_api')
      .eq('activo', true)
      .order('actualizado_en', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) {
      idInstance = idInstance || data.usuario || ''
      token = token || data.password || ''
      url = url || (data.url_base || '').replace(/\/$/, '')
    }
  }

  if (!url) url = 'https://api.green-api.com'
  greenCfgCache = { url, idInstance, token }
  return greenCfgCache
}

/**
 * Limpia número WhatsApp y devuelve formato chatId: 34647651051@c.us
 * (mismo formato que usa Green API).
 */
function whatsappAChatId(numero: string): string {
  const limpio = numero.replace(/\D/g, '')
  return `${limpio}@c.us`
}

/**
 * Envía un mensaje de WhatsApp vía Green API.
 */
async function enviarWhatsApp(numero: string, texto: string): Promise<{ ok: boolean; error?: string }> {
  const cfg = await cargarGreenApi()
  if (!cfg.idInstance || !cfg.token) {
    return { ok: false, error: 'Green API no configurado (sin credenciales en env ni robot_credenciales)' }
  }
  try {
    const res = await fetch(`${cfg.url}/waInstance${cfg.idInstance}/sendMessage/${cfg.token}`, {
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
  const apiKey = await cargarResendKey()
  if (!apiKey) {
    return { ok: false, error: 'Resend no configurado (sin key en env ni en vault)' }
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
        'Authorization': `Bearer ${apiKey}`,
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
const FLAG_INFORME: Record<TipoInforme, string> = {
  cierre_diario: 'recibe_cierre_diario',
  cobros_lunes: 'recibe_cobros_lunes',
  cierre_semanal: 'recibe_cierre_semanal',
  cierre_mensual: 'recibe_cierre_mensual',
  resumen_manana: 'recibe_resumen_manana',
  pulso: 'recibe_pulso',
}

/**
 * Despacha un informe a todos los destinatarios activos que lo reciben.
 */
export async function despacharInforme(
  tipo: TipoInforme,
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
  const cfg = await cargarGreenApi()
  if (!cfg.idInstance || !cfg.token) {
    return { conectado: false, mensaje: 'Green API no configurado (sin credenciales en env ni robot_credenciales)' }
  }
  try {
    const res = await fetch(`${cfg.url}/waInstance${cfg.idInstance}/getStateInstance/${cfg.token}`)
    if (!res.ok) return { conectado: false, mensaje: `Green API ${res.status}` }
    const json: any = await res.json()
    const estado = json.stateInstance || 'unknown'
    // 'authorized' = instancia vinculada al WhatsApp del bar y lista para enviar
    return { conectado: estado === 'authorized', mensaje: estado }
  } catch (err) {
    return { ok: false, conectado: false, mensaje: (err as Error).message } as any
  }
}
