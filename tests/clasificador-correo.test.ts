import { describe, it, expect } from 'vitest'
import { clasificarPorContenido, reglaCasa } from '../api/_lib/clasificadorCorreo'

describe('clasificarPorContenido (task 7)', () => {
  it('detecta nómina', () => {
    expect(clasificarPorContenido('recibo.pdf', 'Recibo de salarios. Líquido a percibir 1.234,56').destino).toBe('doc_equipo')
    expect(clasificarPorContenido('nomina_enero.pdf', '').subtipo).toBe('nomina')
  })
  it('detecta Seguridad Social / RNT', () => {
    expect(clasificarPorContenido('doc.pdf', 'Tesorería General de la Seguridad Social').destino).toBe('doc_equipo')
    expect(clasificarPorContenido('rnt.pdf', 'Relación Nominal de Trabajadores').subtipo).toBe('rnt')
  })
  it('una factura normal NO es documento de equipo', () => {
    expect(clasificarPorContenido('factura_amazon.pdf', 'Factura A-123 Total a pagar 45,90 €').destino).toBe('factura')
  })
})

describe('reglaCasa (task 7)', () => {
  it('casa por remitente', () => {
    expect(reglaCasa({ remitente: 'gestoria@x.com' }, 'Gestoria@X.com', 'lo que sea')).toBe(true)
    expect(reglaCasa({ remitente: 'gestoria@x.com' }, 'otro@y.com', '')).toBe(false)
  })
  it('casa por asunto_contiene', () => {
    expect(reglaCasa({ asunto_contiene: 'nómina' }, 'a@b.com', 'Envío de Nómina de junio')).toBe(true)
  })
  it('regla vacía no casa', () => {
    expect(reglaCasa({}, 'a@b.com', 'x')).toBe(false)
  })
})
