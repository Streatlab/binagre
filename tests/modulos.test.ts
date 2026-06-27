import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync, existsSync } from 'fs'
import { join } from 'path'

// Smoke ampliado: protege que ningun modulo se rompa entre sesiones.
// Valida la SALUD de cada pagina sin montar React ni tocar Supabase: rapido,
// sin env, y SIN falsos fallos (el typecheck `tsc -b` ya cubre la sintaxis fina).
// Aqui pillamos las roturas que el typecheck no siempre frena: modulo critico
// que desaparece, archivo vacio, export perdido, o restos de conflicto de merge.

const PAGES_DIR = join(__dirname, '..', 'src', 'pages')

function listTsx(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...listTsx(full))
    else if (entry.endsWith('.tsx') && !entry.endsWith('.test.tsx')) out.push(full)
  }
  return out
}

// Modulos que mueven dinero o son cabecera del ERP: deben existir SIEMPRE.
const CRITICOS = [
  'Dashboard.tsx',
  'Facturacion.tsx',
  'Conciliacion.tsx',
  'PagosCobros.tsx',
  'PanelGlobal.tsx',
  'Escandallo.tsx',
]

describe('modulos congelados criticos existen', () => {
  for (const f of CRITICOS) {
    it(`existe ${f}`, () => {
      expect(existsSync(join(PAGES_DIR, f))).toBe(true)
    })
  }
})

describe('salud de todas las paginas', () => {
  const files = listTsx(PAGES_DIR)

  it('hay paginas que validar', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const full of files) {
    const rel = full.split('src')[1]
    it(`sana ${rel}`, () => {
      const src = readFileSync(full, 'utf8')
      // No vacio
      expect(src.trim().length).toBeGreaterThan(0)
      // Exporta algo (componente o funcion)
      expect(/export\s+(default|const|function)/.test(src)).toBe(true)
      // Sin restos de conflicto de merge (marcadores inequivocos de git)
      expect(src.includes('<<<<<<<')).toBe(false)
      expect(src.includes('>>>>>>>')).toBe(false)
    })
  }
})
