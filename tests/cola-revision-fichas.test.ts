// Pieza 3 (Plato maestro) · cola de revisión manual de fichas huérfanas en Libro de Recetas.
// Blinda el criterio anti-pisado que replica fn_enlazar_ficha_huerfana (Supabase): al enlazar
// una ficha huérfana con su candidato, un campo del candidato que YA tiene dato nunca se
// sobrescribe, sea lo que sea que traiga la ficha huérfana. Solo se rellenan huecos vacíos.
import { describe, it, expect } from 'vitest'
import { campoAporta } from '../src/utils/fichasHuerfanas'

describe('campoAporta — anti-pisado al enlazar ficha huérfana con su candidato', () => {
  it('candidato con campo lleno y huérfana también llena: el candidato NO se pisa', () => {
    const r = campoAporta(true, true)
    expect(r.tono).toBe('ok')
    expect(r.texto).toBe('ya lo tiene')
  })

  it('candidato con campo lleno y huérfana vacía: el candidato tampoco se toca', () => {
    const r = campoAporta(false, true)
    expect(r.tono).toBe('ok')
    expect(r.texto).toBe('ya lo tiene')
  })

  it('candidato vacío y huérfana con dato: el candidato se completa desde la huérfana', () => {
    const r = campoAporta(true, false)
    expect(r.tono).toBe('gana')
    expect(r.texto).toBe('lo gana de esta ficha')
  })

  it('candidato vacío y huérfana vacía: no hay nada que mover', () => {
    const r = campoAporta(false, false)
    expect(r.tono).toBe('sin')
    expect(r.texto).toBe('sin dato')
  })
})
