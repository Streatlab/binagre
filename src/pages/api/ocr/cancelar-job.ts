import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { job_id } = req.body
    if (!job_id) return res.status(400).json({ error: 'Falta job_id' })

    // Marcar como cancelado
    const { error } = await supabase
      .from('ocr_jobs')
      .update({ estado: 'cancelado', completed_at: new Date().toISOString() })
      .eq('id', job_id)
      .in('estado', ['pendiente', 'procesando'])

    if (error) return res.status(500).json({ error: error.message })

    // Cancelar archivos pendientes de ese job
    await supabase
      .from('ocr_job_files')
      .update({ estado: 'error', error_msg: 'Job cancelado por usuario' })
      .eq('job_id', job_id)
      .eq('estado', 'pendiente')

    // Arrancar siguiente job pendiente si lo hay
    const { data: siguiente } = await supabase
      .from('ocr_jobs')
      .select('id')
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (siguiente) {
      await supabase
        .from('ocr_jobs')
        .update({ estado: 'procesando' })
        .eq('id', siguiente.id)
    }

    return res.status(200).json({ ok: true })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}
