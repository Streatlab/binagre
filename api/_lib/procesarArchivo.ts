// procesarArchivo v17 — TITULAR EXACTO POR NIF EN TEXTO (Rubén 03/06/26).
//                      Toda factura es de Rubén o de Emilio. Se detecta el titular
//                      buscando su NIF (21669051S / 53484832B) en el texto del
//                      documento: si aparece uno, el titular es exacto, no estimado.
//                      Se ELIMINA el default a Rubén: lo que no se detecta queda
//                      titular NULL + pendiente_titular_manual (nunca colgado a uno).
// v16 — Mistral SOLO arranca proveedor NUEVO (NIF sin ficha en reglas_conciliacion).
//                      Si el NIF emisor ya está registrado, NUNCA se vuelve a llamar a Mistral.
// v15 — + PASO 3 Mistral (red de seguridad de pago tras reglas+Tesseract)
// v14 — auditoría 1-a-1 + plantilla por NIF + OCR GRATIS (Tesseract)
//                      + PARTIDO MULTI-FACTURA (varias facturas en un PDF)
// COSTE 0 € SIEMPRE en lectura recurrente. La lectura va por dos vías gratis:
//   1) Reglas/plantilla por NIF sobre el texto del PDF (PDF con capa de texto).
//   2) Si las reglas no leen (PDF escaneado, foto, formato raro) → OCR Tesseract
//      gratis: saca el texto de la imagen y se reintenta la lectura por reglas.
// Mistral es la ÚNICA excepción y SOLO como bootstrap de proveedor nuevo.
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
} from './extractores.js'
import type { ContenidoExtraido, PlantillaNif } from './extractores.js'
import type { ExtractedFactura } from './ocr.js'
import { extraerTextoOCRGratis } from './ocr-tesseract.js'
import { leerFacturaMistral, mistralDisponible, cuadraImportes } from './mistral-ocr.js'
import { aplicarMatching, matchFactura } from './matching.js'
import { generarNombreArchivo, subirArchivoADrive } from './google-drive.js'

export type ProcesarEstado =
  | 'duplicada'
  | 'error'
  | 'ok'
  | 'lectura_manual'

// Kill-switch opcional del OCR gratis (Tesseract). Por defecto ENCENDIDO.
// Para apagarlo (no recomendado): OCR_DESACTIVAR_TESSERACT=true en Vercel.
const OCR_TESSERACT_ACTIVO = process.env.OCR_DESACTIVAR_TESSERACT !== 'true'

// Kill-switch opcional del partido multi-factura. Por defecto ENCENDIDO.
// Para apagarlo: OCR_DESACTIVAR_MULTIFACTURA=true en Vercel.
const MULTIFACTURA_ACTIVO = process.env.OCR_DESACTIVAR_MULTIFACTURA !== 'true'

// Tope diario de lecturas Mistral (bootstrap de proveedores nuevos). Default 200/día.
const OCR_MISTRAL_LIMITE_DIARIO = Number(process.env.OCR_MISTRAL_LIMITE_DIARIO) || 200

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

// TITULAR EXACTO por NIF en el texto (Rubén 03/06/26). Las facturas de Streat Lab
// van a nombre de Rubén (21669051S) o de Emilio (53484832B): son los dos ÚNICOS
// clientes posibles. Si su NIF aparece en el texto del documento, el titular es
// exacto, no estimado. Devuelve además el NIF para guardarlo como nif_cliente.
function titularPorNifEnTexto(texto: string | null | undefined): {
  titularId: string; carpeta: string; nif: string
} | null {
  if (!texto) return null
  const t = texto.replace(/[\s\-.]/g, '').toUpperCase()
  if (t.includes(NIF_RUBEN)) return { titularId: RUBEN_ID, carpeta: 'RUBÉN', nif: NIF_RUBEN }
  if (t.includes(NIF_EMILIO)) return { titularId: EMILIO_ID, carpeta: 'EMILIO', nif: NIF_EMILIO }
  return null
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

  const resultados: ProcesarResultado[] = Array.isArray(principal) ? principal : [principal]
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

  // Auditar el/los resultado(s) principal(es). Cubre ok/duplicada/error/lectura_manual.
  // En multi-factura se audita cada sub-factura por separado.
  for (const r of resultados) {
    await registrarAuditoria(supabase, hashArchivo, sesionId, r)
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
      // El PDF se conserva como vision para poder rasterizarlo con Tesseract si
      // las reglas no resuelven. La lectura de texto/reglas se intenta primero.
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

// Resuelve titular (Rubén/Emilio). Orden: NIF de cliente leído → nombre de cliente
// → NIF de Rubén/Emilio encontrado en el texto del documento. Si NADA lo
// identifica, devuelve titular NULL + pendienteTitularManual (NUNCA se cuelga a
// Rubén por defecto). El matching admite titular NULL sin problema.
async function resolverTitular(
  supabase: SupabaseClient,
  extracted: ExtractedFactura,
  texto?: string | null,
): Promise<{ titularId: string | null; carpeta: string; pendienteTitularManual: boolean; nifClienteNorm: string | null }> {
  let nifClienteNorm = normalizarNif(extracted.nif_cliente)
  const nombreCliente = (extracted as { nombre_cliente?: string | null }).nombre_cliente
  let titularId: string | null = null
  let carpeta = 'SIN_TITULAR'

  if (nifClienteNorm === NIF_RUBEN) {
    titularId = RUBEN_ID; carpeta = 'RUBÉN'
  } else if (nifClienteNorm === NIF_EMILIO) {
    titularId = EMILIO_ID; carpeta = 'EMILIO'
  } else if (nifClienteNorm) {
    const { data: titular } = await supabase
      .from('titulares').select('id, carpeta_drive').eq('nif', nifClienteNorm).maybeSingle()
    if (titular) { titularId = titular.id as string; carpeta = (titular.carpeta_drive as string) || 'SIN_TITULAR' }
  }
  if (!titularId) {
    const porNombre = detectarTitularPorNombre(nombreCliente)
    if (porNombre.match) { titularId = porNombre.titularId; carpeta = porNombre.carpeta }
  }
  if (!titularId) {
    const porTexto = titularPorNifEnTexto(texto)
    if (porTexto) {
      titularId = porTexto.titularId
      carpeta = porTexto.carpeta
      if (!nifClienteNorm) nifClienteNorm = porTexto.nif
    }
  }

  if (!titularId) {
    // No identificado: titular NULL + pendiente de asignación manual. Sin default.
    return { titularId: null, carpeta: 'SIN_TITULAR', pendienteTitularManual: true, nifClienteNorm }
  }
  return { titularId, carpeta, pendienteTitularManual: false, nifClienteNorm }
}

// ¿Queda margen dentro del tope diario de lecturas Mistral? Cuenta las filas de
// ocr_auditoria con origen_lectura='mistral' creadas hoy. Si falla la cuenta,
// devuelve false (conservador: no gasta).
async function dentroDelTopeMistral(supabase: SupabaseClient): Promise<boolean> {
  try {
    const hoy = new Date().toISOString().slice(0, 10)
    const { count } = await supabase
      .from('ocr_auditoria')
      .select('id', { count: 'exact', head: true })
      .eq('origen_lectura', 'mistral')
      .gte('created_at', `${hoy}T00:00:00`)
    return (count ?? 0) < OCR_MISTRAL_LIMITE_DIARIO
  } catch {
    return false
  }
}

// CANDADO BOOTSTRAP (Rubén 02/06/26): ¿el NIF emisor ya tiene ficha en
// reglas_conciliacion? Si la tiene, el proveedor YA fue dado de alta (bootstrap
// hecho) → Mistral NO se vuelve a ejecutar para él NUNCA. Sus facturas se leen
// por reglas/plantilla; si la plantilla no lee, van a lectura manual, jamás otra
// vez a Mistral. Si falla la consulta, devuelve true (conservador: NO gasta).
async function nifYaRegistrado(supabase: SupabaseClient, nif: string | null): Promise<boolean> {
  if (!nif) return false
  try {
    const { data } = await supabase
      .from('reglas_conciliacion')
      .select('id')
      .eq('patron_nif', nif)
      .maybeSingle()
    return !!data
  } catch {
    return true
  }
}

// Aprende el proveedor por NIF: si Mistral leyó un NIF emisor + razón social que
// aún no está en reglas_conciliacion, lo inserta. Así la próxima factura del mismo
// proveedor se resuelve gratis por diccionario y Mistral no vuelve a usarse.
// Best-effort: nunca lanza.
async function aprenderProveedorNif(supabase: SupabaseClient, extracted: ExtractedFactura): Promise<void> {
  try {
    const nif = normalizarNif(extracted.nif_emisor)
    if (!nif || !extracted.proveedor_nombre) return
    const { data: ya } = await supabase
      .from('reglas_conciliacion')
      .select('id')
      .eq('patron_nif', nif)
      .maybeSingle()
    if (ya) return
    await supabase
      .from('reglas_conciliacion')
      .insert({ patron_nif: nif, razon_social: extracted.proveedor_nombre })
  } catch (e) {
    console.error('[aprenderProveedorNif]', errMsg(e))
  }
}

async function procesarContenidoPrincipal(
  supabase: SupabaseClient,
  file: ArchivoEntrada,
  contenido: ContenidoExtraido,
  tipo: TipoArchivo,
): Promise<ProcesarResultado | ProcesarResultado[]> {
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

  // ── PARTIDO MULTI-FACTURA (solo PDF) ─────────────────────────────────────
  // Antes de la lectura normal de 1 factura, se comprueba si el PDF contiene
  // VARIAS facturas. Si es así, se procesan todas. Conservador: si detecta 0 o 1,
  // sigue el flujo normal de abajo sin cambios.
  if (tipo === 'pdf' && MULTIFACTURA_ACTIVO) {
    try {
      // Idempotencia: si este PDF ya se procesó como multi (hay filas con
      // pdf_hash = hash#...), no se reprocesa.
      const { data: yaMulti } = await supabase
        .from('facturas')
        .select('id')
        .like('pdf_hash', `${hash}#%`)
        .limit(1)
        .maybeSingle()
      if (yaMulti) {
        return { estado: 'duplicada', archivo: file.nombre, motivo: 'ya existe (PDF con varias facturas ya procesado)' }
      }

      const textoCombinado = await extraerTextoPDF(file.buffer)
      if (pdfTieneTexto(textoCombinado)) {
        const paginas = await extraerTextoPDFPorPaginas(file.buffer)
        const diccMulti = await cargarDiccionarioNif(supabase)
        const facturas = partirEnFacturas(textoCombinado, paginas, (nif) => diccMulti.get(nif)?.plantilla || null)
        if (facturas.length >= 2) {
          return await guardarFacturasMulti(supabase, file, hash, facturas, diccMulti, textoCombinado)
        }
      }
    } catch (e) {
      // Si el partido falla por cualquier motivo, se cae al flujo normal de 1 factura.
      console.error('[procesarArchivo] multi-factura no aplicado:', errMsg(e))
    }
  }

  // PASO 1 (gratis): extraer por reglas desde el texto del PDF, usando la
  // plantilla del NIF si existe en el diccionario. Solo PDF con capa de texto.
  let extracted: ExtractedFactura
  let extractedReglas: ExtractedFactura | null = null
  let origenLectura: 'reglas' | 'ocr_tesseract' | 'mistral' = 'reglas'
  let diccionario: Map<string, { nombre: string | null; plantilla: PlantillaNif }> | null = null
  let textoPdfCache = ''

  if (tipo === 'pdf') {
    try {
      const textoPdf = await extraerTextoPDF(file.buffer)
      textoPdfCache = textoPdf
      if (pdfTieneTexto(textoPdf)) {
        diccionario = await cargarDiccionarioNif(supabase)
        extractedReglas = extraerPorReglas(textoPdf, (nif) => diccionario?.get(nif)?.plantilla || null)
      }
    } catch {
      extractedReglas = null
    }
  }

  // PASO 2 (gratis): si las reglas no leyeron y es PDF escaneado o imagen/foto,
  // se pasa por OCR Tesseract (0 €) para sacar el texto y reintentar las reglas.
  if (!extractedReglas && OCR_TESSERACT_ACTIVO && (tipo === 'pdf' || tipo === 'imagen')) {
    try {
      const textoOCR = await extraerTextoOCRGratis(file.buffer, tipo)
      if (textoOCR && textoOCR.replace(/\s/g, '').length >= 30) {
        // Acumular el texto OCR para el fallback de NIF en lectura manual
        textoPdfCache = textoPdfCache && textoPdfCache.length > textoOCR.length ? textoPdfCache : textoOCR
        if (!diccionario) diccionario = await cargarDiccionarioNif(supabase)
        const extractedOCR = extraerPorReglas(textoOCR, (nif) => diccionario?.get(nif)?.plantilla || null)
        if (extractedOCR) {
          extractedReglas = extractedOCR
          origenLectura = 'ocr_tesseract'
        }
      }
    } catch (ocrErr) {
      console.error('[procesarArchivo] OCR Tesseract no resolvió:', errMsg(ocrErr))
    }
  }

  if (extractedReglas) {
    extracted = extractedReglas
  } else {
    // PASO 3 — BOOTSTRAP MISTRAL (~0,002 €), SOLO PROVEEDOR NUEVO.
    let extractedMistral: ExtractedFactura | null = null
    const nifEmisorTexto = normalizarNif(textoPdfCache ? extraerNifEmisorLibre(textoPdfCache) : null)
    const proveedorYaConocido = await nifYaRegistrado(supabase, nifEmisorTexto)
    if (mistralDisponible() && !proveedorYaConocido && (await dentroDelTopeMistral(supabase))) {
      try {
        const m = await leerFacturaMistral(contenido)
        if (m && m.total !== undefined && m.total !== null) {
          if (!cuadraImportes(m)) m.confianza = 50
          extractedMistral = m
          origenLectura = 'mistral'
          await aprenderProveedorNif(supabase, m)
        }
      } catch (mistralErr) {
        console.error('[procesarArchivo] Mistral no resolvió:', errMsg(mistralErr))
      }
    }
    if (extractedMistral) {
      extracted = extractedMistral
    } else {
      // Ni reglas, ni Tesseract, ni (cuando aplica) Mistral leyeron. Lectura manual.
      return await guardarLecturaManual(supabase, file, hash, textoPdfCache)
    }
  }

  // Resolver nombre por NIF desde el diccionario (reglas dejan el nombre vacío).
  if (!extracted.proveedor_nombre) {
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

    // v12: dedup único válido = hash de archivo (ya aplicado al inicio).

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

    let nifClienteNorm = normalizarNif(extracted.nif_cliente)
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

    // TITULAR EXACTO: buscar el NIF de Rubén/Emilio en el texto del documento.
    if (!titularId) {
      const porTexto = titularPorNifEnTexto(textoPdfCache)
      if (porTexto) {
        titularId = porTexto.titularId
        carpetaTitular = porTexto.carpeta
        if (!nifClienteNorm) nifClienteNorm = porTexto.nif
      }
    }

    // Sin default a Rubén: si NADA identifica al titular, queda NULL +
    // pendiente_titular_manual. El matching admite titular NULL.
    if (!titularId) {
      titularId = null
      carpetaTitular = 'SIN_TITULAR'
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

    // F01: ejecutar matching siempre (admite titular NULL: no filtra por titular)
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

// ── Guardado de PDF con VARIAS facturas dentro ─────────────────────────────
async function guardarFacturasMulti(
  supabase: SupabaseClient,
  file: ArchivoEntrada,
  hashArchivo: string,
  facturas: ExtractedFactura[],
  diccionario: Map<string, { nombre: string | null; plantilla: PlantillaNif }>,
  textoCombinado?: string,
): Promise<ProcesarResultado[]> {
  // Resolver nombre de proveedor por NIF para las que vengan sin nombre.
  for (const f of facturas) {
    if (!f.proveedor_nombre) {
      const nifLook = normalizarNif(f.nif_emisor)
      const nombreCanon = nifLook ? (diccionario.get(nifLook)?.nombre || null) : null
      f.proveedor_nombre = nombreCanon || nifLook || 'PROVEEDOR'
    }
  }

  // Subir el PDF una sola vez. Carpeta = titular de la primera factura detectable.
  const ext = extensionDeNombre(file.nombre)
  const primera = facturas[0]
  const titPrimeraInfo = await resolverTitular(supabase, primera, textoCombinado)
  const fechaPrimera = fechaValida(primera.fecha_factura) ? primera.fecha_factura : new Date().toISOString().slice(0, 10)
  const nombreArchivoDrive = generarNombreArchivo({
    proveedor_nombre: primera.proveedor_nombre,
    numero_factura: `MULTI-${facturas.length}f`,
    fecha_factura: fechaPrimera,
    tipo: primera.tipo,
    plataforma: primera.plataforma,
  }, ext)
  let driveId: string | null = null
  let driveUrl: string | null = null
  let driveErrorMsg: string | null = null
  try {
    const drive = await subirArchivoADrive(file.buffer, nombreArchivoDrive, {
      proveedor_nombre: primera.proveedor_nombre,
      numero_factura: `MULTI-${facturas.length}f`,
      fecha_factura: fechaPrimera,
      tipo: primera.tipo,
      plataforma: primera.plataforma,
      carpeta_titular: titPrimeraInfo.carpeta,
    }, ext)
    driveId = drive.id
    driveUrl = drive.webViewLink
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

    // Idempotencia fina por sub-factura.
    const { data: yaExisteSub } = await supabase
      .from('facturas').select('id, estado').eq('pdf_hash', hashSub).maybeSingle()
    if (yaExisteSub) {
      resultados.push({ estado: 'duplicada', archivo: file.nombre, factura_existente: yaExisteSub as Record<string, unknown>, motivo: `sub-factura ${i + 1} ya existe` })
      continue
    }

    const fechaFactura = fechaValida(extracted.fecha_factura) ? extracted.fecha_factura : new Date().toISOString().slice(0, 10)
    const numFactura = extracted.numero_factura || `SN-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`
    const nifEmisorNorm = normalizarNif(extracted.nif_emisor)

    const { data: nueva, error: errInsert } = await supabase
      .from('facturas')
      .insert({
        pdf_original_name: file.nombre,
        pdf_hash: hashSub,
        proveedor_nombre: extracted.proveedor_nombre,
        numero_factura: numFactura,
        fecha_factura: fechaFactura,
        total: extracted.total,
        estado: 'procesando',
      })
      .select()
      .single()

    if (errInsert || !nueva) {
      if (errInsert && /pdf_hash/.test(errInsert.message || '')) {
        resultados.push({ estado: 'duplicada', archivo: file.nombre, motivo: `sub-factura ${i + 1} duplicada (hash)` })
        continue
      }
      resultados.push({ estado: 'error', archivo: file.nombre, error: errInsert?.message || `No se pudo crear sub-factura ${i + 1}` })
      continue
    }

    try {
      // Proveedor
      let proveedorId: string | undefined
      {
        const { data: provPorNombre } = await supabase
          .from('proveedores').select('id').ilike('nombre', `%${extracted.proveedor_nombre.trim()}%`).maybeSingle()
        if (provPorNombre?.id) proveedorId = provPorNombre.id
      }
      if (!proveedorId && extracted.proveedor_nombre) {
        const { data: nuevoProv } = await supabase
          .from('proveedores').insert({ nombre: extracted.proveedor_nombre, activo: true }).select('id').single()
        proveedorId = nuevoProv?.id
      }

      // Titular (admite NULL; sin default a Rubén)
      const tit = await resolverTitular(supabase, extracted, textoCombinado)

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
          titular_id: tit.titularId,
          nif_cliente: tit.nifClienteNorm,
          nif_emisor: nifEmisorNorm,
          categoria_factura: null,
          base_4: extracted.base_4, iva_4: extracted.iva_4,
          base_10: extracted.base_10, iva_10: extracted.iva_10,
          base_21: extracted.base_21, iva_21: extracted.iva_21,
          total: extracted.total,
          ocr_confianza: extracted.confianza,
          ocr_raw: { ...extracted, origen_lectura: 'reglas', multifactura: true, sub_indice: i, sub_total: facturas.length },
          pdf_drive_id: driveId,
          pdf_drive_url: driveUrl,
          pdf_filename: nombreArchivoDrive,
          ...(tit.pendienteTitularManual ? { estado: 'pendiente_titular_manual' } : {}),
        })
        .eq('id', nueva.id)

      // Matching
      try {
        const resultadoMatch = await matchFactura(supabase, { ...extracted, id: nueva.id, total: extracted.total, titular_id: tit.titularId })
        await aplicarMatching(supabase, nueva.id, resultadoMatch, { proveedor_nombre: extracted.proveedor_nombre, nif_emisor: nifEmisorNorm })
        if (tit.pendienteTitularManual) {
          await supabase.from('facturas').update({ estado: 'pendiente_titular_manual' }).eq('id', nueva.id)
        }
      } catch (matchErr) {
        console.error('[guardarFacturasMulti] matching:', errMsg(matchErr))
      }

      if (driveErrorMsg && !tit.pendienteTitularManual) {
        await supabase.from('facturas').update({ estado: 'drive_pendiente', error_mensaje: `Drive: ${driveErrorMsg}` }).eq('id', nueva.id)
      }

      const { data: finalFac } = await supabase.from('facturas').select('*').eq('id', nueva.id).single()
      resultados.push({
        estado: 'ok',
        archivo: file.nombre,
        factura_id: nueva.id,
        factura: finalFac as Record<string, unknown>,
        motivo: `factura ${i + 1} de ${facturas.length} del PDF`,
      })
    } catch (e) {
      const msg = errMsg(e)
      await supabase.from('facturas').update({ estado: 'error', error_mensaje: msg }).eq('id', nueva.id)
      resultados.push({ estado: 'error', archivo: file.nombre, factura_id: nueva.id, error: msg })
    }
  }

  return resultados
}

// Factura que ni reglas ni Tesseract pudieron leer (y, si era proveedor nuevo,
// tampoco Mistral). Se guarda el PDF en Drive para no perderlo y se inserta con
// estado 'pendiente_lectura_manual'. NUNCA llama a API. El titular se intenta por
// el NIF de Rubén/Emilio en el texto; si no aparece, titular NULL (sin default).
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

  // Intentar sacar NIF emisor del texto (PDF o el que sacó Tesseract). Sin API.
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

  // Titular exacto por NIF de Rubén/Emilio en el texto (si aparece).
  const titTexto = titularPorNifEnTexto(textoPdf)
  const carpetaTitular = titTexto?.carpeta ?? 'SIN_TITULAR'

  // Respaldo en Drive (best-effort)
  const drive = await guardarEnDriveBestEffort(file, {
    proveedor_nombre: proveedorNombre,
    numero_factura: numFactura,
    fecha_factura: hoy,
    tipo: 'proveedor',
    plataforma: null,
    carpeta_titular: carpetaTitular,
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
      titular_id: titTexto?.titularId ?? null,
      nif_cliente: titTexto?.nif ?? null,
      nif_emisor: nifEmisor,
      pdf_drive_id: drive?.id ?? null,
      pdf_drive_url: drive?.webViewLink ?? null,
      pdf_filename: drive?.nombre ?? null,
      error_mensaje: drive
        ? 'No se pudo leer ni con plantilla ni con OCR. Añade la plantilla del NIF y reprocesa (0 €, sin API).'
        : 'No se pudo leer y Drive no disponible. Reintenta (0 €, sin API).',
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
      ? `lectura manual: sin plantilla NIF ${nifEmisor} (0 €, sin API)`
      : 'lectura manual: ni reglas ni OCR leyeron (0 €, sin API)',
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
