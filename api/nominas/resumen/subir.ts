// api/nominas/resumen/subir.ts — sube el "Resumen de nóminas" mensual (una tabla
// con TODOS los trabajadores) que manda la gestoría. Delega el núcleo (parseo,
// Drive, resolución de empleados, upsert en `nominas`) a
// api/_lib/subidaDocEquipo.ts, compartido con el buzón único EQUIPO de Papeleo
// (api/equipo/subir.ts) — misma lógica, sin duplicar.
//
// Reglas duras (documentadas en subidaDocEquipo.ts): fila sin empleado resuelto
// con seguridad → revisar_identidad, sin persistir. Fila cuyo empleado+mes+año ya
// tiene nómina → ya_existia, sin tocarla.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { procesarResumenNominas, enteroValido } from '../../_lib/subidaDocEquipo.js'

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
  maxDuration: 60,
}

interface BodySubirResumen {
  base64?: string
  nombre_archivo?: string
  mes?: number
  anio?: number
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = (req.body || {}) as BodySubirResumen
  if (!body.base64) return res.status(400).json({ error: 'Falta base64' })

  const buffer = Buffer.from(body.base64, 'base64')
  const mesBody = enteroValido(body.mes, 1, 12)
  const anioBody = enteroValido(body.anio, 2000, 2100)

  const { status, body: out } = await procesarResumenNominas(
    buffer, body.nombre_archivo || 'resumen_nominas.pdf', mesBody, anioBody,
  )
  return res.status(status).json(out)
}
