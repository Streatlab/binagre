/**
 * /api/facturas/reprocesar
 *
 * Reprocesa facturas EXISTENTES con el motor nuevo (0 API):
 *   - Baja el PDF de Drive por su pdf_drive_id (no pide nada al usuario)
 *   - Lo re-pasa por el motor (reglas + diccionario NIF + plantilla)
 *   - Re-ejecuta match contra conciliación (trae categoría + contraparte)
 *   - Registra auditoría 1-a-1
 *   - Devuelve informe factura a factura + resumen
 *
 * Procesa por lotes para no exceder el tiempo de función. El front llama en
 * bucle con ?offset= hasta agotar el rango.
 *
 *   POST /api/facturas/reprocesar
 *   body: { desde?: 'YYYY-MM-DD', hasta?: 'YYYY-MM-DD', offset?: number, limite?: number, sesionId?: string }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'
import { procesarArchivo } from '../_lib/procesarArchivo.js'
import { descargarArchivoDeDrive } from '../_lib/google-drive.js'

export const config = { maxDuration: 300 }

const LOTE_DEFAULT = 25

interface LineaInforme {
  factura_id: string
  archivo: string | null
  proveedor: string | null
  total: number | null
  resultado: 'ok' | 'duplicada' | 'error' | 'sin_pdf'
  estado_final: string | null
  conciliada: boolean
  en_drive: boolean
  motivo: string | null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = (req.body || {}) as {
    desde?: string
    hasta?: string
    offset?: number
    limite?: number
    sesionId?: string
  }
  const offset = Number(body.offset || 0)
  const limite = Math.min(Number(body.limite || LOTE_DEFAULT), 50)
  const sesionId = body.sesionId || `reproc-${Date.now().toString(36)}`

  // Seleccionar facturas del rango que tengan PDF en Drive
  let q = supabaseAdmin
    .from('facturas')
    .select('id, pdf_drive_id, pdf_original_name, proveedor_nombre, fecha_factura, total')
    .not('pdf_drive_id', 'is', null)
    .order('fecha_factura', { ascending: true })
    .range(offset, offset + limite - 1)

  if (body.desde) q = q.gte('fecha_factura', body.desde)
  if (body.hasta) q = q.lte('fecha_factura', body.hasta)

  const { data: facturas, error } = await q
  if (error) return res.status(500).json({ error: error.message })

  const lineas: LineaInforme[] = []

  for (const f of facturas || []) {
    const driveId = f.pdf_drive_id as string | null
    const nombre = (f.pdf_original_name as string) || `${f.id}.pdf`

    if (!driveId) {
      lineas.push({
        factura_id: f.id as string,
        archivo: nombre,
        proveedor: (f.proveedor_nombre as string) || null,
        total: f.total != null ? Number(f.total) : null,
        resultado: 'sin_pdf',
        estado_final: null,
        conciliada: false,
        en_drive: false,
        motivo: 'sin pdf_drive_id',
      })
      continue
    }

    try {
      const buffer = await descargarArchivoDeDrive(driveId)
      // Borrar la factura vieja para que el motor la recree limpia con el
      // hash del PDF (el motor detecta duplicado por hash; al borrar antes,
      // se reinserta con la lógica nueva).
      await supabaseAdmin.from('facturas_gastos').delete().eq('factura_id', f.id as string)
      await supabaseAdmin.from('facturas_plataforma_detalle').delete().eq('factura_id', f.id as string)
      await supabaseAdmin.from('facturas').delete().eq('id', f.id as string)

      const resultados = await procesarArchivo(supabaseAdmin, { nombre, buffer }, sesionId)
      const r = resultados[0]
      const fac = (r.factura || r.factura_existente) as Record<string, unknown> | undefined
      lineas.push({
        factura_id: (r.factura_id as string) || (f.id as string),
        archivo: nombre,
        proveedor: (fac?.proveedor_nombre as string) || (f.proveedor_nombre as string) || null,
        total: fac?.total != null ? Number(fac.total) : (f.total != null ? Number(f.total) : null),
        resultado: r.estado === 'ok' ? 'ok' : r.estado === 'duplicada' ? 'duplicada' : 'error',
        estado_final: (fac?.estado as string) || null,
        conciliada: ['conciliada', 'asociada'].includes((fac?.estado as string) || ''),
        en_drive: !!(fac?.pdf_drive_id),
        motivo: r.motivo || r.error || null,
      })
    } catch (e) {
      lineas.push({
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

  const procesadas = lineas.length
  const resumen = {
    procesadas,
    ok: lineas.filter((l) => l.resultado === 'ok').length,
    error: lineas.filter((l) => l.resultado === 'error').length,
    sin_pdf: lineas.filter((l) => l.resultado === 'sin_pdf').length,
    conciliadas: lineas.filter((l) => l.conciliada).length,
    en_drive: lineas.filter((l) => l.en_drive).length,
    hay_mas: procesadas === limite,
    siguiente_offset: offset + procesadas,
    sesionId,
  }

  return res.status(200).json({ resumen, lineas })
}
