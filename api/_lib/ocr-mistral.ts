// ocr-mistral.ts — BOOTSTRAP de pago ACOTADO (regla 3 bis del procedimiento).
//
// NO es el motor de lectura. Es el "molde de arranque": solo se invoca cuando el
// lector gratis (reglas/plantilla + Tesseract) NO ha podido leer una factura de un
// proveedor que AÚN no tiene plantilla por NIF. Devuelve el TEXTO del documento;
// ese texto se pasa al MISMO parser gratuito (extraerPorReglas) que el resto del
// sistema, y de ahí se deriva la plantilla por NIF. A partir de esa plantilla, las
// demás facturas de ese proveedor se leen GRATIS y Mistral no vuelve a tocarse.
//
// Coste: una pasada puntual por proveedor nuevo (céntimos). Kill-switch por entorno
// (OCR_BOOTSTRAP_API) y candado natural por NIF (la 2ª factura del proveedor ya se
// lee por plantilla y nunca llega aquí).

const MISTRAL_OCR_URL = 'https://api.mistral.ai/v1/ocr'
const MISTRAL_MODEL = 'mistral-ocr-latest'
const TIMEOUT_MS = 90000

// ¿Está permitido el bootstrap de pago? Apagado por defecto: solo se enciende
// con OCR_BOOTSTRAP_API=true en Vercel. Si no hay clave, también queda inerte.
export function bootstrapApiActivo(): boolean {
  return process.env.OCR_BOOTSTRAP_API === 'true' && !!process.env.MISTRAL_API_KEY
}

// Llama al OCR de Mistral sobre un PDF o imagen y devuelve el texto plano (markdown
// de todas las páginas concatenado). Best-effort: ante cualquier fallo devuelve ''
// y el flujo degrada a lectura manual sin romperse ni gastar de más.
export async function ocrMistralTexto(buffer: Buffer, tipo: 'pdf' | 'imagen'): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) return ''

  const b64 = buffer.toString('base64')
  const document = tipo === 'imagen'
    ? { type: 'image_url', image_url: `data:image/jpeg;base64,${b64}` }
    : { type: 'document_url', document_url: `data:application/pdf;base64,${b64}` }

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const resp = await fetch(MISTRAL_OCR_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: MISTRAL_MODEL, document, include_image_base64: false }),
      signal: ctrl.signal,
    })
    if (!resp.ok) {
      console.error('[ocrMistral] HTTP', resp.status, (await resp.text()).slice(0, 200))
      return ''
    }
    const data = await resp.json() as { pages?: Array<{ markdown?: string }> }
    const paginas = data.pages || []
    const texto = paginas.map((p) => p.markdown || '').join('\n').trim()
    return texto
  } catch (err) {
    console.error('[ocrMistral] fallo:', err instanceof Error ? err.message : String(err))
    return ''
  } finally {
    clearTimeout(t)
  }
}
