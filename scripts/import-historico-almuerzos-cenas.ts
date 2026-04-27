/**
 * import-historico-almuerzos-cenas.ts
 * =====================================
 * Script para importar histórico de almuerzos/cenas a facturacion_diario.
 *
 * USO:
 *   npx ts-node --esm scripts/import-historico-almuerzos-cenas.ts <archivo.xlsx>
 *
 * REQUISITOS:
 *   - .env.local con VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
 *   - Excel con columnas: fecha (YYYY-MM-DD), servicio (almuerzo|cena|ambos),
 *     uber_pedidos, uber_bruto, glovo_pedidos, glovo_bruto,
 *     je_pedidos, je_bruto, web_pedidos, web_bruto,
 *     directa_pedidos, directa_bruto, total_pedidos, total_bruto
 *
 * NOTAS:
 *   - Si un día ya existe con mismo servicio → SKIP (no sobreescribe)
 *   - El campo servicio: 'almuerzo' | 'cena' | 'ambos' | ''
 *   - Las filas con servicio 'ambos' se insertan como una sola fila
 *   - NUNCA usar SUPABASE de David (idclhnxttdbwayxeowrm)
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos en .env.local')
  process.exit(1)
}

// NEVER use David's Supabase
if (SUPABASE_URL.includes('idclhnxttdbwayxeowrm')) {
  console.error('AISLAMIENTO VIOLADO: usando Supabase de David. ABORT.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

interface RowExcel {
  fecha: string
  servicio: string
  uber_pedidos: number
  uber_bruto: number
  glovo_pedidos: number
  glovo_bruto: number
  je_pedidos: number
  je_bruto: number
  web_pedidos: number
  web_bruto: number
  directa_pedidos: number
  directa_bruto: number
  total_pedidos: number
  total_bruto: number
}

async function main() {
  const file = process.argv[2]
  if (!file) {
    console.log('USO: npx ts-node scripts/import-historico-almuerzos-cenas.ts <archivo.json>')
    console.log('El archivo debe ser JSON con un array de registros según el formato del script.')
    process.exit(0)
  }

  if (!fs.existsSync(file)) {
    console.error(`Archivo no encontrado: ${file}`)
    process.exit(1)
  }

  const rows: RowExcel[] = JSON.parse(fs.readFileSync(file, 'utf-8'))
  console.log(`Cargando ${rows.length} registros desde ${path.basename(file)}...`)

  let insertados = 0
  let omitidos = 0
  let errores = 0

  for (const row of rows) {
    // Check if already exists
    const { data: existing } = await supabase
      .from('facturacion_diario')
      .select('id')
      .eq('fecha', row.fecha)
      .eq('servicio', row.servicio)
      .maybeSingle()

    if (existing) {
      omitidos++
      continue
    }

    const { error } = await supabase.from('facturacion_diario').insert({
      fecha:             row.fecha,
      servicio:          row.servicio || '',
      uber_pedidos:      row.uber_pedidos    || 0,
      uber_bruto:        row.uber_bruto      || 0,
      glovo_pedidos:     row.glovo_pedidos   || 0,
      glovo_bruto:       row.glovo_bruto     || 0,
      je_pedidos:        row.je_pedidos      || 0,
      je_bruto:          row.je_bruto        || 0,
      web_pedidos:       row.web_pedidos     || 0,
      web_bruto:         row.web_bruto       || 0,
      directa_pedidos:   row.directa_pedidos || 0,
      directa_bruto:     row.directa_bruto   || 0,
      total_pedidos:     row.total_pedidos   || 0,
      total_bruto:       row.total_bruto     || 0,
    })

    if (error) {
      console.error(`Error en ${row.fecha} (${row.servicio}):`, error.message)
      errores++
    } else {
      insertados++
    }
  }

  console.log(`\nResultado:`)
  console.log(`  Insertados: ${insertados}`)
  console.log(`  Omitidos (ya existían): ${omitidos}`)
  console.log(`  Errores: ${errores}`)
}

main().catch(e => { console.error(e); process.exit(1) })
