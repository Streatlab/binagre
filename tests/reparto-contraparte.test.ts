import { describe, it, expect } from 'vitest'
import { decidirDestinos } from '../api/_lib/repartirDatos'
import { resolverContraparte } from '../api/_lib/resolverContraparte'

describe('decidirDestinos (Prompt 2 task 3)', () => {
  it('separa cubiertos / pendientes / desconocidos', () => {
    const r = decidirDestinos(['Gestoria', 'OCR', 'Conciliacion', 'Running', 'Facturacion', 'Marte'])
    expect(r.cubiertos.sort()).toEqual(['conciliacion', 'gestoria', 'ocr'])
    expect(r.pendientes.sort()).toEqual(['facturacion', 'running'])
    expect(r.desconocidos).toEqual(['marte'])
  })
  it('tolera null/vacíos', () => {
    expect(decidirDestinos(null)).toEqual({ cubiertos: [], pendientes: [], desconocidos: [] })
    expect(decidirDestinos([null, '', '  '])).toEqual({ cubiertos: [], pendientes: [], desconocidos: [] })
  })
})

// Mock encadenable mínimo de Supabase: devuelve la respuesta configurada por tabla.
function fakeSupabase(responses: Record<string, unknown>) {
  return {
    from(table: string) {
      const builder: any = {
        select: () => builder, eq: () => builder, ilike: () => builder, not: () => builder,
        maybeSingle: async () => ({ data: responses[table] ?? null }),
      }
      return builder
    },
  } as any
}

describe('resolverContraparte (Prompt 2 task 5)', () => {
  it('devuelve ya_completo si trae nif y nombre', async () => {
    const r = await resolverContraparte(fakeSupabase({}), { nif: 'B12345678', nombre: 'ACME' })
    expect(r.fuente).toBe('ya_completo')
  })
  it('completa nombre desde el diccionario por NIF', async () => {
    const sb = fakeSupabase({ diccionario_nif_proveedor: { proveedor_canonico: 'Campofrío SA' } })
    const r = await resolverContraparte(sb, { nif: 'A28-123.456' })
    expect(r.nombre).toBe('Campofrío SA')
    expect(r.fuente).toBe('diccionario')
    expect(r.nif).toBe('A28123456') // normalizado (quita espacios, guiones y puntos)
  })
  it('cae a reglas si el diccionario no lo tiene', async () => {
    const sb = fakeSupabase({ diccionario_nif_proveedor: null, reglas_conciliacion: { razon_social: 'Endesa' } })
    const r = await resolverContraparte(sb, { nif: 'A81948077' })
    expect(r.nombre).toBe('Endesa')
    expect(r.fuente).toBe('reglas')
  })
  it('sin_resolver si no hay ninguna pista', async () => {
    const r = await resolverContraparte(fakeSupabase({}), {})
    expect(r.fuente).toBe('sin_resolver')
  })
})
