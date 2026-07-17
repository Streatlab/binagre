// escandallo-auto — ESCANDALLO 2.0 (Fases A y C)
// A) Extracción de líneas de facturas de materia prima desde el PDF en Drive
//    (visión Anthropic, validación anti-falsos ±0,05€) → facturas_lineas →
//    el trigger de BBDD vincula/pre-crea ingredientes, actualiza precios,
//    recalcula escandallos y genera alertas de subida de precio.
// B) Lectura por foto del conteo de inventario quincenal → inventario_lineas.
//
// ROBUSTEZ: este handler SIEMPRE responde JSON, nunca deja caer un error a la
// página de error de Vercel (que rompería el fetch del navegador con
// "Unexpected token < in JSON"). Cada factura se procesa de una en una por
// defecto para no agotar el tiempo de la función.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'
import { supabaseAdmin } from '../_lib/supabase-admin.js'
import { getOAuthClient } from '../_lib/google-oauth.js'
import { sumaConIva, type LineaExtraidaFactura } from '../_lib/extraerLineasFactura.js'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const MODEL_LINEAS = 'claude-sonnet-4-5'
const MODEL_CONTEO = 'claude-sonnet-4-5'
const TOLERANCIA_EUR = 0.05
const MAX_LOTE = 5
const TIMEOUT_VISION_MS = 55000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action || (req.body as any)?.action || '')
  try {
    if (req.method === 'GET' && action === 'estado') return await estado(res)
    if (req.method === 'POST' && action === 'extraer-lineas') return await extraerLineas(req, res)
    if (req.method === 'POST' && action === 'leer-conteo') return await leerConteo(req, res)
    if (req.method === 'POST' && action === 'confirmar-conteo') return await confirmarConteo(req, res)
    return res.status(200).json({ error: `Acción desconocida: ${action || '(vacía)'}` })
  } catch (err: any) {
    // NUNCA propagar: siempre JSON legible por el frontend.
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
  })
}

/* ───────────────── Fase A · extraer líneas desde el PDF en Drive ───────────────── */
async function extraerLineas(req: VercelRequest, res: VercelResponse) {
  const body = (req.body || {}) as { factura_id?: string; limit?: number }
  const prefijos = await prefijosMateriaPrima()

  // Drive es obligatorio para bajar el PDF. Si no está, decirlo claro (JSON).
  const drive = await abrirDrive()
  if (!drive.ok) {
    return res.status(200).json({ procesadas: 0, resultados: [], error: drive.error })
  }

  let q = supabaseAdmin.from('facturas')
    .select('id, proveedor_nombre, total, pdf_drive_id, categoria_factura, fecha_factura')
    .not('pdf_drive_id', 'is', null)
  if (body.factura_id) {
    q = q.eq('id', body.factura_id)
  } else {
    q = q.or(prefijos.map(p => `categoria_factura.like.${p}%`).join(','))
      .is('lineas_estado', null)
      .order('fecha_factura', { ascending: false })
      .limit(Math.min(Math.max(1, body.limit ?? 1), MAX_LOTE))
  }
  const { data: facturas, error } = await q
  if (error) return res.status(200).json({ procesadas: 0, resultados: [], error: error.message })
  if (!facturas?.length) return res.status(200).json({ procesadas: 0, resultados: [] })

  const resultados: Array<{ factura_id: string; proveedor: string | null; estado: string; lineas: number }> = []
  for (const f of facturas) {
    let estadoF = 'error'
    let nLineas = 0
    try {
      const pdf = await drive.client!.files.get({ fileId: f.pdf_drive_id as string, alt: 'media' }, { responseType: 'arraybuffer' })
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
          }))
          const ins = await supabaseAdmin.from('facturas_lineas').insert(rows)
          if (ins.error) throw new Error(ins.error.message)
          estadoF = 'extraidas'
          nLineas = rows.length
        }
      }
    } catch (err: any) {
      console.error('[extraer-lineas]', f.id, err?.message || err)
      estadoF = 'error'
    }
    await supabaseAdmin.from('facturas').update({ lineas_estado: estadoF }).eq('id', f.id)
    resultados.push({ factura_id: f.id, proveedor: f.proveedor_nombre, estado: estadoF, lineas: nLineas })
  }
  return res.status(200).json({ procesadas: resultados.length, resultados })
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
Devuelve SOLO un array JSON: [{"descripcion":string,"cantidad":number,"unidad":string|null,"precio_unitario":number|null,"total_linea":number,"iva_pct":number|null}]
Reglas: una entrada por artículo real; "total_linea" es la base SIN IVA de la línea; cantidad 1 si no se desglosa; NO inventes nada; si no hay desglose de artículos devuelve []. No incluyas totales, bases ni IVA como artículos.`
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_VISION_MS)
  try {
    const resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL_LINEAS, max_tokens: 4000,
        messages: [{ role: 'user', content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfB64 } },
          { type: 'text', text: prompt },
        ] }],
      }),
      signal: ctrl.signal,
    })
    if (!resp.ok) { console.error('[lineasDesdePdf] HTTP', resp.status); return null }
    const data = await resp.json() as { content?: Array<{ text?: string }> }
    const raw = (data.content || []).map(c => c.text || '').join('').replace(/```json|```/g, '').trim()
    const arr = JSON.parse(raw)
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
