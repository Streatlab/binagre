// api/equipo/subir.ts — buzón único EQUIPO de Papeleo: recibe un documento suelto
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
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'
import { subirArchivoACarpetaExacta } from '../_lib/google-drive.js'
import { extraerTextoPDF, pdfTieneTexto } from '../_lib/extractores.js'
import { extraerTextoOCRGratis } from '../_lib/ocr-tesseract.js'
import { clasificarDocEquipoTexto, type ClasificacionDocEquipo } from '../_lib/clasificarDocEquipo.js'
import { procesarNominaIndividual, procesarResumenNominas, procesarSegSocialResumen, procesarRnt } from '../_lib/subidaDocEquipo.js'
import { cargarCandidatosEmpleados, resolverEmpleado, resolverEmpleadoEnTexto } from '../_lib/matchEmpleado.js'

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
  maxDuration: 60,
}

interface BodySubirEquipo {
  base64?: string
  nombre_archivo?: string
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
    const drive = await subirArchivoACarpetaExacta(buffer, nombreOriginal, ['EQUIPO', 'SIN_CLASIFICAR'], ext)
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

  // 'desconocido': a revisión con el motivo.
  return res.status(200).json(await archivarParaRevision(buffer, nombreOriginal, ext, clasif, clasif.motivo))
}
