// api/nominas/segsocial/subir.ts — sube el PDF del resumen mensual de
// Seguridad Social de la empresa (RLC), lo archiva en Drive (misma
// infraestructura "cero pérdida" que facturas) y extrae importe/fecha de cargo
// por texto (barato, sin visión) vía extraerSegSocialAnthropicTexto. Guarda/
// actualiza la fila en `seguridad_social_resumen`.
//
// Mismo criterio de carpeta que api/nominas/subir.ts (ver comentario allí):
// google-drive.ts no expone una subida genérica a carpeta arbitraria sin
// tocar ese archivo (fuera de alcance), así que se reutiliza subirArchivoADrive
// con carpeta_titular = "EQUIPO_SEGURIDAD_SOCIAL" (documento único mensual de
// empresa, sin empleado); año/trimestre/mes se derivan de la fecha del periodo.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../../_lib/supabase-admin.js'
import { subirArchivoADrive } from '../../_lib/google-drive.js'
import { extensionDeNombre } from '../../_lib/detectarTipo.js'
import { extraerTextoPDF } from '../../_lib/extractores.js'
import { extraerSegSocialAnthropicTexto } from '../../_lib/extraerSegSocialResumen.js'

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
  maxDuration: 60,
}

interface BodySubirSegSocial {
  base64?: string
  nombre_archivo?: string
  mes?: number
  anio?: number
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

  const body = (req.body || {}) as BodySubirSegSocial
  if (!body.base64) return res.status(400).json({ error: 'Falta base64' })

  const buffer = Buffer.from(body.base64, 'base64')

  // Extracción por texto (barata). Igual que en nóminas: un fallo de lectura NUNCA
  // bloquea la subida, se sube igualmente y se guarda como 'revisar'.
  let texto = ''
  try { texto = await extraerTextoPDF(buffer) } catch { texto = '' }
  const resultado = await extraerSegSocialAnthropicTexto(texto)

  const mesBody = enteroValido(body.mes, 1, 12)
  const anioBody = enteroValido(body.anio, 2000, 2100)
  const mesFinal = mesBody ?? resultado.mes
  const anioFinal = anioBody ?? resultado.anio
  if (!mesFinal || !anioFinal) {
    return res.status(400).json({
      error: 'No se pudo determinar mes/año del resumen de Seguridad Social; indícalos manualmente.',
      motivo_extraccion: resultado.motivo,
    })
  }

  const nombreOriginal = body.nombre_archivo || 'segsocial.pdf'
  const ext = extensionDeNombre(nombreOriginal) || 'pdf'
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
    return res.status(500).json({ error: `Drive: ${msg}` })
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

  if (errUpsert) return res.status(500).json({ error: errUpsert.message })

  return res.status(200).json({
    ok: true,
    estado: estadoResumen,
    motivo: resultado.motivo,
    resumen: fila,
  })
}
