// subidaDocEquipo.ts — núcleo compartido de subida de documentos de personal
// (nómina individual, resumen de nóminas, RLC y RNT de Seguridad Social). Extraído
// de api/nominas/subir.ts, api/nominas/resumen/subir.ts y api/nominas/segsocial/subir.ts
// para que esos endpoints Y el buzón único de Papeleo (api/equipo/subir.ts) llamen
// exactamente a la misma lógica, sin duplicarla.
//
// Un fallo de Drive (incluso "no configurado") NUNCA bloquea el dato: el registro
// se guarda en su tabla igual, con drive_pendiente=true y drive_error con el
// motivo. api/equipo/reintentar-drive.ts recorre esos pendientes y los archiva
// en cuanto Drive esté disponible, usando drive_niveles+drive_nombre_archivo
// (la ruta exacta ya decidida aquí) para no tener que volver a calcularla.
import { supabaseAdmin } from './supabase-admin.js'
import { subirArchivoACarpetaExacta } from './google-drive.js'
import { extraerTextoPDF } from './extractores.js'
import { extraerNominaAnthropicTexto } from './extraerNomina.js'
import { extraerSegSocialAnthropicTexto } from './extraerSegSocialResumen.js'
import { extraerResumenNominasTexto, type FilaResumenNomina } from './extraerResumenNominas.js'
import { extraerRntTexto, type FilaRnt } from './extraerRnt.js'
import { extraerAutonomoCuotaTexto } from './extraerAutonomoCuota.js'
import { cargarCandidatosEmpleados, resolverEmpleado } from './matchEmpleado.js'

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

interface ResultadoArchivado {
  driveUrl: string | null
  drivePendiente: boolean
  driveError: string | null
  niveles: string[]
  nombreArchivo: string
}

/** Archiva en la ruta EXACTA de EQUIPO. Nunca lanza: si Drive falla, driveUrl queda
 *  null y drivePendiente=true — el llamador guarda el dato de todas formas. */
async function archivarEquipo(buffer: Buffer, nombreArchivo: string, niveles: string[], ext: string): Promise<ResultadoArchivado> {
  try {
    const drive = await subirArchivoACarpetaExacta(buffer, nombreArchivo, niveles, ext)
    if (drive.driveOk) {
      return { driveUrl: drive.webViewLink || null, drivePendiente: false, driveError: null, niveles, nombreArchivo }
    }
    return { driveUrl: null, drivePendiente: true, driveError: 'Drive no disponible en el momento de la subida (documento a salvo en Storage)', niveles, nombreArchivo }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { driveUrl: null, drivePendiente: true, driveError: msg, niveles, nombreArchivo }
  }
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
  // EQUIPO/NOMINAS/<AÑO>/<EMPLEADO>/nomina_<AÑO>-<MES>_<empleado>.pdf
  const niveles = ['EQUIPO', 'NOMINAS', String(anioFinal), slug(nombreEmpleado)]
  const archivado = await archivarEquipo(buffer, nombreArchivo, niveles, ext)

  const estadoNomina: 'ok' | 'revisar' = resultado.estado === 'ok' ? 'ok' : 'revisar'

  // Insert/update manual en vez de upsert(onConflict): el upsert dependía de que
  // PostgREST tuviera la restricción única en su caché de esquema y el 22-jul,
  // tras un día de muchas migraciones, devolvió "no unique or exclusion constraint
  // matching the ON CONFLICT specification" con la restricción existiendo en BD.
  // El camino select→update/insert no depende de esa caché y es determinista.
  const datosNomina = {
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
    pdf_url: archivado.driveUrl,
    pdf_drive_url: archivado.driveUrl,
    origen_extraccion: 'ocr_auto',
    drive_pendiente: archivado.drivePendiente,
    drive_error: archivado.driveError,
    drive_niveles: archivado.niveles,
    drive_nombre_archivo: archivado.nombreArchivo,
  }
  const { data: previa } = await supabaseAdmin
    .from('nominas').select('id')
    .eq('empleado_id', empleadoId).eq('anio', anioFinal).eq('mes', mesFinal)
    .maybeSingle()
  const { data: fila, error: errUpsert } = previa
    ? await supabaseAdmin.from('nominas').update(datosNomina).eq('id', previa.id).select().maybeSingle()
    : await supabaseAdmin.from('nominas').insert(datosNomina).select().maybeSingle()

  if (errUpsert) return { status: 500, body: { error: errUpsert.message } }

  return {
    status: 200,
    body: {
      ok: true,
      estado: estadoNomina,
      motivo: resultado.motivo,
      campos_dudosos: resultado.campos_dudosos,
      drive_pendiente: archivado.drivePendiente,
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
  const nombreArchivo = `resumen_${anioFinal}-${mesPad}.${ext}`
  // EQUIPO/RESUMEN_NOMINAS/<AÑO>/resumen_<AÑO>-<MES>.pdf
  const niveles = ['EQUIPO', 'RESUMEN_NOMINAS', String(anioFinal)]
  const archivado = await archivarEquipo(buffer, nombreArchivo, niveles, ext)

  const candidatos = await cargarCandidatosEmpleados(supabaseAdmin)

  const insertadas: unknown[] = []
  const yaExistia: unknown[] = []
  const revisarIdentidad: unknown[] = []

  for (const fila of resultado.filas as FilaResumenNomina[]) {
    const resolucion = resolverEmpleado(fila.trabajador, null, candidatos)
    const filaOut = {
      trabajador: fila.trabajador,
      bruto: fila.bruto,
      neto: fila.neto,
      irpf: fila.irpf,
      ss_total: fila.ss_total,
      coste_empresa: fila.coste_empresa,
    }

    // Cero pérdidas: cualquier fila que no acabe en `nominas` (trabajador no
    // reconocido O error al guardar) queda en la cola de revisión con sus importes
    // en payload. Rubén la asigna en un clic (aprende alias) y se crea la nómina
    // desde el payload — no hace falta re-subir el resumen. Sin duplicar: si ya
    // hay una pendiente igual (mismo trabajador/mes/año), no se crea otra.
    const aRevisionConPayload = async (motivo: string) => {
      const { data: yaPendiente } = await supabaseAdmin
        .from('equipo_docs_revision')
        .select('id')
        .eq('estado', 'pendiente')
        .eq('empleado_nombre', fila.trabajador)
        .eq('mes', mesFinal)
        .eq('anio', anioFinal)
        .limit(1)
        .maybeSingle()
      if (yaPendiente) return
      await supabaseAdmin.from('equipo_docs_revision').insert({
        nombre_archivo: `${nombreOriginal} · fila "${fila.trabajador}"`,
        tipo_detectado: 'nomina',
        confianza: 0,
        motivo,
        mes: mesFinal,
        anio: anioFinal,
        empleado_nombre: fila.trabajador,
        drive_url: archivado.driveUrl,
        storage_path: null,
        estado: 'pendiente',
        payload: {
          origen: 'resumen_nominas',
          bruto: fila.bruto, neto: fila.neto, irpf: fila.irpf,
          ss_total: fila.ss_total, coste_empresa: fila.coste_empresa,
          drive_url: archivado.driveUrl,
          drive_pendiente: archivado.drivePendiente,
        },
      })
    }

    if (!resolucion) {
      await aRevisionConPayload(`Trabajador del resumen no reconocido: "${fila.trabajador}". Asigna el empleado para crear su nómina de ${mesFinal}/${anioFinal}.`)
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
      pdf_url: archivado.driveUrl,
      origen_extraccion: 'ocr_auto_resumen',
      drive_pendiente: archivado.drivePendiente,
      drive_error: archivado.driveError,
      drive_niveles: archivado.niveles,
      drive_nombre_archivo: archivado.nombreArchivo,
    })

    if (errInsert) {
      await aRevisionConPayload(`La nómina de "${fila.trabajador}" (${mesFinal}/${anioFinal}) no se pudo guardar: ${errInsert.message}. Asigna el empleado para reintentarlo desde aquí.`)
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
      drive_url: archivado.driveUrl,
      drive_pendiente: archivado.drivePendiente,
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
  const nombreArchivo = `RLC_${anioFinal}-${mesPad}.${ext}`
  // EQUIPO/SEGURIDAD_SOCIAL/<AÑO>/RLC_<AÑO>-<MES>.pdf
  const niveles = ['EQUIPO', 'SEGURIDAD_SOCIAL', String(anioFinal)]
  const archivado = await archivarEquipo(buffer, nombreArchivo, niveles, ext)

  const estadoResumen: 'ok' | 'revisar' = resultado.estado === 'ok' ? 'ok' : 'revisar'

  const { data: fila, error: errUpsert } = await supabaseAdmin
    .from('seguridad_social_resumen')
    .upsert({
      mes: mesFinal,
      anio: anioFinal,
      importe: resultado.importe,
      fecha_cargo: resultado.fecha_cargo,
      pdf_url: archivado.driveUrl,
      estado: estadoResumen,
      tipo_documento: 'rlc',
      drive_pendiente: archivado.drivePendiente,
      drive_error: archivado.driveError,
      drive_niveles: archivado.niveles,
      drive_nombre_archivo: archivado.nombreArchivo,
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
      drive_pendiente: archivado.drivePendiente,
      resumen: fila,
    },
  }
}

/** Núcleo de la RNT (Relación Nominal de Trabajadores): detalle de cotización por
 *  trabajador del mismo envío mensual que el RLC. Mismo patrón que el resumen de
 *  nóminas: resuelve empleado por fila, no persiste las filas sin identidad segura. */
export async function procesarRnt(
  buffer: Buffer,
  nombreOriginal: string,
  mesBody: number | null,
  anioBody: number | null,
): Promise<ResultadoProceso> {
  let texto = ''
  try { texto = await extraerTextoPDF(buffer) } catch { texto = '' }
  const resultado = await extraerRntTexto(texto)

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
        error: 'No se pudo determinar mes/año de la RNT; indícalos manualmente.',
        motivo_extraccion: resultado.motivo,
        filas_leidas: resultado.filas,
      },
    }
  }

  const ext = (nombreOriginal.split('.').pop() || 'pdf').toLowerCase()
  const mesPad = String(mesFinal).padStart(2, '0')
  const nombreArchivo = `RNT_${anioFinal}-${mesPad}.${ext}`
  // EQUIPO/SEGURIDAD_SOCIAL/<AÑO>/RNT_<AÑO>-<MES>.pdf
  const niveles = ['EQUIPO', 'SEGURIDAD_SOCIAL', String(anioFinal)]
  const archivado = await archivarEquipo(buffer, nombreArchivo, niveles, ext)

  const candidatos = await cargarCandidatosEmpleados(supabaseAdmin)

  const insertadas: unknown[] = []
  const yaExistia: unknown[] = []
  const revisarIdentidad: unknown[] = []

  for (const fila of resultado.filas as FilaRnt[]) {
    const resolucion = resolverEmpleado(fila.nombre, null, candidatos)
    const filaOut = {
      nombre: fila.nombre,
      naf: fila.naf,
      base_cotizacion: fila.base_cotizacion,
      importe_empresa: fila.importe_empresa,
      importe_trabajador: fila.importe_trabajador,
    }

    if (!resolucion) {
      revisarIdentidad.push(filaOut)
      continue
    }

    const { data: existente } = await supabaseAdmin
      .from('seguridad_social_rnt')
      .select('id')
      .eq('empleado_id', resolucion.empleado_id)
      .eq('mes', mesFinal)
      .eq('anio', anioFinal)
      .maybeSingle()

    if (existente) {
      yaExistia.push(filaOut)
      continue
    }

    const { error: errInsert } = await supabaseAdmin.from('seguridad_social_rnt').insert({
      empleado_id: resolucion.empleado_id,
      mes: mesFinal,
      anio: anioFinal,
      nombre_en_documento: fila.nombre,
      naf: fila.naf,
      base_cotizacion: fila.base_cotizacion,
      importe_empresa: fila.importe_empresa,
      importe_trabajador: fila.importe_trabajador,
      drive_url: archivado.driveUrl,
      drive_pendiente: archivado.drivePendiente,
      drive_error: archivado.driveError,
      drive_niveles: archivado.niveles,
      drive_nombre_archivo: archivado.nombreArchivo,
    })

    if (errInsert) {
      revisarIdentidad.push({ ...filaOut, nombre: `${fila.nombre} (error al guardar: ${errInsert.message})` })
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
      drive_url: archivado.driveUrl,
      drive_pendiente: archivado.drivePendiente,
      insertadas,
      ya_existia: yaExistia,
      revisar_identidad: revisarIdentidad,
    },
  }
}

/** Núcleo de la cuota mensual de autónomos (RETA/TGSS) de un titular ya resuelto
 *  (Rubén o Emilio, id + nombre conocidos por NIF). LEY-PRUDENCIA-01: se guarda
 *  siempre como 'comprometido' — el cruce con banco (por titular_id + importe
 *  exacto + ventana TGSS) la pasa a 'pagado' desde Costes, no aquí. */
export async function procesarAutonomoCuota(
  buffer: Buffer,
  nombreOriginal: string,
  titularId: string,
  nombreTitular: string,
  mesBody: number | null,
  anioBody: number | null,
): Promise<ResultadoProceso> {
  let texto = ''
  try { texto = await extraerTextoPDF(buffer) } catch { texto = '' }
  const resultado = await extraerAutonomoCuotaTexto(texto)

  const mesFinal = mesBody ?? resultado.mes
  const anioFinal = anioBody ?? resultado.anio
  if (!mesFinal || !anioFinal) {
    return {
      status: 400,
      body: {
        error: 'No se pudo determinar mes/año de la cuota de autónomos; indícalos manualmente.',
        motivo_extraccion: resultado.motivo,
      },
    }
  }

  const ext = (nombreOriginal.split('.').pop() || 'pdf').toLowerCase()
  const mesPad = String(mesFinal).padStart(2, '0')
  const nombreArchivo = `cuota_${anioFinal}-${mesPad}.${ext}`
  // EQUIPO/AUTONOMOS/<TITULAR>/<AÑO>/cuota_<AÑO>-<MES>.pdf
  const niveles = ['EQUIPO', 'AUTONOMOS', slug(nombreTitular), String(anioFinal)]
  const archivado = await archivarEquipo(buffer, nombreArchivo, niveles, ext)

  const { data: fila, error: errUpsert } = await supabaseAdmin
    .from('autonomos_cuotas')
    .upsert({
      titular_id: titularId,
      mes: mesFinal,
      anio: anioFinal,
      importe: resultado.importe,
      fecha_cargo: resultado.fecha_cargo,
      estado: 'comprometido',
      pdf_url: archivado.driveUrl,
      pdf_drive_id: archivado.driveUrl,
      drive_pendiente: archivado.drivePendiente,
      drive_error: archivado.driveError,
      drive_niveles: archivado.niveles,
      drive_nombre_archivo: archivado.nombreArchivo,
    }, { onConflict: 'titular_id,mes,anio' })
    .select()
    .maybeSingle()

  if (errUpsert) return { status: 500, body: { error: errUpsert.message } }

  return {
    status: 200,
    body: {
      ok: true,
      motivo: resultado.motivo,
      drive_pendiente: archivado.drivePendiente,
      cuota: fila,
    },
  }
}
