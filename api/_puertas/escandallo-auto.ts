// escandallo-auto — ESCANDALLO 2.0 (Fases A y C)
// A) Extracción de líneas de UNA factura de materia prima desde el PDF en Drive.
// C) Lectura por foto del conteo de inventario quincenal → inventario_lineas.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'
import { supabaseAdmin } from '../_lib/supabase-admin.js'
import { getOAuthClient } from '../_lib/google-oauth.js'
import { sumaConIva, type LineaExtraidaFactura } from '../_lib/extraerLineasFactura.js'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const MODEL_LINEAS = 'claude-sonnet-4-5'
const MODEL_CONTEO = 'claude-sonnet-4-5'
const TOLERANCIA_EUR = 0.05
const TIMEOUT_VISION_MS = 120000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action || (req.body as any)?.action || '')
  try {
    if (req.method === 'GET' && action === 'estado') return await estado(res)
    if (req.method === 'POST' && action === 'extraer-lineas') return await extraerUnaFactura(req, res)
    if (req.method === 'POST' && action === 'leer-conteo') return await leerConteo(req, res)
    if (req.method === 'POST' && action === 'confirmar-conteo') return await confirmarConteo(req, res)
    if (req.method === 'POST' && action === 'fusionar-borrador') return await fusionarBorrador(req, res)
    if (action === 'sugerir-fusiones') return await sugerirFusiones(req, res)
    if (action === 'completar-borradores') return await completarBorradores(req, res)
    if (action === 'procesar-lote') return await procesarLote(req, res)
    return res.status(200).json({ error: `Acción desconocida: ${action || '(vacía)'}` })
  } catch (err: any) {
    console.error('[escandallo-auto]', err?.message || err)
    return res.status(200).json({ error: err?.message || 'Error interno', ok: false })
  }
}

/* ───────────────────────── estado (contadores bandeja) ───────────────────────── */
async function estado(res: VercelResponse) {
  const prefijos = await prefijosMateriaPrima()
  const orCat = prefijos.map(p => `categoria_factura.like.${p}%`).join(',')

  const [pend, borr, alertas, estr, drive] = await Promise.all([
    supabaseAdmin.from('facturas').select('id', { count: 'exact', head: true }).or(orCat).not('pdf_drive_id', 'is', null).is('lineas_estado', null),
    supabaseAdmin.from('ingredientes').select('id', { count: 'exact', head: true }).eq('borrador', true),
    supabaseAdmin.from('alertas_precio').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
    supabaseAdmin.from('v_estructura_real_pct').select('*').maybeSingle(),
    supabaseAdmin.from('google_oauth_tokens').select('id', { count: 'exact', head: true }).is('titular_id', null),
  ])
  return res.status(200).json({
    facturas_sin_lineas: pend.count ?? 0,
    ingredientes_borrador: borr.count ?? 0,
    alertas_pendientes: alertas.count ?? 0,
    estructura_real: estr.data ?? null,
    drive_conectado: (drive.count ?? 0) > 0,
    env: {
      client_id: !!process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: !!process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
    },
  })
}

/* ───────── Fase A · extraer UNA factura (síncrono, responde JSON) ───────── */
async function extraerUnaFactura(req: VercelRequest, res: VercelResponse) {
  const body = (req.body || {}) as { factura_id?: string }
  const drive = await abrirDrive()
  if (!drive.ok) return res.status(200).json({ ok: false, error: drive.error })

  const r = await procesarUnaFactura(drive.client!, body.factura_id)
  return res.status(200).json(r)
}

type ResultadoFactura = { ok: boolean; vacio?: boolean; error?: string; factura_id?: string; proveedor?: string; estado?: string; lineas?: number }

/** Procesa UNA factura de materia prima (la indicada, o si no la más antigua pendiente). Sin tocar `res`: la usan tanto extraer-lineas (1 factura) como procesar-lote (n seguidas). */
async function procesarUnaFactura(driveClient: ReturnType<typeof google.drive>, facturaId?: string): Promise<ResultadoFactura> {
  const prefijos = await prefijosMateriaPrima()

  let q = supabaseAdmin.from('facturas')
    .select('id, proveedor_nombre, total, pdf_drive_id, categoria_factura, fecha_factura')
    .not('pdf_drive_id', 'is', null)
  if (facturaId) {
    q = q.eq('id', facturaId)
  } else {
    q = q.or(prefijos.map(p => `categoria_factura.like.${p}%`).join(','))
      .is('lineas_estado', null)
      .order('fecha_factura', { ascending: false })
      .limit(1)
  }
  const { data: facturas, error } = await q
  if (error) return { ok: false, error: error.message }
  if (!facturas?.length) return { ok: true, vacio: true }

  const f = facturas[0]
  let estadoF = 'error'
  let nLineas = 0
  try {
    const pdf = await driveClient.files.get({ fileId: f.pdf_drive_id as string, alt: 'media' }, { responseType: 'arraybuffer' })
    const b64 = Buffer.from(pdf.data as ArrayBuffer).toString('base64')
    const lineas = await lineasDesdePdf(b64, Number(f.total || 0), f.proveedor_nombre || 'desconocido')

    if (lineas === null) {
      estadoF = 'fallo_lectura'
    } else if (!lineas.length) {
      estadoF = 'sin_detalle_lineas'
    } else {
      const suma = sumaConIva(lineas)
      const diff = Math.round((suma - Number(f.total || 0)) * 100) / 100
      if (Math.abs(diff) > TOLERANCIA_EUR) {
        estadoF = 'sin_detalle_lineas'
        await supabaseAdmin.from('facturas').update({ detalle_lineas_diff: diff }).eq('id', f.id)
      } else {
        const rows = lineas.map(l => ({
          factura_id: f.id, descripcion: l.descripcion, cantidad: l.cantidad, unidad: l.unidad,
          precio_unitario: l.precio_unitario, total_linea: l.total_linea, iva_pct: l.iva_pct,
          proveedor_nombre: f.proveedor_nombre, fecha: f.fecha_factura, origen: 'ocr_reproceso',
          formato: l.formato ?? null, contenido_valor: l.contenido_valor ?? null, contenido_unidad: l.contenido_unidad ?? null,
        }))
        const ins = await supabaseAdmin.from('facturas_lineas').insert(rows)
        if (ins.error) throw new Error(ins.error.message)
        estadoF = 'extraidas'
        nLineas = rows.length
      }
    }
  } catch (err: any) {
    console.error('[procesarUnaFactura]', f.id, err?.message || err)
    estadoF = 'error'
  }
  await supabaseAdmin.from('facturas').update({ lineas_estado: estadoF }).eq('id', f.id)
  return { ok: true, factura_id: f.id, proveedor: f.proveedor_nombre, estado: estadoF, lineas: nLineas }
}

/* ───────── Fase E · procesar-lote (T5): n facturas seguidas en 1 invocación ───────── */
const LOTE_MAX_N = 10
const LOTE_PRESUPUESTO_MS = 260000 // deja margen bajo maxDuration=300s de la función

async function procesarLote(req: VercelRequest, res: VercelResponse) {
  if (!autorizadoCron(req)) return res.status(200).json({ ok: false, error: 'no autorizado' })
  const n = Math.max(1, Math.min(LOTE_MAX_N, num((req.query.n as string) ?? (req.body as any)?.n) ?? LOTE_MAX_N))

  const drive = await abrirDrive()
  if (!drive.ok) return res.status(200).json({ ok: false, error: drive.error })

  const inicio = Date.now()
  const resultados: ResultadoFactura[] = []
  for (let i = 0; i < n; i++) {
    if (Date.now() - inicio > LOTE_PRESUPUESTO_MS) break
    const r = await procesarUnaFactura(drive.client!)
    resultados.push(r)
    if (!r.ok || r.vacio) break
  }
  const procesadas = resultados.filter(r => r.ok && !r.vacio)
  const vacio = resultados.length > 0 && !!resultados[resultados.length - 1].vacio
  return res.status(200).json({ ok: true, procesadas: procesadas.length, vacio, resultados })
}

/** Cron interno (pg_cron/GitHub Actions) o llamada desde la propia app: exige clave compartida solo si llega por GET (cron), nunca para el POST de la pestaña Auto. */
function autorizadoCron(req: VercelRequest): boolean {
  if (req.method === 'POST') return true
  const secreto = process.env.ESCANDALLO_CRON_SECRET
  if (!secreto) return true // sin secreto configurado, no bloqueamos (entorno de desarrollo)
  const clave = String(req.query.llave || req.headers['x-escandallo-clave'] || '')
  return clave === secreto
}

async function abrirDrive(): Promise<{ ok: boolean; client?: ReturnType<typeof google.drive>; error?: string }> {
  try {
    const auth = await getOAuthClient()
    return { ok: true, client: google.drive({ version: 'v3', auth }) }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Drive no conectado' }
  }
}

async function lineasDesdePdf(pdfB64: string, total: number, proveedor: string): Promise<LineaExtraidaFactura[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  const prompt = `Extrae las líneas de artículos de esta factura española del proveedor "${proveedor}" (total con IVA: ${total.toFixed(2)}€).
Devuelve SOLO un array JSON: [{"descripcion":string,"cantidad":number,"unidad":string|null,"precio_unitario":number|null,"total_linea":number,"iva_pct":number|null,"formato":string|null,"contenido_valor":number|null,"contenido_unidad":string|null}]
Reglas: una entrada por artículo real; "total_linea" es la base SIN IVA de la línea; cantidad 1 si no se desglosa; NO inventes nada; si no hay desglose de artículos devuelve []. No incluyas totales, bases ni IVA como artículos. Sé conciso: usa números sin decimales innecesarios.
Además, SOLO si el texto de la línea lo indica literalmente: "formato" es el tipo de envase (Bolsa, Caja, Bandeja, Bote, Lata, Botella, Paquete, Malla, Unidad...); "contenido_valor" es el número de contenido del envase y "contenido_unidad" su unidad (kg, g, l, ml o ud) — ej. "CEBOLLA MALLA 2 KG" → formato "Malla", contenido_valor 2, contenido_unidad "kg". Si la línea no indica envase/contenido, los tres van a null. NUNCA los inventes ni los deduzcas del nombre del producto si no aparecen escritos.`
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_VISION_MS)
  try {
    const resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL_LINEAS, max_tokens: 8000,
        messages: [{ role: 'user', content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfB64 } },
          { type: 'text', text: prompt },
        ] }],
      }),
      signal: ctrl.signal,
    })
    if (!resp.ok) { console.error('[lineasDesdePdf] HTTP', resp.status); return null }
    const data = await resp.json() as { content?: Array<{ text?: string }>; stop_reason?: string }
    const raw = (data.content || []).map(c => c.text || '').join('').replace(/```json|```/g, '').trim()
    let arr: any
    try {
      arr = JSON.parse(raw)
    } catch {
      // Respuesta cortada por max_tokens (factura con muchas líneas, p.ej. Mercadona):
      // recuperar solo los objetos completos hasta el último "}" cerrado.
      // LEY-ANTIFALSOS: mejor menos líneas correctas que inventar o descartar la factura entera.
      const corte = raw.lastIndexOf('}')
      if (corte === -1) return null
      const reparado = raw.slice(0, corte + 1).replace(/,\s*$/, '') + ']'
      try { arr = JSON.parse(reparado) } catch { return null }
      console.warn('[lineasDesdePdf] JSON truncado (stop_reason=' + data.stop_reason + '); recuperados', Array.isArray(arr) ? arr.length : 0, 'objetos')
    }
    if (!Array.isArray(arr)) return null
    return arr
      .filter((o: any) => o && typeof o === 'object' && String(o.descripcion || '').trim())
      .map((o: any) => ({
        descripcion: String(o.descripcion).trim(),
        cantidad: num(o.cantidad) ?? 1,
        unidad: o.unidad ? String(o.unidad).trim() : null,
        precio_unitario: num(o.precio_unitario),
        total_linea: num(o.total_linea),
        iva_pct: num(o.iva_pct),
        formato: o.formato ? String(o.formato).trim() : null,
        contenido_valor: num(o.contenido_valor),
        contenido_unidad: o.contenido_unidad ? String(o.contenido_unidad).trim().toLowerCase() : null,
      }))
  } catch (err: any) {
    console.error('[lineasDesdePdf] fallo:', err?.message || err)
    return null
  } finally {
    clearTimeout(t)
  }
}

/* ───────────── Fase C · leer conteo de inventario desde foto ───────────── */
async function leerConteo(req: VercelRequest, res: VercelResponse) {
  const { inventario_id, imagen_base64, media_type } = (req.body || {}) as {
    inventario_id?: string; imagen_base64?: string; media_type?: string
  }
  if (!inventario_id || !imagen_base64) return res.status(200).json({ error: 'Faltan inventario_id o imagen_base64', insertadas: 0, lineas: [] })
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(200).json({ error: 'ANTHROPIC_API_KEY no configurada', insertadas: 0, lineas: [] })

  const prompt = `La imagen es una hoja de conteo de inventario de una cocina, rellenada a mano.
Devuelve SOLO un array JSON con lo que leas: [{"nombre":string,"cantidad":number,"unidad":string|null}]
Reglas: transcribe fielmente cada fila con cantidad anotada; NO inventes filas; si una cantidad es ilegible, omite la fila; unidades típicas: Kg., gr., L., ml., Ud.`
  let raw = ''
  try {
    const resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL_CONTEO, max_tokens: 3000,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: media_type || 'image/jpeg', data: imagen_base64 } },
          { type: 'text', text: prompt },
        ] }],
      }),
    })
    if (!resp.ok) return res.status(200).json({ error: `Visión HTTP ${resp.status}`, insertadas: 0, lineas: [] })
    const data = await resp.json() as { content?: Array<{ text?: string }> }
    raw = (data.content || []).map(c => c.text || '').join('').replace(/```json|```/g, '').trim()
  } catch (err: any) {
    return res.status(200).json({ error: `Fallo de lectura: ${err?.message || err}`, insertadas: 0, lineas: [] })
  }

  let leidas: Array<{ nombre: string; cantidad: number; unidad: string | null }> = []
  try {
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) {
      leidas = arr
        .filter((o: any) => o && String(o.nombre || '').trim() && num(o.cantidad) != null)
        .map((o: any) => ({ nombre: String(o.nombre).trim(), cantidad: num(o.cantidad) as number, unidad: o.unidad ? String(o.unidad).trim() : null }))
    }
  } catch { /* raw ilegible → 0 filas */ }
  if (!leidas.length) return res.status(200).json({ insertadas: 0, lineas: [] })

  const { data: ings } = await supabaseAdmin
    .from('ingredientes').select('id, iding, nombre, nombre_base, ud_std').neq('activo', false)

  const rows = leidas.map(l => {
    const m = matchIngrediente(l.nombre, ings || [])
    return {
      inventario_id, iding: m?.iding ?? null, ingrediente_id: m?.id ?? null,
      cantidad: l.cantidad, unidad: l.unidad || m?.ud_std || null,
      confianza: m ? m.confianza : 0, confirmado: false, texto_leido: l.nombre,
    }
  })
  const ins = await supabaseAdmin.from('inventario_lineas').insert(rows).select('id, ingrediente_id, cantidad, unidad, confianza, texto_leido')
  if (ins.error) return res.status(200).json({ error: ins.error.message, insertadas: 0, lineas: [] })
  await supabaseAdmin.from('inventarios').update({ origen: 'foto_ia' }).eq('id', inventario_id)
  return res.status(200).json({ insertadas: rows.length, lineas: ins.data })
}

function matchIngrediente(texto: string, ings: Array<{ id: string; iding: string | null; nombre: string; nombre_base: string | null; ud_std: string | null }>) {
  const t = norm(texto)
  const exacto = ings.find(i => norm(i.nombre) === t || norm(i.nombre_base || '') === t)
  if (exacto) return { ...exacto, confianza: 1 }
  const parciales = ings.filter(i => norm(i.nombre_base || i.nombre).includes(t) || t.includes(norm(i.nombre_base || i.nombre)))
  if (parciales.length === 1) return { ...parciales[0], confianza: 0.7 }
  return null
}
function norm(s: string) { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim() }

/* ───────────── Fase C · confirmar inventario ───────────── */
async function confirmarConteo(req: VercelRequest, res: VercelResponse) {
  const { inventario_id } = (req.body || {}) as { inventario_id?: string }
  if (!inventario_id) return res.status(200).json({ error: 'Falta inventario_id' })

  const { count: sinVincular } = await supabaseAdmin.from('inventario_lineas')
    .select('id', { count: 'exact', head: true }).eq('inventario_id', inventario_id).is('ingrediente_id', null)

  await supabaseAdmin.from('inventario_lineas').update({ confirmado: true })
    .eq('inventario_id', inventario_id).not('ingrediente_id', 'is', null)

  const upd = await supabaseAdmin.from('inventarios')
    .update({ estado: 'confirmado', confirmado_at: new Date().toISOString() }).eq('id', inventario_id)
  if (upd.error) return res.status(200).json({ error: upd.error.message })
  return res.status(200).json({ ok: true, lineas_sin_vincular_ignoradas: sinVincular ?? 0 })
}

/* ───────── Fase T3 · fusionar-borrador: "es el mismo que…" (1 clic, Rubén confirma) ───────── */
async function fusionarBorrador(req: VercelRequest, res: VercelResponse) {
  const { borrador_id, ingrediente_id } = (req.body || {}) as { borrador_id?: string; ingrediente_id?: string }
  if (!borrador_id || !ingrediente_id) return res.status(200).json({ ok: false, error: 'Faltan borrador_id o ingrediente_id' })
  const { data, error } = await supabaseAdmin.rpc('fn_fusionar_borrador', { p_borrador_id: borrador_id, p_ingrediente_id: ingrediente_id })
  if (error) return res.status(200).json({ ok: false, error: error.message })
  return res.status(200).json(data)
}

/* ───────── Fase T3 · sugerir-fusiones: SOLO propone, nunca fusiona ───────── */
async function sugerirFusiones(req: VercelRequest, res: VercelResponse) {
  const umbral = num(req.query.umbral as string) ?? 0.4
  const { data, error } = await supabaseAdmin.rpc('fn_sugerir_fusiones', { p_umbral: umbral })
  if (error) return res.status(200).json({ ok: false, error: error.message })
  return res.status(200).json({ ok: true, sugerencias: data ?? [] })
}

/* ───────── Fase T4 · completar-borradores: robot rellena formato/contenido/precio de
   borradores Mercadona vía la API pública JSON (Alcampo necesita Playwright, no cabe en
   una función serverless de Vercel — lo cubre la extensión del robot GitHub Actions,
   ver scripts/robot-precios-super/robot.ts función completarBorradoresAlcampo). ───────── */
async function completarBorradores(req: VercelRequest, res: VercelResponse) {
  if (!autorizadoCron(req)) return res.status(200).json({ ok: false, error: 'no autorizado' })

  const { data: borradores, error } = await supabaseAdmin
    .from('ingredientes')
    .select('id, nombre, nombre_super, proveedor_principal, marca')
    .eq('borrador', true)
    .is('formato', null)
    .in('proveedor_principal', ['Mercadona', 'Alcampo'])
    .limit(30)
  if (error) return res.status(200).json({ ok: false, error: error.message })
  const objetivos = (borradores ?? []).filter(b => b.proveedor_principal === 'Mercadona')
  if (!objetivos.length) return res.status(200).json({ ok: true, procesados: 0, rellenados: 0, detalle: [] })

  let cookie = ''
  try {
    cookie = await fijarCpMercadona()
  } catch (err: any) {
    return res.status(200).json({ ok: false, error: `No se pudo fijar CP Mercadona: ${err?.message || err}` })
  }
  const catalogo = await crawlCatalogoMercadona(cookie)

  const detalle: Array<{ ingrediente_id: string; nombre: string; resultado: string }> = []
  let rellenados = 0
  for (const b of objetivos) {
    const consulta = b.nombre_super || b.nombre
    const match = mejorProductoMercadona(consulta, catalogo)
    if (!match) { detalle.push({ ingrediente_id: b.id, nombre: b.nombre, resultado: 'sin_match' }); continue }
    const parsed = parsearFormatoYContenido(match.nombre)
    if (!parsed || match.precio == null) { detalle.push({ ingrediente_id: b.id, nombre: b.nombre, resultado: 'sin_formato_legible' }); continue }

    const { std, min, uds } = normalizarContenido(parsed.valor, parsed.unidad)
    if (!std || !uds) { detalle.push({ ingrediente_id: b.id, nombre: b.nombre, resultado: 'unidad_no_reconocida' }); continue }
    const eurStd = match.precio / uds
    const eurMin = min === std ? eurStd : eurStd / (min === 'g.' || min === 'ml.' ? 1000 : 1)

    await supabaseAdmin.from('ingredientes').update({
      formato: parsed.formato, uds, ud_std: std, ud_min: min,
      precio_total: match.precio, eur_std: eurStd, eur_min: eurMin,
      precio1: match.precio, ultimo_precio: match.precio, precio_activo: match.precio,
    }).eq('id', b.id)

    await supabaseAdmin.from('tareas_erp')
      .update({ descripcion: `Completado por robot (Mercadona): ${parsed.formato} ${parsed.valor}${parsed.unidad}, ${match.precio}€. Revisa la merma antes de usarlo en recetas.`, updated_at: new Date().toISOString() })
      .eq('ingrediente_id', b.id).neq('columna', 'hecho')

    rellenados++
    detalle.push({ ingrediente_id: b.id, nombre: b.nombre, resultado: 'completado' })
  }
  return res.status(200).json({ ok: true, procesados: objetivos.length, rellenados, detalle })
}

/* ── Mercadona API pública (misma lógica que scripts/robot-precios-super/robot.ts, sin Playwright) ── */
const MERCADONA_API = 'https://tienda.mercadona.es/api'
const MERCADONA_CP = '28038'

async function fijarCpMercadona(): Promise<string> {
  const r = await fetch(`${MERCADONA_API}/postal-codes/actions/change-pc/`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ new_postal_code: MERCADONA_CP }),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status} fijando CP`)
  const setCookie = typeof (r.headers as any).getSetCookie === 'function' ? (r.headers as any).getSetCookie() : []
  return (setCookie as string[]).map(c => c.split(';')[0]).join('; ')
}

type ProductoMercadona = { id: string; nombre: string; precio: number | null }

async function fetchJsonMercadona(url: string, cookie: string): Promise<any> {
  const r = await fetch(url, { headers: cookie ? { Cookie: cookie } : {} })
  if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`)
  return r.json()
}

function extraerPrecioMercadona(p: any): number | null {
  const candidatos = [p?.price_instructions?.unit_price, p?.price_instructions?.bulk_price, p?.price_instructions?.reference_price]
  for (const c of candidatos) { if (c == null) continue; const n = typeof c === 'number' ? c : num(String(c)); if (n != null && n > 0) return n }
  return null
}

async function crawlCatalogoMercadona(cookie: string): Promise<ProductoMercadona[]> {
  const raiz = await fetchJsonMercadona(`${MERCADONA_API}/categories/`, cookie)
  const categoriasRaiz: any[] = raiz?.results ?? raiz?.categories ?? []
  const productos: ProductoMercadona[] = []
  for (const cat of categoriasRaiz) {
    for (const sub of (cat?.categories ?? [])) {
      if (sub?.id == null) continue
      try {
        const det = await fetchJsonMercadona(`${MERCADONA_API}/categories/${sub.id}/`, cookie)
        const listas: any[][] = []
        if (Array.isArray(det?.products)) listas.push(det.products)
        for (const s of det?.categories ?? []) if (Array.isArray(s?.products)) listas.push(s.products)
        for (const lista of listas) for (const p of lista) {
          const nombre = p?.display_name || p?.name || ''
          if (nombre) productos.push({ id: String(p.id), nombre, precio: extraerPrecioMercadona(p) })
        }
      } catch { /* subcategoría no legible, se ignora */ }
    }
  }
  return productos
}

function normalizarTexto(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Coincidencia por subcadena exacta del nombre normalizado, quedándonos con el resultado más corto (menos ambiguo). Igual de estricto que el robot semanal: si no hay UNA ganadora clara, no se adivina. */
function mejorProductoMercadona(consulta: string, catalogo: ProductoMercadona[]): ProductoMercadona | null {
  const c = normalizarTexto(consulta)
  const porSubcadena = catalogo.filter(p => normalizarTexto(p.nombre).includes(c))
  if (!porSubcadena.length) return null
  porSubcadena.sort((a, b) => a.nombre.length - b.nombre.length)
  const largoMinimo = porSubcadena[0].nombre.length
  const empatados = porSubcadena.filter(p => p.nombre.length === largoMinimo)
  return empatados.length === 1 ? empatados[0] : null
}

/** Extrae formato+contenido del nombre del producto TAL COMO lo da la web (ej. "Cebolla malla 2 kg"). Nunca inventa: si no hay patrón numérico+unidad reconocible, devuelve null. */
function parsearFormatoYContenido(nombreWeb: string): { formato: string; valor: number; unidad: string } | null {
  const m = nombreWeb.match(/([\d]+(?:[.,]\d+)?)\s*(kg|g|gr|l|ml|ud|uds|unidad(?:es)?)\b/i)
  if (!m) return null
  const valor = parseFloat(m[1].replace(',', '.'))
  if (!isFinite(valor) || valor <= 0) return null
  let unidad = m[2].toLowerCase()
  if (unidad === 'gr') unidad = 'g'
  if (unidad.startsWith('ud')) unidad = 'ud'
  if (unidad.startsWith('unidad')) unidad = 'ud'
  const formatoMatch = nombreWeb.match(/^(bolsa|caja|bandeja|bote|lata|botella|paquete|malla|tarrina|garrafa)/i)
  const formato = formatoMatch ? formatoMatch[1][0].toUpperCase() + formatoMatch[1].slice(1).toLowerCase() : 'Unidad'
  return { formato, valor, unidad }
}

/** Misma conversión a unidad estándar/mínima que fn_procesar_linea_factura en BD (T1). */
function normalizarContenido(valor: number, unidad: string): { std: string | null; min: string | null; uds: number | null } {
  switch (unidad) {
    case 'kg': return { std: 'Kg.', min: 'g.', uds: valor }
    case 'g': return { std: 'Kg.', min: 'g.', uds: valor / 1000 }
    case 'l': return { std: 'L.', min: 'ml.', uds: valor }
    case 'ml': return { std: 'L.', min: 'ml.', uds: valor / 1000 }
    case 'ud': return { std: 'Ud.', min: 'Ud.', uds: valor }
    default: return { std: null, min: null, uds: null }
  }
}

/* ───────────── helpers ───────────── */
async function prefijosMateriaPrima(): Promise<string[]> {
  const { data } = await supabaseAdmin.from('configuracion').select('valor').eq('clave', 'estructura_excluir_prefijos').maybeSingle()
  try {
    const arr = JSON.parse((data as any)?.valor || '[]')
    if (Array.isArray(arr) && arr.length) return arr.map(String)
  } catch { /* default abajo */ }
  return ['2.11', '2.12']
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number' && isFinite(v)) return v
  const s = String(v).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')
  const n = parseFloat(s)
  return isFinite(n) ? n : null
}
