import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from './_lib/supabase-admin.js'
import { descargarArchivoDeDrive } from './_lib/google-drive.js'
import { anthropicBootstrapActivo, extraerFacturaAnthropicTexto, extraerFacturaAnthropicVisionUltimoRecurso } from './_lib/ocr-anthropic.js'
import { extraerTextoOCRGratis } from './_lib/ocr-tesseract.js'
import { matchFactura, aplicarMatching } from './_lib/matching.js'

export const config = { maxDuration: 300 }

// BOOTSTRAP OCR (Claude) — lee al 100% por Anthropic toda factura incompleta
// que el lector gratis (reglas + Tesseract) no resolvió:
//   (a) sin importe (total null/0), o
//   (b) marcada pendiente_releer_ocr=true (p.ej. nombre = NIF / sin categoría).
//
// GATILLO: NO trabaja en bucle. Solo procesa cuando hay una subida de facturas reciente
// (sesión OCR creada en los últimos MINUTOS_VENTANA) o cuando se le llama con ?manual=1.
// Cualquier toque periódico en vacío sale sin hacer nada y sin coste.
//
// AUTO-ENCADENADO: una sola pulsación procesa TODO. Cada pasada trabaja un time-budget
// y, si quedan facturas, dispara sola la siguiente pasada; cuando no queda ninguna, para
// por sí misma. El usuario no tiene que repetir clics.
//
// Por cada factura: Mistral OCR -> extracción estructurada (cualquier idioma) -> escribe
// los datos que falten, aprende la plantilla por NIF (resto del proveedor gratis) y
// concilia. SEGURIDAD FISCAL: si la factura YA tenía importe e IVA español desglosado
// (4/10/21), se conserva ese desglose y Mistral solo rellena lo ausente. Candado por NIF.

const PRESUPUESTO_MS = 250_000
const LOTE_DB = 8
const MINUTOS_VENTANA = 30

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!anthropicBootstrapActivo()) {
    return res.status(200).json({ ok: false, motivo: 'bootstrap desactivado (faltan OCR_BOOTSTRAP_API o ANTHROPIC_API_KEY)' })
  }

  // GATILLO: solo tras subida reciente de facturas, o disparo manual explícito.
  const manualTrigger = req.query?.manual === '1' || req.query?.manual === 'true'
  if (!manualTrigger) {
    const desde = new Date(Date.now() - MINUTOS_VENTANA * 60 * 1000).toISOString()
    const { count: subidaReciente } = await supabaseAdmin
      .from('ocr_sessions').select('id', { count: 'exact', head: true })
      .gte('creado_en', desde)
    if (!subidaReciente) {
      return res.status(200).json({
        ok: true, en_espera: true,
        motivo: 'sin subida reciente; el OCR Mistral solo se ejecuta tras subir facturas (o con ?manual=1)',
      })
    }
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
        const texto = await extraerTextoOCRGratis(buffer, 'pdf')
        let ext = texto.length >= 20 ? await extraerFacturaAnthropicTexto(texto) : null
        // Vision de último recurso: si texto vacío o extracción fallida, y NIF no tiene vision_usada
        if (!ext || !ext.total || ext.total <= 0) {
          const nifCand = f.nif_emisor as string | null
          let visionUsada = false
          if (nifCand) {
            const { data: rc } = await supabaseAdmin.from('reglas_conciliacion')
              .select('vision_usada').eq('patron_nif', nifCand).maybeSingle()
            visionUsada = rc?.vision_usada === true
          }
          if (!visionUsada) {
            ext = await extraerFacturaAnthropicVisionUltimoRecurso(buffer, 'pdf', 'application/pdf')
            if (ext?.nif_emisor) {
              await supabaseAdmin.from('reglas_conciliacion')
                .update({ vision_usada: true }).eq('patron_nif', ext.nif_emisor)
            }
          }
        }

        if (!ext || !ext.total || ext.total <= 0) {
          // No legible ni por Tesseract ni Claude: dejar en manual y desmarcar la cola.
          await supabaseAdmin.from('facturas')
            .update({ estado: 'pendiente_lectura_manual', pendiente_releer_ocr: false, error_mensaje: 'Ni Tesseract ni Claude pudieron leer. Lectura manual.' })
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
          update.ocr_raw = { ...ext, origen_lectura: 'anthropic_bootstrap_solo_identidad', fiscal_preservado: true }
          update.estado = 'procesando'
        } else {
          update.fecha_factura = ext.fecha_factura
          update.base_4 = ext.base_4; update.iva_4 = ext.iva_4
          update.base_10 = ext.base_10; update.iva_10 = ext.iva_10
          update.base_21 = ext.base_21; update.iva_21 = ext.iva_21
          update.total = ext.total
          update.ocr_raw = { ...ext, origen_lectura: 'anthropic_bootstrap' }
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
      // Tanda entera a manual: posible problema (clave/saldo). Salir de esta llamada.
      break
    }
  }

  await supabaseAdmin.from('reproc_control').update({
    activo: !agotadas, ultimo_run: new Date().toISOString(),
  }).eq('id', ctrlId)

  // AUTO-ENCADENADO: si quedan facturas y esta tanda avanzó, dispara la siguiente pasada
  // sin esperar su respuesta. Cuando el lote sale vacío (agotadas) NO se reencadena: para
  // sola. La guarda okTanda>0 evita bucles si nada progresa.
  if (!agotadas && okTanda > 0) {
    const host = (req.headers['x-forwarded-host'] as string) || (req.headers.host as string)
    if (host) {
      const self = `https://${host}/api/bootstrap-ocr?manual=1`
      try { void fetch(self, { method: 'GET' }).catch(() => {}) } catch { /* noop */ }
      await new Promise((r) => setTimeout(r, 600))
    }
  }

  return res.status(200).json({
    ok: true, terminado: agotadas, autocontinua: !agotadas && okTanda > 0,
    leidas_tanda: okTanda, manual_tanda: manualTanda,
    leidas_total: leidas, manual_total: manual, conciliadas_total: conciliadas, procesadas,
  })
}
