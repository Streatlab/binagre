import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from './_lib/supabase-admin.js'
import { descargarArchivoDeDrive } from './_lib/google-drive.js'
import { extraerTextoPDF, pdfTieneTexto, extraerPorReglas } from './_lib/extractores.js'
import { extraerTextoOCRGratis } from './_lib/ocr-tesseract.js'
import { ocrMistralTexto, bootstrapApiActivo } from './_lib/ocr-mistral.js'

export const config = { maxDuration: 120 }

// Diagnóstico temporal: dado un id de factura, descarga su PDF de Drive y reporta
// qué saca cada capa (texto / Tesseract / Mistral) + si el bootstrap está activo.
// NO modifica nada.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = String(req.query.id || '')
  if (!id) return res.status(400).json({ error: 'falta id' })

  const { data: f, error } = await supabaseAdmin
    .from('facturas')
    .select('id, pdf_original_name, pdf_drive_id')
    .eq('id', id)
    .maybeSingle()
  if (error || !f) return res.status(404).json({ error: 'factura no encontrada' })
  if (!f.pdf_drive_id) return res.status(400).json({ error: 'sin pdf_drive_id' })

  const buffer = await descargarArchivoDeDrive(f.pdf_drive_id as string)

  let textoPDF = ''
  try { textoPDF = await extraerTextoPDF(buffer) } catch { textoPDF = '' }
  const tieneTexto = pdfTieneTexto(textoPDF)

  // Diagnóstico Mistral
  const bootstrapOn = bootstrapApiActivo()
  const tieneKey = !!process.env.MISTRAL_API_KEY
  const flagOn = process.env.OCR_BOOTSTRAP_API === 'true'
  let mistralChars = 0
  let mistralMuestra = ''
  let mistralLeyo = false
  try {
    const tm = await ocrMistralTexto(buffer, 'pdf')
    mistralChars = tm.length
    mistralMuestra = tm.slice(0, 400)
    if (tm && tm.replace(/\s/g, '').length >= 30) {
      const ext = extraerPorReglas(tm, () => null, false)
      mistralLeyo = !!(ext && ext.total)
    }
  } catch (e) {
    mistralMuestra = `__ERROR__ ${e instanceof Error ? e.message : String(e)}`
  }

  return res.status(200).json({
    archivo: f.pdf_original_name,
    capa_texto_chars: textoPDF.length,
    capa_texto_suficiente: tieneTexto,
    bootstrap_activo: bootstrapOn,
    tiene_MISTRAL_API_KEY: tieneKey,
    flag_OCR_BOOTSTRAP_API_true: flagOn,
    mistral_chars: mistralChars,
    mistral_extrae_total: mistralLeyo,
    mistral_muestra: mistralMuestra,
  })
}
