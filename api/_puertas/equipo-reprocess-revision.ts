// _puertas/equipo-reprocess-revision.ts — reprocesa automáticamente todos los docs en
// equipo_docs_revision con estado='pendiente' y storage_path conocido. GET manual.
// Útil para vaciar la cola tras corregir una configuración (Drive, empleado, tabla).
// (vive en _puertas: se sirve a través de la puerta /api/operaciones)
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'
import { descargarRespaldoStorage } from '../_lib/google-drive.js'
import { procesarNominaIndividual, procesarResumenNominas, procesarSegSocialResumen, procesarRnt } from '../_lib/subidaDocEquipo.js'
import { cargarCandidatosEmpleados, resolverEmpleado, aprenderAlias } from '../_lib/matchEmpleado.js'

interface FilaRevision {
  id: string
  nombre_archivo: string
  tipo_detectado: string
  empleado_nombre: string | null
  storage_path: string | null
  mes: number | null
  anio: number | null
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const { data: filas, error } = await supabaseAdmin
    .from('equipo_docs_revision')
    .select('id, nombre_archivo, tipo_detectado, empleado_nombre, storage_path, mes, anio')
    .eq('estado', 'pendiente')
    .not('storage_path', 'is', null)

  if (error) return res.status(500).json({ error: error.message })
  if (!filas || filas.length === 0) return res.status(200).json({ ok: true, procesados: 0, mensaje: 'Sin pendientes con storage_path' })

  const candidatos = await cargarCandidatosEmpleados(supabaseAdmin)
  const resultados: Record<string, unknown>[] = []

  for (const fila of filas as FilaRevision[]) {
    const buffer = await descargarRespaldoStorage(fila.storage_path as string)
    if (!buffer) {
      resultados.push({ id: fila.id, ok: false, error: 'No se pudo descargar de Storage' })
      continue
    }

    const nombreArchivo = fila.nombre_archivo || 'documento.pdf'
    let resultado: { status: number; body: Record<string, unknown> }

    if (fila.tipo_detectado === 'nomina') {
      const resolucion = resolverEmpleado(fila.empleado_nombre, null, candidatos)
      if (!resolucion) {
        resultados.push({ id: fila.id, ok: false, error: `Empleado no resuelto: "${fila.empleado_nombre}"` })
        continue
      }
      resultado = await procesarNominaIndividual(buffer, nombreArchivo, resolucion.empleado_id, resolucion.nombre, fila.mes, fila.anio)
      if (resultado.status === 200) {
        await aprenderAlias(supabaseAdmin, resolucion.empleado_id, fila.empleado_nombre)
      }
    } else if (fila.tipo_detectado === 'resumen_nominas') {
      resultado = await procesarResumenNominas(buffer, nombreArchivo, fila.mes, fila.anio)
    } else if (fila.tipo_detectado === 'rlc') {
      resultado = await procesarSegSocialResumen(buffer, nombreArchivo, fila.mes, fila.anio)
    } else if (fila.tipo_detectado === 'rnt') {
      resultado = await procesarRnt(buffer, nombreArchivo, fila.mes, fila.anio)
    } else {
      resultados.push({ id: fila.id, ok: false, error: `Tipo no procesable: ${fila.tipo_detectado}` })
      continue
    }

    if (resultado.status === 200) {
      await supabaseAdmin.from('equipo_docs_revision').update({ estado: 'resuelto' }).eq('id', fila.id)
      resultados.push({ id: fila.id, ok: true, tipo: fila.tipo_detectado })
    } else {
      resultados.push({ id: fila.id, ok: false, tipo: fila.tipo_detectado, error: resultado.body })
    }
  }

  return res.status(200).json({ ok: true, procesados: filas.length, resultados })
}
