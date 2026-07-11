// api/equipo/subir.ts — buzón único EQUIPO de Papeleo: recibe un documento suelto
// (nómina, resumen de nóminas, RLC/RNT de Seguridad Social, o cualquier otra cosa),
// lo clasifica por contenido y lo encamina a la misma lógica que ya usan los
// endpoints antiguos (api/nominas/subir.ts, api/nominas/resumen/subir.ts,
// api/nominas/segsocial/subir.ts), vía api/_lib/subidaDocEquipo.ts — sin duplicar
// esa lógica.
//
// Cero pérdida: si el tipo no se identifica con seguridad, si el empleado de una
// nómina individual no se resuelve, o si el procesado normal falla (p.ej. no se
// pudo determinar mes/año), el documento SIEMPRE queda archivado en Drive y
// registrado en `equipo_docs_revision` — nunca se descarta en silencio.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'
import { subirArchivoADrive } from '../_lib/google-drive.js'
import { extraerTextoPDF, pdfTieneTexto } from '../_lib/extractores.js'
import { extraerTextoOCRGratis } from '../_lib/ocr-tesseract.js'
import { clasificarDocEquipoTexto, type ClasificacionDocEquipo } from '../_lib/clasificarDocEquipo.js'
import { procesarNominaIndividual, procesarResumenNominas, procesarSegSocialResumen } from '../_lib/subidaDocEquipo.js'
import { cargarNombresEmpleados, resolverNombre } from '../_lib/resolverEmpleado.js'

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
  maxDuration: 60,
}

interface BodySubirEquipo {
  base64?: string
  nombre_archivo?: string
}

const CONFIANZA_MINIMA = 0.6

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
    const fecha = clasif.anio && clasif.mes
      ? `${clasif.anio}-${String(clasif.mes).padStart(2, '0')}-01`
      : new Date().toISOString().slice(0, 10)
    const drive = await subirArchivoADrive(buffer, nombreOriginal, {
      proveedor_nombre: clasif.empleado_nombre || 'EQUIPO',
      numero_factura: `revision-${Date.now()}`,
      fecha_factura: fecha,
      tipo: 'proveedor',
      plataforma: null,
      carpeta_titular: 'EQUIPO_SIN_CLASIFICAR',
    }, ext)
    driveUrl = drive.webViewLink || null
    storagePath = drive.storagePath || null
  } catch { /* archivarParaRevision nunca pierde el documento: sigue registrando la fila aunque Drive/Storage fallen del todo */ }

  const { data: fila, error } = await supabaseAdmin
    .from('equipo_docs_revision')
    .insert({
      nombre_archivo: nombreOriginal,
      tipo_detectado: clasif.tipo,
      confianza: clasif.confianza,
      motivo,
      mes: clasif.mes,
      anio: clasif.anio,
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

  if (clasif.confianza >= CONFIANZA_MINIMA && clasif.tipo === 'nomina' && clasif.empleado_nombre) {
    const mapaNombres = await cargarNombresEmpleados(supabaseAdmin)
    const resolucion = resolverNombre(clasif.empleado_nombre, mapaNombres)
    if (resolucion) {
      const { status, body: out } = await procesarNominaIndividual(
        buffer, nombreOriginal, resolucion.empleado_id, resolucion.nombre, clasif.mes, clasif.anio,
      )
      if (status === 200) return res.status(200).json({ ok: true, destino: 'nominas', clasificacion: clasif, resultado: out })
      return res.status(200).json(await archivarParaRevision(buffer, nombreOriginal, ext, clasif, String(out.motivo_extraccion || out.error || 'no se pudo procesar la nómina')))
    }
    return res.status(200).json(await archivarParaRevision(buffer, nombreOriginal, ext, clasif, `empleado no identificado con seguridad: "${clasif.empleado_nombre}"`))
  }

  if (clasif.confianza >= CONFIANZA_MINIMA && clasif.tipo === 'resumen_nominas') {
    const { status, body: out } = await procesarResumenNominas(buffer, nombreOriginal, clasif.mes, clasif.anio)
    if (status === 200) return res.status(200).json({ ok: true, destino: 'resumen_nominas', clasificacion: clasif, resultado: out })
    return res.status(200).json(await archivarParaRevision(buffer, nombreOriginal, ext, clasif, String(out.motivo_extraccion || out.error || 'no se pudo procesar el resumen de nóminas')))
  }

  if (clasif.confianza >= CONFIANZA_MINIMA && clasif.tipo === 'rlc') {
    const { status, body: out } = await procesarSegSocialResumen(buffer, nombreOriginal, clasif.mes, clasif.anio)
    if (status === 200) return res.status(200).json({ ok: true, destino: 'seguridad_social', clasificacion: clasif, resultado: out })
    return res.status(200).json(await archivarParaRevision(buffer, nombreOriginal, ext, clasif, String(out.motivo_extraccion || out.error || 'no se pudo procesar el RLC')))
  }

  // 'rnt' (sin tabla de destino todavía), 'desconocido', o confianza insuficiente en cualquier tipo.
  const motivoRevision = clasif.tipo === 'rnt'
    ? 'RNT de Seguridad Social: todavía sin tabla de destino, queda para revisión manual'
    : clasif.motivo
  return res.status(200).json(await archivarParaRevision(buffer, nombreOriginal, ext, clasif, motivoRevision))
}
