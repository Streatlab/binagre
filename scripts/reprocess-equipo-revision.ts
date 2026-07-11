// scripts/reprocess-equipo-revision.ts — reprocesa equipo_docs_revision pendientes
// con storage_path. Ejecutar via: npx tsx scripts/reprocess-equipo-revision.ts
import { createClient } from '@supabase/supabase-js'
import { procesarNominaIndividual, procesarResumenNominas, procesarSegSocialResumen, procesarRnt } from '../api/_lib/subidaDocEquipo.js'
import { cargarCandidatosEmpleados, resolverEmpleado, aprenderAlias } from '../api/_lib/matchEmpleado.js'
import { descargarRespaldoStorage } from '../api/_lib/google-drive.js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://eryauogxcpbgdryeimdq.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const { data: filas, error } = await supabase
  .from('equipo_docs_revision')
  .select('id, nombre_archivo, tipo_detectado, empleado_nombre, storage_path, mes, anio')
  .eq('estado', 'pendiente')
  .not('storage_path', 'is', null)

if (error) { console.error(error.message); process.exit(1) }
if (!filas || filas.length === 0) { console.log('Sin pendientes con storage_path'); process.exit(0) }

console.log(`Procesando ${filas.length} filas…`)
const candidatos = await cargarCandidatosEmpleados(supabase)

for (const fila of filas) {
  const buffer = await descargarRespaldoStorage(fila.storage_path as string)
  if (!buffer) {
    console.log(`[${fila.id}] ERROR: no se pudo descargar de Storage`)
    continue
  }

  const nombreArchivo = fila.nombre_archivo || 'documento.pdf'
  let resultado: { status: number; body: Record<string, unknown> }

  if (fila.tipo_detectado === 'nomina') {
    const resolucion = resolverEmpleado(fila.empleado_nombre, null, candidatos)
    if (!resolucion) {
      console.log(`[${fila.id}] ERROR: empleado no resuelto: "${fila.empleado_nombre}"`)
      continue
    }
    resultado = await procesarNominaIndividual(buffer, nombreArchivo, resolucion.empleado_id, resolucion.nombre, fila.mes, fila.anio)
    if (resultado.status === 200) await aprenderAlias(supabase, resolucion.empleado_id, fila.empleado_nombre)
  } else if (fila.tipo_detectado === 'resumen_nominas') {
    resultado = await procesarResumenNominas(buffer, nombreArchivo, fila.mes, fila.anio)
  } else if (fila.tipo_detectado === 'rlc') {
    resultado = await procesarSegSocialResumen(buffer, nombreArchivo, fila.mes, fila.anio)
  } else if (fila.tipo_detectado === 'rnt') {
    resultado = await procesarRnt(buffer, nombreArchivo, fila.mes, fila.anio)
  } else {
    console.log(`[${fila.id}] SKIP: tipo no procesable: ${fila.tipo_detectado}`)
    continue
  }

  if (resultado.status === 200) {
    await supabase.from('equipo_docs_revision').update({ estado: 'resuelto' }).eq('id', fila.id)
    console.log(`[${fila.id}] OK: ${fila.tipo_detectado} → resuelto`)
  } else {
    console.log(`[${fila.id}] FALLO: ${fila.tipo_detectado} →`, resultado.body)
  }
}
