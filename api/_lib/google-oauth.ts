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

/**
 * Devuelve el OAuth2Client global. Solo existe UN token en todo el sistema
 * (titular_id IS NULL). Los PDFs van siempre al Drive de ese usuario,
 * dentro de carpetas RUBEN/ o EMILIO/ según el titular de cada factura.
 */
export async function getOAuthClient(): Promise<OAuth2Client> {
  const { data, error } = await supabaseAdmin
    .from('google_oauth_tokens')
    .select('*')
    .is('titular_id', null)
    .maybeSingle()
  if (error) throw error
  const token = data as TokenRow | null
  if (!token) {
    throw new Error('Drive no conectado. Conecta en Configuración → Cuentas bancarias → Drive (Google).')
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

export async function tieneDriveConectado(): Promise<{ conectado: boolean; email?: string }> {
  const { data } = await supabaseAdmin
    .from('google_oauth_tokens')
    .select('email')
    .is('titular_id', null)
    .maybeSingle()
  if (!data) return { conectado: false }
  return { conectado: true, email: (data as { email: string | null }).email || undefined }
}
