import { describe, it, expect } from 'vitest'
import { fmtEur, fmtNumES, fmtPct } from '../src/utils/format'
import { calcWaterfall, type ConfigCanal } from '../src/utils/calcWaterfall'

// Tests de humo: protegen las cuentas que mueven dinero.
// Si un cambio rompe el formato del euro o el calculo de margen, el build falla
// y la version mala NO se publica.

describe('formato dinero', () => {
  it('fmtEur miles y decimales', () => {
    expect(fmtEur(1234.5)).toBe('1.234,50 €')
    expect(fmtEur(0)).toBe('0,00 €')
    expect(fmtEur(null)).toBe('')
  })
  it('fmtNumES y fmtPct', () => {
    expect(fmtNumES(1000)).toBe('1.000')
    expect(fmtPct(0.15)).toBe('15,00%')
  })
})

describe('waterfall margenes', () => {
  const canal: ConfigCanal = {
    nombre: 'uber', comision_pct: 0.30, comision_pct_prime: 0.14,
    estructura_pct: 0.10, margen_deseado_pct: 0.20,
    pct_pedidos_prime: 0.5, pct_pedidos_promo: 0.2,
    fee_prime_eur: 0.5, fee_promo_eur: 0.3, fijo_eur: 0.2,
  }
  const r = calcWaterfall(3, 12, canal)
  it('coste_total = mp + estructura + plataforma', () => {
    const f = r.real
    expect(Math.abs(f.coste_total - (f.coste_mp + f.coste_estructura + f.coste_plataforma))).toBeLessThan(0.01)
  })
  it('margen_eur = pvp - coste_total', () => {
    const f = r.real
    expect(Math.abs(f.margen_eur - (f.pvp_real - f.coste_total))).toBeLessThan(0.01)
  })
  it('pvp_recomendado positivo y comision con IVA mayor que sin IVA', () => {
    expect(r.real.pvp_recomendado).toBeGreaterThan(0)
    expect(r.real.coste_plataforma).toBeGreaterThan(r.cash.coste_plataforma)
  })
})
