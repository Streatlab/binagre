import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GOOGLE_OAUTH_SCOPES, makeOAuth2Client } from '../../_lib/google-oauth.js'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const client = makeOAuth2Client()
    const url = client.generateAuthUrl({
      access_type: 'offline',
      scope: GOOGLE_OAUTH_SCOPES,
      prompt: 'consent',
      include_granted_scopes: true,
    })
    res.writeHead(302, { Location: url })
    res.end()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).send(`OAuth start error: ${msg}`)
  }
}
