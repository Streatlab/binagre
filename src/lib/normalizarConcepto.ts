/**
 * Normaliza un concepto bancario para usarlo como `patron` en reglas de
 * categorización automática. Devuelve un string corto en minúsculas.
 *
 * Ejemplos:
 *   "Lidl mad-peña gorbea     madrid       es"  → "lidl"
 *   "Mercadona C.C. Xanadu ref 123456"           → "mercadona"
 *   "Compra tarjeta uber eats 28009 madrid"      → "uber eats"
 */

const STOP_WORDS = new Set<string>([
  // Tipos de operación
  'compra', 'tarjeta', 'pago', 'recibo', 'transferencia', 'transf',
  'bizum', 'devolucion', 'liquidacion', 'cargo', 'abono', 'ingreso',
  // Ubicaciones / país / regiones
  'madrid', 'barcelona', 'valencia', 'sevilla', 'malaga', 'bilbao',
  'es', 'esp', 'espana', 'españa', 'spain',
  'peña', 'gorbea', 'xanadu', 'cc', 'c.c.',
  // Articulos y conectores
  'de', 'del', 'la', 'el', 'los', 'las', 'en', 'por', 'para', 'con', 'sin',
  'y', 'o', 'al', 'a',
])

export function normalizarConcepto(raw: string): string {
  if (!raw) return ''
  let s = raw.toLowerCase()

  // Quitar acentos para comparar uniformemente
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, '')

  // Eliminar prefijos típicos de extracto: "mad-xxx", "esp-xxx"
  s = s.replace(/\b(mad|esp|es)-?[a-z0-9]+\b/g, ' ')

  // Eliminar referencias: "ref 12345", "ref. 12345", "n.ref 12345"
  s = s.replace(/\b(?:n[º\.]?\s*)?ref\.?\s*\d+\b/g, ' ')

  // Eliminar números largos (>= 4 cifras): refs, códigos postales, transacciones
  s = s.replace(/\b\d{4,}\b/g, ' ')

  // Eliminar puntuación
  s = s.replace(/[.,;:_()/\\\-]+/g, ' ')

  // Colapsar espacios
  s = s.replace(/\s+/g, ' ').trim()

  // Tokenizar y filtrar stop words
  const tokens = s.split(' ').filter(t => t && !STOP_WORDS.has(t) && t.length >= 2)

  // Coger las primeras 2 palabras significativas
  return tokens.slice(0, 2).join(' ')
}

/**
 * Comprueba si el concepto normalizado de un movimiento coincide con un patrón
 * de regla. La coincidencia es: el patrón aparece como substring en el concepto
 * normalizado.
 */
export function matchPatron(conceptoNorm: string, patron: string): boolean {
  if (!patron) return false
  const c = conceptoNorm.toLowerCase()
  const p = patron.toLowerCase().trim()
  if (!p) return false
  // soporte * y ? (heredado de ReglasPanel)
  if (p.includes('*') || p.includes('?')) {
    const esc = p.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    const rx = new RegExp('^' + esc.replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
    return rx.test(c)
  }
  return c.includes(p)
}
