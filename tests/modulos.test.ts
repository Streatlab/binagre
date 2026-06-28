import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Valida que los modulos que mueven dinero / cabecera del ERP existen SIEMPRE
// y no quedan a medias (restos de conflicto de merge o archivo vacio).
// Solo toca 6 archivos conocidos-sanos, asi que NO da falsos fallos.
// Si alguno desaparece o queda roto, el build falla y la version mala NO se publica.

const __dirname = dirname(fileURLToPath(import.meta.url))
const PAGES_DIR = join(__dirname, '..', 'src', 'pages')

const CRITICOS = [
  'Dashboard.tsx',
  'Facturacion.tsx',
  'Conciliacion.tsx',
  'PagosCobros.tsx',
  'PanelGlobal.tsx',
  'Escandallo.tsx',
]

describe('modulos criticos blindados', () => {
  for (const f of CRITICOS) {
    const full = join(PAGES_DIR, f)
    it(`existe ${f}`, () => {
      expect(existsSync(full)).toBe(true)
    })
    it(`sano ${f}`, () => {
      const src = readFileSync(full, 'utf8')
      expect(src.trim().length).toBeGreaterThan(0)
      expect(src.includes('<<<<<<<')).toBe(false)
      expect(src.includes('>>>>>>>')).toBe(false)
    })
  }
})
