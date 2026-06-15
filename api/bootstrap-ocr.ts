import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from './_lib/supabase-admin.js'
import { descargarArchivoDeDrive } from './_lib/google-drive.js'
import { ocrMistralTexto, extraerFacturaMistral, bootstrapApiActivo } from './_lib/ocr-mistral.js'
import { matchFactura, aplicarMatching } from './_lib/matching.js'

export const config = { maxDuration: 300 }

// BOOTSTRAP OCR (backfill de pago acotado) — lee al 100% por Mistral toda factura
// incompleta que el lector gratis (reglas + Tesseract) no resolvió:
//   (a) sin importe (total null/0), o
//   (b) marcada pendiente_releer_ocr=true (p.ej. nombre = NIF / sin categoría).
// Por cada una: Mistral OCR -> extracción estructurada (cualquier idioma) -> escribe
// los datos que falten, aprende la plantilla por NIF (resto del proveedor gratis) y
// concilia. SEGURIDAD FISCAL: si la factura YA tenía importe e IVA español desglosado
// (4/10/21), se conserva ese desglose y Mistral solo rellena lo ausente
// (proveedor, NIF, nº, fecha). Time-budget en una sola llamada; el disparador espaciado
// lo reanuda. Candado por NIF.

const PRESUPUESTO_MS = 250_000
const LOTE_DB = 6

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!bootstrapApiActivo()) {
    return res.status(200).json({ ok: false, motivo: 'bootstrap desactivado (faltan OCR_BOOTSTRAP_API o MISTRAL_API_KEY)' })
  }

  const arranque = Date.now()
  const ctrlId = 'bootstrap-ocr'

  // Conjunto objetivo: con PDF en Drive y (sin importe O marcada para releer).
  const FILTRO_OBJETIVO = 'total.is.null,total.eq.0,pendiente_releer_ocr.eq.true'

  // Control de progreso (reutiliza reproc_control como tabla de estado).
  let { data: job } = await supabaseAdmin
    .from('reproc_control').select('*').eq('id', ctrlId).maybeSingle()
  if (!job) {
    const { count } = await supabaseAdmin
      .from('facturas').select('id', { count: 'exact', head: true })
      .or(FILTRO_OBJETIVO)
      .not('pdf_drive_id', 'is', null)
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
      .select('id, pdf_drive_id, pdf_original_name, nif_emisor, total, base_4, iva_4, base_10, iva_10, base_21, iva_21, categoria_factura')
      .or(FILTRO_OBJETIVO)
      .not('pdf_drive_id', 'is', null)
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
          // No legible ni por Mistral: dejar en manual y desmarcar la cola.
          await supabaseAdmin.from('facturas')
            .update({ estado: 'pendiente_lectura_manual', pendiente_releer_ocr: false, error_mensaje: 'Ni Tesseract ni Mistral pudieron leer. Lectura manual.' })
            .eq('id', f.id as string)
          manual++; manualTanda++; procesadas++
          continue
        }

        const nifEmisor = ext.nif_emisor

        // ¿La factura ya tenía importe e IVA español desglosado? Entonces preservar
        // todo el bloque fiscal y que Mistral solo aporte identidad del proveedor.
        const teniaImporte = Number(f.total) > 0
        const teniaDesglose = (Number(f.base_4) + Number(f.iva_4) + Number(f.base_10) + Number(f.iva_10) + Number(f.base_21) + Number(f.iva_21)) > 0
        const preservarFiscal = teniaImporte && teniaDesglose

        const update: Record<string, unknown> = {
          proveedor_nombre: ext.proveedor_nombre,
          numero_factura: ext.numero_factura || null,
          nif_emisor: nifEmisor,
          ocr_confianza: ext.confianza,
          error_mensaje: null,
          pendiente_releer_ocr: false,
        }
        if (preservarFiscal) {
          // Mantener total, fecha y desglose existentes (no pisar IVA correcto).
          update.ocr_raw = { ...ext, origen_lectura: 'mistral_bootstrap_solo_identidad', fiscal_preservado: true }
          update.estado = 'procesando'
        } else {
          update.fecha_factura = ext.fecha_factura
          update.base_21 = ext.base_21
          update.iva_21 = ext.iva_21
          update.total = ext.total
          update.ocr_raw = { ...ext, origen_lectura: 'mistral_bootstrap' }
          update.estado = 'procesando'
        }

        await supabaseAdmin.from('facturas').update(update).eq('id', f.id as string)

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

        // Conciliar (admite titular NULL). Usa el total efectivo (preservado o nuevo).
        try {
          const totalEfectivo = preservarFiscal ? Number(f.total) : ext.total
          const r = await matchFactura(supabaseAdmin, { ...ext, id: f.id as string, total: totalEfectivo, titular_id: null })
          await aplicarMatching(supabaseAdmin, f.id as string, r, { proveedor_nombre: ext.proveedor_nombre, nif_emisor: nifEmisor })
          if (['conciliada', 'asociada'].includes(r.estado)) conciliadas++
        } catch { /* matching best-effort */ }

        leidas++; okEsta++; okTanda++; procesadas++
      } catch (e) {
        await supabaseAdmin.from('facturas')
          .update({ estado: 'pendiente_lectura_manual', pendiente_releer_ocr: false, error_mensaje: `Bootstrap error: ${e instanceof Error ? e.message : String(e)}` })
          .eq('id', f.id as string)
        manual++; manualTanda++; procesadas++
      }
    }

    await supabaseAdmin.from('reproc_control').update({
      procesadas, ok: leidas, errores: manual, conciliadas, ultimo_run: new Date().toISOString(),
    }).eq('id', ctrlId)

    if (okEsta === 0 && manualTanda >= lote.length) {
      // Tanda entera a manual: posible problema (clave/saldo). Salir de esta llamada;
      // el disparador espaciado reintentará.
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
