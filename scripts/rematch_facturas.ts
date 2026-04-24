import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { matchFactura, aplicarMatching } from '../api/_lib/matching.js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://eryauogxcpbgdryeimdq.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY no definida. Añádela a .env o exporta la variable.')
  process.exit(1)
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const soloId = process.argv[2]
  let query = supabase
    .from('facturas')
    .select('*')
    .in('estado', ['pendiente_revision', 'asociada'])

  if (soloId) query = supabase.from('facturas').select('*').eq('id', soloId)

  const { data: facturas, error } = await query
  if (error) {
    console.error('Error cargando facturas:', error.message)
    process.exit(1)
  }

  console.log(`Re-matching ${facturas?.length || 0} facturas...`)

  for (const f of facturas || []) {
    const resultado = await matchFactura(supabase, {
      ...f,
      total: Number(f.total),
      ocr_raw: f.ocr_raw,
    })
    await aplicarMatching(supabase, f.id, resultado)

    console.log(
      `[${f.proveedor_nombre}] ${f.numero_factura}: ${resultado.estado} · ${resultado.matches.length} matches · conf ${resultado.confianza}`,
    )
    console.log(`    ${resultado.mensaje}`)
  }

  console.log('\nDone.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
