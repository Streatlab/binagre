// _puertas/equipo-rechazados.ts — carpeta ÚNICA de rechazos vista desde la bandeja.
// Todo documento que ningún módulo reconoce (venga del botón que venga o del correo)
// queda registrado en equipo_docs_revision con estado='descartado' y archivado en
// Drive _RECHAZADOS/AAAA-MM. Aquí se listan, se descargan para reenviarlos a mano y
// se marcan como reenviados cuando se rescatan. Nada se borra nunca.
// (vive en _puertas: se sirve a través de la puerta /api/operaciones)
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'
import { descargarRespaldoStorage } from '../_lib/google-drive.js'
import { mimeTypeParaExtension } from '../_lib/detectarTipo.js'

async function listar(res: VercelResponse) {
  const { data, error } = await supabaseAdmin
    .from('equipo_docs_revision')
    .select('id, nombre_archivo, tipo_detectado, motivo, drive_url, storage_path, created_at, payload')
    .eq('estado', 'descartado')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return res.status(500).json({ ok: false, error: error.message })
  const filas = (data || []).map((f) => {
    const payload = (f.payload || {}) as Record<string, unknown>
    return {
      id: f.id,
      nombre_archivo: f.nombre_archivo,
      tipo_detectado: f.tipo_detectado,
      motivo: f.motivo,
      drive_url: f.drive_url,
      tiene_backup: !!f.storage_path,
      origen_boton: (payload.origen_boton as string) || 'equipo',
      created_at: f.created_at,
    }
  })
  return res.status(200).json({ ok: true, rechazados: filas })
}

// Devuelve el documento original (de la copia de respaldo en Storage) en base64,
// para que la bandeja lo reenvíe a mano al botón que corresponda con su flujo normal.
async function descargar(req: VercelRequest, res: VercelResponse) {
  const id = req.query.id as string
  if (!id) return res.status(400).json({ ok: false, error: 'Falta id' })
  const { data: fila, error } = await supabaseAdmin
    .from('equipo_docs_revision')
    .select('id, nombre_archivo, storage_path')
    .eq('id', id)
    .maybeSingle()
  if (error || !fila) return res.status(404).json({ ok: false, error: error?.message || 'No encontrado' })
  if (!fila.storage_path) return res.status(400).json({ ok: false, error: 'El archivo original ya no está guardado.' })
  const buffer = await descargarRespaldoStorage(fila.storage_path as string)
  if (!buffer) return res.status(500).json({ ok: false, error: 'No se pudo descargar la copia de respaldo.' })
  const nombre = (fila.nombre_archivo as string) || 'documento.pdf'
  const ext = (nombre.split('.').pop() || 'pdf').toLowerCase()
  return res.status(200).json({
    ok: true,
    nombre,
    mimeType: mimeTypeParaExtension(ext),
    base64: buffer.toString('base64'),
  })
}

// Descarta un documento del cajón para siempre (decisión de Rubén). No borra
// nada físico: la copia sigue en Drive _RECHAZADOS y en Storage; solo sale de la lista.
async function descartarDefinitivo(req: VercelRequest, res: VercelResponse) {
  const id = req.query.id as string
  if (!id) return res.status(400).json({ ok: false, error: 'Falta id' })
  const { error } = await supabaseAdmin
    .from('equipo_docs_revision')
    .update({ estado: 'resuelto', motivo: 'Descartado desde el cajón de sastre' })
    .eq('id', id)
  if (error) return res.status(500).json({ ok: false, error: error.message })
  return res.status(200).json({ ok: true })
}

// Marca un rechazo como reenviado (sale de la lista) tras rescatarlo a mano.
async function marcarReenviado(req: VercelRequest, res: VercelResponse) {
  const id = req.query.id as string
  if (!id) return res.status(400).json({ ok: false, error: 'Falta id' })
  const destino = (req.body as { destino?: string })?.destino || 'desconocido'
  const { error } = await supabaseAdmin
    .from('equipo_docs_revision')
    .update({ estado: 'resuelto', motivo: `Reenviado a ${destino} desde rechazados` })
    .eq('id', id)
  if (error) return res.status(500).json({ ok: false, error: error.message })
  return res.status(200).json({ ok: true })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') return await listar(res)
    if (req.method === 'POST') {
      const action = (req.query.action as string) || ''
      if (action === 'descargar') return await descargar(req, res)
      if (action === 'reenviado') return await marcarReenviado(req, res)
      if (action === 'descartar') return await descartarDefinitivo(req, res)
      return res.status(400).json({ ok: false, error: 'Acción no reconocida' })
    }
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err)
    if (res.headersSent) return
    return res.status(500).json({ ok: false, error: detalle })
  }
}
