import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from './_lib/supabase-admin.js'
import { descargarArchivoDeDrive } from './_lib/google-drive.js'
import { extraerTextoPDF, pdfTieneTexto } from './_lib/extractores.js'
import { extraerTextoOCRGratis } from './_lib/ocr-tesseract.js'

export const config = { maxDuration: 120 }

// Diagnóstico temporal: dado un id de factura, descarga su PDF de Drive y
// reporta qué saca cada capa de lectura (capa de texto vs OCR Tesseract).
// NO modifica nada. Sirve para ver por qué el lector no encuentra importe/NIF.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = String(req.query.id || '')
  if (!id) return res.status(400).json({ error: 'falta id' })

  const { data: f, error } = await supabaseAdmin
    .from('facturas')
    .select('id, pdf_original_name, pdf_drive_id, estado, total, nif_emisor')
    .eq('id', id)
    .maybeSingle()
  if (error || !f) return res.status(404).json({ error: 'factura no encontrada' })
  if (!f.pdf_drive_id) return res.status(400).json({ error: 'sin pdf_drive_id' })

  const buffer = await descargarArchivoDeDrive(f.pdf_drive_id as string)
  const bytes = buffer.length

  // Cabecera para distinguir PDF real vs imagen/otro
  const cabecera = buffer.subarray(0, 8).toString('latin1')

  let textoPDF = ''
  try { textoPDF = await extraerTextoPDF(buffer) } catch (e) { textoPDF = `__ERROR__ ${e instanceof Error ? e.message : String(e)}` }
  const tieneTexto = pdfTieneTexto(textoPDF)

  let textoOCR = ''
  if (!tieneTexto) {
    try { textoOCR = await extraerTextoOCRGratis(buffer, 'pdf') } catch (e) { textoOCR = `__ERROR__ ${e instanceof Error ? e.message : String(e)}` }
  }

  const muestra = (tieneTexto ? textoPDF : textoOCR).slice(0, 600)

  return res.status(200).json({
    archivo: f.pdf_original_name,
    bytes,
    cabecera,
    capa_texto_chars: textoPDF.length,
    capa_texto_suficiente: tieneTexto,
    ocr_chars: textoOCR.length,
    muestra_texto: muestra,
  })
}
