// api/nominas/subir.ts — sube el PDF de nómina de UN empleado ya elegido en la UI
// (selector de empleado en TabNominas). Delega el núcleo (extracción, Drive,
// upsert en `nominas`) a api/_lib/subidaDocEquipo.ts, compartido con el buzón
// único EQUIPO de Papeleo (api/equipo/subir.ts) — misma lógica, sin duplicar.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'
import { procesarNominaIndividual, enteroValido } from '../_lib/subidaDocEquipo.js'

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
  maxDuration: 60,
}

interface BodySubirNomina {
  base64?: string
  nombre_archivo?: string
  empleado_id?: string
  mes?: number
  anio?: number
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = (req.body || {}) as BodySubirNomina
  if (!body.base64) return res.status(400).json({ error: 'Falta base64' })
  if (!body.empleado_id) return res.status(400).json({ error: 'Falta empleado_id' })

  const { data: empleado, error: errEmpleado } = await supabaseAdmin
    .from('empleados')
    .select('id, nombre')
    .eq('id', body.empleado_id)
    .maybeSingle()
  if (errEmpleado || !empleado) {
    return res.status(404).json({ error: errEmpleado?.message || 'Empleado no encontrado' })
  }
  const nombreEmpleado = (empleado.nombre as string) || 'Empleado'

  const buffer = Buffer.from(body.base64, 'base64')
  const mesBody = enteroValido(body.mes, 1, 12)
  const anioBody = enteroValido(body.anio, 2000, 2100)

  const { status, body: out } = await procesarNominaIndividual(
    buffer, body.nombre_archivo || 'nomina.pdf', body.empleado_id, nombreEmpleado, mesBody, anioBody,
  )
  return res.status(status).json(out)
}
