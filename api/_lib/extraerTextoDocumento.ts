// extraerTextoDocumento.ts — lectura de texto AGNÓSTICA AL FORMATO para el tubo de
// EQUIPO (botón y cartero). El contenido manda, nunca la extensión: un mismo botón
// acepta PDF, imágenes, hojas de cálculo, Word, CSV/TXT/HTML, etc. y aquí se extrae
// el texto con el lector que corresponda, reutilizando lo que ya existe en
// extractores.ts (Facturas ya lo hacía) en vez de escribir lectores nuevos.
//   · PDF        → texto embebido (unpdf); si es escaneado, OCR gratis.
//   · Imagen     → OCR gratis (tesseract, modo imagen).
//   · Excel      → hoja de cálculo a texto (xlsx).
//   · Word       → mammoth/word-extractor (incl. .doc HTML disfrazado).
//   · Email      → mailparser (cuerpo + cabeceras).
//   · CSV/TXT/HTML u otro → texto plano (limpia HTML si lo parece).
import { extraerTextoPDF, pdfTieneTexto, extraerExcel, extraerWord, extraerEmail, extraerTexto } from './extractores.js'
import { extraerTextoOCRGratis } from './ocr-tesseract.js'
import { detectarTipoArchivo } from './detectarTipo.js'

function comoTexto(data: Buffer | string): string {
  return typeof data === 'string' ? data : data.toString('utf-8')
}

/**
 * Devuelve el texto legible de un documento sea cual sea su formato. Nunca lanza:
 * si un lector falla, devuelve lo que haya podido sacar (o cadena vacía) para que
 * el clasificador decida — un documento sin texto legible acaba en rechazados con
 * su motivo, nunca se pierde.
 */
export async function extraerTextoDocumento(
  buffer: Buffer,
  nombre: string,
  mimeType?: string | null,
): Promise<string> {
  const tipo = detectarTipoArchivo(nombre, mimeType)
  try {
    if (tipo === 'pdf') {
      let texto = ''
      try { texto = await extraerTextoPDF(buffer) } catch { texto = '' }
      if (!pdfTieneTexto(texto)) {
        try { const ocr = await extraerTextoOCRGratis(buffer, 'pdf'); if (ocr) texto = ocr } catch { /* noop */ }
      }
      return texto
    }
    if (tipo === 'imagen') {
      try { return await extraerTextoOCRGratis(buffer, 'imagen') } catch { return '' }
    }
    if (tipo === 'excel') {
      return comoTexto((await extraerExcel(buffer)).data)
    }
    if (tipo === 'word') {
      return comoTexto((await extraerWord(buffer)).data)
    }
    if (tipo === 'email') {
      return comoTexto((await extraerEmail(buffer)).data)
    }
    // CSV / TXT / HTML / desconocido → texto plano (limpiando HTML si lo parece).
    return comoTexto(extraerTexto(buffer.toString('utf-8')).data)
  } catch {
    return ''
  }
}
