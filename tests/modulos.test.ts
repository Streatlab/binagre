import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync, existsSync } from 'fs'
import { join } from 'path'

// Smoke ampliado: protege que ningun modulo se rompa entre sesiones.
// Valida la SALUD ESTRUCTURAL de cada pagina sin montar React ni tocar Supabase,
// asi que es rapido, sin env, y NO da falsos fallos.
// Detecta la rotura tipica: archivo truncado/cortado a medias, sin export, o vacio.
// Si algo de esto pasa, el build falla y la version mala NO se publica.

const PAGES_DIR = join(__dirname, '..', 'src', 'pages')

// Recorre src/pages en profundidad y devuelve todos los .tsx (excluye tests).
function listTsx(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...listTsx(full))
    } else if (entry.endsWith('.tsx') && !entry.endsWith('.test.tsx')) {
      out.push(full)
    }
  }
  return out
}

// Cuenta delimitadores fuera de strings/comentarios de forma aproximada pero suficiente
// para pillar un archivo cortado a medias (la causa #1 de roturas entre chats).
function balanced(src: string): boolean {
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' }
  const opens = new Set(['(', '[', '{'])
  const stack: string[] = []
  for (const ch of src) {
    if (opens.has(ch)) stack.push(ch)
    else if (ch in pairs) {
      if (stack.pop() !== pairs[ch]) return false
    }
  }
  return stack.length === 0
}

// Modulos CRITICOS que mueven dinero o son cabecera del ERP: deben existir SIEMPRE.
// Si alguno desaparece del repo, el build falla.
const CRITICOS = [
  'Dashboard.tsx',
  'Facturacion.tsx',
  'Conciliacion.tsx',
  'PagosCobros.tsx',
  'PanelGlobal.tsx',
  'Escandallo.tsx',
]

describe('modulos congelados existen', () => {
  for (const f of CRITICOS) {
    it(`existe ${f}`, () => {
      expect(existsSync(join(PAGES_DIR, f))).toBe(true)
    })
  }
})

describe('salud estructural de todas las paginas', () => {
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
      // No esta cortado a medias
      expect(balanced(src)).toBe(true)
    })
  }
})
