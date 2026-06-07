import type { Download, Page } from 'playwright'
import type { ArchivoDescargado, FechaRango } from '../tipos.ts'

/** Rango "ayer" en hora de Madrid (YYYY-MM-DD). */
export function ayerMadrid(): FechaRango {
  // en-CA produce formato YYYY-MM-DD
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const ayer = new Date(Date.now() - 24 * 3600 * 1000)
  const f = fmt.format(ayer)
  return { desde: f, hasta: f }
}

/**
 * Lanza error claro si el portal nos ha redirigido a su pantalla de login
 * (señal de que la sesión/cookies han caducado).
 */
export async function verificarSesion(page: Page, portal: string): Promise<void> {
  const url = page.url()
  if (/auth|login|signin|sign-in|identidad/i.test(url)) {
    throw new Error(`Sesión de ${portal} caducada — regenerar con \`npm run login ${portal}\``)
  }
}

/** Espera y captura una descarga disparada por `accion`, devolviéndola como buffer. */
export async function capturarDescarga(
  page: Page,
  accion: () => Promise<void>,
): Promise<ArchivoDescargado> {
  const [download] = (await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    accion(),
  ])) as [Download, void]

  const stream = await download.createReadStream()
  if (!stream) throw new Error('No se pudo leer el archivo descargado')

  const chunks: Buffer[] = []
  for await (const c of stream) chunks.push(Buffer.from(c))
  const buffer = Buffer.concat(chunks)
  const nombre = download.suggestedFilename()
  return { buffer, nombre, mimeType: mimePorNombre(nombre) }
}

function mimePorNombre(nombre: string): string {
  const ext = nombre.toLowerCase().split('.').pop() ?? ''
  switch (ext) {
    case 'pdf':
      return 'application/pdf'
    case 'csv':
      return 'text/csv'
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    case 'xls':
      return 'application/vnd.ms-excel'
    default:
      return 'application/octet-stream'
  }
}
