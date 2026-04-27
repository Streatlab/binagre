/**
 * T-F2-08 — Auto-detección de marca por 4 criterios de prioridad.
 *
 * Criterios (en orden):
 *  1. Campo "cliente" contiene el nombre de la marca directamente
 *     (ej: "Rubén Rodríguez Vinagre / Mister Katsu")
 *  2. Campo "cliente" contiene el nombre local del restaurante
 *     (ej: "Los Menús de Carmiña (Pico de la Maliciosa)")
 *  3. Campo "concepto" de la factura hace referencia a la marca
 *     (ej: "cuenta STREAT LAB - MALICIOSA")
 *  4. Cross-cruce con maestro de marcas (tabla `marcas` desde Configuración)
 *  5. Fallback: 'SIN_MARCA' (sentinel, no NULL — permite UNIQUE constraint)
 */

export interface MarcaMaestra {
  nombre: string
  nombre_local?: string | null
  alias?: string[] | null
}

/**
 * Normaliza texto: minúsculas + quitar tildes + quitar puntuación no alfanumérica
 */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Comprueba si el haystack contiene el needle (ambos normalizados).
 * Usa palabra completa para evitar falsos positivos cortos.
 */
function contiene(haystack: string, needle: string): boolean {
  const h = normalizar(haystack)
  const n = normalizar(needle)
  if (!n || n.length < 3) return false
  return h.includes(n)
}

/**
 * detectarMarca — busca el nombre de marca en los campos de cliente/concepto.
 *
 * @param cliente        Campo "Nombre del cliente" de la factura
 * @param concepto       Campo "Concepto / descripción" de la factura
 * @param marcasMaestras Lista de marcas del maestro (tabla `marcas` en BD)
 */
export function detectarMarca(
  cliente: string,
  concepto: string,
  marcasMaestras: MarcaMaestra[],
): string {
  if (!marcasMaestras || marcasMaestras.length === 0) {
    // Sin maestro disponible: intentar extracción directa por "/" separador Uber
    return extraerMarcaDeCliente(cliente) ?? 'SIN_MARCA'
  }

  // Criterio 1: cliente contiene nombre de la marca directamente
  for (const m of marcasMaestras) {
    if (contiene(cliente, m.nombre)) return m.nombre
    // También buscar alias
    if (m.alias) {
      for (const a of m.alias) {
        if (contiene(cliente, a)) return m.nombre
      }
    }
  }

  // Criterio 2: cliente contiene nombre local del restaurante
  for (const m of marcasMaestras) {
    if (m.nombre_local && contiene(cliente, m.nombre_local)) return m.nombre
  }

  // Criterio 3: concepto hace referencia a la marca
  for (const m of marcasMaestras) {
    if (contiene(concepto, m.nombre)) return m.nombre
    if (m.nombre_local && contiene(concepto, m.nombre_local)) return m.nombre
    if (m.alias) {
      for (const a of m.alias) {
        if (contiene(concepto, a)) return m.nombre
      }
    }
  }

  // Criterio 4: fallback extracción por separador "/" (formato Uber "Titular / Marca")
  const marcaExtraida = extraerMarcaDeCliente(cliente)
  if (marcaExtraida) return marcaExtraida

  return 'SIN_MARCA'
}

/**
 * Intenta extraer la marca del campo cliente usando el separador "/"
 * que usa Uber: "Rubén Rodríguez Vinagre / Mister Katsu"
 * Devuelve la parte DESPUÉS de "/" o null si no hay separador.
 */
function extraerMarcaDeCliente(cliente: string): string | null {
  const sep = cliente.indexOf('/')
  if (sep === -1) return null
  const despues = cliente.slice(sep + 1).trim()
  if (despues.length > 2) return despues
  return null
}
