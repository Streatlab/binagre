import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const config = { api: { bodyParser: { sizeLimit: '50mb' } } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { tipo = 'factura', archivos, titular_id } = req.body

    if (!archivos || !Array.isArray(archivos) || archivos.length === 0) {
      return res.status(400).json({ error: 'No hay archivos' })
    }

    // Crear job
    const { data: job, error: jobErr } = await supabase
      .from('ocr_jobs')
      .insert({
        tipo,
        estado: 'pendiente',
        archivos_total: archivos.length,
        titular_id: titular_id || null,
      })
      .select()
      .single()

    if (jobErr || !job) {
      return res.status(500).json({ error: jobErr?.message || 'Error creando job' })
    }

    // Insertar archivos del job
    const files = archivos.map((a: { filename: string; data: string }) => ({
      job_id: job.id,
      filename: a.filename,
      file_data: a.data,
      estado: 'pendiente',
    }))

    const { error: filesErr } = await supabase.from('ocr_job_files').insert(files)
    if (filesErr) {
      return res.status(500).json({ error: filesErr.message })
    }

    // Verificar si hay algún job ya procesando
    const { data: activo } = await supabase
      .from('ocr_jobs')
      .select('id')
      .eq('estado', 'procesando')
      .limit(1)
      .single()

    // Si no hay ninguno procesando, arrancar este
    if (!activo) {
      await supabase
        .from('ocr_jobs')
        .update({ estado: 'procesando' })
        .eq('id', job.id)
    }

    return res.status(200).json({ job_id: job.id, estado: activo ? 'pendiente' : 'procesando' })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error interno' })
  }
}
