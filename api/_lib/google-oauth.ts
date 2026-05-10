import { google } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'
import { supabaseAdmin } from './supabase-admin.js'

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || ''
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || ''
const REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:5173/api/oauth/google/callback'

export const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
]

export function makeOAuth2Client(): OAuth2Client {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('GOOGLE_OAUTH_CLIENT_ID / CLIENT_SECRET no configurados')
  }
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
}

export interface TokenRow {
  id: string
  titular_id: string | null
  access_token: string
  refresh_token: string
  expires_at: string
  scope: string | null
  email: string | null
}

export async function getOAuthClient(): Promise<OAuth2Client> {
  const { data, error } = await supabaseAdmin
    .from('google_oauth_tokens')
    .select('*')
    .is('titular_id', null)
    .maybeSingle()
  if (error) throw error
  const token = data as TokenRow | null
  if (!token) {
    throw new Error('Drive no conectado. Conecta en Configuración → Integraciones → Drive.')
  }

  const oauth2Client = makeOAuth2Client()
  oauth2Client.setCredentials({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expiry_date: new Date(token.expires_at).getTime(),
    scope: token.scope || undefined,
  })

  oauth2Client.on('tokens', async (tokens) => {
    if (!tokens.access_token) return
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : new Date(Date.now() + 55 * 60 * 1000).toISOString()
    const updates: Record<string, string> = {
      access_token: tokens.access_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }
    if (tokens.refresh_token) updates.refresh_token = tokens.refresh_token
    await supabaseAdmin.from('google_oauth_tokens').update(updates).eq('id', token.id)
  })

  return oauth2Client
}

/**
 * Comprueba conexión Drive. Si validate=true, prueba el refresh_token de verdad:
 * si falla con invalid_grant, BORRA el token corrupto y devuelve conectado=false.
 * Esto fuerza al usuario a reconectar y soluciona invalid_grant silenciosamente.
 */
export async function tieneDriveConectado(opts: { validate?: boolean } = {}): Promise<{ conectado: boolean; email?: string; error?: string }> {
  const { data } = await supabaseAdmin
    .from('google_oauth_tokens')
    .select('id, email, refresh_token, access_token, expires_at, scope')
    .is('titular_id', null)
    .maybeSingle()
  if (!data) return { conectado: false }

  if (!opts.validate) {
    return { conectado: true, email: (data as { email: string | null }).email || undefined }
  }

  try {
    const client = makeOAuth2Client()
    client.setCredentials({
      access_token: (data as any).access_token,
      refresh_token: (data as any).refresh_token,
      expiry_date: new Date((data as any).expires_at).getTime(),
      scope: (data as any).scope || undefined,
    })
    // Forzar refresh para validar
    await client.getAccessToken()
    return { conectado: true, email: (data as { email: string | null }).email || undefined }
  } catch (err: any) {
    const msg = err?.message || String(err)
    if (msg.includes('invalid_grant') || msg.includes('invalid_token')) {
      // Token corrupto, borrar para forzar reconexión limpia
      await supabaseAdmin.from('google_oauth_tokens').delete().eq('id', (data as any).id)
      return { conectado: false, error: 'token_invalido_borrado' }
    }
    return { conectado: false, error: msg.slice(0, 120) }
  }
}
