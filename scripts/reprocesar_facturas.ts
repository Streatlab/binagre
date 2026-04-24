/**
 * scripts/reprocesar_facturas.ts
 *
 * Reprocesa facturas existentes con la lógica nueva:
 *   - Re-OCR (si hay PDF accesible y se fuerza --ocr)
 *   - Re-asignación de titular por NIF cliente
 *   - Re-match + cálculo cruza_cuentas
 *
 * Uso:
 *   npx tsx scripts/reprocesar_facturas.ts           # solo re-match + re-titular
 *   npx tsx scripts/reprocesar_facturas.ts <id>      # una sola factura
 *   npx tsx scripts/reprocesar_facturas.ts --ocr     # además re-ejecuta OCR (lento, requiere PDF local)
 *
 * Requisitos entorno: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { matchFactura, aplicarMatching } from '../api/_lib/matching.js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://eryauogxcpbgdryeimdq.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_KEY) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function reAsignarTitular(factura: Record<string, unknown>): Promise<string | null> {
  const ocrRaw = (factura.ocr_raw as Record<string, unknown> | null) || null
  const nif = (ocrRaw?.nif_cliente as string | null) || null
  if (!nif) return (factura.titular_id as string | null) ?? null
  const { data: t } = await supabase
    .from('titulares')
    .select('id')
    .eq('nif', nif)
    .maybeSingle()
  return (t?.id as string | null) ?? (factura.titular_id as string | null) ?? null
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const idArg = args[0]

  let qb = supabase
    .from('facturas')
    .select('*')
    .in('estado', ['pendiente_revision', 'asociada', 'error', 'historica'])

  if (idArg) qb = supabase.from('facturas').select('*').eq('id', idArg)

  const { data: facturas, error } = await qb
  if (error) {
    console.error(error.message)
    process.exit(1)
  }

  console.log(`Reprocesando ${facturas?.length || 0} facturas...`)

  for (const f of facturas || []) {
    const nuevoTit = await reAsignarTitular(f)
    if (nuevoTit !== f.titular_id) {
      await supabase.from('facturas').update({ titular_id: nuevoTit }).eq('id', f.id)
      console.log(`  [${f.proveedor_nombre}] titular_id → ${nuevoTit}`)
    }

    const resultado = await matchFactura(supabase, {
      ...f,
      total: Number(f.total),
      titular_id: nuevoTit,
    })
    await aplicarMatching(supabase, f.id as string, resultado)

    console.log(
      `  [${f.proveedor_nombre}] ${f.numero_factura}: ${resultado.estado} · ${resultado.matches.length} matches · conf ${resultado.confianza}${resultado.cruza_cuentas ? ' · ⇄ CROSS' : ''}`,
    )
  }

  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
