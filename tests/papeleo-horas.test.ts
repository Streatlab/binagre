import { describe, it, expect } from 'vitest'
import { HORAS_FIJAS, BANDAS_PROHIBIDAS, bandaQueChoca, proximaOcurrencia } from '../src/lib/papeleoHoras'

describe('bandaQueChoca — regla PROHIBIDO horas de robots (Prompt Papeleo)', () => {
  it('las 4 horas fijas ofrecidas nunca caen en banda prohibida', () => {
    for (const h of HORAS_FIJAS) {
      expect(bandaQueChoca(h), `la hora fija ${h} no debe chocar`).toBeNull()
    }
  })

  it('una hora dentro de cada banda choca con su motivo', () => {
    expect(bandaQueChoca('02:00')).toBe('verificación nocturna')
    expect(bandaQueChoca('05:30')).toBe('robots, cartero e informes')
    expect(bandaQueChoca('15:00')).toBe('corte de turno')
    expect(bandaQueChoca('22:00')).toBe('corte de turno y WhatsApp')
  })

  it('los bordes exactos de cada banda están incluidos (rango cerrado)', () => {
    for (const b of BANDAS_PROHIBIDAS) {
      expect(bandaQueChoca(b.desde), `borde inicial ${b.desde}`).toBe(b.motivo)
      expect(bandaQueChoca(b.hasta), `borde final ${b.hasta}`).toBe(b.motivo)
    }
  })

  it('un minuto fuera de cada banda ya es válido', () => {
    expect(bandaQueChoca('01:49')).toBeNull() // justo antes de 01:50
    expect(bandaQueChoca('07:16')).toBeNull() // justo después de 07:15
    expect(bandaQueChoca('14:14')).toBeNull()
    expect(bandaQueChoca('22:46')).toBeNull()
  })

  it('rechaza formatos inválidos', () => {
    expect(bandaQueChoca('25:00')).toBe('formato de hora inválido')
    expect(bandaQueChoca('9:30')).toBe('formato de hora inválido')
    expect(bandaQueChoca('')).toBe('formato de hora inválido')
    expect(bandaQueChoca('abc')).toBe('formato de hora inválido')
  })
})

describe('proximaOcurrencia — hoy si no ha pasado, si no mañana', () => {
  it('si la hora aún no ha pasado hoy, la programa hoy', () => {
    const ahora = new Date(2026, 6, 21, 10, 0, 0) // 21-jul 10:00
    const d = proximaOcurrencia('13:00', ahora)
    expect(d.getDate()).toBe(21)
    expect(d.getHours()).toBe(13)
    expect(d.getMinutes()).toBe(0)
  })

  it('si la hora ya pasó hoy, la programa mañana', () => {
    const ahora = new Date(2026, 6, 21, 14, 0, 0) // 21-jul 14:00
    const d = proximaOcurrencia('13:00', ahora)
    expect(d.getDate()).toBe(22)
    expect(d.getHours()).toBe(13)
  })

  it('la misma hora exacta se considera pasada → mañana', () => {
    const ahora = new Date(2026, 6, 21, 11, 0, 0)
    const d = proximaOcurrencia('11:00', ahora)
    expect(d.getDate()).toBe(22)
  })
})
