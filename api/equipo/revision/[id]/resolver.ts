// api/equipo/revision/[id]/resolver.ts — reasigna el tipo correcto a una fila
// pendiente de equipo_docs_revision y la reprocesa contra el mismo núcleo que
// usa el buzón EQUIPO (api/_lib/subidaDocEquipo.ts). Descarga el documento de la
// copia de respaldo en Storage (nunca hace falta que Rubén vuelva a subirlo).
//
// Autoaprendizaje: si Rubén asigna manualmente una nómina a un empleado, el
// nombre tal cual venía en el documento se guarda como alias de ese empleado
// (api/_lib/matchEmpleado.ts) — la próxima vez que aparezca ese mismo nombre se
// resuelve solo, sin volver a preguntar.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../../../_lib/supabase-admin.js'
import { descargarRespaldoStorage } from '../../../_lib/google-drive.js'
import { procesarNominaIndividual, procesarResumenNominas, procesarSegSocialResumen, procesarRnt } from '../../../_lib/subidaDocEquipo.js'
import { aprenderAlias } from '../../../_lib/matchEmpleado.js'

interface BodyResolver {
  tipo_correcto?: 'nomina' | 'resumen_nominas' | 'rlc' | 'rnt' | 'descartar'
  empleado_id?: string
  mes?: number
  anio?: number
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const id = req.query.id as string
  if (!id) return res.status(400).json({ error: 'Falta id' })

  const body = (req.body || {}) as BodyResolver
  if (!body.tipo_correcto) return res.status(400).json({ error: 'Falta tipo_correcto' })

  const { data: fila, error: errFila } = await supabaseAdmin
    .from('equipo_docs_revision')
    .select('id, nombre_archivo, mes, anio, empleado_nombre, storage_path, estado')
    .eq('id', id)
    .maybeSingle()
  if (errFila || !fila) return res.status(404).json({ error: errFila?.message || 'No encontrado' })

  if (body.tipo_correcto === 'descartar') {
    await supabaseAdmin.from('equipo_docs_revision').update({ estado: 'descartado' }).eq('id', id)
    return res.status(200).json({ ok: true })
  }

  if (!fila.storage_path) {
    return res.status(400).json({ error: 'Este documento no tiene copia de respaldo localizable; no se puede reprocesar.' })
  }
  const buffer = await descargarRespaldoStorage(fila.storage_path as string)
  if (!buffer) return res.status(500).json({ error: 'No se pudo descargar la copia de respaldo del documento.' })

  const nombreArchivo = (fila.nombre_archivo as string) || 'documento.pdf'
  const mesFinal = body.mes ?? (fila.mes as number | null)
  const anioFinal = body.anio ?? (fila.anio as number | null)

  let resultado: { status: number; body: Record<string, unknown> }
  if (body.tipo_correcto === 'nomina') {
    if (!body.empleado_id) return res.status(400).json({ error: 'Falta empleado_id' })
    const { data: empleado, error: errEmpleado } = await supabaseAdmin
      .from('empleados').select('id, nombre').eq('id', body.empleado_id).maybeSingle()
    if (errEmpleado || !empleado) return res.status(404).json({ error: errEmpleado?.message || 'Empleado no encontrado' })
    resultado = await procesarNominaIndividual(buffer, nombreArchivo, empleado.id as string, empleado.nombre as string, mesFinal, anioFinal)
    if (resultado.status === 200) {
      await aprenderAlias(supabaseAdmin, empleado.id as string, fila.empleado_nombre as string | null)
    }
  } else if (body.tipo_correcto === 'resumen_nominas') {
    resultado = await procesarResumenNominas(buffer, nombreArchivo, mesFinal, anioFinal)
  } else if (body.tipo_correcto === 'rlc') {
    resultado = await procesarSegSocialResumen(buffer, nombreArchivo, mesFinal, anioFinal)
  } else if (body.tipo_correcto === 'rnt') {
    resultado = await procesarRnt(buffer, nombreArchivo, mesFinal, anioFinal)
  } else {
    return res.status(400).json({ error: 'tipo_correcto no reconocido' })
  }

  if (resultado.status !== 200) return res.status(resultado.status).json(resultado.body)

  await supabaseAdmin.from('equipo_docs_revision').update({ estado: 'resuelto' }).eq('id', id)
  return res.status(200).json({ ok: true, resultado: resultado.body })
}
