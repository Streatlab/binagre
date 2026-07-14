// api/equipo/diagnostico.ts — SOLO LECTURA. Dado un documento ya guardado en el
// respaldo de Storage (?path=EQUIPO/...), extrae su texto y dice qué haría el buzón
// EQUIPO con él: tipo detectado, marcador que lo decide, empleado resuelto y destino
// final. No escribe nada en ninguna tabla ni en Drive: sirve para verificar el
// clasificador contra documentos reales ANTES de pedirle a nadie que los suba.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'
import { descargarRespaldoStorage } from '../_lib/google-drive.js'
import { extraerTextoPDF, pdfTieneTexto } from '../_lib/extractores.js'
import { extraerTextoOCRGratis } from '../_lib/ocr-tesseract.js'
import { clasificarDocEquipoTexto } from '../_lib/clasificarDocEquipo.js'
import { cargarCandidatosEmpleados, resolverEmpleado, resolverEmpleadoEnTexto } from '../_lib/matchEmpleado.js'

export const config = { maxDuration: 60 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const path = String(req.query.path || '')
    if (!path) return res.status(400).json({ error: 'falta path' })

    const buffer = await descargarRespaldoStorage(path)
    if (!buffer) return res.status(404).json({ error: 'no encontrado en Storage', path })

    let texto = ''
    try { texto = await extraerTextoPDF(buffer) } catch { texto = '' }
    let via = 'texto-pdf'
    if (!pdfTieneTexto(texto)) {
      try { texto = await extraerTextoOCRGratis(buffer, 'pdf'); via = 'ocr' } catch { via = 'sin-texto' }
    }

    const clasif = await clasificarDocEquipoTexto(texto)

    let empleado: string | null = null
    let comoSeResuelve: string | null = null
    if (clasif.tipo === 'nomina') {
      const candidatos = await cargarCandidatosEmpleados(supabaseAdmin)
      const r = resolverEmpleado(clasif.empleado_nombre, clasif.nif_trabajador, candidatos)
        || resolverEmpleadoEnTexto(texto, candidatos)
      empleado = r?.nombre ?? null
      comoSeResuelve = r?.motivo ?? null
    }

    const destino = !clasif.cierto
      ? 'revision'
      : clasif.tipo === 'nomina'
        ? (empleado ? 'nominas' : 'revision (empleado no identificado)')
        : clasif.tipo === 'resumen_nominas' ? 'resumen_nominas'
          : clasif.tipo === 'rlc' ? 'seguridad_social'
            : clasif.tipo === 'rnt' ? 'seguridad_social_rnt' : 'revision'

    return res.status(200).json({
      path,
      via,
      chars: texto.length,
      tipo: clasif.tipo,
      cierto: clasif.cierto,
      motivo: clasif.motivo,
      empleado_en_documento: clasif.empleado_nombre,
      empleado_resuelto: empleado,
      como_se_resuelve: comoSeResuelve,
      destino,
    })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
