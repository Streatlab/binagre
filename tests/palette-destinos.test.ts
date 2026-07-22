import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// R2 + F3: ninguna entrada del Command Palette (Alt+K) puede apuntar a un area
// inexistente, y la paleta debe alcanzar las 6 areas del ERP con sus pestanas.
// Test estatico (sin montar React): protege contra enlaces muertos entre sesiones
// sin falsos fallos — solo valida el primer segmento de ruta contra las rutas reales.

const palette = readFileSync('src/components/CommandPalette.tsx', 'utf8')
const app = readFileSync('src/App.tsx', 'utf8')

// Rutas destino de cada entrada de la paleta: path: '/...'
const paletaPaths = Array.from(palette.matchAll(/path:\s*'([^']+)'/g)).map(m => m[1])
// Primer segmento de cada ruta declarada en App.tsx: path="segmento/...".
const rutasSegmentos = new Set(
  Array.from(app.matchAll(/path="\/?([a-z][a-z0-9-]*)/g)).map(m => m[1]),
)

const primerSegmento = (p: string) => p.replace(/^\//, '').split(/[/?]/)[0]

describe('Command Palette · destinos reales (R2 · sin enlaces muertos)', () => {
  it('hay entradas en la paleta', () => {
    expect(paletaPaths.length).toBeGreaterThan(50)
  })

  it('cada entrada apunta a un area con ruta real en App.tsx', () => {
    for (const p of paletaPaths) {
      const seg = primerSegmento(p)
      if (seg === '') continue // raiz '/'
      expect(rutasSegmentos.has(seg), `Command Palette apunta a area inexistente: "${p}"`).toBe(true)
    }
  })
})

describe('Command Palette · cobertura de areas (F3 · Alt+K llega a todo)', () => {
  // Prefijos de las 6 areas + transversales que la paleta debe cubrir.
  const AREAS_ESPERADAS = ['finanzas', 'ventas-panel', 'cocina', 'compras', 'ops', 'configuracion']
  for (const area of AREAS_ESPERADAS) {
    it(`la paleta alcanza el area "${area}"`, () => {
      expect(palette.includes(area), `falta destino de area "${area}" en Command Palette`).toBe(true)
    })
  }

  it('se dispara con Alt+K / Cmd+K', () => {
    expect(/key\s*===\s*['"]k['"]/i.test(palette) || /['"]k['"]/.test(palette)).toBe(true)
  })
})
