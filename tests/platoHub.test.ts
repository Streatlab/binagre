// LEY-PLATO-01 + Bloque 2 (Hoy) · lógica pura del hub de platos.
import { describe, it, expect } from 'vitest'
import {
  requiereReceta, resolverCandidato, vinculoTargets, sugerirReceta,
  computeHoyKpis, buildTareasHoy,
} from '../src/lib/cocina/platoHub'

describe('LEY-PLATO-01 · bebida/extra/promo nunca pide receta', () => {
  it('es_extra=true no requiere receta', () => {
    expect(requiereReceta({ es_extra: true })).toBe(false)
  })
  it('tipo_linea bebida/extra/promo/agua no requiere receta', () => {
    for (const t of ['bebida', 'extra', 'promo', 'agua', 'BEBIDA', ' Extra '])
      expect(requiereReceta({ tipo_linea: t })).toBe(false)
  })
  it('un plato normal sí requiere receta', () => {
    expect(requiereReceta({ tipo_linea: 'plato' })).toBe(true)
    expect(requiereReceta({})).toBe(true)
  })
})

describe('LEY-PLATO-01 · candidato único se casa, ambiguo va a cola, cero crea', () => {
  it('candidato único → se casa, no cola', () => {
    expect(resolverCandidato([7])).toEqual({ maestroId: 7, aCola: false })
  })
  it('candidato único repetido → sigue siendo único', () => {
    expect(resolverCandidato([7, 7, 7])).toEqual({ maestroId: 7, aCola: false })
  })
  it('ambiguo (>1 distinto) → NADA se casa y va a la cola', () => {
    const r = resolverCandidato([7, 9])
    expect(r.maestroId).toBe(null)
    expect(r.aCola).toBe(true)
    expect(r.motivo).toBeTruthy()
  })
  it('cero candidatos → ni casa ni cola (se creará maestro)', () => {
    expect(resolverCandidato([])).toEqual({ maestroId: null, aCola: false })
  })
})

describe('LEY-PLATO-01 · un vínculo actualiza análisis y Carta a la vez', () => {
  it('vinculoTargets incluye las tres tablas (maestro + mapeo/análisis + carta)', () => {
    const t = vinculoTargets()
    expect(t).toContain('platos_maestros')
    expect(t).toContain('mapeo_plato_receta') // análisis / Pareto / Coste por plato
    expect(t).toContain('carta_platos')       // Carta
  })
})

describe('LEY-PLATO-01 · auto-propuesta por nombre (sin autovincular)', () => {
  const recetas = [{ id: 'a', nombre: 'Croquetas de jamón' }, { id: 'b', nombre: 'Ramen the Warriors' }]
  it('nombre exacto normalizado → score 1', () => {
    expect(sugerirReceta('croquetas de jamon', recetas)?.recetaId).toBe('a')
  })
  it('sin parecido → null (no inventa vínculo)', () => {
    expect(sugerirReceta('Tarta de queso', recetas)).toBe(null)
  })
})

describe('Bloque 2 · Hoy: KPIs no rompen con datos vacíos', () => {
  it('sin platos → todo a 0, sin excepción', () => {
    const k = computeHoyKpis({ platos: [] })
    expect(k).toEqual({ pctConCoste: 0, foodCostMedio: 0, eurosPorEscribir: 0, alertasPrecio: 0 })
  })
  it('% con coste y € por escribir salen de las ventas', () => {
    const k = computeHoyKpis({ platos: [
      { euros: 100, receta_id: 'r1', foodCostPct: 30 },
      { euros: 100, receta_id: null },
      { euros: 50, es_extra: true, receta_id: null }, // bebida: no cuenta
    ], alertasPrecio: 3 })
    expect(k.pctConCoste).toBeCloseTo(50, 6)        // 100 de 200
    expect(k.eurosPorEscribir).toBe(100)
    expect(k.foodCostMedio).toBeCloseTo(30, 6)
    expect(k.alertasPrecio).toBe(3)
  })
})

describe('Bloque 2 · Hoy: tareas ordenadas por € y en cristiano', () => {
  it('lista vacía → []', () => {
    expect(buildTareasHoy({ platos: [] })).toEqual([])
  })
  it('ordena por euros desc y marca tipo vincular/confirmar', () => {
    const t = buildTareasHoy({ platos: [
      { id: 1, nombre: 'Poke', euros: 50, receta_id: null },
      { id: 2, nombre: 'Ramen', euros: 300, receta_id: null, sugerencia: { recetaId: 'x', nombre: 'Ramen', score: 1 } },
      { id: 3, nombre: 'Agua', euros: 999, es_extra: true, receta_id: null }, // no genera tarea
    ] })
    expect(t.map(x => x.maestroId)).toEqual([2, 1])
    expect(t[0].tipo).toBe('confirmar')
    expect(t[1].tipo).toBe('vincular')
  })
  it('food cost implausible genera tarea de revisión', () => {
    const t = buildTareasHoy({ platos: [{ id: 9, nombre: 'X', euros: 10, receta_id: 'r', foodCostPct: 55 }] })
    expect(t[0].tipo).toBe('foodcost')
  })
})
