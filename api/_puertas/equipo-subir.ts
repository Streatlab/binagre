// _puertas/equipo-subir.ts — buzón único EQUIPO de Papeleo: recibe un documento suelto
// (nómina, resumen de nóminas, RLC/RNT de Seguridad Social, o cualquier otra cosa),
// lo clasifica por MARCADORES DETERMINISTAS en el texto (api/_lib/clasificarDocEquipo.ts
// — no un score de IA) y lo encamina a la misma lógica que ya usan los endpoints
// antiguos, vía api/_lib/subidaDocEquipo.ts — sin duplicar esa lógica.
//
// Cero pérdida: si el tipo no trae marcador (`cierto=false`), si el empleado de una
// nómina individual no se resuelve, o si el procesado normal falla (p.ej. no se
// pudo determinar mes/año), el documento SIEMPRE queda archivado y registrado en
// `equipo_docs_revision` — nunca se descarta en silencio. Un fallo de Drive NUNCA
// manda un documento a revisión: eso lo gestiona subidaDocEquipo.ts (drive_pendiente).
// (vive en _puertas: se sirve a través de la puerta /api/operaciones)
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'
import { subirArchivoACarpetaExacta } from '../_lib/google-drive.js'
import { extraerTextoPDF, pdfTieneTexto } from '../_lib/extractores.js'
import { extraerTextoOCRGratis } from '../_lib/ocr-tesseract.js'
import { clasificarDocEquipoTexto, type ClasificacionDocEquipo } from '../_lib/clasificarDocEquipo.js'
import { procesarNominaIndividual, procesarResumenNominas, procesarSegSocialResumen, procesarRnt, procesarAutonomoCuota } from '../_lib/subidaDocEquipo.js'
import { cargarCandidatosEmpleados, resolverEmpleado, resolverEmpleadoEnTexto, resolverEmpleadosEnTexto } from '../_lib/matchEmpleado.js'
import { contarRecibos, partirNominas } from '../_lib/splitNominas.js'

interface BodySubirEquipo {
  base64?: string
  nombre_archivo?: string
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
) {
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = (req.body || {}) as BodySubirEquipo
  if (!body.base64) return res.status(400).json({ error: 'Falta base64' })

  const buffer = Buffer.from(body.base64, 'base64')
  const nombreOriginal = body.nombre_archivo || 'documento.pdf'
  const ext = (nombreOriginal.split('.').pop() || 'pdf').toLowerCase()

  let texto = ''
  try { texto = await extraerTextoPDF(buffer) } catch { texto = '' }
  if (!pdfTieneTexto(texto)) {
    try { texto = await extraerTextoOCRGratis(buffer, 'pdf') } catch { /* noop */ }
  }

  const clasif = await clasificarDocEquipoTexto(texto)

  // La gestoría manda SIEMPRE un único PDF con todas las nóminas del mes juntas:
  // aquí se parte en una nómina por trabajador y se procesa cada una igual que si
  // hubieran llegado por separado. Solo si no se puede partir con seguridad (o
  // alguna nómina falla), esa parte va a revisión — cero pérdidas.
  const nRecibos = contarRecibos(texto)
  const esResumen = clasif.cierto && clasif.tipo === 'resumen_nominas'
  if (nRecibos >= 2 && !esResumen && ['pdf'].includes(ext)) {
    const segmentos = await partirNominas(buffer).catch(() => null)
    if (!segmentos) {
      return res.status(200).json(await archivarParaRevision(buffer, nombreOriginal, ext, clasif,
        `El PDF contiene ${nRecibos} nóminas juntas y no se pudo partir automáticamente (texto ilegible o dos recibos en la misma página)`))
    }
    const candidatos = await cargarCandidatosEmpleados(supabaseAdmin)
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
    const detalles: unknown[] = []
    for (let i = 0; i < segmentos.length; i++) {
      const seg = segmentos[i]
      const clasifSeg = await clasificarDocEquipoTexto(seg.texto)
      const nombreSeg = nombreOriginal.replace(/\.pdf$/i, '') + `_parte${i + 1}.pdf`
      const enTexto = matchesPorSegmento[i]
      const sinRuido = enTexto.filter(m => !idsComunes.has(m.empleado_id))
      const porTexto = sinRuido.length === 1 ? sinRuido[0]
        : (sinRuido.length === 0 && enTexto.length === 1 ? enTexto[0] : null)
      const resolucion = resolverEmpleado(clasifSeg.empleado_nombre, clasifSeg.nif_trabajador, candidatos)
        || porTexto
      if (resolucion) {
        const { status, body: out } = await procesarNominaIndividual(seg.buffer, nombreSeg, resolucion.empleado_id, resolucion.nombre, null, null)
        if (status === 200) { ok++; detalles.push({ parte: i + 1, empleado: resolucion.nombre, ok: true }); continue }
        detalles.push(await archivarParaRevision(seg.buffer, nombreSeg, 'pdf', clasifSeg, String(out.motivo_extraccion || out.error || 'no se pudo procesar la nómina')))
        continue
      }
      detalles.push(await archivarParaRevision(seg.buffer, nombreSeg, 'pdf', clasifSeg,
        `empleado no identificado con seguridad: "${clasifSeg.empleado_nombre || 'sin nombre detectado'}"`))
    }
    if (ok > 0) {
      return res.status(200).json({ ok: true, destino: 'nominas', multi: true, nominas_ok: ok, total_partes: segmentos.length, detalles })
    }
    return res.status(200).json({ ok: true, destino: 'revision', multi: true, nominas_ok: 0, total_partes: segmentos.length, detalles })
  }

  // Sin marcador determinista → SIEMPRE a revisión, sin importar qué tipo haya
  // adivinado la IA de respaldo. "Certeza, no probabilidad": nada intermedio.
  if (!clasif.cierto) {
    return res.status(200).json(await archivarParaRevision(buffer, nombreOriginal, ext, clasif, clasif.motivo))
  }

  if (clasif.tipo === 'nomina') {
    const candidatos = await cargarCandidatosEmpleados(supabaseAdmin)
    // 1) por el nombre/NIF aislado de la cabecera; 2) si no, buscando al empleado
    // dentro del texto completo del recibo (solo vale si aparece uno y solo uno).
    const resolucion = resolverEmpleado(clasif.empleado_nombre, clasif.nif_trabajador, candidatos)
      || resolverEmpleadoEnTexto(texto, candidatos)
    if (resolucion) {
      const { status, body: out } = await procesarNominaIndividual(
        buffer, nombreOriginal, resolucion.empleado_id, resolucion.nombre, null, null,
      )
      if (status === 200) return res.status(200).json({ ok: true, destino: 'nominas', clasificacion: clasif, resultado: out })
      return res.status(200).json(await archivarParaRevision(buffer, nombreOriginal, ext, clasif, String(out.motivo_extraccion || out.error || 'no se pudo procesar la nómina')))
    }
    return res.status(200).json(await archivarParaRevision(buffer, nombreOriginal, ext, clasif, `empleado no identificado con seguridad: "${clasif.empleado_nombre || 'sin nombre detectado'}"`))
  }

  if (clasif.tipo === 'resumen_nominas') {
    const { status, body: out } = await procesarResumenNominas(buffer, nombreOriginal, null, null)
    if (status === 200) return res.status(200).json({ ok: true, destino: 'resumen_nominas', clasificacion: clasif, resultado: out })
    return res.status(200).json(await archivarParaRevision(buffer, nombreOriginal, ext, clasif, String(out.motivo_extraccion || out.error || 'no se pudo procesar el resumen de nóminas')))
  }

  if (clasif.tipo === 'rlc') {
    const { status, body: out } = await procesarSegSocialResumen(buffer, nombreOriginal, null, null)
    if (status === 200) return res.status(200).json({ ok: true, destino: 'seguridad_social', clasificacion: clasif, resultado: out })
    return res.status(200).json(await archivarParaRevision(buffer, nombreOriginal, ext, clasif, String(out.motivo_extraccion || out.error || 'no se pudo procesar el RLC')))
  }

  if (clasif.tipo === 'rnt') {
    const { status, body: out } = await procesarRnt(buffer, nombreOriginal, null, null)
    if (status === 200) return res.status(200).json({ ok: true, destino: 'seguridad_social_rnt', clasificacion: clasif, resultado: out })
    return res.status(200).json(await archivarParaRevision(buffer, nombreOriginal, ext, clasif, String(out.motivo_extraccion || out.error || 'no se pudo procesar la RNT')))
  }

  if (clasif.tipo === 'cuota_autonomos') {
    const { data: titular } = await supabaseAdmin.from('titulares').select('id, nombre').eq('nif', clasif.nif_titular).maybeSingle()
    if (!titular) {
      return res.status(200).json(await archivarParaRevision(buffer, nombreOriginal, ext, clasif, `Recibo de cuota de autónomos sin titular identificado (NIF "${clasif.nif_titular || 'no detectado'}" no coincide con ningún titular activo)`))
    }
    const { status, body: out } = await procesarAutonomoCuota(buffer, nombreOriginal, titular.id, titular.nombre, null, null)
    if (status === 200) return res.status(200).json({ ok: true, destino: 'autonomos_cuotas', clasificacion: clasif, resultado: out })
    return res.status(200).json(await archivarParaRevision(buffer, nombreOriginal, ext, clasif, String(out.motivo_extraccion || out.error || 'no se pudo procesar la cuota de autónomos')))
  }

  // 'desconocido': a revisión con el motivo.
  return res.status(200).json(await archivarParaRevision(buffer, nombreOriginal, ext, clasif, clasif.motivo))
}
