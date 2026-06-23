/**
 * Batería de frases-insight del Panel Global.
 * Reglas evaluables sobre las métricas del periodo: la fórmula recorre las
 * reglas por prioridad y devuelve la primera que cumple condición, con su
 * texto (lead + destacado + cola + subtítulo). Pensado para migrar a una tabla
 * Supabase (frases_insight) más adelante sin tocar la UI: misma forma de datos.
 */

export interface MetricasInsight {
  comisionPct: number
  webPct: number
  margenNetoPct: number
  variacionVentas: number | null
  primeCostPct: number
  ratioActual: number
  ratioObjetivo: number
  pePctProgreso: number
  ebitda: number
  faltaPE: number
}

export interface FraseInsight { lead: string; mark: string; tail: string; sub: string }

const e0 = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €'
const p0 = (n: number) => Math.round(Number.isFinite(n) ? n : 0) + '%'

interface Regla { id: string; prio: number; test: (m: MetricasInsight) => boolean; make: (m: MetricasInsight) => FraseInsight }

const REGLAS: Regla[] = [
  {
    id: 'comision_alta', prio: 100,
    test: m => m.comisionPct >= 35,
    make: m => ({ lead: 'Las comisiones se llevan', mark: p0(m.comisionPct), tail: 'de lo que vendes.', sub: `Tu web trae el ${p0(m.webPct)}. Cada cliente que vuelve por la web es comida que cobras entera, sin comisión de plataforma.` }),
  },
  {
    id: 'prime_alto', prio: 95,
    test: m => m.primeCostPct > 65,
    make: m => ({ lead: 'Tu prime cost está en', mark: p0(m.primeCostPct), tail: 'de lo que ingresas.', sub: 'Por encima del 60% objetivo: vigila food cost y horas de cocina.' }),
  },
  {
    id: 'caida', prio: 90,
    test: m => m.variacionVentas != null && m.variacionVentas < -3,
    make: m => ({ lead: 'Estás', mark: (m.variacionVentas! >= 0 ? '+' : '') + m.variacionVentas!.toFixed(1) + '%', tail: 'bajo tu media.', sub: 'Revisa qué canal ha bajado y reacciona esta semana.' }),
  },
  {
    id: 'pe_lejos', prio: 80,
    test: m => m.faltaPE > 0 && m.pePctProgreso < 80,
    make: m => ({ lead: 'Para cubrir gastos te faltan', mark: e0(m.faltaPE), tail: 'este mes.', sub: `Vas al ${p0(m.pePctProgreso)} del punto de equilibrio.` }),
  },
  {
    id: 'ratio_bajo', prio: 70,
    test: m => m.ratioObjetivo > 0 && m.ratioActual < m.ratioObjetivo,
    make: m => ({ lead: 'Ganas', mark: (Number.isFinite(m.ratioActual) ? m.ratioActual : 0).toFixed(2) + '×', tail: 'lo que gastas.', sub: `Por debajo de tu objetivo de ${m.ratioObjetivo.toFixed(2)}×. Sube ventas o recorta gasto fijo.` }),
  },
  {
    id: 'web_baja', prio: 60,
    test: m => m.webPct < 10,
    make: m => ({ lead: 'Tu web solo trae', mark: p0(m.webPct), tail: 'de las ventas.', sub: 'Ese es el canal sin comisión: cada punto que sube va directo a tu margen.' }),
  },
  {
    id: 'subida', prio: 50,
    test: m => m.variacionVentas != null && m.variacionVentas > 8,
    make: m => ({ lead: 'Vas', mark: '+' + m.variacionVentas!.toFixed(1) + '%', tail: 'sobre tu media.', sub: 'Buen ritmo. Mantén el empuje en los canales que más tiran.' }),
  },
  {
    id: 'default', prio: 0,
    test: () => true,
    make: m => ({ lead: m.ebitda >= 0 ? 'Hoy dejas' : 'Hoy pierdes', mark: e0(Math.abs(m.ebitda)), tail: m.ebitda >= 0 ? 'limpios.' : 'en el periodo.', sub: m.ebitda >= 0 ? 'Comer bien también deja margen.' : 'Revisa costes: el periodo está en negativo.' }),
  },
]

export function elegirFrase(m: MetricasInsight): FraseInsight {
  const ganadora = [...REGLAS].sort((a, b) => b.prio - a.prio).find(r => r.test(m)) ?? REGLAS[REGLAS.length - 1]
  return ganadora.make(m)
}
