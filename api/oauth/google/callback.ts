import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'
import { makeOAuth2Client } from '../../_lib/google-oauth.js'
import { supabaseAdmin } from '../../_lib/supabase-admin.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = typeof req.query.code === 'string' ? req.query.code : null
  const errParam = typeof req.query.error === 'string' ? req.query.error : null

  if (errParam) {
    res.writeHead(302, { Location: `/configuracion/bancos?drive_error=${encodeURIComponent(errParam)}` })
    return res.end()
  }
  if (!code) {
    res.writeHead(302, { Location: '/configuracion/bancos?drive_error=missing_code' })
    return res.end()
  }

  try {
    const client = makeOAuth2Client()
    const { tokens } = await client.getToken(code)
    if (!tokens.refresh_token) {
      res.writeHead(302, { Location: '/configuracion/bancos?drive_error=no_refresh_token' })
      return res.end()
    }
    client.setCredentials(tokens)

    const oauth2 = google.oauth2({ version: 'v2', auth: client })
    const userInfo = await oauth2.userinfo.get()

    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : new Date(Date.now() + 55 * 60 * 1000).toISOString()

    const { data: existente } = await supabaseAdmin
      .from('google_oauth_tokens')
      .select('id')
      .is('titular_id', null)
      .maybeSingle()

    const payload = {
      titular_id: null,
      access_token: tokens.access_token || '',
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      scope: tokens.scope || null,
      email: userInfo.data.email || null,
      updated_at: new Date().toISOString(),
    }

    if (existente?.id) {
      await supabaseAdmin.from('google_oauth_tokens').update(payload).eq('id', existente.id)
    } else {
      await supabaseAdmin.from('google_oauth_tokens').insert(payload)
    }

    res.writeHead(302, { Location: '/configuracion/bancos?drive_conectado=1' })
    return res.end()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.writeHead(302, { Location: `/configuracion/bancos?drive_error=${encodeURIComponent(msg.slice(0, 200))}` })
    return res.end()
  }
}
