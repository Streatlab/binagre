// Importa EPS y RECETAS desde el Excel del GAS a Supabase
// Uso: node scripts/import_escandallo.mjs
import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'

/* ── Credenciales Supabase ── */
const SUPABASE_URL = 'https://eryauogxcpbgdryeimdq.supabase.co'
let SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY

// Intentar leer de .env.local si existe
if (!SUPABASE_KEY && existsSync('.env.local')) {
  const env = readFileSync('.env.local', 'utf8')
  const m = env.match(/SUPABASE[_A-Z]*KEY\s*=\s*["']?([^"'\r\n]+)/)
  if (m) SUPABASE_KEY = m[1]
}

// Fallback a la publishable key del supabase.ts (solo lectura, no permite escritura)
if (!SUPABASE_KEY) {
  const lib = readFileSync('src/lib/supabase.ts', 'utf8')
  const m = lib.match(/['"]?(sb_[a-z]+_[A-Za-z0-9_-]+)['"]?/)
  if (m) SUPABASE_KEY = m[1]
}

if (!SUPABASE_KEY) {
  console.error('ERROR: No se encontro SUPABASE_KEY. Configurar variable de entorno SUPABASE_SERVICE_KEY o anadir a .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

/* ── Helpers ── */
const cellVal = (ws, r, c) => {
  const ref = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 })
  return ws[ref]?.v
}
const numOrNull = v => (typeof v === 'number' && !isNaN(v)) ? v : (v ? parseFloat(String(v).replace(',', '.')) || null : null)
const toISODate = v => {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

async function upsertEps(codigo, nombre, raciones, tamanoRac, unidad, fecha) {
  // Check existing
  const { data: existing } = await supabase.from('eps').select('id').eq('codigo', codigo).maybeSingle()
  const record = { codigo, nombre, raciones, tamano_rac: tamanoRac, unidad, fecha, coste_tanda: 0, coste_rac: 0 }
  if (existing) {
    await supabase.from('eps').update(record).eq('id', existing.id)
    return existing.id
  } else {
    const { data } = await supabase.from('eps').insert(record).select('id').single()
    return data?.id
  }
}

async function upsertReceta(codigo, nombre, raciones, tamanoRac, unidad, fecha) {
  const { data: existing } = await supabase.from('recetas').select('id').eq('codigo', codigo).maybeSingle()
  const record = { codigo, nombre, raciones, tamano_rac: tamanoRac, unidad, fecha, coste_tanda: 0, coste_rac: 0 }
  if (existing) {
    await supabase.from('recetas').update(record).eq('id', existing.id)
    return existing.id
  } else {
    const { data } = await supabase.from('recetas').insert(record).select('id').single()
    return data?.id
  }
}

function extractSheet(ws) {
  const codigo = String(cellVal(ws, 1, 2) || '').trim()        // B1
  const nombre = String(cellVal(ws, 1, 3) || '').trim()        // C1
  const fecha = toISODate(cellVal(ws, 2, 5))                   // E2
  const raciones = numOrNull(cellVal(ws, 2, 6)) || 1           // F2
  const tamanoRac = numOrNull(cellVal(ws, 2, 10))              // J2
  const unidad = String(cellVal(ws, 2, 12) || 'Ración').trim() // L2

  const lineas = []
  for (let r = 6; r <= 40; r++) {
    const ing = cellVal(ws, r, 2)      // B: ingrediente
    if (!ing) break                    // fin líneas
    const cantidad = numOrNull(cellVal(ws, r, 3)) || 0   // C
    const ud = String(cellVal(ws, r, 4) || 'gr.').trim() // D
    const eurUd = numOrNull(cellVal(ws, r, 5)) || 0      // E
    const eurTot = numOrNull(cellVal(ws, r, 6)) || 0     // F
    const pct = numOrNull(cellVal(ws, r, 7)) || 0        // G
    lineas.push({
      linea: lineas.length + 1,
      ingrediente_nombre: String(ing).trim(),
      cantidad, unidad: ud,
      eur_ud_neta: eurUd,
      eur_total: eurTot,
      pct_total: pct,
    })
  }

  return { codigo, nombre, raciones, tamanoRac, unidad, fecha, lineas }
}

async function main() {
  if (!existsSync('data/01_ESCANDALLO.xlsx')) {
    console.error('ERROR: data/01_ESCANDALLO.xlsx no encontrado')
    process.exit(1)
  }
  console.log('Leyendo data/01_ESCANDALLO.xlsx...')
  const wb = XLSX.readFile('data/01_ESCANDALLO.xlsx', { cellDates: true })

  const epsSheets = wb.SheetNames.filter(n => /^EPS\d/i.test(n))
  const recSheets = wb.SheetNames.filter(n => /^REC\d/i.test(n))

  console.log(`EPS: ${epsSheets.length}, REC: ${recSheets.length}`)
  let okEps = 0, errEps = 0, okRec = 0, errRec = 0

  /* ── EPS ── */
  for (const name of epsSheets) {
    try {
      const { codigo, nombre, raciones, tamanoRac, unidad, fecha, lineas } = extractSheet(wb.Sheets[name])
      if (!codigo) { console.log(`  SKIP ${name} (sin código)`); continue }

      const epsId = await upsertEps(codigo, nombre, raciones, tamanoRac, unidad, fecha)
      if (!epsId) { errEps++; continue }

      // Replace líneas
      await supabase.from('eps_lineas').delete().eq('eps_id', epsId)
      if (lineas.length) {
        const rows = lineas.map(l => ({ ...l, eps_id: epsId }))
        await supabase.from('eps_lineas').insert(rows)
      }

      // Recalcular costes
      const costeTanda = lineas.reduce((s, l) => s + l.eur_total, 0)
      await supabase.from('eps').update({
        coste_tanda: costeTanda,
        coste_rac: raciones > 0 ? costeTanda / raciones : 0,
      }).eq('id', epsId)

      okEps++
      console.log(`  ${codigo} OK — ${lineas.length} lineas`)
    } catch (e) {
      errEps++
      console.error(`  ${name} ERROR:`, e.message)
    }
  }

  /* ── REC ── */
  for (const name of recSheets) {
    try {
      const { codigo, nombre, raciones, tamanoRac, unidad, fecha, lineas } = extractSheet(wb.Sheets[name])
      if (!codigo) { console.log(`  SKIP ${name} (sin código)`); continue }

      const recId = await upsertReceta(codigo, nombre, raciones, tamanoRac, unidad, fecha)
      if (!recId) { errRec++; continue }

      await supabase.from('recetas_lineas').delete().eq('receta_id', recId)
      if (lineas.length) {
        // RecetasLineas tiene campo 'tipo' obligatorio
        const rows = lineas.map(l => ({ ...l, receta_id: recId, tipo: 'ING' }))
        await supabase.from('recetas_lineas').insert(rows)
      }

      const costeTanda = lineas.reduce((s, l) => s + l.eur_total, 0)
      await supabase.from('recetas').update({
        coste_tanda: costeTanda,
        coste_rac: raciones > 0 ? costeTanda / raciones : 0,
      }).eq('id', recId)

      okRec++
      console.log(`  ${codigo} OK — ${lineas.length} lineas`)
    } catch (e) {
      errRec++
      console.error(`  ${name} ERROR:`, e.message)
    }
  }

  console.log(`\nResumen: EPS ${okEps}/${okEps + errEps} OK | REC ${okRec}/${okRec + errRec} OK`)
}

main().catch(e => { console.error(e); process.exit(1) })
