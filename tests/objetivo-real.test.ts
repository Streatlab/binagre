import { describe, it, expect } from 'vitest'
import { objetivoVsReal } from '../src/lib/objetivoReal'

describe('Bloque D · motor único objetivo vs real (punto 7)', () => {
  it('objetivo 0 o negativo → pct 0, sin dividir por cero', () => {
    expect(objetivoVsReal(500, 0)).toEqual({ pct: 0, pctCap: 0, falta: 0, excedente: 500, cumple: false })
    expect(objetivoVsReal(0, 0).pct).toBe(0)
  })

  it('a mitad de camino', () => {
    const r = objetivoVsReal(500, 1000)
    expect(r.pct).toBe(50)
    expect(r.pctCap).toBe(50)
    expect(r.falta).toBe(500)
    expect(r.excedente).toBe(0)
    expect(r.cumple).toBe(false)
  })

  it('objetivo cumplido exacto', () => {
    const r = objetivoVsReal(1000, 1000)
    expect(r.pct).toBe(100)
    expect(r.falta).toBe(0)
    expect(r.cumple).toBe(true)
  })

  it('objetivo superado → pctCap tope 100, excedente positivo, falta 0', () => {
    const r = objetivoVsReal(1500, 1000)
    expect(r.pct).toBe(150)
    expect(r.pctCap).toBe(100)
    expect(r.falta).toBe(0)
    expect(r.excedente).toBe(500)
    expect(r.cumple).toBe(true)
  })

  it('valores no finitos no rompen', () => {
    expect(objetivoVsReal(NaN, 1000).pct).toBe(0)
    expect(objetivoVsReal(500, NaN).pct).toBe(0)
  })
})
