import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'

/**
 * Devuelve la lista de facturas asociadas sin pdf_drive_id.
 * Como no guardamos el PDF original en storage, NO podemos reintentar automáticamente;
 * el usuario debe usar el botón "Re-subir a Drive" del modal detalle para cada factura.
 *
 * Este endpoint marca las que llevan sin pdf_drive_id y tienen error_mensaje=Drive:…
 * con un flag pdf_perdido=true para que la UI pueda filtrarlas.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { data } = await supabaseAdmin
    .from('facturas')
    .select('id, proveedor_nombre, fecha_factura, total, titular_id, error_mensaje, estado, created_at')
    .is('pdf_drive_id', null)
    .in('estado', ['asociada', 'pendiente_revision'])
    .order('created_at', { ascending: false })

  return res.status(200).json({
    pendientes: data || [],
    total: data?.length || 0,
    instrucciones: 'Abre cada factura del listado y usa "📤 Re-subir a Drive" desde el modal (Tab Resumen).',
  })
}
