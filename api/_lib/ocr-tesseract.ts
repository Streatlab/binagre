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
// FIX 04/07/26: TODO rasterizado de PDF escaneado moría en producción con
// "The API version 4.10.38 does not match the Worker version 4.6.82": otro
// módulo del proceso dejaba registrado en GlobalWorkerOptions un worker de
// pdfjs de una versión distinta a la API importada aquí. Fix: antes de abrir
// el documento, forzamos que el worker sea EXACTAMENTE el del mismo paquete
// que la API (resolución local por createRequire), garantizando versión idéntica.
//
// FIX 08/07/26: el .mjs del worker no lo traza el bundler de Vercel, así que
// createRequire lanzaba "Cannot find module" y el workerSrc heredado (4.6.82)
// seguía puesto -> mismatch y 0 facturas escaneadas leídas. Dos cambios:
//   1) vercel.json incluye node_modules/pdfjs-dist/legacy/build/** en la función.
//   2) si aun así no resuelve, limpiamos workerSrc en vez de dejar el heredado.
//
// DIAGNÓSTICO 12/07/26 (task 2): auditoría = "Tesseract 0 lecturas históricas".
// Las libs están instaladas (tesseract.js 5, pdfjs-dist, @napi-rs/canvas) y el flag
// OCR_TESSERACT_ACTIVO está ENCENDIDO por defecto, así que no es config ni falta de
// dependencia. La causa dominante es la SEGUNDA fase: Tesseract SÍ devuelve texto,
// pero es ruidoso y extraerPorReglas no encuentra un NIF limpio (O↔0, I↔1, espacios
// dentro del NIF) → devuelve null → la factura cae al escalón de pago o a manual y
// Tesseract "no cuenta" como lectura. Como no es reparable con certeza en serverless
// sin telemetría, se COMPENSA reforzando las plantillas (task 3: plantilla_verificada,
// la 2ª factura del proveedor se lee gratis) y se hace VISIBLE el caso en
// procesarArchivo (console diagnóstico cuando Tesseract dio texto pero no se extrajo
// NIF/total), en vez de un 0 silencioso.
//
// FIX 22/07/26 (definitivo, ver desactivarWorkerPdfjs): el mismatch de versión
// seguía en producción tras los dos fixes anteriores (confirmado en Runtime
// Errors de Vercel: 40 ocurrencias en 7 días, la última el mismo 22/07). En vez
// de seguir intentando resolver la ruta EXACTA del worker, se desactiva el
// worker por completo (pdfjs cae a su FakeWorker de un solo hilo) — elimina la
// clase entera de fallo, no solo el síntoma observado hasta ahora.

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

// FIX 04/07 → 08/07 → 12/07/26: tres intentos de RESOLVER el .mjs del worker
// exacto de la misma versión instalada (por createRequire) fallaron en
// producción con el mismo síntoma: "API version 4.10.38 does not match Worker
// version 4.6.82" — 40 veces en 7 días, la última hoy mismo (22/07 20:19).
// El intento de resolver un workerSrc "no lanzaba excepción" (por eso el
// fallback a fake-worker del catch nunca se disparaba) pero el worker real que
// arrancaba Vercel en su lambda seguía siendo uno de otra versión — muy
// probablemente un artefacto de caché de build de Vercel para ese asset
// estático (`includeFiles`), no reproducible en local, y no reparable desde
// aquí sin forzar un deploy.
//
// FIX 22/07/26 (definitivo): en vez de seguir intentando ACERTAR la ruta del
// worker correcto, se DESACTIVA el worker por completo. Con workerSrc='' y
// workerPort=null, pdfjs-dist cae directo a su FakeWorker (ejecuta el parseo
// en el mismo hilo/proceso, sin Worker de verdad) — más lento en PDFs grandes,
// pero estructuralmente IMPOSIBLE que compruebe versión API-vs-Worker, porque
// no hay un segundo contexto que reporte una versión distinta. Ya limitado a
// 3 páginas (MAX_PAGINAS_OCR) y 60s de tope, así que el coste es asumible.
function desactivarWorkerPdfjs(pdfjs: any): void {
  try {
    if (pdfjs?.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = ''
      pdfjs.GlobalWorkerOptions.workerPort = null
    }
  } catch (e) {
    console.error('[desactivarWorkerPdfjs] no se pudo desactivar el worker:', e instanceof Error ? e.message : String(e))
  }
}

// Rasteriza un PDF escaneado a PNG (primeras páginas) y le pasa Tesseract.
export async function ocrPdfEscaneado(buffer: Buffer): Promise<string> {
  try {
    // import dinámico con cast a any: la subruta legacy de pdfjs no expone
    // typings y romperia `tsc -b`. En runtime resuelve perfectamente.
    const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs' as string)
    desactivarWorkerPdfjs(pdfjs)
    const canvasMod: any = await import('@napi-rs/canvas')
    const createCanvas = canvasMod.createCanvas

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
