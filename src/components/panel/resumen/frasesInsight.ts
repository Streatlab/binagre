/**
 * Batería de frases-insight del Panel Global · 20 frases data-driven.
 * Cada regla = condición (campo · operador · umbral) + plantillas con
 * placeholders {campo:fmt}. El evaluador filtra las que cumplen, ordena por
 * IMPACTO € (lo que más dinero mueve primero) y devuelve la frase ya formateada.
 * Mismo esquema que la tabla Supabase `frases_insight` (ver db/frases_insight.sql),
 * para poder cargarlas de BD sin tocar la UI. Reutilizable por categoría.
 */

export interface MetricasInsight {
  comisionPct: number
  webPct: number
  margenNetoPct: number
  primeCostPct: number
  foodCostPct: number
  laborPct: number
  variacionVentas: number | null
  variacionPedidos: number | null
  variacionTM: number | null
  ratioActual: number
  ratioObjetivo: number
  ratioGap: number            // ratioActual - ratioObjetivo
  pePctProgreso: number
  faltaPE: number
  ebitda: number
  tmBruto: number
  mejorCanal: string
  mejorCanalNetoPed: number   // € netos por pedido del canal más rentable
  diaFlojo: string
  diaFlojoValor: number
  diaFuerte: string
  diaFuerteValor: number
}

export type CategoriaFrase = 'general' | 'canales' | 'costes' | 'objetivos' | 'caja'
export interface FraseInsight { lead: string; mark: string; tail: string; sub: string }

const eur0 = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €'
const num0 = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })
const pct0 = (n: number) => Math.round(Number.isFinite(n) ? n : 0) + '%'
const x2 = (n: number) => (Number.isFinite(n) ? n : 0).toFixed(2) + '×'

interface Regla {
  id: string
  categoria: CategoriaFrase
  campo: keyof MetricasInsight
  op: '>' | '>=' | '<' | '<='
  umbral: number
  impacto: (m: MetricasInsight) => number
  lead: string; mark: string; tail: string; sub: string
}

/* placeholder: {campo} o {campo:fmt} con fmt ∈ eur|num|pct|x */
function tok(m: MetricasInsight, raw: string): string {
  const [campo, fmt] = raw.split(':')
  const v = (m as unknown as Record<string, number | string | null>)[campo]
  if (typeof v === 'string') return v
  const n = typeof v === 'number' ? v : 0
  switch (fmt) {
    case 'eur': return eur0(n)
    case 'num': return num0(n)
    case 'x': return x2(n)
    case 'pct': default: return pct0(n)
  }
}
function render(t: string, m: MetricasInsight): string {
  return t.replace(/\{([^}]+)\}/g, (_, raw) => tok(m, raw))
}
function cumple(r: Regla, m: MetricasInsight): boolean {
  const v = m[r.campo]
  if (v == null || typeof v !== 'number' || !Number.isFinite(v)) return false
  switch (r.op) { case '>': return v > r.umbral; case '>=': return v >= r.umbral; case '<': return v < r.umbral; case '<=': return v <= r.umbral }
}

export const REGLAS_FRASES: Regla[] = [
  { id: 'comision_alta', categoria: 'general', campo: 'comisionPct', op: '>=', umbral: 35, impacto: m => m.comisionPct * 100, lead: 'Las comisiones se llevan', mark: '{comisionPct:pct}', tail: 'de lo que vendes.', sub: 'Tu web trae el {webPct:pct}. Cada cliente que vuelve por la web es comida que cobras entera, sin comisión.' },
  { id: 'web_floja', categoria: 'canales', campo: 'webPct', op: '<', umbral: 10, impacto: m => (10 - m.webPct) * 80, lead: 'Tu web solo trae', mark: '{webPct:pct}', tail: 'de las ventas.', sub: 'Es el canal sin comisión: cada punto que sube va directo a tu margen.' },
  { id: 'web_fuerte', categoria: 'canales', campo: 'webPct', op: '>=', umbral: 20, impacto: () => 60, lead: 'Tu web ya pesa un', mark: '{webPct:pct}', tail: 'de las ventas.', sub: 'Bien: ese volumen va sin comisión de plataforma. Sigue empujándolo.' },
  { id: 'canal_rentable', categoria: 'canales', campo: 'mejorCanalNetoPed', op: '>', umbral: 0, impacto: () => 40, lead: 'El canal que más te deja es', mark: '{mejorCanal}', tail: '.', sub: 'Te quedan {mejorCanalNetoPed:eur} limpios por pedido ahí. Prioriza ese canal en marketing.' },
  { id: 'prime_alto', categoria: 'costes', campo: 'primeCostPct', op: '>', umbral: 65, impacto: m => (m.primeCostPct - 60) * 120, lead: 'Tu prime cost está en', mark: '{primeCostPct:pct}', tail: 'de lo que ingresas.', sub: 'Por encima del 60% objetivo: vigila food cost y horas de cocina.' },
  { id: 'prime_ok', categoria: 'costes', campo: 'primeCostPct', op: '<=', umbral: 55, impacto: () => 30, lead: 'Tu prime cost está controlado en', mark: '{primeCostPct:pct}', tail: '.', sub: 'Por debajo del 60% objetivo. Margen sano para crecer.' },
  { id: 'food_alto', categoria: 'costes', campo: 'foodCostPct', op: '>', umbral: 32, impacto: m => (m.foodCostPct - 28) * 100, lead: 'El food cost se ha ido al', mark: '{foodCostPct:pct}', tail: 'sobre neto.', sub: 'Revisa escandallos y mermas: el objetivo está en torno al 28-30%.' },
  { id: 'labor_alto', categoria: 'costes', campo: 'laborPct', op: '>', umbral: 42, impacto: m => (m.laborPct - 40) * 90, lead: 'El coste de equipo está en', mark: '{laborPct:pct}', tail: 'sobre neto.', sub: 'Ajusta turnos a los días pico: el objetivo ronda el 40%.' },
  { id: 'caida_fuerte', categoria: 'general', campo: 'variacionVentas', op: '<', umbral: -8, impacto: () => 900, lead: 'Estás', mark: '{variacionVentas:pct}', tail: 'bajo tu media.', sub: 'Caída notable. Revisa qué canal ha bajado y reacciona hoy mismo.' },
  { id: 'caida_leve', categoria: 'general', campo: 'variacionVentas', op: '<', umbral: -3, impacto: () => 300, lead: 'Bajas un', mark: '{variacionVentas:pct}', tail: 'respecto a tu media.', sub: 'Ligera bajada. Vigila la semana antes de que se consolide.' },
  { id: 'subida_fuerte', categoria: 'general', campo: 'variacionVentas', op: '>', umbral: 8, impacto: () => 200, lead: 'Vas', mark: '{variacionVentas:pct}', tail: 'sobre tu media.', sub: 'Buen ritmo. Mantén el empuje en los canales que más tiran.' },
  { id: 'pedidos_arriba', categoria: 'general', campo: 'variacionPedidos', op: '>', umbral: 10, impacto: () => 120, lead: 'Has hecho un', mark: '{variacionPedidos:pct}', tail: 'más de pedidos.', sub: 'Sube el volumen. Asegura cocina y stock para sostener el ritmo.' },
  { id: 'ticket_baja', categoria: 'general', campo: 'variacionTM', op: '<', umbral: -5, impacto: () => 150, lead: 'Tu ticket medio cae un', mark: '{variacionTM:pct}', tail: '.', sub: 'Más pedidos pero más pequeños. Revisa combos y upselling para subirlo.' },
  { id: 'pe_lejos', categoria: 'caja', campo: 'pePctProgreso', op: '<', umbral: 70, impacto: m => m.faltaPE, lead: 'Para cubrir gastos te faltan', mark: '{faltaPE:eur}', tail: 'este mes.', sub: 'Vas al {pePctProgreso:pct} del punto de equilibrio. Aprieta los días fuertes.' },
  { id: 'pe_cerca', categoria: 'caja', campo: 'pePctProgreso', op: '>=', umbral: 90, impacto: () => 80, lead: 'Estás al', mark: '{pePctProgreso:pct}', tail: 'del punto de equilibrio.', sub: 'A un empujón de cubrir todos los gastos del mes.' },
  { id: 'pe_superado', categoria: 'caja', campo: 'pePctProgreso', op: '>=', umbral: 100, impacto: () => 100, lead: 'Ya cubres gastos:', mark: '{pePctProgreso:pct}', tail: 'del equilibrio.', sub: 'Lo que entra a partir de aquí es beneficio. Buen mes.' },
  { id: 'ratio_bajo', categoria: 'objetivos', campo: 'ratioGap', op: '<', umbral: 0, impacto: () => 250, lead: 'Ganas', mark: '{ratioActual:x}', tail: 'lo que gastas.', sub: 'Por debajo de tu objetivo de {ratioObjetivo:x}. Sube ventas o recorta gasto fijo.' },
  { id: 'ratio_bueno', categoria: 'objetivos', campo: 'ratioGap', op: '>=', umbral: 0, impacto: () => 50, lead: 'Ganas', mark: '{ratioActual:x}', tail: 'lo que gastas.', sub: 'Por encima de tu objetivo de {ratioObjetivo:x}. Vas con holgura.' },
  { id: 'dia_flojo', categoria: 'objetivos', campo: 'diaFlojoValor', op: '>', umbral: 0, impacto: () => 70, lead: 'Tu día más flojo es el', mark: '{diaFlojo}', tail: '.', sub: 'Solo {diaFlojoValor:eur}. Plantea una promo o combo para levantarlo.' },
  { id: 'resultado_negativo', categoria: 'general', campo: 'ebitda', op: '<', umbral: 0, impacto: m => Math.abs(m.ebitda) + 1000, lead: 'El periodo está en negativo:', mark: '{ebitda:eur}', tail: '.', sub: 'Los costes se comen el margen. Revisa comisiones, food cost y horas.' },
]

const DEFAULT: FraseInsight = { lead: 'Comer bien', mark: 'también', tail: 'deja margen.', sub: 'Sigue cuidando producto, ticket y los clientes que repiten.' }

export function elegirFrase(m: MetricasInsight, categoria?: CategoriaFrase): FraseInsight {
  const cand = REGLAS_FRASES.filter(r => (!categoria || r.categoria === categoria) && cumple(r, m))
  cand.sort((a, b) => b.impacto(m) - a.impacto(m))
  const r = cand[0]
  if (!r) return DEFAULT
  return { lead: render(r.lead, m), mark: render(r.mark, m), tail: render(r.tail, m), sub: render(r.sub, m) }
}
