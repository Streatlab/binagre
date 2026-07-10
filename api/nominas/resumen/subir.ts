// api/nominas/resumen/subir.ts — sube el "Resumen de nóminas" mensual (una tabla
// con TODOS los trabajadores) que manda la gestoría, lo archiva en Drive, extrae
// cada fila y la vuelca en `nominas` (una fila por trabajador ya existente en
// `empleados`, resuelto por nombre O por cualquiera de sus alias).
//
// Reglas duras:
//   - Si una fila del documento no se puede atribuir con seguridad a un empleado
//     existente (ver resolverEmpleado.ts: exacto o subconjunto de ≥2 palabras),
//     NO se crea ni se fusiona nada — la fila vuelve en `revisar_identidad` de la
//     respuesta con sus importes leídos, sin persistir en `nominas`.
//   - Si el empleado se resuelve pero YA existe una nómina de ese empleado+mes+año
//     (venga de una subida individual o de un resumen anterior), NO se duplica: la
//     fila vuelve en `ya_existia` sin tocar la fila existente.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../../_lib/supabase-admin.js'
import { subirArchivoADrive } from '../../_lib/google-drive.js'
import { extensionDeNombre } from '../../_lib/detectarTipo.js'
import { extraerTextoPDF } from '../../_lib/extractores.js'
import { extraerResumenNominasTexto, type FilaResumenNomina } from '../../_lib/extraerResumenNominas.js'
import { cargarNombresEmpleados, resolverNombre } from '../../_lib/resolverEmpleado.js'

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

interface FilaResultado {
  trabajador: string
  bruto: number | null
  neto: number | null
  irpf: number | null
  ss_total: number | null
  coste_empresa: number | null
}

function enteroValido(v: unknown, min: number, max: number): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  const i = Math.round(n)
  return i >= min && i <= max ? i : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = (req.body || {}) as BodySubirResumen
  if (!body.base64) return res.status(400).json({ error: 'Falta base64' })

  const buffer = Buffer.from(body.base64, 'base64')

  let texto = ''
  try { texto = await extraerTextoPDF(buffer) } catch { texto = '' }
  const resultado = await extraerResumenNominasTexto(texto)

  if (resultado.estado === 'error') {
    return res.status(500).json({ error: resultado.motivo })
  }
  if (resultado.filas.length === 0) {
    return res.status(422).json({ error: resultado.motivo, estado: resultado.estado })
  }

  const mesBody = enteroValido(body.mes, 1, 12)
  const anioBody = enteroValido(body.anio, 2000, 2100)
  const mesFinal = mesBody ?? resultado.mes
  const anioFinal = anioBody ?? resultado.anio
  if (!mesFinal || !anioFinal) {
    return res.status(400).json({
      error: 'No se pudo determinar mes/año del resumen; indícalos manualmente.',
      motivo_extraccion: resultado.motivo,
      filas_leidas: resultado.filas,
    })
  }

  // Archivo único de empresa (no por empleado): una carpeta propia por año.
  const nombreOriginal = body.nombre_archivo || 'resumen_nominas.pdf'
  const ext = extensionDeNombre(nombreOriginal) || 'pdf'
  const mesPad = String(mesFinal).padStart(2, '0')
  const nombreArchivo = `resumen_nominas_${anioFinal}-${mesPad}.${ext}`

  let driveUrl: string | null = null
  try {
    const drive = await subirArchivoADrive(buffer, nombreArchivo, {
      proveedor_nombre: 'Resumen de nóminas',
      numero_factura: `${anioFinal}-${mesPad}`,
      fecha_factura: `${anioFinal}-${mesPad}-01`,
      tipo: 'proveedor',
      plataforma: null,
      carpeta_titular: 'EQUIPO_RESUMEN_NOMINAS',
    }, ext)
    driveUrl = drive.webViewLink || null
  } catch (err) {
    // No bloquea el volcado a `nominas`: el documento en sí es secundario frente a
    // no perder los importes ya leídos. Se reporta el fallo de Drive en la respuesta.
    driveUrl = null
  }

  const mapaNombres = await cargarNombresEmpleados(supabaseAdmin)

  const insertadas: FilaResultado[] = []
  const yaExistia: FilaResultado[] = []
  const revisarIdentidad: FilaResultado[] = []

  for (const fila of resultado.filas as FilaResumenNomina[]) {
    const resolucion = resolverNombre(fila.trabajador, mapaNombres)
    const filaOut: FilaResultado = {
      trabajador: fila.trabajador,
      bruto: fila.bruto,
      neto: fila.neto,
      irpf: fila.irpf,
      ss_total: fila.ss_total,
      coste_empresa: fila.coste_empresa,
    }

    if (!resolucion) {
      revisarIdentidad.push(filaOut)
      continue
    }

    const { data: existente } = await supabaseAdmin
      .from('nominas')
      .select('id')
      .eq('empleado_id', resolucion.empleado_id)
      .eq('mes', mesFinal)
      .eq('anio', anioFinal)
      .maybeSingle()

    if (existente) {
      yaExistia.push(filaOut)
      continue
    }

    const camposCompletos = [fila.bruto, fila.neto, fila.irpf, fila.ss_total, fila.coste_empresa].every(v => v != null)

    const { error: errInsert } = await supabaseAdmin.from('nominas').insert({
      empleado_id: resolucion.empleado_id,
      mes: mesFinal,
      anio: anioFinal,
      importe_bruto: fila.bruto,
      importe_neto: fila.neto,
      irpf_retenido: fila.irpf,
      // El resumen no siempre separa SS trabajador de SS empresa: si `ss_total` es
      // lo único disponible, se guarda como SS empresa (línea que alimenta Tesorería
      // 13 Semanas) y SS trabajador queda null — no se reparte un total sin base real.
      ss_trabajador: null,
      ss_empresa: fila.ss_total,
      coste_empresa: fila.coste_empresa,
      estado: camposCompletos ? 'ok' : 'revisar',
      pdf_url: driveUrl,
      origen_extraccion: 'ocr_auto_resumen',
    })

    if (errInsert) {
      revisarIdentidad.push({ ...filaOut, trabajador: `${fila.trabajador} (error al guardar: ${errInsert.message})` })
      continue
    }
    insertadas.push(filaOut)
  }

  return res.status(200).json({
    ok: true,
    mes: mesFinal,
    anio: anioFinal,
    drive_url: driveUrl,
    insertadas,
    ya_existia: yaExistia,
    revisar_identidad: revisarIdentidad,
  })
}
