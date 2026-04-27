/**
 * T-F2-02 — Auto-detección de plataforma por NIF emisor o cabeceras de texto.
 *
 * Reglas (en orden de prioridad):
 *   1. NIF B88515200  → uber       (Portier Eats Spain SL)
 *   2. NIF B67282871  → glovo      (Glovoapp Europe SL)
 *   3. Cabecera "RusHour" o "PLATINIUM" → rushour
 *   4. Cabecera "Just Eat" o "Takeaway" → just_eat
 *   5. Resto → desconocido
 */

export type PlataformaDetectada = 'uber' | 'glovo' | 'just_eat' | 'rushour' | 'desconocido'

const NIF_UBER_PORTIER = 'B88515200'
const NIF_GLOVO = 'B67282871'

/**
 * Normaliza un NIF quitando guiones, espacios y poniéndolo en mayúsculas.
 */
function normalizarNIF(nif: string): string {
  return nif.replace(/[-\s]/g, '').toUpperCase()
}

/**
 * detectarPlataforma — determina qué plataforma ha emitido la factura.
 *
 * @param textoExtraido  Texto completo del PDF/CSV/XLSX ya extraído
 * @param nifEmisor      NIF del emisor si ya fue parseado; puede ser vacío o undefined
 */
export function detectarPlataforma(
  textoExtraido: string,
  nifEmisor?: string | null,
): PlataformaDetectada {
  // 1. Por NIF emisor explícito
  if (nifEmisor) {
    const nif = normalizarNIF(nifEmisor)
    if (nif === NIF_UBER_PORTIER) return 'uber'
    if (nif === NIF_GLOVO) return 'glovo'
  }

  // 2. Buscar NIF dentro del texto completo (por si no fue parseado por separado)
  const textoUpper = textoExtraido.toUpperCase()

  if (textoUpper.includes(NIF_UBER_PORTIER)) return 'uber'
  if (textoUpper.includes(NIF_GLOVO)) return 'glovo'

  // 3. Cabeceras Rushour
  if (
    textoUpper.includes('RUSHOUR') ||
    textoUpper.includes('RUSH HOUR') ||
    textoUpper.includes('PLATINIUM') ||       // Plan de Rushour
    textoUpper.includes('PLATINIUM AT €')     // línea de precio Rushour
  ) return 'rushour'

  // 4. Cabeceras Just Eat / Takeaway
  if (
    textoUpper.includes('JUST EAT') ||
    textoUpper.includes('TAKEAWAY.COM') ||
    textoUpper.includes('JUST-EAT')
  ) return 'just_eat'

  return 'desconocido'
}
