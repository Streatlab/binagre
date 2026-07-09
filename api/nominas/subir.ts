// api/nominas/subir.ts — sube un PDF de nómina de un empleado, lo archiva en
// Drive (misma infraestructura "cero pérdida" que facturas: respaldo en Storage
// + reintentos) y extrae sus importes por texto (barato, sin visión) vía
// extraerNominaAnthropicTexto. Guarda/actualiza la fila en `nominas`.
//
// DECISIÓN AUTÓNOMA (estructura de carpetas en Drive): google-drive.ts NO
// expone ninguna función de subida genérica "buffer a carpeta arbitraria" —
// las únicas exportadas (subirArchivoADrive/subirPdfADrive) construyen SIEMPRE
// la ruta TITULAR/AÑO/TRIMESTRE/MES/(PROVEEDORES|PLATAFORMAS) a partir de
// `carpeta_titular` + `fecha_factura` + `tipo` (ver nivelesCarpeta en ese
// archivo). Como el alcance de esta tarea prohíbe tocar google-drive.ts, no es
// posible reproducir literalmente "EQUIPO/NOMINAS/<empleado>/<anio>" como
// cadena de carpetas anidadas. Se reutiliza subirArchivoADrive tal cual:
//   - carpeta_titular = "EQUIPO_NOMINAS_<EMPLEADO>" (agrupa todo lo del
//     empleado en una carpeta de primer nivel; año/trimestre/mes se generan
//     automáticamente por fecha, que es justo lo que pide "por año").
//   - tipo = 'proveedor' (fuerza subcarpeta final "PROVEEDORES"; es el único
//     valor disponible en el tipo DriveExtracted, no hay 'nomina').
//   - El nombre de archivo sí seguirmos literalmente el patrón pedido:
//     nomina_<anio>-<mes>_<empleado>.pdf
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'
import { subirArchivoADrive } from '../_lib/google-drive.js'
import { extensionDeNombre } from '../_lib/detectarTipo.js'
import { extraerTextoPDF } from '../_lib/extractores.js'
import { extraerNominaAnthropicTexto } from '../_lib/extraerNomina.js'

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
  maxDuration: 60,
}

interface BodySubirNomina {
  base64?: string
  nombre_archivo?: string
  empleado_id?: string
  mes?: number
  anio?: number
}

function slug(s: string): string {
  return (s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]+/g, '')
    .replace(/\s+/g, '_')
    .trim()
    .toUpperCase() || 'SIN_NOMBRE'
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

  const body = (req.body || {}) as BodySubirNomina
  if (!body.base64) return res.status(400).json({ error: 'Falta base64' })
  if (!body.empleado_id) return res.status(400).json({ error: 'Falta empleado_id' })

  const { data: empleado, error: errEmpleado } = await supabaseAdmin
    .from('empleados')
    .select('id, nombre')
    .eq('id', body.empleado_id)
    .maybeSingle()
  if (errEmpleado || !empleado) {
    return res.status(404).json({ error: errEmpleado?.message || 'Empleado no encontrado' })
  }
  const nombreEmpleado = (empleado.nombre as string) || 'Empleado'

  const buffer = Buffer.from(body.base64, 'base64')

  // Extracción por texto (barata). Si el PDF no da texto útil, extraerNominaAnthropicTexto
  // devuelve estado='error' con todos los campos null: NO bloquea la subida, se sube
  // igualmente y se guarda como 'revisar' para completar a mano (mismo criterio que el
  // flujo legado de facturas: nunca se pierde el documento por un fallo de lectura).
  let texto = ''
  try { texto = await extraerTextoPDF(buffer) } catch { texto = '' }
  const resultado = await extraerNominaAnthropicTexto(texto)

  // Resolver mes/anio final: los del body (si vienen y son válidos) tienen prioridad
  // sobre los detectados por la extracción.
  const mesBody = enteroValido(body.mes, 1, 12)
  const anioBody = enteroValido(body.anio, 2000, 2100)
  const mesFinal = mesBody ?? resultado.mes
  const anioFinal = anioBody ?? resultado.anio
  if (!mesFinal || !anioFinal) {
    return res.status(400).json({
      error: 'No se pudo determinar mes/año de la nómina; indícalos manualmente.',
      motivo_extraccion: resultado.motivo,
    })
  }

  const nombreOriginal = body.nombre_archivo || 'nomina.pdf'
  const ext = extensionDeNombre(nombreOriginal) || 'pdf'
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
    return res.status(500).json({ error: `Drive: ${msg}` })
  }

  // El único estado de nómina admitido es 'ok'|'revisar' (nunca bloquea la subida por
  // fallo técnico de extracción: un 'error' de extracción se guarda como 'revisar').
  const estadoNomina: 'ok' | 'revisar' = resultado.estado === 'ok' ? 'ok' : 'revisar'

  const { data: fila, error: errUpsert } = await supabaseAdmin
    .from('nominas')
    .upsert({
      empleado_id: body.empleado_id,
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

  if (errUpsert) return res.status(500).json({ error: errUpsert.message })

  return res.status(200).json({
    ok: true,
    estado: estadoNomina,
    motivo: resultado.motivo,
    campos_dudosos: resultado.campos_dudosos,
    nomina: fila,
  })
}
