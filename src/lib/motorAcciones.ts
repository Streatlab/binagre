/**
 * T-F2-12 — Motor de acciones recomendadas basado en datos ventas_plataforma
 *
 * 3 reglas según H4:
 *  1. "Pausa marca X en plataforma Y" si margen < 5% durante 4 semanas consecutivas
 *  2. "Sube precios marca X en plataforma Y" si demanda alta (pedidos ≥ P75 histórico
 *     90 días, mínimo 10 pedidos absolutos) Y margen < 15%
 *  3. "Refuerza marketing combo marca+canal ganador" si margen > 25%
 *
 * Cuando el dataset es insuficiente (<90 días), se usa la media disponible como
 * referencia (H4 fallback).
 */

import { supabase } from '@/lib/supabase'

export interface AccionRecomendada {
  tipo: 'pausa' | 'sube_precio' | 'refuerza_marketing' | 'info'
  prioridad: 'alta' | 'media' | 'baja'
  marca: string
  plataforma: string
  titulo: string
  sugerencia: string
  color: string
  margen_pct?: number
  pedidos?: number
}

interface VentaAgregada {
  marca: string
  plataforma: string
  semanas: {
    fecha_inicio: string
    bruto: number
    neto: number
    pedidos: number
    margen_pct: number
  }[]
}

const COLORES = {
  alta:  '#E24B4A',
  media: '#f5a623',
  baja:  '#1D9E75',
}

/**
 * Obtiene acciones recomendadas consultando ventas_plataforma.
 * Retorna array vacío si no hay datos suficientes (válido según spec).
 */
export async function obtenerAccionesRecomendadas(): Promise<AccionRecomendada[]> {
  const hace90 = new Date()
  hace90.setDate(hace90.getDate() - 90)
  const desde90 = hace90.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('ventas_plataforma')
    .select('marca, plataforma, fecha_inicio_periodo, bruto, neto, pedidos')
    .gte('fecha_inicio_periodo', desde90)
    .neq('marca', 'SIN_MARCA')
    .order('fecha_inicio_periodo', { ascending: true })

  if (error || !data || data.length === 0) {
    return []
  }

  // Agrupar por marca+plataforma con historial semanal
  const grupos: Record<string, VentaAgregada> = {}
  for (const row of data) {
    const key = `${row.marca}|||${row.plataforma}`
    if (!grupos[key]) {
      grupos[key] = { marca: row.marca, plataforma: row.plataforma, semanas: [] }
    }
    const margenPct = row.bruto > 0 ? (row.neto / row.bruto) * 100 : 0
    grupos[key].semanas.push({
      fecha_inicio: row.fecha_inicio_periodo,
      bruto: row.bruto,
      neto: row.neto,
      pedidos: row.pedidos ?? 0,
      margen_pct: margenPct,
    })
  }

  const acciones: AccionRecomendada[] = []
  const todosLosPedidos: number[] = []

  // Calcular percentil 75 global de pedidos (H4)
  for (const g of Object.values(grupos)) {
    for (const s of g.semanas) {
      if (s.pedidos > 0) todosLosPedidos.push(s.pedidos)
    }
  }
  todosLosPedidos.sort((a, b) => a - b)
  const p75 = todosLosPedidos.length > 0
    ? todosLosPedidos[Math.floor(todosLosPedidos.length * 0.75)]
    : 10

  for (const g of Object.values(grupos)) {
    const semanas = g.semanas
    if (semanas.length === 0) continue

    // Últimas 4 semanas disponibles
    const ultimas4 = semanas.slice(-4)
    const pedidosTotales4sem = ultimas4.reduce((a, s) => a + s.pedidos, 0)
    const margenMedio4sem = ultimas4.reduce((a, s) => a + s.margen_pct, 0) / ultimas4.length

    // ── Regla 1: Pausa si margen < 5% durante 4 semanas ──────────────────
    if (
      ultimas4.length >= 4 &&
      ultimas4.every(s => s.margen_pct < 5)
    ) {
      acciones.push({
        tipo: 'pausa',
        prioridad: 'alta',
        marca: g.marca,
        plataforma: g.plataforma,
        titulo: `Pausa ${g.marca} en ${labelPlataforma(g.plataforma)}`,
        sugerencia: `Margen medio ${margenMedio4sem.toFixed(1)}% (<5%) durante 4 semanas consecutivas. Revisar food cost y precios.`,
        color: COLORES.alta,
        margen_pct: margenMedio4sem,
        pedidos: pedidosTotales4sem,
      })
      continue  // No generar más reglas para el mismo combo
    }

    // ── Regla 2: Sube precios si demanda alta Y margen < 15% ─────────────
    const pedidosUltimaSemana = ultimas4.length > 0 ? ultimas4[ultimas4.length - 1].pedidos : 0
    const demandaAlta = pedidosUltimaSemana >= (p75 || 10) && pedidosUltimaSemana >= 10
    if (demandaAlta && margenMedio4sem < 15 && margenMedio4sem >= 0) {
      acciones.push({
        tipo: 'sube_precio',
        prioridad: 'media',
        marca: g.marca,
        plataforma: g.plataforma,
        titulo: `Sube precios ${g.marca} en ${labelPlataforma(g.plataforma)}`,
        sugerencia: `Alta demanda (${pedidosUltimaSemana} pedidos/semana, ≥P75) pero margen solo ${margenMedio4sem.toFixed(1)}%. Subida del 5-10% mantendría demanda.`,
        color: COLORES.media,
        margen_pct: margenMedio4sem,
        pedidos: pedidosUltimaSemana,
      })
    }

    // ── Regla 3: Refuerza marketing si margen > 25% ───────────────────────
    const margenReciente = ultimas4.length > 0 ? ultimas4[ultimas4.length - 1].margen_pct : 0
    if (margenReciente > 25) {
      acciones.push({
        tipo: 'refuerza_marketing',
        prioridad: 'baja',
        marca: g.marca,
        plataforma: g.plataforma,
        titulo: `Impulsa ${g.marca} en ${labelPlataforma(g.plataforma)}`,
        sugerencia: `Margen ${margenReciente.toFixed(1)}% — combo ganador. Invertir en publicidad plataforma o destacados.`,
        color: COLORES.baja,
        margen_pct: margenReciente,
        pedidos: pedidosUltimaSemana,
      })
    }
  }

  // Ordenar: alta → media → baja
  const orden = { alta: 0, media: 1, baja: 2 }
  acciones.sort((a, b) => orden[a.prioridad] - orden[b.prioridad])

  return acciones
}

function labelPlataforma(p: string): string {
  const MAP: Record<string, string> = {
    uber: 'Uber Eats',
    glovo: 'Glovo',
    just_eat: 'Just Eat',
    rushour: 'RushHour',
  }
  return MAP[p] ?? p
}
