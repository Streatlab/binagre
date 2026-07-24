// BÓVEDA DE CLAVES · Ajustes > Configuración > Claves
// Guarda las claves del negocio (PINs del fichaje, llaves de servicios, accesos)
// cifradas en la base de datos. Solo se abren con la clave maestra de Rubén.
// El cifrado usa una llave que vive en el Vault de Supabase: ni el navegador ni
// este archivo la conocen, todo el descifrado ocurre dentro de la base de datos.
// Si se olvida la clave maestra, se envía un código de un solo uso al correo
// de recuperación (30 minutos de validez).
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'

// Freno simple contra la fuerza bruta mientras la instancia esté viva.
const fallos = new Map<string, { n: number; hasta: number }>()

function ipDe(req: VercelRequest): string {
  const h = req.headers['x-forwarded-for']
  return (Array.isArray(h) ? h[0] : h || 'local').split(',')[0].trim()
}

function bloqueado(ip: string): number {
  const f = fallos.get(ip)
  if (!f) return 0
  if (Date.now() > f.hasta) { fallos.delete(ip); return 0 }
  return Math.ceil((f.hasta - Date.now()) / 1000)
}

function anotarFallo(ip: string) {
  const f = fallos.get(ip) || { n: 0, hasta: 0 }
  f.n += 1
  // A partir del 5º intento fallido, espera creciente (30s, 60s, 120s…)
  if (f.n >= 5) f.hasta = Date.now() + Math.min(30000 * 2 ** (f.n - 5), 900000)
  fallos.set(ip, f)
}

function limpiarFallos(ip: string) { fallos.delete(ip) }

function errorRpc(msg: string): string {
  if (msg.includes('CLAVE_INCORRECTA')) return 'Clave maestra incorrecta.'
  if (msg.includes('ETIQUETA_OBLIGATORIA')) return 'Ponle un nombre a la clave.'
  if (msg.includes('PIN_6_CIFRAS')) return 'El PIN del fichaje son 6 cifras.'
  if (msg.includes('CLAVE_4_A_10_CIFRAS')) return 'La clave maestra son entre 4 y 10 cifras.'
  if (msg.includes('EMPLEADO_NO_ENCONTRADO')) return 'Ese empleado ya no existe.'
  if (msg.includes('CODIGO_CADUCADO')) return 'El código ha caducado. Pide otro.'
  if (msg.includes('CODIGO_INCORRECTO')) return 'Código incorrecto.'
  return msg
}

/** Envío del código de recuperación por Resend (key en el Vault). */
async function enviarCodigo(email: string, codigo: string): Promise<{ ok: boolean; error?: string }> {
  let key = process.env.RESEND_API_KEY || ''
  if (!key) {
    const { data } = await supabaseAdmin.rpc('fn_secreto_resend')
    key = typeof data === 'string' ? data : ''
  }
  if (!key) return { ok: false, error: 'No hay forma de enviar el correo ahora mismo.' }
  const from = process.env.RESEND_FROM || 'Streat Lab <onboarding@resend.dev>'
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1e2233;">
      <div style="background:#B01D23;color:#fff;padding:12px 18px;font-weight:600;letter-spacing:.05em;">STREAT LAB · CLAVES</div>
      <div style="background:#f9f9f9;padding:22px;line-height:1.6;font-size:14px;">
        <p>Has pedido recuperar la clave maestra de la bóveda del ERP.</p>
        <p style="font-size:30px;letter-spacing:8px;font-weight:700;margin:18px 0;">${codigo}</p>
        <p>Vale durante 30 minutos y solo se puede usar una vez.</p>
        <p style="color:#888;font-size:12px;">Si no has sido tú, ignora este correo y cambia la clave maestra.</p>
      </div>
    </div>`
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ from, to: [email], subject: 'Código de recuperación · Claves ERP', html, text: `Código: ${codigo} (30 minutos)` }),
    })
    if (!r.ok) return { ok: false, error: `No se pudo enviar el correo (${r.status}).` }
    return { ok: true }
  } catch {
    return { ok: false, error: 'No se pudo enviar el correo.' }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action || '')
  const body = (req.body || {}) as Record<string, string | null | undefined>
  const clave = String(body.clave_maestra || '')
  const ip = ipDe(req)

  try {
    // ── Recuperación: no exige clave maestra ──────────────────────────────
    if (action === 'recup-iniciar') {
      const { data, error } = await supabaseAdmin.rpc('fn_boveda_recup_iniciar')
      if (error) return res.status(500).json({ error: errorRpc(error.message) })
      const fila = (Array.isArray(data) ? data[0] : data) as { email: string; codigo: string }
      const envio = await enviarCodigo(fila.email, fila.codigo)
      if (!envio.ok) return res.status(500).json({ error: envio.error })
      const tapado = fila.email.replace(/^(.).*(@.*)$/, (_m, a, b) => `${a}${'•'.repeat(5)}${b}`)
      return res.status(200).json({ ok: true, email: tapado })
    }

    if (action === 'recup-confirmar') {
      const { error } = await supabaseAdmin.rpc('fn_boveda_recup_confirmar', {
        p_codigo: String(body.codigo || ''), p_nueva: String(body.nueva || ''),
      })
      if (error) return res.status(400).json({ error: errorRpc(error.message) })
      limpiarFallos(ip)
      return res.status(200).json({ ok: true })
    }

    // ── Todo lo demás exige la clave maestra ──────────────────────────────
    const espera = bloqueado(ip)
    if (espera > 0) return res.status(429).json({ error: `Demasiados intentos. Espera ${espera} s.` })

    if (action === 'abrir') {
      const { data, error } = await supabaseAdmin.rpc('fn_boveda_abrir', { p_clave: clave })
      if (error) {
        if (error.message.includes('CLAVE_INCORRECTA')) anotarFallo(ip)
        return res.status(403).json({ error: errorRpc(error.message) })
      }
      limpiarFallos(ip)
      return res.status(200).json({ claves: data || [] })
    }

    if (action === 'empleados') {
      const { data: ok } = await supabaseAdmin.rpc('fn_boveda_ok', { p_clave: clave })
      if (ok !== true) { anotarFallo(ip); return res.status(403).json({ error: 'Clave maestra incorrecta.' }) }
      const { data, error } = await supabaseAdmin
        .from('empleados')
        .select('id, nombre, fichaje_activo')
        .eq('activo', true)
        .order('nombre')
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ empleados: data || [] })
    }

    if (action === 'guardar') {
      const { data, error } = await supabaseAdmin.rpc('fn_boveda_guardar', {
        p_clave: clave,
        p_id: body.id || null,
        p_categoria: body.categoria || 'otro',
        p_etiqueta: body.etiqueta || '',
        p_usuario: body.usuario || null,
        p_valor: body.valor || '',
        p_notas: body.notas || null,
        p_empleado_id: body.empleado_id || null,
      })
      if (error) return res.status(400).json({ error: errorRpc(error.message) })
      return res.status(200).json({ ok: true, id: data })
    }

    if (action === 'borrar') {
      const { error } = await supabaseAdmin.rpc('fn_boveda_borrar', { p_clave: clave, p_id: body.id })
      if (error) return res.status(400).json({ error: errorRpc(error.message) })
      return res.status(200).json({ ok: true })
    }

    if (action === 'set-pin') {
      const { error } = await supabaseAdmin.rpc('fn_boveda_set_pin_empleado', {
        p_clave: clave, p_empleado: body.empleado_id, p_pin: String(body.pin || ''),
      })
      if (error) return res.status(400).json({ error: errorRpc(error.message) })
      return res.status(200).json({ ok: true })
    }

    if (action === 'cambiar-clave') {
      const { error } = await supabaseAdmin.rpc('fn_boveda_cambiar_clave', {
        p_actual: clave, p_nueva: String(body.nueva || ''),
      })
      if (error) return res.status(400).json({ error: errorRpc(error.message) })
      return res.status(200).json({ ok: true })
    }

    return res.status(404).json({ error: `unknown action: ${action}` })
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Error' })
  }
}
