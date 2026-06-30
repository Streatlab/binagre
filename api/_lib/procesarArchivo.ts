// procesarArchivo v23 — CANDADO ÚNICO DE PAGO POR PROVEEDOR (Rubén 20/06/26):
//      cualquier motor de pago (Mistral / Anthropic texto / Anthropic visión) se usa
//      como MÁXIMO UNA VEZ por NIF. Esa lectura aprende la plantilla; después el
//      proveedor se lee gratis por reglas o va a lectura MANUAL, nunca más a pago.
// procesarArchivo v22 — OCR gratis primero + BOOTSTRAP de pago acotado (regla 3 bis).
// v22: cascada de lectura COMPLETA con Anthropic como último escalón:
//      1) Reglas/plantilla por NIF (gratis)
//      2) OCR Tesseract (gratis) + reglas
//      3) Mistral bootstrap (pago acotado) — texto + reglas
//      3b) Anthropic bootstrap (último recurso) — extracción estructurada con
//          desglose de IVA, sobre el TEXTO ya extraído (barato). Tras leer, se
//          aprende la plantilla por NIF (candado).
//      Si NINGUNA vía lee → estado LECTURA_MANUAL con el PDF guardado en Drive.
// v21: antes de tratar un PDF como factura, se comprueba si es un RESUMEN de ventas
//      de plataforma (Uber/Glovo/Just Eat). Si lo es, va a ventas_plataforma y NO
//      se crea factura.
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
  extraerTextoPDFPorPaginas,
  pdfTieneTexto,
  extraerPorReglas,
  partirEnFacturas,
  extraerNifEmisorLibre,
  derivarPlantilla,
} from './extractores.js'
import type { ContenidoExtraido, PlantillaNif } from './extractores.js'
import type { ExtractedFactura } from './ocr.js'
import { extraerTextoOCRGratis } from './ocr-tesseract.js'
import { ocrMistralTexto, bootstrapApiActivo } from './ocr-mistral.js'
import { extraerFacturaAnthropic, anthropicBootstrapActivo, extraerFacturaAnthropicVisionUltimoRecurso } from './ocr-anthropic.js'
import { aplicarMatching, matchFactura } from './matching.js'
import { generarNombreArchivo, subirArchivoADrive, respaldarEnStorage } from './google-drive.js'
import { parseResumenPlataforma } from './parser-resumen-plataforma.js'
import type { ResumenVentaPlataforma } from './parser-resumen-plataforma.js'
import { detectarDocumentoPlataforma } from './detectarDocumentoPlataforma.js'
import { ingestarPedidosPlataforma } from './ingestaPlatos.js'
import { intentarVentaPlataforma } from './volcarVentasPlataforma.js'
import { intentarVentaProducto } from './volcarVentasProducto.js'

export type ProcesarEstado =
  | 'duplicada'
  | 'ignorada'
  | 'error'
  | 'ok'
  | 'lectura_manual'

// Kill-switch opcional del OCR gratis (Tesseract). Por defecto ENCENDIDO.
const OCR_TESSERACT_ACTIVO = process.env.OCR_DESACTIVAR_TESSERACT !== 'true'

// Kill-switch opcional del partido multi-factura. Por defecto ENCENDIDO.
const MULTIFACTURA_ACTIVO = process.env.OCR_DESACTIVAR_MULTIFACTURA !== 'true'

const NIF_RUBEN = '21669051S'
const NIF_EMILIO = '53484832B'
const RUBEN_ID = '6ce69d55-60d0-423c-b68b-eb795a0f32fe'
const EMILIO_ID = 'c5358d43-a9cc-4f4c-b0b3-99895bdf4354'

const NIF_PLATAFORMA: Record<string, string> = {
  uber: 'B88515200',
  glovo: 'B67282871',
  just_eat: 'B86008539',
}

function nifCanonicoPlataforma(extracted: ExtractedFactura): string | null {
  const p = extracted.plataforma
  if (p && NIF_PLATAFORMA[p]) return NIF_PLATAFORMA[p]
  const nom = (extracted.proveedor_nombre || '').toLowerCase()
  if (/\buber\b|portier\s*eats/.test(nom)) return NIF_PLATAFORMA.uber
  if (/\bglovo/.test(nom)) return NIF_PLATAFORMA.glovo
  if (/just\s*eat/.test(nom)) return NIF_PLATAFORMA.just_eat
  return null
}

const ESTADOS_CONCILIADA = ['conciliada', 'asociada']
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/

function normalizarNif(nif: string | null | undefined): string | null {
  if (!nif) return null
  const limpio = nif.replace(/[\s\-.]/g, '').toUpperCase()
  return limpio || null
}

function detectarTitularPorNombre(nombreCliente: string | null | undefined): {
  titularId: string | null; carpeta: string; match: boolean
} {
  if (!nombreCliente) return { titularId: null, carpeta: 'SIN_TITULAR', match: false }
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

function titularPorNifEnTexto(texto: string | null | undefined): {
  titularId: string; carpeta: string; nif: string
} | null {
  if (!texto) return null
  const t = texto.replace(/[\s\-.]/g, '').toUpperCase()
  if (t.includes(NIF_RUBEN)) return { titularId: RUBEN_ID, carpeta: 'RUBÉN', nif: NIF_RUBEN }
  if (t.includes(NIF_EMILIO)) return { titularId: EMILIO_ID, carpeta: 'EMILIO', nif: NIF_EMILIO }
  return null
}

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
  tipo_documento?: 'factura' | 'resumen_ventas'
  resumen_ventas?: {
    plataforma: string; marca: string; periodo: string
    bruto: number; neto: number; pedidos: number
  }
}

export interface ArchivoEntrada {
  nombre: string
  buffer: Buffer
  mimeType?: string | null
}

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
      : r.estado === 'ignorada' ? 'ignorada'
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
      resultado, origen_lectura: origen,
      factura_id: (r.factura_id as string) || null,
      ya_existia_factura_id: existenteId,
      conciliada, en_drive: enDrive,
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

  try {
    await respaldarEnStorage(file.buffer, file.nombre, hashArchivo)
  } catch (e) {
    console.error('[procesarArchivo] respaldo inicial falló:', e instanceof Error ? e.message : String(e))
  }

  // VENTAS DE PLATAFORMA (facturas JE, liquidaciones Glovo, resúmenes Uber)
  // → ventas_plataforma + % Prime/Promo. Si lo es, termina aquí.
  try {
    const vp = await intentarVentaPlataforma(supabase, file, tipo)
    if (vp) return [vp]
  } catch (e) {
    console.error('[procesarArchivo] venta plataforma falló:', e instanceof Error ? e.message : String(e))
  }

  // VENTAS DE PRODUCTO (Sincro sold_products / Uber detalle por producto):
  // → ventas_plato + ventas_franja. Si lo es, termina aquí.
  try {
    const vprod = await intentarVentaProducto(supabase, file, tipo)
    if (vprod) return [vprod]
  } catch (e) {
    console.error('[procesarArchivo] venta producto falló:', e instanceof Error ? e.message : String(e))
  }

  let contenido: ContenidoExtraido
  try {
    contenido = await extraerContenido(file, tipo)
  } catch (err) {
    const resErr: ProcesarResultado = {
      estado: 'error', archivo: file.nombre,
      error: `Error extrayendo contenido (${tipo}): ${errMsg(err)}`,
    }
    await registrarAuditoria(supabase, hashArchivo, sesionId, resErr)
    return [resErr]
  }

  const principal = await procesarContenidoPrincipal(supabase, file, contenido, tipo)
  const resultados: ProcesarResultado[] = Array.isArray(principal) ? principal : [principal]
  if (tipo === 'email' && contenido.adjuntos?.length) {
    for (const adj of contenido.adjuntos) {
      const tipoAdj = detectarTipoArchivo(adj.name, adj.mimeType)
      if (tipoAdj === 'pdf' || tipoAdj === 'imagen') {
        const sub = await procesarArchivo(supabase, {
          nombre: adj.name, buffer: adj.data, mimeType: adj.mimeType,
        }, sesionId)
        resultados.push(...sub)
      }
    }
  }
  for (const r of resultados) {
    await registrarAuditoria(supabase, hashArchivo, sesionId, r)
  }
  return resultados
}

async function extraerContenido(file: ArchivoEntrada, tipo: TipoArchivo): Promise<ContenidoExtraido> {
  const mime = file.mimeType || ''
  switch (tipo) {
    case 'pdf': return prepararVision(file.buffer, 'application/pdf')
    case 'imagen': return prepararVision(file.buffer, mime || 'image/jpeg')
    case 'word': return extraerWord(file.buffer)
    case 'excel': return extraerExcel(file.buffer)
    case 'email': return extraerEmail(file.buffer)
    case 'texto':
    default: return extraerTexto(file.buffer.toString('utf-8'))
  }
}

const PATRONES_NO_FACTURA = [
  /ingresos?\s*[1-4]\s*t/i,
  /ingresos?\s*(primer|segundo|tercer|cuarto)\s*trimestre/i,
  /resumen\s*ingresos?/i,
  /ingresos?\s*trimestr/i,
]
function esNoFactura(nombre: string): boolean {
  return PATRONES_NO_FACTURA.some(re => re.test(nombre))
}

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

async function nifTienePlantilla(supabase: SupabaseClient, nif: string | null): Promise<boolean> {
  if (!nif) return false
  const { data } = await supabase.from('reglas_conciliacion').select('id').eq('patron_nif', nif).maybeSingle()
  return !!data?.id
}

async function nifVisionUsada(supabase: SupabaseClient, nif: string | null): Promise<boolean> {
  if (!nif) return false
  const { data } = await supabase.from('reglas_conciliacion').select('vision_usada')
    .eq('patron_nif', nif).eq('vision_usada', true).maybeSingle()
  return !!data
}

async function marcarVisionUsada(supabase: SupabaseClient, nif: string | null): Promise<void> {
  if (!nif) return
  try {
    await supabase.from('reglas_conciliacion')
      .update({ vision_usada: true, vision_fecha: new Date().toISOString() }).eq('patron_nif', nif)
  } catch (e) { console.error('[marcarVisionUsada]', errMsg(e)) }
}

async function categoriaPorNif(supabase: SupabaseClient, nif: string | null): Promise<string | null> {
  if (!nif) return null
  const { data } = await supabase.from('reglas_conciliacion').select('categoria_codigo')
    .eq('patron_nif', nif).eq('activa', true).not('categoria_codigo', 'is', null)
    .order('prioridad', { ascending: false }).limit(1).maybeSingle()
  return (data?.categoria_codigo as string) || null
}

async function guardarEnDriveBestEffort(
  file: ArchivoEntrada,
  datos: {
    proveedor_nombre: string; numero_factura: string; fecha_factura: string
    tipo: 'proveedor' | 'plataforma'; plataforma: 'uber' | 'glovo' | 'just_eat' | null
    carpeta_titular: string
  },
): Promise<{ id: string; webViewLink: string; nombre: string } | null> {
  try {
    const ext = extensionDeNombre(file.nombre)
    const nombreArchivo = generarNombreArchivo({
      proveedor_nombre: datos.proveedor_nombre, numero_factura: datos.numero_factura,
      fecha_factura: datos.fecha_factura, tipo: datos.tipo, plataforma: datos.plataforma,
    }, ext)
    const drive = await subirArchivoADrive(file.buffer, nombreArchivo, datos, ext)
    return { id: drive.id, webViewLink: drive.webViewLink, nombre: nombreArchivo }
  } catch { return null }
}

async function resolverTitular(
  supabase: SupabaseClient, extracted: ExtractedFactura, texto?: string | null,
): Promise<{ titularId: string | null; carpeta: string; pendienteTitularManual: boolean; nifClienteNorm: string | null }> {
  let nifClienteNorm = normalizarNif(extracted.nif_cliente)
  const nombreCliente = (extracted as { nombre_cliente?: string | null }).nombre_cliente
  let titularId: string | null = null; let carpeta = 'SIN_TITULAR'

  if (nifClienteNorm === NIF_RUBEN) { titularId = RUBEN_ID; carpeta = 'RUBÉN' }
  else if (nifClienteNorm === NIF_EMILIO) { titularId = EMILIO_ID; carpeta = 'EMILIO' }
  else if (nifClienteNorm) {
    const { data: titular } = await supabase.from('titulares').select('id, carpeta_drive')
      .eq('nif', nifClienteNorm).maybeSingle()
    if (titular) { titularId = titular.id as string; carpeta = (titular.carpeta_drive as string) || 'SIN_TITULAR' }
  }
  if (!titularId) {
    const porNombre = detectarTitularPorNombre(nombreCliente)
    if (porNombre.match) { titularId = porNombre.titularId; carpeta = porNombre.carpeta }
  }
  if (!titularId) {
    const porTexto = titularPorNifEnTexto(texto)
    if (porTexto) { titularId = porTexto.titularId; carpeta = porTexto.carpeta; if (!nifClienteNorm) nifClienteNorm = porTexto.nif }
  }
  if (!titularId) return { titularId: null, carpeta: 'SIN_TITULAR', pendienteTitularManual: true, nifClienteNorm }
  return { titularId, carpeta, pendienteTitularManual: false, nifClienteNorm }
}

async function aprenderProveedorNif(
  supabase: SupabaseClient, extracted: ExtractedFactura, texto?: string | null,
): Promise<void> {
  try {
    const nif = normalizarNif(extracted.nif_emisor)
    if (!nif || !extracted.proveedor_nombre) return
    const { data: ya } = await supabase.from('reglas_conciliacion').select('id').eq('patron_nif', nif).maybeSingle()
    if (ya) return
    const plantilla = derivarPlantilla(texto, extracted)
    await supabase.from('reglas_conciliacion').insert({
      patron: extracted.proveedor_nombre, tipo_categoria: 'gasto', patron_nif: nif,
      razon_social: extracted.proveedor_nombre, plantilla_total_label: plantilla.totalLabel,
      plantilla_fecha_formato: plantilla.fechaFormato, plantilla_num_label: plantilla.numLabel,
      activa: true, prioridad: 50,
    })
  } catch (e) { console.error('[aprenderProveedorNif]', errMsg(e)) }
}

async function guardarResumenPlataforma(
  supabase: SupabaseClient, file: ArchivoEntrada, r: ResumenVentaPlataforma,
): Promise<ProcesarResultado> {
  const ticket = r.pedidos > 0 ? r.bruto / r.pedidos : 0
  const resumenInfo = {
    plataforma: r.plataforma, marca: r.marca,
    periodo: `${r.fecha_inicio_periodo} → ${r.fecha_fin_periodo}`,
    bruto: r.bruto, neto: r.neto, pedidos: r.pedidos,
  }
  const { data: existe } = await supabase.from('ventas_plataforma').select('id')
    .eq('fecha_inicio_periodo', r.fecha_inicio_periodo).eq('fecha_fin_periodo', r.fecha_fin_periodo)
    .eq('plataforma', r.plataforma).eq('marca', r.marca).maybeSingle()
  if (existe) {
    await supabase.from('ventas_plataforma').update({
      bruto: r.bruto, neto: r.neto, pedidos: r.pedidos, ticket_medio: ticket,
      ...(r.fecha_pago ? { fecha_pago: r.fecha_pago } : {}), updated_at: new Date().toISOString(),
    }).eq('id', existe.id as string)
    return { estado: 'duplicada', archivo: file.nombre, tipo_documento: 'resumen_ventas',
      resumen_ventas: resumenInfo, motivo: `resumen de ventas ${r.plataforma} · ${r.marca} · ya existía, actualizado` }
  }
  const { error } = await supabase.from('ventas_plataforma').insert({
    fecha_inicio_periodo: r.fecha_inicio_periodo, fecha_fin_periodo: r.fecha_fin_periodo,
    plataforma: r.plataforma, marca: r.marca, bruto: r.bruto, neto: r.neto,
    pedidos: r.pedidos, ticket_medio: ticket, ingreso_colaborador: 0,
    ...(r.fecha_pago ? { fecha_pago: r.fecha_pago } : {}),
    facturas_origen: r.referencia ? [r.referencia] : [],
  })
  if (error) return { estado: 'error', archivo: file.nombre, error: `resumen de ventas: ${error.message}` }
  return { estado: 'ok', archivo: file.nombre, tipo_documento: 'resumen_ventas',
    resumen_ventas: resumenInfo, motivo: `resumen de ventas ${r.plataforma} · ${r.marca} · ${r.fecha_inicio_periodo} → Ventas` }
}

async function procesarContenidoPrincipal(
  supabase: SupabaseClient, file: ArchivoEntrada, contenido: ContenidoExtraido, tipo: TipoArchivo,
): Promise<ProcesarResultado | ProcesarResultado[]> {
  if (esNoFactura(file.nombre)) {
    return { estado: 'ignorada', archivo: file.nombre, motivo: 'no es una factura: resumen de ingresos' }
  }
  const hash = createHash('sha256').update(file.buffer).digest('hex')

  try {
    let textoDet = typeof contenido.data === 'string' ? contenido.data : ''
    if (tipo === 'pdf' && !textoDet) { try { textoDet = await extraerTextoPDF(file.buffer) } catch {} }
    const det = detectarDocumentoPlataforma(file.nombre, textoDet)
    if (det.esPedidos) {
      let ingestados = 0
      if (det.tipo === 'glovo_bill_csv' || det.tipo === 'glovo_orderdetails_csv' ||
          det.tipo === 'uber_articulo_csv' || det.tipo === 'sincro_sold_products') {
        try {
          const buf = tipo === 'excel' ? file.buffer : null
          const res = await ingestarPedidosPlataforma(supabase, det.tipo, textoDet, buf, file.nombre)
          ingestados = res.insertados
        } catch (e) { console.error('[procesarArchivo] ingesta de platos falló:', errMsg(e)) }
      }
      return { estado: 'ok', archivo: file.nombre, tipo_documento: 'resumen_ventas',
        motivo: ingestados > 0 ? `documento ${det.plataforma} (${det.tipo}) → ${ingestados} platos a Ventas`
          : `documento ${det.plataforma} (${det.tipo}) → Ventas` }
    }
  } catch (e) { console.error('[procesarArchivo] detección de documento de plataforma falló:', errMsg(e)) }

  if (tipo === 'pdf') {
    try {
      const textoResumen = await extraerTextoPDF(file.buffer)
      if (pdfTieneTexto(textoResumen)) {
        const resumen = parseResumenPlataforma(textoResumen)
        if (resumen) return await guardarResumenPlataforma(supabase, file, resumen)
      }
    } catch (e) { console.error('[procesarArchivo] chequeo resumen plataforma falló:', errMsg(e)) }
  }

  const { data: existente } = await supabase.from('facturas')
    .select('id, numero_factura, proveedor_nombre, total, estado, pdf_drive_id, pdf_drive_url, fecha_factura, tipo, plataforma, titular_id')
    .eq('pdf_hash', hash).maybeSingle()
  if (existente) {
    let motivo = 'ya existe'
    if (!existente.pdf_drive_id) {
      try {
        let carpeta = 'SIN_TITULAR'
        if (existente.titular_id) {
          const { data: t } = await supabase.from('titulares').select('carpeta_drive')
            .eq('id', existente.titular_id as string).maybeSingle()
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
        await supabase.from('facturas').update({
          pdf_drive_id: drive.id, pdf_drive_url: drive.webViewLink, error_mensaje: null,
        }).eq('id', existente.id as string)
        ;(existente as Record<string, unknown>).pdf_drive_id = drive.id
        ;(existente as Record<string, unknown>).pdf_drive_url = drive.webViewLink
        motivo = 'ya existe · PDF subido a Drive ahora'
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        motivo = `ya existe · no se pudo subir a Drive: ${msg}`
      }
    }
    return { estado: 'duplicada', archivo: file.nombre,
      factura_existente: existente as Record<string, unknown>, motivo }
  }

  if (tipo === 'pdf' && MULTIFACTURA_ACTIVO) {
    try {
      const { data: yaMulti } = await supabase.from('facturas').select('id')
        .like('pdf_hash', `${hash}#%`).limit(1).maybeSingle()
      if (yaMulti) return { estado: 'duplicada', archivo: file.nombre, motivo: 'ya existe (PDF con varias facturas ya procesado)' }
      const textoCombinado = await extraerTextoPDF(file.buffer)
      if (pdfTieneTexto(textoCombinado)) {
        const paginas = await extraerTextoPDFPorPaginas(file.buffer)
        const diccMulti = await cargarDiccionarioNif(supabase)
        const facturas = partirEnFacturas(textoCombinado, paginas, (nif) => diccMulti.get(nif)?.plantilla || null)
        if (facturas.length >= 2) return await guardarFacturasMulti(supabase, file, hash, facturas, diccMulti, textoCombinado)
      }
    } catch (e) { console.error('[procesarArchivo] multi-factura no aplicado:', errMsg(e)) }
  }

  let extracted: ExtractedFactura
  let extractedReglas: ExtractedFactura | null = null
  let origenLectura: 'reglas' | 'ocr_tesseract' | 'mistral_bootstrap' | 'anthropic_bootstrap' | 'anthropic_vision' = 'reglas'
  let visionUsadaNif: string | null = null
  let diccionario: Map<string, { nombre: string | null; plantilla: PlantillaNif }> | null = null
  let textoPdfCache = ''

  if (tipo === 'pdf') {
    try {
      const textoPdf = await extraerTextoPDF(file.buffer)
      textoPdfCache = textoPdf
      if (pdfTieneTexto(textoPdf)) {
        diccionario = await cargarDiccionarioNif(supabase)
        extractedReglas = extraerPorReglas(textoPdf, (nif) => diccionario?.get(nif)?.plantilla || null, false)
      }
    } catch { extractedReglas = null }
  }

  if (!extractedReglas && contenido.tipo === 'texto' && typeof contenido.data === 'string') {
    const textoDoc = contenido.data
    if (textoDoc && textoDoc.replace(/\s/g, '').length >= 20) {
      textoPdfCache = textoPdfCache && textoPdfCache.length > textoDoc.length ? textoPdfCache : textoDoc
      if (!diccionario) diccionario = await cargarDiccionarioNif(supabase)
      extractedReglas = extraerPorReglas(textoDoc, (nif) => diccionario?.get(nif)?.plantilla || null, false)
    }
  }

  if (!extractedReglas && OCR_TESSERACT_ACTIVO && (tipo === 'pdf' || tipo === 'imagen')) {
    try {
      const textoOCR = await extraerTextoOCRGratis(file.buffer, tipo)
      if (textoOCR && textoOCR.replace(/\s/g, '').length >= 30) {
        textoPdfCache = textoPdfCache && textoPdfCache.length > textoOCR.length ? textoPdfCache : textoOCR
        if (!diccionario) diccionario = await cargarDiccionarioNif(supabase)
        const extractedOCR = extraerPorReglas(textoOCR, (nif) => diccionario?.get(nif)?.plantilla || null, false)
        if (extractedOCR) { extractedReglas = extractedOCR; origenLectura = 'ocr_tesseract' }
      }
    } catch (ocrErr) { console.error('[procesarArchivo] OCR Tesseract no resolvió:', errMsg(ocrErr)) }
  }

  const nifCandPago = textoPdfCache ? normalizarNif(extraerNifEmisorLibre(textoPdfCache)) : null
  const pagoYaUsado = nifCandPago ? await nifVisionUsada(supabase, nifCandPago) : false

  if (!extractedReglas && !pagoYaUsado && bootstrapApiActivo() && (tipo === 'pdf' || tipo === 'imagen')) {
    try {
      const textoMistral = await ocrMistralTexto(file.buffer, tipo === 'imagen' ? 'imagen' : 'pdf')
      if (textoMistral && textoMistral.replace(/\s/g, '').length >= 30) {
        textoPdfCache = textoPdfCache && textoPdfCache.length > textoMistral.length ? textoPdfCache : textoMistral
        if (!diccionario) diccionario = await cargarDiccionarioNif(supabase)
        const extractedMistral = extraerPorReglas(textoMistral, (nif) => diccionario?.get(nif)?.plantilla || null, false)
        if (extractedMistral) { extractedReglas = extractedMistral; origenLectura = 'mistral_bootstrap' }
      }
    } catch (mistralErr) { console.error('[procesarArchivo] bootstrap Mistral no resolvió:', errMsg(mistralErr)) }
  }

  if (!extractedReglas && !pagoYaUsado && anthropicBootstrapActivo() && (tipo === 'pdf' || tipo === 'imagen')) {
    try {
      const facAnthropic = await extraerFacturaAnthropic(
        file.buffer, tipo === 'imagen' ? 'imagen' : 'pdf',
        file.mimeType || (tipo === 'imagen' ? 'image/jpeg' : 'application/pdf'), textoPdfCache,
      )
      if (facAnthropic) { extractedReglas = facAnthropic; origenLectura = 'anthropic_bootstrap' }
    } catch (anthropicErr) { console.error('[procesarArchivo] bootstrap Anthropic no resolvió:', errMsg(anthropicErr)) }
  }

  if (!extractedReglas && !pagoYaUsado && (tipo === 'pdf' || tipo === 'imagen')) {
    try {
      const facVision = await extraerFacturaAnthropicVisionUltimoRecurso(
        file.buffer, tipo === 'imagen' ? 'imagen' : 'pdf',
        file.mimeType || (tipo === 'imagen' ? 'image/jpeg' : 'application/pdf'),
      )
      if (facVision) {
        extractedReglas = facVision; origenLectura = 'anthropic_vision'
        visionUsadaNif = normalizarNif(facVision.nif_emisor) || nifCandPago
      }
    } catch (visErr) { console.error('[procesarArchivo] visión último recurso no resolvió:', errMsg(visErr)) }
  }

  if (extractedReglas) {
    extracted = extractedReglas
  } else {
    return await guardarLecturaManual(supabase, file, hash, textoPdfCache)
  }

  if (!extracted.proveedor_nombre) {
    const nifLook = normalizarNif(extracted.nif_emisor)
    if (!diccionario) diccionario = await cargarDiccionarioNif(supabase)
    const nombreCanon = nifLook ? (diccionario.get(nifLook)?.nombre || null) : null
    extracted.proveedor_nombre = nombreCanon || nifLook || ''
  }

  if (!extracted.proveedor_nombre || extracted.total === undefined || extracted.total === null) {
    return await guardarLecturaManual(supabase, file, hash, textoPdfCache)
  }

  const nifPlat = nifCanonicoPlataforma(extracted)
  if (nifPlat) extracted.nif_emisor = nifPlat

  const fechaFactura = fechaValida(extracted.fecha_factura) ? extracted.fecha_factura : new Date().toISOString().slice(0, 10)
  const numFactura = extracted.numero_factura || `SN-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`

  // Duplicado CONTABLE 100%: misma factura ya registrada = mismo NIF emisor + mismo
  // nº de factura + mismo importe. Solo se considera duplicado por esta identidad real
  // (no por parecidos). Requiere nº de factura real (no autogenerado SN-/LM-).
  {
    const nifDup = normalizarNif(extracted.nif_emisor)
    if (nifDup && extracted.numero_factura && extracted.total != null) {
      const { data: dupReal } = await supabase.from('facturas')
        .select('id, proveedor_nombre, numero_factura, total, estado, pdf_drive_url')
        .eq('nif_emisor', nifDup)
        .eq('numero_factura', extracted.numero_factura)
        .eq('total', extracted.total)
        .limit(1).maybeSingle()
      if (dupReal) {
        return {
          estado: 'duplicada', archivo: file.nombre,
          factura_existente: dupReal as Record<string, unknown>,
          motivo: 'ya existe (misma factura: NIF emisor + nº factura + importe)',
        }
      }
    }
  }

  const { data: nueva, error: errInsert } = await supabase.from('facturas').insert({
    pdf_original_name: file.nombre, pdf_hash: hash,
    proveedor_nombre: extracted.proveedor_nombre, numero_factura: numFactura,
    fecha_factura: fechaFactura, total: extracted.total, estado: 'procesando',
  }).select().single()

  if (errInsert || !nueva) {
    if (errInsert && /pdf_hash/.test(errInsert.message || '')) {
      return { estado: 'duplicada', archivo: file.nombre, motivo: 'hash duplicado (mismo PDF en el lote)' }
    }
    return { estado: 'error', archivo: file.nombre, error: errInsert?.message || 'No se pudo crear factura' }
  }

  try {
    const nifEmisorNorm = normalizarNif(extracted.nif_emisor)
    let proveedorId: string | undefined
    {
      const provNombre = extracted.proveedor_nombre.trim()
      const { data: provPorNombre } = await supabase.from('proveedores').select('id')
        .ilike('nombre', `%${provNombre}%`).maybeSingle()
      if (provPorNombre?.id) proveedorId = provPorNombre.id
    }
    if (!proveedorId && extracted.proveedor_nombre) {
      const { data: nuevoProv } = await supabase.from('proveedores')
        .insert({ nombre: extracted.proveedor_nombre, activo: true }).select('id').single()
      proveedorId = nuevoProv?.id
    }

    let titularId: string | null = null; let carpetaTitular = 'SIN_TITULAR'
    let pendienteTitularManual = false
    let nifClienteNorm = normalizarNif(extracted.nif_cliente)
    const nombreCliente = (extracted as { nombre_cliente?: string | null }).nombre_cliente

    if (nifClienteNorm === NIF_RUBEN) { titularId = RUBEN_ID; carpetaTitular = 'RUBÉN' }
    else if (nifClienteNorm === NIF_EMILIO) { titularId = EMILIO_ID; carpetaTitular = 'EMILIO' }
    else if (nifClienteNorm) {
      const { data: titular } = await supabase.from('titulares').select('id, carpeta_drive')
        .eq('nif', nifClienteNorm).maybeSingle()
      if (titular) { titularId = titular.id as string; carpetaTitular = (titular.carpeta_drive as string) || 'SIN_TITULAR' }
    }
    if (!titularId) {
      const porNombre = detectarTitularPorNombre(nombreCliente)
      if (porNombre.match) { titularId = porNombre.titularId; carpetaTitular = porNombre.carpeta }
    }
    if (!titularId) {
      const porTexto = titularPorNifEnTexto(textoPdfCache)
      if (porTexto) { titularId = porTexto.titularId; carpetaTitular = porTexto.carpeta; if (!nifClienteNorm) nifClienteNorm = porTexto.nif }
    }
    if (!titularId) { titularId = null; carpetaTitular = 'SIN_TITULAR'; pendienteTitularManual = true }

    await supabase.from('facturas').update({
      proveedor_id: proveedorId, proveedor_nombre: extracted.proveedor_nombre,
      numero_factura: extracted.numero_factura, fecha_factura: fechaFactura,
      es_recapitulativa: extracted.es_recapitulativa,
      periodo_inicio: extracted.periodo_inicio, periodo_fin: extracted.periodo_fin,
      tipo: extracted.tipo, plataforma: extracted.plataforma,
      titular_id: titularId, nif_cliente: nifClienteNorm, nif_emisor: nifEmisorNorm,
      categoria_factura: await categoriaPorNif(supabase, nifEmisorNorm),
      base_4: extracted.base_4, iva_4: extracted.iva_4,
      base_10: extracted.base_10, iva_10: extracted.iva_10,
      base_21: extracted.base_21, iva_21: extracted.iva_21,
      total: extracted.total, ocr_confianza: extracted.confianza,
      ocr_raw: { ...extracted, origen_lectura: origenLectura },
      ...(pendienteTitularManual ? { estado: 'pendiente_titular_manual' } : {}),
    }).eq('id', nueva.id)

    await aprenderProveedorNif(supabase, extracted, textoPdfCache)
    if (origenLectura === 'mistral_bootstrap' || origenLectura === 'anthropic_bootstrap' || origenLectura === 'anthropic_vision') {
      await marcarVisionUsada(supabase, visionUsadaNif || normalizarNif(extracted.nif_emisor))
    }

    if (extracted.tipo === 'plataforma' && extracted.plataforma_detalle?.length) {
      const detalleRows = []
      for (const det of extracted.plataforma_detalle) {
        const { data: marca } = await supabase.from('marcas').select('id')
          .ilike('nombre', `%${det.marca_nombre}%`).maybeSingle()
        detalleRows.push({
          factura_id: nueva.id, marca_id: marca?.id ?? null, marca_nombre: det.marca_nombre,
          pedidos: det.pedidos, ventas_brutas: det.ventas_brutas, comision: det.comision,
          comision_iva: det.comision_iva, fee_fijo: det.fee_fijo, ads: det.ads,
          promos_cubiertas: det.promos_cubiertas, neto_liquidado: det.neto_liquidado,
          periodo_inicio: det.periodo_inicio, periodo_fin: det.periodo_fin,
        })
      }
      if (detalleRows.length > 0) await supabase.from('facturas_plataforma_detalle').insert(detalleRows)
    }

    try {
      const resultadoMatch = await matchFactura(supabase, {
        ...extracted, id: nueva.id, total: extracted.total, titular_id: titularId,
      })
      await aplicarMatching(supabase, nueva.id, resultadoMatch, {
        proveedor_nombre: extracted.proveedor_nombre, nif_emisor: nifEmisorNorm,
      })
      if (pendienteTitularManual) {
        await supabase.from('facturas').update({ estado: 'pendiente_titular_manual' }).eq('id', nueva.id)
      }
    } catch (matchErr) { console.error('[procesarArchivo] error en matching:', errMsg(matchErr)) }

    const ext = extensionDeNombre(file.nombre)
    const nombreArchivo = generarNombreArchivo({
      proveedor_nombre: extracted.proveedor_nombre, numero_factura: extracted.numero_factura,
      fecha_factura: fechaFactura, tipo: extracted.tipo, plataforma: extracted.plataforma,
    }, ext)
    let driveErrorMsg: string | null = null
    try {
      const drive = await subirArchivoADrive(file.buffer, nombreArchivo, {
        proveedor_nombre: extracted.proveedor_nombre, numero_factura: extracted.numero_factura,
        fecha_factura: fechaFactura, tipo: extracted.tipo, plataforma: extracted.plataforma,
        carpeta_titular: carpetaTitular,
      }, ext)
      await supabase.from('facturas').update({
        pdf_drive_id: drive.id, pdf_drive_url: drive.webViewLink, pdf_filename: nombreArchivo,
      }).eq('id', nueva.id)
    } catch (driveErr) {
      driveErrorMsg = errMsg(driveErr)
      if (driveErrorMsg.includes('invalid_client') || driveErrorMsg.includes('invalid_grant')) {
        driveErrorMsg = 'Drive desconectado · Reconecta Google Drive en Ajustes'
      }
      if (!pendienteTitularManual) {
        await supabase.from('facturas').update({ estado: 'drive_pendiente' }).eq('id', nueva.id)
      }
    }

    const mensajeFinal = driveErrorMsg ? `Drive: ${driveErrorMsg}` : tipo === 'texto' ? 'origen: texto pegado' : null
    await supabase.from('facturas').update({ error_mensaje: mensajeFinal }).eq('id', nueva.id)

    const { data: finalFac } = await supabase.from('facturas').select('*').eq('id', nueva.id).single()
    return { estado: 'ok', archivo: file.nombre, factura_id: nueva.id, factura: finalFac as Record<string, unknown> }
  } catch (ocrErr) {
    const msg = errMsg(ocrErr)
    await supabase.from('facturas').update({ estado: 'error', error_mensaje: msg }).eq('id', nueva.id)
    return { estado: 'error', archivo: file.nombre, factura_id: nueva.id, error: msg }
  }
}

async function guardarFacturasMulti(
  supabase: SupabaseClient, file: ArchivoEntrada, hashArchivo: string,
  facturas: ExtractedFactura[],
  diccionario: Map<string, { nombre: string | null; plantilla: PlantillaNif }>,
  textoCombinado?: string,
): Promise<ProcesarResultado[]> {
  for (const f of facturas) {
    if (!f.proveedor_nombre) {
      const nifLook = normalizarNif(f.nif_emisor)
      const nombreCanon = nifLook ? (diccionario.get(nifLook)?.nombre || null) : null
      f.proveedor_nombre = nombreCanon || nifLook || 'PROVEEDOR'
    }
  }
  const ext = extensionDeNombre(file.nombre)
  const primera = facturas[0]
  const titPrimeraInfo = await resolverTitular(supabase, primera, textoCombinado)
  const fechaPrimera = fechaValida(primera.fecha_factura) ? primera.fecha_factura : new Date().toISOString().slice(0, 10)
  const nombreArchivoDrive = generarNombreArchivo({
    proveedor_nombre: primera.proveedor_nombre, numero_factura: `MULTI-${facturas.length}f`,
    fecha_factura: fechaPrimera, tipo: primera.tipo, plataforma: primera.plataforma,
  }, ext)
  let driveId: string | null = null; let driveUrl: string | null = null; let driveErrorMsg: string | null = null
  try {
    const drive = await subirArchivoADrive(file.buffer, nombreArchivoDrive, {
      proveedor_nombre: primera.proveedor_nombre, numero_factura: `MULTI-${facturas.length}f`,
      fecha_factura: fechaPrimera, tipo: primera.tipo, plataforma: primera.plataforma,
      carpeta_titular: titPrimeraInfo.carpeta,
    }, ext)
    driveId = drive.id; driveUrl = drive.webViewLink
  } catch (e) {
    driveErrorMsg = errMsg(e)
    if (driveErrorMsg.includes('invalid_client') || driveErrorMsg.includes('invalid_grant')) {
      driveErrorMsg = 'Drive desconectado · Reconecta Google Drive en Ajustes'
    }
  }

  const resultados: ProcesarResultado[] = []
  for (let i = 0; i < facturas.length; i++) {
    const extracted = facturas[i]
    const hashSub = `${hashArchivo}#${i}`
    const { data: yaExisteSub } = await supabase.from('facturas').select('id, estado').eq('pdf_hash', hashSub).maybeSingle()
    if (yaExisteSub) {
      resultados.push({ estado: 'duplicada', archivo: file.nombre, factura_existente: yaExisteSub as Record<string, unknown>, motivo: `sub-factura ${i + 1} ya existe` })
      continue
    }
    const fechaFactura = fechaValida(extracted.fecha_factura) ? extracted.fecha_factura : new Date().toISOString().slice(0, 10)
    const numFactura = extracted.numero_factura || `SN-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`
    const nifPlatMulti = nifCanonicoPlataforma(extracted)
    if (nifPlatMulti) extracted.nif_emisor = nifPlatMulti
    const nifEmisorNorm = normalizarNif(extracted.nif_emisor)
    const { data: nueva, error: errInsert } = await supabase.from('facturas').insert({
      pdf_original_name: file.nombre, pdf_hash: hashSub,
      proveedor_nombre: extracted.proveedor_nombre, numero_factura: numFactura,
      fecha_factura: fechaFactura, total: extracted.total, estado: 'procesando',
    }).select().single()
    if (errInsert || !nueva) {
      if (errInsert && /pdf_hash/.test(errInsert.message || '')) {
        resultados.push({ estado: 'duplicada', archivo: file.nombre, motivo: `sub-factura ${i + 1} duplicada (hash)` })
        continue
      }
      resultados.push({ estado: 'error', archivo: file.nombre, error: errInsert?.message || `No se pudo crear sub-factura ${i + 1}` })
      continue
    }
    try {
      let proveedorId: string | undefined
      {
        const { data: provPorNombre } = await supabase.from('proveedores').select('id')
          .ilike('nombre', `%${extracted.proveedor_nombre.trim()}%`).maybeSingle()
        if (provPorNombre?.id) proveedorId = provPorNombre.id
      }
      if (!proveedorId && extracted.proveedor_nombre) {
        const { data: nuevoProv } = await supabase.from('proveedores')
          .insert({ nombre: extracted.proveedor_nombre, activo: true }).select('id').single()
        proveedorId = nuevoProv?.id
      }
      const tit = await resolverTitular(supabase, extracted, textoCombinado)
      await supabase.from('facturas').update({
        proveedor_id: proveedorId, proveedor_nombre: extracted.proveedor_nombre,
        numero_factura: extracted.numero_factura, fecha_factura: fechaFactura,
        es_recapitulativa: extracted.es_recapitulativa,
        periodo_inicio: extracted.periodo_inicio, periodo_fin: extracted.periodo_fin,
        tipo: extracted.tipo, plataforma: extracted.plataforma,
        titular_id: tit.titularId, nif_cliente: tit.nifClienteNorm, nif_emisor: nifEmisorNorm,
        categoria_factura: await categoriaPorNif(supabase, nifEmisorNorm),
        base_4: extracted.base_4, iva_4: extracted.iva_4,
        base_10: extracted.base_10, iva_10: extracted.iva_10,
        base_21: extracted.base_21, iva_21: extracted.iva_21,
        total: extracted.total, ocr_confianza: extracted.confianza,
        ocr_raw: { ...extracted, origen_lectura: 'reglas', multifactura: true, sub_indice: i, sub_total: facturas.length },
        pdf_drive_id: driveId, pdf_drive_url: driveUrl, pdf_filename: nombreArchivoDrive,
        ...(tit.pendienteTitularManual ? { estado: 'pendiente_titular_manual' } : {}),
      }).eq('id', nueva.id)
      await aprenderProveedorNif(supabase, extracted, textoCombinado)
      try {
        const resultadoMatch = await matchFactura(supabase, { ...extracted, id: nueva.id, total: extracted.total, titular_id: tit.titularId })
        await aplicarMatching(supabase, nueva.id, resultadoMatch, { proveedor_nombre: extracted.proveedor_nombre, nif_emisor: nifEmisorNorm })
        if (tit.pendienteTitularManual) await supabase.from('facturas').update({ estado: 'pendiente_titular_manual' }).eq('id', nueva.id)
      } catch (matchErr) { console.error('[guardarFacturasMulti] matching:', errMsg(matchErr)) }
      if (driveErrorMsg && !tit.pendienteTitularManual) {
        await supabase.from('facturas').update({ estado: 'drive_pendiente', error_mensaje: `Drive: ${driveErrorMsg}` }).eq('id', nueva.id)
      }
      const { data: finalFac } = await supabase.from('facturas').select('*').eq('id', nueva.id).single()
      resultados.push({ estado: 'ok', archivo: file.nombre, factura_id: nueva.id,
        factura: finalFac as Record<string, unknown>, motivo: `factura ${i + 1} de ${facturas.length} del PDF` })
    } catch (e) {
      const msg = errMsg(e)
      await supabase.from('facturas').update({ estado: 'error', error_mensaje: msg }).eq('id', nueva.id)
      resultados.push({ estado: 'error', archivo: file.nombre, factura_id: nueva.id, error: msg })
    }
  }
  return resultados
}

async function guardarLecturaManual(
  supabase: SupabaseClient, file: ArchivoEntrada, hash: string, textoPdf?: string,
): Promise<ProcesarResultado> {
  const { data: yaExiste } = await supabase.from('facturas').select('id, proveedor_nombre, estado, pdf_drive_id')
    .eq('pdf_hash', hash).maybeSingle()
  if (yaExiste) return { estado: 'duplicada', archivo: file.nombre, factura_existente: yaExiste as Record<string, unknown>, motivo: 'ya existe (lectura manual)' }
  const hoy = new Date().toISOString().slice(0, 10)
  const numFactura = `LM-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`
  const nifEmisor = textoPdf ? extraerNifEmisorLibre(textoPdf) : null
  let proveedorNombre = 'PENDIENTE LECTURA MANUAL'
  if (nifEmisor) {
    const { data: regla } = await supabase.from('reglas_conciliacion').select('razon_social').eq('patron_nif', nifEmisor).maybeSingle()
    proveedorNombre = (regla?.razon_social as string) || `NIF ${nifEmisor} (sin plantilla)`
  }
  const titTexto = titularPorNifEnTexto(textoPdf)
  const carpetaTitular = titTexto?.carpeta ?? 'SIN_TITULAR'
  const drive = await guardarEnDriveBestEffort(file, {
    proveedor_nombre: proveedorNombre, numero_factura: numFactura, fecha_factura: hoy,
    tipo: 'proveedor', plataforma: null, carpeta_titular: carpetaTitular,
  })
  const { data: nueva, error: errLM } = await supabase.from('facturas').insert({
    pdf_original_name: file.nombre, pdf_hash: hash, proveedor_nombre: proveedorNombre,
    numero_factura: numFactura, fecha_factura: hoy, total: 0,
    estado: 'pendiente_lectura_manual', tipo: 'proveedor',
    titular_id: titTexto?.titularId ?? null, nif_cliente: titTexto?.nif ?? null, nif_emisor: nifEmisor,
    pdf_drive_id: drive?.id ?? null, pdf_drive_url: drive?.webViewLink ?? null, pdf_filename: drive?.nombre ?? null,
    error_mensaje: drive
      ? 'No se pudo leer con plantilla, Tesseract, Mistral ni Anthropic. Revisa la plantilla del NIF o lectura manual.'
      : 'No se pudo leer y Drive no disponible. Reintenta.',
  }).select('*').maybeSingle()
  if (errLM) {
    if (/pdf_hash/.test(errLM.message || '')) return { estado: 'duplicada', archivo: file.nombre, motivo: 'hash duplicado (mismo PDF en el lote)' }
    return { estado: 'error', archivo: file.nombre, error: errLM.message }
  }
  return {
    estado: 'lectura_manual', archivo: file.nombre,
    factura_id: (nueva?.id as string) || undefined, factura: (nueva as Record<string, unknown>) || undefined,
    motivo: nifEmisor ? `lectura manual: sin plantilla NIF ${nifEmisor}` : 'lectura manual: ninguna vía leyó',
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
