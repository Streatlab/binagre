import { describe, it, expect } from 'vitest'
import { normalizarImporte, normalizarFecha, numeroFacturaValido } from '../api/_lib/extractores'

describe('normalizarImporte (task 5) — 20+ variantes', () => {
  const casos: Array<[string | number | null | undefined, number | null]> = [
    ['1.234,56', 1234.56],       // es_ES: miles punto, decimal coma
    ['1234,56', 1234.56],
    ['1234.56', 1234.56],        // en_US: decimal punto
    ['1,234.56', 1234.56],       // en_US: miles coma, decimal punto
    ['1.234.567,89', 1234567.89],
    ['1,234,567.89', 1234567.89],
    ['123,45 €', 123.45],
    ['€ 123,45', 123.45],
    ['123,45€', 123.45],
    ['1.234,56 EUR', 1234.56],
    ['12,50 euros', 12.50],
    ['1 234,56', 1234.56],  // NBSP como separador de miles
    ['1 234,56', 1234.56],  // espacio fino
    ['0,00', 0],
    ['0', 0],
    ['5', 5],
    ['1.234', 1234],             // punto solo + 3 dígitos → miles (es_ES)
    ['12.5', 12.5],              // punto solo + 1 decimal → decimal
    ['12.50', 12.50],
    ['0,1234', 0.1234],          // 4 decimales
    ['-45,90', -45.90],
    ['1.500,00 €', 1500],
    ['3,14', 3.14],
    [1234.56, 1234.56],
    ['', null],
    ['abc', null],
    [null, null],
    [undefined, null],
  ]
  for (const [entrada, esperado] of casos) {
    it(`${JSON.stringify(entrada)} → ${esperado}`, () => {
      const r = normalizarImporte(entrada)
      if (esperado === null) expect(r).toBeNull()
      else expect(r).toBeCloseTo(esperado as number, 4)
    })
  }
})

describe('normalizarFecha (task 5)', () => {
  const casos: Array<[string, string | null]> = [
    ['05/01/2026', '2026-01-05'],
    ['5/1/2026', '2026-01-05'],
    ['05-01-2026', '2026-01-05'],
    ['05.01.2026', '2026-01-05'],
    ['2026-01-05', '2026-01-05'],
    ['05-01-26', '2026-01-05'],
    ['5 de enero de 2026', '2026-01-05'],
    ['31 enero 2026', '2026-01-31'],
    ['5 de marzo de 2026', '2026-03-05'],
    ['32/01/2026', null],   // día inválido
    ['05/13/2026', null],   // mes inválido
    ['hola', null],
  ]
  for (const [entrada, esperado] of casos) {
    it(`${entrada} → ${esperado}`, () => {
      expect(normalizarFecha(entrada)).toBe(esperado)
    })
  }
})

describe('numeroFacturaValido (task 4)', () => {
  it('rechaza palabras de lista negra', () => {
    for (const p of ['courier', 'Hora', 'TOTAL', 'Motivo', 'Fecha', 'importe', 'IVA', 'base', 'unidades']) {
      expect(numeroFacturaValido(p)).toBe(false)
    }
  })
  it('rechaza fechas puras', () => {
    expect(numeroFacturaValido('05/01/2026')).toBe(false)
    expect(numeroFacturaValido('2026-01-05')).toBe(false)
  })
  it('rechaza valores sin dígitos', () => {
    expect(numeroFacturaValido('ABCDEF')).toBe(false)
  })
  it('rechaza vacío/nulo/corto', () => {
    expect(numeroFacturaValido('')).toBe(false)
    expect(numeroFacturaValido(null)).toBe(false)
    expect(numeroFacturaValido('A1')).toBe(false)
  })
  it('acepta números de factura reales', () => {
    for (const p of ['F-2026-001', 'FA0001234', '2026/A/45', 'INV-99887', 'ABC123', 'A-1234']) {
      expect(numeroFacturaValido(p)).toBe(true)
    }
  })
})
