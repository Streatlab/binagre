// procesarArchivo v6 — nombre proveedor por NIF desde reglas_conciliacion
import { createHash, randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { detectarTipoArchivo, extensionDeNombre } from './detectarTipo.js'
import type { TipoArchivo } from './detectarTipo.js'
import {
  extraerEmail,
  extraerExcel,
  extraerTexto,
  extraerWord,
  prepararVision,
  extraerTextoPDF,
  pdfTieneTexto,
  extraerPorReglas,
} from './extractores.js'
import type { ContenidoExtraido } from './extractores.js'
import { extraerDatosDesdeContenido } from './ocr.js'
import type { ExtractedFactura } from './ocr.js'
import { aplicarMatching, matchFactura } from './matching.js'
import { generarNombreArchivo, subirArchivoADrive } from './google-drive.js'

export type ProcesarEstado =
  | 'duplicada'
  | 'error'
  | 'ok'

const NIF_RUBEN = '21669051S'
const NIF_EMILIO = '53484832B'
const RUBEN_ID = '6ce69d55-60d0-423c-b68b-eb795a0f32fe'
const EMILIO_ID = 'c5358d43-a9cc-4f4c-b0b3-99895bdf4354'

// F05: regex validación fecha
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/

function normalizarNif(nif: string | null | undefined): string | null {
  if (!nif) return null
  const limpio = nif.replace(/[\s\-.]/g, '').toUpperCase()
  return limpio || null
}

// F04: quitar sufijos societarios para detectar titular
function detectarTitularPorNombre(nombreCliente: string | null | undefined): {
  titularId: string | null
  carpeta: string
  match: boolean
} {
  if (!nombreCliente) return { titularId: null, carpeta: 'SIN_TITULAR', match: false }
  // F04: normalizar quitando sufijos societarios
  const n = nombreCliente.toLowerCase()
    .replace(/\s*s\.?\s*l\.?\s*u?\.?\s*$/gi, '')
    .replace(/\s*s\.?\s*a\.?\s*$/gi, '')
    .replace(/\s*s\.?\s*c\.?\s*$/gi, '')
    .replace(/\s*c\.?\s*b\.?\s*$/gi, '')
    .trim()
  if (n.includes('rodriguez vinagre') || n.includes('rodríguez vinagre') ||
      (n.includes('ruben') && n.includes('vinagre')) ||
      (n.includes('rubén') && n.includes('vinagre'))) {
    return { titularId: RUBEN_ID, carpeta: 'RUBÉN', match: true }
  }
  if (n.includes('emilio dorca') || (n.includes('emilio') && n.includes('dorca'))) {
    return { titularId: EMILIO_ID, carpeta: 'EMILIO', match: true }
  }
  return { titularId: null, carpeta: 'SIN_TITULAR', match: false }
}

// F05: validar fecha lógica
function fechaValida(fecha: string | null | undefined): boolean {
  if (!fecha) return false
  if (!FECHA_REGEX.test(fecha)) return false
  const d = new Date(fecha)
  if (isNaN(d.getTime())) return false
  const year = d.getFullYear()
  return year >= 2020 && year <= 2030
}

export interface ProcesarResultado {
  estado: ProcesarEstado
  archivo: string
  factura_id?: string
  factura?: Record<string, unknown>
  factura_existente?: Record<string, unknown>
  error?: string
  motivo?: string
}

export interface ArchivoEntrada {
  nombre: string
  buffer: Buffer
  mimeType?: string | null
}

export async function procesarArchivo(
  supabase: SupabaseClient,
  file: ArchivoEntrada,
): Promise<ProcesarResultado[]> {
  const tipo = detectarTipoArchivo(file.nombre, file.mimeType)

  let contenido: ContenidoExtraido
  try {
    contenido = await extraerContenido(file, tipo)
  } catch (err) {
    return [
      {
        estado: 'error',
        archivo: file.nombre,
        error: `Error extrayendo contenido (${tipo}): ${errMsg(err)}`,
      },
    ]
  }

  const principal = await procesarContenidoPrincipal(supabase, file, contenido, tipo)

  const resultados: ProcesarResultado[] = [principal]
  if (tipo === 'email' && contenido.adjuntos?.length) {
    for (const adj of contenido.adjuntos) {
      const tipoAdj = detectarTipoArchivo(adj.name, adj.mimeType)
      if (tipoAdj === 'pdf' || tipoAdj === 'imagen') {
        const sub = await procesarArchivo(supabase, {
          nombre: adj.name,
          buffer: adj.data,
          mimeType: adj.mimeType,
        })
        resultados.push(...sub)
      }
    }
  }

  return resultados
}

async function extraerContenido(
  file: ArchivoEntrada,
  tipo: TipoArchivo,
): Promise<ContenidoExtraido> {
  const mime = file.mimeType || ''
  switch (tipo) {
    case 'pdf':
      // El PDF se conserva como vision (calidad) para el caso de que las reglas
      // no resuelvan y haya que mandarlo al modelo. La lectura de texto/reglas
      // se intenta en procesarContenidoPrincipal.
      return prepararVision(file.buffer, 'application/pdf')
    case 'imagen':
      return prepararVision(file.buffer, mime || 'image/jpeg')
    case 'word':
      return extraerWord(file.buffer)
    case 'excel':
      return extraerExcel(file.buffer)
    case 'email':
      return extraerEmail(file.buffer)
    case 'texto':
    default:
      return extraerTexto(file.buffer.toString('utf-8'))
  }
}

// Archivos que NO son facturas: resumenes de ingresos para gestoria, etc. Se ignoran.
const PATRONES_NO_FACTURA = [
  /ingresos?\s*[1-4]\s*t/i,          // "Ingresos 1T 2026"
  /ingresos?\s*(primer|segundo|tercer|cuarto)\s*trimestre/i,
  /resumen\s*ingresos?/i,
  /ingresos?\s*trimestr/i,
]
function esNoFactura(nombre: string): boolean {
  return PATRONES_NO_FACTURA.some(re => re.test(nombre))
}

// Resuelve el nombre del proveedor por NIF desde reglas_conciliacion (Conciliación).
// Devuelve el nombre canónico aprendido, o null si ese NIF no está aún en Conciliación.
async function nombrePorNifEnConciliacion(
  supabase: SupabaseClient,
  nif: string | null,
): Promise<string | null> {
  if (!nif) return null
  const { data } = await supabase
    .from('reglas_conciliacion')
    .select('razon_social')
    .eq('patron_nif', nif)
    .not('razon_social', 'is', null)
    .limit(1)
    .maybeSingle()
  return (data?.razon_social as string) || null
}

async function procesarContenidoPrincipal(
  supabase: SupabaseClient,
  file: ArchivoEntrada,
  contenido: ContenidoExtraido,
  tipo: TipoArchivo,
): Promise<ProcesarResultado> {
  if (esNoFactura(file.nombre)) {
    return { estado: 'duplicada', archivo: file.nombre, motivo: 'no es factura (resumen de ingresos gestoria) — ignorado' }
  }
  const hash = createHash('sha256').update(file.buffer).digest('hex')

  const { data: existente } = await supabase
    .from('facturas')
    .select('id, numero_factura, proveedor_nombre, total, estado, pdf_drive_id, pdf_drive_url, fecha_factura, tipo, plataforma, titular_id')
    .eq('pdf_hash', hash)
    .maybeSingle()
  if (existente) {
    let motivo = 'ya existe'

    if (!existente.pdf_drive_id) {
      try {
        let carpeta = 'SIN_TITULAR'
        if (existente.titular_id) {
          const { data: t } = await supabase
            .from('titulares')
            .select('carpeta_drive')
            .eq('id', existente.titular_id as string)
            .maybeSingle()
          if (t?.carpeta_drive) carpeta = t.carpeta_drive as string
        }
        const ext = extensionDeNombre(file.nombre)
        const nombreArchivo = generarNombreArchivo({
          proveedor_nombre: existente.proveedor_nombre as string,
          numero_factura: (existente.numero_factura as string) || '',
          fecha_factura: existente.fecha_factura as string,
          tipo: (existente.tipo as 'proveedor' | 'plataforma') || 'proveedor',
          plataforma: (existente.plataforma as 'uber' | 'glovo' | 'just_eat' | null) || null,
        }, ext)
        const drive = await subirArchivoADrive(file.buffer, nombreArchivo, {
          proveedor_nombre: existente.proveedor_nombre as string,
          numero_factura: (existente.numero_factura as string) || '',
          fecha_factura: existente.fecha_factura as string,
          tipo: (existente.tipo as 'proveedor' | 'plataforma') || 'proveedor',
          plataforma: (existente.plataforma as 'uber' | 'glovo' | 'just_eat' | null) || null,
          carpeta_titular: carpeta,
        }, ext)
        await supabase
          .from('facturas')
          .update({
            pdf_drive_id: drive.id,
            pdf_drive_url: drive.webViewLink,
            error_mensaje: null,
          })
          .eq('id', existente.id as string)
        ;(existente as Record<string, unknown>).pdf_drive_id = drive.id
        ;(existente as Record<string, unknown>).pdf_drive_url = drive.webViewLink
        motivo = 'ya existe · PDF subido a Drive ahora'
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        motivo = `ya existe · no se pudo subir a Drive: ${msg}`
      }
    }

    return {
      estado: 'duplicada',
      archivo: file.nombre,
      factura_existente: existente as Record<string, unknown>,
      motivo,
    }
  }

  // PASO 1 (gratis): intentar extraer por reglas desde el texto del PDF.
  // Solo PDF con capa de texto. Plataformas y PDF sin texto devuelven null
  // y caen al modelo (PASO 2) conservando calidad.
  let extracted: ExtractedFactura
  let extractedReglas: ExtractedFactura | null = null
  let origenLectura: 'reglas' | 'modelo' = 'modelo'
  if (tipo === 'pdf') {
    try {
      const textoPdf = await extraerTextoPDF(file.buffer)
      if (pdfTieneTexto(textoPdf)) {
        extractedReglas = extraerPorReglas(textoPdf)
      }
    } catch {
      extractedReglas = null
    }
  }

  if (extractedReglas) {
    extracted = extractedReglas
    origenLectura = 'reglas'
  } else {
    // PASO 2 (de pago): modelo IA como red de seguridad
    try {
      extracted = await extraerDatosDesdeContenido(contenido)
    } catch (ocrErr) {
      return {
        estado: 'error',
        archivo: file.nombre,
        error: `OCR falló: ${errMsg(ocrErr)}`,
      }
    }
  }

  // Las reglas dejan el nombre vacío a propósito → resolverlo por NIF desde
  // Conciliación. Si ese NIF no está aprendido aún, usar el NIF como nombre
  // provisional (nunca la cabecera de la factura).
  if (origenLectura === 'reglas' && !extracted.proveedor_nombre) {
    const nifLook = normalizarNif(extracted.nif_emisor)
    const nombreCanon = await nombrePorNifEnConciliacion(supabase, nifLook)
    extracted.proveedor_nombre = nombreCanon || nifLook || ''
  }

  if (!extracted.proveedor_nombre || extracted.total === undefined || extracted.total === null) {
    return {
      estado: 'error',
      archivo: file.nombre,
      error: `OCR devolvió datos vacíos. Proveedor="${extracted.proveedor_nombre || '—'}" total=${extracted.total}. Edita manualmente.`,
    }
  }

  // F05: validar fecha antes de insert
  const fechaFactura = fechaValida(extracted.fecha_factura)
    ? extracted.fecha_factura
    : new Date().toISOString().slice(0, 10)

  // F06: número factura con random suffix para unicidad
  const numFactura = extracted.numero_factura || `SN-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`

  const { data: nueva, error: errInsert } = await supabase
    .from('facturas')
    .insert({
      pdf_original_name: file.nombre,
      pdf_hash: hash,
      proveedor_nombre: extracted.proveedor_nombre,
      numero_factura: numFactura,
      fecha_factura: fechaFactura,
      total: extracted.total,
      estado: 'procesando',
    })
    .select()
    .single()

  if (errInsert || !nueva) {
    return {
      estado: 'error',
      archivo: file.nombre,
      error: errInsert?.message || 'No se pudo crear factura',
    }
  }

  try {
    // F02: buscar proveedor por nombre normalizado (la tabla proveedores no guarda NIF)
    const nifEmisorNorm = normalizarNif(extracted.nif_emisor)
    let proveedorId: string | undefined

    {
      const provNombre = extracted.proveedor_nombre.trim()
      const { data: provPorNombre } = await supabase
        .from('proveedores')
        .select('id')
        .ilike('nombre', `%${provNombre}%`)
        .maybeSingle()
      if (provPorNombre?.id) proveedorId = provPorNombre.id
    }

    if (proveedorId) {
      const { data: duplicadoNum } = await supabase
        .from('facturas')
        .select('id, proveedor_nombre, numero_factura, total')
        .eq('proveedor_id', proveedorId)
        .eq('numero_factura', extracted.numero_factura)
        .neq('id', nueva.id)
        .maybeSingle()
      if (duplicadoNum) {
        await supabase.from('facturas').delete().eq('id', nueva.id)
        return {
          estado: 'duplicada',
          archivo: file.nombre,
          factura_existente: duplicadoNum as Record<string, unknown>,
          motivo: 'proveedor+numero',
        }
      }

      // [retirado] La regla proveedor+fecha+total marcaba como duplicadas
      // facturas legitimas distintas que coincidian en proveedor, fecha e importe
      // (frecuente: 2 pedidos iguales el mismo dia). Los duplicados reales ya se
      // cubren por hash de archivo y por proveedor+numero_factura.
    }

    if (!proveedorId && extracted.proveedor_nombre) {
      const insertData: Record<string, unknown> = { nombre: extracted.proveedor_nombre, activo: true }
      const { data: nuevoProv } = await supabase
        .from('proveedores')
        .insert(insertData)
        .select('id')
        .single()
      proveedorId = nuevoProv?.id
    }

    let titularId: string | null = null
    let carpetaTitular = 'SIN_TITULAR'
    let pendienteTitularManual = false

    const nifClienteNorm = normalizarNif(extracted.nif_cliente)
    const nombreCliente = (extracted as { nombre_cliente?: string | null }).nombre_cliente

    if (nifClienteNorm === NIF_RUBEN) {
      titularId = RUBEN_ID
      carpetaTitular = 'RUBÉN'
    } else if (nifClienteNorm === NIF_EMILIO) {
      titularId = EMILIO_ID
      carpetaTitular = 'EMILIO'
    } else if (nifClienteNorm) {
      const { data: titular } = await supabase
        .from('titulares')
        .select('id, carpeta_drive')
        .eq('nif', nifClienteNorm)
        .maybeSingle()
      if (titular) {
        titularId = titular.id as string
        carpetaTitular = (titular.carpeta_drive as string) || 'SIN_TITULAR'
      }
    }

    if (!titularId) {
      const porNombre = detectarTitularPorNombre(nombreCliente)
      if (porNombre.match) {
        titularId = porNombre.titularId
        carpetaTitular = porNombre.carpeta
      }
    }

    if (!titularId && extracted.tipo === 'plataforma') {
      titularId = RUBEN_ID
      carpetaTitular = 'RUBÉN'
    }

    // F01: si no detecta titular, fallback a RUBEN y ejecutar matching igualmente
    if (!titularId) {
      titularId = RUBEN_ID
      carpetaTitular = 'RUBÉN'
      pendienteTitularManual = true
    }

    await supabase
      .from('facturas')
      .update({
        proveedor_id: proveedorId,
        proveedor_nombre: extracted.proveedor_nombre,
        numero_factura: extracted.numero_factura,
        fecha_factura: fechaFactura,
        es_recapitulativa: extracted.es_recapitulativa,
        periodo_inicio: extracted.periodo_inicio,
        periodo_fin: extracted.periodo_fin,
        tipo: extracted.tipo,
        plataforma: extracted.plataforma,
        titular_id: titularId,
        nif_cliente: nifClienteNorm,
        nif_emisor: nifEmisorNorm,
        categoria_factura: null,
        base_4: extracted.base_4,
        iva_4: extracted.iva_4,
        base_10: extracted.base_10,
        iva_10: extracted.iva_10,
        base_21: extracted.base_21,
        iva_21: extracted.iva_21,
        total: extracted.total,
        ocr_confianza: extracted.confianza,
        ocr_raw: { ...extracted, origen_lectura: origenLectura },
        ...(pendienteTitularManual ? { estado: 'pendiente_titular_manual' } : {}),
      })
      .eq('id', nueva.id)

    // F11: batch insert plataforma_detalle
    if (extracted.tipo === 'plataforma' && extracted.plataforma_detalle?.length) {
      const detalleRows = []
      for (const det of extracted.plataforma_detalle) {
        const { data: marca } = await supabase
          .from('marcas')
          .select('id')
          .ilike('nombre', `%${det.marca_nombre}%`)
          .maybeSingle()
        detalleRows.push({
          factura_id: nueva.id,
          marca_id: marca?.id ?? null,
          marca_nombre: det.marca_nombre,
          pedidos: det.pedidos,
          ventas_brutas: det.ventas_brutas,
          comision: det.comision,
          comision_iva: det.comision_iva,
          fee_fijo: det.fee_fijo,
          ads: det.ads,
          promos_cubiertas: det.promos_cubiertas,
          neto_liquidado: det.neto_liquidado,
          periodo_inicio: det.periodo_inicio,
          periodo_fin: det.periodo_fin,
        })
      }
      if (detalleRows.length > 0) {
        await supabase.from('facturas_plataforma_detalle').insert(detalleRows)
      }
    }

    // F01: ejecutar matching siempre (incluso con pendienteTitularManual, usando RUBEN como fallback)
    try {
      const resultadoMatch = await matchFactura(supabase, {
        ...extracted,
        id: nueva.id,
        total: extracted.total,
        titular_id: titularId,
      })
      await aplicarMatching(supabase, nueva.id, resultadoMatch, {
        proveedor_nombre: extracted.proveedor_nombre,
        nif_emisor: nifEmisorNorm,
      })
      // Si pendienteTitularManual, forzar estado pendiente_titular_manual tras matching
      if (pendienteTitularManual) {
        await supabase
          .from('facturas')
          .update({ estado: 'pendiente_titular_manual' })
          .eq('id', nueva.id)
      }
    } catch (matchErr) {
      console.error('[procesarArchivo] error en matching:', errMsg(matchErr))
    }

    const ext = extensionDeNombre(file.nombre)
    const nombreArchivo = generarNombreArchivo(
      {
        proveedor_nombre: extracted.proveedor_nombre,
        numero_factura: extracted.numero_factura,
        fecha_factura: fechaFactura,
        tipo: extracted.tipo,
        plataforma: extracted.plataforma,
      },
      ext,
    )
    let driveErrorMsg: string | null = null
    try {
      const drive = await subirArchivoADrive(file.buffer, nombreArchivo, {
        proveedor_nombre: extracted.proveedor_nombre,
        numero_factura: extracted.numero_factura,
        fecha_factura: fechaFactura,
        tipo: extracted.tipo,
        plataforma: extracted.plataforma,
        carpeta_titular: carpetaTitular,
      }, ext)
      await supabase
        .from('facturas')
        .update({
          pdf_drive_id: drive.id,
          pdf_drive_url: drive.webViewLink,
          pdf_filename: nombreArchivo,
        })
        .eq('id', nueva.id)
    } catch (driveErr) {
      driveErrorMsg = errMsg(driveErr)
      if (driveErrorMsg.includes('invalid_client') || driveErrorMsg.includes('invalid_grant')) {
        driveErrorMsg = 'Drive desconectado · Reconecta Google Drive en Ajustes'
      }
      if (!pendienteTitularManual) {
        await supabase
          .from('facturas')
          .update({ estado: 'drive_pendiente' })
          .eq('id', nueva.id)
      }
    }

    const mensajeFinal = driveErrorMsg
      ? `Drive: ${driveErrorMsg}`
      : tipo === 'texto'
        ? 'origen: texto pegado'
        : null
    await supabase
      .from('facturas')
      .update({ error_mensaje: mensajeFinal })
      .eq('id', nueva.id)

    const { data: finalFac } = await supabase
      .from('facturas')
      .select('*')
      .eq('id', nueva.id)
      .single()

    return {
      estado: 'ok',
      archivo: file.nombre,
      factura_id: nueva.id,
      factura: finalFac as Record<string, unknown>,
    }
  } catch (ocrErr) {
    const msg = errMsg(ocrErr)
    await supabase
      .from('facturas')
      .update({ estado: 'error', error_mensaje: msg })
      .eq('id', nueva.id)
    return {
      estado: 'error',
      archivo: file.nombre,
      factura_id: nueva.id,
      error: msg,
    }
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
