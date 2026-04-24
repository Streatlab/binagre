import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GOOGLE_OAUTH_SCOPES, makeOAuth2Client } from '../../_lib/google-oauth.js'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const client = makeOAuth2Client()
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_OAUTH_SCOPES,
    prompt: 'consent',
    include_granted_scopes: true,
  })
  res.writeHead(302, { Location: url })
  res.end()
}
