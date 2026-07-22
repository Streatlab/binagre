/**
 * objetivoVsReal — motor ÚNICO de "objetivo vs real" (Bloque D · punto 7).
 * Antes el cálculo (pct, falta, semáforo) estaba duplicado en Finanzas › Objetivos
 * y en las tarjetas de Ventas/Analítica. Ahora hay una sola función y el resto la llama.
 *
 * `pct` es crudo (sin redondear ni capar): cada consumidor decide cómo mostrarlo.
 */
export interface ObjetivoReal {
  pct: number        // real/objetivo*100 · 0 si objetivo<=0
  pctCap: number     // pct limitado a [0,100] para barras de progreso
  falta: number      // lo que queda para llegar · 0 si ya se superó
  excedente: number  // lo que sobra por encima del objetivo · 0 si no se llegó
  cumple: boolean    // real >= objetivo (con objetivo > 0)
}

export function objetivoVsReal(real: number, objetivo: number): ObjetivoReal {
  const r = Number.isFinite(real) ? real : 0
  const o = Number.isFinite(objetivo) ? objetivo : 0
  if (o <= 0) {
    return { pct: 0, pctCap: 0, falta: 0, excedente: Math.max(0, r), cumple: false }
  }
  const pct = (r / o) * 100
  return {
    pct,
    pctCap: Math.max(0, Math.min(100, pct)),
    falta: Math.max(0, o - r),
    excedente: Math.max(0, r - o),
    cumple: r >= o,
  }
}
