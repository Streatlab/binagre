// normalizarMarca — homogeneiza el nombre de marca que traen los CSV operativos
// (Uber "historial de pedidos", Glovo/Just Eat "orderDetails") contra el maestro
// `marcas` de Configuración. Los exports de plataforma no son consistentes entre
// sí ni en el tiempo (mayúsculas, sufijo de local "- MAD - Calle X", nombres
// parciales tipo "Ninja Ramen" vs "Ninja Ramen & Katsu Club"...).
//
// Regla de coincidencia (deliberadamente conservadora — nunca inventa marca):
//   1. Igualdad exacta tras normalizar (minúsculas, sin tildes/puntuación).
//   2. Contención completa (uno de los dos strings normalizados contiene al
//      otro entero) Y el string contenido tiene ≥2 palabras significativas.
//   3. ≥2 palabras significativas en común Y esas palabras cubren ≥60% de las
//      palabras significativas del valor sucio.
// Si hay AMBIGÜEDAD (coincide con ≥2 marcas canónicas) o no hay coincidencia
// suficiente, se devuelve el valor original sin tocar — mejor dato sucio
// visible que dato mal agrupado.

const STOPWORDS = new Set(['la', 'el', 'los', 'las', 'de', 'del', 'y', 'en', 'con', 'por', 'para', 'al'])

function normalizar(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function palabrasSignificativas(norm: string): string[] {
  return norm.split(' ').filter(w => w.length >= 3 && !STOPWORDS.has(w))
}

export interface MarcaCanonica {
  nombre: string
}

/**
 * Corta sufijos de local/dirección que los exports pegan al nombre de marca:
 * "Binagre - MAD - Calle Pico de la Maliciosa" → "Binagre"
 * "Los Menús de Carmiña (Pico de la Maliciosa)" → "Los Menús de Carmiña"
 */
export function limpiarSufijoLocal(raw: string): string {
  let s = (raw || '').replace(/[\r\n]+/g, ' ').trim()
  const corteParentesis = s.indexOf('(')
  if (corteParentesis > 0) s = s.slice(0, corteParentesis)
  // " - " como separador de local solo si deja al menos 2 caracteres antes
  const guionMatch = s.match(/^(.{2,}?)\s+-\s+.+$/)
  if (guionMatch) s = guionMatch[1]
  return s.trim()
}

/**
 * Intenta mapear un valor de marca "sucio" (tal como viene del CSV de la
 * plataforma) a su nombre canónico en el maestro `marcas`. Si no hay
 * coincidencia clara y no ambigua, devuelve el valor de entrada (ya pasado
 * por limpiarSufijoLocal) sin modificar.
 */
export function normalizarMarca(raw: string, canonicas: MarcaCanonica[]): string {
  const base = limpiarSufijoLocal(raw) || 'Sin marca'
  if (!canonicas || canonicas.length === 0) return base

  const normBase = normalizar(base)
  const palabrasBase = palabrasSignificativas(normBase)

  const candidatos: string[] = []

  for (const m of canonicas) {
    const normCanon = normalizar(m.nombre)
    if (!normCanon) continue

    if (normBase === normCanon) return m.nombre // igualdad exacta gana siempre, sin ambigüedad posible

    const palabrasCanon = palabrasSignificativas(normCanon)
    const contenido = normCanon.includes(normBase) || normBase.includes(normCanon)
    const masCorta = normBase.length <= normCanon.length ? palabrasBase : palabrasCanon
    if (contenido && masCorta.length >= 2) {
      candidatos.push(m.nombre)
      continue
    }

    if (palabrasBase.length === 0) continue
    const comunes = palabrasBase.filter(w => palabrasCanon.includes(w))
    if (comunes.length >= 2 && comunes.length / palabrasBase.length >= 0.6) {
      candidatos.push(m.nombre)
    }
  }

  const unicos = Array.from(new Set(candidatos))
  if (unicos.length === 1) return unicos[0]
  return base // 0 candidatos o ambiguo (≥2) → no se toca, se deja el dato tal cual llegó
}
