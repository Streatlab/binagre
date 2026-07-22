// Pieza 4 (Plato maestro) · cola priorizada por euros de Coste por plato.
// 4a/4b: un alta de receta por plato maestro cierra de golpe todos sus alias.
// 4d: bebidas y extras quedan fuera de la cola pero no se borran (siguen en informes de ventas,
// que leen de tablas independientes — aquí solo se blinda que la cola las descarta).
import { describe, it, expect } from 'vitest'
import { esCandidataACola, agruparColaPendientes, formatoCierreAlta, type FilaColaPendiente } from '../src/utils/colaRecetasPendientes'

describe('esCandidataACola — qué tipo_linea entra en la cola de escandallo', () => {
  it('plato entra', () => { expect(esCandidataACola('plato')).toBe(true) })
  it('ruido queda fuera', () => { expect(esCandidataACola('ruido')).toBe(false) })
  it('bebida queda fuera de la cola (pero no se borra en Supabase)', () => { expect(esCandidataACola('bebida')).toBe(false) })
  it('extra queda fuera de la cola (pero no se borra en Supabase)', () => { expect(esCandidataACola('extra')).toBe(false) })
  it('sin tipo_linea (null/undefined) no cuela', () => {
    expect(esCandidataACola(null)).toBe(false)
    expect(esCandidataACola(undefined)).toBe(false)
  })
})

describe('agruparColaPendientes — 4a/4b: agrupación por plato maestro', () => {
  const nombrePorMaestro = new Map<number, string>([[1, 'Salmorejo']])

  it('varias filas del mismo maestro se agregan en un único grupo (un alta cubre varios nombres)', () => {
    const filas: FilaColaPendiente[] = [
      { id: 10, plato_norm: 'salmorejo cordobes', plato_muestra: 'Salmorejo cordobés', receta_id: null, maestro_id: 1, euros: 500, unidades: 40, tipo_linea: 'plato' },
      { id: 11, plato_norm: 'salmorejo con jamon y huevo', plato_muestra: 'Salmorejo con jamón y huevo', receta_id: null, maestro_id: 1, euros: 400, unidades: 30, tipo_linea: 'plato' },
      { id: 12, plato_norm: 'un salmorejito rico', plato_muestra: 'Un salmorejito rico', receta_id: null, maestro_id: 1, euros: 166, unidades: 12, tipo_linea: 'plato' },
    ]
    const grupos = agruparColaPendientes(filas, nombrePorMaestro)
    expect(grupos).toHaveLength(1)
    expect(grupos[0].nombre).toBe('Salmorejo')
    expect(grupos[0].nNombres).toBe(3)
    expect(grupos[0].euros).toBe(1066)
    expect(grupos[0].maestroId).toBe(1)
    expect(grupos[0].mapeoIdSolo).toBeNull()
    expect(formatoCierreAlta(grupos[0])).toBe('Salmorejo: 3 nombres, 1.066 €')
  })

  it('fila sin maestro forma su propio grupo de 1 nombre, enlazable directo por su id de mapeo', () => {
    const filas: FilaColaPendiente[] = [
      { id: 99, plato_norm: 'katsudon', plato_muestra: 'Katsudon', receta_id: null, maestro_id: null, euros: 200, unidades: 10, tipo_linea: 'plato' },
    ]
    const grupos = agruparColaPendientes(filas, nombrePorMaestro)
    expect(grupos).toHaveLength(1)
    expect(grupos[0].nombre).toBe('Katsudon')
    expect(grupos[0].nNombres).toBe(1)
    expect(grupos[0].maestroId).toBeNull()
    expect(grupos[0].mapeoIdSolo).toBe(99)
  })

  it('ordena de más a menos euros', () => {
    const filas: FilaColaPendiente[] = [
      { id: 1, plato_norm: 'a', plato_muestra: 'A', receta_id: null, maestro_id: null, euros: 50, unidades: 1, tipo_linea: 'plato' },
      { id: 2, plato_norm: 'b', plato_muestra: 'B', receta_id: null, maestro_id: null, euros: 500, unidades: 1, tipo_linea: 'plato' },
    ]
    const grupos = agruparColaPendientes(filas, nombrePorMaestro)
    expect(grupos.map(g => g.nombre)).toEqual(['B', 'A'])
  })

  it('un plato maestro que YA tiene receta (receta_id resuelto) no entra en la cola', () => {
    const filas: FilaColaPendiente[] = [
      { id: 20, plato_norm: 'lasagna', plato_muestra: 'Lasagna', receta_id: 'uuid-ya-tiene', maestro_id: 5, euros: 300, unidades: 20, tipo_linea: 'plato' },
    ]
    expect(agruparColaPendientes(filas, nombrePorMaestro)).toHaveLength(0)
  })

  it('4d: filas marcadas bebida/extra/ruido no contaminan la cola aunque no tengan receta', () => {
    const filas: FilaColaPendiente[] = [
      { id: 30, plato_norm: 'cerveza estrella de galicia', plato_muestra: 'Cerveza Estrella de Galicia', receta_id: null, maestro_id: null, euros: 36.1, unidades: 11, tipo_linea: 'bebida' },
      { id: 31, plato_norm: 'alioli', plato_muestra: 'Alioli', receta_id: null, maestro_id: null, euros: 26.15, unidades: 27, tipo_linea: 'extra' },
      { id: 32, plato_norm: 'gastos de envio', plato_muestra: 'Gastos de envío', receta_id: null, maestro_id: null, euros: 12, unidades: 5, tipo_linea: 'ruido' },
      { id: 33, plato_norm: 'katsudon', plato_muestra: 'Katsudon', receta_id: null, maestro_id: null, euros: 200, unidades: 10, tipo_linea: 'plato' },
    ]
    const grupos = agruparColaPendientes(filas, nombrePorMaestro)
    expect(grupos).toHaveLength(1)
    expect(grupos[0].nombre).toBe('Katsudon')
  })
})
