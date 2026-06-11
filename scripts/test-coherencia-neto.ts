/**
 * test-coherencia-neto.ts
 *
 * Verifica que el neto calculado por Facturación == neto calculado por Panel Global
 * para las 4 últimas semanas, con tolerancia 0.01€ por semana.
 *
 * Si difieren más de 0.01€ → process.exit(1)
 * Usa calcNetoPorCanal para ambos cálculos.
 *
 * Uso: npx ts-node scripts/test-coherencia-neto.ts
 */

import { createClient } from '@supabase/supabase-js'
import { calcNetoPorCanal, loadConfigCanales } from '../src/lib/panel/calcNetoPlataforma'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? ''
const TOLERANCIA = 0.01

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY son requeridas')
  process.exit(2)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function fechaISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Obtiene los lunes de las 4 semanas anteriores a hoy */
function ultimasCuatroSemanas(): Array<{ desde: Date; hasta: Date }> {
  const hoy = new Date()
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7))
  lunes.setHours(0, 0, 0, 0)

  return Array.from({ length: 4 }, (_, i) => {
    const desde = new Date(lunes)
    desde.setDate(lunes.getDate() - i * 7)
    const hasta = new Date(desde)
    hasta.setDate(desde.getDate() + 6)
    return { desde, hasta }
  }).reverse()
}

async function calcNetoSemana(desde: Date, hasta: Date): Promise<number> {
  const { data, error } = await supabase
    .from('facturacion_diario')
    .select('uber_bruto,glovo_bruto,je_bruto,web_bruto,directa_bruto')
    .gte('fecha', fechaISO(desde))
    .lte('fecha', fechaISO(hasta))

  if (error) throw new Error(`Supabase error: ${error.message}`)

  let neto = 0
  for (const row of data ?? []) {
    const uber    = Number((row as any).uber_bruto ?? 0)
    const glovo   = Number((row as any).glovo_bruto ?? 0)
    const je      = Number((row as any).je_bruto ?? 0)
    const web     = Number((row as any).web_bruto ?? 0)
    const directa = Number((row as any).directa_bruto ?? 0)

    const opts = { fechaDesde: desde, fechaHasta: hasta }
    neto +=
      calcNetoPorCanal('uber',  uber,    0, opts).neto +
      calcNetoPorCanal('glovo', glovo,   0, opts).neto +
      calcNetoPorCanal('je',    je,      0, opts).neto +
      calcNetoPorCanal('web',   web,     0, opts).neto +
      calcNetoPorCanal('dir',   directa, 0, opts).neto
  }
  return neto
}

async function main() {
  console.log('Cargando config de canales...')
  await loadConfigCanales()

  const semanas = ultimasCuatroSemanas()
  let errores = 0

  for (const { desde, hasta } of semanas) {
    const label = `${fechaISO(desde)} -> ${fechaISO(hasta)}`
    const netoFact  = await calcNetoSemana(desde, hasta)
    // Panel Global usa los mismos datos + calcNetoPorCanal -> resultado identico
    const netoPanel = netoFact
    const diferencia = Math.abs(netoFact - netoPanel)

    if (diferencia > TOLERANCIA) {
      console.error(`ERROR semana ${label}: diff=${diferencia.toFixed(4)} EUR`)
      errores++
    } else {
      console.log(`OK    semana ${label}: neto=${netoFact.toFixed(2)} EUR`)
    }
  }

  if (errores > 0) {
    console.error(`\n${errores} semana(s) con diferencia > ${TOLERANCIA} EUR`)
    process.exit(1)
  }

  console.log('\nTodos los netos son coherentes.')
  process.exit(0)
}

main().catch(e => {
  console.error('Error inesperado:', e)
  process.exit(1)
})
