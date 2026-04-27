import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { detectarTipoArchivo, extensionDeNombre } from './detectarTipo.js'
import type { TipoArchivo } from './detectarTipo.js'
import {
  extraerEmail,
  extraerExcel,
  extraerTexto,
  extraerWord,
  prepararVision,
} from './extractores.js'
import type { ContenidoExtraido } from './extractores.js'
import { extraerDatosDesdeContenido } from './ocr.js'
import { aplicarMatching, matchFactura } from './matching.js'
import { generarNombreArchivo, subirArchivoADrive } from './google-drive.js'

export type ProcesarEstado =
  | 'duplicada'
  | 'error'
  | 'ok'

const PLATAFORMAS_NOMBRES = ['uber eats', 'uber bv', 'portier eats', 'glovo', 'glovoapp', 'just eat', 'takeaway', 'rushour']

const NIF_RUBEN = '21669051S'
const NIF_EMILIO = '53484832B'
const RUBEN_ID = '6ce69d55-60d0-423c-b68b-eb795a0f32fe'
const EMILIO_ID = 'c5358d43-a9cc-4f4c-b0b3-99895bdf4354'

function detectarCategoriaFactura(extracted: { proveedor_nombre: string; tipo?: string }): 'plataforma' | 'proveedor' {
  const nombre = (extracted.proveedor_nombre || '').toLowerCase()
  if (PLATAFORMAS_NOMBRES.some(p => nombre.includes(p))) return 'plataforma'
  return extracted.tipo === 'plataforma' ? 'plataforma' : 'proveedor'
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

/**
 * Procesa un archivo completo: detecta tipo → extrae → OCR → inserta factura →
 * matching → Drive. Para emails, procesa recursivamente cada adjunto PDF/imagen.
 */
export async function procesarArchivo(
  supabase: SupabaseClient,
  file: ArchivoEntrada,
): Promise<ProcesarResultado[]> {
  const tipo = detectarTipoArchivo(file.nombre, file.mimeType)

  // 1. Extraer contenido según tipo
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

  // 2. Procesar el archivo principal
  const principal = await procesarContenidoPrincipal(supabase, file, contenido, tipo)

  // 3. Si es email con adjuntos PDF/imagen, procesarlos recursivamente
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

async function procesarContenidoPrincipal(
  supabase: SupabaseClient,
  file: ArchivoEntrada,
  contenido: ContenidoExtraido,
  tipo: TipoArchivo,
): Promise<ProcesarResultado> {
  // Hash SHA-256
  const hash = createHash('sha256').update(file.buffer).digest('hex')

  // Dedup por hash
  const { data: existente } = await supabase
    .from('facturas')
    .select('id, numero_factura, proveedor_nombre, total, estado, pdf_drive_id, pdf_drive_url, fecha_factura, tipo, plataforma, titular_id')
    .eq('pdf_hash', hash)
    .maybeSingle()
  if (existente) {
    let motivo = 'ya existe'

    // Si la existente no está en Drive y nos re-envían el PDF, aprovecha para subirla
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
          tipo: (existente.tipo as 'proveedor' | 'plataforma' | 'otro') || 'proveedor',
          plataforma: (existente.plataforma as 'uber' | 'glovo' | 'just_eat' | null) || null,
        }, ext)
        const drive = await subirArchivoADrive(file.buffer, nombreArchivo, {
          proveedor_nombre: existente.proveedor_nombre as string,
          numero_factura: (existente.numero_factura as string) || '',
          fecha_factura: existente.fecha_factura as string,
          tipo: (existente.tipo as 'proveedor' | 'plataforma' | 'otro') || 'proveedor',
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

  // 1. OCR PRIMERO — si falla, NO se crea registro (evita zombies)
  let extracted: Awaited<ReturnType<typeof extraerDatosDesdeContenido>>
  try {
    extracted = await extraerDatosDesdeContenido(contenido)
  } catch (ocrErr) {
    return {
      estado: 'error',
      archivo: file.nombre,
      error: `OCR falló: ${errMsg(ocrErr)}`,
    }
  }

  // 2. Validar que el OCR devolvió datos mínimos
  if (!extracted.proveedor_nombre || !extracted.total) {
    return {
      estado: 'error',
      archivo: file.nombre,
      error: `OCR devolvió datos vacíos. Proveedor="${extracted.proveedor_nombre || '—'}" total=${extracted.total}. Edita manualmente.`,
    }
  }

  // 3. Crear registro ya con datos reales
  const { data: nueva, error: errInsert } = await supabase
    .from('facturas')
    .insert({
      pdf_original_name: file.nombre,
      pdf_hash: hash,
      proveedor_nombre: extracted.proveedor_nombre,
      numero_factura: extracted.numero_factura || `SN-${Date.now().toString(36)}`,
      fecha_factura: extracted.fecha_factura || new Date().toISOString().slice(0, 10),
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

    // Matching proveedor por nombre (fallback) + dedup proveedor+numero
    const provQuery = extracted.proveedor_nombre.slice(0, 20)
    const { data: proveedor } = await supabase
      .from('proveedores')
      .select('id')
      .ilike('nombre', `%${provQuery}%`)
      .maybeSingle()

    if (proveedor?.id) {
      const { data: duplicadoNum } = await supabase
        .from('facturas')
        .select('id, proveedor_nombre, numero_factura, total')
        .eq('proveedor_id', proveedor.id)
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
    }

    let proveedorId = proveedor?.id
    if (!proveedorId && extracted.proveedor_nombre) {
      const { data: nuevoProv } = await supabase
        .from('proveedores')
        .insert({ nombre: extracted.proveedor_nombre, activo: true })
        .select('id')
        .single()
      proveedorId = nuevoProv?.id
    }

    // Detectar titular por NIF cliente (constantes cerradas primero, luego BD)
    let titularId: string | null = null
    let carpetaTitular = 'SIN_TITULAR'
    let pendienteTitularManual = false
    if (extracted.nif_cliente) {
      if (extracted.nif_cliente === NIF_RUBEN) {
        titularId = RUBEN_ID
        carpetaTitular = 'RUBÉN'
      } else if (extracted.nif_cliente === NIF_EMILIO) {
        titularId = EMILIO_ID
        carpetaTitular = 'EMILIO'
      } else {
        // NIF presente pero no reconocido → buscar en BD como fallback
        const { data: titular } = await supabase
          .from('titulares')
          .select('id, carpeta_drive')
          .eq('nif', extracted.nif_cliente)
          .maybeSingle()
        if (titular) {
          titularId = titular.id as string
          carpetaTitular = (titular.carpeta_drive as string) || 'SIN_TITULAR'
        } else {
          pendienteTitularManual = true
        }
      }
    } else {
      // Sin NIF cliente → no se puede determinar titular
      pendienteTitularManual = true
    }

    await supabase
      .from('facturas')
      .update({
        proveedor_id: proveedorId,
        proveedor_nombre: extracted.proveedor_nombre,
        numero_factura: extracted.numero_factura,
        fecha_factura: extracted.fecha_factura,
        es_recapitulativa: extracted.es_recapitulativa,
        periodo_inicio: extracted.periodo_inicio,
        periodo_fin: extracted.periodo_fin,
        tipo: extracted.tipo,
        plataforma: extracted.plataforma,
        titular_id: titularId,
        nif_cliente: extracted.nif_cliente ?? null,
        nif_emisor: (extracted as any).nif_emisor ?? null,
        categoria_factura: detectarCategoriaFactura(extracted),
        base_4: extracted.base_4,
        iva_4: extracted.iva_4,
        base_10: extracted.base_10,
        iva_10: extracted.iva_10,
        base_21: extracted.base_21,
        iva_21: extracted.iva_21,
        total: extracted.total,
        ocr_confianza: extracted.confianza,
        ocr_raw: extracted,
        ...(pendienteTitularManual ? { estado: 'pendiente_titular_manual' } : {}),
      })
      .eq('id', nueva.id)

    // Plataforma: detalle por marca
    if (extracted.tipo === 'plataforma' && extracted.plataforma_detalle?.length) {
      for (const det of extracted.plataforma_detalle) {
        const { data: marca } = await supabase
          .from('marcas')
          .select('id')
          .ilike('nombre', `%${det.marca_nombre}%`)
          .maybeSingle()
        await supabase.from('facturas_plataforma_detalle').insert({
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
    }

    // Matching (pasa titular_id para detectar cross-cuenta) — omitir si sin titular
    if (!pendienteTitularManual) {
      const resultadoMatch = await matchFactura(supabase, {
        ...extracted,
        id: nueva.id,
        total: extracted.total,
        titular_id: titularId,
      })
      await aplicarMatching(supabase, nueva.id, resultadoMatch)
    }

    // Drive: preserva extensión original
    const ext = extensionDeNombre(file.nombre)
    const nombreArchivo = generarNombreArchivo(
      {
        proveedor_nombre: extracted.proveedor_nombre,
        numero_factura: extracted.numero_factura,
        fecha_factura: extracted.fecha_factura,
        tipo: extracted.tipo,
        plataforma: extracted.plataforma,
      },
      ext,
    )
    let driveErrorMsg: string | null = null
    try {
      // Si es texto pegado o email sin .pdf, también subimos el buffer original
      const drive = await subirArchivoADrive(file.buffer, nombreArchivo, {
        proveedor_nombre: extracted.proveedor_nombre,
        numero_factura: extracted.numero_factura,
        fecha_factura: extracted.fecha_factura,
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
      // Solo marcar drive_pendiente si OCR + matching OK y solo Drive falló
      if (!pendienteTitularManual) {
        await supabase
          .from('facturas')
          .update({ estado: 'drive_pendiente' })
          .eq('id', nueva.id)
      }
    }

    // Estado final: si hubo error Drive, preservarlo; si no, trazar origen de texto
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
