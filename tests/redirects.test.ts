import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { REDIRECTS } from '../src/routes/redirects'

const app = readFileSync('src/App.tsx', 'utf8')

describe('Bloque D · redirecciones de rutas viejas (punto 10)', () => {
  it('todas las rutas destino son absolutas', () => {
    for (const [, to] of REDIRECTS) expect(to.startsWith('/')).toBe(true)
  })

  it('no hay rutas viejas duplicadas', () => {
    const olds = REDIRECTS.map(([from]) => from)
    expect(new Set(olds).size).toBe(olds.length)
  })

  it('ninguna ruta destino es a su vez una ruta vieja (sin cadenas de redirección)', () => {
    const olds = new Set(REDIRECTS.map(([from]) => '/' + from))
    for (const [, to] of REDIRECTS) expect(olds.has(to)).toBe(false)
  })

  it('App.tsx implementa cada redirección con <Navigate>', () => {
    for (const [from, to] of REDIRECTS) {
      const esperado = `path="${from}" element={<Navigate to="${to}" replace />}`
      expect(app, `falta la redirección de "${from}" → "${to}"`).toContain(esperado)
    }
  })
})
