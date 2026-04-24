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
 * Devuelve un OAuth2Client listo para usar por un titular (o `null` = unificado).
 * Se auto-refresca si el access_token expiró; al refrescar, persiste el nuevo token.
 */
export async function getOAuthClient(titularId: string | null = null): Promise<OAuth2Client> {
  let query = supabaseAdmin.from('google_oauth_tokens').select('*')
  query = titularId ? query.eq('titular_id', titularId) : query.is('titular_id', null)
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  const token = data as TokenRow | null
  if (!token) {
    const who = titularId ? `titular ${titularId}` : 'cuenta unificada'
    throw new Error(`Drive no conectado para ${who}. Conecta en Configuración · Titulares.`)
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

export async function tieneDriveConectado(titularId: string | null): Promise<{ conectado: boolean; email?: string }> {
  let query = supabaseAdmin.from('google_oauth_tokens').select('email')
  query = titularId ? query.eq('titular_id', titularId) : query.is('titular_id', null)
  const { data } = await query.maybeSingle()
  if (!data) return { conectado: false }
  return { conectado: true, email: (data as { email: string | null }).email || undefined }
}
