/**
 * T-F2-09/T-F2-10 — Endpoint POST /api/importar/plataforma
 *
 * Body JSON: { base64: string, nombre: string, mimeType?: string }
 *
 * Pipeline:
 *   1. Extraer texto del archivo
 *   2. detectarPlataforma por NIF / cabeceras
 *   3. Parser específico (Uber / Glovo A|B / JustEat / Rushour)
 *   4. detectarMarca × 4 criterios
 *   5. upsertVentaPlataforma (acumulación H3)
 *   6. Si Glovo A: insertarPedidosPlataforma
 *   7. Loguear en imports_plataformas
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'
import { detectarPlataforma } from '../_lib/parsers/detectarPlataforma.js'
import { parseUberFactura } from '../_lib/parsers/uberParser.js'
import { esGlovoFormatoA, parseGlovoFormatoA } from '../_lib/parsers/glovoFormatoA.js'
import { parseGlovoFormatoB } from '../_lib/parsers/glovoFormatoB.js'
import { parseJustEatFactura } from '../_lib/parsers/justEatParser.js'
import { parseRushourFactura } from '../_lib/parsers/rushourParser.js'
import { upsertVentaPlataforma, insertarPedidosPlataforma } from '../_lib/upsertVentaPlataforma.js'
import { extraerTexto, extraerExcel, prepararVision } from '../_lib/extractores.js'
import { detectarTipoArchivo } from '../_lib/detectarTipo.js'
import type { MarcaMaestra } from '../_lib/parsers/detectarMarca.js'
import type { VentaPlataformaInput, PedidoPlataformaInput } from '../_lib/parsers/types.js'

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
  maxDuration: 60,
}

async function logImport(params: {
  plataforma: string; archivo: string; estado: 'ok' | 'error' | 'pendiente'
  totalBruto?: number; error?: string; marcaNombre?: string
}) {
  await supabaseAdmin.from('imports_plataformas').insert({
    plataforma: params.plataforma,
    archivo: params.archivo,
    estado: params.estado,
    total_bruto: params.totalBruto ?? 0,
    error: params.error ?? null,
    marca_nombre: params.marcaNombre ?? null,
    filas: 1,
    total_pedidos: 0,
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, mensaje: 'Method not allowed' })
  }

  try {
    const body = req.body as { base64?: string; nombre?: string; mimeType?: string }
    if (!body?.base64 || !body?.nombre) {
      return res.status(400).json({ ok: false, mensaje: 'Falta base64 o nombre' })
    }

    const buffer = Buffer.from(body.base64, 'base64')
    const filename = body.nombre

    // ── Extraer texto ─────────────────────────────────────────────────────
    const tipo = detectarTipoArchivo(filename, body.mimeType)
    let textoExtraido = ''
    try {
      if (tipo === 'pdf' || tipo === 'imagen') {
        const mime = tipo === 'pdf' ? 'application/pdf' : (body.mimeType ?? 'image/jpeg')
        const contenido = await prepararVision(buffer, mime)
        textoExtraido = (typeof contenido.data === 'string' ? contenido.data : '')
      } else if (tipo === 'excel') {
        const contenido = await extraerExcel(buffer)
        textoExtraido = (typeof contenido.data === 'string' ? contenido.data : '')
      } else {
        const contenido = extraerTexto(buffer.toString('utf-8'))
        textoExtraido = (typeof contenido.data === 'string' ? contenido.data : '')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return res.status(422).json({ ok: false, mensaje: `Error extrayendo texto: ${msg}` })
    }

    // ── Detectar plataforma ────────────────────────────────────────────────
    const plataforma = detectarPlataforma(textoExtraido)

    if (plataforma === 'desconocido') {
      await logImport({ plataforma: 'desconocido', archivo: filename, estado: 'error', error: 'Plataforma no reconocida' })
      return res.status(200).json({
        ok: false,
        plataforma: 'desconocido',
        mensaje: 'No se reconoció la plataforma. Verifica NIF B88515200 (Uber), B67282871 (Glovo), o cabeceras RushHour/Just Eat.',
      })
    }

    // ── Cargar maestro marcas ─────────────────────────────────────────────
    const { data: marcasRaw } = await supabaseAdmin
      .from('marcas')
      .select('nombre, nombre_local, alias')
    const marcasMaestras: MarcaMaestra[] = (marcasRaw ?? []).map(m => ({
      nombre: m.nombre as string,
      nombre_local: (m as Record<string, unknown>).nombre_local as string | null ?? null,
      alias: (m as Record<string, unknown>).alias as string[] | null ?? null,
    }))

    // ── Just Eat stub ─────────────────────────────────────────────────────
    if (plataforma === 'just_eat') {
      const r = parseJustEatFactura(textoExtraido) as { ok: false; pendiente: boolean; mensaje: string }
      await logImport({ plataforma, archivo: filename, estado: 'pendiente', error: r.mensaje })
      return res.status(200).json({ ok: false, pendiente: true, plataforma, mensaje: r.mensaje })
    }

    // ── Rushour → CTR-SW gasto ────────────────────────────────────────────
    if (plataforma === 'rushour') {
      const r = parseRushourFactura(textoExtraido) as {
        ok: true
        rushour: { total: number; numero_factura: string }
        advertencias: string[]
      }
      await logImport({ plataforma: 'rushour', archivo: filename, estado: 'ok', totalBruto: r.rushour?.total })
      return res.status(200).json({
        ok: true,
        plataforma: 'rushour',
        tipo: 'gasto_ctr_sw',
        numero_factura: r.rushour?.numero_factura,
        total: r.rushour?.total,
        mensaje: 'Rushour procesado como gasto CTR-SW. Vincular en Conciliación.',
        advertencias: r.advertencias ?? [],
      })
    }

    // ── Uber o Glovo ──────────────────────────────────────────────────────
    let parserOutput: { ok: boolean; ventas?: VentaPlataformaInput[]; pedidos?: PedidoPlataformaInput[]; advertencias?: string[]; mensaje?: string }

    if (plataforma === 'uber') {
      parserOutput = parseUberFactura(textoExtraido, marcasMaestras) as typeof parserOutput
    } else {
      // Glovo formato A vs B
      if (esGlovoFormatoA(textoExtraido)) {
        parserOutput = parseGlovoFormatoA(textoExtraido, marcasMaestras) as typeof parserOutput
      } else {
        parserOutput = parseGlovoFormatoB(textoExtraido, marcasMaestras) as typeof parserOutput
      }
    }

    if (!parserOutput.ok) {
      await logImport({ plataforma, archivo: filename, estado: 'error', error: parserOutput.mensaje })
      return res.status(200).json({ ok: false, plataforma, mensaje: parserOutput.mensaje })
    }

    const ventas = parserOutput.ventas ?? []
    const pedidos = parserOutput.pedidos ?? []
    const advertencias = parserOutput.advertencias ?? []

    let marcaFinal = 'SIN_MARCA'
    let totalBruto = 0

    for (const v of ventas) {
      const upsertRes = await upsertVentaPlataforma(supabaseAdmin, v)
      if (!upsertRes.ok) {
        advertencias.push(`UPSERT fallido: ${upsertRes.error}`)
      }
      if (v.marca !== 'SIN_MARCA') marcaFinal = v.marca
      totalBruto += v.bruto ?? 0
    }

    if (pedidos.length > 0) {
      const pedRes = await insertarPedidosPlataforma(supabaseAdmin, pedidos)
      if (!pedRes.ok) {
        advertencias.push(`Pedidos no insertados: ${pedRes.error}`)
      }
    }

    await logImport({ plataforma, archivo: filename, estado: 'ok', totalBruto, marcaNombre: marcaFinal })

    return res.status(200).json({
      ok: true,
      plataforma,
      marca: marcaFinal,
      totalBruto,
      pedidosInsertados: pedidos.length,
      advertencias,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ ok: false, mensaje: msg })
  }
}
