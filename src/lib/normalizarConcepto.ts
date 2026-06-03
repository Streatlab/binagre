/**
 * Normaliza un concepto bancario para usarlo como `patron` en reglas de
 * categorización automática. Devuelve un string corto en minúsculas.
 *
 * Ejemplos:
 *   "Lidl mad-peña gorbea     madrid       es"  → "lidl"
 *   "Mercadona C.C. Xanadu ref 123456"           → "mercadona"
 *   "Compra tarjeta uber eats 28009 madrid"      → "uber eats"
 */

import { supabase } from '@/lib/supabase'

// Lista por defecto (respaldo si la tabla está vacía o falla)
const STOP_WORDS_DEFAULT = new Set<string>([
  // Tipos de operación
  'compra', 'tarjeta', 'pago', 'recibo', 'transferencia', 'transf',
  'bizum', 'devolucion', 'liquidacion', 'cargo', 'abono', 'ingreso',
  // Ubicaciones / país / regiones
  'madrid', 'barcelona', 'valencia', 'sevilla', 'malaga', 'bilbao',
  'es', 'esp', 'espana', 'españa', 'spain',
  'peña', 'gorbea', 'xanadu', 'cc', 'c.c.',
  // Artículos y conectores
  'de', 'del', 'la', 'el', 'los', 'las', 'en', 'por', 'para', 'con', 'sin',
  'y', 'o', 'al', 'a',
  // Meses (evita que "enero" / "febrero"… sea el único token)
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
])

// Caché de módulo: se inicializa con los defaults y se actualiza en `inicializarStopwords`
let stopwordsCache: Set<string> = STOP_WORDS_DEFAULT

/**
 * Carga las stop-words desde `stopwords_concepto` y las almacena en caché.
 * Debe llamarse una vez al arrancar la aplicación (e.g. en un useEffect de raíz).
 * Si la tabla está vacía o falla, se mantiene la lista por defecto.
 */
export async function inicializarStopwords(): Promise<void> {
  try {
    const { data, error } = await supabase.from('stopwords_concepto').select('palabra')
    if (!error && data && data.length > 0) {
      stopwordsCache = new Set(data.map((r: { palabra: string }) => r.palabra.toLowerCase()))
    }
  } catch {
    // Mantener defaults en caso de error de red
  }
}

export function normalizarConcepto(raw: string): string {
  if (!raw) return ''
  let s = raw.toLowerCase()

  // Quitar acentos para comparar uniformemente
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, '')

  // Eliminar prefijos típicos de extracto: "mad-xxx", "esp-xxx"
  s = s.replace(/\b(mad|esp|es)-?[a-z0-9]+\b/g, ' ')

  // Eliminar referencias: "ref 12345", "ref. 12345", "n.ref 12345"
  s = s.replace(/\b(?:n[º.]?\s*)?ref\.?\s*\d+\b/g, ' ')

  // Eliminar puntuación
  s = s.replace(/[.,;:_()/\\-]+/g, ' ')

  // Colapsar espacios
  s = s.replace(/\s+/g, ' ').trim()

  const tokens = s.split(' ').filter(t => t && !stopwordsCache.has(t) && t.length >= 2)

  // Separar tokens numéricos de los alfanuméricos
  const tokensTexto = tokens.filter(t => !/^\d+$/.test(t))
  const tokensNumericos = tokens.filter(t => /^\d+$/.test(t))

  // Usar tokens de texto primero; si no quedan, usar los numéricos como último recurso
  // (conservar posibles nº de pedido cuando sean el único token útil — C-05)
  const finalTokens = tokensTexto.length > 0 ? tokensTexto : tokensNumericos

  return finalTokens.slice(0, 2).join(' ')
}

/**
 * Comprueba si el concepto normalizado de un movimiento coincide con un patrón
 * de regla.
 *
 * - Sin comodines: exige frontera de palabra para cada token del patrón (C-04).
 *   "uber" casa con "uber eats" pero NO con "uberpreis" ni "suberata".
 * - Con * / ?: match glob sobre el concepto completo (comportamiento heredado).
 */
export function matchPatron(conceptoNorm: string, patron: string): boolean {
  if (!patron) return false
  const c = conceptoNorm.toLowerCase()
  const p = patron.toLowerCase().trim()
  if (!p) return false

  // Soporte glob * y ? (heredado de ReglasPanel)
  if (p.includes('*') || p.includes('?')) {
    const esc = p.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    const rx = new RegExp('^' + esc.replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
    return rx.test(c)
  }

  // Frontera de palabra: cada token del patrón debe estar completo en el concepto (C-04)
  return p.split(/\s+/).filter(Boolean).every(word => {
    const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`\\b${esc}\\b`, 'i').test(c)
  })
}
