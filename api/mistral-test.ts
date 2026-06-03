import type { VercelRequest, VercelResponse } from '@vercel/node'

// Endpoint temporal de diagnóstico. Confirma que la llave de Mistral
// está bien configurada en el entorno y responde. No expone la clave.
// Tolera el nombre en mayúsculas o minúsculas.
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const key =
    process.env.MISTRAL_API_KEY ||
    process.env.mistral_api_key ||
    process.env.Mistral_Api_Key
  if (!key) {
    return res.status(200).json({ ok: false, paso: 'env', error: 'Clave de Mistral no encontrada en el entorno' })
  }
  try {
    const r = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'Responde solo: OK' }],
      }),
    })
    const txt = await r.text()
    if (!r.ok) {
      return res.status(200).json({ ok: false, paso: 'auth', status: r.status, detalle: txt.slice(0, 300) })
    }
    const j = JSON.parse(txt)
    return res.status(200).json({
      ok: true,
      respuesta: j?.choices?.[0]?.message?.content ?? null,
      key_prefijo: key.slice(0, 3) + '…',
    })
  } catch (e: any) {
    return res.status(200).json({ ok: false, paso: 'fetch', error: String(e?.message || e) })
  }
}
