// fichasHuerfanas — lógica pura (sin red, sin JSX) de la cola de revisión manual de
// fichas huérfanas (Plato maestro, Pieza 3). Espejo en TypeScript del criterio anti-pisado
// que aplica fn_enlazar_ficha_huerfana en Postgres: un campo del candidato NUNCA se pisa si
// ya tiene dato; solo se completa desde la ficha huérfana cuando el candidato lo tiene vacío.
// Vive fuera de src/components para poder testearse con import relativo simple (sin alias
// '@/...', sin supabase, sin lucide) desde tests/, igual que src/utils/waterfallReceta.ts.

export type TonoCampo = 'ok' | 'gana' | 'sin'

export interface EstadoCampo { texto: string; tono: TonoCampo }

/**
 * Decide qué pasa con UN campo (foto/elaboración/alérgenos/conservación) al enlazar una ficha
 * huérfana con un candidato ya vinculado.
 * - candidato ya tiene dato → nunca se toca ("ya lo tiene"), sea lo que sea que traiga la huérfana.
 * - candidato vacío + huérfana con dato → el candidato se completa ("lo gana de esta ficha").
 * - candidato vacío + huérfana vacía → no hay nada que mover ("sin dato").
 */
export function campoAporta(huerfanaTiene: boolean, candidatoTiene: boolean): EstadoCampo {
  if (candidatoTiene) return { texto: 'ya lo tiene', tono: 'ok' }
  if (huerfanaTiene) return { texto: 'lo gana de esta ficha', tono: 'gana' }
  return { texto: 'sin dato', tono: 'sin' }
}
