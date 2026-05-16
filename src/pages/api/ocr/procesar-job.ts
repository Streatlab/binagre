import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const config = { api: { bodyParser: false }, maxDuration: 300 }

async function procesarArchivo(file: any, jobId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    // Marcar archivo como procesando
    await supabase
      .from('ocr_job_files')
      .update({ estado: 'procesando' })
      .eq('id', file.id)

    // Llamar al endpoint existente de procesamiento OCR
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace('.supabase.co', '.supabase.co')
    
    // Usar la edge function existente si hay, o procesar inline
    const response = await fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'https://binagre.vercel.app'}/api/ocr/procesar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.filename,
        fileData: file.file_data,
        fromJob: true,
        jobId,
      }),
    })

    const result = await response.json()

    if (response.ok) {
      await supabase
        .from('ocr_job_files')
        .update({ estado: 'completado', resultado: result })
        .eq('id', file.id)
      return { ok: true }
    } else {
      await supabase
        .from('ocr_job_files')
        .update({ estado: 'error', error_msg: result.error || 'Error procesando' })
        .eq('id', file.id)
      return { ok: false, error: result.error }
    }
  } catch (err: any) {
    await supabase
      .from('ocr_job_files')
      .update({ estado: 'error', error_msg: err.message })
      .eq('id', file.id)
    return { ok: false, error: err.message }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    // Buscar job en estado procesando
    const { data: job } = await supabase
      .from('ocr_jobs')
      .select('*')
      .eq('estado', 'procesando')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (!job) {
      // No hay job activo, buscar pendiente
      const { data: pendiente } = await supabase
        .from('ocr_jobs')
        .select('id')
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      if (pendiente) {
        await supabase
          .from('ocr_jobs')
          .update({ estado: 'procesando' })
          .eq('id', pendiente.id)
        return res.status(200).json({ action: 'started_next', job_id: pendiente.id })
      }
      return res.status(200).json({ action: 'idle', message: 'No hay jobs pendientes' })
    }

    // Buscar siguiente archivo pendiente del job activo
    const { data: archivo } = await supabase
      .from('ocr_job_files')
      .select('*')
      .eq('job_id', job.id)
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (!archivo) {
      // No quedan archivos pendientes → job completado
      const { data: stats } = await supabase
        .from('ocr_job_files')
        .select('estado')
        .eq('job_id', job.id)

      const procesados = stats?.filter(f => f.estado === 'completado').length || 0
      const errores = stats?.filter(f => f.estado === 'error').length || 0

      await supabase
        .from('ocr_jobs')
        .update({
          estado: errores > 0 && procesados === 0 ? 'error' : 'completado',
          archivos_procesados: procesados,
          archivos_error: errores,
          archivo_actual: null,
          completed_at: new Date().toISOString(),
          mensaje: `${procesados} procesados, ${errores} errores`,
        })
        .eq('id', job.id)

      // Arrancar siguiente pendiente
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

      return res.status(200).json({ action: 'completed', job_id: job.id, procesados, errores })
    }

    // Procesar archivo
    await supabase
      .from('ocr_jobs')
      .update({ archivo_actual: archivo.filename })
      .eq('id', job.id)

    const result = await procesarArchivo(archivo, job.id)

    // Actualizar contadores del job
    const { data: statsPost } = await supabase
      .from('ocr_job_files')
      .select('estado')
      .eq('job_id', job.id)

    const procesados = statsPost?.filter(f => f.estado === 'completado').length || 0
    const errores = statsPost?.filter(f => f.estado === 'error').length || 0

    await supabase
      .from('ocr_jobs')
      .update({
        archivos_procesados: procesados,
        archivos_error: errores,
      })
      .eq('id', job.id)

    return res.status(200).json({
      action: 'processed',
      job_id: job.id,
      file: archivo.filename,
      ok: result.ok,
      procesados,
      errores,
      restantes: job.archivos_total - procesados - errores,
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}
