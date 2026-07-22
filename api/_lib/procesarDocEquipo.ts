// procesarDocEquipo.ts — orquestador único de ingesta de documentos de personal
// (nómina individual, resumen de nóminas, RLC/RNT de Seguridad Social).
//
// Extraído de _puertas/equipo-subir.ts para que el botón de Equipo Y el cartero
// de correo (facturas-index.ts) llamen exactamente a la misma lógica —
// clasificación por marcadores deterministas (clasificarDocEquipo.ts) + ingesta
// por tipo (subidaDocEquipo.ts) — sin dos motores paralelos que puedan divergir
// o duplicar.
//
// Cero pérdida: si el tipo no trae marcador, si el empleado no se resuelve, o si
// el procesado normal falla, el documento SIEMPRE queda archivado y registrado
// en `equipo_docs_revision` — nunca se descarta en silencio. EXCEPCIÓN explícita
// y deseada: el empleador (es_empleador=true, p.ej. Rubén) y la RNT (decisión de
// Rubén: se archiva y punto) no generan ni dato ni aviso — ver comentarios abajo.
import { supabaseAdmin } from './supabase-admin.js'
import { subirArchivoACarpetaExacta } from './google-drive.js'
import { extraerTextoPDF, pdfTieneTexto } from './extractores.js'
import { extraerTextoOCRGratis } from './ocr-tesseract.js'
import { clasificarDocEquipoTexto, type ClasificacionDocEquipo } from './clasificarDocEquipo.js'
import { procesarNominaIndividual, procesarResumenNominas, procesarSegSocialResumen, procesarAutonomoCuota } from './subidaDocEquipo.js'
import { cargarCandidatosEmpleados, cargarEmpleadores, resolverEmpleado, resolverEmpleadoEnTexto, resolverEmpleadosEnTexto } from './matchEmpleado.js'
import { contarRecibos, partirNominas } from './splitNominas.js'
import { extraerNominaAnthropicTexto } from './extraerNomina.js'

export interface ResultadoDocEquipo {
  status: number
  body: Record<string, unknown>
}

// Supabase Storage rechaza claves con tildes, comas o paréntesis: "Nómina de
// MENDEZ MELO, JUAN RAMON (1).pdf" fallaba al respaldar y el documento se quedaba
// SIN copia — y por tanto sin poder reprocesarse nunca. El nombre bonito se guarda
// igual en la ficha; solo la ruta del archivo se sanea.
function nombreSeguroArchivo(nombre: string): string {
  return (nombre || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'documento.pdf'
}

async function archivarParaRevision(
  buffer: Buffer,
  nombreOriginal: string,
  ext: string,
  clasif: ClasificacionDocEquipo,
  motivo: string,
): Promise<ResultadoDocEquipo['body']> {
  let driveUrl: string | null = null
  let storagePath: string | null = null
  try {
    const drive = await subirArchivoACarpetaExacta(buffer, nombreSeguroArchivo(nombreOriginal), ['EQUIPO', 'SIN_CLASIFICAR'], ext)
    driveUrl = drive.webViewLink || null
    storagePath = drive.storagePath || null
  } catch { /* archivarParaRevision nunca pierde el documento: sigue registrando la fila aunque Drive/Storage fallen del todo */ }

  const { data: fila, error } = await supabaseAdmin
    .from('equipo_docs_revision')
    .insert({
      nombre_archivo: nombreOriginal,
      tipo_detectado: clasif.tipo,
      confianza: clasif.cierto ? 1 : 0,
      motivo,
      empleado_nombre: clasif.empleado_nombre,
      drive_url: driveUrl,
      storage_path: storagePath,
      estado: 'pendiente',
    })
    .select()
    .maybeSingle()

  return {
    ok: true,
    destino: 'revision' as const,
    clasificacion: clasif,
    fila: error ? null : fila,
    error: error?.message,
  }
}

// RNT (decisión de Rubén, PARTE 0.D del encargo): se reconoce y se archiva para
// trazabilidad, pero NO vuelca datos, NO genera avisos, NO deja nada en la cola
// de revisión — que no moleste. Un fallo de Drive tampoco genera aviso: el
// documento simplemente no queda respaldado hasta el próximo reintento manual.
async function archivarRntEnSilencio(buffer: Buffer, nombreOriginal: string, ext: string): Promise<ResultadoDocEquipo['body']> {
  let driveUrl: string | null = null
  try {
    const drive = await subirArchivoACarpetaExacta(buffer, nombreSeguroArchivo(nombreOriginal), ['EQUIPO', 'SEGURIDAD_SOCIAL_RNT'], ext)
    driveUrl = drive.webViewLink || null
  } catch { /* archivado best-effort: la RNT no genera aviso ni aunque Drive falle */ }
  return { ok: true, destino: 'archivado_silencioso', tipo: 'rnt', drive_url: driveUrl }
}

// Registro OBLIGATORIO en imports_log de TODO documento que entra por el tubo de
// Equipo (botón o cartero). Antes este flujo no escribía NUNCA en la bandeja:
// 146 entradas en 30 días, cero errores, cero de Equipo — fallos invisibles.
// Estados: 'procesado' (acabó en su módulo), 'pendiente_revision' (en la cola de
// revisión, visible), 'error' (ni siquiera se pudo leer el texto — en rojo).
async function registrarImportEquipo(
  nombreArchivo: string,
  estado: 'procesado' | 'pendiente_revision' | 'error',
  destino: string,
  detalle: Record<string, unknown>,
): Promise<void> {
  try {
    await supabaseAdmin.from('imports_log').insert({
      archivo_nombre: nombreArchivo,
      archivo_url: null,
      tipo_detectado: String(detalle.tipo_detectado || 'equipo'),
      estado,
      destino_modulo: destino,
      destino_id: null,
      user_id: null,
      detalle,
    })
  } catch (err) {
    // El registro nunca tumba el procesado, pero su fallo tampoco es mudo.
    console.error('[registrarImportEquipo] no se pudo registrar en imports_log:', err instanceof Error ? err.message : String(err))
  }
}

/** Núcleo de ingesta: clasifica y encamina un documento de personal. Usado tanto
 *  por el botón de Equipo (HTTP) como por el cartero de correo — un único motor.
 *  Deja SIEMPRE rastro en imports_log (ver registrarImportEquipo). */
export async function procesarDocumentoEquipo(buffer: Buffer, nombreOriginal: string): Promise<ResultadoDocEquipo> {
  const resultado = await procesarDocumentoEquipoNucleo(buffer, nombreOriginal)
  const body = resultado.body || {}
  const destino = String(body.destino || 'equipo')
  const sinTexto = body.sin_texto_legible === true
  const estado: 'procesado' | 'pendiente_revision' | 'error' =
    sinTexto ? 'error' : destino === 'revision' ? 'pendiente_revision' : 'procesado'
  await registrarImportEquipo(nombreOriginal, estado, `equipo:${destino}`, {
    tipo_detectado: String((body.clasificacion as { tipo?: string } | undefined)?.tipo || body.tipo || 'equipo'),
    destino,
    motivo: (body as { error?: unknown }).error ?? (body.detalles ? 'multi-documento, ver cola de revisión' : undefined),
    multi: body.multi === true || undefined,
    nominas_ok: body.nominas_ok,
    sin_texto_legible: sinTexto || undefined,
  })
  return resultado
}

async function procesarDocumentoEquipoNucleo(buffer: Buffer, nombreOriginal: string): Promise<ResultadoDocEquipo> {
  const ext = (nombreOriginal.split('.').pop() || 'pdf').toLowerCase()

  let texto = ''
  try { texto = await extraerTextoPDF(buffer) } catch (err) {
    console.error('[procesarDocEquipo] extraerTextoPDF lanzó:', err instanceof Error ? err.message : String(err))
    texto = ''
  }
  if (!pdfTieneTexto(texto)) {
    console.error(`[procesarDocEquipo] "${nombreOriginal}": lectura directa sin texto (PDF digital que debería tener capa de texto) — cayendo a OCR de respaldo`)
    try { texto = await extraerTextoOCRGratis(buffer, 'pdf') } catch { /* noop */ }
  }
  // Si ni la lectura directa ni el respaldo sacaron texto, el documento igualmente
  // acabará en revisión (clasificación 'desconocido'), pero el registro de la
  // bandeja lo marcará en ROJO como error de lectura, no como procesado.
  const sinTextoLegible = !pdfTieneTexto(texto)

  const clasif = await clasificarDocEquipoTexto(texto)

  // RNT: fuera del resto del flujo, ni siquiera intenta partirse como multi-nómina.
  if (clasif.cierto && clasif.tipo === 'rnt') {
    return { status: 200, body: await archivarRntEnSilencio(buffer, nombreOriginal, ext) }
  }

  // La gestoría manda SIEMPRE un único PDF con todas las nóminas del mes juntas:
  // aquí se parte en una nómina por trabajador y se procesa cada una igual que si
  // hubieran llegado por separado. Solo si no se puede partir con seguridad (o
  // alguna nómina falla), esa parte va a revisión — cero pérdidas.
  const nRecibos = contarRecibos(texto)
  const esResumen = clasif.cierto && clasif.tipo === 'resumen_nominas'
  if (nRecibos >= 2 && !esResumen && ['pdf'].includes(ext)) {
    const segmentos = await partirNominas(buffer).catch(() => null)
    if (!segmentos) {
      return {
        status: 200,
        body: await archivarParaRevision(buffer, nombreOriginal, ext, clasif,
          `El PDF contiene ${nRecibos} nóminas juntas y no se pudo partir automáticamente (texto ilegible o dos recibos en la misma página)`),
      }
    }
    const [candidatos, empleadores] = await Promise.all([
      cargarCandidatosEmpleados(supabaseAdmin),
      cargarEmpleadores(supabaseAdmin),
    ])
    // Ruido del empleador: el nombre de la empresa/autónomo sale en TODAS las páginas.
    // Un empleado que aparezca en TODOS los segmentos se descarta como candidato de
    // cada segmento (salvo que sea el ÚNICO que aparece: entonces es SU nómina).
    const matchesPorSegmento = segmentos.map(seg => resolverEmpleadosEnTexto(seg.texto, candidatos))
    const idsComunes = new Set(
      (matchesPorSegmento[0] ?? [])
        .map(m => m.empleado_id)
        .filter(id => matchesPorSegmento.every(ms => ms.some(m => m.empleado_id === id)))
    )
    let ok = 0
    let descartadosEmpleador = 0
    const detalles: unknown[] = []
    for (let i = 0; i < segmentos.length; i++) {
      const seg = segmentos[i]
      const clasifSeg = await clasificarDocEquipoTexto(seg.texto)
      const nombreSeg = nombreOriginal.replace(/\.pdf$/i, '') + `_parte${i + 1}.pdf`

      // El empleador nunca genera nómina ni aviso: se descarta en silencio si su
      // nombre quedó aislado en la cabecera del segmento.
      if (clasifSeg.empleado_nombre && resolverEmpleado(clasifSeg.empleado_nombre, clasifSeg.nif_trabajador, empleadores)) {
        descartadosEmpleador++
        detalles.push({ parte: i + 1, descartado: 'empleador', ok: true })
        continue
      }

      const enTexto = matchesPorSegmento[i]
      const sinRuido = enTexto.filter(m => !idsComunes.has(m.empleado_id))
      const porTexto = sinRuido.length === 1 ? sinRuido[0]
        : (sinRuido.length === 0 && enTexto.length === 1 ? enTexto[0] : null)
      let resolucion = resolverEmpleado(clasifSeg.empleado_nombre, clasifSeg.nif_trabajador, candidatos) || porTexto
      // Último recurso AUTOMÁTICO: si ni cabecera ni texto resuelven, se pide a la
      // IA el nombre del trabajador tal cual figura en el recibo (campo
      // empleado_nombre_detectado) y se resuelve con el mismo matcher. Solo si
      // TAMBIÉN falla eso, el segmento va a revisión — y con ese nombre como
      // titular, no con el nombre del archivo (que lleva el del empleador).
      let nombreIA: string | null = null
      if (!resolucion) {
        const ia = await extraerNominaAnthropicTexto(seg.texto).catch(() => null)
        nombreIA = ia?.empleado_nombre_detectado ?? null
        if (nombreIA) {
          if (resolverEmpleado(nombreIA, null, empleadores)) {
            descartadosEmpleador++
            detalles.push({ parte: i + 1, descartado: 'empleador', ok: true })
            continue
          }
          resolucion = resolverEmpleado(nombreIA, null, candidatos)
        }
      }
      if (resolucion) {
        const { status, body: out } = await procesarNominaIndividual(seg.buffer, nombreSeg, resolucion.empleado_id, resolucion.nombre, null, null)
        if (status === 200) { ok++; detalles.push({ parte: i + 1, empleado: resolucion.nombre, ok: true }); continue }
        detalles.push(await archivarParaRevision(seg.buffer, nombreSeg, 'pdf', { ...clasifSeg, empleado_nombre: nombreIA ?? clasifSeg.empleado_nombre }, String(out.motivo_extraccion || out.error || 'no se pudo procesar la nómina')))
        continue
      }
      detalles.push(await archivarParaRevision(seg.buffer, nombreSeg, 'pdf', { ...clasifSeg, empleado_nombre: nombreIA ?? clasifSeg.empleado_nombre },
        `empleado no identificado con seguridad: "${nombreIA || clasifSeg.empleado_nombre || 'sin nombre detectado'}"`))
    }
    if (ok > 0 || descartadosEmpleador > 0) {
      return { status: 200, body: { ok: true, destino: 'nominas', multi: true, nominas_ok: ok, descartados_empleador: descartadosEmpleador, total_partes: segmentos.length, detalles } }
    }
    return { status: 200, body: { ok: true, destino: 'revision', multi: true, nominas_ok: 0, total_partes: segmentos.length, detalles } }
  }

  // Sin marcador determinista → SIEMPRE a revisión, sin importar qué tipo haya
  // adivinado la IA de respaldo. "Certeza, no probabilidad": nada intermedio.
  if (!clasif.cierto) {
    const body = await archivarParaRevision(buffer, nombreOriginal, ext, clasif,
      sinTextoLegible ? 'No se pudo extraer texto del PDF (ni lectura directa ni OCR de respaldo) — revisar el archivo y los logs de la función' : clasif.motivo)
    return { status: 200, body: { ...body, sin_texto_legible: sinTextoLegible || undefined } }
  }

  if (clasif.tipo === 'nomina') {
    const [candidatos, empleadores] = await Promise.all([
      cargarCandidatosEmpleados(supabaseAdmin),
      cargarEmpleadores(supabaseAdmin),
    ])
    // El empleador nunca genera nómina ni aviso.
    if (clasif.empleado_nombre && resolverEmpleado(clasif.empleado_nombre, clasif.nif_trabajador, empleadores)) {
      return { status: 200, body: { ok: true, destino: 'descartado_empleador', clasificacion: clasif } }
    }
    // 1) por el nombre/NIF aislado de la cabecera; 2) si no, buscando al empleado
    // dentro del texto completo del recibo (solo vale si aparece uno y solo uno).
    const resolucion = resolverEmpleado(clasif.empleado_nombre, clasif.nif_trabajador, candidatos)
      || resolverEmpleadoEnTexto(texto, candidatos)
    if (resolucion) {
      const { status, body: out } = await procesarNominaIndividual(
        buffer, nombreOriginal, resolucion.empleado_id, resolucion.nombre, null, null,
      )
      if (status === 200) return { status: 200, body: { ok: true, destino: 'nominas', clasificacion: clasif, resultado: out } }
      return { status: 200, body: await archivarParaRevision(buffer, nombreOriginal, ext, clasif, String(out.motivo_extraccion || out.error || 'no se pudo procesar la nómina')) }
    }
    return { status: 200, body: await archivarParaRevision(buffer, nombreOriginal, ext, clasif, `empleado no identificado con seguridad: "${clasif.empleado_nombre || 'sin nombre detectado'}"`) }
  }

  if (clasif.tipo === 'resumen_nominas') {
    const { status, body: out } = await procesarResumenNominas(buffer, nombreOriginal, null, null)
    if (status === 200) return { status: 200, body: { ok: true, destino: 'resumen_nominas', clasificacion: clasif, resultado: out } }
    return { status: 200, body: await archivarParaRevision(buffer, nombreOriginal, ext, clasif, String(out.motivo_extraccion || out.error || 'no se pudo procesar el resumen de nóminas')) }
  }

  if (clasif.tipo === 'rlc') {
    const { status, body: out } = await procesarSegSocialResumen(buffer, nombreOriginal, null, null)
    if (status === 200) return { status: 200, body: { ok: true, destino: 'seguridad_social', clasificacion: clasif, resultado: out } }
    return { status: 200, body: await archivarParaRevision(buffer, nombreOriginal, ext, clasif, String(out.motivo_extraccion || out.error || 'no se pudo procesar el RLC')) }
  }

  if (clasif.tipo === 'cuota_autonomos') {
    const { data: titular } = await supabaseAdmin.from('titulares').select('id, nombre').eq('nif', clasif.nif_titular).maybeSingle()
    if (!titular) {
      return { status: 200, body: await archivarParaRevision(buffer, nombreOriginal, ext, clasif, `Recibo de cuota de autónomos sin titular identificado (NIF "${clasif.nif_titular || 'no detectado'}" no coincide con ningún titular activo)`) }
    }
    const { status, body: out } = await procesarAutonomoCuota(buffer, nombreOriginal, titular.id as string, titular.nombre as string, null, null)
    if (status === 200) return { status: 200, body: { ok: true, destino: 'autonomos_cuotas', clasificacion: clasif, resultado: out } }
    return { status: 200, body: await archivarParaRevision(buffer, nombreOriginal, ext, clasif, String(out.motivo_extraccion || out.error || 'no se pudo procesar la cuota de autónomos')) }
  }

  // 'desconocido': a revisión con el motivo.
  const bodyDesconocido = await archivarParaRevision(buffer, nombreOriginal, ext, clasif,
    sinTextoLegible ? 'No se pudo extraer texto del PDF (ni lectura directa ni OCR de respaldo) — revisar el archivo y los logs de la función' : clasif.motivo)
  return { status: 200, body: { ...bodyDesconocido, sin_texto_legible: sinTextoLegible || undefined } }
}
