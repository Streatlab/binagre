// api/checklists.ts — Lectura por foto de checklists de cocina.
//
// POST { ejecucion_id, foto_base64, mime }
//   1. Carga la ejecución del día y sus items.
//   2. Sube la foto al bucket checklists-fotos.
//   3. Una llamada de VISIÓN a Anthropic lee el papel fotografiado y devuelve
//      qué items están marcados, el responsable y las incidencias anotadas.
//   4. Actualiza items + ejecución (origen='foto', foto_url, responsable).
//
// Control de coste: 1 llamada de visión por foto (imagen comprimida en cliente
// a máx 1568px). Sin reintentos automáticos.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from './_lib/supabase-admin.js'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_MODEL = 'claude-sonnet-4-5'
const TIMEOUT_MS = 60000

interface ItemDb {
  id: string
  item_nombre: string
  completado: boolean
}

interface LecturaItem {
  n: number
  marcado: boolean
}

interface LecturaFoto {
  responsable: string | null
  incidencias: string | null
  items: LecturaItem[]
}

function construirPrompt(items: ItemDb[]): string {
  const lista = items.map((it, i) => `${i + 1}. ${it.item_nombre}`).join('\n')
  return `Eres un lector de checklists de cocina en papel. Recibes la FOTO de un checklist impreso y rellenado a mano.

El checklist tiene estos items numerados:
${lista}

Analiza la foto y devuelve SOLO un objeto JSON válido, sin texto alrededor:
{
  "responsable": string|null,
  "incidencias": string|null,
  "items": [ { "n": number, "marcado": boolean }, ... ]
}

Reglas:
- "n" es el número del item en la lista de arriba (1 a ${items.length}). Incluye TODOS los items.
- "marcado" = true solo si la casilla de ese item tiene una marca clara (X, tick, relleno, tachado). Casilla vacía o dudosa = false. NO inventes.
- "responsable" = el nombre escrito a mano en el campo Responsable, o null si está vacío o ilegible.
- "incidencias" = texto escrito a mano en Observaciones/Incidencias, o null si está vacío.
- Si la foto no parece un checklist o es ilegible, devuelve {"responsable":null,"incidencias":"FOTO_ILEGIBLE","items":[]}.
Responde SOLO el JSON.`
}

async function leerFotoConVision(fotoBase64: string, mime: string, items: ItemDb[]): Promise<LecturaFoto | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mime || 'image/jpeg', data: fotoBase64 } },
            { type: 'text', text: construirPrompt(items) },
          ],
        }],
      }),
      signal: ctrl.signal,
    })
    if (!resp.ok) {
      console.error('[checklists] Anthropic HTTP', resp.status, (await resp.text()).slice(0, 200))
      return null
    }
    const data = await resp.json() as { content?: Array<{ text?: string }> }
    const raw = (data.content || []).map(c => c.text || '').join('').trim()
    try {
      const j = JSON.parse(raw.replace(/```json|```/g, '').trim()) as LecturaFoto
      if (!Array.isArray(j.items)) return null
      return j
    } catch { return null }
  } catch (err) {
    console.error('[checklists] fallo visión:', err instanceof Error ? err.message : String(err))
    return null
  } finally {
    clearTimeout(t)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = (req.body || {}) as Record<string, unknown>
  const ejecucionId = String(body.ejecucion_id || '')
  const fotoBase64 = String(body.foto_base64 || '')
  const mime = String(body.mime || 'image/jpeg')

  if (!ejecucionId || !fotoBase64) return res.status(400).json({ error: 'Faltan ejecucion_id o foto_base64' })
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Lectura por foto no configurada (falta clave API)' })

  // 1. Cargar ejecución + items
  const { data: ejec, error: errE } = await supabaseAdmin
    .from('checklist_ejecuciones').select('*').eq('id', ejecucionId).single()
  if (errE || !ejec) return res.status(404).json({ error: 'Ejecución no encontrada' })

  const { data: itemsData, error: errI } = await supabaseAdmin
    .from('checklist_items_ejecucion')
    .select('id, item_nombre, completado')
    .eq('ejecucion_id', ejecucionId)
    .order('orden')
    .order('created_at')
  if (errI || !itemsData || itemsData.length === 0) return res.status(404).json({ error: 'La ejecución no tiene items' })
  const items = itemsData as ItemDb[]

  // 2. Subir foto al bucket
  let fotoUrl: string | null = null
  try {
    const buffer = Buffer.from(fotoBase64, 'base64')
    const ext = mime.includes('png') ? 'png' : 'jpg'
    const path = `${ejec.fecha}/${ejec.tipo}-${Date.now()}.${ext}`
    const { error: errUp } = await supabaseAdmin.storage
      .from('checklists-fotos')
      .upload(path, buffer, { contentType: mime, upsert: true })
    if (!errUp) {
      const { data: pub } = supabaseAdmin.storage.from('checklists-fotos').getPublicUrl(path)
      fotoUrl = pub?.publicUrl ?? null
    }
  } catch (e) {
    console.error('[checklists] fallo subida foto:', e instanceof Error ? e.message : String(e))
  }

  // 3. Leer la foto con visión
  const lectura = await leerFotoConVision(fotoBase64, mime, items)
  if (!lectura) return res.status(502).json({ error: 'No se pudo leer la foto. Prueba con más luz y la hoja plana.' })
  if (lectura.incidencias === 'FOTO_ILEGIBLE' && lectura.items.length === 0) {
    return res.status(422).json({ error: 'La foto no parece un checklist legible. Repite la foto.' })
  }

  // 4. Aplicar resultados
  const ahora = new Date().toISOString()
  let marcados = 0
  for (const li of lectura.items) {
    const item = items[li.n - 1]
    if (!item) continue
    if (li.marcado) marcados++
    await supabaseAdmin
      .from('checklist_items_ejecucion')
      .update({ completado: li.marcado, completado_at: li.marcado ? ahora : null })
      .eq('id', item.id)
  }

  const completadoTodo = marcados === items.length
  const updateEjec: Record<string, unknown> = {
    items_completados: marcados,
    items_totales: items.length,
    completado: completadoTodo,
    origen: 'foto',
  }
  if (fotoUrl) updateEjec.foto_url = fotoUrl
  if (lectura.responsable) updateEjec.responsable = lectura.responsable
  if (lectura.incidencias && lectura.incidencias !== 'FOTO_ILEGIBLE') updateEjec.incidencias = lectura.incidencias

  const { error: errUpd } = await supabaseAdmin
    .from('checklist_ejecuciones').update(updateEjec).eq('id', ejecucionId)
  if (errUpd) return res.status(500).json({ error: errUpd.message })

  return res.status(200).json({
    ok: true,
    marcados,
    totales: items.length,
    completado: completadoTodo,
    responsable: lectura.responsable,
    incidencias: lectura.incidencias,
    foto_url: fotoUrl,
  })
}
