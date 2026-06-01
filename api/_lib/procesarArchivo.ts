// procesarArchivo v12 — auditoría 1-a-1 + plantilla por NIF (0 API por defecto)
// BLINDAJE COSTE: la API de Anthropic SOLO se usa si OCR_PERMITIR_API==='true'.
// Por defecto está APAGADA: si las reglas no leen una factura, NO se llama a la
// API. El PDF se guarda igualmente en Drive y la factura queda en estado
// 'pendiente_lectura_manual' (cuenta como pendiente, nunca como gasto ni parada).
// v11: guardarLecturaManual es IDEMPOTENTE — si el pdf_hash ya existe, NO lanza
// error (antes el unique index idx_facturas_pdf_hash_unique tiraba el insert y el
// archivo se perdía). Ahora se trata como duplicada y nunca se pierde.
// v12: RETIRADA la regla dedup proveedor+numero. Generaba falsos positivos
// (facturas reales distintas con el mismo número, o número mal leído por OCR, se
// descartaban). El ÚNICO dedup válido es por hash de archivo (mismo PDF exacto).
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
  extraerNifEmisorLibre,
} from './extractores.js'
import type { ContenidoExtraido, PlantillaNif } from './extractores.js'
import { extraerDatosDesdeContenido } from './ocr.js'
import type { ExtractedFactura } from './ocr.js'
import { aplicarMatching, matchFactura } from './matching.js'
import { generarNombreArchivo, subirArchivoADrive } from './google-drive.js'

export type ProcesarEstado =
  | 'duplicada'
  | 'error'
  | 'ok'
  | 'lectura_manual'

// BLINDAJE: API apagada por defecto. Para reactivarla (no recomendado) hay que
// poner la variable de entorno OCR_PERMITIR_API=true en Vercel.
const OCR_PERMITIR_API = process.env.OCR_PERMITIR_API === 'true'

const NIF_RUBEN = '21669051S'
const NIF_EMILIO = '53484832B'
const RUBEN_ID = '6ce69d55-60d0-423c-b68b-eb795a0f32fe'
const EMILIO_ID = 'c5358d43-a9cc-4f4c-b0b3-99895bdf4354'

// Estados de factura que cuentan como conciliada para la auditoría
const ESTADOS_CONCILIADA = ['conciliada', 'asociada']

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

// Registro 1-a-1 en ocr_auditoria. Nunca lanza: un fallo de auditoría no debe
// tumbar el procesado de la factura.
async function registrarAuditoria(
  supabase: SupabaseClient,
  hashFallback: string,
  sesionId: string | null | undefined,
  r: ProcesarResultado,
): Promise<void> {
  try {
    const fac = (r.factura || r.factura_existente) as Record<string, unknown> | undefined
    const estadoFac = fac?.estado as string | undefined
    const resultado =
      r.estado === 'ok' ? 'nueva'
      : r.estado === 'duplicada' ? 'duplicada'
      : r.estado === 'lectura_manual' ? 'lectura_manual'
      : 'error'
    const conciliada = estadoFac ? ESTADOS_CONCILIADA.includes(estadoFac) : false
    const enDrive = !!(fac?.pdf_drive_id)
    const ocrRaw = fac?.ocr_raw as Record<string, unknown> | undefined
    const origen = (ocrRaw?.origen_lectura as string) || null
    const existenteId = (r.factura_existente?.id as string) || null
    await supabase.from('ocr_auditoria').insert({
      sesion_id: sesionId ?? null,
      nombre_archivo: r.archivo,
      pdf_hash: (fac?.pdf_hash as string) || hashFallback,
      resultado,
      origen_lectura: origen,
      factura_id: (r.factura_id as string) || null,
      ya_existia_factura_id: existenteId,
      conciliada,
      en_drive: enDrive,
      motivo: r.motivo || r.error || null,
    })
  } catch (e) {
    console.error('[registrarAuditoria]', e instanceof Error ? e.message : String(e))
  }
}

export async function procesarArchivo(
  supabase: SupabaseClient,
  file: ArchivoEntrada,
  sesionId?: string | null,
): Promise<ProcesarResultado[]> {
  const tipo = detectarTipoArchivo(file.nombre, file.mimeType)
  const hashArchivo = createHash('sha256').update(file.buffer).digest('hex')

  let contenido: ContenidoExtraido
  try {
    contenido = await extraerContenido(file, tipo)
  } catch (err) {
    const resErr: ProcesarResultado = {
      estado: 'error',
      archivo: file.nombre,
      error: `Error extrayendo contenido (${tipo}): ${errMsg(err)}`,
    }
    await registrarAuditoria(supabase, hashArchivo, sesionId, resErr)
    return [resErr]
  }

  const principal = await procesarContenidoPrincipal(supabase, file, contenido, tipo)

  const resultados: ProcesarResultado[] = [principal]
  if (tipo === 'email' && contenido.adjuntos?.length) {
    for (const adj of contenido.adjuntos) {
      const tipoAdj = detectarTipoArchivo(adj.name, adj.mimeType)
      if (tipoAdj === 'pdf' || tipoAdj === 'imagen') {
        // Los adjuntos se auditan dentro de su propia llamada recursiva.
        const sub = await procesarArchivo(supabase, {
          nombre: adj.name,
          buffer: adj.data,
          mimeType: adj.mimeType,
        }, sesionId)
        resultados.push(...sub)
      }
    }
  }

  // Auditar el archivo principal (único punto, cubre ok/duplicada/error/lectura_manual)
  await registrarAuditoria(supabase, hashArchivo, sesionId, principal)

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

// Diccionario NIF → {nombre canónico, plantilla de lectura}.
// Carga toda la tabla de reglas con patron_nif una vez por archivo y la indexa.
// 0 API: es el "diccionario de NIF contra proveedor" con plantilla por proveedor.
async function cargarDiccionarioNif(
  supabase: SupabaseClient,
): Promise<Map<string, { nombre: string | null; plantilla: PlantillaNif }>> {
  const dic = new Map<string, { nombre: string | null; plantilla: PlantillaNif }>()
  const { data } = await supabase
    .from('reglas_conciliacion')
    .select('patron_nif, razon_social, plantilla_total_label, plantilla_fecha_formato, plantilla_num_label')
    .not('patron_nif', 'is', null)
  for (const row of data || []) {
    const nif = normalizarNif(row.patron_nif as string)
    if (!nif || dic.has(nif)) continue
    dic.set(nif, {
      nombre: (row.razon_social as string) || null,
      plantilla: {
        totalLabel: (row.plantilla_total_label as string) || null,
        fechaFormato: (row.plantilla_fecha_formato as string) || null,
        numLabel: (row.plantilla_num_label as string) || null,
      },
    })
  }
  return dic
}

// Sube el PDF a Drive con un nombre lo más correcto posible y devuelve los datos
// de Drive. Best-effort: si falla, devuelve null (no rompe el flujo).
async function guardarEnDriveBestEffort(
  file: ArchivoEntrada,
  datos: {
    proveedor_nombre: string
    numero_factura: string
    fecha_factura: string
    tipo: 'proveedor' | 'plataforma'
    plataforma: 'uber' | 'glovo' | 'just_eat' | null
    carpeta_titular: string
  },
): Promise<{ id: string; webViewLink: string; nombre: string } | null> {
  try {
    const ext = extensionDeNombre(file.nombre)
    const nombreArchivo = generarNombreArchivo(
      {
        proveedor_nombre: datos.proveedor_nombre,
        numero_factura: datos.numero_factura,
        fecha_factura: datos.fecha_factura,
        tipo: datos.tipo,
        plataforma: datos.plataforma,
      },
      ext,
    )
    const drive = await subirArchivoADrive(file.buffer, nombreArchivo, datos, ext)
    return { id: drive.id, webViewLink: drive.webViewLink, nombre: nombreArchivo }
  } catch {
    return null
  }
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

  // PASO 1 (gratis): extraer por reglas desde el texto del PDF, usando la
  // plantilla del NIF si existe en el diccionario. Solo PDF con capa de texto.
  let extracted: ExtractedFactura
  let extractedReglas: ExtractedFactura | null = null
  let origenLectura: 'reglas' | 'modelo' = 'modelo'
  let diccionario: Map<string, { nombre: string | null; plantilla: PlantillaNif }> | null = null
  let textoPdfCache = ''

  if (tipo === 'pdf') {
    try {
      const textoPdf = await extraerTextoPDF(file.buffer)
      textoPdfCache = textoPdf
      if (pdfTieneTexto(textoPdf)) {
        diccionario = await cargarDiccionarioNif(supabase)
        // El extractor recibe una función que, dado el NIF emisor, devuelve su
        // plantilla. Así cada proveedor usa su forma de leer el total/fecha.
        extractedReglas = extraerPorReglas(textoPdf, (nif) => diccionario?.get(nif)?.plantilla || null)
      }
    } catch {
      extractedReglas = null
    }
  }

  if (extractedReglas) {
    extracted = extractedReglas
    origenLectura = 'reglas'
  } else if (OCR_PERMITIR_API) {
    // PASO 2 (de pago, SOLO si está explícitamente activado): modelo IA.
    try {
      extracted = await extraerDatosDesdeContenido(contenido)
    } catch (ocrErr) {
      return {
        estado: 'error',
        archivo: file.nombre,
        error: `OCR falló: ${errMsg(ocrErr)}`,
      }
    }
  } else {
    // BLINDAJE 0 API: las reglas no pudieron leer y la API está apagada.
    // NO se llama al modelo. Se guarda el PDF en Drive como respaldo y se deja
    // la factura en 'pendiente_lectura_manual'. Se extrae el NIF emisor del texto
    // (aunque falte el total) para poder crear la plantilla automáticamente.
    return await guardarLecturaManual(supabase, file, hash, textoPdfCache)
  }

  // Resolver nombre por NIF desde el diccionario (reglas dejan el nombre vacío).
  if (origenLectura === 'reglas' && !extracted.proveedor_nombre) {
    const nifLook = normalizarNif(extracted.nif_emisor)
    if (!diccionario) diccionario = await cargarDiccionarioNif(supabase)
    const nombreCanon = nifLook ? (diccionario.get(nifLook)?.nombre || null) : null
    extracted.proveedor_nombre = nombreCanon || nifLook || ''
  }

  if (!extracted.proveedor_nombre || extracted.total === undefined || extracted.total === null) {
    // Datos insuficientes: en vez de error seco, guardar como lectura manual.
    return await guardarLecturaManual(supabase, file, hash, textoPdfCache)
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
    // v11: si el insert choca por hash (otro archivo idéntico ya entró en este
    // mismo lote entre el SELECT y el INSERT), NO es error: es duplicada.
    if (errInsert && /pdf_hash/.test(errInsert.message || '')) {
      return { estado: 'duplicada', archivo: file.nombre, motivo: 'hash duplicado (mismo PDF en el lote)' }
    }
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

    // v12: RETIRADA la regla dedup proveedor+numero. Generaba falsos positivos:
    // facturas reales distintas que comparten número (o número mal leído por OCR)
    // se descartaban y se perdían. El ÚNICO dedup válido es por hash de archivo
    // (mismo PDF exacto), que ya se aplica al inicio. Dos facturas distintas con
    // el mismo número pero distinto PDF son dos facturas y deben entrar ambas.

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

// BLINDAJE 0 API: factura que las reglas no pudieron leer. Se guarda el PDF en
// Drive (carpeta SIN_TITULAR) para no perderlo y se inserta en BBDD con estado
// 'pendiente_lectura_manual'. Nunca llama a la API ni para la cola.
// v11: IDEMPOTENTE. Recibe el hash ya calculado. Antes de insertar comprueba si
// el hash ya existe (duplicada) y, si el INSERT choca igualmente por carrera,
// lo trata como duplicada en vez de lanzar error → ningún archivo se pierde.
async function guardarLecturaManual(
  supabase: SupabaseClient,
  file: ArchivoEntrada,
  hash: string,
  textoPdf?: string,
): Promise<ProcesarResultado> {
  // Si ya existe una factura con este hash, no se duplica: se devuelve duplicada.
  const { data: yaExiste } = await supabase
    .from('facturas')
    .select('id, proveedor_nombre, estado, pdf_drive_id')
    .eq('pdf_hash', hash)
    .maybeSingle()
  if (yaExiste) {
    return {
      estado: 'duplicada',
      archivo: file.nombre,
      factura_existente: yaExiste as Record<string, unknown>,
      motivo: 'ya existe (lectura manual)',
    }
  }

  const hoy = new Date().toISOString().slice(0, 10)
  const numFactura = `LM-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`

  // v10: intentar sacar NIF emisor del texto del PDF (sin API). Si lo hay, se
  // guarda y el proveedor toma el nombre canónico del diccionario si existe.
  const nifEmisor = textoPdf ? extraerNifEmisorLibre(textoPdf) : null
  let proveedorNombre = 'PENDIENTE LECTURA MANUAL'
  if (nifEmisor) {
    const { data: regla } = await supabase
      .from('reglas_conciliacion')
      .select('razon_social')
      .eq('patron_nif', nifEmisor)
      .maybeSingle()
    proveedorNombre = (regla?.razon_social as string) || `NIF ${nifEmisor} (sin plantilla)`
  }

  // Respaldo en Drive (best-effort, sin titular conocido)
  const drive = await guardarEnDriveBestEffort(file, {
    proveedor_nombre: proveedorNombre,
    numero_factura: numFactura,
    fecha_factura: hoy,
    tipo: 'proveedor',
    plataforma: null,
    carpeta_titular: 'SIN_TITULAR',
  })

  const { data: nueva, error: errLM } = await supabase
    .from('facturas')
    .insert({
      pdf_original_name: file.nombre,
      pdf_hash: hash,
      proveedor_nombre: proveedorNombre,
      numero_factura: numFactura,
      fecha_factura: hoy,
      total: 0,
      estado: 'pendiente_lectura_manual',
      tipo: 'proveedor',
      titular_id: RUBEN_ID,
      nif_emisor: nifEmisor,
      pdf_drive_id: drive?.id ?? null,
      pdf_drive_url: drive?.webViewLink ?? null,
      pdf_filename: drive?.nombre ?? null,
      error_mensaje: drive
        ? 'Sin plantilla para este NIF. Añade la regla y reprocesa (no se gastó API).'
        : 'Sin plantilla para este NIF y Drive no disponible. Reintenta (no se gastó API).',
    })
    .select('*')
    .maybeSingle()

  // v11: si el insert choca por hash (carrera con otro idéntico del mismo lote),
  // NO es error: es duplicada. El archivo nunca se pierde.
  if (errLM) {
    if (/pdf_hash/.test(errLM.message || '')) {
      return { estado: 'duplicada', archivo: file.nombre, motivo: 'hash duplicado (mismo PDF en el lote)' }
    }
    return { estado: 'error', archivo: file.nombre, error: errLM.message }
  }

  return {
    estado: 'lectura_manual',
    archivo: file.nombre,
    factura_id: (nueva?.id as string) || undefined,
    factura: (nueva as Record<string, unknown>) || undefined,
    motivo: nifEmisor
      ? `lectura manual: sin plantilla NIF ${nifEmisor} (0€, sin API)`
      : 'lectura manual: sin plantilla NIF (0€, sin API)',
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
