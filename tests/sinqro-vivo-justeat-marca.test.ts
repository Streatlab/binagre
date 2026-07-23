// Desglose por marca de Just Eat en sinqro-vivo (v4). Cubre sobre todo el
// fallback obligatorio: si algún pedido del lote no resuelve marca, el
// conjunto ENTERO debe caer al agregado — nunca se pierde importe ni se
// mezcla desglose parcial con agregado, nunca se inventa una marca.
import { describe, it, expect } from 'vitest'
import {
  idDeHref, marcaEnTexto, cacheDesdeHistorico, agruparPorMarca, mismoConjuntoJE,
} from '../scripts/robot-ingesta/_lib/justEatMarca'

describe('idDeHref', () => {
  it('extrae el id numérico de un href de detalle de pedido', () => {
    expect(idDeHref('#/sp/6416/online/orders/88582614')).toBe('88582614')
    expect(idDeHref('https://app.sinqro.com/#/sp/6416/online/orders/123')).toBe('123')
  })
  it('null si no reconoce el patrón', () => {
    expect(idDeHref('#/sp/6416/online/pedidos')).toBeNull()
    expect(idDeHref(null)).toBeNull()
    expect(idDeHref(undefined)).toBeNull()
  })
})

describe('marcaEnTexto', () => {
  const candidatas = ['Binagre', 'Streat Lab', 'Black Label by Streat Lab', 'NINJA Ramen']
  it('encuentra la marca que aparece en el texto (case-insensitive)', () => {
    expect(marcaEnTexto('Pedido de binagre — 2x arroz', candidatas)).toBe('Binagre')
  })
  it('prioriza el nombre más largo/específico sobre un substring suyo', () => {
    const texto = 'Marca: Black Label by Streat Lab — cliente Juan'
    expect(marcaEnTexto(texto, candidatas)).toBe('Black Label by Streat Lab')
  })
  it('null si ninguna marca conocida aparece', () => {
    expect(marcaEnTexto('Pedido #123, cliente anónimo, 12,50€', candidatas)).toBeNull()
  })
  it('null con texto vacío', () => {
    expect(marcaEnTexto('', candidatas)).toBeNull()
  })
})

describe('agruparPorMarca — todo o nada', () => {
  it('agrupa pedidos y suma importes por marca cuando TODOS resuelven', () => {
    const marcaDeId = (id: string) => ({ '1': 'Binagre', '2': 'Binagre', '3': 'NINJA Ramen' }[id] ?? null)
    const r = agruparPorMarca(
      [{ id: '1', importe: 10 }, { id: '2', importe: 5.5 }, { id: '3', importe: 20 }],
      marcaDeId,
    )
    expect(r.resuelto).toBe(true)
    if (!r.resuelto) throw new Error('esperaba resuelto')
    const porMarca = Object.fromEntries(r.lineas.map((l) => [l.marca, l]))
    expect(porMarca['Binagre']).toEqual({ marca: 'Binagre', pedidos: 2, bruto: 15.5, ids: ['1', '2'] })
    expect(porMarca['NINJA Ramen']).toEqual({ marca: 'NINJA Ramen', pedidos: 1, bruto: 20, ids: ['3'] })
  })

  it('FALLBACK: si un pedido no tiene id, el lote entero cae a fallback (no pierde el resto)', () => {
    const marcaDeId = (id: string) => ({ '1': 'Binagre' }[id] ?? null)
    const r = agruparPorMarca(
      [{ id: '1', importe: 10 }, { id: null, importe: 7.25 }],
      marcaDeId,
    )
    expect(r.resuelto).toBe(false)
    if (r.resuelto) throw new Error('esperaba fallback')
    expect(r.motivo).toMatch(/sin id/)
  })

  it('FALLBACK: si un pedido no resuelve marca en el detalle, el lote entero cae a fallback', () => {
    const marcaDeId = (id: string) => ({ '1': 'Binagre' }[id] ?? null) // '2' no resuelve
    const r = agruparPorMarca(
      [{ id: '1', importe: 10 }, { id: '2', importe: 3.4 }],
      marcaDeId,
    )
    expect(r.resuelto).toBe(false)
    if (r.resuelto) throw new Error('esperaba fallback')
    expect(r.motivo).toMatch(/pedido 2/)
  })

  it('lote vacío resuelve con 0 líneas (no hay pedidos JE que agrupar)', () => {
    const r = agruparPorMarca([], () => null)
    expect(r).toEqual({ resuelto: true, lineas: [] })
  })
})

describe('cacheDesdeHistorico', () => {
  it('solo cuenta filas con crudo.resuelto=true y pedidos_ids array', () => {
    const filas = [
      { marca: 'Binagre', crudo: { resuelto: true, pedidos_ids: ['1', '2'] } },
      { marca: 'NINJA Ramen', crudo: { resuelto: true, pedidos_ids: ['3'] } },
      // fila de fallback: NO debe aportar caché (no sabemos a qué pedidos corresponde)
      { marca: 'Streat Lab', crudo: { resuelto: false, motivo: 'x' } },
      // fila legacy v3 sin resuelto: tampoco aporta caché
      { marca: 'Streat Lab', crudo: { origen: 'sinqro_vivo_v3' } },
    ]
    const cache = cacheDesdeHistorico(filas)
    expect(cache.get('1')).toBe('Binagre')
    expect(cache.get('2')).toBe('Binagre')
    expect(cache.get('3')).toBe('NINJA Ramen')
    expect(cache.size).toBe(3)
  })

  it('tolera crudo null/no-objeto sin reventar', () => {
    expect(cacheDesdeHistorico([{ marca: 'X', crudo: null }]).size).toBe(0)
    expect(cacheDesdeHistorico([{ marca: 'X', crudo: 'no-es-objeto' }]).size).toBe(0)
  })
})

describe('mismoConjuntoJE', () => {
  it('true si mismo conjunto marca/pedidos/facturación (sin importar el orden)', () => {
    const a = [{ marca: 'Binagre', pedidos: 2, facturacion: 15.5 }, { marca: 'NINJA Ramen', pedidos: 1, facturacion: 20 }]
    const b = [{ marca: 'NINJA Ramen', pedidos: 1, facturacion: 20 }, { marca: 'Binagre', pedidos: 2, facturacion: 15.5 }]
    expect(mismoConjuntoJE(a, b)).toBe(true)
  })
  it('false si cambia el nº de filas (p.ej. pasa de agregado a desglosado)', () => {
    const a = [{ marca: 'Streat Lab', pedidos: 3, facturacion: 35.5 }]
    const b = [{ marca: 'Binagre', pedidos: 2, facturacion: 15.5 }, { marca: 'NINJA Ramen', pedidos: 1, facturacion: 20 }]
    expect(mismoConjuntoJE(a, b)).toBe(false)
  })
  it('false si cambia el importe de una marca', () => {
    const a = [{ marca: 'Binagre', pedidos: 2, facturacion: 15.5 }]
    const b = [{ marca: 'Binagre', pedidos: 2, facturacion: 16.5 }]
    expect(mismoConjuntoJE(a, b)).toBe(false)
  })
})
