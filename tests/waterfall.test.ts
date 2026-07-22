// Bloque D · blindaje del waterfall VIVO del Escandallo (el que ve el usuario en el
// modal de receta). Antes solo se testeaba la implementación huérfana de
// src/utils/calcWaterfall.ts; aquí se testea la cadena real:
//   eur_ud_neta por línea → coste por ración (EP y receta) → coste_mp → margen por canal.
// Si el waterfall vivo descuadra, este test bloquea el build (vitest run está en `build`).
import { describe, it, expect } from 'vitest'
import { computeWaterfall, costeRacion, norm } from '../src/utils/waterfallReceta'

const cerca = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) < tol

describe('cadena de coste: eur_ud_neta → coste_rac (EP y receta)', () => {
  it('coste_rac = Σ(cantidad · eur_ud_neta) / raciones', () => {
    const lineas = [
      { cantidad: 2, eur_ud_neta: 1.5 },   // 3.00
      { cantidad: 0.5, eur_ud_neta: 4 },   // 2.00
      { cantidad: 3, eur_ud_neta: 0.2 },   // 0.60
    ]
    // tanda = 5.60; a 4 raciones = 1.40 por ración
    expect(cerca(costeRacion(lineas, 4), 1.4)).toBe(true)
  })

  it('receta con una línea que es un EP usa el coste_rac del EP como eur_ud_neta', () => {
    const eps = [{ cantidad: 10, eur_ud_neta: 0.3 }]        // tanda 3.00
    const costeRacEps = costeRacion(eps, 6)                  // 0.50 por ración de EP
    // receta: 2 raciones de ese EP + un ingrediente
    const receta = [
      { cantidad: 1, eur_ud_neta: costeRacEps },             // 0.50
      { cantidad: 2, eur_ud_neta: 0.75 },                    // 1.50
    ]
    expect(cerca(costeRacEps, 0.5)).toBe(true)
    expect(cerca(costeRacion(receta, 1), 2.0)).toBe(true)
  })

  it('raciones 0 no revienta (devuelve 0)', () => {
    expect(costeRacion([{ cantidad: 1, eur_ud_neta: 5 }], 0)).toBe(0)
  })
})

describe('norm: acepta % como 30 o como 0.30', () => {
  it('30 → 0.30 y 0.30 → 0.30', () => {
    expect(norm(30)).toBeCloseTo(0.3, 10)
    expect(norm(0.3)).toBeCloseTo(0.3, 10)
  })
})

describe('computeWaterfall: coherencia interna (real y cash)', () => {
  const w = computeWaterfall(2, 10, 0.30, 0.20, 0.25)

  it('coste_total = coste_mp + coste_plataforma + coste_estructura (real)', () => {
    expect(cerca(w.costeTotalR, 2 + w.costePlatR + w.costeEstrR)).toBe(true)
  })
  it('coste_total = coste_mp + coste_plataforma + coste_estructura (cash)', () => {
    expect(cerca(w.costeTotalC, 2 + w.costePlatC + w.costeEstrC)).toBe(true)
  })
  it('margen = pvp − coste_total y margen% = margen/pvp·100 (real y cash)', () => {
    expect(cerca(w.margenR, 10 - w.costeTotalR)).toBe(true)
    expect(cerca(w.margenPctR, (w.margenR / 10) * 100)).toBe(true)
    expect(cerca(w.margenC, 10 - w.costeTotalC)).toBe(true)
    expect(cerca(w.margenPctC, (w.margenC / 10) * 100)).toBe(true)
  })
  it('la comisión "real" lleva IVA (×1,21) y por tanto cuesta más que "cash"', () => {
    expect(cerca(w.costePlatR, w.costePlatC * 1.21)).toBe(true)
    expect(w.costePlatR).toBeGreaterThan(w.costePlatC)
    expect(w.margenR).toBeLessThan(w.margenC)
  })
  it('estructura se aplica sobre el ingreso neto (pvp − comisión), no sobre el pvp bruto', () => {
    expect(cerca(w.costeEstrR, (10 - w.costePlatR) * 0.20)).toBe(true)
    expect(cerca(w.costeEstrC, (10 - w.costePlatC) * 0.20)).toBe(true)
  })
  it('factor_k = pvp / coste_mp', () => {
    expect(cerca(w.factorK, 10 / 2)).toBe(true)
  })
})

describe('computeWaterfall: determinismo y bordes', () => {
  it('misma entrada → misma salida', () => {
    expect(computeWaterfall(2, 10, 0.3, 0.2, 0.25)).toEqual(computeWaterfall(2, 10, 0.3, 0.2, 0.25))
  })
  it('pvp 0 no revienta (márgenes y factor a 0)', () => {
    const w0 = computeWaterfall(2, 0, 0.3, 0.2, 0.25)
    expect(w0.margenPctR).toBe(0)
    expect(w0.factorK).toBe(0)
  })
  it('pvp recomendado real: al facturar a ese PVP, el margen NO baja del deseado', () => {
    // pvpRecR asume estructura sobre el PVP bruto; la estructura real se aplica sobre el
    // ingreso neto (menor) → el margen a pvpRecR queda IGUAL O POR ENCIMA del 25% deseado.
    const base = computeWaterfall(2, 0, 0.30, 0.20, 0.25)
    const aRec = computeWaterfall(2, base.pvpRecR, 0.30, 0.20, 0.25)
    expect(aRec.margenPctR).toBeGreaterThanOrEqual(25 - 1e-6)
  })
})
