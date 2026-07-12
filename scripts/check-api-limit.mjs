// Candado anti-crecimiento de la API (regla 4 puertas, jul-2026).
// Cuenta las Serverless Functions reales en api/ (todo archivo .ts/.js que no
// empiece por _ ni viva bajo un directorio que empiece por _). El plan Hobby de
// Vercel corta en 12; aquí cortamos en 10 para tener margen, y avisamos en 9.
// Si alguien añade una función suelta, el build FALLA antes de publicar.
// Regla permanente: toda función nueva = handler en api/_puertas + rama en una
// puerta existente (papeleo / informes / operaciones / oauth), nunca archivo suelto.
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const LIMITE_DURO = 10
const AVISO = 9

function contarFunciones(dir, acumulado = []) {
  for (const nombre of readdirSync(dir)) {
    if (nombre.startsWith('_')) continue
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) {
      contarFunciones(ruta, acumulado)
    } else if (/\.(ts|js|mts|mjs|cts|cjs)$/.test(nombre)) {
      acumulado.push(ruta)
    }
  }
  return acumulado
}

const funciones = contarFunciones('api')
console.log(`[candado-api] Funciones serverless detectadas: ${funciones.length}`)
for (const f of funciones) console.log(`  - ${f}`)

if (funciones.length > LIMITE_DURO) {
  console.error(`\n[candado-api] ❌ BUILD BLOQUEADO: ${funciones.length} funciones (límite interno ${LIMITE_DURO}, límite Vercel Hobby 12).`)
  console.error('[candado-api] Ninguna función API nueva como archivo suelto: handler en api/_puertas + rama en una puerta (papeleo/informes/operaciones/oauth).')
  process.exit(1)
}

if (funciones.length >= AVISO) {
  console.warn(`\n[candado-api] ⚠️ Aviso: ${funciones.length} funciones, acercándose al límite interno de ${LIMITE_DURO}.`)
}

console.log('[candado-api] ✅ OK')
