/**
 * GET /api/facturas/reproc-cron
 *
 * Cron de reprocesado masivo 0 API. Corre solo en Vercel (sin login del usuario).
 * En cada ejecución coge el job activo de reproc_control, procesa un lote,
 * baja cada PDF de Drive, lo re-pasa por el motor nuevo (reglas + diccionario +
 * match + categoría/contraparte + auditoría 1-a-1) y guarda el informe línea a
 * línea en reproc_informe. Avanza el offset hasta agotar el rango.
 *
 * Programado en vercel.json para correr cada minuto mientras haya job activo.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'
import { procesarArchivo } from '../_lib/procesarArchivo.js'
import { descargarArchivoDeDrive } from '../_lib/google-drive.js'

export const config = { maxDuration: 300 }

const LOTE = 20

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = req.headers.authorization || ''
  const secret = process.env.CRON_SECRET || ''
  if (secret && auth !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Job activo (el más antiguo)
  const { data: job } = await supabaseAdmin
    .from('reproc_control')
    .select('*')
    .eq('activo', true)
    .order('creado', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!job) {
    return res.status(200).json({ ok: true, mensaje: 'Sin jobs activos' })
  }

  const offset = Number(job.offset_actual || 0)
  const sesionId = (job.sesion_id as string) || `reproc-${job.id}`

  let q = supabaseAdmin
    .from('facturas')
    .select('id, pdf_drive_id, pdf_original_name, proveedor_nombre, fecha_factura, total')
    .not('pdf_drive_id', 'is', null)
    .order('fecha_factura', { ascending: true })
    .range(offset, offset + LOTE - 1)

  if (job.desde) q = q.gte('fecha_factura', job.desde as string)
  if (job.hasta) q = q.lte('fecha_factura', job.hasta as string)

  const { data: facturas, error } = await q
  if (error) return res.status(500).json({ error: error.message })

  if (!facturas || facturas.length === 0) {
    // Terminado
    await supabaseAdmin.from('reproc_control').update({ activo: false, ultimo_run: new Date().toISOString() }).eq('id', job.id as string)
    return res.status(200).json({ ok: true, job: job.id, mensaje: 'Job completado', offset })
  }

  let ok = 0, errores = 0, conciliadas = 0
  const lineas: Record<string, unknown>[] = []

  for (const f of facturas) {
    const driveId = f.pdf_drive_id as string
    const nombre = (f.pdf_original_name as string) || `${f.id}.pdf`
    try {
      const buffer = await descargarArchivoDeDrive(driveId)
      await supabaseAdmin.from('facturas_gastos').delete().eq('factura_id', f.id as string)
      await supabaseAdmin.from('facturas_plataforma_detalle').delete().eq('factura_id', f.id as string)
      await supabaseAdmin.from('facturas').delete().eq('id', f.id as string)

      const resultados = await procesarArchivo(supabaseAdmin, { nombre, buffer }, sesionId)
      const r = resultados[0]
      const fac = (r.factura || r.factura_existente) as Record<string, unknown> | undefined
      const estadoFinal = (fac?.estado as string) || null
      const conc = ['conciliada', 'asociada'].includes(estadoFinal || '')
      const resultado = r.estado === 'ok' ? 'ok' : r.estado === 'duplicada' ? 'duplicada' : 'error'
      if (resultado === 'error') errores++; else ok++
      if (conc) conciliadas++
      lineas.push({
        control_id: job.id,
        factura_id: (r.factura_id as string) || (f.id as string),
        archivo: nombre,
        proveedor: (fac?.proveedor_nombre as string) || (f.proveedor_nombre as string) || null,
        total: fac?.total != null ? Number(fac.total) : (f.total != null ? Number(f.total) : null),
        resultado,
        estado_final: estadoFinal,
        conciliada: conc,
        en_drive: !!(fac?.pdf_drive_id),
        motivo: r.motivo || r.error || null,
      })
    } catch (e) {
      errores++
      lineas.push({
        control_id: job.id,
        factura_id: f.id as string,
        archivo: nombre,
        proveedor: (f.proveedor_nombre as string) || null,
        total: f.total != null ? Number(f.total) : null,
        resultado: 'error',
        estado_final: null,
        conciliada: false,
        en_drive: false,
        motivo: e instanceof Error ? e.message : String(e),
      })
    }
  }

  if (lineas.length > 0) await supabaseAdmin.from('reproc_informe').insert(lineas)

  const nuevoOffset = offset + facturas.length
  const terminado = facturas.length < LOTE
  await supabaseAdmin.from('reproc_control').update({
    offset_actual: nuevoOffset,
    procesadas: Number(job.procesadas || 0) + facturas.length,
    ok: Number(job.ok || 0) + ok,
    errores: Number(job.errores || 0) + errores,
    conciliadas: Number(job.conciliadas || 0) + conciliadas,
    ultimo_run: new Date().toISOString(),
    activo: !terminado,
  }).eq('id', job.id as string)

  return res.status(200).json({
    ok: true,
    job: job.id,
    lote: facturas.length,
    ok_lote: ok,
    errores_lote: errores,
    conciliadas_lote: conciliadas,
    nuevo_offset: nuevoOffset,
    terminado,
  })
}
