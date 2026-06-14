import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from './_lib/supabase-admin.js'
import { descargarArchivoDeDrive } from './_lib/google-drive.js'
import { ocrMistralTexto, extraerFacturaMistral, bootstrapApiActivo } from './_lib/ocr-mistral.js'
import { matchFactura, aplicarMatching } from './_lib/matching.js'

export const config = { maxDuration: 300 }

// BOOTSTRAP OCR (backfill de pago acotado) — resuelve el atraso de facturas que el
// lector gratis (reglas + Tesseract) no pudo leer, sin tocar el flujo normal.
// Por cada factura sin importe: Mistral OCR → extracción estructurada (cualquier
// idioma) → si saca total, escribe los datos, aprende la plantilla por NIF (para que
// las demás del proveedor se concilien gratis) y concilia. Si no, queda en manual.
// Time-budget en una sola llamada; una red espaciada lo reanuda. Candado por NIF:
// salta facturas cuyo NIF ya tiene plantilla (esas se leen gratis por reproc normal).

const PRESUPUESTO_MS = 250_000
const LOTE_DB = 6

interface Ctrl { id: string }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!bootstrapApiActivo()) {
    return res.status(200).json({ ok: false, motivo: 'bootstrap desactivado (faltan OCR_BOOTSTRAP_API o MISTRAL_API_KEY)' })
  }

  const arranque = Date.now()
  const ctrlId = 'bootstrap-ocr'

  // Control de progreso (reutiliza reproc_control como tabla de estado).
  let { data: job } = await supabaseAdmin
    .from('reproc_control').select('*').eq('id', ctrlId).maybeSingle()
  if (!job) {
    const { count } = await supabaseAdmin
      .from('facturas').select('id', { count: 'exact', head: true })
      .or('total.is.null,total.eq.0')
      .not('pdf_drive_id', 'is', null)
      .in('estado', ['sin_match', 'pendiente_lectura_manual'])
    await supabaseAdmin.from('reproc_control').insert({
      id: ctrlId, activo: true, solo_sin_leer: true,
      total_objetivo: count ?? 0, procesadas: 0, ok: 0, errores: 0, conciliadas: 0,
      offset_actual: 0, sesion_id: ctrlId, creado: new Date().toISOString(),
    })
    job = (await supabaseAdmin.from('reproc_control').select('*').eq('id', ctrlId).maybeSingle()).data
  }
  if (!job?.activo) return res.status(200).json({ ok: true, terminado: true, mensaje: 'bootstrap inactivo' })

  let leidas = Number(job.ok || 0)
  let manual = Number(job.errores || 0)
  let conciliadas = Number(job.conciliadas || 0)
  let procesadas = Number(job.procesadas || 0)
  let okTanda = 0, manualTanda = 0
  let agotadas = false

  while (Date.now() - arranque < PRESUPUESTO_MS) {
    const { data: lote, error } = await supabaseAdmin
      .from('facturas')
      .select('id, pdf_drive_id, pdf_original_name, nif_emisor')
      .or('total.is.null,total.eq.0')
      .not('pdf_drive_id', 'is', null)
      .in('estado', ['sin_match', 'pendiente_lectura_manual'])
      .order('fecha_factura', { ascending: true })
      .limit(LOTE_DB)
    if (error) return res.status(500).json({ error: error.message })
    if (!lote || lote.length === 0) { agotadas = true; break }

    let okEsta = 0
    for (const f of lote) {
      try {
        const buffer = await descargarArchivoDeDrive(f.pdf_drive_id as string)
        const texto = await ocrMistralTexto(buffer, 'pdf')
        const ext = texto ? await extraerFacturaMistral(texto) : null

        if (!ext || !ext.total || ext.total <= 0) {
          // No legible ni por Mistral: dejar en manual y SALIR del conjunto.
          await supabaseAdmin.from('facturas')
            .update({ estado: 'pendiente_lectura_manual', error_mensaje: 'Ni Tesseract ni Mistral pudieron leer. Lectura manual.' })
            .eq('id', f.id as string)
          manual++; manualTanda++; procesadas++
          continue
        }

        const nifEmisor = ext.nif_emisor
        // Escribir los datos leídos en la factura.
        await supabaseAdmin.from('facturas').update({
          proveedor_nombre: ext.proveedor_nombre,
          numero_factura: ext.numero_factura || null,
          fecha_factura: ext.fecha_factura,
          nif_emisor: nifEmisor,
          base_21: ext.base_21, iva_21: ext.iva_21,
          total: ext.total,
          ocr_confianza: ext.confianza,
          ocr_raw: { ...ext, origen_lectura: 'mistral_bootstrap' },
          error_mensaje: null,
          estado: 'procesando',
        }).eq('id', f.id as string)

        // Aprender plantilla por NIF (candado): si el NIF no está, se inserta.
        if (nifEmisor && ext.proveedor_nombre) {
          const { data: ya } = await supabaseAdmin
            .from('reglas_conciliacion').select('id').eq('patron_nif', nifEmisor).maybeSingle()
          if (!ya) {
            await supabaseAdmin.from('reglas_conciliacion').insert({
              patron: ext.proveedor_nombre, tipo_categoria: 'gasto', patron_nif: nifEmisor,
              razon_social: ext.proveedor_nombre, activa: true, prioridad: 50,
            })
          }
        }

        // Conciliar (admite titular NULL).
        try {
          const r = await matchFactura(supabaseAdmin, { ...ext, id: f.id as string, total: ext.total, titular_id: null })
          await aplicarMatching(supabaseAdmin, f.id as string, r, { proveedor_nombre: ext.proveedor_nombre, nif_emisor: nifEmisor })
          if (['conciliada', 'asociada'].includes(r.estado)) conciliadas++
        } catch { /* matching best-effort */ }

        leidas++; okEsta++; okTanda++; procesadas++
      } catch (e) {
        await supabaseAdmin.from('facturas')
          .update({ estado: 'pendiente_lectura_manual', error_mensaje: `Bootstrap error: ${e instanceof Error ? e.message : String(e)}` })
          .eq('id', f.id as string)
        manual++; manualTanda++; procesadas++
      }
    }

    await supabaseAdmin.from('reproc_control').update({
      procesadas, ok: leidas, errores: manual, conciliadas, ultimo_run: new Date().toISOString(),
    }).eq('id', ctrlId)

    if (okEsta === 0 && manualTanda >= lote.length) {
      // Tanda entera a manual: posible problema (clave/saldo). No cortar el job,
      // pero salir de esta llamada; la red espaciada reintentará.
      break
    }
  }

  await supabaseAdmin.from('reproc_control').update({
    activo: !agotadas, ultimo_run: new Date().toISOString(),
  }).eq('id', ctrlId)

  return res.status(200).json({
    ok: true, terminado: agotadas,
    leidas_tanda: okTanda, manual_tanda: manualTanda,
    leidas_total: leidas, manual_total: manual, conciliadas_total: conciliadas, procesadas,
  })
}
