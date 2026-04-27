/**
 * normalizar.ts
 * Funciones de normalización de texto y dedup_key SHA-256.
 *
 * La función `normalizarConcepto` aquí es una versión LIGERA (lowercase/trim/collapse)
 * usada específicamente para la dedup_key. La versión enriquecida con stop-words y
 * tokenización para el motor de reglas sigue viviendo en normalizarConcepto.ts.
 */

export function normalizarConcepto(c: string): string {
  return (c ?? '').toLowerCase().trim().replace(/\s+/g, ' ')
}

export async function calcularDedupKey(
  titularId: string,
  fecha: string,
  importe: number,
  concepto: string
): Promise<string> {
  const data = new TextEncoder().encode(
    `${titularId}${fecha}${Math.round(importe * 100)}${normalizarConcepto(concepto)}`
  )
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
