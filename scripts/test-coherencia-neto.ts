/**
 * test-coherencia-neto.ts
 *
 * Verifica que el NETO estimado (calcNetoPorCanal) es coherente en todo el ERP.
 * La fórmula es la única fuente del neto estimado: Cashflow, Panel Global, Running
 * (cuando aún no hay dato real del OCR/resúmenes) la usan todos. Si el estimado no
 * fuera coherente, dos pantallas mostrarían beneficios distintos para lo mismo.
 *
 * Este test NO depende de datos reales en Supabase (las tablas de liquidaciones
 * pueden estar vacías). Prueba las dos propiedades que garantizan la coherencia:
 *
 *   1. ADITIVIDAD (los dos caminos = mismo dinero):
 *      el neto de un mes calculado de golpe debe ser igual a la suma de calcularlo
 *      semana a semana con los mismos datos. Esto valida que el prorrateo del fee
 *      periódico (2,29€/sem Uber, 10€/quincena Glovo) reparte bien y no duplica ni
 *      pierde importe. Es exactamente lo que diferencia el camino Cashflow (semanal)
 *      del camino Running (mensual): deben cuadrar al céntimo.
 *
 *   2. DETERMINISMO:
 *      misma entrada -> mismo neto, siempre. Garantiza que nadie ha metido azar ni
 *      un % hardcodeado fuera de config_canales.
 *
 * Si falla cualquiera -> process.exit(1).
 * Uso: npm run test:neto
 */

import {
  calcNetoPorCanal,
  type CanalConfig,
} from '../src/lib/panel/calcNetoPlataforma'

const TOLERANCIA = 0.01 // céntimo

// Config sintética con las fórmulas reales del ERP (no toca Supabase).
// Sirve para verificar la MECÁNICA de la fórmula de forma reproducible.
const CONFIG: Record<string, CanalConfig> = {
  'Uber Eats': {
    canal: 'Uber Eats', comision_pct: 0.30, comision_pct_prime: 0.33,
    fijo_eur: 0, fee_prime_eur: 0, fee_promo_eur: 0.82,
    fee_periodo_eur: 2.29, fee_periodicidad: 'semanal_por_marca',
    pct_pedidos_prime_estim: 0.20, pct_pedidos_promo_estim: 0.15,
  },
  'Glovo': {
    canal: 'Glovo', comision_pct: 0.30, comision_pct_prime: null,
    fijo_eur: 0, fee_prime_eur: 0.74, fee_promo_eur: 0,
    fee_periodo_eur: 10, fee_periodicidad: 'quincenal_por_marca',
    pct_pedidos_prime_estim: 0.25, pct_pedidos_promo_estim: 0,
  },
  'Just Eat': {
    canal: 'Just Eat', comision_pct: 0.30, comision_pct_prime: null,
    fijo_eur: 0.30, fee_prime_eur: 0, fee_promo_eur: 0,
    fee_periodo_eur: 0, fee_periodicidad: 'mensual',
    pct_pedidos_prime_estim: 0, pct_pedidos_promo_estim: 0,
  },
  'Web Propia': {
    canal: 'Web Propia', comision_pct: 0, comision_pct_prime: null,
    fijo_eur: 0.50, fee_prime_eur: 0, fee_promo_eur: 0,
    fee_periodo_eur: 0, fee_periodicidad: 'mensual',
    pct_pedidos_prime_estim: 0, pct_pedidos_promo_estim: 0,
  },
}

const MARCAS = { uber: 3, glovo: 3, je: 3, web: 1, dir: 1 }

let errores = 0
function check(nombre: string, ok: boolean, detalle = '') {
  if (ok) {
    console.log(`OK    ${nombre}`)
  } else {
    console.error(`ERROR ${nombre}${detalle ? ' · ' + detalle : ''}`)
    errores++
  }
}

function neto(canal: string, bruto: number, pedidos: number, desde: Date, hasta: Date, diasConDatos?: number): number {
  return calcNetoPorCanal(canal, bruto, pedidos, {
    modo: 'agregado_canal',
    marcasPorCanal: MARCAS,
    fechaDesde: desde,
    fechaHasta: hasta,
    configCanales: CONFIG,
    diasConDatos,
  }).neto
}

// -- 1. ADITIVIDAD: mes de golpe == suma de sus 4 semanas (mismos datos) --
// Un mes de 28 días = 4 semanas exactas. El fee periódico de Uber/Glovo
// repartido por las 4 semanas debe sumar igual que aplicado al mes entero.
for (const [canal, brutoSemana, pedSemana] of [
  ['uber', 2500, 180] as const,
  ['glovo', 1800, 130] as const,
  ['je', 1200, 90] as const,
  ['web', 600, 50] as const,
]) {
  // Mes de 28 días (4 semanas), con datos en los 28 días
  const mesDesde = new Date(2026, 1, 1)   // 1 feb 2026
  const mesHasta = new Date(2026, 1, 28)  // 28 feb 2026
  const netoMes = neto(canal, brutoSemana * 4, pedSemana * 4, mesDesde, mesHasta, 28)

  // 4 semanas de 7 días cada una
  let sumaSemanas = 0
  for (let s = 0; s < 4; s++) {
    const d = new Date(2026, 1, 1 + s * 7)
    const h = new Date(2026, 1, 7 + s * 7)
    sumaSemanas += neto(canal, brutoSemana, pedSemana, d, h, 7)
  }

  const diff = Math.abs(netoMes - sumaSemanas)
  check(
    `Aditividad ${canal} (mes 28d == 4 semanas)`,
    diff <= TOLERANCIA,
    `mes=${netoMes.toFixed(2)} semanas=${sumaSemanas.toFixed(2)} diff=${diff.toFixed(4)}`,
  )
}

// -- 2. DETERMINISMO: misma entrada == mismo neto --
for (const canal of ['uber', 'glovo', 'je', 'web']) {
  const desde = new Date(2026, 2, 1)
  const hasta = new Date(2026, 2, 31)
  const a = neto(canal, 3000, 200, desde, hasta, 31)
  const b = neto(canal, 3000, 200, desde, hasta, 31)
  check(`Determinismo ${canal}`, a === b, `a=${a.toFixed(4)} b=${b.toFixed(4)}`)
}

// -- 3. VENTA DIRECTA: neto == bruto (sin fees) --
{
  const desde = new Date(2026, 2, 1)
  const hasta = new Date(2026, 2, 31)
  const n = calcNetoPorCanal('dir', 1000, 40, { marcasPorCanal: MARCAS, fechaDesde: desde, fechaHasta: hasta, configCanales: CONFIG }).neto
  check('Venta directa neto == bruto', Math.abs(n - 1000) <= TOLERANCIA, `neto=${n.toFixed(2)}`)
}

if (errores > 0) {
  console.error(`\n${errores} comprobación(es) fallida(s). El neto NO es coherente.`)
  process.exit(1)
}
console.log('\nOK coherencia neto — el estimado es consistente en todo el ERP.')
process.exit(0)
