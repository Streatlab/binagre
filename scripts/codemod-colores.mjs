// scripts/codemod-colores.mjs
// Codemod color-a-pelo → token del kit (neobrutal.ts).
// Regla: solo sustituye hex que sean el VALOR COMPLETO de un literal ('#hex' | "#hex" | `#hex`).
// Los hex embebidos en strings mayores se dejan y se listan como pendientes (siguiente tanda).
// Excluye src/styles, marcoDoc.ts, src/components/marco y las 4 vistas ya migradas al marco.
import fs from 'node:fs'
import path from 'node:path'

const SRC = 'src'
const EXCLUDE_DIR = ['src/styles', 'src/components/marco']
const EXCLUDE_FILE = new Set([
  'src/lib/marcoDoc.ts',
  // Punto 27: vistas ya migradas al marco — no se pisan
  'src/pages/cocina/Produccion.tsx',
  'src/pages/cocina/Esquemas.tsx',
  'src/pages/cocina/ListaCompra.tsx',
  'src/components/escandallo/TabFichas.tsx',
])

const MAP = {
  '#fff': 'BLANCO', '#ffffff': 'BLANCO',
  '#b01d23': 'GRANATE',
  '#1d9e75': 'VERDE', '#06c167': 'VERDE',
  '#e24b4a': 'ROJO', '#ff4757': 'ROJO', '#aa3030': 'ROJO',
  '#ffaaaa': 'ROJO_S',
  '#f5a623': 'NAR', '#f26b1f': 'NAR',
  '#fcefd6': 'NAR_S',
  '#e8f442': 'LIMA',
  '#7a8090': 'GRIS', '#777777': 'GRIS', '#cccccc': 'GRIS', '#9a8f78': 'GRIS',
  '#2a2a2a': 'INK', '#1e1e1e': 'INK', '#111111': 'INK', '#111': 'INK',
  '#141414': 'INK', '#1a1a1a': 'INK', '#0a0a0a': 'INK', '#222222': 'INK',
  '#383838': 'INK', '#140f08': 'INK',
  '#d0c8bc': 'BORDE_SUAVE', '#ebe8e2': 'BORDE_SUAVE',
  '#3a4050': 'OSC',
  '#1e5bcc': 'AZUL',
  '#66aaff': 'AZUL_CL',
}
const TOKENS = [...new Set(Object.values(MAP))]
// Atributos JSX/SVG cuyo valor es un color: en `attr="#hex"` hay que envolver en {TOKEN}.
// El resto de `nombre='#hex'` es asignación JS normal → identificador pelado.
const JSX_ATTRS = new Set(['fill', 'stroke', 'stopcolor', 'color', 'colorhover', 'dot', 'track', 'fondo', 'floodcolor'])

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (EXCLUDE_DIR.some(d => p === d || p.startsWith(d + path.sep))) continue
      walk(p, acc)
    } else if (/\.(ts|tsx)$/.test(e.name) && !EXCLUDE_FILE.has(p)) acc.push(p)
  }
  return acc
}

const files = walk(SRC)
let totalRepl = 0, filesChanged = 0
const perHex = {}
const unmatched = {} // hex fuera de tabla → { hex: {file: count} }

// hex embebidos/no-tabla: cualquier #hex de 3/4/6/8
const ANYHEX = /#[0-9a-fA-F]{3,8}\b/g
// hex que es el valor completo de un literal
const FULL = /(['"`])(#[0-9a-fA-F]{3,8})\1/g

function backticksBefore(s, idx) {
  let n = 0
  for (let i = 0; i < idx; i++) if (s[i] === '`' && s[i - 1] !== '\\') n++
  return n
}

// Contexto del match dentro de un template literal:
//  'none' → no está en template
//  'expr' → dentro de una interpolación ${...}  → identificador pelado
//  'text' → texto crudo del template (p.ej. SVG en string) → ${TOKEN} entre comillas
function tplContext(s, idx) {
  if (backticksBefore(s, idx) % 2 === 0) return 'none'
  const open = s.lastIndexOf('`', idx - 1)
  const seg = s.slice(open + 1, idx)
  let depth = 0
  for (let i = 0; i < seg.length; i++) {
    if (seg[i] === '{') depth++
    else if (seg[i] === '}') depth--
  }
  return depth > 0 ? 'expr' : 'text'
}

for (const file of files) {
  let src = fs.readFileSync(file, 'utf8')
  const used = new Set()
  const removedLocal = new Set()
  let changed = false

  // ── Paso 0: eliminar consts-color LOCALES (NO exportadas) que duplican un token ──
  // p.ej.  const VERDE = '#1D9E75'  → se borra y se usa el token importado.
  // Las EXPORTADAS se dejan intactas (otros módulos las importan).
  const declLine = new RegExp(
    `^[ \\t]*(?:const|let|var)\\s+(${TOKENS.join('|')})\\s*=\\s*(['"\`])(#[0-9a-fA-F]{3,8})\\2\\s*;?[ \\t]*(?:\\/\\/[^\\n]*)?\\r?\\n`,
    'gm',
  )
  src = src.replace(declLine, (m, tok, _q, hex) => {
    if (MAP[hex.toLowerCase()] === tok) { removedLocal.add(tok); changed = true; return '' }
    return m
  })

  // guard: no tocar líneas que DEFINEN un token (compuestas o exportadas) → evita const X = X
  const defRe = t => new RegExp(`(?:export\\s+)?(?:const|let|var)\\s+${t}\\b\\s*=`)

  const out = src.replace(FULL, (m, q, hex, offset) => {
    const key = hex.toLowerCase()
    const tok = MAP[key]
    if (!tok) return m
    const ls = src.lastIndexOf('\n', offset) + 1
    const le = src.indexOf('\n', offset)
    const line = src.slice(ls, le === -1 ? src.length : le)
    if (defRe(tok).test(line)) return m
    const ctx = tplContext(src, offset)
    if (ctx === 'text') {
      // texto crudo dentro de un template (SVG/HTML en string): interpola conservando comillas
      used.add(tok); changed = true; totalRepl++; perHex[key] = (perHex[key] || 0) + 1
      return q + '${' + tok + '}' + q
    }
    // 'expr' (dentro de ${...}) o 'none': el literal ES una expresión → identificador pelado,
    // salvo atributo JSX de color (fill="#hex", stroke=…, color=…) que exige llaves.
    used.add(tok); changed = true; totalRepl++; perHex[key] = (perHex[key] || 0) + 1
    // Convención del repo (Prettier): atributo JSX → comilla DOBLE (fill="#hex", fg="#hex");
    // asignación JS → comilla SIMPLE (x='#hex'). Solo el primero exige llaves.
    const before2 = src[offset - 2]
    if (ctx === 'none' && q === '"' && src[offset - 1] === '=' && !['=', '!', '<', '>'].includes(before2)) {
      return '{' + tok + '}'
    }
    return tok
  })

  if (!changed) {
    // aun así, escanear hex fuera de tabla para el informe
    for (const mm of src.matchAll(ANYHEX)) {
      const k = mm[0].toLowerCase()
      if (!MAP[k]) { (unmatched[k] ??= {}); unmatched[k][file] = (unmatched[k][file] || 0) + 1 }
    }
    continue
  }

  // escanear hex fuera de tabla en el resultado
  for (const mm of out.matchAll(ANYHEX)) {
    const k = mm[0].toLowerCase()
    if (!MAP[k]) { (unmatched[k] ??= {}); unmatched[k][file] = (unmatched[k][file] || 0) + 1 }
  }

  // ── inyección de imports ──
  // tokens ya disponibles: declarados localmente o ya importados
  const localDecl = new Set()
  for (const t of TOKENS) if (new RegExp(`(?:const|let|var)\\s+${t}\\b`).test(out)) localDecl.add(t)
  const alreadyImported = new Set()
  for (const im of out.matchAll(/import\s*\{([\s\S]*?)\}\s*from/g)) {
    for (const name of im[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim())) {
      if (name) alreadyImported.add(name)
    }
  }
  const wanted = new Set([...used, ...removedLocal])
  const need = [...wanted].filter(t => !localDecl.has(t) && !alreadyImported.has(t)).sort()

  let final = out
  if (need.length) {
    const neoImp = out.match(/import\s*\{([\s\S]*?)\}\s*from\s*(['"])@\/styles\/neobrutal\2/)
    if (neoImp) {
      const existing = neoImp[1].split(',').map(s => s.trim()).filter(Boolean)
      const merged = [...new Set([...existing, ...need])]
      final = out.replace(neoImp[0], `import { ${merged.join(', ')} } from '@/styles/neobrutal'`)
    } else {
      // Anteponer al inicio del archivo: válido siempre y evita partir imports multilínea.
      const line = `import { ${need.join(', ')} } from '@/styles/neobrutal'`
      final = line + '\n' + out
    }
  }

  fs.writeFileSync(file, final)
  filesChanged++
}

console.log(`\n=== CODEMOD COLOR → TOKEN ===`)
console.log(`Archivos modificados: ${filesChanged}`)
console.log(`Sustituciones totales: ${totalRepl}`)
console.log(`\nPor hex (tabla):`)
for (const [h, n] of Object.entries(perHex).sort((a, b) => b[1] - a[1])) console.log(`  ${h} → ${MAP[h]}: ${n}`)

// informe de colores fuera de tabla, por frecuencia global
const flat = Object.entries(unmatched).map(([hex, files]) => {
  const total = Object.values(files).reduce((a, b) => a + b, 0)
  return { hex, total, files }
}).sort((a, b) => b.total - a.total)
fs.writeFileSync('scripts/colores-fuera-tabla.json', JSON.stringify(flat, null, 2))
console.log(`\nColores FUERA de tabla (pendientes): ${flat.length} distintos → scripts/colores-fuera-tabla.json`)
console.log('Top 15:')
for (const r of flat.slice(0, 15)) console.log(`  ${r.hex}: ${r.total}`)
