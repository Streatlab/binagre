/**
 * scripts/extraer_lineas_historico.ts
 *
 * Reproceso histórico por tandas del extractor de líneas: recorre las facturas
 * tipo='proveedor' con PDF en Drive y sin líneas_estado calculado todavía,
 * descarga cada PDF, extrae texto, pide a Anthropic el desglose de líneas y
 * guarda en `facturas_lineas` + estado en `facturas`.
 *
 * Uso:
 *   npx tsx scripts/extraer_lineas_historico.ts                # todo el pendiente, tandas de 25
 *   npx tsx scripts/extraer_lineas_historico.ts <id>            # una sola factura
 *   npx tsx scripts/extraer_lineas_historico.ts --limit=100     # solo las primeras 100 pendientes
 *   npx tsx scripts/extraer_lineas_historico.ts --tanda=10      # tamaño de tanda (paralelismo), def. 25
 *
 * Requisitos entorno: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY,
 * GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_DRIVE_ROOT_FOLDER_ID (los mismos que usa Vercel
 * en producción — copiar a .env.local para correrlo desde local).
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { descargarArchivoDeDrive } from '../api/_lib/google-drive.js'
import { extraerTextoPDF } from '../api/_lib/extractores.js'
import { extraerLineasAnthropicTexto } from '../api/_lib/extraerLineasFactura.js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://eryauogxcpbgdryeimdq.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_KEY) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Falta ANTHROPIC_API_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

interface FacturaRow {
  id: string
  tipo: string
  total: number
  pdf_drive_id: string | null
  proveedor_nombre: string | null
  fecha_factura: string | null
}

async function procesarUna(f: FacturaRow): Promise<string> {
  if (!f.pdf_drive_id) {
    await supabase.from('facturas').update({ lineas_estado: 'sin_detalle_lineas', estado_detalle_lineas: 'Sin PDF en Drive' }).eq('id', f.id)
    return 'sin_detalle_lineas (sin PDF)'
  }
  try {
    const buffer = await descargarArchivoDeDrive(f.pdf_drive_id)
    const texto = await extraerTextoPDF(buffer)
    const resultado = await extraerLineasAnthropicTexto(texto, Number(f.total) || 0)

    if (resultado.estado === 'con_lineas' && resultado.lineas.length > 0) {
      await supabase.from('facturas_lineas').delete().eq('factura_id', f.id).eq('origen', 'ocr_auto')
      const filas = resultado.lineas.map((l) => ({
        factura_id: f.id,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        unidad: l.unidad,
        precio_unitario: l.precio_unitario,
        total_linea: l.total_linea,
        iva_pct: l.iva_pct,
        origen: 'ocr_auto',
        proveedor_nombre: f.proveedor_nombre,
        fecha: f.fecha_factura,
      }))
      await supabase.from('facturas_lineas').insert(filas)
    }

    await supabase.from('facturas').update({
      lineas_estado: resultado.estado,
      estado_detalle_lineas: resultado.motivo,
      detalle_lineas_diff: resultado.diff,
    }).eq('id', f.id)

    return `${resultado.estado} (${resultado.motivo})`
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await supabase.from('facturas').update({ lineas_estado: 'error', estado_detalle_lineas: `Descarga/lectura: ${msg}` }).eq('id', f.id)
    return `error (${msg})`
  }
}

async function main() {
  const args = process.argv.slice(2)
  const idArg = args.find((a) => !a.startsWith('--'))
  const limitArg = args.find((a) => a.startsWith('--limit='))
  const tandaArg = args.find((a) => a.startsWith('--tanda='))
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined
  const tanda = tandaArg ? parseInt(tandaArg.split('=')[1], 10) : 25

  let qb = supabase
    .from('facturas')
    .select('id,tipo,total,pdf_drive_id,proveedor_nombre,fecha_factura')
    .eq('tipo', 'proveedor')
    .not('pdf_drive_id', 'is', null)
    .is('lineas_estado', null)
    .order('fecha_factura', { ascending: false })

  if (idArg) qb = supabase.from('facturas').select('id,tipo,total,pdf_drive_id,proveedor_nombre,fecha_factura').eq('id', idArg)
  else if (limit) qb = qb.limit(limit)

  const { data: facturas, error } = await qb
  if (error) { console.error(error.message); process.exit(1) }

  const lista = (facturas || []) as FacturaRow[]
  console.log(`Reprocesando ${lista.length} facturas (tandas de ${tanda})...`)

  const contadores: Record<string, number> = {}
  for (let i = 0; i < lista.length; i += tanda) {
    const bloque = lista.slice(i, i + tanda)
    const resultados = await Promise.all(bloque.map((f) => procesarUna(f)))
    resultados.forEach((r, j) => {
      const clave = r.split(' ')[0]
      contadores[clave] = (contadores[clave] || 0) + 1
      console.log(`  [${bloque[j].proveedor_nombre || bloque[j].id}] ${r}`)
    })
    console.log(`--- tanda ${Math.floor(i / tanda) + 1}/${Math.ceil(lista.length / tanda)} · acumulado: ${JSON.stringify(contadores)}`)
  }

  console.log('Done.', contadores)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
