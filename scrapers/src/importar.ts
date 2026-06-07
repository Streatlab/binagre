import { ENDPOINT_IMPORT, IMPORT_BASE, IMPORT_SECRET } from './config.ts'
import type { ArchivoDescargado, PlataformaId } from './tipos.ts'

/**
 * Reenvía el archivo descargado al endpoint de importación del ERP.
 * No duplica lógica de parseo: el ERP detecta plataforma y almacena.
 */
export async function importar(portal: PlataformaId, archivo: ArchivoDescargado): Promise<unknown> {
  const url = IMPORT_BASE + ENDPOINT_IMPORT[portal]
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (IMPORT_SECRET) headers['x-scraper-secret'] = IMPORT_SECRET

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      base64: archivo.buffer.toString('base64'),
      nombre: archivo.nombre,
      mimeType: archivo.mimeType,
    }),
  })

  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    throw new Error(`Importación ${portal} → HTTP ${resp.status}: ${JSON.stringify(json)}`)
  }
  return json
}
