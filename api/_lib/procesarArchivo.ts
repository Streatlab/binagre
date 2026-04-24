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
    .select('id, numero_factura, proveedor_nombre, total, estado')
    .eq('pdf_hash', hash)
    .maybeSingle()
  if (existente) {
    return {
      estado: 'duplicada',
      archivo: file.nombre,
      factura_existente: existente as Record<string, unknown>,
    }
  }

  // Crear registro procesando
  const tempNum = `TEMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const { data: nueva, error: errInsert } = await supabase
    .from('facturas')
    .insert({
      pdf_original_name: file.nombre,
      pdf_hash: hash,
      proveedor_nombre: 'Procesando...',
      numero_factura: tempNum,
      fecha_factura: new Date().toISOString().slice(0, 10),
      total: 0,
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
    const extracted = await extraerDatosDesdeContenido(contenido)

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

    // Detectar titular por NIF cliente
    let titularId: string | null = null
    let carpetaTitular = 'SIN_TITULAR'
    if (extracted.nif_cliente) {
      const { data: titular } = await supabase
        .from('titulares')
        .select('id, carpeta_drive')
        .eq('nif', extracted.nif_cliente)
        .maybeSingle()
      if (titular) {
        titularId = titular.id as string
        carpetaTitular = (titular.carpeta_drive as string) || 'SIN_TITULAR'
      }
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
        base_4: extracted.base_4,
        iva_4: extracted.iva_4,
        base_10: extracted.base_10,
        iva_10: extracted.iva_10,
        base_21: extracted.base_21,
        iva_21: extracted.iva_21,
        total: extracted.total,
        ocr_confianza: extracted.confianza,
        ocr_raw: extracted,
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

    // Matching (pasa titular_id para detectar cross-cuenta)
    const resultadoMatch = await matchFactura(supabase, {
      ...extracted,
      id: nueva.id,
      total: extracted.total,
      titular_id: titularId,
    })
    await aplicarMatching(supabase, nueva.id, resultadoMatch)

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
        })
        .eq('id', nueva.id)
    } catch (driveErr) {
      const msg = errMsg(driveErr)
      await supabase
        .from('facturas')
        .update({ error_mensaje: `Drive: ${msg}` })
        .eq('id', nueva.id)
    }

    // Estado final + tipo de origen para trazabilidad
    await supabase
      .from('facturas')
      .update({ error_mensaje: tipo === 'texto' ? 'origen: texto pegado' : null })
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
