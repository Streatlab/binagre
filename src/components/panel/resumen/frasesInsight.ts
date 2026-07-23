/**
 * Batería de frases-insight del Panel Global · ~52 frases data-driven.
 * Cada regla = condición (campo · operador · umbral) + plantillas con
 * placeholders {campo:fmt}. El evaluador filtra las que cumplen, ordena por
 * IMPACTO € (lo que más dinero mueve primero) y devuelve frases ya formateadas.
 * Cuando varias frases "gemelas" cuentan lo mismo, se rota por día (semilla
 * determinista): el lenguaje suena natural sin cambiar en cada render.
 * Mismo esquema que la tabla Supabase `frases_insight` (espejo documental).
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

type Op = '>' | '>=' | '<' | '<=' | 'abs<' | 'abs>='

interface Regla {
  id: string
  categoria: CategoriaFrase
  campo: keyof MetricasInsight
  op: Op
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
  switch (r.op) {
    case '>': return v > r.umbral
    case '>=': return v >= r.umbral
    case '<': return v < r.umbral
    case '<=': return v <= r.umbral
    case 'abs<': return Math.abs(v) < r.umbral
    case 'abs>=': return Math.abs(v) >= r.umbral
  }
}

/* Jitter determinista por día+id: rota entre frases gemelas sin parpadear. */
function jitter(id: string): number {
  const dia = new Date().toISOString().slice(0, 10)
  let h = 0
  const s = dia + id
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 97
  return h / 97 // 0..1
}

export const REGLAS_FRASES: Regla[] = [
  /* ── GENERAL · pulso de ventas ── */
  { id: 'caida_fuerte', categoria: 'general', campo: 'variacionVentas', op: '<', umbral: -8, impacto: () => 900, lead: 'Estás', mark: '{variacionVentas:pct}', tail: 'bajo tu media.', sub: 'Caída notable. Revisa qué canal ha bajado y reacciona hoy mismo.' },
  { id: 'caida_fuerte_b', categoria: 'general', campo: 'variacionVentas', op: '<', umbral: -8, impacto: () => 900, lead: 'La semana viene', mark: '{variacionVentas:pct}', tail: 'más floja de lo normal.', sub: 'Mira canal a canal dónde se pierde y mete una acción hoy: promo, visibilidad o horario.' },
  { id: 'caida_leve', categoria: 'general', campo: 'variacionVentas', op: '<', umbral: -3, impacto: () => 300, lead: 'Bajas un', mark: '{variacionVentas:pct}', tail: 'respecto a tu media.', sub: 'Ligera bajada. Vigila la semana antes de que se consolide.' },
  { id: 'caida_leve_b', categoria: 'general', campo: 'variacionVentas', op: '<', umbral: -3, impacto: () => 300, lead: 'Se enfría un poco:', mark: '{variacionVentas:pct}', tail: 'frente al periodo anterior.', sub: 'Nada grave todavía. Si mañana sigue igual, toca mover ficha.' },
  { id: 'plano', categoria: 'general', campo: 'variacionVentas', op: 'abs<', umbral: 3, impacto: () => 90, lead: 'Semana', mark: 'estable', tail: ': vendes como siempre.', sub: 'Variación de {variacionVentas:pct}. Buen momento para probar algo nuevo sin riesgo.' },
  { id: 'subida_leve', categoria: 'general', campo: 'variacionVentas', op: '>', umbral: 3, impacto: () => 150, lead: 'Subes un', mark: '{variacionVentas:pct}', tail: 'sobre tu media.', sub: 'Buen tono. Identifica qué lo empuja y repítelo.' },
  { id: 'subida_fuerte', categoria: 'general', campo: 'variacionVentas', op: '>', umbral: 8, impacto: () => 200, lead: 'Vas', mark: '{variacionVentas:pct}', tail: 'sobre tu media.', sub: 'Buen ritmo. Mantén el empuje en los canales que más tiran.' },
  { id: 'subida_fuerte_b', categoria: 'general', campo: 'variacionVentas', op: '>', umbral: 8, impacto: () => 200, lead: 'Semana fuerte:', mark: '+{variacionVentas:pct}', tail: 'frente a tu media.', sub: 'La cocina está tirando. Asegura stock y equipo para no frenar el momento.' },
  { id: 'subidon', categoria: 'general', campo: 'variacionVentas', op: '>', umbral: 20, impacto: () => 350, lead: 'Estás rompiendo tu media:', mark: '+{variacionVentas:pct}', tail: '.', sub: 'Pico claro de demanda. Apunta qué has hecho distinto esta semana: eso es oro.' },
  { id: 'pedidos_arriba', categoria: 'general', campo: 'variacionPedidos', op: '>', umbral: 10, impacto: () => 120, lead: 'Has hecho un', mark: '{variacionPedidos:pct}', tail: 'más de pedidos.', sub: 'Sube el volumen. Asegura cocina y stock para sostener el ritmo.' },
  { id: 'pedidos_caen', categoria: 'general', campo: 'variacionPedidos', op: '<', umbral: -10, impacto: () => 280, lead: 'Entran un', mark: '{variacionPedidos:pct}', tail: 'menos de pedidos.', sub: 'Menos gente pidiendo. Revisa visibilidad en plataformas y fotos de carta.' },
  { id: 'ticket_baja', categoria: 'general', campo: 'variacionTM', op: '<', umbral: -5, impacto: () => 150, lead: 'Tu ticket medio cae un', mark: '{variacionTM:pct}', tail: '.', sub: 'Más pedidos pero más pequeños. Revisa combos y upselling para subirlo.' },
  { id: 'ticket_sube', categoria: 'general', campo: 'variacionTM', op: '>', umbral: 5, impacto: () => 110, lead: 'El ticket medio sube un', mark: '{variacionTM:pct}', tail: '.', sub: 'Cada pedido vale más. Los combos y extras están funcionando.' },
  { id: 'ticket_alto', categoria: 'general', campo: 'tmBruto', op: '>', umbral: 28, impacto: () => 60, lead: 'Tu pedido medio ya es de', mark: '{tmBruto:eur}', tail: '.', sub: 'Ticket alto para delivery. Cuida los packs familiares: son los que lo sostienen.' },
  { id: 'resultado_negativo', categoria: 'general', campo: 'ebitda', op: '<', umbral: 0, impacto: m => Math.abs(m.ebitda) + 1000, lead: 'El periodo está en negativo:', mark: '{ebitda:eur}', tail: '.', sub: 'Los costes se comen el margen. Revisa comisiones, food cost y horas.' },
  { id: 'resultado_positivo', categoria: 'general', campo: 'ebitda', op: '>', umbral: 500, impacto: () => 130, lead: 'El periodo deja', mark: '{ebitda:eur}', tail: 'de beneficio operativo.', sub: 'EBITDA positivo. Guarda una parte para provisiones antes de tocarlo.' },
  { id: 'margen_bajo', categoria: 'general', campo: 'margenNetoPct', op: '<', umbral: 50, impacto: () => 400, lead: 'Solo te queda el', mark: '{margenNetoPct:pct}', tail: 'de cada euro vendido.', sub: 'Las comisiones pesan demasiado. Empuja la web y revisa los canales caros.' },
  { id: 'margen_sano', categoria: 'general', campo: 'margenNetoPct', op: '>=', umbral: 60, impacto: () => 70, lead: 'Te queda el', mark: '{margenNetoPct:pct}', tail: 'de cada euro vendido.', sub: 'Margen neto sano tras comisiones. Así da gusto crecer.' },

  /* ── CANALES ── */
  { id: 'comision_alta', categoria: 'canales', campo: 'comisionPct', op: '>=', umbral: 35, impacto: m => m.comisionPct * 100, lead: 'Las comisiones se llevan', mark: '{comisionPct:pct}', tail: 'de lo que vendes.', sub: 'Tu web trae el {webPct:pct}. Cada cliente que vuelve por la web es comida que cobras entera, sin comisión.' },
  { id: 'comision_media', categoria: 'canales', campo: 'comisionPct', op: '>=', umbral: 28, impacto: m => m.comisionPct * 60, lead: 'De cada 10 € vendidos,', mark: '{comisionPct:pct}', tail: 'se va en comisiones.', sub: 'Es el precio de las plataformas. La web propia es el camino para bajarlo.' },
  { id: 'web_floja', categoria: 'canales', campo: 'webPct', op: '<', umbral: 10, impacto: m => (10 - m.webPct) * 80, lead: 'Tu web solo trae', mark: '{webPct:pct}', tail: 'de las ventas.', sub: 'Es el canal sin comisión: cada punto que sube va directo a tu margen.' },
  { id: 'web_floja_b', categoria: 'canales', campo: 'webPct', op: '<', umbral: 10, impacto: m => (10 - m.webPct) * 80, lead: 'Casi todo entra por plataformas: la web pesa', mark: '{webPct:pct}', tail: '.', sub: 'Un flyer en cada pedido con descuento web convierte clientes de plataforma en clientes tuyos.' },
  { id: 'web_media', categoria: 'canales', campo: 'webPct', op: '>=', umbral: 10, impacto: () => 45, lead: 'La web ya trae el', mark: '{webPct:pct}', tail: 'de tus ventas.', sub: 'Va cogiendo peso. El objetivo realista está en el 20%: sigue empujando.' },
  { id: 'web_fuerte', categoria: 'canales', campo: 'webPct', op: '>=', umbral: 20, impacto: () => 60, lead: 'Tu web ya pesa un', mark: '{webPct:pct}', tail: 'de las ventas.', sub: 'Bien: ese volumen va sin comisión de plataforma. Sigue empujándolo.' },
  { id: 'canal_rentable', categoria: 'canales', campo: 'mejorCanalNetoPed', op: '>', umbral: 0, impacto: () => 40, lead: 'El canal que más te deja es', mark: '{mejorCanal}', tail: '.', sub: 'Te quedan {mejorCanalNetoPed:eur} limpios por pedido ahí. Prioriza ese canal en marketing.' },
  { id: 'canal_rentable_b', categoria: 'canales', campo: 'mejorCanalNetoPed', op: '>', umbral: 0, impacto: () => 40, lead: 'Donde más ganas por pedido:', mark: '{mejorCanal}', tail: '.', sub: '{mejorCanalNetoPed:eur} netos por pedido. Si hay que elegir dónde invertir, es aquí.' },

  /* ── COSTES ── */
  { id: 'prime_alto', categoria: 'costes', campo: 'primeCostPct', op: '>', umbral: 65, impacto: m => (m.primeCostPct - 60) * 120, lead: 'Tu prime cost está en', mark: '{primeCostPct:pct}', tail: 'de lo que ingresas.', sub: 'Por encima del 60% objetivo: vigila food cost y horas de cocina.' },
  { id: 'prime_muy_alto', categoria: 'costes', campo: 'primeCostPct', op: '>', umbral: 75, impacto: m => (m.primeCostPct - 60) * 200, lead: 'Producto y equipo se llevan el', mark: '{primeCostPct:pct}', tail: 'de tus ingresos.', sub: 'Nivel crítico: con esto no queda margen para el resto. Prioridad absoluta esta semana.' },
  { id: 'prime_ok', categoria: 'costes', campo: 'primeCostPct', op: '<=', umbral: 55, impacto: () => 30, lead: 'Tu prime cost está controlado en', mark: '{primeCostPct:pct}', tail: '.', sub: 'Por debajo del 60% objetivo. Margen sano para crecer.' },
  { id: 'food_alto', categoria: 'costes', campo: 'foodCostPct', op: '>', umbral: 32, impacto: m => (m.foodCostPct - 28) * 100, lead: 'El food cost se ha ido al', mark: '{foodCostPct:pct}', tail: 'sobre neto.', sub: 'Revisa escandallos y mermas: el objetivo está en torno al 28-30%.' },
  { id: 'food_muy_alto', categoria: 'costes', campo: 'foodCostPct', op: '>', umbral: 38, impacto: m => (m.foodCostPct - 28) * 180, lead: 'El producto se come el', mark: '{foodCostPct:pct}', tail: 'de tus ingresos netos.', sub: 'Muy por encima del objetivo. Revisa precios de proveedor y raciones antes que nada.' },
  { id: 'food_ok', categoria: 'costes', campo: 'foodCostPct', op: '>', umbral: 0.1, impacto: m => (m.foodCostPct <= 30 ? 35 : 0), lead: 'Food cost en', mark: '{foodCostPct:pct}', tail: ': dentro de objetivo.', sub: 'El escandallo está funcionando. Mantén el ojo en las mermas.' },
  { id: 'labor_alto', categoria: 'costes', campo: 'laborPct', op: '>', umbral: 42, impacto: m => (m.laborPct - 40) * 90, lead: 'El coste de equipo está en', mark: '{laborPct:pct}', tail: 'sobre neto.', sub: 'Ajusta turnos a los días pico: el objetivo ronda el 40%.' },
  { id: 'labor_muy_alto', categoria: 'costes', campo: 'laborPct', op: '>', umbral: 50, impacto: m => (m.laborPct - 40) * 150, lead: 'El equipo cuesta el', mark: '{laborPct:pct}', tail: 'de lo que ingresas.', sub: 'Hay más horas que ventas. Cuadra los turnos con los picos de comida y cena.' },

  /* ── CAJA / EQUILIBRIO ── */
  { id: 'pe_lejos', categoria: 'caja', campo: 'pePctProgreso', op: '<', umbral: 70, impacto: m => m.faltaPE, lead: 'Para cubrir gastos te faltan', mark: '{faltaPE:eur}', tail: 'este mes.', sub: 'Vas al {pePctProgreso:pct} del punto de equilibrio. Aprieta los días fuertes.' },
  { id: 'pe_lejos_b', categoria: 'caja', campo: 'pePctProgreso', op: '<', umbral: 70, impacto: m => m.faltaPE, lead: 'El mes aún no se paga solo: faltan', mark: '{faltaPE:eur}', tail: '.', sub: 'Estás al {pePctProgreso:pct} del equilibrio. Cada día fuerte cuenta doble ahora.' },
  { id: 'pe_medio', categoria: 'caja', campo: 'pePctProgreso', op: '>=', umbral: 70, impacto: () => 65, lead: 'Llevas cubierto el', mark: '{pePctProgreso:pct}', tail: 'de los gastos del mes.', sub: 'Buen avance hacia el equilibrio. Quedan {faltaPE:eur} por cubrir.' },
  { id: 'pe_cerca', categoria: 'caja', campo: 'pePctProgreso', op: '>=', umbral: 90, impacto: () => 80, lead: 'Estás al', mark: '{pePctProgreso:pct}', tail: 'del punto de equilibrio.', sub: 'A un empujón de cubrir todos los gastos del mes.' },
  { id: 'pe_superado', categoria: 'caja', campo: 'pePctProgreso', op: '>=', umbral: 100, impacto: () => 100, lead: 'Ya cubres gastos:', mark: '{pePctProgreso:pct}', tail: 'del equilibrio.', sub: 'Lo que entra a partir de aquí es beneficio. Buen mes.' },
  { id: 'pe_superado_b', categoria: 'caja', campo: 'pePctProgreso', op: '>=', umbral: 100, impacto: () => 100, lead: 'Mes cubierto: vas al', mark: '{pePctProgreso:pct}', tail: 'del equilibrio.', sub: 'A partir de aquí, todo lo que entra es tuyo. A rematar bien el mes.' },

  /* ── OBJETIVOS / RATIO / DÍAS ── */
  { id: 'ratio_bajo', categoria: 'objetivos', campo: 'ratioGap', op: '<', umbral: 0, impacto: () => 250, lead: 'Ganas', mark: '{ratioActual:x}', tail: 'lo que gastas.', sub: 'Por debajo de tu objetivo de {ratioObjetivo:x}. Sube ventas o recorta gasto fijo.' },
  { id: 'ratio_critico', categoria: 'objetivos', campo: 'ratioActual', op: '<', umbral: 1, impacto: () => 700, lead: 'Ingresas', mark: '{ratioActual:x}', tail: 'lo que gastas: por debajo de 1.', sub: 'Este mes los gastos van por delante. Mira Cashflow y prioriza cobros.' },
  { id: 'ratio_bueno', categoria: 'objetivos', campo: 'ratioGap', op: '>=', umbral: 0, impacto: () => 50, lead: 'Ganas', mark: '{ratioActual:x}', tail: 'lo que gastas.', sub: 'Por encima de tu objetivo de {ratioObjetivo:x}. Vas con holgura.' },
  { id: 'ratio_holgado', categoria: 'objetivos', campo: 'ratioGap', op: '>=', umbral: 0.5, impacto: () => 75, lead: 'Por cada euro de gasto entran', mark: '{ratioActual:x}', tail: '.', sub: 'Muy por encima de tu objetivo. Es buen momento para invertir en crecer.' },
  { id: 'dia_flojo', categoria: 'objetivos', campo: 'diaFlojoValor', op: '>', umbral: 0, impacto: () => 70, lead: 'Tu día más flojo es el', mark: '{diaFlojo}', tail: '.', sub: 'Solo {diaFlojoValor:eur}. Plantea una promo o combo para levantarlo.' },
  { id: 'dia_fuerte', categoria: 'objetivos', campo: 'diaFuerteValor', op: '>', umbral: 0, impacto: () => 55, lead: 'Tu mejor día es el', mark: '{diaFuerte}', tail: 'con {diaFuerteValor:eur}.', sub: 'Ese día la máquina funciona. Asegura equipo y stock para exprimirlo.' },
]

const DEFAULT: FraseInsight = { lead: 'Comer bien', mark: 'también', tail: 'deja margen.', sub: 'Sigue cuidando producto, ticket y los clientes que repiten.' }

/** Devuelve la mejor frase de una categoría (o de todas). */
export function elegirFrase(m: MetricasInsight, categoria?: CategoriaFrase): FraseInsight {
  return elegirFrases(m, 1, categoria)[0] ?? DEFAULT
}

/**
 * Devuelve las `n` mejores frases DISTINTAS (ordenadas por impacto €, con
 * rotación diaria entre frases gemelas de igual impacto). Cada frase sale de
 * una condición diferente para no repetir el mismo mensaje dos veces.
 */
export function elegirFrases(m: MetricasInsight, n: number, categoria?: CategoriaFrase): FraseInsight[] {
  const cand = REGLAS_FRASES.filter(r => (!categoria || r.categoria === categoria) && cumple(r, m))
  cand.sort((a, b) => {
    const diff = b.impacto(m) - a.impacto(m)
    if (Math.abs(diff) > 0.001) return diff
    return jitter(b.id) - jitter(a.id) // gemelas: rota por día
  })
  const out: FraseInsight[] = []
  const usados = new Set<string>() // campo+umbral ≈ mismo mensaje
  for (const r of cand) {
    const clave = `${r.campo}|${r.op}|${r.umbral}`
    if (usados.has(clave)) continue
    usados.add(clave)
    out.push({ lead: render(r.lead, m), mark: render(r.mark, m), tail: render(r.tail, m), sub: render(r.sub, m) })
    if (out.length >= n) break
  }
  while (out.length < n) out.push(DEFAULT)
  return out
}
