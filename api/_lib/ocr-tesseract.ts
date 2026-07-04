// ocr-tesseract.ts — OCR 100% GRATIS para facturas escaneadas o en foto.
// Cero API de pago. Cero cuenta externa. Cero coste, siempre.
//
// Estrategia:
//   - Imagen (jpg/png/webp/etc): Tesseract directo sobre el buffer.
//   - PDF sin capa de texto (escaneado): se rasteriza con pdfjs-dist +
//     @napi-rs/canvas (ambos con prebuilds, sin compilar en Vercel) y se pasan
//     las primeras páginas por Tesseract.
//
// Todo es best-effort: si algo falla (rasterizado, worker, idioma), devuelve ''
// y el flujo de procesarArchivo degrada la factura a lectura manual SIN romperse.
// El idioma es español (spa). El worker cachea el modelo en /tmp (único FS
// escribible en serverless).
//
// FIX 03/07/26 (auditoría 16k): TODOS los escaneados fallaban con
// "The API version 4.10.38 does not match the Worker version 4.6.82".
// Causa: otro módulo del bundle deja en GlobalWorkerOptions un worker de una
// versión distinta a la del pdf.mjs importado aquí (singleton compartido).
// Fix: antes de abrir el PDF, forzar que el workerSrc apunte EXACTAMENTE al
// worker del mismo paquete que la API (misma versión garantizada). El import
// con literal además obliga a Vercel a incluir el fichero del worker en el bundle.

const MAX_PAGINAS_OCR = 3      // facturas suelen ser 1-2 pág; tope anti-timeout
const ESCALA_RASTER = 2.0      // 2x: legibilidad sin disparar memoria
const TIMEOUT_OCR_MS = 60000   // tope duro por archivo

// Tesseract sobre un buffer de imagen (png/jpg/etc). Devuelve texto plano.
export async function ocrImagen(buffer: Buffer): Promise<string> {
  let worker: { recognize: (img: Buffer) => Promise<{ data: { text: string } }>; terminate: () => Promise<unknown> } | null = null
  try {
    // import dinámico con cast a any: evita que tsc exija typings de subrutas
    const tess: any = await import('tesseract.js')
    const createWorker = tess.createWorker
    // cachePath en /tmp: único directorio escribible en Vercel
    worker = await createWorker('spa', 1, { cachePath: '/tmp' })
    if (!worker) return ''
    const { data } = await worker.recognize(buffer)
    return (data.text || '').trim()
  } catch (err) {
    console.error('[ocrImagen] fallo Tesseract:', err instanceof Error ? err.message : String(err))
    return ''
  } finally {
    try { await worker?.terminate() } catch { /* noop */ }
  }
}

// Rasteriza un PDF escaneado a PNG (primeras páginas) y le pasa Tesseract.
export async function ocrPdfEscaneado(buffer: Buffer): Promise<string> {
  try {
    // import dinámico con cast a any: la subruta legacy de pdfjs no expone
    // typings y romperia `tsc -b`. En runtime resuelve perfectamente.
    const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs' as string)
    const canvasMod: any = await import('@napi-rs/canvas')
    const createCanvas = canvasMod.createCanvas

    // FIX 03/07/26: alinear API y Worker a la MISMA versión del MISMO paquete.
    // Sin esto, un workerSrc heredado de otro módulo (versión distinta) rompe
    // TODO el rasterizado con "API version X does not match Worker version Y".
    try {
      const { createRequire } = await import('node:module')
      const { pathToFileURL } = await import('node:url')
      const req = createRequire(import.meta.url)
      // Import con literal: garantiza que Vercel empaquete el fichero del worker.
      await import('pdfjs-dist/legacy/build/pdf.worker.mjs' as string).catch(() => null)
      if (pdfjs.GlobalWorkerOptions) {
        pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(req.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).href
      }
    } catch { /* best-effort: si falla, se intenta con la config previa */ }

    const uint8 = new Uint8Array(buffer)
    const loadingTask = pdfjs.getDocument({ data: uint8, useSystemFonts: true })
    const pdf = await loadingTask.promise

    const totalPaginas = Math.min(pdf.numPages, MAX_PAGINAS_OCR)
    const textos: string[] = []

    for (let i = 1; i <= totalPaginas; i++) {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: ESCALA_RASTER })
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
      const ctx = canvas.getContext('2d')
      await page.render({ canvasContext: ctx, viewport }).promise
      const png = canvas.toBuffer('image/png')
      const texto = await ocrImagen(png)
      if (texto) textos.push(texto)
    }

    return textos.join('\n').trim()
  } catch (err) {
    console.error('[ocrPdfEscaneado] fallo rasterizado/OCR:', err instanceof Error ? err.message : String(err))
    return ''
  }
}

// Punto de entrada único. Decide imagen vs PDF y aplica un timeout duro global.
export async function extraerTextoOCRGratis(
  buffer: Buffer,
  tipo: 'pdf' | 'imagen',
): Promise<string> {
  const tarea = tipo === 'imagen' ? ocrImagen(buffer) : ocrPdfEscaneado(buffer)
  const timeout = new Promise<string>((resolve) => setTimeout(() => resolve(''), TIMEOUT_OCR_MS))
  return Promise.race([tarea, timeout])
}
