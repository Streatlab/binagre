/**
 * normPlato — normalización de nombre de plato para cruces por texto (ventas_plato ↔
 * recetas ↔ carta_platos). Réplica en JS de la función canónica `norm_plato()` de
 * Postgres (usada por `v_margen_plato`/`mapeo_plato_receta`): minúsculas, sin acentos
 * (la ñ se conserva, igual que hace `unaccent`), sin símbolos, espacios colapsados.
 *
 * Usar SIEMPRE que se compare un nombre de plato/receta por texto en el cliente —
 * un `===` exacto falla en cuanto cambia una mayúscula, un acento o un espacio de más
 * (Tanda 8: así se descubrió que Menú Engineering perdía popularidad real por esto).
 */
export function normPlato(t: string | null | undefined): string {
  const PLACEHOLDER = ''
  return (t || '')
    .toLowerCase()
    .replace(/ñ/g, PLACEHOLDER)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(PLACEHOLDER).join('ñ')
    .replace(/[^a-z0-9ñ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Similitud simple por solapamiento de palabras (Jaccard), 0-1. Para sugerencias de
 *  enlace, no para autovincular: siempre pide confirmación humana. */
export function similitudPlato(a: string, b: string): number {
  const na = normPlato(a), nb = normPlato(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  const wa = new Set(na.split(' ').filter(Boolean))
  const wb = new Set(nb.split(' ').filter(Boolean))
  if (na.includes(nb) || nb.includes(na)) return 0.85
  let inter = 0
  for (const w of wa) if (wb.has(w)) inter++
  const union = new Set([...wa, ...wb]).size
  return union > 0 ? inter / union : 0
}
