// subidaDocEquipo.ts — núcleo compartido de subida de documentos de personal
// (nómina individual, resumen de nóminas, resumen de Seguridad Social). Extraído
// de api/nominas/subir.ts, api/nominas/resumen/subir.ts y api/nominas/segsocial/subir.ts
// para que esos endpoints Y el buzón único de Papeleo (api/equipo/subir.ts) llamen
// exactamente a la misma lógica, sin duplicarla.
import { supabaseAdmin } from './supabase-admin.js'
import { subirArchivoADrive } from './google-drive.js'
import { extraerTextoPDF } from './extractores.js'
import { extraerNominaAnthropicTexto } from './extraerNomina.js'
import { extraerSegSocialAnthropicTexto } from './extraerSegSocialResumen.js'
import { extraerResumenNominasTexto, type FilaResumenNomina } from './extraerResumenNominas.js'
import { cargarNombresEmpleados, resolverNombre } from './resolverEmpleado.js'

export interface ResultadoProceso {
  status: number
  body: Record<string, unknown>
}

export function enteroValido(v: unknown, min: number, max: number): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  const i = Math.round(n)
  return i >= min && i <= max ? i : null
}

export function slug(s: string): string {
  return (s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]+/g, '')
    .replace(/\s+/g, '_')
    .trim()
    .toUpperCase() || 'SIN_NOMBRE'
}

/** Núcleo de api/nominas/subir.ts: nómina de UN empleado ya resuelto (id + nombre conocidos). */
export async function procesarNominaIndividual(
  buffer: Buffer,
  nombreOriginal: string,
  empleadoId: string,
  nombreEmpleado: string,
  mesBody: number | null,
  anioBody: number | null,
): Promise<ResultadoProceso> {
  let texto = ''
  try { texto = await extraerTextoPDF(buffer) } catch { texto = '' }
  const resultado = await extraerNominaAnthropicTexto(texto)

  const mesFinal = mesBody ?? resultado.mes
  const anioFinal = anioBody ?? resultado.anio
  if (!mesFinal || !anioFinal) {
    return {
      status: 400,
      body: {
        error: 'No se pudo determinar mes/año de la nómina; indícalos manualmente.',
        motivo_extraccion: resultado.motivo,
      },
    }
  }

  const ext = (nombreOriginal.split('.').pop() || 'pdf').toLowerCase()
  const mesPad = String(mesFinal).padStart(2, '0')
  const nombreArchivo = `nomina_${anioFinal}-${mesPad}_${slug(nombreEmpleado)}.${ext}`
  const carpetaTitular = `EQUIPO_NOMINAS_${slug(nombreEmpleado)}`

  let drive
  try {
    drive = await subirArchivoADrive(buffer, nombreArchivo, {
      proveedor_nombre: nombreEmpleado,
      numero_factura: `${anioFinal}-${mesPad}`,
      fecha_factura: `${anioFinal}-${mesPad}-01`,
      tipo: 'proveedor',
      plataforma: null,
      carpeta_titular: carpetaTitular,
    }, ext)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { status: 500, body: { error: `Drive: ${msg}` } }
  }

  const estadoNomina: 'ok' | 'revisar' = resultado.estado === 'ok' ? 'ok' : 'revisar'

  const { data: fila, error: errUpsert } = await supabaseAdmin
    .from('nominas')
    .upsert({
      empleado_id: empleadoId,
      mes: mesFinal,
      anio: anioFinal,
      importe_bruto: resultado.importe_bruto,
      importe_neto: resultado.importe_neto,
      irpf_retenido: resultado.irpf_retenido,
      ss_trabajador: resultado.ss_trabajador,
      ss_empresa: resultado.ss_empresa,
      coste_empresa: resultado.coste_empresa,
      estado: estadoNomina,
      pdf_url: drive.webViewLink || null,
      pdf_drive_id: drive.id || null,
      pdf_drive_url: drive.webViewLink || null,
      origen_extraccion: 'ocr_auto',
    }, { onConflict: 'empleado_id,anio,mes' })
    .select()
    .maybeSingle()

  if (errUpsert) return { status: 500, body: { error: errUpsert.message } }

  return {
    status: 200,
    body: {
      ok: true,
      estado: estadoNomina,
      motivo: resultado.motivo,
      campos_dudosos: resultado.campos_dudosos,
      nomina: fila,
    },
  }
}

/** Núcleo de api/nominas/resumen/subir.ts: tabla multi-trabajador de la gestoría. */
export async function procesarResumenNominas(
  buffer: Buffer,
  nombreOriginal: string,
  mesBody: number | null,
  anioBody: number | null,
): Promise<ResultadoProceso> {
  let texto = ''
  try { texto = await extraerTextoPDF(buffer) } catch { texto = '' }
  const resultado = await extraerResumenNominasTexto(texto)

  if (resultado.estado === 'error') {
    return { status: 500, body: { error: resultado.motivo } }
  }
  if (resultado.filas.length === 0) {
    return { status: 422, body: { error: resultado.motivo, estado: resultado.estado } }
  }

  const mesFinal = mesBody ?? resultado.mes
  const anioFinal = anioBody ?? resultado.anio
  if (!mesFinal || !anioFinal) {
    return {
      status: 400,
      body: {
        error: 'No se pudo determinar mes/año del resumen; indícalos manualmente.',
        motivo_extraccion: resultado.motivo,
        filas_leidas: resultado.filas,
      },
    }
  }

  const ext = (nombreOriginal.split('.').pop() || 'pdf').toLowerCase()
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
  } catch {
    driveUrl = null
  }

  const mapaNombres = await cargarNombresEmpleados(supabaseAdmin)

  const insertadas: unknown[] = []
  const yaExistia: unknown[] = []
  const revisarIdentidad: unknown[] = []

  for (const fila of resultado.filas as FilaResumenNomina[]) {
    const resolucion = resolverNombre(fila.trabajador, mapaNombres)
    const filaOut = {
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

  return {
    status: 200,
    body: {
      ok: true,
      mes: mesFinal,
      anio: anioFinal,
      drive_url: driveUrl,
      insertadas,
      ya_existia: yaExistia,
      revisar_identidad: revisarIdentidad,
    },
  }
}

/** Núcleo de api/nominas/segsocial/subir.ts: RLC / resumen mensual de cotización de empresa. */
export async function procesarSegSocialResumen(
  buffer: Buffer,
  nombreOriginal: string,
  mesBody: number | null,
  anioBody: number | null,
): Promise<ResultadoProceso> {
  let texto = ''
  try { texto = await extraerTextoPDF(buffer) } catch { texto = '' }
  const resultado = await extraerSegSocialAnthropicTexto(texto)

  const mesFinal = mesBody ?? resultado.mes
  const anioFinal = anioBody ?? resultado.anio
  if (!mesFinal || !anioFinal) {
    return {
      status: 400,
      body: {
        error: 'No se pudo determinar mes/año del resumen de Seguridad Social; indícalos manualmente.',
        motivo_extraccion: resultado.motivo,
      },
    }
  }

  const ext = (nombreOriginal.split('.').pop() || 'pdf').toLowerCase()
  const mesPad = String(mesFinal).padStart(2, '0')
  const nombreArchivo = `segsocial_${anioFinal}-${mesPad}.${ext}`

  let drive
  try {
    drive = await subirArchivoADrive(buffer, nombreArchivo, {
      proveedor_nombre: 'Seguridad Social',
      numero_factura: `${anioFinal}-${mesPad}`,
      fecha_factura: `${anioFinal}-${mesPad}-01`,
      tipo: 'proveedor',
      plataforma: null,
      carpeta_titular: 'EQUIPO_SEGURIDAD_SOCIAL',
    }, ext)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { status: 500, body: { error: `Drive: ${msg}` } }
  }

  const estadoResumen: 'ok' | 'revisar' = resultado.estado === 'ok' ? 'ok' : 'revisar'

  const { data: fila, error: errUpsert } = await supabaseAdmin
    .from('seguridad_social_resumen')
    .upsert({
      mes: mesFinal,
      anio: anioFinal,
      importe: resultado.importe,
      fecha_cargo: resultado.fecha_cargo,
      pdf_url: drive.webViewLink || null,
      pdf_drive_id: drive.id || null,
      estado: estadoResumen,
    }, { onConflict: 'mes,anio' })
    .select()
    .maybeSingle()

  if (errUpsert) return { status: 500, body: { error: errUpsert.message } }

  return {
    status: 200,
    body: {
      ok: true,
      estado: estadoResumen,
      motivo: resultado.motivo,
      resumen: fila,
    },
  }
}
